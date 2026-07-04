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
