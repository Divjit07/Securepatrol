-- 045: Remove QR entirely. NFC tags replace QR for patrol; clock in/out is
-- geofenced GPS + a dedicated clock NFC tag. This rewrites the scan trigger
-- (from the migration-041 version) to:
--   1. REJECT any new scan with scan_input_method = 'qr'.
--   2. Drop the QR clock-in/out fallback branch (added in 041).
--   3. Keep Face ID/GPS ('face_gps') geofenced clock punches + NFC verification.
--
-- Historical 'qr' scan rows are left untouched (raw punches are immutable); the
-- scan_input_method check constraint still permits 'qr' so those rows stay valid.
-- Only NEW qr inserts are refused.
--
-- ⚠️ Paste into the Supabase SQL editor — never `db push`.

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
  cp_tag_uid text;
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

  -- QR is removed. Every checkpoint is an NFC tag; clock in/out is GPS + NFC.
  IF NEW.scan_input_method = 'qr' THEN
    RAISE EXCEPTION 'QR scanning has been removed — scan the NFC tag instead';
  END IF;

  SELECT c.latitude, c.longitude, c.radius_metres, c.altitude_metres, c.checkpoint_role,
         c.nfc_tag_uid,
         f.floor_number, f.elevation_metres, s.latitude, s.longitude, s.geofence_radius_m
  INTO cp_lat, cp_lng, cp_radius, cp_alt, cp_role,
       cp_tag_uid,
       floor_num, floor_elev, site_lat, site_lng, site_radius
  FROM checkpoints c
  JOIN floors f ON f.id = c.floor_id
  JOIN sites s ON s.id = f.site_id
  WHERE c.id = NEW.checkpoint_id AND c.active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkpoint not found or inactive';
  END IF;

  -- Clock punches accept Face ID + GPS or an NFC tap. A punch with no method
  -- (or QR, rejected above) is refused.
  IF cp_role IN ('shift_clock_in', 'shift_clock_out')
     AND NEW.scan_input_method IS NULL THEN
    RAISE EXCEPTION 'Clock punches need geofenced GPS or an NFC tap';
  END IF;

  -- Face ID / GPS clock punch: geofence against the SITE (clock checkpoints live
  -- at the site coords), not the tag. Clock-OUT passes from anywhere; clock-IN
  -- must be inside the site fence.
  IF NEW.scan_input_method = 'face_gps' THEN
    IF site_lat IS NULL OR site_lng IS NULL THEN
      site_lat := cp_lat;
      site_lng := cp_lng;
      site_radius := GREATEST(COALESCE(site_radius, 120), COALESCE(cp_radius, 20));
    END IF;

    dist_horiz := haversine_distance(NEW.guard_lat, NEW.guard_lng, site_lat, site_lng);
    NEW.distance_metres := round(dist_horiz::numeric, 2);

    IF cp_role = 'shift_clock_out' THEN
      NEW.status := 'pass';
      RETURN NEW;
    END IF;

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

  IF NEW.scan_input_method = 'nfc' THEN
    -- Bound tag: physical presence = matching serial. No serial or a
    -- mismatch fails outright (copied checkpoint UUIDs no longer pass).
    IF cp_tag_uid IS NOT NULL THEN
      IF NEW.nfc_serial IS NOT NULL AND lower(NEW.nfc_serial) = lower(cp_tag_uid) THEN
        NEW.status := 'pass';
      ELSE
        NEW.status := 'fail';
      END IF;
      RETURN NEW;
    END IF;

    -- Unbound tag + serial supplied: bind it (trust on first use) and pass.
    IF NEW.nfc_serial IS NOT NULL THEN
      UPDATE checkpoints SET nfc_tag_uid = NEW.nfc_serial WHERE id = NEW.checkpoint_id;
      NEW.status := 'pass';
      RETURN NEW;
    END IF;

    -- Unbound tag, no serial (older reader without UID): fall through to GPS
    -- proximity, but pass when GPS is simply unavailable so basement
    -- checkpoints don't brick.
    IF NEW.guard_lat IS NULL OR NEW.guard_lng IS NULL THEN
      NEW.status := 'pass';
      RETURN NEW;
    END IF;
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
