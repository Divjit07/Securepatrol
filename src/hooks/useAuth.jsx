import { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, sites(id, name)')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Profile load error:', error.message)
      return null
    }
    return data
  }, [])

  useEffect(() => {
    async function initSession() {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const currentUser = authUser ?? session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const p = await loadProfile(currentUser.id)
        setProfile(p)
      }
      setLoading(false)
    }
    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const currentUser = authUser ?? session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const p = await loadProfile(currentUser.id)
        setProfile(p)
      } else {
        setProfile(null)
        setCanApproveScans(false)
        setCanManageShiftClock(false)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const p = await loadProfile(data.user.id)
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
      const p = await loadProfile(data.user.id)
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
        if (!cancelled) setCanManageShiftClock(true)
        return
      }

      const shiftFromDb = await checkShiftClockAdminFromDb()
      if (!cancelled) setCanManageShiftClock(shiftFromDb === true)
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
        refreshProfile: () => loadProfile(user?.id).then(setProfile),
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
