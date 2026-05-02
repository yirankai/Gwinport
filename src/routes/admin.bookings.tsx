/**
 * Admin — Bookings list. Booking admins can cancel; support admins are read-only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/bookings")({
  component: AdminBookingsPage,
});

interface BookingRow {
  id: string;
  booking_reference: string;
  passenger_name: string;
  passenger_email: string;
  seat_number: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  flights: { flight_number: string; origin: string; destination: string } | null;
}

function AdminBookingsPage() {
  const { hasAnyRole } = useAuth();
  const canView = hasAnyRole(["super_admin", "admin", "booking_admin", "support_admin"]);
  const canManage = hasAnyRole(["super_admin", "admin", "booking_admin"]);

  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("id, booking_reference, passenger_name, passenger_email, seat_number, total_amount, status, payment_status, created_at, flights(flight_number, origin, destination)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRows((data as unknown as BookingRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (canView) void load(); }, [canView]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      r.booking_reference.toLowerCase().includes(term) ||
      r.passenger_name.toLowerCase().includes(term) ||
      r.passenger_email.toLowerCase().includes(term),
    );
  }, [rows, q]);

  const cancel = async (id: string) => {
    if (!confirm("Cancel this booking?")) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Booking cancelled");
    await load();
  };

  if (!canView) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-3 text-xl font-semibold">Access denied</h1>
      </div>
    );
  }

  const fmt = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

  return (
    <div className="container mx-auto px-4 py-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage ? "View and manage all bookings." : "View bookings to assist passengers."}
          </p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reference, name, email…"
          className="w-full sm:w-72"
        />
      </div>

      <div className="mt-6 rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading bookings…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No bookings found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Passenger</TableHead>
                <TableHead>Flight</TableHead>
                <TableHead>Seat</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.booking_reference}</TableCell>
                  <TableCell>
                    <div className="font-medium">{b.passenger_name}</div>
                    <div className="text-xs text-muted-foreground">{b.passenger_email}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {b.flights ? `${b.flights.flight_number} · ${b.flights.origin}→${b.flights.destination}` : "—"}
                  </TableCell>
                  <TableCell>{b.seat_number}</TableCell>
                  <TableCell className="text-right">{fmt.format(Number(b.total_amount))}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === "confirmed" ? "secondary" : b.status === "cancelled" ? "outline" : "default"}>
                      {b.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(b.created_at).toLocaleString()}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {b.status !== "cancelled" && (
                        <Button size="sm" variant="ghost" onClick={() => cancel(b.id)} className="gap-1">
                          <X className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
