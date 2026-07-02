-- Shift clock-in/out checkpoint roles and client guard-hours reporting.

ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS checkpoint_role TEXT NOT NULL DEFAULT 'patrol';

ALTER TABLE checkpoints DROP CONSTRAINT IF EXISTS checkpoints_checkpoint_role_check;
ALTER TABLE checkpoints ADD CONSTRAINT checkpoints_checkpoint_role_check
  CHECK (checkpoint_role IN ('patrol', 'shift_clock_in', 'shift_clock_out'));

-- Main Entrance is the default shift clock-in tag at existing sites.
UPDATE checkpoints
SET checkpoint_role = 'shift_clock_in'
WHERE checkpoint_role = 'patrol'
  AND name ILIKE '%main entrance%';

COMMENT ON COLUMN checkpoints.checkpoint_role IS
  'patrol = normal checkpoint; shift_clock_in = starts shift timer; shift_clock_out = optional explicit end tag';
