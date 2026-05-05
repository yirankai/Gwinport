/**
 * Helpers to decide where to send a user after sign-in / sign-up.
 * Reads `profiles.role_selected` and the user's roles from `user_roles`.
 */
import { supabase } from "@/integrations/supabase/client";
import { ROLE_PRIORITY, type AppRole } from "@/lib/auth";

export type PostAuthDestination =
  | { to: "/select-role" }
  | { to: "/admin" }
  | { to: "/flights" };

const ADMIN_ROLES: AppRole[] = [
  "super_admin",
  "admin",
  "flight_admin",
  "booking_admin",
  "support_admin",
];

/** Pick the landing route for a given role. */
export function dashboardForRole(role: AppRole): "/admin" | "/flights" {
  return ADMIN_ROLES.includes(role) ? "/admin" : "/flights";
}

/**
 * Decide where to send the user post-auth:
 * - If they haven't picked a role yet → /select-role
 * - Otherwise → the dashboard for their highest-priority role
 */
export async function resolvePostAuthDestination(
  userId: string,
): Promise<PostAuthDestination> {
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("role_selected").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (!profile?.role_selected) return { to: "/select-role" };

  const roles = (roleRows ?? []).map((r) => r.role as AppRole);
  const top =
    ROLE_PRIORITY.find((p) => roles.includes(p)) ?? ("passenger" as AppRole);
  return { to: dashboardForRole(top) };
}
