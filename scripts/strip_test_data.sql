-- ⚠️ DESTRUCTIVE — wipes all operational/test data for a clean pre-launch start.
-- Run in the Supabase SQL editor. Review before running; there is no undo.
--
-- KEEPS your structure & config: sites, floors, checkpoints, guards, profiles,
-- office_locations, guard_pay_rates, shift_templates, shift_recurrences.
--
-- DELETES the operational rows (punches, shifts, adjustments, alerts, etc.) so
-- payroll/roster/patrol start empty on the new roster-only model.
--
-- Incident reports are NOT deleted by default (they may have storage files and
-- real content). Uncomment the incident block at the bottom if you want them gone
-- too — and note the photo files in Storage must be cleared separately.

BEGIN;

-- Rows that reference shifts/guards go first (FK-safe order).
DELETE FROM timesheet_approvals;
DELETE FROM alert_events;
DELETE FROM checkpoint_misses;
DELETE FROM office_clock_events;
DELETE FROM guard_shift_adjustments;

-- Raw punches + patrol scans (this is what payroll/patrol history read).
DELETE FROM scans;

-- Roster shifts + publish records.
DELETE FROM schedule_publications;
DELETE FROM shifts;

COMMIT;

-- Optional: also clear incident reports (their attachments in Storage stay until
-- you delete them there). Uncomment to run.
-- BEGIN;
--   DELETE FROM incident_report_attachments;
--   DELETE FROM incident_reports;
-- COMMIT;

-- Sanity check after running:
-- SELECT
--   (SELECT count(*) FROM scans)                  AS scans,
--   (SELECT count(*) FROM shifts)                 AS shifts,
--   (SELECT count(*) FROM guard_shift_adjustments) AS adjustments,
--   (SELECT count(*) FROM alert_events)           AS alerts;
