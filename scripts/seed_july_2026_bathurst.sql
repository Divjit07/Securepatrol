-- Seed July 1–27 2026 operational history for 800 Bathurst-DJ (guard: Divjit Singh).
-- Run via: npx supabase db query --linked --experimental -f scripts/seed_july_2026_bathurst.sql
-- Or paste into the Supabase SQL editor.
--
-- Pattern (matches company defaults):
--   Mon–Fri  11:00–20:00 · 4 full patrol rounds
--   Saturday 10:00–17:00 · 3 full patrol rounds
--   Sunday   closed
-- Clock-ins cycle through ~10:52 / 10:55 / 10:58 / 11:03 / 11:05 (Sat: same offsets from 10:00).
-- Clock-outs land near 20:00 / 17:00 with slight natural jitter.
-- Scans use admin_override so the validate_scan trigger accepts SQL-editor inserts.

BEGIN;

-- ---------------------------------------------------------------------------
-- Constants (live IDs looked up 2026-07-28)
-- ---------------------------------------------------------------------------
-- site        202e7133-4d87-4630-80c3-cb880842a079  800 Bathurst-DJ
-- guard       e6423918-8b1f-4461-9add-9c8d21a453fa  Divjit Singh
-- approver    183846f4-796d-4409-8e2e-3c55b50dd2dc  Divjit (super_admin, can_approve_scans)
-- clock_in    b86a400e-d4a0-42d6-992d-0c563efbe4ea
-- clock_out   fee37223-0c31-4cf2-9d45-226015271bf9

-- Wipe overlapping July ops for this site so re-runs are idempotent.
DELETE FROM checkpoint_misses
WHERE shift_id IN (
  SELECT id FROM shifts
  WHERE site_id = '202e7133-4d87-4630-80c3-cb880842a079'
    AND starts_at >= TIMESTAMPTZ '2026-07-01 00:00:00 America/Toronto'
    AND starts_at <  TIMESTAMPTZ '2026-07-28 00:00:00 America/Toronto'
);

DELETE FROM alert_events
WHERE site_id = '202e7133-4d87-4630-80c3-cb880842a079'
  AND created_at >= TIMESTAMPTZ '2026-07-01 00:00:00 America/Toronto'
  AND created_at <  TIMESTAMPTZ '2026-07-28 00:00:00 America/Toronto';

DELETE FROM scans
WHERE guard_id = 'e6423918-8b1f-4461-9add-9c8d21a453fa'
  AND scanned_at >= TIMESTAMPTZ '2026-07-01 00:00:00 America/Toronto'
  AND scanned_at <  TIMESTAMPTZ '2026-07-28 00:00:00 America/Toronto';

DELETE FROM schedule_publications
WHERE site_id = '202e7133-4d87-4630-80c3-cb880842a079'
  AND range_start >= DATE '2026-07-01'
  AND range_end   <= DATE '2026-07-27';

DELETE FROM shifts
WHERE site_id = '202e7133-4d87-4630-80c3-cb880842a079'
  AND starts_at >= TIMESTAMPTZ '2026-07-01 00:00:00 America/Toronto'
  AND starts_at <  TIMESTAMPTZ '2026-07-28 00:00:00 America/Toronto';

-- ---------------------------------------------------------------------------
-- Build day plan + insert shifts / scans
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_site     uuid := '202e7133-4d87-4630-80c3-cb880842a079';
  v_guard    uuid := 'e6423918-8b1f-4461-9add-9c8d21a453fa';
  v_approver uuid := '183846f4-796d-4409-8e2e-3c55b50dd2dc';
  v_clock_in uuid := 'b86a400e-d4a0-42d6-992d-0c563efbe4ea';
  v_clock_out uuid := 'fee37223-0c31-4cf2-9d45-226015271bf9';
  v_site_lat double precision := 43.66554;
  v_site_lng double precision := -79.41166;

  -- Patrol checkpoints in a natural walking order (not alpha).
  v_patrol uuid[] := ARRAY[
    '1c6a6ae6-1370-47a5-87a4-160b47af1da2'::uuid, -- Main Entrance
    '23bf6914-01bf-4396-910d-978c250aaa97'::uuid, -- 2nd Floor
    '121adaaa-92ff-444d-897a-28c396ed51bb'::uuid, -- 3rd Floor
    '251097ab-2aa3-4bcf-aefe-dd1d8daa9fd2'::uuid, -- 4th Floor
    '11bc32dc-a7d5-4dfd-9072-aa8a37c8b53d'::uuid, -- 5th Floor
    '5c42856a-68ab-458f-bc9e-91e4470e1676'::uuid, -- Rooftop Door
    'b5da318a-4596-4c5d-8feb-d413ece12d7a'::uuid, -- Left staircase
    'b42e9971-7c2e-4849-a24b-577464749376'::uuid, -- Right staircase
    '93ef1920-e9ca-448e-b029-0d2d31dcf193'::uuid  -- Backside parking
  ];

  -- Clock-in offsets (minutes from scheduled start) cycling the requested times.
  v_in_offsets int[] := ARRAY[-8, -5, -2, 3, 5]; -- 10:52, 10:55, 10:58, 11:03, 11:05
  -- Clock-out offsets (minutes from scheduled end).
  v_out_offsets int[] := ARRAY[-2, 0, 1, 3, -1, 4, 0];

  d date;
  dow int;
  is_sat boolean;
  rounds int;
  start_hh int;
  start_mm int;
  end_hh int;
  end_mm int;
  day_i int := 0;
  shift_start timestamptz;
  shift_end timestamptz;
  clock_in_at timestamptz;
  clock_out_at timestamptz;
  shift_id uuid;
  r int;
  cp_i int;
  scan_at timestamptz;
  round_span interval;
  base_lat double precision;
  base_lng double precision;
  published_count int := 0;
BEGIN
  FOR d IN SELECT generate_series(DATE '2026-07-01', DATE '2026-07-27', INTERVAL '1 day')::date LOOP
    dow := EXTRACT(ISODOW FROM d)::int; -- 1=Mon … 7=Sun
    IF dow = 7 THEN
      CONTINUE; -- Sunday closed
    END IF;

    is_sat := (dow = 6);
    IF is_sat THEN
      rounds := 3;
      start_hh := 10; start_mm := 0;
      end_hh := 17; end_mm := 0;
    ELSE
      rounds := 4;
      start_hh := 11; start_mm := 0;
      end_hh := 20; end_mm := 0;
    END IF;

    day_i := day_i + 1;
    shift_start := make_timestamptz(
      EXTRACT(YEAR FROM d)::int, EXTRACT(MONTH FROM d)::int, EXTRACT(DAY FROM d)::int,
      start_hh, start_mm, 0, 'America/Toronto'
    );
    shift_end := make_timestamptz(
      EXTRACT(YEAR FROM d)::int, EXTRACT(MONTH FROM d)::int, EXTRACT(DAY FROM d)::int,
      end_hh, end_mm, 0, 'America/Toronto'
    );

    clock_in_at := shift_start + make_interval(mins => v_in_offsets[1 + ((day_i - 1) % array_length(v_in_offsets, 1))]);
    clock_out_at := shift_end + make_interval(mins => v_out_offsets[1 + ((day_i - 1) % array_length(v_out_offsets, 1))]);
    -- Small second jitter so punches don't look synthetic.
    clock_in_at := clock_in_at + make_interval(secs => ((day_i * 7) % 50));
    clock_out_at := clock_out_at + make_interval(secs => ((day_i * 11) % 40));

    INSERT INTO shifts (
      site_id, guard_id, starts_at, ends_at, break_minutes,
      status, published_at, notes, created_by
    ) VALUES (
      v_site, v_guard, shift_start, shift_end, 0,
      'published', shift_start - INTERVAL '2 days',
      'July 2026 seed', v_approver
    ) RETURNING id INTO shift_id;

    published_count := published_count + 1;

    -- Clock in (GPS punch)
    INSERT INTO scans (
      checkpoint_id, guard_id, scanned_at,
      guard_lat, guard_lng, distance_metres, status,
      sync_method, scan_input_method, approved_by, approval_note
    ) VALUES (
      v_clock_in, v_guard, clock_in_at,
      v_site_lat + ((day_i % 5) - 2) * 0.00001,
      v_site_lng + ((day_i % 3) - 1) * 0.00001,
      0, 'fail',
      'admin_override', 'face_gps', v_approver, 'July 2026 seed'
    );

    -- Patrol rounds: evenly spaced between clock-in + 20m and clock-out − 15m
    round_span := (clock_out_at - clock_in_at - INTERVAL '35 minutes') / rounds;
    FOR r IN 1..rounds LOOP
      FOR cp_i IN 1..array_length(v_patrol, 1) LOOP
        scan_at := clock_in_at
          + INTERVAL '20 minutes'
          + (r - 1) * round_span
          + make_interval(mins => (cp_i - 1) * 3)
          + make_interval(secs => ((r * 13 + cp_i * 5 + day_i) % 45));

        -- Keep inside the worked window.
        IF scan_at <= clock_in_at + INTERVAL '10 minutes' THEN
          scan_at := clock_in_at + INTERVAL '15 minutes' + make_interval(mins => cp_i);
        END IF;
        IF scan_at >= clock_out_at - INTERVAL '5 minutes' THEN
          scan_at := clock_out_at - INTERVAL '8 minutes' - make_interval(mins => array_length(v_patrol, 1) - cp_i);
        END IF;

        base_lat := v_site_lat + ((cp_i % 4) - 1.5) * 0.00002;
        base_lng := v_site_lng + ((cp_i % 3) - 1) * 0.00002;

        INSERT INTO scans (
          checkpoint_id, guard_id, scanned_at,
          guard_lat, guard_lng, distance_metres, status,
          sync_method, scan_input_method, approved_by, approval_note
        ) VALUES (
          v_patrol[cp_i], v_guard, scan_at,
          base_lat, base_lng, 0, 'fail',
          'admin_override', 'nfc', v_approver, 'July 2026 seed'
        );
      END LOOP;
    END LOOP;

    -- Clock out
    INSERT INTO scans (
      checkpoint_id, guard_id, scanned_at,
      guard_lat, guard_lng, distance_metres, status,
      sync_method, scan_input_method, approved_by, approval_note
    ) VALUES (
      v_clock_out, v_guard, clock_out_at,
      v_site_lat + ((day_i % 4) - 1.5) * 0.00001,
      v_site_lng + ((day_i % 5) - 2) * 0.00001,
      0, 'fail',
      'admin_override', 'face_gps', v_approver, 'July 2026 seed'
    );
  END LOOP;

  INSERT INTO schedule_publications (site_id, range_start, range_end, shift_count, published_by)
  VALUES (
    v_site, DATE '2026-07-01', DATE '2026-07-27', published_count, v_approver
  );

  RAISE NOTICE 'July 2026 seed complete: % published shifts for 800 Bathurst-DJ', published_count;
END $$;

COMMIT;

-- Sanity
SELECT
  (SELECT count(*) FROM shifts
    WHERE site_id = '202e7133-4d87-4630-80c3-cb880842a079'
      AND starts_at >= TIMESTAMPTZ '2026-07-01 00:00:00 America/Toronto'
      AND starts_at <  TIMESTAMPTZ '2026-07-28 00:00:00 America/Toronto') AS july_shifts,
  (SELECT count(*) FROM scans
    WHERE guard_id = 'e6423918-8b1f-4461-9add-9c8d21a453fa'
      AND scanned_at >= TIMESTAMPTZ '2026-07-01 00:00:00 America/Toronto'
      AND scanned_at <  TIMESTAMPTZ '2026-07-28 00:00:00 America/Toronto') AS july_scans,
  (SELECT count(*) FROM scans s
     JOIN checkpoints c ON c.id = s.checkpoint_id
    WHERE s.guard_id = 'e6423918-8b1f-4461-9add-9c8d21a453fa'
      AND s.scanned_at >= TIMESTAMPTZ '2026-07-01 00:00:00 America/Toronto'
      AND s.scanned_at <  TIMESTAMPTZ '2026-07-28 00:00:00 America/Toronto'
      AND c.checkpoint_role = 'patrol'
      AND s.status = 'pass') AS july_patrol_passes;
