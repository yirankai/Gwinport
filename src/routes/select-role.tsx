/**
 * Role selection — shown after sign-up / sign-in until the user picks
 * which role they want to use. Only roles already granted in `user_roles`
 * are offered (passengers see Passenger; admins see their granted admin roles).
 */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plane, Shield, Briefcase, LifeBuoy, Crown, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { dashboardForRole } from "@/lib/post-auth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/select-role")({
  component: SelectRolePage,
  head: () => ({
    meta: [
      { title: "Choose your role — Gwinport" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  passenger: "Search flights, book seats, and view your bookings.",
  admin: "Full administrative access (legacy role).",
  super_admin: "Manage users and assign roles across the system.",
  flight_admin: "Create, update, and disable flights and schedules.",
  booking_admin: "View, modify, and cancel passenger bookings.",
  support_admin: "Read-only access to assist customers with bookings.",
};

const ROLE_ICONS: Record<AppRole, React.ComponentType<{ className?: string }>> = {
  passenger: Plane,
  admin: Shield,
  super_admin: Crown,
  flight_admin: Plane,
  booking_admin: Briefcase,
  support_admin: LifeBuoy,
};

function SelectRolePage() {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const [selected, setSelected] = useState<AppRole | null>(null);
  const [saving, setSaving] = useState(false);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Always include passenger (auto-granted on signup); plus any other granted roles
  const available: AppRole[] = Array.from(new Set<AppRole>(["passenger", ...roles]));

  const handleConfirm = async () => {
    if (!selected || !user) {
      toast.error("Please choose a role to continue.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ role_selected: true })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(`Could not save role: ${error.message}`);
      return;
    }
    toast.success(`Continuing as ${ROLE_LABELS[selected]}`);
    navigate({ to: dashboardForRole(selected) });
  };

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="w-full max-w-3xl">
        <div className="mb-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--gradient-sky)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <UserCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Choose your role</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick how you'd like to use Gwinport. You can ask an administrator to grant additional roles later.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {available.map((role) => {
            const Icon = ROLE_ICONS[role];
            const isSelected = selected === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelected(role)}
                className="text-left focus:outline-none"
                aria-pressed={isSelected}
              >
                <Card
                  className={`transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary shadow-[var(--shadow-elegant)]"
                      : "hover:border-primary/50"
                  }`}
                >
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <CardTitle className="text-base">{ROLE_LABELS[role]}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{ROLE_DESCRIPTIONS[role]}</CardDescription>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:underline text-center sm:text-left">
            Cancel
          </Link>
          <Button onClick={handleConfirm} disabled={!selected || saving} className="sm:w-auto">
            {saving ? "Saving…" : "Continue"}
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-12">{children}</main>
    </div>
  );
}
