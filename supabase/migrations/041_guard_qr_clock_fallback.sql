-- 041: Re-enable QR as the guard clock-in/out LAST-RESORT fallback.
--
-- Background: migrations 030/031 hard-blocked QR for clock punches ("QR cannot
-- be used to clock in or out"). The owner wants the fallback order to be:
--   guard clock-in = geofence GPS (Face ID) → NFC tag (fallback 1) → QR (2).
-- So QR is allowed again for the two clock checkpoint roles — but it is NOT a
-- free pass: a QR clock punch is validated against the SITE geofence exactly
-- like a Face ID (face_gps) punch. Copying a QR code doesn't help unless you're
-- physically inside the fence. Patrol QR scans are unchanged (still validated
-- against the checkpoint's own geofence).
--
-- Clock-OUT is accepted from anywhere for both face_gps and QR (recorded with
-- GPS for audit), matching the documented intent of migration 031 and the guard
-- app UI — staff/guards are never trapped on-site to end a shift.
--
-- This CREATE OR REPLACE is a faithful copy of the migration-035 trigger with
-- only the QR handling changed. ⚠️ Paste into the Supabase SQL editor.

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

  -- Clock punches accept Face ID + GPS, an NFC tap, or QR (last-resort
  -- fallback). Only a punch with NO input method at all is rejected.
  IF cp_role IN ('shift_clock_in', 'shift_clock_out')
     AND NEW.scan_input_method IS NULL THEN
    RAISE EXCEPTION 'Clock punches need Face ID, an NFC tap, or a QR scan';
  END IF;

  -- Face ID clock punch, OR QR used as a clock fallback: geofence against the
  -- SITE (clock checkpoints live at the site coords), not the checkpoint tag.
  -- Clock-OUT passes from anywhere; clock-IN must be inside the site fence.
  IF NEW.scan_input_method = 'face_gps'
     OR (NEW.scan_input_method = 'qr' AND cp_role IN ('shift_clock_in', 'shift_clock_out')) THEN
    IF site_lat IS NULL OR site_lng IS NULL THEN
      site_lat := cp_lat;
      site_lng := cp_lng;
      site_radius := GREATEST(COALESCE(site_radius, 120), COALESCE(cp_radius, 20));
    END IF;

    dist_horiz := haversine_distance(NEW.guard_lat, NEW.guard_lng, site_lat, site_lng);
    NEW.distance_metres := round(dist_horiz::numeric, 2);

    -- Clock-OUT: recorded with GPS for audit, never fails the fence.
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

    -- Unbound tag, no serial (older client / reader without UID): fall through
    -- to GPS proximity validation below instead of blind-passing — but keep
    -- the pre-035 behavior of passing when GPS is simply unavailable, so
    -- basement checkpoints don't brick.
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
