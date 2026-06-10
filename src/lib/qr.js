import QRCode from 'qrcode'

export function getCheckpointQrPayload(checkpointId) {
  const base = import.meta.env.VITE_APP_URL || window.location.origin
  return `${base.replace(/\/$/, '')}/checkpoint/${checkpointId}`
}

export async function buildCheckpointQrDataUrl(checkpointId, size = 280) {
  return QRCode.toDataURL(getCheckpointQrPayload(checkpointId), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
}
