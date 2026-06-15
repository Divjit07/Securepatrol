-- Block upper-floor scans from the lobby/ground-floor GPS zone.
-- Indoor phones share the same lat/lng across floors — detect lobby proximity instead.
-- Run in Supabase SQL Editor after 009_upper_floor_altitude_fix.sql

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
  min_lobby_dist double precision;
  target_site uuid;
BEGIN
  IF NEW.guard_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot submit scan for another guard';
  END IF;

  SELECT c.latitude, c.longitude, c.radius_metres, c.altitude_metres,
         f.floor_number, f.elevation_metres, f.site_id
  INTO cp_lat, cp_lng, cp_radius, cp_alt, floor_num, floor_elev, target_site
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

  -- Wrong floor when altitude is available
  IF floor_num > 1 AND expected_alt IS NOT NULL AND NEW.guard_altitude IS NOT NULL THEN
    IF abs(NEW.guard_altitude - expected_alt) > 10 THEN
      NEW.status := 'fail';
      RETURN NEW;
    END IF;
  END IF;

  -- Lobby stack detection: upper-floor scan while GPS matches ground-floor zone
  IF floor_num > 1 THEN
    SELECT MIN(haversine_distance(NEW.guard_lat, NEW.guard_lng, lc.latitude, lc.longitude))
    INTO min_lobby_dist
    FROM checkpoints lc
    JOIN floors lf ON lf.id = lc.floor_id
    WHERE lf.site_id = target_site
      AND lf.floor_number = 1
      AND lc.active = true;

    IF min_lobby_dist IS NOT NULL
       AND min_lobby_dist <= 25
       AND dist_horiz <= effective_radius THEN
      IF NEW.guard_altitude IS NULL
         OR abs(NEW.guard_altitude - expected_alt) > 10 THEN
        NEW.status := 'fail';
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  NEW.status := 'pass';
  RETURN NEW;
END;
$$;
