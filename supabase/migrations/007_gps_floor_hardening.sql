-- Multi-floor GPS hardening: altitude + accuracy checks, tighter default radius.
-- Run in Supabase SQL Editor after prior migrations.

ALTER TABLE floors
  ADD COLUMN IF NOT EXISTS elevation_metres DOUBLE PRECISION;

ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS altitude_metres DOUBLE PRECISION;

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS guard_altitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION;

-- Backfill floor elevations (~3.5m per level)
UPDATE floors
SET elevation_metres = GREATEST(0, (floor_number - 1) * 3.5)
WHERE elevation_metres IS NULL;

-- Backfill checkpoint altitude from floor elevation where missing
UPDATE checkpoints c
SET altitude_metres = f.elevation_metres
FROM floors f
WHERE c.floor_id = f.id AND c.altitude_metres IS NULL;

-- Tighten default radius for new checkpoints
ALTER TABLE checkpoints ALTER COLUMN radius_metres SET DEFAULT 8;

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
  max_accuracy double precision;
BEGIN
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
  max_accuracy := LEAST(COALESCE(cp_radius, 8), 15);

  -- Reject scans with poor GPS accuracy
  IF NEW.gps_accuracy IS NOT NULL AND NEW.gps_accuracy > max_accuracy THEN
    NEW.status := 'fail';
    RETURN NEW;
  END IF;

  -- Horizontal distance check
  IF dist_horiz > COALESCE(cp_radius, 8) THEN
    NEW.status := 'fail';
    RETURN NEW;
  END IF;

  expected_alt := COALESCE(cp_alt, floor_elev);

  -- Upper floors require altitude verification (stops ground-floor QR spoofing)
  IF floor_num > 1 AND expected_alt IS NOT NULL THEN
    IF NEW.guard_altitude IS NULL THEN
      NEW.status := 'fail';
      RETURN NEW;
    END IF;

    IF abs(NEW.guard_altitude - expected_alt) > 5 THEN
      NEW.status := 'fail';
      RETURN NEW;
    END IF;
  END IF;

  NEW.status := 'pass';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_scan_gps ON scans;
CREATE TRIGGER validate_scan_gps
  BEFORE INSERT ON scans
  FOR EACH ROW
  EXECUTE FUNCTION validate_scan_before_insert();
