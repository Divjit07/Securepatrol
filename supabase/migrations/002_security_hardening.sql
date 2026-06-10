-- SecurePatrol Security Hardening
-- Run this in Supabase SQL Editor AFTER the initial schema.sql

-- ---------------------------------------------------------------------------
-- 1. Server-side GPS verification (anti-cheat)
-- Database recalculates distance and sets pass/fail — client cannot fake it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371000 * 2 * atan2(
    sqrt(a),
    sqrt(1 - a)
  )
  FROM (
    SELECT
      sin(radians(lat2 - lat1) / 2) ^ 2
      + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2 AS a
  ) s;
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
  dist double precision;
BEGIN
  IF NEW.guard_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot submit scan for another guard';
  END IF;

  SELECT latitude, longitude, radius_metres
  INTO cp_lat, cp_lng, cp_radius
  FROM checkpoints
  WHERE id = NEW.checkpoint_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkpoint not found or inactive';
  END IF;

  dist := haversine_distance(NEW.guard_lat, NEW.guard_lng, cp_lat, cp_lng);
  NEW.distance_metres := round(dist::numeric, 2);
  NEW.status := CASE
    WHEN dist <= COALESCE(cp_radius, 20) THEN 'pass'
    ELSE 'fail'
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_scan_gps ON scans;
CREATE TRIGGER validate_scan_gps
  BEFORE INSERT ON scans
  FOR EACH ROW
  EXECUTE FUNCTION validate_scan_before_insert();

-- Prevent guards from tampering with scans after insert
CREATE OR REPLACE FUNCTION public.block_scan_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Scan records cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS block_scan_update ON scans;
CREATE TRIGGER block_scan_update
  BEFORE UPDATE ON scans
  FOR EACH ROW
  EXECUTE FUNCTION block_scan_modification();

DROP TRIGGER IF EXISTS block_scan_delete ON scans;
CREATE TRIGGER block_scan_delete
  BEFORE DELETE ON scans
  FOR EACH ROW
  EXECUTE FUNCTION block_scan_modification();

-- ---------------------------------------------------------------------------
-- 2. Tighten profile INSERT policy
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow profile creation on signup" ON profiles;
CREATE POLICY "Allow profile creation on signup"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can update guard profiles on sites they own (activate/deactivate)
DROP POLICY IF EXISTS "Admins can update guard profiles" ON profiles;
CREATE POLICY "Admins can update guard profiles"
  ON profiles FOR UPDATE
  USING (
    get_user_role() = 'super_admin'
    OR (
      get_user_role() = 'admin'
      AND EXISTS (
        SELECT 1 FROM guards g
        JOIN sites s ON s.id = g.site_id
        WHERE g.id = profiles.id AND s.admin_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Helper: verify caller is admin (used by Edge Function via service role,
--    and available for future RPC calls)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role IN ('admin', 'super_admin')
    AND active = true
  );
$$;
