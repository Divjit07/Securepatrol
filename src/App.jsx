import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'

const GuardDashboard = lazy(() => import('./pages/GuardDashboard.jsx'))
const ScanScreen = lazy(() => import('./pages/ScanScreen.jsx'))
const ScanResult = lazy(() => import('./pages/ScanResult.jsx'))
const GuardHistory = lazy(() => import('./pages/GuardHistory.jsx'))
const GuardIncidentReport = lazy(() => import('./pages/GuardIncidentReport.jsx'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'))
const SiteDashboard = lazy(() => import('./pages/SiteDashboard.jsx'))
const LiveFeedPage = lazy(() => import('./pages/LiveFeedPage.jsx'))
const CheckpointManager = lazy(() => import('./pages/CheckpointManager.jsx'))
const GuardManager = lazy(() => import('./pages/GuardManager.jsx'))
const ClientManager = lazy(() => import('./pages/ClientManager.jsx'))
const Reports = lazy(() => import('./pages/Reports.jsx'))
const Alerts = lazy(() => import('./pages/Alerts.jsx'))
const ScanApproval = lazy(() => import('./pages/ScanApproval.jsx'))
const AdminShiftClock = lazy(() => import('./pages/AdminShiftClock.jsx'))
const AdminIncidents = lazy(() => import('./pages/AdminIncidents.jsx'))
const ClientDashboard = lazy(() => import('./pages/ClientDashboard.jsx'))
const ClientCheckpoints = lazy(() => import('./pages/ClientCheckpoints.jsx'))
const ClientReports = lazy(() => import('./pages/ClientReports.jsx'))
const ClientIncidents = lazy(() => import('./pages/ClientIncidents.jsx'))
const AdminRoster = lazy(() => import('./pages/AdminRoster.jsx'))
const ClientCoverage = lazy(() => import('./pages/ClientCoverage.jsx'))
const GuardSchedule = lazy(() => import('./pages/GuardSchedule.jsx'))
const RosterPreview = import.meta.env.DEV ? lazy(() => import('./pages/dev/RosterPreview.jsx')) : null
const AdminPreview = import.meta.env.DEV ? lazy(() => import('./pages/dev/AdminPreview.jsx')) : null

function PageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
    </div>
  )
}

function HomeRedirect() {
  const { user, isAdmin, isClient, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (isAdmin) return <Navigate to="/admin" replace />
  if (isClient) return <Navigate to="/client" replace />
  return <Navigate to="/guard" replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
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
          path="/guard/incident"
          element={
            <ProtectedRoute requireGuard>
              <GuardIncidentReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guard/schedule"
          element={
            <ProtectedRoute requireGuard>
              <GuardSchedule />
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
          path="/admin/clients"
          element={
            <ProtectedRoute requireAdmin>
              <ClientManager />
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
        <Route
          path="/admin/approve-scan"
          element={
            <ProtectedRoute requireAdmin>
              <ScanApproval />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/shift-clock"
          element={
            <ProtectedRoute requireAdmin>
              <AdminShiftClock />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/incidents"
          element={
            <ProtectedRoute requireAdmin>
              <AdminIncidents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/roster"
          element={
            <ProtectedRoute requireAdmin>
              <AdminRoster />
            </ProtectedRoute>
          }
        />

        <Route
          path="/client"
          element={
            <ProtectedRoute requireClient>
              <ClientDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/coverage"
          element={
            <ProtectedRoute requireClient>
              <ClientCoverage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/checkpoints"
          element={
            <ProtectedRoute requireClient>
              <ClientCheckpoints />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/reports"
          element={
            <ProtectedRoute requireClient>
              <ClientReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/incidents"
          element={
            <ProtectedRoute requireClient>
              <ClientIncidents />
            </ProtectedRoute>
          }
        />

        {RosterPreview && <Route path="/dev/roster" element={<RosterPreview />} />}
        {AdminPreview && <Route path="/dev/admin" element={<AdminPreview />} />}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
