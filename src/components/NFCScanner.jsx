import { useEffect, useRef, useState } from 'react'
import { Nfc } from 'lucide-react'

export default function NFCScanner({ onScan, disabled }) {
  const [supported, setSupported] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    setSupported('NDEFReader' in window)
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const startScan = async () => {
    if (!supported || disabled) return
    setError(null)
    setScanning(true)

    try {
      const ndef = new NDEFReader()
      abortRef.current = new AbortController()
      await ndef.scan({ signal: abortRef.current.signal })

      ndef.addEventListener('reading', ({ serialNumber, message }) => {
        let checkpointId = serialNumber

        for (const record of message.records) {
          if (record.recordType === 'text') {
            const decoder = new TextDecoder(record.encoding || 'utf-8')
            checkpointId = decoder.decode(record.data)
            break
          }
          if (record.recordType === 'url') {
            const decoder = new TextDecoder()
            const url = decoder.decode(record.data)
            const match = url.match(/checkpoint\/([a-f0-9-]+)/i)
            if (match) checkpointId = match[1]
          }
        }

        // The tag's hardware serial rides along so the server can verify the
        // scan came from the physical tag bound to this checkpoint (035).
        onScan?.(checkpointId.trim(), serialNumber || null)
        setScanning(false)
      })

      ndef.addEventListener('readingerror', () => {
        setError('Failed to read NFC tag. Try again.')
        setScanning(false)
      })
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'NFC scan failed. Ensure NFC is enabled.')
      }
      setScanning(false)
    }
  }

  const stopScan = () => {
    abortRef.current?.abort()
    setScanning(false)
  }

  if (!supported) {
    return (
      <div className="dk-inset p-6 text-center">
        <Nfc className="mx-auto h-10 w-10 text-ink-3" />
        <p className="mt-2 text-sm text-ink-2">
          Web NFC is not available on this device — checkpoint scans need Chrome on an Android
          phone. Clock in/out still works from your dashboard with Face ID.
        </p>
      </div>
    )
  }

  return (
    <div className="dk-card p-6 text-center">
      <Nfc className={`mx-auto h-12 w-12 text-accent-cyan-line ${scanning ? 'animate-pulse' : ''}`} />
      <p className="mt-3 font-medium text-ink">
        {scanning ? 'Hold phone near NFC tag…' : 'Tap to start NFC scan'}
      </p>
      {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
      <button
        type="button"
        onClick={scanning ? stopScan : startScan}
        disabled={disabled}
        className="dk-cta mt-4 px-6 py-3"
      >
        {scanning ? 'Cancel Scan' : 'Start NFC Scan'}
      </button>
    </div>
  )
}
