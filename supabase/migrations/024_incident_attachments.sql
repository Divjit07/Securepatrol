-- Multiple incident attachments (photos, PDF, DOCX).

ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN incident_reports.attachments IS
  'Array of { path, name, kind: image|document, mime_type }';

-- Backfill legacy single-photo reports.
UPDATE incident_reports
SET attachments = jsonb_build_array(
  jsonb_build_object(
    'path', photo_path,
    'name', split_part(photo_path, '/', 2),
    'kind', 'image',
    'mime_type', 'image/jpeg'
  )
)
WHERE photo_path IS NOT NULL
  AND photo_path <> ''
  AND (attachments IS NULL OR attachments = '[]'::jsonb);

UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
WHERE id = 'incident-photos';

-- Client photo access: any attachment path on their site.
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
