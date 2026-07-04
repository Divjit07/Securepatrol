-- Let clients read guard incident reports (and photos) for their assigned site.

DROP POLICY IF EXISTS "Read incident reports for accessible sites" ON incident_reports;

CREATE POLICY "Read incident reports for accessible sites"
  ON incident_reports FOR SELECT
  USING (
    guard_id = auth.uid()
    OR get_user_role() = 'super_admin'
    OR user_owns_site(site_id)
    OR (get_user_role() = 'client' AND site_id = get_user_site_id())
  );

CREATE POLICY "Clients read site incident photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'incident-photos'
    AND get_user_role() = 'client'
    AND EXISTS (
      SELECT 1
      FROM profiles g
      WHERE g.id::text = (storage.foldername(name))[1]
        AND g.role = 'guard'
        AND g.site_id = get_user_site_id()
    )
  );
