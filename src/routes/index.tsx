import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  Plane,
  Search,
  ShieldCheck,
  Ticket,
  CalendarDays,
  MapPin,
  ArrowRightLeft,
  Sparkles,
  Headphones,
  BadgeCheck,
  Clock,
  Users,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/SiteHeader";
import { getTodaysFlights, type DailyFlight, type FlightStatus } from "@/lib/sample-flights";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gwinport — Find cheap flights & airline deals" },
      {
        name: "description",
        content:
          "Search and book flights across the Philippines with Gwinport. Compare fares, pick your seat, and fly with confidence.",
      },
      { property: "og:title", content: "Gwinport — Find cheap flights & airline deals" },
      {
        property: "og:description",
        content: "Compare fares, pick your seat, and fly with confidence.",
      },
    ],
  }),
  component: Index,
});

type TripType = "one-way" | "round-trip" | "multi-city";

function Index() {
  
  const [trip, setTrip] = useState<TripType>("round-trip");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const allFlights = useMemo<DailyFlight[]>(() => getTodaysFlights(), []);

  const filteredFlights = useMemo<DailyFlight[]>(() => {
    if (!submitted) return allFlights;
    const o = origin.trim().toLowerCase();
    const d = destination.trim().toLowerCase();
    return allFlights.filter((f) => {
      const matchOrigin = !o || f.origin.toLowerCase().includes(o) || f.originCode.toLowerCase().includes(o);
      const matchDest = !d || f.destination.toLowerCase().includes(d) || f.destinationCode.toLowerCase().includes(d);
      // date filter is informational — sample flights are "today" by design
      const matchDate = !departure || departure === f.date;
      return matchOrigin && matchDest && matchDate;
    });
  }, [allFlights, submitted, origin, destination, departure]);

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* Sub-nav strip */}
      <div className="border-b bg-card/60 backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center gap-1 px-4 py-2 text-sm">
          <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold">Flights</span>
        </div>
      </div>

      {/* Hero with image card + floating search */}
      <section className="container mx-auto px-4 pt-8 sm:pt-10">
        <div
          className="relative overflow-hidden rounded-3xl shadow-[var(--shadow-elegant)]"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div
            className="absolute inset-0 opacity-40 mix-blend-overlay"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=2000&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" aria-hidden />

          <div className="relative px-6 sm:px-12 py-16 sm:py-24 text-primary-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium ring-1 ring-white/25">
              <Sparkles className="h-3.5 w-3.5" /> Limited-time fares across PH
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Find cheap flights &
              <br />
              airline deals today.
            </h1>
            <p className="mt-4 max-w-xl text-base sm:text-lg text-primary-foreground/85">
              One simple platform to search, compare, and book your next trip in minutes.
            </p>
          </div>
        </div>

        {/* Floating glass search card */}
        <div className="relative -mt-12 sm:-mt-16 mx-2 sm:mx-6 lg:mx-12 z-10">
          <form
            onSubmit={handleSearch}
            className="rounded-2xl border bg-card/90 backdrop-blur-xl p-5 sm:p-6 shadow-[var(--shadow-elegant)]"
          >
            {/* Trip type pills */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {(["one-way", "round-trip", "multi-city"] as TripType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrip(t)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
                    trip === t
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {t.replace("-", " ")}
                </button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-12">
              {/* From / To with swap */}
              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
                <div>
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Manila (MNL)"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className="pl-9 h-11"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={swap}
                  aria-label="Swap origin and destination"
                  className="hidden sm:inline-flex h-9 w-9 items-center justify-center self-end rounded-full border bg-card hover:bg-secondary transition-colors mb-1"
                >
                  <ArrowRightLeft className="h-4 w-4 text-primary" />
                </button>
                <div>
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cebu (CEB)"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="pl-9 h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="lg:col-span-4 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Departure</Label>
                  <div className="relative mt-1">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={departure}
                      onChange={(e) => setDeparture(e.target.value)}
                      className="pl-9 h-11"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Return</Label>
                  <div className="relative mt-1">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      disabled={trip === "one-way"}
                      className="pl-9 h-11 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="lg:col-span-3 flex items-end">
                <Button type="submit" size="lg" className="w-full h-11 gap-2 shadow-[var(--shadow-elegant)]">
                  <Search className="h-4 w-4" /> Search Flights
                </Button>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Feeling spontaneous?{" "}
              <Link to="/flights" className="text-primary font-medium hover:underline">
                Browse all flights
              </Link>
            </p>
          </form>
        </div>
      </section>

      {/* Trust strip */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="grid gap-6 md:grid-cols-[1.2fr_2fr] items-center">
          <div>
            <p className="text-3xl sm:text-4xl font-bold tracking-tight">
              Loved by <span className="text-primary">50k+</span> travelers
            </p>
            <p className="mt-2 text-muted-foreground">
              Built for Filipinos on the go — fast search, fair prices, friendly support.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: CalendarDays,
                title: "Easy Flight Changes",
                desc: "Reschedule or cancel without the hassle.",
              },
              {
                icon: BadgeCheck,
                title: "Trusted Bookings",
                desc: "Secure payments and instant e-tickets.",
              },
              {
                icon: Headphones,
                title: "24/7 Support",
                desc: "Real humans, ready whenever you fly.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gradient-sky)] text-primary-foreground shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: Search,
              title: "Find your flight",
              desc: "Search by origin, destination, and date. See seats, schedules, and fares at a glance.",
            },
            {
              icon: Ticket,
              title: "Book with confidence",
              desc: "Pick your seat, get a unique booking reference, and a downloadable e-ticket.",
            },
            {
              icon: ShieldCheck,
              title: "Secure & reliable",
              desc: "Role-based access and protected payments — your data stays safe.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]"
            >
              <div
                className="absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-20 blur-2xl"
                style={{ background: "var(--gradient-sky)" }}
                aria-hidden
              />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="relative mt-4 font-semibold text-lg">{title}</h3>
              <p className="relative mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-20">
        <div
          className="relative overflow-hidden rounded-3xl px-8 py-12 sm:px-14 sm:py-16 text-primary-foreground"
          style={{ background: "var(--gradient-sky)" }}
        >
          <Plane className="absolute -bottom-6 -right-6 h-48 w-48 opacity-10 rotate-12" aria-hidden />
          <div className="relative max-w-xl">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready for your next trip?</h2>
            <p className="mt-2 text-primary-foreground/85">
              Create a free account to save bookings, manage trips, and unlock member fares.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register">
                <Button size="lg" variant="secondary" className="gap-2">
                  Create an account
                </Button>
              </Link>
              <Link to="/flights">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent text-primary-foreground border-white/40 hover:bg-white/10 hover:text-primary-foreground"
                >
                  Search flights
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--gradient-sky)] text-primary-foreground">
              <Plane className="h-4 w-4" />
            </span>
            <span className="font-semibold text-foreground">Gwinport Airlines</span>
          </div>
          <p>© {new Date().getFullYear()} Gwinport. Academic project.</p>
        </div>
      </footer>
    </div>
  );
}
