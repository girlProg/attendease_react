import { Navigate, Outlet } from "react-router-dom"

import { isAuthenticated } from "@/api/auth"
import { PasswordGate } from "@/components/password-gate"
import { AuthProvider, useAuth } from "@/contexts/auth-context"
import type { CapabilityKey } from "@/types"

export function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return (
    <AuthProvider>
      <PasswordGate>
        <Outlet />
      </PasswordGate>
    </AuthProvider>
  )
}

/** Whoever has this permission (see users/capabilities.py on the server). */
export function CapabilityRoute({ capability }: { capability: CapabilityKey }) {
  const { can, isLoading } = useAuth()

  if (isLoading) return null
  if (!can(capability)) return <Navigate to="/" replace />
  return <Outlet />
}

/** Django superusers only, whatever their role. */
export function SuperuserRoute() {
  const { isSuperuser, isLoading } = useAuth()

  if (isLoading) return null
  if (!isSuperuser) return <Navigate to="/" replace />
  return <Outlet />
}
