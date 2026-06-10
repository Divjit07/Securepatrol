export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function supportsWebNfc() {
  return typeof window !== 'undefined' && 'NDEFReader' in window
}

export function preferredScanMode() {
  if (isIOS() || !supportsWebNfc()) return 'qr'
  return 'nfc'
}
