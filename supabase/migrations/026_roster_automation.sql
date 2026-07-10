-- Roster automation: late/no-show + stale-patrol alerts (pg_cron → edge
-- function), per-site patrol interval, and guard timesheet sign-offs.

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS patrol_interval_minutes INT NOT NULL DEFAULT 120;

COMMENT ON COLUMN sites.patrol_interval_minutes IS
  'Guard is pinged/admin alerted when no patrol scan happens for this many minutes during an active shift.';

-- Alert log written by the roster-alerts edge function (service role).
CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
  guard_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('late', 'no_show', 'stale_patrol')),
  message TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_site_created ON alert_events(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_shift ON alert_events(shift_id, event_type);

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read and ack alert events"
  ON alert_events FOR SELECT
  USING (get_user_role() = 'super_admin' OR user_owns_site(site_id));

CREATE POLICY "Admins update alert events"
  ON alert_events FOR UPDATE
  USING (get_user_role() = 'super_admin' OR user_owns_site(site_id));

-- Guard-approved weekly timesheets ("handshake").
CREATE TABLE IF NOT EXISTS timesheet_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  hours_snapshot NUMERIC(6, 2),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guard_id, week_start)
);

ALTER TABLE timesheet_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards approve own timesheets"
  ON timesheet_approvals FOR INSERT
  WITH CHECK (guard_id = auth.uid() AND get_user_role() = 'guard');

CREATE POLICY "Read timesheet approvals"
  ON timesheet_approvals FOR SELECT
  USING (
    guard_id = auth.uid()
    OR get_user_role() = 'super_admin'
    OR user_owns_site(site_id)
  );

-- Every 10 minutes: run the roster-alerts edge function. The anon key is the
-- public client key (already shipped in the web bundle) — used only to pass
-- the gateway JWT check; the function itself uses the service role.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'roster-alerts-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vktxadadhnrcuxtubzxr.supabase.co/functions/v1/roster-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrdHhhZGFkaG5yY3V4dHVienhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDQyMjIsImV4cCI6MjA5NjY4MDIyMn0.8LuLj0c_D9lqUsSf-cwtyr2HzMDwZc_ASbfpSoeS5aw'
    ),
    body := '{}'::jsonb
  );
  $$
);
