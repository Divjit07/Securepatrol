-- Guard-submitted site incident reports (emailed to admin via Edge Function).

CREATE TABLE IF NOT EXISTS incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  guard_lat DOUBLE PRECISION,
  guard_lng DOUBLE PRECISION,
  photo_path TEXT,
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_site_created
  ON incident_reports(site_id, created_at DESC);

ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guards insert own incident reports"
  ON incident_reports FOR INSERT
  WITH CHECK (
    guard_id = auth.uid()
    AND site_id = get_user_site_id()
    AND get_user_role() = 'guard'
  );

CREATE POLICY "Read incident reports for accessible sites"
  ON incident_reports FOR SELECT
  USING (
    guard_id = auth.uid()
    OR get_user_role() = 'super_admin'
    OR user_owns_site(site_id)
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-photos',
  'incident-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Guards upload own incident photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'incident-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Guards read own incident photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'incident-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR get_user_role() IN ('admin', 'super_admin')
    )
  );
