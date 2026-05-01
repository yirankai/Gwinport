/**
 * F5–F11: Seat selection, fare summary with tax, mock payment, booking creation.
 */
import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, CreditCard, Loader2, Plane, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SiteHeader } from "@/components/SiteHeader";
import { lockSeat, createBooking } from "@/server/booking.functions";

const searchSchema = z.object({ flightId: z.string().uuid() });

export const Route = createFileRoute("/book")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: BookPage,
  head: () => ({ meta: [{ title: "Book your flight — Gwinport" }] }),
});

const TAX_RATE = 0.075;
const ROWS = 10; // 10 rows × 6 = 60 seats (matches default total_seats)
const COLS = ["A", "B", "C", "D", "E", "F"] as const;

interface Flight {
  id: string;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  base_price: number;
  total_seats: number;
}

type Step = "seat" | "details" | "payment";

function BookPage() {
  const { flightId } = Route.useSearch();
  const navigate = useNavigate();
  const [flight, setFlight] = useState<Flight | null>(null);
  const [bookedSeats, setBookedSeats] = useState<Set<string>>(new Set());
  const [lockedSeats, setLockedSeats] = useState<Set<string>>(new Set());
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("seat");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);

  // passenger details
  const [passengerName, setPassengerName] = useState("");
  const [passengerEmail, setPassengerEmail] = useState("");
  const [paymentSimulate, setPaymentSimulate] = useState<"success" | "fail">("success");

  useEffect(() => {
    void loadFlight();
    // pre-fill email from auth user
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setPassengerEmail(data.user.email);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId]);

  const loadFlight = async () => {
    setLoading(true);
    const [{ data: f, error }, { data: bks }, { data: lks }] = await Promise.all([
      supabase
        .from("flights")
        .select("id, flight_number, origin, destination, departure_time, arrival_time, base_price, total_seats")
        .eq("id", flightId)
        .single(),
      supabase
        .from("bookings")
        .select("seat_number")
        .eq("flight_id", flightId)
        .in("status", ["confirmed", "pending"]),
      supabase
        .from("seat_locks")
        .select("seat_number")
        .eq("flight_id", flightId)
        .gt("expires_at", new Date().toISOString()),
    ]);
    if (error || !f) {
      toast.error("Flight not found.");
      navigate({ to: "/flights" });
      return;
    }
    setFlight(f as Flight);
    setBookedSeats(new Set((bks ?? []).map((b) => b.seat_number)));
    setLockedSeats(new Set((lks ?? []).map((l) => l.seat_number)));
    setLoading(false);
  };

  // hold timer
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  useEffect(() => {
    if (!holdExpiresAt) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((holdExpiresAt - Date.now()) / 1000));
      setSecondsLeft(s);
      if (s === 0) {
        toast.error("Seat hold expired. Please reselect.");
        setStep("seat");
        setHoldExpiresAt(null);
        void loadFlight();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);

  const fares = useMemo(() => {
    if (!flight) return { fare: 0, tax: 0, total: 0 };
    const fare = Number(flight.base_price);
    const tax = Math.round(fare * TAX_RATE * 100) / 100;
    return { fare, tax, total: Math.round((fare + tax) * 100) / 100 };
  }, [flight]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

  const handleSelectSeat = (seat: string) => {
    if (bookedSeats.has(seat) || lockedSeats.has(seat)) return;
    setSelectedSeat(seat);
  };

  const handleContinueToDetails = async () => {
    if (!selectedSeat || !flight) return;
    setSubmitting(true);
    try {
      const result = await lockSeat({ data: { flightId: flight.id, seatNumber: selectedSeat } });
      if (!result.ok) {
        toast.error(result.error ?? "Could not hold seat.");
        void loadFlight();
        return;
      }
      setHoldExpiresAt(Date.now() + (result.expiresInSeconds ?? 300) * 1000);
      setStep("details");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not hold seat.");
      void loadFlight();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDetails = (e: FormEvent) => {
    e.preventDefault();
    if (!passengerName.trim() || !passengerEmail.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }
    setStep("payment");
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!flight || !selectedSeat) return;
    setSubmitting(true);
    try {
      const result = await createBooking({
        data: {
          flightId: flight.id,
          seatNumber: selectedSeat,
          passengerName: passengerName.trim(),
          passengerEmail: passengerEmail.trim(),
          paymentSimulate,
        },
      });
      if (!result.ok || !result.reference) {
        toast.error(result.error ?? "Payment failed.");
        return;
      }
      toast.success(`Booking confirmed — ${result.reference}`);
      navigate({ to: "/bookings/$reference", params: { reference: result.reference } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !flight) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const dep = new Date(flight.departure_time);
  const arr = new Date(flight.arrival_time);
  const durationMin = Math.round((arr.getTime() - dep.getTime()) / 60000);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <section className="bg-[var(--gradient-hero)] text-primary-foreground">
        <div className="container mx-auto px-4 py-6">
          <Link to="/flights" className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to flights
          </Link>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{flight.origin} → {flight.destination}</h1>
              <p className="text-sm text-primary-foreground/80 mt-0.5">
                {flight.flight_number} · {dep.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {Math.floor(durationMin/60)}h {durationMin%60}m
              </p>
            </div>
            <Stepper step={step} />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 flex-1">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            {step === "seat" && (
              <SeatMap
                bookedSeats={bookedSeats}
                lockedSeats={lockedSeats}
                selectedSeat={selectedSeat}
                onSelect={handleSelectSeat}
              />
            )}

            {step === "details" && (
              <form onSubmit={handleSubmitDetails} className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] space-y-5">
                <div>
                  <h2 className="text-lg font-semibold">Passenger details</h2>
                  <p className="text-sm text-muted-foreground mt-1">Use the name as it appears on your ID.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={passengerName} onChange={(e) => setPassengerName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email for e-ticket</Label>
                  <Input id="email" type="email" required value={passengerEmail} onChange={(e) => setPassengerEmail(e.target.value)} />
                </div>
                <div className="flex justify-between gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep("seat")}>Back</Button>
                  <Button type="submit" className="gap-1.5">Continue to payment <ArrowRight className="h-4 w-4" /></Button>
                </div>
              </form>
            )}

            {step === "payment" && (
              <form onSubmit={handlePay} className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] space-y-5">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Payment</h2>
                </div>
                <div className="rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 mt-0.5 text-primary" />
                  This is a simulated payment for demo purposes — no real card is charged.
                </div>

                <RadioGroup value={paymentSimulate} onValueChange={(v) => setPaymentSimulate(v as "success" | "fail")} className="space-y-2">
                  <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="success" id="ok" />
                    <span className="text-sm">Simulate successful payment</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="fail" id="fail" />
                    <span className="text-sm">Simulate declined payment</span>
                  </label>
                </RadioGroup>

                <div className="flex justify-between gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep("details")}>Back</Button>
                  <Button type="submit" disabled={submitting} className="gap-1.5">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Pay {fmt(fares.total)}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Summary sidebar */}
          <aside className="lg:sticky lg:top-20 h-fit space-y-4">
            <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-primary" />
                <span className="font-semibold">{flight.flight_number}</span>
                <Badge variant="secondary">Gwinport</Badge>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">From</span><span>{flight.origin}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">To</span><span>{flight.destination}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Depart</span><span>{dep.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span></div>
                {selectedSeat && (
                  <div className="flex justify-between font-medium"><span className="text-muted-foreground">Seat</span><span>{selectedSeat}</span></div>
                )}
              </div>
              <hr />
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Fare</span><span>{fmt(fares.fare)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax (7.5%)</span><span>{fmt(fares.tax)}</span></div>
                <div className="flex justify-between text-base font-semibold pt-2"><span>Total</span><span className="text-primary">{fmt(fares.total)}</span></div>
              </div>

              {step === "seat" && (
                <Button onClick={handleContinueToDetails} disabled={!selectedSeat || submitting} className="w-full gap-1.5">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {selectedSeat ? `Continue with seat ${selectedSeat}` : "Select a seat"}
                </Button>
              )}

              {holdExpiresAt && step !== "seat" && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> Seat held for {Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,"0")}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const items: { key: Step; label: string }[] = [
    { key: "seat", label: "Seat" },
    { key: "details", label: "Details" },
    { key: "payment", label: "Payment" },
  ];
  const activeIdx = items.findIndex((i) => i.key === step);
  return (
    <div className="flex items-center gap-2 text-xs">
      {items.map((it, i) => (
        <div key={it.key} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full font-semibold ${i <= activeIdx ? "bg-primary-foreground text-primary" : "bg-primary-foreground/20 text-primary-foreground/60"}`}>{i+1}</span>
          <span className={i <= activeIdx ? "" : "opacity-60"}>{it.label}</span>
          {i < items.length - 1 && <span className="opacity-40">·</span>}
        </div>
      ))}
    </div>
  );
}

function SeatMap({
  bookedSeats,
  lockedSeats,
  selectedSeat,
  onSelect,
}: {
  bookedSeats: Set<string>;
  lockedSeats: Set<string>;
  selectedSeat: string | null;
  onSelect: (s: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Choose your seat</h2>
          <p className="text-sm text-muted-foreground mt-1">Pick from the cabin layout below.</p>
        </div>
        <Legend />
      </div>

      <div className="mx-auto max-w-sm rounded-3xl border-2 border-border/60 bg-background p-5">
        {/* Nose */}
        <div className="mx-auto mb-4 h-8 w-24 rounded-t-full border-t-2 border-x-2 border-border/60" aria-hidden />

        <div className="space-y-2">
          {Array.from({ length: ROWS }).map((_, rowIdx) => {
            const row = rowIdx + 1;
            return (
              <div key={row} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="grid grid-cols-3 gap-2 justify-end">
                  {COLS.slice(0, 3).map((c) => {
                    const seat = `${row}${c}`;
                    return <SeatBtn key={seat} seat={seat} status={statusOf(seat, bookedSeats, lockedSeats, selectedSeat)} onSelect={onSelect} />;
                  })}
                </div>
                <span className="text-xs text-muted-foreground w-5 text-center">{row}</span>
                <div className="grid grid-cols-3 gap-2">
                  {COLS.slice(3).map((c) => {
                    const seat = `${row}${c}`;
                    return <SeatBtn key={seat} seat={seat} status={statusOf(seat, bookedSeats, lockedSeats, selectedSeat)} onSelect={onSelect} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type SeatStatus = "available" | "booked" | "locked" | "selected";
function statusOf(seat: string, booked: Set<string>, locked: Set<string>, selected: string | null): SeatStatus {
  if (selected === seat) return "selected";
  if (booked.has(seat)) return "booked";
  if (locked.has(seat)) return "locked";
  return "available";
}

function SeatBtn({ seat, status, onSelect }: { seat: string; status: SeatStatus; onSelect: (s: string) => void }) {
  const base = "h-9 w-9 rounded-md text-[10px] font-semibold transition-colors flex items-center justify-center";
  const cls =
    status === "selected"
      ? "bg-primary text-primary-foreground ring-2 ring-primary"
      : status === "booked"
      ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
      : status === "locked"
      ? "bg-amber-200/60 text-amber-900 cursor-not-allowed"
      : "bg-secondary text-foreground hover:bg-primary/15";
  return (
    <button
      type="button"
      aria-label={`Seat ${seat} ${status}`}
      disabled={status === "booked" || status === "locked"}
      onClick={() => onSelect(seat)}
      className={`${base} ${cls}`}
    >
      {seat}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-secondary border" />Available</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" />Selected</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-amber-200/60 border border-amber-300" />Held</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-muted border" />Booked</span>
    </div>
  );
}
