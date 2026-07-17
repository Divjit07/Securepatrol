-- Move pay rates off the client-readable guards table. guards' RLS is
-- row-scoped only (clients can SELECT any column of their site's guard rows),
-- so guards.hourly_rate was one curious dev-tools query away from a client —
-- the app only avoided leaking it because its JS picked narrow column lists.
-- Pay data now lives in guard_pay_rates with admin-only RLS: the wrong data
-- structurally cannot be selected by a client, no matter what a future query
-- (or AI tool call) asks for.

CREATE TABLE IF NOT EXISTS guard_pay_rates (
  guard_id UUID PRIMARY KEY REFERENCES guards(id) ON DELETE CASCADE,
  hourly_rate NUMERIC(8, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE guard_pay_rates ENABLE ROW LEVEL SECURITY;

-- Site admins and super_admin only. No client or guard policy exists at all.
CREATE POLICY "Admins read guard pay rates"
  ON guard_pay_rates FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM guards g
      WHERE g.id = guard_pay_rates.guard_id AND user_owns_site(g.site_id)
    )
  );

CREATE POLICY "Admins write guard pay rates"
  ON guard_pay_rates FOR INSERT
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM guards g
      WHERE g.id = guard_pay_rates.guard_id AND user_owns_site(g.site_id)
    )
  );

CREATE POLICY "Admins update guard pay rates"
  ON guard_pay_rates FOR UPDATE
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM guards g
      WHERE g.id = guard_pay_rates.guard_id AND user_owns_site(g.site_id)
    )
  );

-- Carry existing rates over, then remove the leaky column.
INSERT INTO guard_pay_rates (guard_id, hourly_rate)
SELECT id, hourly_rate FROM guards WHERE hourly_rate IS NOT NULL
ON CONFLICT (guard_id) DO NOTHING;

ALTER TABLE guards DROP COLUMN IF EXISTS hourly_rate;
