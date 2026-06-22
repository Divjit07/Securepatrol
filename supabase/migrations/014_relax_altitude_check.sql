-- Relax altitude-based floor check: still block obvious spoofing but avoid false failures
-- when phones report noisy or missing elevation.
--
-- Rules after this migration:
-- - Horizontal distance + admin-entered map coordinates remain the primary check
-- - Altitude is only used when:
--     - The checkpoint is on floor 2 or above
--     - The checkpoint/floor has an expected elevation
--     - The phone reports guard_altitude AND good GPS accuracy (<= 30m)
--     - The vertical difference is more than 18m (roughly 5+ floors)
-- - This lets real scans on the correct floor pass even when the phone's altitude
--   is off by a few metres, while still blocking extreme cross‑floor spoofing.

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

  -- Altitude check only when:
  -- - upper floors
  -- - we know the expected elevation
  -- - phone reports altitude AND reasonably good accuracy (<= 30m)
  -- - vertical gap is huge (> ~18m, several floors)
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

