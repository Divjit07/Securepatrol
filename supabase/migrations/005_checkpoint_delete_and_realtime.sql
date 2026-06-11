-- Allow checkpoint/floor deletion when scan history exists.
-- Scan DELETE was blocked by trigger + missing RLS policy, causing checkpoint DELETE to fail silently.

DROP TRIGGER IF EXISTS block_scan_delete ON scans;

DROP POLICY IF EXISTS "Admins delete scans for owned sites" ON scans;
CREATE POLICY "Admins delete scans for owned sites"
  ON scans FOR DELETE
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM checkpoints c
      JOIN floors f ON f.id = c.floor_id
      WHERE c.id = scans.checkpoint_id
      AND user_owns_site(f.site_id)
    )
  );

-- Enable PostgREST joins for guard names on scans (profiles.id = guard auth user id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scans_guard_id_profiles_fkey'
  ) THEN
    ALTER TABLE scans
      ADD CONSTRAINT scans_guard_id_profiles_fkey
      FOREIGN KEY (guard_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
