import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  if (!data) {
    return { ok: false, message: "Forbidden: admin role required." };
  }

  return { ok: true };
}

const flightInputSchema = z.object({
  flight_number: z.string().trim().min(2).max(10),
  origin: z.string().trim().min(2).max(80),
  destination: z.string().trim().min(2).max(80),
  departure_time: z.string(),
  arrival_time: z.string(),
  base_price: z.number().nonnegative(),
  total_seats: z.number().int().positive(),
});

function validateTimes(dep: string, arr: string) {
  const d = new Date(dep);
  const a = new Date(arr);

  if (a <= d) {
    return { ok: false, message: "Arrival must be after departure." };
  }

  return { ok: true };
}

/**
 * CREATE FLIGHT
 */
export const adminCreateFlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => flightInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const adminCheck = await assertAdmin(supabase, userId);
    if (!adminCheck.ok) return adminCheck;

    const timeCheck = validateTimes(data.departure_time, data.arrival_time);
    if (!timeCheck.ok) return timeCheck;

    const { data: row, error } = await supabase
      .from("flights")
      .insert({
        flight_number: data.flight_number.toUpperCase(),
        origin: data.origin,
        destination: data.destination,
        departure_time: data.departure_time,
        arrival_time: data.arrival_time,
        base_price: data.base_price,
        total_seats: data.total_seats,
      })
      .select("id")
      .single();

    if (error || !row) {
      return { ok: false, message: error?.message ?? "Create failed" };
    }

    return { ok: true, id: row.id };
  });

/**
 * UPDATE FLIGHT
 */
export const adminUpdateFlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid() }).merge(flightInputSchema).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const adminCheck = await assertAdmin(supabase, userId);
    if (!adminCheck.ok) return adminCheck;

    const timeCheck = validateTimes(data.departure_time, data.arrival_time);
    if (!timeCheck.ok) return timeCheck;

    const { error } = await supabase
      .from("flights")
      .update({
        flight_number: data.flight_number.toUpperCase(),
        origin: data.origin,
        destination: data.destination,
        departure_time: data.departure_time,
        arrival_time: data.arrival_time,
        base_price: data.base_price,
        total_seats: data.total_seats,
      })
      .eq("id", data.id);

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true };
  });

/**
 * ENABLE / DISABLE FLIGHT
 */
export const adminSetFlightActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      isActive: z.boolean(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const adminCheck = await assertAdmin(supabase, userId);
    if (!adminCheck.ok) return adminCheck;

    const { error } = await supabase
      .from("flights")
      .update({ is_active: data.isActive })
      .eq("id", data.id);

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true };
  });