import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { BRAND } from '../lib/brand.js'
import AuthBackground from './AuthBackground.jsx'

/** Left: Kratos hero copy · Right: login card */
export default function AuthShell({ children, mode = 'signin' }) {
  return (
    <div className="kratos-auth">
      <AuthBackground />
      <div className="kratos-auth-overlay" aria-hidden />

      <div className="kratos-auth-brand-corner">
        <span className="kratos-auth-brand-mark">
          <Shield className="h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11" strokeWidth={1.75} />
        </span>
        <span className="kratos-auth-brand-name">{BRAND.nameUpper}</span>
      </div>

      <div className="kratos-auth-layout">
        <div className="kratos-auth-hero-panel">
          <header className="kratos-auth-hero">
            <h1 className="kratos-auth-headline">
              <span className="kratos-auth-headline-line">{BRAND.heroLine}</span>
            </h1>

            <p className="kratos-auth-lead">{BRAND.tagline}</p>
            <p className="kratos-auth-copy">{BRAND.heroSub}</p>
          </header>
        </div>

        <aside className="kratos-auth-aside">
          <div className="kratos-auth-card">
            <div className="kratos-auth-card-accent" aria-hidden />
            {children}
            <p className="kratos-auth-switch">
              {mode === 'signin' ? (
                <>
                  New to {BRAND.name}?{' '}
                  <Link to="/signup" className="kratos-auth-link">
                    Create an account
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <Link to="/login" className="kratos-auth-link">
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
