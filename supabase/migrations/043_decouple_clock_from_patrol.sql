-- 043: Decouple clock-in/out from patrol checkpoints.
--
-- Background: migration 017 designated the "Main Entrance" checkpoint as the
-- shift_clock_in tag (old model: "scan Main Entrance to clock in"). The current
-- model is different — guards clock IN/OUT by geofenced GPS (primary) with a
-- DEDICATED clock NFC tag as fallback, and patrol checkpoints (Main Entrance,
-- etc.) are for patrol verification ONLY. So scanning Main Entrance should no
-- longer register as a clock-in.
--
-- This demotes any entrance-named checkpoint that's still tagged as a clock-in
-- back to a plain patrol checkpoint. The dedicated auto-created clock checkpoints
-- (named "Clock In" / "Clock Out", made by ensure_clock_checkpoint on first GPS
-- clock-in) are NOT touched.
--
-- ⚠️ Payroll note: shift derivation reads a checkpoint's CURRENT role for all
-- its past scans, so any historical day whose clock-in was a Main Entrance scan
-- will re-derive from GPS/clock-checkpoint punches instead. On a fresh/near-empty
-- setup this is a no-op in practice. Raw scan rows are never modified.
--
-- ⚠️ Paste into the Supabase SQL editor — never `db push`.

UPDATE checkpoints
SET checkpoint_role = 'patrol'
WHERE checkpoint_role = 'shift_clock_in'
  AND name ILIKE '%entrance%';

-- Show what changed (run the SELECT after to confirm none are left mis-tagged).
-- SELECT id, name, checkpoint_role FROM checkpoints WHERE name ILIKE '%entrance%';
