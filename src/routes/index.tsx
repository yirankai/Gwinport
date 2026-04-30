import { createFileRoute, Link } from "@tanstack/react-router";
import { Plane, Search, ShieldCheck, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden
        />
        <div className="container mx-auto px-4 py-20 sm:py-28 text-primary-foreground">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-xs font-medium ring-1 ring-white/20">
              <Plane className="h-3.5 w-3.5" /> Local Airline Booking
            </span>
            <h1 className="mt-5 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
              Fly across Nigeria,
              <br />
              effortlessly.
            </h1>
            <p className="mt-5 text-lg text-primary-foreground/85 max-w-xl">
              Search flights, pick your seat, and confirm your booking in minutes.
              One simple platform for passengers and airline staff.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/flights">
                <Button size="lg" variant="secondary" className="gap-2">
                  <Search className="h-4 w-4" /> Search flights
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="outline" className="bg-transparent text-primary-foreground border-white/40 hover:bg-white/10 hover:text-primary-foreground">
                  Create an account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { icon: Search, title: "Find your flight", desc: "Search by origin, destination, and date. See seats, schedules, and fares at a glance." },
            { icon: Ticket, title: "Book with confidence", desc: "Pick your seat, get a unique booking reference, and a downloadable e-ticket." },
            { icon: ShieldCheck, title: "Secure & reliable", desc: "Role-based access and protected payments — your data stays safe." },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elegant)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Gwinport Airlines. Academic project.
      </footer>
    </div>
  );
}
