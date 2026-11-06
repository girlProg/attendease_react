import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { LabeledInput } from "@/components/form-fields"
import { api } from "@/lib/api"
import type { AppUser, CapabilityKey, UserCapability } from "@/types"

const getCapabilities = (id: number) =>
  api.get<UserCapability[]>(`/user/${id}/permissions/`).then((response) => response.data)

const setCapabilities = (id: number, allowed: Partial<Record<CapabilityKey, boolean>>) =>
  api
    .put<UserCapability[]>(`/user/${id}/permissions/`, { allowed })
    .then((response) => response.data)

const resetPassword = (id: number, password: string, confirm: string) =>
  api.post(`/user/${id}/set-password/`, {
    new_password: password,
    confirm_new_password: confirm,
  })

function refusalText(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (data && typeof data === "object") {
    const first = Object.values(data as Record<string, unknown>)[0]
    if (Array.isArray(first) && typeof first[0] === "string") return first[0]
    if (typeof first === "string") return first
  }
  return fallback
}

function Refusal({ text }: { text: string }) {
  return (
    <p className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
      <AlertCircle className="size-4 shrink-0" />
      {text}
    </p>
  )
}

/** Superusers: one tick per duty. A box left as it was keeps following the role. */
export function PermissionsSection({ user }: { user: AppUser }) {
  const queryClient = useQueryClient()
  const queryKey = ["user-capabilities", user.id]
  const { data: capabilities, isError } = useQuery({
    queryKey,
    queryFn: () => getCapabilities(user.id),
  })
  const [changes, setChanges] = useState<Partial<Record<CapabilityKey, boolean>>>({})

  const save = useMutation({
    mutationFn: () => setCapabilities(user.id, changes),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved)
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      setChanges({})
    },
  })

  if (user.is_superuser) {
    return <p className="text-sm text-muted-foreground">A superuser has every permission.</p>
  }
  if (isError) return <Refusal text="Could not load this person's permissions." />
  if (!capabilities) return <p className="text-sm text-muted-foreground">Loading…</p>

  const groups = [...new Set(capabilities.map((capability) => capability.group))]

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <fieldset key={group}>
          <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {group}
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {capabilities
              .filter((capability) => capability.group === group)
              .map((capability) => (
                <label key={capability.key} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="size-4 accent-sidebar"
                    checked={changes[capability.key] ?? capability.allowed}
                    onChange={(event) =>
                      setChanges((current) => {
                        const next = { ...current }
                        if (event.target.checked === capability.allowed) delete next[capability.key]
                        else next[capability.key] = event.target.checked
                        return next
                      })
                    }
                  />
                  {capability.label}
                  {capability.allowed !== capability.default && (
                    <span className="text-xs font-medium text-sky-800">changed from their role</span>
                  )}
                </label>
              ))}
          </div>
        </fieldset>
      ))}
      {save.isError && <Refusal text={refusalText(save.error, "Could not save the permissions.")} />}
      <Button
        className="h-10 rounded-full bg-sidebar px-6 text-sm text-white hover:bg-sidebar/90"
        disabled={save.isPending || Object.keys(changes).length === 0}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Saving..." : "Save permissions"}
      </Button>
    </div>
  )
}

/** Superusers: give someone a new password. They choose their own at next sign-in. */
export function ResetPasswordSection({ user, isSelf }: { user: AppUser; isSelf: boolean }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [done, setDone] = useState(false)

  const reset = useMutation({
    mutationFn: () => resetPassword(user.id, password, confirm),
    onSuccess: () => {
      setPassword("")
      setConfirm("")
      setDone(true)
    },
  })

  if (isSelf) {
    return (
      <p className="text-sm text-muted-foreground">Change your own password on your Profile.</p>
    )
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        They&apos;ll have to choose their own at their next sign-in. Anywhere they&apos;re already
        signed in stays signed in. The change goes to the logs, without the password.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledInput
          label="New password"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value)
            setDone(false)
          }}
        />
        <LabeledInput
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(value) => {
            setConfirm(value)
            setDone(false)
          }}
        />
      </div>
      {reset.isError && <Refusal text={refusalText(reset.error, "Could not set the password.")} />}
      {done && <p className="mt-3 text-sm font-medium text-emerald-700">Password set.</p>}
      <Button
        className="mt-4 h-10 rounded-full bg-sidebar px-6 text-sm text-white hover:bg-sidebar/90"
        disabled={reset.isPending || !password || password !== confirm}
        onClick={() => reset.mutate()}
      >
        {reset.isPending ? "Setting..." : "Set password"}
      </Button>
    </div>
  )
}
