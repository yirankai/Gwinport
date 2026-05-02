/**
 * Admin Overview — quick stats dashboard.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plane, Ticket, Users, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

interface Stats {
  flights: number | null;
  activeFlights: number | null;
  bookings: number | null;
  users: number | null;
}

function AdminOverview() {
  const { user, roles } = useAuth();
  const [stats, setStats] = useState<Stats>({ flights: null, activeFlights: null, bookings: null, users: null });

  useEffect(() => {
    void (async () => {
      const [f, fa, b, u] = await Promise.all([
        supabase.from("flights").select("id", { count: "exact", head: true }),
        supabase.from("flights").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        flights: f.count ?? 0,
        activeFlights: fa.count ?? 0,
        bookings: b.count ?? 0,
        users: u.count ?? null,
      });
    })();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 md:py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, {user?.email}.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {roles.map((r) => (
            <Badge key={r} variant="secondary" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> {ROLE_LABELS[r] ?? r}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Plane className="h-5 w-5" />} label="Total flights" value={stats.flights} />
        <StatCard icon={<Plane className="h-5 w-5" />} label="Active flights" value={stats.activeFlights} />
        <StatCard icon={<Ticket className="h-5 w-5" />} label="Bookings" value={stats.bookings} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Users" value={stats.users} />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | null }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value ?? "—"}</p>
      </CardContent>
    </Card>
  );
}
