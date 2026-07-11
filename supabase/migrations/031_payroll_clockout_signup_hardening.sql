-- 031: Payroll rates, clock-out from anywhere, signup privilege hardening.
--
-- 1) SECURITY FIX — handle_new_user trusted client-supplied user_metadata for
--    role/site. Anyone hitting auth.signUp with {role:'super_admin'} became a
--    super admin. Roles from user_metadata are now clamped to guard/client
--    (what the create-guard/create-client edge functions send); privileged
--    roles are honored only from raw_app_meta_data, which only the service
--    role can set. Self-signups always land as an unassigned guard.
-- 2) Clock-OUT is accepted from anywhere: the punch is recorded with GPS +
--    distance for audit, but never fails the geofence. Clock-IN keeps the
--    site geofence. QR remains rejected for both.
-- 3) guards.hourly_rate — payroll department pay rate, feeds the paystub
--    generator. Admin-editable via the existing "Admins manage guards" policy.
-- 4) Composite index for the clock-status lookup (guard's latest punch).

-- ---- 1) Signup hardening ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_site uuid;
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  -- app_metadata: only settable with the service role key — fully trusted.
  v_role := NEW.raw_app_meta_data->>'role';

  IF v_role IS NULL THEN
    -- user_metadata: client-controlled. Never allow privileged roles from it.
    v_role := NEW.raw_user_meta_data->>'role';
    IF v_role IS NULL OR v_role NOT IN ('guard', 'client') THEN
      v_role := 'guard';
    END IF;
  END IF;

  IF NEW.raw_app_meta_data->>'site_id' ~ uuid_re THEN
    v_site := (NEW.raw_app_meta_data->>'site_id')::uuid;
  ELSIF NEW.raw_user_meta_data->>'site_id' ~ uuid_re THEN
    v_site := (NEW.raw_user_meta_data->>'site_id')::uuid;
  END IF;

  INSERT INTO public.profiles (id, name, role, site_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    v_role,
    v_site
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---- 2) Clock-out passes from anywhere --------------------------------------
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
  cp_role text;
  floor_num integer;
  floor_elev double precision;
  site_lat double precision;
  site_lng double precision;
  site_radius integer;
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

  SELECT c.latitude, c.longitude, c.radius_metres, c.altitude_metres, c.checkpoint_role,
         f.floor_number, f.elevation_metres, s.latitude, s.longitude, s.geofence_radius_m
  INTO cp_lat, cp_lng, cp_radius, cp_alt, cp_role, floor_num, floor_elev,
       site_lat, site_lng, site_radius
  FROM checkpoints c
  JOIN floors f ON f.id = c.floor_id
  JOIN sites s ON s.id = f.site_id
  WHERE c.id = NEW.checkpoint_id AND c.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkpoint not found or inactive';
  END IF;

  -- Clock punches: Face ID + GPS or NFC tap only. Never QR.
  IF cp_role IN ('shift_clock_in', 'shift_clock_out')
     AND (NEW.scan_input_method IS NULL OR NEW.scan_input_method = 'qr') THEN
    RAISE EXCEPTION 'QR cannot be used to clock in or out — use Face ID or the NFC tag';
  END IF;

  -- Clock-OUT: accepted from anywhere. Keep distance for the audit trail,
  -- but a guard must always be able to end their shift off-site.
  IF cp_role = 'shift_clock_out' THEN
    IF site_lat IS NOT NULL AND site_lng IS NOT NULL THEN
      NEW.distance_metres := round(haversine_distance(NEW.guard_lat, NEW.guard_lng, site_lat, site_lng)::numeric, 2);
    ELSE
      NEW.distance_metres := round(haversine_distance(NEW.guard_lat, NEW.guard_lng, cp_lat, cp_lng)::numeric, 2);
    END IF;
    NEW.status := 'pass';
    RETURN NEW;
  END IF;

  -- Face ID clock-in: geofence against the SITE, not the checkpoint tag.
  IF NEW.scan_input_method = 'face_gps' THEN
    IF site_lat IS NULL OR site_lng IS NULL THEN
      -- Site not geocoded yet — fall back to the checkpoint's own location.
      site_lat := cp_lat;
      site_lng := cp_lng;
      site_radius := GREATEST(COALESCE(site_radius, 120), COALESCE(cp_radius, 20));
    END IF;

    dist_horiz := haversine_distance(NEW.guard_lat, NEW.guard_lng, site_lat, site_lng);
    NEW.distance_metres := round(dist_horiz::numeric, 2);

    effective_radius := COALESCE(site_radius, 120);
    IF NEW.gps_accuracy IS NOT NULL THEN
      effective_radius := effective_radius + LEAST(NEW.gps_accuracy * 0.75, 40);
    END IF;

    IF NEW.gps_accuracy IS NOT NULL AND NEW.gps_accuracy > 100 THEN
      NEW.status := 'fail';
    ELSIF dist_horiz > effective_radius THEN
      NEW.status := 'fail';
    ELSE
      NEW.status := 'pass';
    END IF;
    RETURN NEW;
  END IF;

  dist_horiz := haversine_distance(NEW.guard_lat, NEW.guard_lng, cp_lat, cp_lng);
  NEW.distance_metres := round(dist_horiz::numeric, 2);

  -- Physical NFC tap at the sticker — trust the tag, keep GPS for audit only.
  IF NEW.scan_input_method = 'nfc' THEN
    NEW.status := 'pass';
    RETURN NEW;
  END IF;

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

-- ---- 3) Payroll rate --------------------------------------------------------
ALTER TABLE guards
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(8,2);

-- ---- 4) Clock-status lookup index -------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scans_guard_scanned_at
  ON scans (guard_id, scanned_at DESC);
