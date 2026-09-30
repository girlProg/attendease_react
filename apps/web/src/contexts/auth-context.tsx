import { createContext, useContext } from "react"
import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { UserProfile } from "@/types"

interface AuthContextValue {
  profile: UserProfile | undefined
  role: string
  isAdmin: boolean
  isSuperuser: boolean
  isStaffuser: boolean
  isViewer: boolean
  isSpiu: boolean
  canWrite: boolean
  isCaseManager: boolean
  canUploadRegisters: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  profile: undefined,
  role: "user",
  isAdmin: false,
  isSuperuser: false,
  isStaffuser: false,
  isViewer: false,
  isSpiu: false,
  canWrite: false,
  isCaseManager: false,
  canUploadRegisters: false,
  isLoading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<UserProfile>("/auth/profile/").then((response) => response.data),
  })

  const role = profile?.role ?? "user"
  const isAdmin = role === "admin"
  const isSuperuser = profile?.is_superuser ?? false
  const isStaffuser = profile?.is_staff ?? false
  const isViewer = role === "viewer" || role === "view_only"
  // SPIU is a case-management operator: read-only everywhere except the case
  // management screens, so it must not surface general write actions.
  const isSpiu = role === "spiu"
  const canWrite = !isViewer && !isSpiu
  // Both mirror the server: cases are open to admin, SPIU and any staff
  // account; registers to any role that can write, plus staff of any role.
  const isCaseManager = isAdmin || isSpiu || isStaffuser
  const canUploadRegisters = canWrite || isStaffuser

  return (
    <AuthContext.Provider
      value={{
        profile,
        role,
        isAdmin,
        isSuperuser,
        isStaffuser,
        isViewer,
        isSpiu,
        canWrite,
        isCaseManager,
        canUploadRegisters,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
