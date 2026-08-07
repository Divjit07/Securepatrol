-- 049: Message board — a post-it wall between the office, the client and the
-- guards standing on site.
--
-- Admins and clients post; guards read and acknowledge. An acknowledgement is
-- its own row (who, when) rather than a boolean on the message, because the
-- point is the audit: "this guard saw this instruction at this time."
--
-- Cross-site guards (046) read the board of ANY site they hold a published
-- shift at, not just their home site — otherwise a guard covering a shift
-- elsewhere would miss that site's standing orders.
--
-- ⚠️ Paste into the Supabase SQL editor — never `db push`.

CREATE TABLE IF NOT EXISTS public.site_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_role text NOT NULL CHECK (author_role IN ('admin', 'super_admin', 'client')),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'important', 'urgent')),
  requires_ack boolean NOT NULL DEFAULT true,
  pinned boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_messages_site_created_idx
  ON public.site_messages (site_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.site_message_reads (
  message_id uuid NOT NULL REFERENCES public.site_messages(id) ON DELETE CASCADE,
  guard_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, guard_id)
);

ALTER TABLE public.site_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_message_reads ENABLE ROW LEVEL SECURITY;

-- Which sites may the caller read a board for?
--   guard  : home site + any site with a published shift for them
--   client : their own site
--   admin  : all (matches how the rest of the admin surfaces read)
CREATE OR REPLACE FUNCTION public.can_read_site_board(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE get_user_role()
    WHEN 'admin' THEN true
    WHEN 'super_admin' THEN true
    WHEN 'client' THEN p_site_id = get_user_site_id()
    WHEN 'guard' THEN
      p_site_id = get_user_site_id()
      OR EXISTS (
        SELECT 1 FROM shifts s
        WHERE s.guard_id = auth.uid()
          AND s.status = 'published'
          AND s.site_id = p_site_id
      )
    ELSE false
  END;
$$;

GRANT EXECUTE ON FUNCTION public.can_read_site_board(uuid) TO authenticated;

-- ---- site_messages ---------------------------------------------------------

DROP POLICY IF EXISTS "Read board for permitted sites" ON public.site_messages;
CREATE POLICY "Read board for permitted sites" ON public.site_messages
  FOR SELECT USING (can_read_site_board(site_id));

-- Admins post anywhere; a client posts only to their own site. Guards never
-- post here — the board is instructions coming down, and a guard's word goes
-- into an incident report, which is a signed record.
DROP POLICY IF EXISTS "Admin posts to board" ON public.site_messages;
CREATE POLICY "Admin posts to board" ON public.site_messages
  FOR INSERT WITH CHECK (
    get_user_role() IN ('admin', 'super_admin') AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS "Client posts to own site board" ON public.site_messages;
CREATE POLICY "Client posts to own site board" ON public.site_messages
  FOR INSERT WITH CHECK (
    get_user_role() = 'client'
    AND site_id = get_user_site_id()
    AND author_id = auth.uid()
  );

-- Authors edit/remove their own; admins moderate anything.
DROP POLICY IF EXISTS "Author or admin updates board" ON public.site_messages;
CREATE POLICY "Author or admin updates board" ON public.site_messages
  FOR UPDATE USING (
    author_id = auth.uid() OR get_user_role() IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "Author or admin deletes board" ON public.site_messages;
CREATE POLICY "Author or admin deletes board" ON public.site_messages
  FOR DELETE USING (
    author_id = auth.uid() OR get_user_role() IN ('admin', 'super_admin')
  );

-- ---- site_message_reads ----------------------------------------------------

-- Everyone who can read the board can see who acknowledged — that visibility is
-- the whole point for the office and the client.
DROP POLICY IF EXISTS "Read acks for permitted sites" ON public.site_message_reads;
CREATE POLICY "Read acks for permitted sites" ON public.site_message_reads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.site_messages m
      WHERE m.id = message_id AND can_read_site_board(m.site_id)
    )
  );

-- A guard may only acknowledge as themselves, and only on a board they can read.
DROP POLICY IF EXISTS "Guard acknowledges own read" ON public.site_message_reads;
CREATE POLICY "Guard acknowledges own read" ON public.site_message_reads
  FOR INSERT WITH CHECK (
    guard_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.site_messages m
      WHERE m.id = message_id AND can_read_site_board(m.site_id)
    )
  );

-- An acknowledgement is a record, not a preference: no UPDATE/DELETE policy,
-- so it cannot be taken back once given.
