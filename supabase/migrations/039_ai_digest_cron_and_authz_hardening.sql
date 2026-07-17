-- 039: AI Phase 2/3 — daily digest cron + authorization hardening of 038.
--
-- SECURITY FIX for 038: function EXECUTE defaults to PUBLIC, and the role
-- check was not NULL-safe (get_user_role() is NULL for anon → `NULL <>
-- 'super_admin'` is NULL → the IF never raised). Anon could call
-- get_admin_summary_data. Fixed: explicit REVOKE + COALESCE'd checks +
-- explicit service_role allowance (the digest cron runs as service_role).

-- ---------------------------------------------------------------------------
-- 1) Recreate get_admin_summary_data with hardened auth.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_summary_data(
  p_site_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- service_role (digest cron) is trusted; humans must be super admin or owner.
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF COALESCE(get_user_role(), '') <> 'super_admin' AND NOT user_owns_site(p_site_id) THEN
      RAISE EXCEPTION 'Not authorized for this site';
    END IF;
  END IF;

  WITH site_cps AS (
    SELECT c.id, c.name, c.checkpoint_role
    FROM checkpoints c
    JOIN floors f ON f.id = c.floor_id
    WHERE f.site_id = p_site_id AND c.active = true
  ),
  window_scans AS (
    SELECT sc.guard_id, sc.checkpoint_id, sc.scanned_at, sc.status,
           sc.approval_note, sc.scan_input_method, cp.checkpoint_role, cp.name AS checkpoint_name
    FROM scans sc
    JOIN site_cps cp ON cp.id = sc.checkpoint_id
    WHERE sc.scanned_at >= p_start AND sc.scanned_at <= p_end
  ),
  shift_rows AS (
    SELECT sh.id, sh.guard_id, g.name AS guard_name, sh.starts_at, sh.ends_at,
      (SELECT min(ws.scanned_at) FROM window_scans ws
        WHERE ws.guard_id = sh.guard_id AND ws.status = 'pass'
          AND ws.checkpoint_role = 'shift_clock_in'
          AND ws.scanned_at >= sh.starts_at - interval '1 hour'
          AND ws.scanned_at <= sh.ends_at) AS clock_in_at,
      (SELECT max(ws.scanned_at) FROM window_scans ws
        WHERE ws.guard_id = sh.guard_id AND ws.status = 'pass'
          AND ws.checkpoint_role = 'shift_clock_out'
          AND ws.scanned_at > sh.starts_at
          AND ws.scanned_at <= sh.ends_at + interval '6 hours') AS clock_out_at
    FROM shifts sh
    JOIN guards g ON g.id = sh.guard_id
    WHERE sh.site_id = p_site_id AND sh.status = 'published'
      AND sh.guard_id IS NOT NULL
      AND sh.starts_at >= p_start AND sh.starts_at <= p_end
  )
  SELECT jsonb_build_object(
    'site', (SELECT jsonb_build_object('id', s.id, 'name', s.name) FROM sites s WHERE s.id = p_site_id),
    'window', jsonb_build_object('start', p_start, 'end', p_end),
    'shifts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'guard', sr.guard_name,
        'starts_at', sr.starts_at,
        'ends_at', sr.ends_at,
        'clock_in_at', sr.clock_in_at,
        'clock_out_at', sr.clock_out_at,
        'late_minutes', CASE WHEN sr.clock_in_at IS NULL THEN NULL
          ELSE GREATEST(0, ROUND(EXTRACT(EPOCH FROM (sr.clock_in_at - sr.starts_at)) / 60)::int) END,
        'no_show', sr.clock_in_at IS NULL AND sr.ends_at < now(),
        'missing_clock_out', sr.clock_in_at IS NOT NULL AND sr.clock_out_at IS NULL AND sr.ends_at < now()
      ) ORDER BY sr.starts_at) FROM shift_rows sr), '[]'::jsonb),
    'checkpoints', jsonb_build_object(
      'total_patrol', (SELECT count(*) FROM site_cps
        WHERE checkpoint_role IS DISTINCT FROM 'shift_clock_in'
          AND checkpoint_role IS DISTINCT FROM 'shift_clock_out'),
      'pass_scans', (SELECT count(*) FROM window_scans WHERE status = 'pass'
        AND checkpoint_role IS DISTINCT FROM 'shift_clock_in'
        AND checkpoint_role IS DISTINCT FROM 'shift_clock_out'),
      'gps_rejects', (SELECT count(*) FROM window_scans WHERE status = 'fail')
    ),
    'misses', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'guard', g.name,
        'checkpoint', c.name,
        'window_start', m.window_start
      ) ORDER BY m.window_start) FROM checkpoint_misses m
      JOIN guards g ON g.id = m.guard_id
      JOIN checkpoints c ON c.id = m.checkpoint_id
      WHERE m.site_id = p_site_id
        AND m.window_start >= p_start AND m.window_start <= p_end), '[]'::jsonb),
    'repeat_miss_counts', COALESCE((SELECT jsonb_object_agg(g.name, cnt) FROM (
        SELECT guard_id, count(*) AS cnt FROM checkpoint_misses
        WHERE site_id = p_site_id AND window_start >= p_start AND window_start <= p_end
        GROUP BY guard_id HAVING count(*) >= 2
      ) rm JOIN guards g ON g.id = rm.guard_id), '{}'::jsonb),
    'alerts', jsonb_build_object(
      'total', (SELECT count(*) FROM alert_events
        WHERE site_id = p_site_id AND created_at >= p_start AND created_at <= p_end),
      'unacknowledged', (SELECT count(*) FROM alert_events
        WHERE site_id = p_site_id AND created_at >= p_start AND created_at <= p_end
          AND acknowledged = false),
      'by_type', COALESCE((SELECT jsonb_object_agg(event_type, cnt) FROM (
          SELECT event_type, count(*) AS cnt FROM alert_events
          WHERE site_id = p_site_id AND created_at >= p_start AND created_at <= p_end
          GROUP BY event_type
        ) t), '{}'::jsonb)
    ),
    'incidents', jsonb_build_object(
      'total', (SELECT count(*) FROM incident_reports
        WHERE site_id = p_site_id AND created_at >= p_start AND created_at <= p_end)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Recreate get_client_summary_data with hardened auth.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_client_summary_data(
  p_site_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF NOT (
      p_site_id = get_user_site_id()
      OR COALESCE(get_user_role(), '') = 'super_admin'
      OR user_owns_site(p_site_id)
    ) THEN
      RAISE EXCEPTION 'Not authorized for this site';
    END IF;
  END IF;

  WITH site_cps AS (
    SELECT c.id, c.checkpoint_role
    FROM checkpoints c
    JOIN floors f ON f.id = c.floor_id
    WHERE f.site_id = p_site_id AND c.active = true
  ),
  shift_rows AS (
    SELECT sh.id, sh.guard_id, sh.starts_at, sh.ends_at,
      EXISTS (SELECT 1 FROM scans sc JOIN site_cps cp ON cp.id = sc.checkpoint_id
        WHERE sc.guard_id = sh.guard_id AND sc.status = 'pass'
          AND cp.checkpoint_role = 'shift_clock_in'
          AND sc.scanned_at >= sh.starts_at - interval '1 hour'
          AND sc.scanned_at <= sh.ends_at) AS covered
    FROM shifts sh
    WHERE sh.site_id = p_site_id AND sh.status = 'published'
      AND sh.guard_id IS NOT NULL
      AND sh.starts_at >= p_start AND sh.starts_at <= p_end
  )
  SELECT jsonb_build_object(
    'site_name', (SELECT s.name FROM sites s WHERE s.id = p_site_id),
    'window', jsonb_build_object('start', p_start, 'end', p_end),
    'coverage', jsonb_build_object(
      'shifts_scheduled', (SELECT count(*) FROM shift_rows),
      'shifts_covered', (SELECT count(*) FROM shift_rows WHERE covered)
    ),
    'checkpoints', jsonb_build_object(
      'total', (SELECT count(*) FROM site_cps
        WHERE checkpoint_role IS DISTINCT FROM 'shift_clock_in'
          AND checkpoint_role IS DISTINCT FROM 'shift_clock_out'),
      'confirmed_visits', (SELECT count(*) FROM scans sc
        JOIN site_cps cp ON cp.id = sc.checkpoint_id
        WHERE sc.status = 'pass'
          AND cp.checkpoint_role IS DISTINCT FROM 'shift_clock_in'
          AND cp.checkpoint_role IS DISTINCT FROM 'shift_clock_out'
          AND sc.scanned_at >= p_start AND sc.scanned_at <= p_end)
    ),
    'reviewed_delays', (SELECT count(*) FROM alert_events
      WHERE site_id = p_site_id AND acknowledged = true
        AND created_at >= p_start AND created_at <= p_end),
    'staffing', CASE
      WHEN (SELECT count(*) FROM shift_rows) = 0 THEN 'no_shifts_scheduled'
      WHEN (SELECT count(*) FROM shift_rows WHERE NOT covered AND ends_at < now()) = 0 THEN 'fully_staffed'
      ELSE 'gaps_under_review'
    END
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Lock down EXECUTE: nothing for PUBLIC/anon; authenticated + service only.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_admin_summary_data(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_client_summary_data(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_summary_data(uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_client_summary_data(uuid, timestamptz, timestamptz) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Daily digest cron — 11:00 UTC = 07:00 Toronto in summer (06:00 in
--    winter; pg_cron has no timezone support, acceptable drift for a digest).
--    Same anon-JWT gateway pattern as roster-alerts-every-10min (026).
-- ---------------------------------------------------------------------------
SELECT cron.unschedule('ai-daily-digest') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'ai-daily-digest'
);

SELECT cron.schedule(
  'ai-daily-digest',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vktxadadhnrcuxtubzxr.supabase.co/functions/v1/ai-daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrdHhhZGFkaG5yY3V4dHVienhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDQyMjIsImV4cCI6MjA5NjY4MDIyMn0.8LuLj0c_D9lqUsSf-cwtyr2HzMDwZc_ASbfpSoeS5aw'
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);
