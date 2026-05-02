/**
 * Auth context — F1 (registration/login) & F2 (role-based access).
 * Wraps the app, syncs Supabase session, and exposes user + roles.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "passenger"
  | "admin"
  | "super_admin"
  | "flight_admin"
  | "booking_admin"
  | "support_admin";

export const ADMIN_ROLES: AppRole[] = [
  "admin",
  "super_admin",
  "flight_admin",
  "booking_admin",
  "support_admin",
];

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  /** Primary/highest role (kept for back-compat). */
  role: AppRole | null;
  /** All roles assigned to the user. */
  roles: AppRole[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasRole: (r: AppRole) => boolean;
  hasAnyRole: (r: AppRole[]) => boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ROLE_PRIORITY: AppRole[] = [
  "super_admin",
  "admin",
  "flight_admin",
  "booking_admin",
  "support_admin",
  "passenger",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid: string | null) => {
    if (!uid) {
      setRoles([]);
      return;
    }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if (data && data.length > 0) {
      setRoles(data.map((r) => r.role as AppRole));
    } else {
      setRoles(["passenger"]);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setTimeout(() => { void loadRoles(newSession.user.id); }, 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) void loadRoles(existing.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };
  const refreshRole = async () => { if (user) await loadRoles(user.id); };

  const hasRole = (r: AppRole) => roles.includes(r);
  const hasAnyRole = (rs: AppRole[]) => rs.some((r) => roles.includes(r));
  const isAdmin = hasAnyRole(ADMIN_ROLES);
  const isSuperAdmin = hasRole("super_admin");
  const role: AppRole | null =
    roles.length === 0 ? null : (ROLE_PRIORITY.find((p) => roles.includes(p)) ?? roles[0]);

  return (
    <AuthContext.Provider
      value={{ user, session, role, roles, isAdmin, isSuperAdmin, hasRole, hasAnyRole, loading, signOut, refreshRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  passenger: "Passenger",
  admin: "Admin (legacy)",
  super_admin: "Super Admin",
  flight_admin: "Flight Admin",
  booking_admin: "Booking Admin",
  support_admin: "Support Admin",
};
