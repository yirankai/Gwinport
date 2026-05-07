// Local sample flights for the homepage. Daily-deterministic shuffle + status.

export interface SampleFlight {
  id: string;
  airline: string;
  flightNumber: string;
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  departureTime: string; // "HH:mm"
  arrivalTime: string; // "HH:mm"
  basePrice: number;
  totalSeats: number;
}

const FLIGHTS: SampleFlight[] = [
  { id: "mnl-ceb-1", airline: "Gwinport Air", flightNumber: "GW101", origin: "Manila", originCode: "MNL", destination: "Cebu", destinationCode: "CEB", departureTime: "06:30", arrivalTime: "08:00", basePrice: 2499, totalSeats: 180 },
  { id: "ceb-mnl-1", airline: "Gwinport Air", flightNumber: "GW102", origin: "Cebu", originCode: "CEB", destination: "Manila", destinationCode: "MNL", departureTime: "09:15", arrivalTime: "10:45", basePrice: 2599, totalSeats: 180 },
  { id: "mnl-dvo-1", airline: "Gwinport Air", flightNumber: "GW201", origin: "Manila", originCode: "MNL", destination: "Davao", destinationCode: "DVO", departureTime: "07:45", arrivalTime: "09:40", basePrice: 3199, totalSeats: 180 },
  { id: "dvo-mnl-1", airline: "Gwinport Air", flightNumber: "GW202", origin: "Davao", originCode: "DVO", destination: "Manila", destinationCode: "MNL", departureTime: "11:00", arrivalTime: "12:55", basePrice: 3299, totalSeats: 180 },
  { id: "ceb-ilo-1", airline: "Gwinport Air", flightNumber: "GW301", origin: "Cebu", originCode: "CEB", destination: "Iloilo", destinationCode: "ILO", departureTime: "08:20", arrivalTime: "09:10", basePrice: 1899, totalSeats: 120 },
  { id: "ilo-ceb-1", airline: "Gwinport Air", flightNumber: "GW302", origin: "Iloilo", originCode: "ILO", destination: "Cebu", destinationCode: "CEB", departureTime: "10:05", arrivalTime: "10:55", basePrice: 1949, totalSeats: 120 },
  { id: "mnl-ilo-1", airline: "Gwinport Air", flightNumber: "GW401", origin: "Manila", originCode: "MNL", destination: "Iloilo", destinationCode: "ILO", departureTime: "13:10", arrivalTime: "14:30", basePrice: 2299, totalSeats: 160 },
  { id: "ilo-mnl-1", airline: "Gwinport Air", flightNumber: "GW402", origin: "Iloilo", originCode: "ILO", destination: "Manila", destinationCode: "MNL", departureTime: "15:25", arrivalTime: "16:45", basePrice: 2399, totalSeats: 160 },
];

export type FlightStatus = "Available" | "Few Seats Left" | "Fully Booked";

export interface DailyFlight extends SampleFlight {
  date: string; // YYYY-MM-DD (today)
  availableSeats: number;
  status: FlightStatus;
}

/** Daily seed — same value all day, changes at midnight local time. */
export function getDailySeed(date: Date = new Date()): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return y * 10000 + m * 100 + d;
}

// Mulberry32 — small deterministic PRNG.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleFlightsByDate(flights: SampleFlight[], date: Date = new Date()): SampleFlight[] {
  const rand = mulberry32(getDailySeed(date));
  const arr = [...flights];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function updateDailyFlightStatus(flights: SampleFlight[], date: Date = new Date()): DailyFlight[] {
  const rand = mulberry32(getDailySeed(date) + 7);
  const dateStr = date.toISOString().slice(0, 10);
  return flights.map((f) => {
    // Deterministic seats sold per day — between 30% and 100% of capacity.
    const soldPct = 0.3 + rand() * 0.7;
    const sold = Math.min(f.totalSeats, Math.floor(f.totalSeats * soldPct));
    const available = Math.max(0, f.totalSeats - sold);
    let status: FlightStatus = "Available";
    if (available === 0) status = "Fully Booked";
    else if (available <= Math.max(5, Math.floor(f.totalSeats * 0.1))) status = "Few Seats Left";
    return { ...f, date: dateStr, availableSeats: available, status };
  });
}

export function getTodaysFlights(date: Date = new Date()): DailyFlight[] {
  return updateDailyFlightStatus(shuffleFlightsByDate(FLIGHTS, date), date);
}
