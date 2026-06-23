-- Remote scan approval for a designated admin (divjit007@gmail.com).
-- Inserts a passing scan on behalf of a guard without GPS validation.

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_note TEXT;

ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_sync_method_check;
ALTER TABLE scans ADD CONSTRAINT scans_sync_method_check
  CHECK (sync_method IN ('realtime', 'offline_sync', 'admin_override'));

CREATE OR REPLACE FUNCTION public.is_scan_approver(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN profiles p ON p.id = u.id
    WHERE u.id = user_id
      AND lower(u.email) = 'divjit007@gmail.com'
      AND p.role IN ('admin', 'super_admin')
      AND p.active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_scan_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cp_lat double precision;
  cp_lng double precision;
  cp_radius integer;
  cp_alt double precision;
  floor_num integer;
  floor_elev double precision;
  dist_horiz double precision;
  expected_alt double precision;
  effective_radius double precision;
BEGIN
  IF NEW.sync_method = 'admin_override' THEN
    IF NEW.approved_by IS NULL OR NOT is_scan_approver(NEW.approved_by) THEN
      RAISE EXCEPTION 'Unauthorized admin scan approval';
    END IF;
    NEW.status := 'pass';
    NEW.distance_metres := COALESCE(NEW.distance_metres, 0);
    RETURN NEW;
  END IF;

  IF NEW.guard_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot submit scan for another guard';
  END IF;

  SELECT c.latitude, c.longitude, c.radius_metres, c.altitude_metres,
         f.floor_number, f.elevation_metres
  INTO cp_lat, cp_lng, cp_radius, cp_alt, floor_num, floor_elev
  FROM checkpoints c
  JOIN floors f ON f.id = c.floor_id
  WHERE c.id = NEW.checkpoint_id AND c.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkpoint not found or inactive';
  END IF;

  dist_horiz := haversine_distance(NEW.guard_lat, NEW.guard_lng, cp_lat, cp_lng);
  NEW.distance_metres := round(dist_horiz::numeric, 2);

  effective_radius := COALESCE(cp_radius, 20);
  IF NEW.gps_accuracy IS NOT NULL THEN
    effective_radius := effective_radius + LEAST(NEW.gps_accuracy * 0.75, 25);
  END IF;

  IF NEW.gps_accuracy IS NOT NULL AND NEW.gps_accuracy > 65 THEN
    NEW.status := 'fail';
    RETURN NEW;
  END IF;

  IF dist_horiz > effective_radius THEN
    NEW.status := 'fail';
    RETURN NEW;
  END IF;

  expected_alt := COALESCE(cp_alt, floor_elev);

  IF floor_num > 1
     AND expected_alt IS NOT NULL
     AND NEW.guard_altitude IS NOT NULL
     AND NEW.gps_accuracy IS NOT NULL
     AND NEW.gps_accuracy <= 30
     AND abs(NEW.guard_altitude - expected_alt) > 18 THEN
    NEW.status := 'fail';
    RETURN NEW;
  END IF;

  NEW.status := 'pass';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_checkpoint_scan(
  p_checkpoint_id uuid,
  p_guard_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scan_id uuid;
  cp_lat double precision;
  cp_lng double precision;
  cp_site_id uuid;
BEGIN
  IF NOT is_scan_approver(auth.uid()) THEN
    RAISE EXCEPTION 'Only the designated scan approver can approve scans';
  END IF;

  SELECT c.latitude, c.longitude, f.site_id
  INTO cp_lat, cp_lng, cp_site_id
  FROM checkpoints c
  JOIN floors f ON f.id = c.floor_id
  WHERE c.id = p_checkpoint_id AND c.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkpoint not found or inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = p_guard_id
      AND p.role = 'guard'
      AND p.active = true
      AND p.site_id = cp_site_id
  ) THEN
    RAISE EXCEPTION 'Guard is not assigned to this checkpoint site';
  END IF;

  INSERT INTO scans (
    checkpoint_id,
    guard_id,
    scanned_at,
    guard_lat,
    guard_lng,
    distance_metres,
    status,
    sync_method,
    approved_by,
    approval_note
  ) VALUES (
    p_checkpoint_id,
    p_guard_id,
    now(),
    cp_lat,
    cp_lng,
    0,
    'pass',
    'admin_override',
    auth.uid(),
    NULLIF(trim(p_note), '')
  )
  RETURNING id INTO v_scan_id;

  RETURN v_scan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_scan_approver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_checkpoint_scan(uuid, uuid, text) TO authenticated;
