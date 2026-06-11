-- Client role: read-only site patrol visibility for property owners / clients.
-- Clients are linked to a site via profiles.site_id (same as guards).

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'guard', 'client'));

-- Clients can read their assigned site
DROP POLICY IF EXISTS "Guard sees assigned site" ON sites;
CREATE POLICY "Guard or client sees assigned site"
  ON sites FOR SELECT USING (
    id = get_user_site_id() AND get_user_role() IN ('guard', 'client')
  );

-- Clients can read guards at their site (to see who scanned)
DROP POLICY IF EXISTS "Admins read guards for their sites" ON guards;
CREATE POLICY "Read guards for accessible sites"
  ON guards FOR SELECT USING (
    get_user_role() = 'super_admin'
    OR user_owns_site(site_id)
    OR id = auth.uid()
    OR (get_user_role() = 'client' AND site_id = get_user_site_id())
  );

-- Floors, checkpoints, and scans already allow get_user_site_id() reads.
