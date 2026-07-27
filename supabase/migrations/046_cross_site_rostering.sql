-- 046: Cross-site rostering. A guard can now work a shift at ANY site the admin
-- rosters them at — not only their default assigned site. This grants a guard
-- database access to a site while they have a PUBLISHED shift there (a ~18h
-- window around the shift), on top of their existing assigned-site access.
--
-- Least-privilege: access is tied to an active/near shift, so a guard cannot
-- read a site they merely had a shift at last week.
--
-- Additive RLS: these policies OR with the existing assigned-site policies, so
-- nothing already-working is changed. ensure_clock_checkpoint's authorization is
-- widened to match (its body is otherwise the migration-042 version).
--
-- ⚠️ Run AFTER 042–045 (it replaces the 042 ensure_clock_checkpoint). Paste into
-- the Supabase SQL editor — never `db push`.

-- ---- 1) Helper: does the caller have a published shift at this site now? ------
CREATE OR REPLACE FUNCTION public.guard_has_shift_at_site(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shifts s
    WHERE s.guard_id = auth.uid()
      AND s.site_id = p_site_id
      AND s.status = 'published'
      AND s.ends_at   >= now() - interval '18 hours'
      AND s.starts_at <= now() + interval '18 hours'
  );
$$;

GRANT EXECUTE ON FUNCTION public.guard_has_shift_at_site(uuid) TO authenticated;

-- ---- 2) Additive SELECT: sites / floors / checkpoints at a rostered site ------
DROP POLICY IF EXISTS "Guard reads rostered site" ON sites;
CREATE POLICY "Guard reads rostered site" ON sites
  FOR SELECT USING (get_user_role() = 'guard' AND guard_has_shift_at_site(id));

DROP POLICY IF EXISTS "Guard reads rostered site floors" ON floors;
CREATE POLICY "Guard reads rostered site floors" ON floors
  FOR SELECT USING (get_user_role() = 'guard' AND guard_has_shift_at_site(site_id));

DROP POLICY IF EXISTS "Guard reads rostered site checkpoints" ON checkpoints;
CREATE POLICY "Guard reads rostered site checkpoints" ON checkpoints
  FOR SELECT USING (
    get_user_role() = 'guard'
    AND EXISTS (
      SELECT 1 FROM floors f
      WHERE f.id = checkpoints.floor_id AND guard_has_shift_at_site(f.site_id)
    )
  );

-- ---- 3) Additive scans: read own + insert at a rostered site -----------------
-- Reading own scans is guard-id based (site-independent); this makes it explicit
-- so cross-site own-scan history always works.
DROP POLICY IF EXISTS "Guard reads own scans" ON scans;
CREATE POLICY "Guard reads own scans" ON scans
  FOR SELECT USING (guard_id = auth.uid());

DROP POLICY IF EXISTS "Guard inserts scans at rostered site" ON scans;
CREATE POLICY "Guard inserts scans at rostered site" ON scans
  FOR INSERT WITH CHECK (
    guard_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM checkpoints c
      JOIN floors f ON f.id = c.floor_id
      WHERE c.id = scans.checkpoint_id AND guard_has_shift_at_site(f.site_id)
    )
  );

-- ---- 4) Clock-checkpoint authorization widened to rostered sites -------------
-- Same body as migration 042, with the authorization check extended so a guard
-- rostered at this site (not only assigned to it) can clock in/out.
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

  IF NOT (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('admin', 'super_admin') OR p.site_id = p_site_id)
    )
    OR guard_has_shift_at_site(p_site_id)
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
