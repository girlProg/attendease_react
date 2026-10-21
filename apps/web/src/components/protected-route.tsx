import { Navigate, Outlet } from "react-router-dom"

import { isAuthenticated } from "@/api/auth"
import { AuthProvider, useAuth } from "@/contexts/auth-context"

export function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

export function AdminRoute() {
  const { isAdmin, isViewer, isLoading } = useAuth()

  if (isLoading) return null
  if (!isAdmin && !isViewer) return <Navigate to="/" replace />
  return <Outlet />
}

export function CaseManagerRoute() {
  const { isCaseManager, isLoading } = useAuth()

  if (isLoading) return null
  if (!isCaseManager) return <Navigate to="/" replace />
  return <Outlet />
}

/** Django superusers only, whatever their role. */
export function SuperuserRoute() {
  const { isSuperuser, isLoading } = useAuth()

  if (isLoading) return null
  if (!isSuperuser) return <Navigate to="/" replace />
  return <Outlet />
}

/** Staff accounts only (Django is_staff), whatever their role. */
export function StaffRoute() {
  const { isStaffuser, isLoading } = useAuth()

  if (isLoading) return null
  if (!isStaffuser) return <Navigate to="/" replace />
  return <Outlet />
}
