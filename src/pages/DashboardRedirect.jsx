import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function DashboardRedirect() {
  const { role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#ff4b00]" />
      </div>
    )
  }

  if (role === "owner") return <Navigate to="/dashboard/owner" replace />
  if (role === "administrator") return <Navigate to="/dashboard/admin" replace />
  if (role === "customer") return <Navigate to="/mine-bestillinger" replace />
  // Role not resolved to anything we recognize (sync failed, or a brand
  // new account with a role our checks don't cover) — bail to the
  // marketing site rather than bouncing into another protected redirect.
  return <Navigate to="/" replace />
}
