-- SecurePatrol Supabase Schema
-- Run this in the Supabase SQL Editor after creating your project.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (extends auth.users with role)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'guard')),
  site_id UUID,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sites
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles
  ADD CONSTRAINT profiles_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;

-- Floors
CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  floor_number INTEGER NOT NULL,
  floor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Checkpoints
CREATE TABLE IF NOT EXISTS checkpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_metres INTEGER DEFAULT 20,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Guards (linked to auth users via profiles; this table stores patrol metadata)
CREATE TABLE IF NOT EXISTS guards (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Scans
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  guard_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  guard_lat DOUBLE PRECISION NOT NULL,
  guard_lng DOUBLE PRECISION NOT NULL,
  distance_metres DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail')),
  sync_method TEXT DEFAULT 'realtime' CHECK (sync_method IN ('realtime', 'offline_sync')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alert configurations
CREATE TABLE IF NOT EXISTS alert_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE UNIQUE,
  minutes_until_alert INTEGER DEFAULT 60,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alert notifications log
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  acknowledged BOOLEAN DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_floors_site ON floors(site_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_floor ON checkpoints(floor_id);
CREATE INDEX IF NOT EXISTS idx_scans_checkpoint ON scans(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_scans_guard ON scans(guard_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_guards_site ON guards(site_id);
CREATE INDEX IF NOT EXISTS idx_alerts_site ON alerts(site_id);

-- Helper: get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get user's site (for guards/admins)
CREATE OR REPLACE FUNCTION get_user_site_id()
RETURNS UUID AS $$
  SELECT site_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user owns site
CREATE OR REPLACE FUNCTION user_owns_site(site_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM sites
    WHERE id = site_uuid
    AND (admin_id = auth.uid() OR get_user_role() = 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Auto-create profile on signup (guards created by admin via edge function or manual insert)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, site_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'guard'),
    CASE
      WHEN NEW.raw_user_meta_data->>'site_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (NEW.raw_user_meta_data->>'site_id')::uuid
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (id = auth.uid() OR get_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "Allow profile creation on signup"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update guard profiles"
  ON profiles FOR UPDATE
  USING (
    get_user_role() = 'super_admin'
    OR (
      get_user_role() = 'admin'
      AND EXISTS (
        SELECT 1 FROM guards g
        JOIN sites s ON s.id = g.site_id
        WHERE g.id = profiles.id AND s.admin_id = auth.uid()
      )
    )
  );

CREATE POLICY "Super admin can manage profiles"
  ON profiles FOR ALL USING (get_user_role() = 'super_admin');

-- Sites policies
CREATE POLICY "Super admin sees all sites"
  ON sites FOR SELECT USING (get_user_role() = 'super_admin');

CREATE POLICY "Admin sees own sites"
  ON sites FOR SELECT USING (admin_id = auth.uid());

CREATE POLICY "Guard sees assigned site"
  ON sites FOR SELECT USING (
    id = get_user_site_id() AND get_user_role() = 'guard'
  );

CREATE POLICY "Super admin manages sites"
  ON sites FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "Admin manages own sites"
  ON sites FOR ALL USING (admin_id = auth.uid());

-- Floors policies
CREATE POLICY "Read floors for accessible sites"
  ON floors FOR SELECT USING (
    get_user_role() = 'super_admin'
    OR user_owns_site(site_id)
    OR site_id = get_user_site_id()
  );

CREATE POLICY "Manage floors for owned sites"
  ON floors FOR ALL USING (
    get_user_role() = 'super_admin' OR user_owns_site(site_id)
  );

-- Checkpoints policies
CREATE POLICY "Read checkpoints for accessible sites"
  ON checkpoints FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM floors f
      WHERE f.id = checkpoints.floor_id
      AND (
        get_user_role() = 'super_admin'
        OR user_owns_site(f.site_id)
        OR f.site_id = get_user_site_id()
      )
    )
  );

CREATE POLICY "Manage checkpoints for owned sites"
  ON checkpoints FOR ALL USING (
    EXISTS (
      SELECT 1 FROM floors f
      WHERE f.id = checkpoints.floor_id
      AND (get_user_role() = 'super_admin' OR user_owns_site(f.site_id))
    )
  );

-- Guards policies
CREATE POLICY "Admins read guards for their sites"
  ON guards FOR SELECT USING (
    get_user_role() = 'super_admin'
    OR user_owns_site(site_id)
    OR id = auth.uid()
  );

CREATE POLICY "Admins manage guards for their sites"
  ON guards FOR ALL USING (
    get_user_role() = 'super_admin' OR user_owns_site(site_id)
  );

-- Scans policies
CREATE POLICY "Guards insert own scans"
  ON scans FOR INSERT WITH CHECK (guard_id = auth.uid());

CREATE POLICY "Read scans for accessible sites"
  ON scans FOR SELECT USING (
    guard_id = auth.uid()
    OR get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM checkpoints c
      JOIN floors f ON f.id = c.floor_id
      WHERE c.id = scans.checkpoint_id
      AND (user_owns_site(f.site_id) OR f.site_id = get_user_site_id())
    )
  );

-- Alert configs policies
CREATE POLICY "Read alert configs for accessible sites"
  ON alert_configs FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM checkpoints c
      JOIN floors f ON f.id = c.floor_id
      WHERE c.id = alert_configs.checkpoint_id
      AND (
        get_user_role() = 'super_admin'
        OR user_owns_site(f.site_id)
        OR f.site_id = get_user_site_id()
      )
    )
  );

CREATE POLICY "Manage alert configs for owned sites"
  ON alert_configs FOR ALL USING (
    EXISTS (
      SELECT 1 FROM checkpoints c
      JOIN floors f ON f.id = c.floor_id
      WHERE c.id = alert_configs.checkpoint_id
      AND (get_user_role() = 'super_admin' OR user_owns_site(f.site_id))
    )
  );

-- Alerts policies
CREATE POLICY "Read alerts for accessible sites"
  ON alerts FOR SELECT USING (
    get_user_role() = 'super_admin' OR user_owns_site(site_id)
  );

CREATE POLICY "Manage alerts for owned sites"
  ON alerts FOR ALL USING (
    get_user_role() = 'super_admin' OR user_owns_site(site_id)
  );

-- Enable Realtime for scans and alerts
ALTER PUBLICATION supabase_realtime ADD TABLE scans;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

-- Server-side GPS verification (anti-cheat)
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371000 * 2 * atan2(sqrt(a), sqrt(1 - a))
  FROM (
    SELECT sin(radians(lat2 - lat1) / 2) ^ 2
      + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2 AS a
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.validate_scan_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cp_lat double precision; cp_lng double precision; cp_radius integer; dist double precision;
BEGIN
  IF NEW.guard_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot submit scan for another guard';
  END IF;
  SELECT latitude, longitude, radius_metres INTO cp_lat, cp_lng, cp_radius
  FROM checkpoints WHERE id = NEW.checkpoint_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkpoint not found or inactive'; END IF;
  dist := haversine_distance(NEW.guard_lat, NEW.guard_lng, cp_lat, cp_lng);
  NEW.distance_metres := round(dist::numeric, 2);
  NEW.status := CASE WHEN dist <= COALESCE(cp_radius, 20) THEN 'pass' ELSE 'fail' END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_scan_gps ON scans;
CREATE TRIGGER validate_scan_gps BEFORE INSERT ON scans
  FOR EACH ROW EXECUTE FUNCTION validate_scan_before_insert();

CREATE OR REPLACE FUNCTION public.block_scan_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Scan records cannot be modified or deleted'; END;
$$;

DROP TRIGGER IF EXISTS block_scan_update ON scans;
CREATE TRIGGER block_scan_update BEFORE UPDATE ON scans
  FOR EACH ROW EXECUTE FUNCTION block_scan_modification();

DROP TRIGGER IF EXISTS block_scan_delete ON scans;
CREATE TRIGGER block_scan_delete BEFORE DELETE ON scans
  FOR EACH ROW EXECUTE FUNCTION block_scan_modification();

-- Sample super admin setup (run after creating user in Supabase Auth):
-- UPDATE profiles SET role = 'super_admin', name = 'Super Admin' WHERE id = '<your-user-id>';
