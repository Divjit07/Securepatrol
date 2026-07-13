import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { isScanApprover, checkScanApproverFromDb } from '../lib/scanApproval.js'
import { isShiftClockAdmin, checkShiftClockAdminFromDb } from '../lib/shiftClockAccess.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [canApproveScans, setCanApproveScans] = useState(false)
  const [canManageShiftClock, setCanManageShiftClock] = useState(false)
  // True until the approve-scans / shift-clock checks (incl. DB round trips)
  // finish — gated pages must not redirect away while this is set.
  const [privilegesLoading, setPrivilegesLoading] = useState(true)

  // Distinguish "no row" from "request failed". A logged-in user ALWAYS has a
  // profile row (created by a DB trigger), so a failed fetch on a flaky phone
  // must never be treated as "this user has no profile" — that used to null the
  // role and bounce the guard to /login. Retry a few times, then report the
  // failure so the caller keeps the last-known-good profile instead of nulling.
  const loadProfile = useCallback(async (userId, { retries = 3 } = {}) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, sites(id, name)')
        .eq('id', userId)
        .single()

      if (!error) return { profile: data, ok: true }
      // PGRST116 = no row (a real "profile missing"); anything else is transient.
      if (error.code === 'PGRST116') return { profile: null, ok: true }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
      } else {
        console.error('Profile load failed after retries:', error.message)
      }
    }
    return { profile: null, ok: false }
  }, [])

  // Which user id the current profile belongs to — lets auth events (token
  // refresh fires ~hourly) skip redundant profile refetches. The session from
  // getSession()/events is read locally; a forged local session can't read
  // anything anyway because RLS validates the JWT on every query.
  const profileUserRef = useRef(null)

  useEffect(() => {
    const syncFromSession = async (session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (!currentUser) {
        profileUserRef.current = null
        setProfile(null)
        setCanApproveScans(false)
        setCanManageShiftClock(false)
        setLoading(false)
        return
      }
      if (profileUserRef.current !== currentUser.id) {
        profileUserRef.current = currentUser.id
        const { profile: p, ok } = await loadProfile(currentUser.id)
        // A newer auth event may have switched users while we were fetching.
        if (profileUserRef.current !== currentUser.id) return
        // Only overwrite the profile when the fetch succeeded. On transient
        // failure keep whatever we had — do NOT null a valid session's role.
        if (ok) setProfile(p)
      }
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => syncFromSession(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Guard phones drop signal (basements, elevators) and a failed token
      // refresh can emit a null session — that is NOT a logout. Only an
      // explicit sign-out (or genuinely empty storage on boot) clears the
      // user; otherwise re-read the stored session and keep them working.
      if (!session && event !== 'SIGNED_OUT' && event !== 'INITIAL_SESSION') {
        supabase.auth.getSession().then(({ data: { session: stored } }) => {
          if (stored) syncFromSession(stored)
        })
        return
      }
      syncFromSession(session)
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  // Self-heal: if we have a user but the profile never resolved (transient
  // fetch failure), keep retrying quietly so the app recovers without a reload.
  useEffect(() => {
    if (!user || profile) return undefined
    let cancelled = false
    const id = setInterval(async () => {
      if (cancelled) return
      const { profile: p, ok } = await loadProfile(user.id, { retries: 0 })
      if (!cancelled && ok && p) setProfile(p)
    }, 3000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [user, profile, loadProfile])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    profileUserRef.current = data.user.id // claim it so the auth event doesn't refetch
    const { profile: p } = await loadProfile(data.user.id)
    setProfile(p)
    return { user: data.user, profile: p }
  }

  const signUp = async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name?.trim() || email.split('@')[0] } },
    })
    if (error) throw error
    const needsEmailConfirmation = !data.session
    if (data.session && data.user) {
      profileUserRef.current = data.user.id
      const { profile: p } = await loadProfile(data.user.id)
      setProfile(p)
      setUser(data.user)
      return { user: data.user, profile: p, needsEmailConfirmation: false }
    }
    return { user: data.user, profile: null, needsEmailConfirmation }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
  const isGuard = profile?.role === 'guard'
  const isClient = profile?.role === 'client'
  const isSuperAdmin = profile?.role === 'super_admin'

  useEffect(() => {
    let cancelled = false

    async function resolvePrivilegedAccess() {
      if (!user || !isAdmin) {
        if (!cancelled) {
          setCanApproveScans(false)
          setCanManageShiftClock(false)
          if (!loading) setPrivilegesLoading(false)
        }
        return
      }

      if (isScanApprover(user, profile)) {
        if (!cancelled) setCanApproveScans(true)
      } else {
        const fromDb = await checkScanApproverFromDb()
        if (!cancelled) setCanApproveScans(fromDb === true)
      }

      if (isShiftClockAdmin(user, profile)) {
        if (!cancelled) {
          setCanManageShiftClock(true)
          setPrivilegesLoading(false)
        }
        return
      }

      const shiftFromDb = await checkShiftClockAdminFromDb()
      if (!cancelled) {
        setCanManageShiftClock(shiftFromDb === true)
        setPrivilegesLoading(false)
      }
    }

    resolvePrivilegedAccess()
    return () => {
      cancelled = true
    }
  }, [
    user?.id,
    user?.email,
    profile?.id,
    profile?.name,
    profile?.role,
    profile?.can_approve_scans,
    profile?.can_manage_shift_clock,
    isAdmin,
    loading,
  ])

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin,
        isGuard,
        isClient,
        isSuperAdmin,
        canApproveScans,
        canManageShiftClock,
        privilegesLoading,
        refreshProfile: () =>
          loadProfile(user?.id).then(({ profile: p, ok }) => {
            if (ok) setProfile(p)
          }),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
