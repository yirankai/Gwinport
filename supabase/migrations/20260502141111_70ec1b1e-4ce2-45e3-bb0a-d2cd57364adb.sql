-- Promote existing admins to super_admin (keep their admin role too for backwards compat)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::public.app_role
FROM public.user_roles
WHERE role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

-- Helper: does user have ANY of the given roles?
CREATE OR REPLACE FUNCTION public.has_any_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','super_admin','flight_admin','booking_admin','support_admin')
  )
$$;

-- ===== FLIGHTS =====
DROP POLICY IF EXISTS "Admins manage flights" ON public.flights;
CREATE POLICY "Flight admins manage flights"
ON public.flights
FOR ALL
USING (
  public.has_role(auth.uid(),'super_admin')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'flight_admin')
)
WITH CHECK (
  public.has_role(auth.uid(),'super_admin')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'flight_admin')
);

-- ===== BOOKINGS =====
DROP POLICY IF EXISTS "Admins manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins view all bookings" ON public.bookings;

CREATE POLICY "Booking admins manage bookings"
ON public.bookings
FOR ALL
USING (
  public.has_role(auth.uid(),'super_admin')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'booking_admin')
)
WITH CHECK (
  public.has_role(auth.uid(),'super_admin')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'booking_admin')
);

CREATE POLICY "All admin roles view bookings"
ON public.bookings
FOR SELECT
USING (public.has_any_admin_role(auth.uid()));

-- ===== USER ROLES =====
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;

CREATE POLICY "Super admins manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admin roles view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_any_admin_role(auth.uid()));

-- ===== PROFILES (let admins view all) =====
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admin roles view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_any_admin_role(auth.uid()));