-- 048: Wave approval — record a whole patrol round in one action.
--
-- WHY: the single-scan override (015) inserts one scan stamped now(). When a
-- guard walks a round in a GPS dead zone (parkade, stairwell core), the admin
-- has to submit each checkpoint separately and every scan lands on the same
-- second, which does not resemble the round that was actually walked.
--
-- This adds a wave: N checkpoints for one guard, spread evenly across a window
-- the admin specifies (default: the 15 minutes ending now).
--
-- INTEGRITY NOTES — read before changing this:
--   * Every row still carries sync_method = 'admin_override' and approved_by =
--     the acting admin. That is the audit trail that separates admin-entered
--     records from device-verified ones. Do not remove it.
--   * Only the designated scan approver may call this (same gate as 015).
--   * The window is capped so this cannot be used to write scans into an
--     arbitrary past or the future.
--
-- Run this in the Supabase SQL editor. Do NOT `supabase db push`.

CREATE OR REPLACE FUNCTION public.approve_scan_wave(
  p_checkpoint_ids uuid[],
  p_guard_id uuid,
  p_started_at timestamptz DEFAULT NULL,
  p_ended_at timestamptz DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_count int;
  v_step interval;
  v_idx int := 0;
  v_cp uuid;
  v_lat double precision;
  v_lng double precision;
  v_site uuid;
  v_scan_id uuid;
BEGIN
  IF NOT is_scan_approver(auth.uid()) THEN
    RAISE EXCEPTION 'Only the designated scan approver can approve scans';
  END IF;

  v_count := coalesce(array_length(p_checkpoint_ids, 1), 0);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No checkpoints supplied';
  END IF;
  IF v_count > 100 THEN
    RAISE EXCEPTION 'Wave is limited to 100 checkpoints';
  END IF;

  v_end := coalesce(p_ended_at, now());
  v_start := coalesce(p_started_at, v_end - interval '15 minutes');

  IF v_start >= v_end THEN
    RAISE EXCEPTION 'Round start must be before the round end';
  END IF;
  -- A round is a walk, not a shift: keep the window plausible.
  IF v_end - v_start > interval '8 hours' THEN
    RAISE EXCEPTION 'Round window cannot exceed 8 hours';
  END IF;
  -- No writing into the future, and no silently rewriting last month.
  IF v_end > now() + interval '1 minute' THEN
    RAISE EXCEPTION 'Round cannot end in the future';
  END IF;
  IF v_start < now() - interval '30 days' THEN
    RAISE EXCEPTION 'Round cannot start more than 30 days ago';
  END IF;

  -- Even spacing across the window; a single checkpoint lands on the start.
  v_step := CASE WHEN v_count > 1
                 THEN (v_end - v_start) / (v_count - 1)
                 ELSE interval '0' END;

  FOREACH v_cp IN ARRAY p_checkpoint_ids LOOP
    SELECT c.latitude, c.longitude, f.site_id
    INTO v_lat, v_lng, v_site
    FROM checkpoints c
    JOIN floors f ON f.id = c.floor_id
    WHERE c.id = v_cp AND c.active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Checkpoint % not found or inactive', v_cp;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = p_guard_id
        AND p.role = 'guard'
        AND p.active = true
        AND p.site_id = v_site
    ) THEN
      RAISE EXCEPTION 'Guard is not assigned to this checkpoint site';
    END IF;

    INSERT INTO scans (
      checkpoint_id, guard_id, scanned_at,
      guard_lat, guard_lng, distance_metres,
      status, sync_method, approved_by, approval_note
    ) VALUES (
      v_cp, p_guard_id, v_start + (v_step * v_idx),
      v_lat, v_lng, 0,
      'pass', 'admin_override', auth.uid(), NULLIF(trim(p_note), '')
    )
    RETURNING id INTO v_scan_id;

    v_idx := v_idx + 1;
    RETURN NEXT v_scan_id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.approve_scan_wave(uuid[], uuid, timestamptz, timestamptz, text)
  TO authenticated;
