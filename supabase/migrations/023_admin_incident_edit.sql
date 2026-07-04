-- Divjit (and super admin) can edit or remove guard incident reports before clients see them.

CREATE OR REPLACE FUNCTION public.is_incident_editor(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.id = user_id
      AND p.role IN ('admin', 'super_admin')
      AND p.active = true
      AND (
        p.role = 'super_admin'
        OR lower(u.email) = 'divjit007@gmail.com'
        OR p.name ILIKE 'divjit%'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_incident_editor(uuid) TO authenticated;

CREATE POLICY "Incident editors update reports"
  ON incident_reports FOR UPDATE
  USING (
    get_user_role() = 'super_admin'
    OR (is_incident_editor(auth.uid()) AND user_owns_site(site_id))
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR (is_incident_editor(auth.uid()) AND user_owns_site(site_id))
  );

CREATE POLICY "Incident editors delete reports"
  ON incident_reports FOR DELETE
  USING (
    get_user_role() = 'super_admin'
    OR (is_incident_editor(auth.uid()) AND user_owns_site(site_id))
  );

CREATE POLICY "Incident editors delete photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'incident-photos'
    AND (
      get_user_role() = 'super_admin'
      OR is_incident_editor(auth.uid())
    )
  );
