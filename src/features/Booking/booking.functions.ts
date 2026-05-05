import { supabase } from "@/integrations/supabase/client";

const TAX_RATE = 0.075;

/**
 * LOCK SEAT (CLIENT-SAFE)
 */
export async function lockSeat(flightId: string, seatNumber: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;

  if (!userId) {
    return { ok: false, error: "Not authenticated." };
  }

  // check if already booked
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("flight_id", flightId)
    .eq("seat_number", seatNumber)
    .in("status", ["confirmed", "pending"])
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "Seat already booked." };
  }

  // clear previous locks
  await supabase
    .from("seat_locks")
    .delete()
    .eq("user_id", userId)
    .eq("flight_id", flightId);

  // insert lock
  const { error } = await supabase.from("seat_locks").insert({
    flight_id: flightId,
    seat_number: seatNumber,
    user_id: userId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, expiresInSeconds: 300 };
}

/**
 * CREATE BOOKING (CLIENT-SAFE)
 */
export async function createBooking(
  flightId: string,
  seatNumber: string,
  passengerName: string,
  passengerEmail: string,
  paymentSimulate: "success" | "fail"
) {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;

  if (!userId) {
    return { ok: false, error: "Not authenticated." };
  }

  // validate seat lock
  const { data: lock } = await supabase
    .from("seat_locks")
    .select("user_id, expires_at")
    .eq("flight_id", flightId)
    .eq("seat_number", seatNumber)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!lock || lock.user_id !== userId) {
    return { ok: false, error: "Seat hold expired." };
  }

  // get flight
  const { data: flight, error: flightError } = await supabase
    .from("flights")
    .select("*")
    .eq("id", flightId)
    .single();

  if (flightError || !flight) {
    return { ok: false, error: "Flight not found." };
  }

  const fare = Number(flight.base_price);
  const tax = fare * TAX_RATE;
  const total = fare + tax;

  if (paymentSimulate === "fail") {
    return { ok: false, error: "Payment failed (simulated)." };
  }

  const ref = generateRef();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      booking_reference: ref,
      user_id: userId,
      flight_id: flightId,
      seat_number: seatNumber,
      passenger_name: passengerName,
      passenger_email: passengerEmail,
      fare_amount: fare,
      tax_amount: tax,
      total_amount: total,
      status: "confirmed",
      payment_status: "paid",
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    return { ok: false, error: bookingError?.message ?? "Booking failed." };
  }

  await supabase.from("payments").insert({
    booking_id: booking.id,
    amount: total,
    status: "paid",
    transaction_ref: `MOCK-${Date.now()}`,
  });

  // release lock
  await supabase
    .from("seat_locks")
    .delete()
    .eq("flight_id", flightId)
    .eq("seat_number", seatNumber);

  return {
    ok: true,
    bookingId: booking.id,
    reference: ref,
  };
}

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