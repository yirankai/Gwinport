/**
 * Auth context — F1 (registration/login) & F2 (role-based access).
 * Wraps the app, syncs Supabase session, and exposes user + role.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "passenger" | "admin";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  // F2: load role from user_roles table for the signed-in user.
  const loadRole = async (uid: string | null) => {
    if (!uid) {
      setRole(null);
      return;
    }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .order("role", { ascending: false }); // admin > passenger alphabetically reversed
    if (data && data.length > 0) {
      // Prefer admin if multiple roles exist
      const isAdmin = data.some((r) => r.role === "admin");
      setRole(isAdmin ? "admin" : "passenger");
    } else {
      setRole("passenger");
    }
  };

  useEffect(() => {
    // Set up listener FIRST, then check session (avoid auth race conditions)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // Defer Supabase calls to avoid deadlocks inside the callback
      if (newSession?.user) {
        setTimeout(() => { void loadRole(newSession.user.id); }, 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) void loadRole(existing.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshRole = async () => {
    if (user) await loadRole(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
