/**
 * Admin — Flight management (F14).
 * Admins can list, create, edit, and enable/disable flights and schedules.
 * Access is gated client-side (role check) AND server-side (assertAdmin in
 * each server function), with RLS as the final line of defense.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Power, Shield } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  adminCreateFlight,
  adminUpdateFlight,
  adminSetFlightActive,
} from "@/server/admin-flights.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — Gwinport" },
      { name: "robots", content: "noindex" },
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
  base_price: number;
  total_seats: number;
  is_active: boolean;
}

function AdminPage() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">Loading…</p>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <Gate icon={<Shield className="h-10 w-10 text-muted-foreground" />} title="Sign in required" desc="Please sign in to access the admin area.">
          <Link to="/login"><Button>Sign in</Button></Link>
        </Gate>
      </Shell>
    );
  }

  if (role !== "admin") {
    return (
      <Shell>
        <Gate icon={<Shield className="h-10 w-10 text-destructive" />} title="Access denied" desc="You need an admin role to view this page.">
          <Link to="/flights"><Button variant="outline">Back to flights</Button></Link>
        </Gate>
      </Shell>
    );
  }

  return <AdminFlightsManager />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 text-center">{children}</main>
    </div>
  );
}

function Gate({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mx-auto w-fit">{icon}</div>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function AdminFlightsManager() {
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState<FlightRow | null>(null);
  const [creating, setCreating] = useState(false);

  const loadFlights = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("flights")
      .select("id, flight_number, origin, destination, departure_time, arrival_time, base_price, total_seats, is_active")
      .order("departure_time", { ascending: true });
    if (error) toast.error(error.message);
    setFlights((data as FlightRow[] | null) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    void loadFlights();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage flights</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create, edit, and disable flights and their schedules.</p>
          </div>
          <Button onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New flight
          </Button>
        </div>

        <div className="mt-6 rounded-xl border bg-card overflow-hidden">
          {fetching ? (
            <div className="p-8 text-center text-muted-foreground">Loading flights…</div>
          ) : flights.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No flights yet. Create your first one.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flight</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead className="text-right">Fare</TableHead>
                  <TableHead className="text-right">Seats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flights.map((f) => (
                  <FlightRowItem key={f.id} flight={f} onEdit={() => setEditing(f)} onChanged={loadFlights} />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      <FlightDialog
        open={creating}
        onOpenChange={setCreating}
        mode="create"
        onSaved={loadFlights}
      />
      <FlightDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        mode="edit"
        flight={editing ?? undefined}
        onSaved={loadFlights}
      />
    </div>
  );
}

function FlightRowItem({ flight, onEdit, onChanged }: { flight: FlightRow; onEdit: () => void; onChanged: () => void }) {
  const setActive = useServerFn(adminSetFlightActive);
  const [busy, setBusy] = useState(false);
  const priceFmt = useMemo(() => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }), []);

  const toggle = async () => {
    setBusy(true);
    try {
      await setActive({ data: { id: flight.id, isActive: !flight.is_active } });
      toast.success(flight.is_active ? "Flight disabled" : "Flight enabled");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{flight.flight_number}</TableCell>
      <TableCell>{flight.origin} → {flight.destination}</TableCell>
      <TableCell className="text-sm">{new Date(flight.departure_time).toLocaleString()}</TableCell>
      <TableCell className="text-sm">{new Date(flight.arrival_time).toLocaleString()}</TableCell>
      <TableCell className="text-right">{priceFmt.format(Number(flight.base_price))}</TableCell>
      <TableCell className="text-right">{flight.total_seats}</TableCell>
      <TableCell>
        {flight.is_active ? (
          <Badge variant="secondary">Active</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} className="gap-1">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" variant={flight.is_active ? "outline" : "default"} onClick={toggle} disabled={busy} className="gap-1">
            <Power className="h-3.5 w-3.5" /> {flight.is_active ? "Disable" : "Enable"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function toLocalInput(iso: string | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function FlightDialog({
  open,
  onOpenChange,
  mode,
  flight,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  flight?: FlightRow;
  onSaved: () => void;
}) {
  const createFn = useServerFn(adminCreateFlight);
  const updateFn = useServerFn(adminUpdateFlight);
  const [busy, setBusy] = useState(false);

  const [flightNumber, setFlightNumber] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [totalSeats, setTotalSeats] = useState("60");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && flight) {
      setFlightNumber(flight.flight_number);
      setOrigin(flight.origin);
      setDestination(flight.destination);
      setDeparture(toLocalInput(flight.departure_time));
      setArrival(toLocalInput(flight.arrival_time));
      setBasePrice(String(flight.base_price));
      setTotalSeats(String(flight.total_seats));
    } else {
      setFlightNumber("");
      setOrigin("");
      setDestination("");
      setDeparture("");
      setArrival("");
      setBasePrice("");
      setTotalSeats("60");
    }
  }, [open, mode, flight]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        flight_number: flightNumber.trim(),
        origin: origin.trim(),
        destination: destination.trim(),
        departure_time: new Date(departure).toISOString(),
        arrival_time: new Date(arrival).toISOString(),
        base_price: Number(basePrice),
        total_seats: Number(totalSeats),
      };
      if (mode === "create") {
        await createFn({ data: payload });
        toast.success("Flight created");
      } else if (flight) {
        await updateFn({ data: { id: flight.id, ...payload } });
        toast.success("Flight updated");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New flight" : "Edit flight"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Add a new scheduled flight." : "Update the flight schedule and fare."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Flight number" id="fn">
              <Input id="fn" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} placeholder="GW101" required />
            </Field>
            <Field label="Base fare (NGN)" id="bp">
              <Input id="bp" type="number" min="0" step="100" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required />
            </Field>
            <Field label="Origin" id="org">
              <Input id="org" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Lagos" required />
            </Field>
            <Field label="Destination" id="dst">
              <Input id="dst" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Abuja" required />
            </Field>
            <Field label="Departure" id="dep">
              <Input id="dep" type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} required />
            </Field>
            <Field label="Arrival" id="arr">
              <Input id="arr" type="datetime-local" value={arrival} onChange={(e) => setArrival(e.target.value)} required />
            </Field>
            <Field label="Total seats" id="ts">
              <Input id="ts" type="number" min="1" max="600" value={totalSeats} onChange={(e) => setTotalSeats(e.target.value)} required />
            </Field>
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : mode === "create" ? "Create flight" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
