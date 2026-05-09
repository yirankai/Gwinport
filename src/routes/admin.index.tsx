/**
 * Admin Overview — KPIs, quick actions, and recent activity.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plane,
  Ticket,
  Users,
  ShieldCheck,
  DollarSign,
  PlusCircle,
  ListChecks,
  UserCog,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

interface Stats {
  flights: number | null;
  activeFlights: number | null;
  bookings: number | null;
  users: number | null;
  revenue: number | null;
}

interface RecentBooking {
  id: string;
  booking_reference: string;
  passenger_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

const PHP = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "confirmed") return "default";
  if (s === "cancelled") return "destructive";
  return "secondary";
}

function AdminOverview() {
  const { user, roles, hasAnyRole } = useAuth();
  const [stats, setStats] = useState<Stats>({
    flights: null,
    activeFlights: null,
    bookings: null,
    users: null,
    revenue: null,
  });
  const [recent, setRecent] = useState<RecentBooking[]>([]);

  useEffect(() => {
    void (async () => {
      const [f, fa, b, u, rev, rb] = await Promise.all([
        supabase.from("flights").select("id", { count: "exact", head: true }),
        supabase.from("flights").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("total_amount").eq("status", "confirmed"),
        supabase
          .from("bookings")
          .select("id, booking_reference, passenger_name, total_amount, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      const revenue =
        rev.data?.reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0) ?? 0;
      setStats({
        flights: f.count ?? 0,
        activeFlights: fa.count ?? 0,
        bookings: b.count ?? 0,
        users: u.count ?? null,
        revenue,
      });
      setRecent((rb.data ?? []) as RecentBooking[]);
    })();
  }, []);

  const flightAdmin: AppRole[] = ["super_admin", "admin", "flight_admin"];
  const bookingAdmin: AppRole[] = ["super_admin", "admin", "booking_admin", "support_admin"];
  const superOnly: AppRole[] = ["super_admin"];

  return (
    <div className="container mx-auto px-4 py-8 md:py-10 space-y-8">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<Plane className="h-5 w-5" />} label="Total flights" value={stats.flights} />
        <StatCard icon={<Plane className="h-5 w-5" />} label="Active flights" value={stats.activeFlights} />
        <StatCard icon={<Ticket className="h-5 w-5" />} label="Bookings" value={stats.bookings} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Users" value={stats.users} />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Revenue"
          value={stats.revenue}
          format={(v) => PHP.format(v)}
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {hasAnyRole(flightAdmin) && (
            <QuickAction
              to="/admin/flights"
              icon={<PlusCircle className="h-5 w-5" />}
              title="Add flight"
              desc="Create a new scheduled flight"
            />
          )}
          {hasAnyRole(flightAdmin) && (
            <QuickAction
              to="/admin/flights"
              icon={<Plane className="h-5 w-5" />}
              title="Manage flights"
              desc="Edit schedules and inventory"
            />
          )}
          {hasAnyRole(bookingAdmin) && (
            <QuickAction
              to="/admin/bookings"
              icon={<ListChecks className="h-5 w-5" />}
              title="Manage bookings"
              desc="Review and update reservations"
            />
          )}
          {hasAnyRole(superOnly) && (
            <QuickAction
              to="/admin/users"
              icon={<UserCog className="h-5 w-5" />}
              title="User management"
              desc="Assign roles and permissions"
            />
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent bookings</h2>
          {hasAnyRole(bookingAdmin) && (
            <Link to="/admin/bookings" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <Card>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <ul className="divide-y">
                {recent.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{b.booking_reference}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.passenger_name} · {new Date(b.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold">{PHP.format(Number(b.total_amount))}</span>
                      <Badge variant={statusVariant(b.status)} className="capitalize">{b.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  format,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  format?: (v: number) => string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">
          {value === null ? "—" : format ? format(value) : value}
        </p>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link to={to} className="block">
      <Card className="h-full transition-colors hover:bg-muted/50 hover:border-primary/40">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="rounded-md bg-primary/10 text-primary p-2">{icon}</div>
          <div className="min-w-0">
            <p className="font-medium leading-tight">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </CardContent>
        <CardContent className="pt-0 pb-3 px-4">
          <Button variant="ghost" size="sm" className="px-0 h-auto text-primary hover:bg-transparent hover:text-primary/80">
            Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
