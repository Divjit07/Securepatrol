import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './hooks/useAuth.jsx'
import { flushOfflineQueue } from './lib/offlineQueue.js'

// The service worker is for the web PWA only. Inside the Capacitor wrap the app
// is served from capacitor://localhost off the bundled dist, so a SW caching
// that shell would keep serving the OLD build after an App Store update — the
// user installs 1.1 and still runs 1.0. Native gets its assets from the binary.
const isNativeShell =
  typeof window !== 'undefined' &&
  (window.Capacitor?.isNativePlatform?.() === true ||
    /^capacitor:/.test(window.location.protocol))

if ('serviceWorker' in navigator && !isNativeShell) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
} else if (isNativeShell && 'serviceWorker' in navigator) {
  // A build installed while this was still a PWA can leave a worker registered;
  // tear it down so the wrap never serves a stale cached shell.
  navigator.serviceWorker.getRegistrations?.().then((regs) => {
    regs.forEach((r) => r.unregister())
  }).catch(() => {})
}

window.addEventListener('online', () => {
  flushOfflineQueue()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
