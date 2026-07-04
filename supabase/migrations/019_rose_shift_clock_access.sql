-- Shift Clock access (separate from scan approval).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_manage_shift_clock BOOLEAN NOT NULL DEFAULT false;

-- Divjit (scan approver) can also manage shift clock
UPDATE profiles p
SET can_manage_shift_clock = true
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'divjit007@gmail.com'
  AND p.role IN ('admin', 'super_admin')
  AND p.active = true;

UPDATE profiles
SET can_manage_shift_clock = true
WHERE role IN ('admin', 'super_admin')
  AND active = true
  AND name ILIKE 'divjit%'
  AND can_manage_shift_clock = false;

-- Rose: shift clock only (not scan approval)
UPDATE profiles p
SET can_manage_shift_clock = true,
    can_approve_scans = false
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'rose@prodsec.ca'
  AND p.role IN ('admin', 'super_admin')
  AND p.active = true;

CREATE OR REPLACE FUNCTION public.is_shift_clock_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = user_id
      AND p.can_manage_shift_clock = true
      AND p.role IN ('admin', 'super_admin')
      AND p.active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.check_shift_clock_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT is_shift_clock_admin(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_shift_clock_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_shift_clock_admin() TO authenticated;

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
  IF NOT is_shift_clock_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only designated admins can edit shift times';
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
  IF NOT is_shift_clock_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only designated admins can edit shift times';
  END IF;

  DELETE FROM guard_shift_adjustments
  WHERE guard_id = p_guard_id
    AND shift_date = p_shift_date;
END;
$$;
