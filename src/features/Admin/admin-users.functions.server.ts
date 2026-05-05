/**
 * Admin — User & role management (Super Admin only).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";

const ASSIGNABLE_ROLES = [
  "passenger",
  "super_admin",
  "flight_admin",
  "booking_admin",
  "support_admin",
] as const;

async function assertSuperAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin role required.");
}

/** List all users with their profile + roles. */
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, created_at")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const { data: roleRows, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    const rolesByUser = new Map<string, string[]>();
    (roleRows ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    return {
      users: (profiles ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        created_at: p.created_at,
        roles: rolesByUser.get(p.id) ?? [],
      })),
    };
  });

/**
 * Set a user's primary role. Replaces any existing admin/passenger roles
 * with exactly the one chosen (keeps things simple for the UI).
 */
export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        role: z.enum(ASSIGNABLE_ROLES),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    if (data.targetUserId === context.userId && data.role !== "super_admin") {
      throw new Error("You cannot remove your own super_admin role.");
    }

    // Remove all current roles, insert the new one. Use admin client so the
    // operation is atomic regardless of RLS quirks.
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.targetUserId);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.targetUserId, role: data.role });
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: "role.update",
      entity_type: "user",
      entity_id: data.targetUserId,
      metadata: { new_role: data.role },
    });

    return { ok: true };
  });
