import { supabase } from './supabase.js'

const BUCKET = 'incident-photos'
export const MAX_INCIDENT_ATTACHMENTS = 5
export const MAX_INCIDENT_FILE_BYTES = 10 * 1024 * 1024

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
])

const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const EXT_KIND = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  heic: 'image',
  gif: 'image',
  pdf: 'document',
  docx: 'document',
}

function fileExtension(name) {
  return name.split('.').pop()?.toLowerCase() || ''
}

function inferMimeType(file) {
  if (file.type) return file.type
  const ext = fileExtension(file.name)
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'gif') return 'image/gif'
  return ''
}

export function attachmentKind(mimeType, fileName) {
  if (IMAGE_TYPES.has(mimeType) || EXT_KIND[fileExtension(fileName)] === 'image') return 'image'
  if (DOCUMENT_TYPES.has(mimeType) || EXT_KIND[fileExtension(fileName)] === 'document') return 'document'
  return null
}

export function validateIncidentAttachment(file) {
  if (!file) return null

  const mimeType = inferMimeType(file)
  const kind = attachmentKind(mimeType, file.name)

  if (!kind) {
    throw new Error('Files must be photos (JPG, PNG, WebP), PDF, or DOCX')
  }
  if (file.size > MAX_INCIDENT_FILE_BYTES) {
    throw new Error('Each file must be under 10 MB')
  }

  return { file, mimeType, kind }
}

export function validateIncidentAttachmentBatch(files) {
  const list = [...files]
  if (list.length > MAX_INCIDENT_ATTACHMENTS) {
    throw new Error(`You can attach up to ${MAX_INCIDENT_ATTACHMENTS} files`)
  }
  return list.map((file) => {
    const validated = validateIncidentAttachment(file)
    return validated
  })
}

export async function uploadIncidentAttachment(guardId, file, meta) {
  const ext = fileExtension(file.name) || (meta.kind === 'image' ? 'jpg' : 'bin')
  const path = `${guardId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: meta.mimeType || file.type || 'application/octet-stream',
    upsert: false,
  })

  if (error) throw error

  return {
    path,
    name: file.name,
    kind: meta.kind,
    mime_type: meta.mimeType || file.type || null,
  }
}

export async function uploadIncidentAttachments(guardId, files) {
  const validated = validateIncidentAttachmentBatch(files)
  const attachments = []

  for (const item of validated) {
    const uploaded = await uploadIncidentAttachment(guardId, item.file, item)
    attachments.push(uploaded)
  }

  return attachments
}

export function normalizeIncidentAttachments(report) {
  if (Array.isArray(report?.attachments) && report.attachments.length > 0) {
    return report.attachments
  }
  if (report?.photo_path) {
    return [
      {
        path: report.photo_path,
        name: report.photo_path.split('/').pop() || 'photo.jpg',
        kind: 'image',
        mime_type: 'image/jpeg',
      },
    ]
  }
  return []
}

export function incidentAttachmentCount(report) {
  return normalizeIncidentAttachments(report).length
}

export function firstImageAttachmentPath(report) {
  const attachments = normalizeIncidentAttachments(report)
  const image = attachments.find((a) => a.kind === 'image')
  return image?.path || attachments[0]?.path || null
}

/** @deprecated use validateIncidentAttachment */
export function validateIncidentPhoto(file) {
  return validateIncidentAttachment(file)?.file ?? null
}

/** @deprecated use uploadIncidentAttachment */
export async function uploadIncidentPhoto(guardId, file) {
  const meta = validateIncidentAttachment(file)
  const uploaded = await uploadIncidentAttachment(guardId, file, meta)
  return uploaded.path
}

export async function submitIncidentReport({
  description,
  attachments = [],
  photoPath,
  guardLat,
  guardLng,
}) {
  const attachmentList =
    attachments.length > 0
      ? attachments
      : photoPath
        ? [{ path: photoPath, name: photoPath.split('/').pop(), kind: 'image' }]
        : []

  const { data, error } = await supabase.functions.invoke('submit-incident-report', {
    body: {
      description,
      attachment_paths: attachmentList,
      photo_path: photoPath || firstImageAttachmentPath({ attachments: attachmentList }) || null,
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
      attachments,
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
      attachments,
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

export async function deleteIncidentReport(reportId, reportOrPaths) {
  const { error } = await supabase.from('incident_reports').delete().eq('id', reportId)
  if (error) throw error

  const paths = Array.isArray(reportOrPaths)
    ? reportOrPaths
    : normalizeIncidentAttachments(reportOrPaths).map((a) => a.path)

  if (paths.length) {
    await supabase.storage.from(BUCKET).remove(paths)
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

export async function downloadIncidentPhoto(photoPath) {
  if (!photoPath) return null

  const { data, error } = await supabase.storage.from(BUCKET).download(photoPath)
  if (error) throw error
  return data
}

export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
