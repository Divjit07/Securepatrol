-- Unique site identity (name + address) and guard emails.
-- Owner: run manually in Supabase SQL editor. Do NOT supabase db push.
-- If CREATE INDEX fails, remove TestSprite-created duplicate sites/guards first, then re-run.

CREATE UNIQUE INDEX IF NOT EXISTS sites_name_address_uidx
  ON public.sites (lower(trim(name)), lower(trim(coalesce(address, ''))));

CREATE UNIQUE INDEX IF NOT EXISTS guards_email_uidx
  ON public.guards (lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';
