-- Fix upper-floor scans: altitude check only when phone actually reports it.
-- iPhones indoors often return NULL altitude — don't hard-fail those scans.
-- Run in Supabase SQL Editor after 008_gps_indoor_tolerance.sql

UPDATE checkpoints SET radius_metres = 15 WHERE radius_metres < 15;

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
  base_radius double precision;
  effective_radius double precision;
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

  base_radius := COALESCE(cp_radius, 15);
  effective_radius := base_radius;
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

  -- Only enforce altitude when the phone actually reports it.
  -- NULL altitude is common indoors on iPhone — allow pass on horizontal check.
  IF floor_num > 1 AND expected_alt IS NOT NULL AND NEW.guard_altitude IS NOT NULL THEN
    IF abs(NEW.guard_altitude - expected_alt) > 10 THEN
      NEW.status := 'fail';
      RETURN NEW;
    END IF;
  END IF;

  NEW.status := 'pass';
  RETURN NEW;
END;
$$;
