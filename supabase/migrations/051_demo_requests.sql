-- 051: Demo requests from the public marketing page (kronus.space).
--
-- The homepage form posts straight to PostgREST with the anon key, so this
-- table is INSERT-only for the public and readable by admins only. Nobody can
-- read, edit or delete a lead through the API except an admin. Length checks
-- keep a bot from stuffing megabytes into a row.
--
-- If this migration has not been run yet, the form falls back to opening the
-- visitor's email app with the request pre-filled, so no lead is lost.
--
-- ⚠️ Paste into the Supabase SQL editor — never `db push`.

CREATE TABLE IF NOT EXISTS public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  company text NOT NULL CHECK (length(trim(company)) BETWEEN 1 AND 160),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  guards text CHECK (guards IS NULL OR length(guards) <= 20),
  plan text CHECK (plan IS NULL OR length(plan) <= 20),
  message text CHECK (message IS NULL OR length(message) <= 2000),
  source text CHECK (source IS NULL OR length(source) <= 200),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'won', 'lost'))
);

CREATE INDEX IF NOT EXISTS demo_requests_created_idx
  ON public.demo_requests (created_at DESC);

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (signed out or in) may submit a request. They may not choose its status.
DROP POLICY IF EXISTS "Anyone submits a demo request" ON public.demo_requests;
CREATE POLICY "Anyone submits a demo request" ON public.demo_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new');

DROP POLICY IF EXISTS "Admins read demo requests" ON public.demo_requests;
CREATE POLICY "Admins read demo requests" ON public.demo_requests
  FOR SELECT USING (get_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Admins update demo requests" ON public.demo_requests;
CREATE POLICY "Admins update demo requests" ON public.demo_requests
  FOR UPDATE USING (get_user_role() IN ('admin', 'super_admin'));

GRANT INSERT ON public.demo_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.demo_requests TO authenticated;
