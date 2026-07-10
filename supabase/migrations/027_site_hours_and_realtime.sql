-- Per-site operating hours + realtime for roster/guard changes.

-- NULL = company default (Mon–Fri 11:00–20:00, Sat 10:00–17:00, Sun closed).
-- Shape: {"mon":{"start":"11:00","end":"20:00"}, ..., "sun":null} — null day = closed.
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS operating_hours JSONB;

COMMENT ON COLUMN sites.operating_hours IS
  'Per-day open hours override; null = company default schedule. Drives guard/client dashboards, shift clock, and payroll windows.';

-- Live updates for the admin Roster grid and guard assignment lists.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE shifts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
