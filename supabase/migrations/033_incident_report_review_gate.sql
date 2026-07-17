-- Incident report review gate: the admin UI has always promised "admins can
-- edit or remove reports before clients see mistakes," but nothing enforced
-- it — clients could read a guard's raw report the instant it was inserted.
-- Reports now carry review state, and the client SELECT policy only exposes
-- reviewed rows. Admin/guard visibility is unchanged.

ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN incident_reports.reviewed_at IS
  'Set when an admin approves the report for client visibility. NULL = pending review, hidden from clients.';

-- Existing reports were already client-visible — grandfather them in rather
-- than yanking them from client portals mid-flight.
UPDATE incident_reports SET reviewed_at = created_at WHERE reviewed_at IS NULL;

DROP POLICY IF EXISTS "Read incident reports for accessible sites" ON incident_reports;

CREATE POLICY "Read incident reports for accessible sites"
  ON incident_reports FOR SELECT
  USING (
    guard_id = auth.uid()
    OR get_user_role() = 'super_admin'
    OR user_owns_site(site_id)
    OR (
      get_user_role() = 'client'
      AND site_id = get_user_site_id()
      AND reviewed_at IS NOT NULL
    )
  );

-- Admins mark reports reviewed (site-scoped; super_admin everywhere).
DROP POLICY IF EXISTS "Admins review incident reports" ON incident_reports;
CREATE POLICY "Admins review incident reports"
  ON incident_reports FOR UPDATE
  USING (get_user_role() = 'super_admin' OR user_owns_site(site_id))
  WITH CHECK (get_user_role() = 'super_admin' OR user_owns_site(site_id));

-- Client photo access follows the same gate: only attachments belonging to a
-- REVIEWED report. Same structure as 024's policy plus the reviewed_at check.
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
      WHERE ir.site_id = get_user_site_id()
        AND ir.reviewed_at IS NOT NULL
        AND (
          ir.photo_path = name
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(ir.attachments, '[]'::jsonb)) AS att(value)
            WHERE att.value->>'path' = name
          )
        )
    )
  );
