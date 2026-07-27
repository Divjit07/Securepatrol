-- 044: Make checkpoint GPS coordinates OPTIONAL.
--
-- Patrol checkpoints are now verified by the bound NFC tag's serial (UID)
-- from migration 035 — the tap itself proves presence. GPS coordinates are only
-- needed if you also want a QR/GPS geofence on that checkpoint. So a checkpoint
-- can be created with just a name + NFC tag, no coordinates.
--
-- These ALTERs are safe to run even if the columns are already nullable
-- (DROP NOT NULL on an already-nullable column is a no-op, not an error).
--
-- ⚠️ Paste into the Supabase SQL editor — never `db push`.

ALTER TABLE checkpoints ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE checkpoints ALTER COLUMN longitude DROP NOT NULL;
