import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ClockGate from './components/ClockGate.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'


/**
 * Lazy route that survives redeploys: if a chunk 404s because the phone has a
 * stale index.html (Vercel purged old hashed assets), force one full reload to
 * pick up the fresh build instead of leaving a blank screen.
 */
function lazyRetry(importer) {
  return lazy(() =>
    importer()
      .then((mod) => {
        try {
          sessionStorage.removeItem('sp-chunk-failed')
        } catch { /* ignore */ }
        return mod
      })
      .catch((err) => {
        let alreadyReloaded = false
        try {
          alreadyReloaded = sessionStorage.getItem('sp-chunk-failed') === '1'
          sessionStorage.setItem('sp-chunk-failed', '1')
        } catch { /* ignore */ }
        if (!alreadyReloaded) {
          window.location.reload()
          return new Promise(() => {})
        }
        throw err
      }),
  )
}

const Home = lazyRetry(() => import('./pages/Home.jsx'))
const GuardDashboard = lazyRetry(() => import('./pages/GuardDashboard.jsx'))
const ScanScreen = lazyRetry(() => import('./pages/ScanScreen.jsx'))
const ScanResult = lazyRetry(() => import('./pages/ScanResult.jsx'))
const GuardHistory = lazyRetry(() => import('./pages/GuardHistory.jsx'))
const GuardIncidentReport = lazyRetry(() => import('./pages/GuardIncidentReport.jsx'))
const AdminDashboard = lazyRetry(() => import('./pages/AdminDashboard.jsx'))
const AdminSites = lazyRetry(() => import('./pages/AdminSites.jsx'))
const SiteDashboard = lazyRetry(() => import('./pages/SiteDashboard.jsx'))
const LiveFeedPage = lazyRetry(() => import('./pages/LiveFeedPage.jsx'))
const CheckpointManager = lazyRetry(() => import('./pages/CheckpointManager.jsx'))
const GuardManager = lazyRetry(() => import('./pages/GuardManager.jsx'))
const ClientManager = lazyRetry(() => import('./pages/ClientManager.jsx'))
const Reports = lazyRetry(() => import('./pages/Reports.jsx'))
const AdminPayroll = lazyRetry(() => import('./pages/AdminPayroll.jsx'))
const Alerts = lazyRetry(() => import('./pages/Alerts.jsx'))
const ScanApproval = lazyRetry(() => import('./pages/ScanApproval.jsx'))
const AdminShiftClock = lazyRetry(() => import('./pages/AdminShiftClock.jsx'))
const AdminLiveClock = lazyRetry(() => import('./pages/AdminLiveClock.jsx'))
const AdminAssistant = lazyRetry(() => import('./pages/AdminAssistant.jsx'))
const AdminIncidents = lazyRetry(() => import('./pages/AdminIncidents.jsx'))
const ClientDashboard = lazyRetry(() => import('./pages/ClientDashboard.jsx'))
const ClientCheckpoints = lazyRetry(() => import('./pages/ClientCheckpoints.jsx'))
const ClientReports = lazyRetry(() => import('./pages/ClientReports.jsx'))
const ClientIncidents = lazyRetry(() => import('./pages/ClientIncidents.jsx'))
const AdminRoster = lazyRetry(() => import('./pages/AdminRoster.jsx'))
const AdminSummary = lazyRetry(() => import('./pages/AdminSummary.jsx'))
const AdminOps = lazyRetry(() => import('./pages/AdminOps.jsx'))
const AdminLiveMap = lazyRetry(() => import('./pages/AdminLiveMap.jsx'))
const ClientCoverage = lazyRetry(() => import('./pages/ClientCoverage.jsx'))
const GuardSchedule = lazyRetry(() => import('./pages/GuardSchedule.jsx'))
const RosterPreview = import.meta.env.DEV ? lazy(() => import('./pages/dev/RosterPreview.jsx')) : null
const AdminPreview = import.meta.env.DEV ? lazy(() => import('./pages/dev/AdminPreview.jsx')) : null
const ApplePreview = import.meta.env.DEV ? lazy(() => import('./pages/dev/ApplePreview.jsx')) : null
const ScalePreview = import.meta.env.DEV ? lazy(() => import('./pages/dev/ScalePreview.jsx')) : null
const ScaleAdminPreview = import.meta.env.DEV ? lazy(() => import('./pages/dev/ScaleAdminPreview.jsx')) : null
const SidebarPreview = import.meta.env.DEV ? lazy(() => import('./pages/dev/SidebarPreview.jsx')) : null
const ClientPreview = import.meta.env.DEV ? lazy(() => import('./pages/dev/ClientPreview.jsx')) : null

function PageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
    </div>
  )
}

/**
 * `/` is the public marketing homepage for visitors; signed-in users go straight to
 * their portal. Standard SaaS behaviour — the landing page never shadows the app.
 */
function HomeRedirect() {
  const { user, isAdmin, isClient, loading } = useAuth()
  if (loading) return null
  if (!user) return <Home />
  if (isAdmin) return <Navigate to="/admin" replace />
  if (isClient) return <Navigate to="/client" replace />
  return <Navigate to="/guard" replace />
}

export default function App() {
  return (
    <AppErrorBoundary>
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
              <ClockGate>
                <GuardHistory />
              </ClockGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guard/incident"
          element={
            <ProtectedRoute requireGuard>
              <ClockGate>
                <GuardIncidentReport />
              </ClockGate>
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
          path="/admin/sites"
          element={
            <ProtectedRoute requireAdmin>
              <AdminSites />
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
          path="/admin/summary"
          element={
            <ProtectedRoute requireAdmin>
              <AdminSummary />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payroll"
          element={
            <ProtectedRoute requireAdmin>
              <AdminPayroll />
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
          path="/admin/live-clock"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLiveClock />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/assistant"
          element={
            <ProtectedRoute requireAdmin>
              <AdminAssistant />
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
          path="/admin/ops"
          element={
            <ProtectedRoute requireAdmin>
              <AdminOps />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/map"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLiveMap />
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
        {SidebarPreview && <Route path="/dev/sidebar" element={<SidebarPreview />} />}
        {ClientPreview && <Route path="/dev/client" element={<ClientPreview />} />}
        {AdminPreview && <Route path="/dev/admin" element={<AdminPreview />} />}
        {ApplePreview && <Route path="/dev/apple" element={<ApplePreview />} />}
        {ScalePreview && <Route path="/dev/scale" element={<ScalePreview />} />}
        {ScaleAdminPreview && <Route path="/dev/admin-scale" element={<ScaleAdminPreview />} />}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AppErrorBoundary>
  )
}
