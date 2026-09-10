import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "../firebase/firebase.config"
import { api } from "../lib/api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null) // Mongo user doc (has .role)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Dev StrictMode mounts this effect twice (subscribe → cleanup →
    // subscribe again). If the first subscription's callback is still
    // awaiting the /auth/sync fetch when cleanup runs, it must not be
    // allowed to land afterwards and clobber state set by the second,
    // active subscription — hence the `active` guard before every setState.
    let active = true
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return
      setFirebaseUser(fbUser)
      if (fbUser) {
        // A second auth transition (e.g. signup right after the initial
        // "not logged in" resolution) must flip `loading` back to true —
        // otherwise consumers see loading:false + a stale/null role for
        // the moment it takes this sync call to return, and make a wrong
        // role-based redirect decision on that stale data.
        setLoading(true)
        try {
          const { user } = await api.post("/auth/sync", {
            name: fbUser.displayName || "",
            phone: fbUser.phoneNumber || "",
          })
          if (active) setProfile(user)
        } catch (err) {
          console.error("Failed to sync user profile:", err.message)
          if (active) setProfile(null)
        }
        if (active) setLoading(false)
      } else {
        if (active) setProfile(null)
        if (active) setLoading(false)
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return
    const { user } = await api.get("/auth/me")
    setProfile(user)
  }, [firebaseUser])

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      role: profile?.role || null,
      isAuthenticated: Boolean(firebaseUser),
      loading,
      refreshProfile,
    }),
    [firebaseUser, profile, loading, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
