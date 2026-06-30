import { createContext, useContext } from "react"
import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

interface UserProfile {
  id: number
  email: string
  first_name: string
  last_name: string
  phone_number: string
  photo: string | null
  role?: string
}

interface AuthContextValue {
  profile: UserProfile | undefined
  isAdmin: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  profile: undefined,
  isAdmin: false,
  isLoading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<UserProfile>("/auth/profile/").then((response) => response.data),
  })

  const isAdmin = profile?.role === "admin"

  return (
    <AuthContext.Provider value={{ profile, isAdmin, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
