-- Allow admins to update client profiles on sites they own (assign site, activate/deactivate).

DROP POLICY IF EXISTS "Admins can update guard profiles" ON profiles;
CREATE POLICY "Admins can update guard and client profiles"
  ON profiles FOR UPDATE
  USING (
    get_user_role() = 'super_admin'
    OR (
      get_user_role() = 'admin'
      AND (
        EXISTS (
          SELECT 1 FROM guards g
          JOIN sites s ON s.id = g.site_id
          WHERE g.id = profiles.id AND s.admin_id = auth.uid()
        )
        OR (
          profiles.role = 'client'
          AND profiles.site_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM sites s
            WHERE s.id = profiles.site_id AND s.admin_id = auth.uid()
          )
        )
      )
    )
  );
