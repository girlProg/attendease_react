import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Mail, Lock, Eye, EyeOff } from "lucide-react"

import { login } from "@/api/auth"
import { AppLogo } from "@/components/app-logo"
import { IconInput } from "@/components/icon-input"
import { PrimaryButton } from "@/components/primary-button"

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      queryClient.clear()
      navigate("/")
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    loginMutation.mutate({ email, password })
  }

  return (
    <div className="flex min-h-svh">
      {/* Left branding panel */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-sidebar lg:flex">
        <div className="z-10 px-12 text-center">
          <AppLogo size="lg" className="mb-4 justify-center" />
          <p className="text-lg text-white/70">
            The attendance record system for Kaduna Schools
          </p>
        </div>
        {/* Decorative arcs */}
        <svg
          className="absolute bottom-0 left-0 h-64 w-64 opacity-30"
          viewBox="0 0 256 256"
          fill="none"
        >
          <circle cx="0" cy="256" r="200" stroke="oklch(0.7 0.1 277)" strokeWidth="1.5" />
          <circle cx="0" cy="256" r="240" stroke="oklch(0.7 0.1 277)" strokeWidth="1" />
          <circle cx="0" cy="256" r="160" stroke="oklch(0.7 0.1 277)" strokeWidth="1" />
        </svg>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 lg:w-1/2">
        <AppLogo size="md" variant="dark" className="mb-8 lg:hidden" />

        <div className="w-full max-w-md space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Hello Again!</h1>
            <p className="mt-1 text-muted-foreground">Welcome back</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <IconInput
              icon={<Mail />}
              type="email"
              placeholder="kachia@kadagile.online"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <IconInput
              icon={<Lock />}
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              endAction={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              }
            />

            {loginMutation.isError && (
              <p className="text-sm text-destructive">
                {loginMutation.error?.message === "Request failed with status code 401"
                  ? "Invalid email or password"
                  : "Something went wrong. Please try again."}
              </p>
            )}

            <PrimaryButton type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </PrimaryButton>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Forgot password
          </p>
        </div>
      </div>
    </div>
  )
}
