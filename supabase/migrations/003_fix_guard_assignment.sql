-- Fix guard site assignment for dj@yahoo.com (or any manually created guard)
-- Run in Supabase SQL Editor. Adjust email/site address if needed.

-- Step 1: Find the user and site IDs
SELECT u.id AS user_id, u.email, p.role, p.site_id, s.id AS site_id, s.name AS site_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN sites s ON s.address ILIKE '%800 bathurst%' OR s.name ILIKE '%bathurst%'
WHERE u.email = 'dj@yahoo.com';

-- Step 2: Assign guard to site (run after confirming IDs from Step 1)
-- Replace SITE_UUID with the actual site id from Step 1

DO $$
DECLARE
  guard_uuid uuid;
  site_uuid uuid;
BEGIN
  SELECT id INTO guard_uuid FROM auth.users WHERE email = 'dj@yahoo.com';
  SELECT id INTO site_uuid FROM sites
    WHERE address ILIKE '%800 bathurst%' OR name ILIKE '%bathurst%'
    LIMIT 1;

  IF guard_uuid IS NULL THEN
    RAISE EXCEPTION 'User dj@yahoo.com not found';
  END IF;

  IF site_uuid IS NULL THEN
    RAISE EXCEPTION 'Site with 800 Bathurst not found — check sites table';
  END IF;

  UPDATE profiles
  SET role = 'guard', site_id = site_uuid, name = COALESCE(NULLIF(name, ''), 'DJ Guard')
  WHERE id = guard_uuid;

  INSERT INTO guards (id, name, email, site_id, active)
  VALUES (
    guard_uuid,
    COALESCE((SELECT name FROM profiles WHERE id = guard_uuid), 'DJ Guard'),
    'dj@yahoo.com',
    site_uuid,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    site_id = EXCLUDED.site_id,
    email = EXCLUDED.email,
    active = true;

  RAISE NOTICE 'Assigned dj@yahoo.com to site %', site_uuid;
END $$;
