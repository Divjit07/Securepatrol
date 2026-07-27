-- 047: Let a client see the NAME of any guard rostered at their site.
--
-- The client Coverage view reads the guard name via profiles:guard_id(name),
-- but clients had no RLS read access to guard profiles — so it fell back to
-- "Unassigned" even when a guard was assigned (including cross-site guards).
--
-- This adds a scoped, additive SELECT policy: a client may read a profile row
-- only if that person has a PUBLISHED shift at the client's own site. So the
-- property owner sees who is scheduled to guard THEIR site (accountability),
-- and nothing about guards who never work there.
--
-- ⚠️ Paste into the Supabase SQL editor — never `db push`.

-- Helper: does p_guard_id have a published shift at the caller's (client's) site?
-- SECURITY DEFINER so the shift lookup isn't itself gated by RLS. auth.uid()
-- (via get_user_site_id) still resolves to the calling client.
CREATE OR REPLACE FUNCTION public.guard_rostered_at_my_site(p_guard_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shifts s
    WHERE s.guard_id = p_guard_id
      AND s.status = 'published'
      AND s.site_id = get_user_site_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.guard_rostered_at_my_site(uuid) TO authenticated;

-- Additive: OR's with existing profile policies, so nothing else changes.
DROP POLICY IF EXISTS "Client reads guards rostered at their site" ON profiles;
CREATE POLICY "Client reads guards rostered at their site" ON profiles
  FOR SELECT USING (
    get_user_role() = 'client' AND guard_rostered_at_my_site(id)
  );
