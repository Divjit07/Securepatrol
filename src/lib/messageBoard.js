import { supabase } from './supabase.js'

/**
 * Message board data layer (migration 049).
 *
 * RLS decides visibility, so these queries stay deliberately unscoped by role —
 * a guard reading `fetchBoard(siteId)` gets their site's board because the
 * policy says so, not because the client filtered it.
 */

export const PRIORITIES = [
  { id: 'normal', label: 'Normal' },
  { id: 'important', label: 'Important' },
  { id: 'urgent', label: 'Urgent' },
]

/** Board for one site, newest first, pinned on top, expired dropped. */
export async function fetchBoard(siteId) {
  if (!siteId) return []
  const { data, error } = await supabase
    .from('site_messages')
    .select('*, author:profiles!site_messages_author_id_fkey(name, role)')
    .eq('site_id', siteId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return data || []
}

/** Acknowledgements for a set of messages, grouped by message id. */
export async function fetchAcks(messageIds) {
  if (!messageIds?.length) return {}
  const { data, error } = await supabase
    .from('site_message_reads')
    .select('message_id, guard_id, acknowledged_at, guard:profiles!site_message_reads_guard_id_fkey(name)')
    .in('message_id', messageIds)

  if (error) throw error
  return (data || []).reduce((acc, row) => {
    ;(acc[row.message_id] = acc[row.message_id] || []).push(row)
    return acc
  }, {})
}

export async function postMessage({ siteId, authorId, authorRole, body, priority = 'normal', requiresAck = true, pinned = false, expiresAt = null }) {
  const { data, error } = await supabase
    .from('site_messages')
    .insert({
      site_id: siteId,
      author_id: authorId,
      author_role: authorRole,
      body: body.trim(),
      priority,
      requires_ack: requiresAck,
      pinned,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Idempotent: the PK is (message_id, guard_id), so a double-tap is a no-op. */
export async function acknowledgeMessage(messageId, guardId) {
  const { error } = await supabase
    .from('site_message_reads')
    .upsert({ message_id: messageId, guard_id: guardId }, { onConflict: 'message_id,guard_id', ignoreDuplicates: true })

  if (error) throw error
}

export async function deleteMessage(messageId) {
  const { error } = await supabase.from('site_messages').delete().eq('id', messageId)
  if (error) throw error
}
