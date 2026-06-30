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
  const { isAdmin, isLoading } = useAuth()

  if (isLoading) return null
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
