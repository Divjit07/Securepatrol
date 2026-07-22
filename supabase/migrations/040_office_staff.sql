-- 040: Office Staff — a separate worker class that clocks IN/OUT with Face ID
-- at an office location (geofenced), purely to track hours. Distinct from
-- security guards: guards never use Face ID (they clock in with GPS → NFC → QR
-- at sites); office staff are the owner's own employees whose hours are tracked.
--
-- Model:
--   * role='office' profiles, created by the create-office-employee edge fn.
--   * office_locations: the buildings/offices staff clock in at (own geofence).
--   * profiles.office_location_id + profiles.face_id_enabled — the admin flips
--     Face ID on per person, and assigns which office they clock in at.
--   * office_clock_events: immutable raw punches; hours are DERIVED on top of
--     them, never written back over the raw rows.
--   * "Face ID" = the same WebAuthn passkey the guards already use. The
--     webauthn_credentials table is keyed by the auth user id, so office staff
--     reuse the passkey edge function with zero changes.
--
-- ⚠️  Apply by pasting this file into the Supabase SQL editor — never `db push`.

-- ---- 1) Role + per-profile office settings -----------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'guard', 'client', 'office'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS office_location_id uuid,
  ADD COLUMN IF NOT EXISTS face_id_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.face_id_enabled IS
  'Admin toggle: this office employee may enroll + clock in/out with Face ID.';

-- Any admin may manage office-employee profiles (Face ID toggle, office
-- assignment, activate/deactivate). Migration 013 already covers guard/client
-- profiles; this adds role='office'. get_user_role() is SECURITY DEFINER, so it
-- does not recurse through profiles' own RLS.
DROP POLICY IF EXISTS "Admins manage office profiles" ON profiles;
CREATE POLICY "Admins manage office profiles"
  ON profiles FOR UPDATE
  USING (profiles.role = 'office' AND get_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (profiles.role = 'office' AND get_user_role() IN ('admin', 'super_admin'));

-- Additive: guarantees the admin Office Staff list can read office profiles
-- (RLS policies OR together, so this never restricts existing reads).
DROP POLICY IF EXISTS "Admins read office profiles" ON profiles;
CREATE POLICY "Admins read office profiles"
  ON profiles FOR SELECT
  USING (profiles.role = 'office' AND get_user_role() IN ('admin', 'super_admin'));

-- ---- 2) Office locations ------------------------------------------------------
CREATE TABLE IF NOT EXISTS office_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  latitude double precision,
  longitude double precision,
  geofence_radius_m integer NOT NULL DEFAULT 120,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Wire profiles → office_locations now that the table exists.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_office_location_fk;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_office_location_fk
  FOREIGN KEY (office_location_id) REFERENCES office_locations(id) ON DELETE SET NULL;

ALTER TABLE office_locations ENABLE ROW LEVEL SECURITY;

-- Admins manage everything.
DROP POLICY IF EXISTS "admins manage office locations" ON office_locations;
CREATE POLICY "admins manage office locations" ON office_locations
  FOR ALL
  USING (get_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (get_user_role() IN ('admin', 'super_admin'));

-- Office staff read active locations so their app can compute the geofence.
DROP POLICY IF EXISTS "office staff read locations" ON office_locations;
CREATE POLICY "office staff read locations" ON office_locations
  FOR SELECT
  USING (active = true AND get_user_role() = 'office');

-- ---- 3) Office clock events (immutable raw punches) --------------------------
CREATE TABLE IF NOT EXISTS office_clock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  office_location_id uuid REFERENCES office_locations(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('in', 'out')),
  event_at timestamptz NOT NULL DEFAULT now(),
  guard_lat double precision,
  guard_lng double precision,
  gps_accuracy double precision,
  distance_metres numeric,
  status text NOT NULL DEFAULT 'fail' CHECK (status IN ('pass', 'fail')),
  verified_by_face boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_clock_employee_time
  ON office_clock_events (employee_id, event_at DESC);

ALTER TABLE office_clock_events ENABLE ROW LEVEL SECURITY;

-- Employees insert + read only their own punches. No UPDATE/DELETE policy
-- exists, so raw punches are immutable to every non-service caller.
DROP POLICY IF EXISTS "employee inserts own office punch" ON office_clock_events;
CREATE POLICY "employee inserts own office punch" ON office_clock_events
  FOR INSERT WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "employee reads own office punches" ON office_clock_events;
CREATE POLICY "employee reads own office punches" ON office_clock_events
  FOR SELECT USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "admins read office punches" ON office_clock_events;
CREATE POLICY "admins read office punches" ON office_clock_events
  FOR SELECT USING (get_user_role() IN ('admin', 'super_admin'));

-- ---- 4) Server-side geofence validation --------------------------------------
-- Mirrors the guard face_gps rule (migration 029/031): the office location's
-- geofence decides pass/fail on clock-IN; Face ID itself is asserted by the
-- client (verified in the passkey edge fn) and recorded as verified_by_face.
-- Clock-OUT is allowed from anywhere — the punch is still recorded with GPS for
-- audit — so staff are never trapped on-site to end their day.
CREATE OR REPLACE FUNCTION public.validate_office_clock_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  loc_lat double precision;
  loc_lng double precision;
  loc_radius integer;
  dist double precision;
  effective_radius double precision;
BEGIN
  IF NEW.employee_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot submit a clock event for another employee';
  END IF;

  SELECT ol.latitude, ol.longitude, ol.geofence_radius_m
  INTO loc_lat, loc_lng, loc_radius
  FROM office_locations ol
  WHERE ol.id = NEW.office_location_id AND ol.active = true;

  -- Clock-OUT: always passes; record distance when we can, for the audit trail.
  IF NEW.event_type = 'out' THEN
    IF loc_lat IS NOT NULL AND NEW.guard_lat IS NOT NULL THEN
      NEW.distance_metres :=
        round(haversine_distance(NEW.guard_lat, NEW.guard_lng, loc_lat, loc_lng)::numeric, 2);
    END IF;
    NEW.status := 'pass';
    RETURN NEW;
  END IF;

  -- Clock-IN needs a located office and a good fix inside the fence.
  IF loc_lat IS NULL OR loc_lng IS NULL THEN
    RAISE EXCEPTION 'Office location has no coordinates — an admin must set them first';
  END IF;
  IF NEW.guard_lat IS NULL OR NEW.guard_lng IS NULL THEN
    NEW.status := 'fail';
    RETURN NEW;
  END IF;

  dist := haversine_distance(NEW.guard_lat, NEW.guard_lng, loc_lat, loc_lng);
  NEW.distance_metres := round(dist::numeric, 2);

  effective_radius := COALESCE(loc_radius, 120);
  IF NEW.gps_accuracy IS NOT NULL THEN
    effective_radius := effective_radius + LEAST(NEW.gps_accuracy * 0.75, 40);
  END IF;

  IF NEW.gps_accuracy IS NOT NULL AND NEW.gps_accuracy > 100 THEN
    NEW.status := 'fail';
  ELSIF dist > effective_radius THEN
    NEW.status := 'fail';
  ELSE
    NEW.status := 'pass';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_office_clock ON office_clock_events;
CREATE TRIGGER trg_validate_office_clock
  BEFORE INSERT ON office_clock_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_office_clock_before_insert();
