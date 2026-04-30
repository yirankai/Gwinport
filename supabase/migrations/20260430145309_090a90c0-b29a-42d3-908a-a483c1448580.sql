
-- Seat locks (F8 - prevent double booking during checkout)
CREATE TABLE public.seat_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID NOT NULL,
  seat_number TEXT NOT NULL,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flight_id, seat_number)
);

ALTER TABLE public.seat_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view active seat locks"
  ON public.seat_locks FOR SELECT TO authenticated
  USING (expires_at > now());

CREATE POLICY "Users create own seat locks"
  ON public.seat_locks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own seat locks"
  ON public.seat_locks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Audit logs (NFR traceability)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Booking reference generator
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ref TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
BEGIN
  ref := 'GW-';
  FOR i IN 1..6 LOOP
    ref := ref || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN ref;
END;
$$;
