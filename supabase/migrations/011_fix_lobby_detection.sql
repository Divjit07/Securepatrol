-- Fix lobby detection: only block when guard GPS overlaps the lobby checkpoint bubble,
-- not the whole building. Allow upper floors when clearly closer to target than lobby.
-- Run in Supabase SQL Editor after 010_lobby_stack_detection.sql

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
  lobby_bubble_radius double precision;
  target_site uuid;
  altitude_ok boolean;
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
  altitude_ok := false;

  IF floor_num > 1 AND expected_alt IS NOT NULL AND NEW.guard_altitude IS NOT NULL THEN
    IF abs(NEW.guard_altitude - expected_alt) <= 10 THEN
      altitude_ok := true;
    ELSE
      NEW.status := 'fail';
      RETURN NEW;
    END IF;
  END IF;

  -- Lobby spoofing: only when guard is inside a lobby checkpoint bubble AND
  -- NOT clearly closer to the target checkpoint than to the lobby.
  IF floor_num > 1 AND NOT altitude_ok THEN
    SELECT MIN(haversine_distance(NEW.guard_lat, NEW.guard_lng, lc.latitude, lc.longitude))
    INTO min_lobby_dist
    FROM checkpoints lc
    JOIN floors lf ON lf.id = lc.floor_id
    WHERE lf.site_id = target_site
      AND lf.floor_number = 1
      AND lc.active = true;

    IF min_lobby_dist IS NOT NULL THEN
      -- Clearly at the target, not the lobby stack
      IF min_lobby_dist > dist_horiz * 1.5 THEN
        NULL;
      ELSE
        SELECT MIN(
          COALESCE(lc.radius_metres, 15)
          + CASE
              WHEN NEW.gps_accuracy IS NOT NULL THEN LEAST(NEW.gps_accuracy * 0.75, 25)
              ELSE 0
            END
        )
        INTO lobby_bubble_radius
        FROM checkpoints lc
        JOIN floors lf ON lf.id = lc.floor_id
        WHERE lf.site_id = target_site
          AND lf.floor_number = 1
          AND lc.active = true;

        IF min_lobby_dist <= COALESCE(lobby_bubble_radius, 15)
           AND dist_horiz <= effective_radius
           AND min_lobby_dist <= dist_horiz + 5 THEN
          NEW.status := 'fail';
          RETURN NEW;
        END IF;
      END IF;
    END IF;
  END IF;

  NEW.status := 'pass';
  RETURN NEW;
END;
$$;
