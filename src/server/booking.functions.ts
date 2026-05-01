import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TAX_RATE = 0.075;

/**
 * LOCK SEAT
 */
export const lockSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      flightId: z.string().uuid(),
      seatNumber: z.string().min(1).max(5),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("bookings")
      .select("id")
      .eq("flight_id", data.flightId)
      .eq("seat_number", data.seatNumber)
      .in("status", ["confirmed", "pending"])
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        message: "Seat already booked.",
        expiresInSeconds: 0,
      };
    }

    await supabase
      .from("seat_locks")
      .delete()
      .eq("user_id", userId)
      .eq("flight_id", data.flightId);

    const { error } = await supabase.from("seat_locks").insert({
      flight_id: data.flightId,
      seat_number: data.seatNumber,
      user_id: userId,
    });

    if (error) {
      return {
        ok: false,
        message: error.message,
        expiresInSeconds: 0,
      };
    }

    return {
      ok: true,
      expiresInSeconds: 300,
    };
  });

/**
 * CREATE BOOKING
 */
export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      flightId: z.string().uuid(),
      seatNumber: z.string(),
      passengerName: z.string(),
      passengerEmail: z.string().email(),
      paymentSimulate: z.enum(["success", "fail"]).default("success"),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: lock } = await supabase
      .from("seat_locks")
      .select("user_id, expires_at")
      .eq("flight_id", data.flightId)
      .eq("seat_number", data.seatNumber)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!lock || lock.user_id !== userId) {
      return {
        ok: false,
        message: "Seat hold expired.",
      };
    }

    const { data: flight, error: flightError } = await supabase
      .from("flights")
      .select("*")
      .eq("id", data.flightId)
      .single();

    if (flightError || !flight) {
      return {
        ok: false,
        message: "Flight not found.",
      };
    }

    const fare = Number(flight.base_price);
    const tax = fare * TAX_RATE;
    const total = fare + tax;

    if (data.paymentSimulate === "fail") {
      return {
        ok: false,
        message: "Payment failed (simulated).",
      };
    }

    const ref = generateRef();

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        booking_reference: ref,
        user_id: userId,
        flight_id: data.flightId,
        seat_number: data.seatNumber,
        passenger_name: data.passengerName,
        passenger_email: data.passengerEmail,
        fare_amount: fare,
        tax_amount: tax,
        total_amount: total,
        status: "confirmed",
        payment_status: "paid",
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      return {
        ok: false,
        message: bookingError?.message ?? "Booking failed.",
      };
    }

    await supabase.from("payments").insert({
      booking_id: booking.id,
      amount: total,
      status: "paid",
      transaction_ref: `MOCK-${Date.now()}`,
    });

    await supabase
      .from("seat_locks")
      .delete()
      .eq("flight_id", data.flightId)
      .eq("seat_number", data.seatNumber);

    return {
      ok: true,
      bookingId: booking.id,
      reference: ref,
    };
  });

/**
 * REF GENERATOR
 */
function generateRef() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "GW-";
  for (let i = 0; i < 6; i++) {
    r += chars[Math.floor(Math.random() * chars.length)];
  }
  return r;
}