import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { BRAND } from '../lib/brand.js'
import AuthBackground from './AuthBackground.jsx'

/** Dark Ops auth shell — brand hero left, sign-in card right. */
export default function AuthShell({ children, mode = 'signin' }) {
  return (
    <div className="kratos-auth">
      <AuthBackground />

      <div className="kratos-auth-layout">
        <section className="kratos-auth-hero-panel">
          <div className="kratos-auth-brand">
            <span className="kratos-auth-brand-mark" aria-hidden>
              <Shield className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <p className="kratos-auth-brand-name">{BRAND.nameUpper}</p>
          </div>

          <h1 className="kratos-auth-headline">{BRAND.heroLine}</h1>
          <p className="kratos-auth-lead">{BRAND.tagline}</p>
          <p className="kratos-auth-copy">{BRAND.heroSub}</p>
        </section>

        <aside className="kratos-auth-aside">
          <div className="kratos-auth-card">
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
