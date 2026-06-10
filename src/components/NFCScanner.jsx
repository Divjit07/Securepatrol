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

        onScan?.(checkpointId.trim())
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
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <Nfc className="mx-auto h-10 w-10 text-slate-400" />
        <p className="mt-2 text-sm text-slate-500">
          Web NFC is not supported on this browser. Use QR scan instead (Chrome on Android / Safari on iPhone with NFC).
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-6 text-center">
      <Nfc className={`mx-auto h-12 w-12 text-brand-600 ${scanning ? 'animate-pulse' : ''}`} />
      <p className="mt-3 font-medium text-brand-900">
        {scanning ? 'Hold phone near NFC tag…' : 'Tap to start NFC scan'}
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={scanning ? stopScan : startScan}
        disabled={disabled}
        className="mt-4 rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {scanning ? 'Cancel Scan' : 'Start NFC Scan'}
      </button>
    </div>
  )
}
