-- Roster: guard shift scheduling with draft→publish workflow, recurrence
-- grouping, open-shift claiming, and publication audit log.

-- Recurrence rules group materialized shift rows so "edit series" is possible.
CREATE TABLE IF NOT EXISTS shift_recurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_minutes INT NOT NULL CHECK (start_minutes BETWEEN 0 AND 1439),
  duration_minutes INT NOT NULL CHECK (duration_minutes BETWEEN 30 AND 1440),
  break_minutes INT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  -- NULL guard_id = open shift, claimable by eligible guards once published.
  guard_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  break_minutes INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
  notes TEXT,
  color TEXT NOT NULL DEFAULT 'blue',
  recurrence_id UUID REFERENCES shift_recurrences(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shifts_time_valid CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_shifts_site_start ON shifts(site_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_shifts_guard_start ON shifts(guard_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_shifts_open
  ON shifts(site_id, starts_at) WHERE guard_id IS NULL AND status = 'published';

CREATE TABLE IF NOT EXISTS schedule_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  range_start DATE NOT NULL,
  range_end DATE NOT NULL,
  shift_count INT NOT NULL DEFAULT 0,
  emails_sent INT NOT NULL DEFAULT 0,
  email_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION set_shifts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shifts_updated_at ON shifts;
CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION set_shifts_updated_at();

-- Row level security -------------------------------------------------------

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage shifts"
  ON shifts FOR ALL
  USING (get_user_role() = 'super_admin' OR user_owns_site(site_id))
  WITH CHECK (get_user_role() = 'super_admin' OR user_owns_site(site_id));

-- Guards see their own published shifts plus open published shifts at their
-- site; clients see all published shifts at their site (coverage view).
CREATE POLICY "Guards and clients read published shifts"
  ON shifts FOR SELECT
  USING (
    status = 'published'
    AND (
      guard_id = auth.uid()
      OR (
        site_id = get_user_site_id()
        AND (
          (get_user_role() = 'guard' AND guard_id IS NULL)
          OR get_user_role() = 'client'
        )
      )
    )
  );

CREATE POLICY "Admins manage shift templates"
  ON shift_templates FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR site_id IS NULL AND get_user_role() = 'admin'
    OR user_owns_site(site_id)
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR site_id IS NULL AND get_user_role() = 'admin'
    OR user_owns_site(site_id)
  );

CREATE POLICY "Admins manage shift recurrences"
  ON shift_recurrences FOR ALL
  USING (get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (get_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "Admins manage schedule publications"
  ON schedule_publications FOR ALL
  USING (get_user_role() = 'super_admin' OR user_owns_site(site_id))
  WITH CHECK (get_user_role() = 'super_admin' OR user_owns_site(site_id));

-- Guard actions (SECURITY DEFINER so RLS update rules stay admin-only) ------

-- Atomic claim: the WHERE guard_id IS NULL guarantees exactly one winner.
CREATE OR REPLACE FUNCTION claim_open_shift(p_shift_id UUID)
RETURNS SETOF shifts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_shift shifts;
BEGIN
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found';
  END IF;
  IF get_user_role() <> 'guard' THEN
    RAISE EXCEPTION 'Only guards can claim shifts';
  END IF;
  IF v_shift.site_id <> get_user_site_id() THEN
    RAISE EXCEPTION 'This shift is not at your site';
  END IF;
  IF EXISTS (
    SELECT 1 FROM shifts s
    WHERE s.guard_id = auth.uid()
      AND s.status = 'published'
      AND s.id <> p_shift_id
      AND tstzrange(s.starts_at, s.ends_at) && tstzrange(v_shift.starts_at, v_shift.ends_at)
  ) THEN
    RAISE EXCEPTION 'You already have a shift overlapping this time';
  END IF;

  RETURN QUERY
  UPDATE shifts
  SET guard_id = auth.uid(), claimed_at = now(), acknowledged_at = now()
  WHERE id = p_shift_id AND guard_id IS NULL AND status = 'published'
  RETURNING *;
END $$;

CREATE OR REPLACE FUNCTION acknowledge_shift(p_shift_id UUID)
RETURNS SETOF shifts
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE shifts
  SET acknowledged_at = now()
  WHERE id = p_shift_id AND guard_id = auth.uid() AND status = 'published'
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION claim_open_shift(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION acknowledge_shift(UUID) TO authenticated;

COMMENT ON TABLE shifts IS
  'Roster shifts. guard_id NULL = open shift. Draft shifts are invisible to guards/clients until published.';
