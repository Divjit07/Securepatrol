import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { useGuardClockStatus } from '../hooks/useGuardClockStatus.js'

/**
 * Guard routes behind the time clock: incident reports, history, etc. open
 * only while clocked in. (The scanner stays open — it IS the NFC/QR clock-in
 * fallback.) Not clocked in → back to the dashboard to punch in first.
 */
export default function ClockGate({ children }) {
  const { user } = useAuth()
  const { loading, clockedIn } = useGuardClockStatus(user?.id)

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
      </div>
    )
  }

  if (!clockedIn) return <Navigate to="/guard" replace />
  return children
}
