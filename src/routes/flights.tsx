/**
 * F3 — Search flights by origin, destination, and date.
 * F4 — Display seats, schedules, and fares.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Calendar, Clock, MapPin, Plane, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/flights")({
  component: FlightsPage,
  head: () => ({
    meta: [
      { title: "Search flights — Gwinport" },
      { name: "description", content: "Search Gwinport flights by origin, destination, and date. Compare schedules and fares." },
    ],
  }),
});

interface FlightRow {
  id: string;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  total_seats: number;
  base_price: number;
}

function FlightsPage() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [bookedCounts, setBookedCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Initial load: show upcoming flights
  useEffect(() => {
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // F3: query flights matching filters
  const runSearch = async (e?: FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    let query = supabase
      .from("flights")
      .select("id, flight_number, origin, destination, departure_time, arrival_time, total_seats, base_price")
      .eq("is_active", true)
      .gte("departure_time", new Date().toISOString())
      .order("departure_time", { ascending: true })
      .limit(50);

    if (origin.trim()) query = query.ilike("origin", `%${origin.trim()}%`);
    if (destination.trim()) query = query.ilike("destination", `%${destination.trim()}%`);
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      query = query.gte("departure_time", start.toISOString()).lt("departure_time", end.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setFlights(data ?? []);
    setSearched(true);

    // Fetch booked counts per flight to show seat availability (F4)
    if (data && data.length > 0) {
      const ids = data.map((f) => f.id);
      const { data: bookings } = await supabase
        .from("bookings")
        .select("flight_id")
        .in("flight_id", ids);
      const counts: Record<string, number> = {};
      (bookings ?? []).forEach((b) => {
        counts[b.flight_id] = (counts[b.flight_id] ?? 0) + 1;
      });
      setBookedCounts(counts);
    } else {
      setBookedCounts({});
    }
    setLoading(false);
  };

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* Search bar */}
      <section className="bg-[var(--gradient-hero)] text-primary-foreground">
        <div className="container mx-auto px-4 py-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Find your next flight</h1>
          <p className="mt-1 text-primary-foreground/80">Search by origin, destination and date.</p>

          <form
            onSubmit={runSearch}
            className="mt-6 grid gap-3 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="origin" className="text-primary-foreground/90 text-xs uppercase tracking-wide">From</Label>
              <Input
                id="origin"
                placeholder="e.g. Lagos"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="bg-white text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="destination" className="text-primary-foreground/90 text-xs uppercase tracking-wide">To</Label>
              <Input
                id="destination"
                placeholder="e.g. Abuja"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="bg-white text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-primary-foreground/90 text-xs uppercase tracking-wide">Date</Label>
              <Input
                id="date"
                type="date"
                min={todayIso}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-white text-foreground"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" size="lg" variant="secondary" className="w-full" disabled={loading}>
                {loading ? "Searching…" : "Search flights"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Results */}
      <section className="container mx-auto px-4 py-10 flex-1">
        {loading ? (
          <ResultsSkeleton />
        ) : flights.length === 0 ? (
          <EmptyState searched={searched} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{flights.length} flight{flights.length === 1 ? "" : "s"} available</p>
            {flights.map((f) => (
              <FlightCard key={f.id} flight={f} booked={bookedCounts[f.id] ?? 0} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FlightCard({ flight, booked }: { flight: FlightRow; booked: number }) {
  const dep = new Date(flight.departure_time);
  const arr = new Date(flight.arrival_time);
  const durationMin = Math.round((arr.getTime() - dep.getTime()) / 60000);
  const seatsLeft = Math.max(flight.total_seats - booked, 0);
  const priceFmt = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elegant)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
            <Plane className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{flight.flight_number}</span>
              <Badge variant="secondary">Gwinport</Badge>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {dep.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-8">
          <div className="text-center">
            <div className="text-xl font-semibold">{dep.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center"><MapPin className="h-3 w-3" />{flight.origin}</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{Math.floor(durationMin / 60)}h {durationMin % 60}m</div>
            <div className="my-1 flex items-center gap-1 text-muted-foreground">
              <div className="h-px w-10 sm:w-16 bg-border" />
              <ArrowRight className="h-3.5 w-3.5" />
              <div className="h-px w-10 sm:w-16 bg-border" />
            </div>
            <div className="text-xs text-muted-foreground">Direct</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold">{arr.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center"><MapPin className="h-3 w-3" />{flight.destination}</div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
            <Users className="h-3 w-3" /> {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} left
          </div>
          <div className="mt-0.5 text-2xl font-bold text-primary">{priceFmt.format(Number(flight.base_price))}</div>
          <Link to="/book" search={{ flightId: flight.id }} className={seatsLeft === 0 ? "pointer-events-none" : ""}>
            <Button size="sm" className="mt-2" disabled={seatsLeft === 0}>
              {seatsLeft === 0 ? "Sold out" : "Select"}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ searched }: { searched: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Plane className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-semibold">{searched ? "No flights match your search" : "No upcoming flights"}</h3>
      <p className="mt-1 text-sm text-muted-foreground">Try different dates or routes.</p>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 rounded-xl border bg-card animate-pulse" />
      ))}
    </div>
  );
}
