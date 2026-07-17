-- Missed-checkpoint tracking: persist "checkpoint X was NOT scanned during
-- guard Y's shift" as real rows, so completion rates ("24/25 checkpoints") and
-- repeat-offender patterns ("2nd miss this week") are queryable facts instead
-- of render-time labels. Runs on pg_cron every 30 minutes over shifts that
-- ended in the last 48h; idempotent via UNIQUE (shift_id, checkpoint_id).
--
-- Scope decision: misses are only recorded for shifts where the guard actually
-- clocked in. Full no-shows are already alert_events ('no_show') — recording
-- every checkpoint as "missed" for a no-show would drown the pattern data.

CREATE TABLE IF NOT EXISTS checkpoint_misses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  guard_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (shift_id, checkpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_checkpoint_misses_site_window
  ON checkpoint_misses(site_id, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_checkpoint_misses_guard_window
  ON checkpoint_misses(guard_id, window_start DESC);

ALTER TABLE checkpoint_misses ENABLE ROW LEVEL SECURITY;

-- Admins see and acknowledge misses for their sites.
CREATE POLICY "Admins read checkpoint misses"
  ON checkpoint_misses FOR SELECT
  USING (get_user_role() = 'super_admin' OR user_owns_site(site_id));

CREATE POLICY "Admins update checkpoint misses"
  ON checkpoint_misses FOR UPDATE
  USING (get_user_role() = 'super_admin' OR user_owns_site(site_id));

-- Clients see coverage facts for their own site (counts feed the client
-- digest's "24 of 25 checkpoints confirmed" — no payroll/HR data lives here).
CREATE POLICY "Clients read own-site checkpoint misses"
  ON checkpoint_misses FOR SELECT
  USING (get_user_role() = 'client' AND site_id = get_user_site_id());

-- Guards can see their own misses (self-correction, not a secret).
CREATE POLICY "Guards read own checkpoint misses"
  ON checkpoint_misses FOR SELECT
  USING (guard_id = auth.uid());

-- Allow the new event type in the existing alerts feed.
ALTER TABLE alert_events DROP CONSTRAINT IF EXISTS alert_events_event_type_check;
ALTER TABLE alert_events ADD CONSTRAINT alert_events_event_type_check
  CHECK (event_type IN ('late', 'no_show', 'stale_patrol', 'missed_checkpoint'));

-- ---------------------------------------------------------------------------
-- Detection: for each completed published shift (last 48h) where the guard
-- clocked in, every active patrol checkpoint at the site with zero pass scans
-- inside the shift window becomes one checkpoint_misses row. New misses also
-- produce one summary alert_events row per shift so they surface in Alerts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION detect_checkpoint_misses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  miss_count integer := 0;
BEGIN
  CREATE TEMP TABLE _new_misses (
    site_id UUID, shift_id UUID, guard_id UUID, checkpoint_id UUID
  ) ON COMMIT DROP;

  WITH done_shifts AS (
    SELECT s.id AS shift_id, s.site_id, s.guard_id, s.starts_at, s.ends_at
    FROM shifts s
    WHERE s.status = 'published'
      AND s.guard_id IS NOT NULL
      AND s.ends_at < now()
      AND s.ends_at >= now() - interval '48 hours'
  ),
  clocked AS (
    SELECT ds.*
    FROM done_shifts ds
    WHERE EXISTS (
      SELECT 1
      FROM scans sc
      JOIN checkpoints cp ON cp.id = sc.checkpoint_id
      JOIN floors f ON f.id = cp.floor_id
      WHERE sc.guard_id = ds.guard_id
        AND f.site_id = ds.site_id
        AND cp.checkpoint_role = 'shift_clock_in'
        AND sc.status = 'pass'
        AND sc.scanned_at BETWEEN ds.starts_at - interval '1 hour' AND ds.ends_at
    )
  ),
  expected AS (
    SELECT c.shift_id, c.site_id, c.guard_id, c.starts_at, c.ends_at,
           cp.id AS checkpoint_id
    FROM clocked c
    JOIN floors f ON f.site_id = c.site_id
    JOIN checkpoints cp ON cp.floor_id = f.id
    WHERE cp.active = true
      AND cp.checkpoint_role NOT IN ('shift_clock_in', 'shift_clock_out')
  ),
  missed AS (
    SELECT e.*
    FROM expected e
    WHERE NOT EXISTS (
      SELECT 1 FROM scans sc
      WHERE sc.checkpoint_id = e.checkpoint_id
        AND sc.guard_id = e.guard_id
        AND sc.status = 'pass'
        AND sc.scanned_at BETWEEN e.starts_at AND e.ends_at
    )
  ),
  ins AS (
    INSERT INTO checkpoint_misses (site_id, shift_id, guard_id, checkpoint_id, window_start, window_end)
    SELECT site_id, shift_id, guard_id, checkpoint_id, starts_at, ends_at
    FROM missed
    ON CONFLICT (shift_id, checkpoint_id) DO NOTHING
    RETURNING site_id, shift_id, guard_id, checkpoint_id
  )
  INSERT INTO _new_misses SELECT * FROM ins;

  SELECT count(*) INTO miss_count FROM _new_misses;

  -- One digest alert per shift with NEW misses (ins only returns new rows, so
  -- re-runs never duplicate alerts).
  INSERT INTO alert_events (site_id, shift_id, guard_id, event_type, message)
  SELECT nm.site_id, nm.shift_id, nm.guard_id, 'missed_checkpoint',
         COALESCE(pr.name, 'Guard') || ' missed ' || count(*) ||
         ' checkpoint' || CASE WHEN count(*) > 1 THEN 's' ELSE '' END ||
         ' during their shift: ' ||
         string_agg(cp.name, ', ' ORDER BY cp.name)
  FROM _new_misses nm
  LEFT JOIN profiles pr ON pr.id = nm.guard_id
  LEFT JOIN checkpoints cp ON cp.id = nm.checkpoint_id
  GROUP BY nm.site_id, nm.shift_id, nm.guard_id, pr.name;

  DROP TABLE _new_misses;
  RETURN miss_count;
END;
$$;

-- Runs as table owner (SECURITY DEFINER); cron calls it directly in SQL — no
-- edge function or key needed.
REVOKE ALL ON FUNCTION detect_checkpoint_misses() FROM PUBLIC;

SELECT cron.schedule(
  'checkpoint-miss-detection-every-30min',
  '*/30 * * * *',
  $$ SELECT detect_checkpoint_misses(); $$
);

-- Live updates for the Alerts page / dashboards.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE checkpoint_misses;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
