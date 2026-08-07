-- 050: Athena — editable alert and digest copy.
--
-- The alert wording lives inside the edge functions, so changing "is running
-- late" to your own phrasing means a redeploy. This lifts the copy into a table
-- the office can edit, with the functions falling back to their built-in string
-- when no row exists — so an empty table behaves exactly like today and nothing
-- breaks if this migration is applied before the functions are redeployed.
--
-- Tokens are substituted at send time: {guard} {site} {minutes} {time} {count}.
-- There is no model here. Athena templates a string; it cannot invent a number.
--
-- ⚠️ Paste into the Supabase SQL editor — never `db push`.

CREATE TABLE IF NOT EXISTS public.alert_templates (
  key text PRIMARY KEY,
  label text NOT NULL,
  subject text,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_templates ENABLE ROW LEVEL SECURITY;

-- Admins own the wording. Guards and clients receive it, they do not write it.
DROP POLICY IF EXISTS "Admin reads templates" ON public.alert_templates;
CREATE POLICY "Admin reads templates" ON public.alert_templates
  FOR SELECT USING (get_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Admin writes templates" ON public.alert_templates;
CREATE POLICY "Admin writes templates" ON public.alert_templates
  FOR ALL USING (get_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (get_user_role() IN ('admin', 'super_admin'));

-- Seed with the copy the functions ship today, so the editor opens showing
-- exactly what your guards and clients currently receive.
INSERT INTO public.alert_templates (key, label, subject, body) VALUES
  ('alert_late', 'Guard running late', NULL,
   '{guard} is running late — shift at {site} started {time}, no clock-in yet.'),
  ('alert_no_show', 'No-show', NULL,
   '{guard} has not clocked in at {site} — shift started {time}.'),
  ('alert_stale_patrol', 'Stale patrol', NULL,
   '{guard} at {site}: no checkpoint scan for {minutes} minutes (site limit {limit}).'),
  ('alert_email', 'Alert email', 'Kronus alerts: {count} need attention',
   'Automated monitoring · every 10 minutes'),
  ('digest_admin', 'Daily ops digest (admin)', 'Kronus ops digest — {date}',
   'Every figure is computed directly from your patrol records.'),
  ('digest_client', 'Coverage update (client)', 'Coverage update — {site}',
   'Prepared automatically from verified patrol records.')
ON CONFLICT (key) DO NOTHING;
