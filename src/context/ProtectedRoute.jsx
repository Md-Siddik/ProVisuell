import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "./AuthContext"

// Wrap a route element with this to require login (and optionally a
// specific role). Unauthenticated visitors are bounced to /login with the
// page they wanted stashed so they land back there after signing in.
export default function ProtectedRoute({ roles, children }) {
  const { isAuthenticated, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#ff4b00]" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (roles && !roles.includes(role)) {
    // "/" carries no auth/role check of its own, so this can never
    // loop back through another protected redirect.
    return <Navigate to="/" replace />
  }

  return children
}
