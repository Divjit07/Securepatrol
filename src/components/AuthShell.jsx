import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import RiderMark from './home/RiderMark.jsx'
import { gsap } from 'gsap'
import { BRAND } from '../lib/brand.js'
import AuthBackground from './AuthBackground.jsx'
import ShineBorder from './auth/ShineBorder.jsx'
import Spotlight from './auth/Spotlight.jsx'
import DecryptedText from './auth/DecryptedText.jsx'

function prefersReduced() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/** Dark Ops auth shell.
 *
 * The 3D holo pedestal was removed: a self-lit lime slab under a painted oil
 * portrait is what made the hero read as a cheap cutout. The artwork is now
 * grounded by a contact shadow and separated by a backlight, both in CSS, and
 * it is the brightest thing on the panel. HoloPedestal.jsx is still in the tree
 * if the plinth is ever wanted back. */
export default function AuthShell({ children, mode = 'signin' }) {
  const rootRef = useRef(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || prefersReduced()) return undefined
    const ctx = gsap.context(() => {
      gsap.from('[data-auth-reveal]', {
        opacity: 0,
        y: 22,
        filter: 'blur(8px)',
        duration: 0.7,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'filter',
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <div className="kratos-auth" ref={rootRef}>
      <AuthBackground />
      <Spotlight />

      <div className="kratos-auth-layout">
        <section className="kratos-auth-hero-panel" data-auth-reveal>
          {/* The lockup is the way back out. Sign-in was a dead end — a visitor
              who landed here from the marketing page had no route home. */}
          <Link to="/" className="kratos-auth-brand" aria-label={`${BRAND.nameUpper} — back to site`}>
            <span className="kratos-auth-brand-mark" aria-hidden>
              <RiderMark className="h-6 w-6" />
            </span>
            <p className="kratos-auth-brand-name">{BRAND.nameUpper}</p>
          </Link>

          <Link to="/" className="kratos-auth-back">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to kronus.space
          </Link>

          <DecryptedText text={BRAND.heroLine} className="kratos-auth-headline" />
          <p className="kratos-auth-lead">{BRAND.tagline}</p>
          <p className="kratos-auth-copy">{BRAND.heroSub}</p>
        </section>

        <div className="kratos-auth-mascot" aria-hidden data-auth-reveal>
          <div className="kratos-auth-mascot-glow" />
          <img
            src="/brand/kronus-rider-tall.webp"
            alt=""
            className="kratos-auth-mascot-img"
            draggable={false}
          />
        </div>

        <aside className="kratos-auth-aside" data-auth-reveal>
          <ShineBorder className="w-full max-w-[24rem] sm:max-w-[26rem]" duration={9}>
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
          </ShineBorder>
        </aside>
      </div>

      <p className="kratos-auth-copyright">Copyrighted by Divjit Singh Dhatt</p>
    </div>
  )
}
