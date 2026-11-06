import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { LabeledInput } from "@/components/form-fields"
import { useAuth } from "@/contexts/auth-context"
import { api } from "@/lib/api"

function refusalText(error: unknown): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (data && typeof data === "object") {
    const first = Object.values(data as Record<string, unknown>)[0]
    if (Array.isArray(first) && typeof first[0] === "string") return first[0]
    if (typeof first === "string") return first
  }
  return "Could not change the password."
}

/**
 * Someone who signed in with a password a superuser set chooses their own before
 * going any further. Sessions open since before the reset aren't stopped.
 */
export function PasswordGate({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [current, setCurrent] = useState("")
  const [chosen, setChosen] = useState("")
  const [confirm, setConfirm] = useState("")

  const change = useMutation({
    mutationFn: () =>
      api.post("/auth/change-password/", {
        old_password: current,
        new_password: chosen,
        confirm_new_password: confirm,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  })

  if (!profile?.must_change_password) return children

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border/40 bg-white p-6">
        <div>
          <h1 className="text-xl font-bold text-sidebar">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your password was reset by an administrator. Choose your own to carry on. Only you will
            know it.
          </p>
        </div>
        <LabeledInput
          label="Password you were given"
          type="password"
          value={current}
          onChange={setCurrent}
        />
        <LabeledInput label="New password" type="password" value={chosen} onChange={setChosen} />
        <LabeledInput
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={setConfirm}
        />
        {change.isError && (
          <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {refusalText(change.error)}
          </p>
        )}
        <Button
          className="h-10 w-full rounded-full bg-sidebar text-sm text-white hover:bg-sidebar/90"
          disabled={change.isPending || !current || !chosen || chosen !== confirm}
          onClick={() => change.mutate()}
        >
          {change.isPending ? "Changing..." : "Change password"}
        </Button>
      </div>
    </div>
  )
}
