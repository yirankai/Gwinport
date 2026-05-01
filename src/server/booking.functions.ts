/**
 * Server functions for booking flow (F5–F11).
 * - lockSeat: hold a seat for ~5 minutes during checkout
 * - createBooking: confirm payment (mock), create booking + payment rows, send email
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TAX_RATE = 0.075; // 7.5% VAT (Nigeria)

export const lockSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ flightId: z.string().uuid(), seatNumber: z.string().min(1).max(5) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;

      // Check the seat isn't already booked
      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("flight_id", data.flightId)
        .eq("seat_number", data.seatNumber)
        .in("status", ["confirmed", "pending"])
        .maybeSingle();
      if (existingBooking) {
        throw new Error("Seat already booked.");
      }

      // Clear our own existing locks for this flight (one seat per session)
      await supabase
        .from("seat_locks")
        .delete()
        .eq("user_id", userId)
        .eq("flight_id", data.flightId);

      // Try to insert lock. Unique (flight_id, seat_number) prevents races.
      const { error } = await supabase
        .from("seat_locks")
        .insert({ flight_id: data.flightId, seat_number: data.seatNumber, user_id: userId });

      if (error) {
        // Check if it's an active lock by someone else
        const { data: activeLock } = await supabase
          .from("seat_locks")
          .select("user_id, expires_at")
          .eq("flight_id", data.flightId)
          .eq("seat_number", data.seatNumber)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (activeLock && activeLock.user_id !== userId) {
          throw new Error("Seat is being held by another passenger. Try again in a few minutes.");
        }
        // Stale lock — delete and retry
        await supabase
          .from("seat_locks")
          .delete()
          .eq("flight_id", data.flightId)
          .eq("seat_number", data.seatNumber);
        const { error: retryError } = await supabase
          .from("seat_locks")
          .insert({ flight_id: data.flightId, seat_number: data.seatNumber, user_id: userId });
        if (retryError) throw new Error(retryError.message);
      }

      return { ok: true, expiresInSeconds: 300 };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not hold seat.";
      console.error("[lockSeat] failed:", err);
      // Return a structured failure instead of throwing — prevents the
      // server-fn runtime from surfacing a raw Response on the client.
      return { ok: false as const, error: message };
    }
  });

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        flightId: z.string().uuid(),
        seatNumber: z.string().min(1).max(5),
        passengerName: z.string().min(2).max(120),
        passengerEmail: z.string().email(),
        paymentSimulate: z.enum(["success", "fail"]).default("success"),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Verify the seat is still locked by this user (or unbooked)
    const { data: lock } = await supabase
      .from("seat_locks")
      .select("user_id, expires_at")
      .eq("flight_id", data.flightId)
      .eq("seat_number", data.seatNumber)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!lock || lock.user_id !== userId) {
      throw new Error("Your seat hold has expired. Please reselect your seat.");
    }

    // 2. Fetch flight to compute fare
    const { data: flight, error: flightErr } = await supabase
      .from("flights")
      .select("id, flight_number, origin, destination, departure_time, arrival_time, base_price")
      .eq("id", data.flightId)
      .single();
    if (flightErr || !flight) throw new Error("Flight not found.");

    const fare = Number(flight.base_price);
    const tax = Math.round(fare * TAX_RATE * 100) / 100;
    const total = Math.round((fare + tax) * 100) / 100;

    // 3. Mock payment outcome (F9)
    if (data.paymentSimulate === "fail") {
      throw new Error("Payment declined by issuer (simulated).");
    }

    // 4. Generate a booking reference via SECURITY DEFINER RPC bypass: use random in app code
    const ref = generateRef();

    // 5. Insert booking (unique flight_id+seat_number stops race)
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .insert({
        booking_reference: ref,
        user_id: userId,
        flight_id: flight.id,
        seat_number: data.seatNumber,
        passenger_name: data.passengerName,
        passenger_email: data.passengerEmail,
        fare_amount: fare,
        tax_amount: tax,
        total_amount: total,
        status: "confirmed",
        payment_status: "paid",
      })
      .select("id, booking_reference")
      .single();
    if (bookingErr || !booking) {
      throw new Error(bookingErr?.message ?? "Could not create booking.");
    }

    // 6. Insert payment record
    const txnRef = `MOCK-${Date.now().toString(36).toUpperCase()}`;
    await supabase.from("payments").insert({
      booking_id: booking.id,
      amount: total,
      status: "paid",
      transaction_ref: txnRef,
    });

    // 7. Release the seat lock
    await supabase
      .from("seat_locks")
      .delete()
      .eq("flight_id", flight.id)
      .eq("seat_number", data.seatNumber);

    // 8. Audit log
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "booking.created",
      entity_type: "booking",
      entity_id: booking.id,
      metadata: { reference: ref, total, txn: txnRef },
    });

    // 9. Fire-and-forget confirmation email (F12) via Resend gateway
    void sendConfirmationEmail({
      to: data.passengerEmail,
      passengerName: data.passengerName,
      reference: ref,
      flightNumber: flight.flight_number,
      origin: flight.origin,
      destination: flight.destination,
      departure: flight.departure_time,
      arrival: flight.arrival_time,
      seatNumber: data.seatNumber,
      fare,
      tax,
      total,
    }).catch((e) => console.error("[email] failed:", e));

    return { bookingId: booking.id, reference: ref };
  });

function generateRef() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "GW-";
  for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

interface EmailPayload {
  to: string;
  passengerName: string;
  reference: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  seatNumber: string;
  fare: number;
  tax: number;
  total: number;
}

async function sendConfirmationEmail(p: EmailPayload) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    console.warn("[email] Missing keys, skipping send.");
    return;
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
  const dep = new Date(p.departure);
  const arr = new Date(p.arrival);

  const html = `<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:24px;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);padding:24px;color:#ffffff;">
      <div style="font-size:14px;opacity:.9;">Gwinport Airlines</div>
      <h1 style="margin:8px 0 0;font-size:22px;">Your booking is confirmed ✈️</h1>
      <div style="margin-top:6px;font-size:13px;opacity:.9;">Booking ref: <strong>${p.reference}</strong></div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 12px;">Hi ${escapeHtml(p.passengerName)},</p>
      <p style="margin:0 0 16px;">Thanks for flying with Gwinport. Your e-ticket details are below.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#64748b;">Flight</td><td style="padding:8px 0;text-align:right;font-weight:600;">${p.flightNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Route</td><td style="padding:8px 0;text-align:right;font-weight:600;">${p.origin} → ${p.destination}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Departure</td><td style="padding:8px 0;text-align:right;">${dep.toUTCString()}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Arrival</td><td style="padding:8px 0;text-align:right;">${arr.toUTCString()}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Seat</td><td style="padding:8px 0;text-align:right;font-weight:600;">${p.seatNumber}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:4px 0;color:#64748b;">Fare</td><td style="padding:4px 0;text-align:right;">${fmt(p.fare)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Tax (7.5%)</td><td style="padding:4px 0;text-align:right;">${fmt(p.tax)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;">Total paid</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#2563eb;">${fmt(p.total)}</td></tr>
      </table>
      <p style="margin:24px 0 0;color:#64748b;font-size:12px;">Please arrive at the airport at least 90 minutes before departure. Bring a valid ID.</p>
    </div>
  </div>
</body></html>`;

  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: "Gwinport <onboarding@resend.dev>",
      to: [p.to],
      subject: `Booking confirmed — ${p.reference}`,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed [${res.status}]: ${body}`);
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
