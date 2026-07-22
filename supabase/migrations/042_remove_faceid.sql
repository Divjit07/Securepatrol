-- 042: Remove Face ID (WebAuthn passkeys) from the project entirely.
--
-- Decision (2026-07-22): Face ID clock-in is cancelled. It added friction and
-- the biometric/App-Store approval path was risky. Guards AND office staff now
-- clock in the same way: a geofenced GPS punch (primary) with NFC / QR
-- fallbacks; login is plain email + password.
--
-- The scan method token `face_gps` is KEPT as-is: it is an opaque internal
-- value on historical raw punches (which must stay immutable), and it now simply
-- means "a geofenced GPS clock punch". Nothing biometric runs anymore — the
-- passkey edge function is deleted and the WebAuthn tables are dropped below.
--
-- ⚠️  Paste into the Supabase SQL editor — never `db push`.

-- ---- 1) Drop the WebAuthn / passkey storage (migration 029) -------------------
DROP TABLE IF EXISTS webauthn_challenges CASCADE;
DROP TABLE IF EXISTS webauthn_credentials CASCADE;

-- ---- 2) Drop the per-employee Face ID toggle (migration 040) ------------------
ALTER TABLE profiles DROP COLUMN IF EXISTS face_id_enabled;

-- ---- 3) Drop the "verified by face" flag on office punches (migration 040) ----
ALTER TABLE office_clock_events DROP COLUMN IF EXISTS verified_by_face;

-- Note: sites/office geofence columns, ensure_clock_checkpoint(), and the
-- validate_scan_before_insert / validate_office_clock_before_insert triggers all
-- STAY — they enforce the GPS geofence that clock-in still relies on.

-- ---- 4) Rename auto-created clock checkpoints (drop the "Face ID" label) ------
-- Same body as migration 029, but new clock checkpoints are named "Clock In" /
-- "Clock Out" instead of "... (Face ID)". Existing checkpoints keep their names.
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
    CASE WHEN p_role = 'shift_clock_in' THEN 'Clock In' ELSE 'Clock Out' END,
    v_lat,
    v_lng,
    COALESCE(v_radius, 120),
    p_role
  )
  RETURNING id INTO v_checkpoint_id;

  RETURN v_checkpoint_id;
END;
$$;
