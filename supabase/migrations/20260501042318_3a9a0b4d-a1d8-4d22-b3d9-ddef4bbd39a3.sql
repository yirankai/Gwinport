-- Add is_active flag to flights for soft-disable (F14)
ALTER TABLE public.flights
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_flights_active_departure
  ON public.flights (is_active, departure_time);
