/**
 * Admin flight management server functions (F14).
 * RBAC: every handler verifies the caller has the `admin` role via `has_role`.
 * All mutations append to `audit_logs` for traceability (F13).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required.");
}

const flightInputSchema = z.object({
  flight_number: z.string().trim().min(2).max(10),
  origin: z.string().trim().min(2).max(80),
  destination: z.string().trim().min(2).max(80),
  departure_time: z.string().min(10), // ISO datetime
  arrival_time: z.string().min(10),
  base_price: z.number().nonnegative().max(10_000_000),
  total_seats: z.number().int().positive().max(600),
});

function validateTimes(dep: string, arr: string) {
  const d = new Date(dep);
  const a = new Date(arr);
  if (Number.isNaN(d.getTime()) || Number.isNaN(a.getTime())) {
    throw new Error("Invalid date/time format.");
  }
  if (a.getTime() <= d.getTime()) {
    throw new Error("Arrival time must be after departure time.");
  }
}

export const adminCreateFlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => flightInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    validateTimes(data.departure_time, data.arrival_time);

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
    if (error || !row) throw new Error(error?.message ?? "Failed to create flight.");

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "flight.created",
      entity_type: "flight",
      entity_id: row.id,
      metadata: { flight_number: data.flight_number, origin: data.origin, destination: data.destination },
    });

    return { id: row.id };
  });

export const adminUpdateFlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid() }).merge(flightInputSchema).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    validateTimes(data.departure_time, data.arrival_time);

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
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "flight.updated",
      entity_type: "flight",
      entity_id: data.id,
      metadata: { flight_number: data.flight_number },
    });

    return { ok: true };
  });

export const adminSetFlightActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { error } = await supabase
      .from("flights")
      .update({ is_active: data.isActive })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: data.isActive ? "flight.enabled" : "flight.disabled",
      entity_type: "flight",
      entity_id: data.id,
      metadata: {},
    });

    return { ok: true };
  });
