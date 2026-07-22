import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

function homePath({ isAdmin, isClient, isGuard, isOffice }) {
  if (isAdmin) return '/admin'
  if (isClient) return '/client'
  if (isOffice) return '/office'
  if (isGuard) return '/guard'
  return '/login'
}

export default function ProtectedRoute({ children, requireAdmin, requireGuard, requireClient, requireOffice }) {
  const { user, profile, loading, isAdmin, isGuard, isClient, isOffice } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Authenticated but the profile hasn't resolved yet (first load, or a flaky
  // network dropped the fetch). A logged-in user ALWAYS has a profile row, so
  // this is "still loading", never "roleless" — show the spinner and let the
  // background retry recover. Ejecting to /login here was the phantom logout.
  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
      </div>
    )
  }

  const fallback = homePath({ isAdmin, isClient, isGuard, isOffice })

  if (requireAdmin && !isAdmin) {
    return <Navigate to={fallback} replace />
  }

  if (requireGuard && !isGuard) {
    return <Navigate to={fallback} replace />
  }

  if (requireClient && !isClient) {
    return <Navigate to={fallback} replace />
  }

  if (requireOffice && !isOffice) {
    return <Navigate to={fallback} replace />
  }

  if (!profile?.active && profile?.role !== 'super_admin') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-accent-red">Account Inactive</h1>
          <p className="mt-2 text-ink-2">Contact your administrator to reactivate your account.</p>
        </div>
      </div>
    )
  }

  return children
}
