/**
 * F10/F11 — E-ticket / booking confirmation page.
 */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, MapPin, Plane, Printer, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/bookings/$reference")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: BookingDetail,
  head: ({ params }) => ({ meta: [{ title: `Booking ${params.reference} — Gwinport` }] }),
});

interface Booking {
  id: string;
  booking_reference: string;
  seat_number: string;
  passenger_name: string;
  passenger_email: string;
  fare_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  flights: {
    flight_number: string;
    origin: string;
    destination: string;
    departure_time: string;
    arrival_time: string;
  } | null;
}

function BookingDetail() {
  const { reference } = Route.useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id, booking_reference, seat_number, passenger_name, passenger_email,
          fare_amount, tax_amount, total_amount, status, payment_status, created_at,
          flights:flight_id ( flight_number, origin, destination, departure_time, arrival_time )
        `)
        .eq("booking_reference", reference)
        .maybeSingle();

      if (error || !data) {
        toast.error("Booking not found.");
        setLoading(false);
        return;
      }
      setBooking(data as unknown as Booking);
      setLoading(false);
    };
    void load();
  }, [reference]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <div>
            <h1 className="text-2xl font-bold">Booking not found</h1>
            <p className="mt-2 text-muted-foreground">The reference doesn't match any booking on your account.</p>
            <Link to="/flights" className="inline-block mt-4">
              <Button>Browse flights</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const f = booking.flights;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(n));
  const dep = f ? new Date(f.departure_time) : null;
  const arr = f ? new Date(f.arrival_time) : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <section className="container mx-auto px-4 py-8 flex-1 max-w-3xl">
        <Link to="/flights" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to flights
        </Link>

        <div className="mt-4 rounded-xl border bg-[var(--gradient-hero)] p-6 text-primary-foreground shadow-[var(--shadow-elegant)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Booking confirmed</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{booking.booking_reference}</h1>
          <p className="mt-1 text-sm text-primary-foreground/80">
            We've sent your e-ticket to {booking.passenger_email}.
          </p>
        </div>

        {/* E-ticket card */}
        <div className="mt-6 rounded-xl border bg-card overflow-hidden shadow-[var(--shadow-card)] print:shadow-none print:border-0">
          <div className="border-b p-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--gradient-sky)] text-primary-foreground">
                <Plane className="h-5 w-5" />
              </span>
              <div>
                <div className="font-semibold leading-none">Gwinport</div>
                <div className="text-xs text-muted-foreground mt-0.5">E-Ticket</div>
              </div>
            </div>
            <Badge variant="secondary" className="capitalize">{booking.status}</Badge>
          </div>

          {f && dep && arr && (
            <div className="p-6">
              <div className="grid grid-cols-3 items-center gap-4">
                <div>
                  <div className="text-3xl font-bold">{dep.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  <div className="mt-1 text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{f.origin}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{dep.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</div>
                </div>
                <div className="flex flex-col items-center text-muted-foreground">
                  <Plane className="h-4 w-4 rotate-90" />
                  <div className="text-xs mt-1">{f.flight_number}</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{arr.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  <div className="mt-1 text-sm text-muted-foreground flex items-center gap-1 justify-end"><MapPin className="h-3 w-3" />{f.destination}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{arr.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-t pt-4">
                <Field label="Passenger" value={booking.passenger_name} />
                <Field label="Seat" value={booking.seat_number} />
                <Field label="Class" value="Economy" />
                <Field label="Status" value={booking.payment_status} className="capitalize" />
              </div>
            </div>
          )}

          {/* Stub */}
          <div className="border-t border-dashed bg-secondary/30 p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <Field label="Reference" value={booking.booking_reference} />
            <Field label="Fare" value={fmt(booking.fare_amount)} />
            <Field label="Tax" value={fmt(booking.tax_amount)} />
            <Field label="Total paid" value={fmt(booking.total_amount)} className="font-semibold text-primary" />
            <Field label="Issued" value={new Date(booking.created_at).toLocaleString()} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <Button onClick={() => window.print()} variant="outline" className="gap-1.5">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
          <Link to="/flights">
            <Button variant="ghost" className="gap-1.5"><Ticket className="h-4 w-4" /> Book another</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${className ?? ""}`}>{value}</div>
    </div>
  );
}
