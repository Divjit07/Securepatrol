-- Let designated admins approve scans via a profile flag (not only one hard-coded email).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_approve_scans BOOLEAN NOT NULL DEFAULT false;

-- divjit007@gmail.com (if that login exists)
UPDATE profiles p
SET can_approve_scans = true
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'divjit007@gmail.com'
  AND p.role IN ('admin', 'super_admin')
  AND p.active = true;

-- Bootstrap: active admin accounts named Divjit (e.g. Divjit Singh)
UPDATE profiles
SET can_approve_scans = true
WHERE role IN ('admin', 'super_admin')
  AND active = true
  AND name ILIKE 'divjit%'
  AND can_approve_scans = false;

CREATE OR REPLACE FUNCTION public.is_scan_approver(user_id uuid)
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
      AND p.can_approve_scans = true
      AND p.role IN ('admin', 'super_admin')
      AND p.active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.check_scan_approver()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT is_scan_approver(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.check_scan_approver() TO authenticated;
