import { supabase } from './supabase.js'

const BUCKET = 'incident-photos'
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']

export function validateIncidentPhoto(file) {
  if (!file) return null
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Photo must be JPG, PNG, or WebP')
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('Photo must be under 5 MB')
  }
  return file
}

export async function uploadIncidentPhoto(guardId, file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext) ? ext : 'jpg'
  const path = `${guardId}/${crypto.randomUUID()}.${safeExt}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) throw error
  return path
}

export async function submitIncidentReport({ description, photoPath, guardLat, guardLng }) {
  const { data, error } = await supabase.functions.invoke('submit-incident-report', {
    body: {
      description,
      photo_path: photoPath || null,
      guard_lat: guardLat ?? null,
      guard_lng: guardLng ?? null,
    },
  })

  if (error) {
    throw new Error(
      error.message?.includes('FunctionsFetchError')
        ? 'Report service not deployed. Ask admin to deploy submit-incident-report.'
        : error.message,
    )
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function fetchIncidentReportsForSite(siteId, { limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('incident_reports')
    .select(`
      id,
      description,
      guard_lat,
      guard_lng,
      photo_path,
      created_at,
      guard:profiles!guard_id(name)
    `)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function fetchIncidentReportsForSites(siteIds, { limit = 100 } = {}) {
  if (!siteIds?.length) return []

  const { data, error } = await supabase
    .from('incident_reports')
    .select(`
      id,
      site_id,
      description,
      guard_lat,
      guard_lng,
      photo_path,
      created_at,
      guard:profiles!guard_id(name),
      site:sites(name)
    `)
    .in('site_id', siteIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function updateIncidentReportDescription(reportId, description) {
  const trimmed = description.trim()
  if (trimmed.length < 10) {
    throw new Error('Report must be at least 10 characters')
  }
  if (trimmed.length > 5000) {
    throw new Error('Report must be under 5000 characters')
  }

  const { error } = await supabase
    .from('incident_reports')
    .update({ description: trimmed })
    .eq('id', reportId)

  if (error) throw error
}

export async function deleteIncidentReport(reportId, photoPath) {
  const { error } = await supabase.from('incident_reports').delete().eq('id', reportId)
  if (error) throw error

  if (photoPath) {
    await supabase.storage.from(BUCKET).remove([photoPath])
  }
}

export function formatIncidentReportTime(iso) {
  return new Date(iso).toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export async function getIncidentPhotoSignedUrl(photoPath, expiresIn = 3600) {
  if (!photoPath) return null

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(photoPath, expiresIn)

  if (error) throw error
  return data?.signedUrl || null
}

export function isHeicPhotoPath(photoPath) {
  return /\.heic$/i.test(photoPath || '')
}

/** Download photo bytes (uses same storage RLS as signed URLs). */
export async function downloadIncidentPhoto(photoPath) {
  if (!photoPath) return null

  const { data, error } = await supabase.storage.from(BUCKET).download(photoPath)
  if (error) throw error
  return data
}
