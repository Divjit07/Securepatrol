-- 037: Admin force clock-out.
-- The Live Clock board lets an admin end a guard's shift remotely. RLS blocks
-- inserting scans for another guard ("Guards insert own scans"), so this is a
-- SECURITY DEFINER RPC. It inserts a REAL shift_clock_out punch via the
-- existing admin_override trigger path (031), so:
--   • the guard's own app flips to clocked-out (status derives from last punch)
--   • payroll/Shift Clock/Ops Summary see it with zero changes
--   • raw punches stay immutable — this adds a punch, never edits one.

-- Honest labeling: admin punches are their own input method.
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_scan_input_method_check;
ALTER TABLE scans ADD CONSTRAINT scans_scan_input_method_check
  CHECK (scan_input_method IS NULL OR scan_input_method IN ('nfc', 'qr', 'face_gps', 'admin'));

CREATE OR REPLACE FUNCTION public.admin_clock_out_guard(p_guard_id uuid, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site_id uuid;
  v_site_lat double precision;
  v_site_lng double precision;
  v_checkpoint_id uuid;
  v_scan_id uuid;
  v_last_role text;
BEGIN
  -- Caller must be an admin/super_admin (same gate as scan approval).
  IF NOT is_scan_approver(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can clock a guard out';
  END IF;

  SELECT g.site_id, s.latitude, s.longitude
  INTO v_site_id, v_site_lat, v_site_lng
  FROM guards g
  LEFT JOIN sites s ON s.id = g.site_id
  WHERE g.id = p_guard_id;

  IF v_site_id IS NULL THEN
    RAISE EXCEPTION 'Guard has no assigned site';
  END IF;

  -- Site-scoped admins may only clock out their own guards.
  IF get_user_role() <> 'super_admin' AND NOT user_owns_site(v_site_id) THEN
    RAISE EXCEPTION 'You do not manage this guard''s site';
  END IF;

  -- Guard must actually be clocked in (last clock punch in 16h is an IN).
  SELECT c.checkpoint_role INTO v_last_role
  FROM scans sc
  JOIN checkpoints c ON c.id = sc.checkpoint_id
  WHERE sc.guard_id = p_guard_id
    AND sc.status = 'pass'
    AND c.checkpoint_role IN ('shift_clock_in', 'shift_clock_out')
    AND sc.scanned_at >= now() - interval '16 hours'
  ORDER BY sc.scanned_at DESC
  LIMIT 1;

  IF v_last_role IS DISTINCT FROM 'shift_clock_in' THEN
    RAISE EXCEPTION 'Guard is not clocked in';
  END IF;

  v_checkpoint_id := ensure_clock_checkpoint(v_site_id, 'shift_clock_out');

  INSERT INTO scans (
    checkpoint_id, guard_id, scanned_at,
    guard_lat, guard_lng, gps_accuracy,
    distance_metres, status,
    sync_method, scan_input_method,
    approved_by, approval_note
  ) VALUES (
    v_checkpoint_id, p_guard_id, now(),
    COALESCE(v_site_lat, 0), COALESCE(v_site_lng, 0), NULL,
    0, 'fail', -- trigger's admin_override path forces pass
    'admin_override', 'admin',
    auth.uid(),
    COALESCE(NULLIF(trim(p_note), ''), 'Clocked out by admin')
  )
  RETURNING id INTO v_scan_id;

  RETURN v_scan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_clock_out_guard(uuid, text) TO authenticated;
