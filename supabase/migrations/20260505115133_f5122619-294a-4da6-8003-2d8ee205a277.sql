ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_selected boolean NOT NULL DEFAULT false;