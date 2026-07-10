import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { QrCode } from 'lucide-react'

export default function QRScanner({ onScan, disabled }) {
  const [active, setActive] = useState(false)
  const [error, setError] = useState(null)
  const scannerRef = useRef(null)
  const containerId = 'qr-reader'

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const startScanner = async () => {
    if (disabled) return
    setError(null)

    try {
      const scanner = new Html5Qrcode(containerId)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          let checkpointId = decodedText
          try {
            const url = new URL(decodedText)
            const pathMatch = url.pathname.match(/checkpoint\/([a-f0-9-]+)/i)
            if (pathMatch) checkpointId = pathMatch[1]
          } catch {
            // plain UUID text
          }
          onScan?.(checkpointId.trim())
          stopScanner()
        },
        () => {},
      )
      setActive(true)
    } catch (err) {
      setError(err.message || 'Camera access denied')
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch {
        // ignore
      }
      scannerRef.current = null
    }
    setActive(false)
  }

  return (
    <div className="dk-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <QrCode className="h-5 w-5 text-accent-cyan-line" />
        <span className="font-medium text-ink">QR Code Scanner</span>
      </div>

      <div id={containerId} className="overflow-hidden rounded-lg" />

      {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}

      <button
        type="button"
        onClick={active ? stopScanner : startScanner}
        disabled={disabled}
        className="dk-btn-2 mt-3 w-full py-2.5"
      >
        {active ? 'Stop Camera' : 'Open QR Scanner'}
      </button>
    </div>
  )
}
