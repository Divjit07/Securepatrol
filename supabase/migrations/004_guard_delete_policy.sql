-- Allow admins to delete guard profiles (fallback when Edge Function not deployed)
DROP POLICY IF EXISTS "Admins can delete guard profiles" ON profiles;
CREATE POLICY "Admins can delete guard profiles"
  ON profiles FOR DELETE
  USING (
    get_user_role() = 'super_admin'
    OR (
      get_user_role() = 'admin'
      AND role = 'guard'
      AND (
        site_id IS NULL
        OR EXISTS (
          SELECT 1 FROM sites s
          WHERE s.id = profiles.site_id AND s.admin_id = auth.uid()
        )
      )
    )
  );
