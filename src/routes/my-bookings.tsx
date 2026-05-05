/**
 * Passenger booking history — lists all bookings for the current user.
 */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/my-bookings")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: MyBookingsPage,
  head: () => ({ meta: [{ title: "My Bookings — Gwinport" }] }),
});

interface BookingRow {
  id: string;
  booking_reference: string;
  seat_number: string;
  status: string;
  created_at: string;
  flight_id: string;
  flights: {
    flight_number: string;
    origin: string;
    destination: string;
    departure_time: string;
  } | null;
}

function statusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "confirmed") return "default";
  if (status === "cancelled") return "destructive";
  return "secondary";
}

function statusClass(status: string): string {
  if (status === "confirmed") return "bg-green-600 hover:bg-green-600 text-white";
  if (status === "cancelled") return "bg-red-600 hover:bg-red-600 text-white";
  return "";
}

function MyBookingsPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `id, booking_reference, seat_number, status, created_at, flight_id,
           flights:flight_id ( flight_number, origin, destination, departure_time )`,
        )
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });
      if (!error && data) setRows(data as unknown as BookingRow[]);
      setLoading(false);
    };
    void load();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <section className="container mx-auto px-4 py-8 flex-1 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">My Bookings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All your flight bookings, latest first.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ticket className="h-5 w-5" /> Booking history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No bookings found</p>
                <Link to="/flights" className="inline-block mt-4">
                  <Button>Browse flights</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking ID</TableHead>
                      <TableHead>Flight</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Departure</TableHead>
                      <TableHead>Seat</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((b) => {
                      const dep = b.flights ? new Date(b.flights.departure_time) : null;
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono text-xs">
                            {b.booking_reference}
                          </TableCell>
                          <TableCell>{b.flights?.flight_number ?? "—"}</TableCell>
                          <TableCell>
                            {b.flights
                              ? `${b.flights.origin} → ${b.flights.destination}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {dep
                              ? dep.toLocaleDateString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {dep
                              ? dep.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell>{b.seat_number}</TableCell>
                          <TableCell>
                            <Badge
                              variant={statusVariant(b.status)}
                              className={`capitalize ${statusClass(b.status)}`}
                            >
                              {b.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              to="/bookings/$reference"
                              params={{ reference: b.booking_reference }}
                            >
                              <Button size="sm" variant="outline">
                                View
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
