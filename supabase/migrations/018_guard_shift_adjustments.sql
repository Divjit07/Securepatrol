-- Manual guard shift clock-in/out overrides (editable by designated admin only).

CREATE TABLE IF NOT EXISTS guard_shift_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  guard_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  adjusted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guard_id, shift_date)
);

CREATE INDEX IF NOT EXISTS idx_guard_shift_adj_site_date
  ON guard_shift_adjustments(site_id, shift_date);

ALTER TABLE guard_shift_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read shift adjustments for accessible sites"
  ON guard_shift_adjustments FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR user_owns_site(site_id)
    OR (get_user_role() = 'client' AND site_id = get_user_site_id())
  );

CREATE OR REPLACE FUNCTION public.upsert_guard_shift_adjustment(
  p_site_id UUID,
  p_guard_id UUID,
  p_shift_date DATE,
  p_clock_in TIMESTAMPTZ,
  p_clock_out TIMESTAMPTZ,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT is_scan_approver(auth.uid()) THEN
    RAISE EXCEPTION 'Only the designated admin can edit shift times';
  END IF;

  IF p_clock_out <= p_clock_in THEN
    RAISE EXCEPTION 'Clock-out must be after clock-in';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_guard_id
      AND p.role = 'guard'
      AND p.site_id = p_site_id
      AND p.active = true
  ) THEN
    RAISE EXCEPTION 'Guard is not assigned to this site';
  END IF;

  INSERT INTO guard_shift_adjustments (
    site_id,
    guard_id,
    shift_date,
    clock_in_at,
    clock_out_at,
    note,
    adjusted_by,
    updated_at
  ) VALUES (
    p_site_id,
    p_guard_id,
    p_shift_date,
    p_clock_in,
    p_clock_out,
    NULLIF(trim(p_note), ''),
    auth.uid(),
    now()
  )
  ON CONFLICT (guard_id, shift_date) DO UPDATE SET
    site_id = EXCLUDED.site_id,
    clock_in_at = EXCLUDED.clock_in_at,
    clock_out_at = EXCLUDED.clock_out_at,
    note = EXCLUDED.note,
    adjusted_by = EXCLUDED.adjusted_by,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_guard_shift_adjustment(
  p_guard_id UUID,
  p_shift_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_scan_approver(auth.uid()) THEN
    RAISE EXCEPTION 'Only the designated admin can edit shift times';
  END IF;

  DELETE FROM guard_shift_adjustments
  WHERE guard_id = p_guard_id
    AND shift_date = p_shift_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_guard_shift_adjustment(UUID, UUID, DATE, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_guard_shift_adjustment(UUID, DATE) TO authenticated;
