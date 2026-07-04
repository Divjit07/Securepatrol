-- Fix client photo access: previous policy queried profiles (blocked by RLS).
-- Tie photo access directly to incident_reports the client can already read.

DROP POLICY IF EXISTS "Clients read site incident photos" ON storage.objects;

CREATE POLICY "Clients read site incident photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'incident-photos'
    AND get_user_role() = 'client'
    AND EXISTS (
      SELECT 1
      FROM incident_reports ir
      WHERE ir.photo_path = name
        AND ir.site_id = get_user_site_id()
    )
  );
