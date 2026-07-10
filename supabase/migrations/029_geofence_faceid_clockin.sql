-- 029: Geofenced Face ID clock-in.
--
-- 1) sites gain GPS coordinates + a geofence radius — the "arrived at site" zone.
-- 2) webauthn_credentials / webauthn_challenges: passkeys ("Face ID" on iPhone)
--    enrolled per guard; challenges are written only by the passkey edge function
--    (service role) so assertions are verified server-side.
-- 3) scans.scan_input_method gains 'face_gps'. The validate trigger geofences
--    those scans against the SITE coordinates (radius ~120 m: "on the property"),
--    not the 20 m checkpoint radius — clock-in happens at the gate, not a tag.
-- 4) ensure_clock_checkpoint(site, role): returns the site's clock-in/out
--    checkpoint, creating a hidden one from the site coordinates if missing, so
--    Face ID clock-in works on sites that never set up clock tags. Keeping clock
--    punches as scans on shift_clock_in/out checkpoints means payroll, the shift
--    clock, and late/no-show alerts all keep working unchanged.

-- ---- 1) Site coordinates + geofence --------------------------------------
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS geofence_radius_m integer NOT NULL DEFAULT 120;

-- ---- 2) Passkey storage ----------------------------------------------------
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[],
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own credentials readable" ON webauthn_credentials;
CREATE POLICY "own credentials readable" ON webauthn_credentials
  FOR SELECT USING (
    guard_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "own credentials removable" ON webauthn_credentials;
CREATE POLICY "own credentials removable" ON webauthn_credentials
  FOR DELETE USING (guard_id = auth.uid());
-- Inserts/updates happen only via the passkey edge function (service role).

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('registration', 'authentication')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Service-role only: RLS on with no policies.
ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- ---- 3) face_gps scan method ----------------------------------------------
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_scan_input_method_check;
ALTER TABLE scans ADD CONSTRAINT scans_scan_input_method_check
  CHECK (scan_input_method IS NULL OR scan_input_method IN ('nfc', 'qr', 'face_gps'));

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

  SELECT c.latitude, c.longitude, c.radius_metres, c.altitude_metres,
         f.floor_number, f.elevation_metres, s.latitude, s.longitude, s.geofence_radius_m
  INTO cp_lat, cp_lng, cp_radius, cp_alt, floor_num, floor_elev,
       site_lat, site_lng, site_radius
  FROM checkpoints c
  JOIN floors f ON f.id = c.floor_id
  JOIN sites s ON s.id = f.site_id
  WHERE c.id = NEW.checkpoint_id AND c.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkpoint not found or inactive';
  END IF;

  -- Face ID clock punch: geofence against the SITE, not the checkpoint tag.
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

-- ---- 4) Clock checkpoints on demand ----------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_clock_checkpoint(p_site_id uuid, p_role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkpoint_id uuid;
  v_floor_id uuid;
  v_lat double precision;
  v_lng double precision;
  v_radius integer;
BEGIN
  IF p_role NOT IN ('shift_clock_in', 'shift_clock_out') THEN
    RAISE EXCEPTION 'Invalid clock checkpoint role';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (p.role IN ('admin', 'super_admin') OR p.site_id = p_site_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this site';
  END IF;

  SELECT c.id INTO v_checkpoint_id
  FROM checkpoints c
  JOIN floors f ON f.id = c.floor_id
  WHERE f.site_id = p_site_id AND c.checkpoint_role = p_role AND c.active = true
  ORDER BY c.id
  LIMIT 1;
  IF v_checkpoint_id IS NOT NULL THEN
    RETURN v_checkpoint_id;
  END IF;

  SELECT s.latitude, s.longitude, s.geofence_radius_m
  INTO v_lat, v_lng, v_radius
  FROM sites s WHERE s.id = p_site_id;
  IF v_lat IS NULL OR v_lng IS NULL THEN
    RAISE EXCEPTION 'Site location not set — an admin must save the site coordinates first';
  END IF;

  SELECT f.id INTO v_floor_id
  FROM floors f WHERE f.site_id = p_site_id
  ORDER BY f.floor_number
  LIMIT 1;
  IF v_floor_id IS NULL THEN
    INSERT INTO floors (site_id, floor_name, floor_number, elevation_metres)
    VALUES (p_site_id, 'Ground', 1, 0)
    RETURNING id INTO v_floor_id;
  END IF;

  INSERT INTO checkpoints (floor_id, name, latitude, longitude, radius_metres, checkpoint_role)
  VALUES (
    v_floor_id,
    CASE WHEN p_role = 'shift_clock_in' THEN 'Clock In (Face ID)' ELSE 'Clock Out (Face ID)' END,
    v_lat,
    v_lng,
    COALESCE(v_radius, 120),
    p_role
  )
  RETURNING id INTO v_checkpoint_id;

  RETURN v_checkpoint_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_clock_checkpoint(uuid, text) TO authenticated;
