import { createContext, useContext } from "react"
import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { UserProfile } from "@/types"

interface AuthContextValue {
  profile: UserProfile | undefined
  role: string
  isAdmin: boolean
  isSuperuser: boolean
  isViewer: boolean
  isSpiu: boolean
  canWrite: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  profile: undefined,
  role: "user",
  isAdmin: false,
  isSuperuser: false,
  isViewer: false,
  isSpiu: false,
  canWrite: false,
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
  const isViewer = role === "viewer" || role === "view_only"
  // SPIU is a case-management operator: read-only everywhere except the case
  // management screens, so it must not surface general write actions.
  const isSpiu = role === "spiu"
  const canWrite = !isViewer && !isSpiu

  return (
    <AuthContext.Provider value={{ profile, role, isAdmin, isSuperuser, isViewer, isSpiu, canWrite, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
