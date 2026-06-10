import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import GuardDashboard from './pages/GuardDashboard.jsx'
import ScanScreen from './pages/ScanScreen.jsx'
import ScanResult from './pages/ScanResult.jsx'
import GuardHistory from './pages/GuardHistory.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import SiteDashboard from './pages/SiteDashboard.jsx'
import LiveFeedPage from './pages/LiveFeedPage.jsx'
import CheckpointManager from './pages/CheckpointManager.jsx'
import GuardManager from './pages/GuardManager.jsx'
import Reports from './pages/Reports.jsx'
import Alerts from './pages/Alerts.jsx'

function HomeRedirect() {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={isAdmin ? '/admin' : '/guard'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<HomeRedirect />} />

      <Route
        path="/guard"
        element={
          <ProtectedRoute requireGuard>
            <GuardDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guard/scan"
        element={
          <ProtectedRoute requireGuard>
            <ScanScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guard/scan/result"
        element={
          <ProtectedRoute requireGuard>
            <ScanResult />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guard/history"
        element={
          <ProtectedRoute requireGuard>
            <GuardHistory />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/site/:id"
        element={
          <ProtectedRoute requireAdmin>
            <SiteDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/site/:id/live"
        element={
          <ProtectedRoute requireAdmin>
            <LiveFeedPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/checkpoints"
        element={
          <ProtectedRoute requireAdmin>
            <CheckpointManager />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/guards"
        element={
          <ProtectedRoute requireAdmin>
            <GuardManager />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute requireAdmin>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/alerts"
        element={
          <ProtectedRoute requireAdmin>
            <Alerts />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
