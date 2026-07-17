-- 035: NFC tag UID binding + flag-based incident-editor permission.
--
-- Problem 1 — NFC scans auto-passed with zero verification: the trigger
-- trusted any insert claiming scan_input_method='nfc', and checkpoint UUIDs
-- are copyable from the admin UI, so anyone with a $2 NFC writer (or plain
-- API calls) could mint passing scans from anywhere. All the floor/altitude
-- work in migrations 007–014 gated nothing on the only live scan path.
--
-- Fix: checkpoints can be bound to a physical tag's serial number (UID).
--   * Bound checkpoint  → the scan must carry the matching UID or it fails.
--   * Unbound checkpoint → first successful NFC scan binds it automatically
--     (trust-on-first-use: tags are physically deployed before guards scan
--     them), and until bound the scan is validated by GPS proximity like any
--     other scan instead of blind-passing.
--
-- Problem 2 — is_incident_editor (023) granted edit/delete by hardcoded
-- email/name ('divjit007@gmail.com' / name ILIKE 'divjit%'). Replaced with a
-- profiles.can_edit_incidents flag, seeded for current holders.

-- ---- 1) Schema ---------------------------------------------------------------
ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS nfc_tag_uid TEXT;

COMMENT ON COLUMN checkpoints.nfc_tag_uid IS
  'Serial number of the physical NFC tag bound to this checkpoint. NULL = not yet bound; first successful NFC scan binds it.';

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS nfc_serial TEXT;

COMMENT ON COLUMN scans.nfc_serial IS
  'NFC tag serial captured by Web NFC at scan time; validated against checkpoints.nfc_tag_uid.';

-- ---- 2) Trigger: validate NFC against the bound UID ---------------------------
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

  -- Clock punches: Face ID + GPS or NFC tap only. Never QR.
  IF cp_role IN ('shift_clock_in', 'shift_clock_out')
     AND (NEW.scan_input_method IS NULL OR NEW.scan_input_method = 'qr') THEN
    RAISE EXCEPTION 'QR cannot be used to clock in or out — use Face ID or the NFC tag';
  END IF;

  -- Face ID clock punch: geofence against the SITE, not the checkpoint tag.
  IF NEW.scan_input_method = 'face_gps' THEN
    IF site_lat IS NULL OR site_lng IS NULL THEN
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

-- ---- 3) Admins can re-bind a replaced tag -------------------------------------
CREATE OR REPLACE FUNCTION public.reset_checkpoint_tag(p_checkpoint_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM checkpoints c
      JOIN floors f ON f.id = c.floor_id
      WHERE c.id = p_checkpoint_id AND user_owns_site(f.site_id)
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to reset checkpoint tags';
  END IF;

  UPDATE checkpoints SET nfc_tag_uid = NULL WHERE id = p_checkpoint_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_checkpoint_tag(uuid) TO authenticated;

-- ---- 4) Incident editing: flag, not a hardcoded identity ----------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_edit_incidents BOOLEAN NOT NULL DEFAULT false;

-- Seed everyone the old hardcoded rule currently matches, so nobody loses
-- access when the rule flips to flag-only.
UPDATE profiles p
SET can_edit_incidents = true
FROM auth.users u
WHERE p.id = u.id
  AND p.role IN ('admin', 'super_admin')
  AND p.active = true
  AND (lower(u.email) = 'divjit007@gmail.com' OR p.name ILIKE 'divjit%');

CREATE OR REPLACE FUNCTION public.is_incident_editor(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = user_id
      AND p.role IN ('admin', 'super_admin')
      AND p.active = true
      AND (p.role = 'super_admin' OR p.can_edit_incidents = true)
  );
$$;
