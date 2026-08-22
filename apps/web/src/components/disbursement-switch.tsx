import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import {
  getDisbursementSettings,
  setDisbursementSettings,
} from "@/api/payments"

/**
 * Global disbursement kill-switch. Superusers see a toggle; other admins see a
 * warning badge only when disbursements are OFF (so they know why the Disburse
 * button is refusing). Turning it off stops the bank pollers from erroring on
 * boxes that can't reach the bank.
 */
export function DisbursementSwitch() {
  const { isSuperuser } = useAuth()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ["disbursement-settings"],
    queryFn: getDisbursementSettings,
  })

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setDisbursementSettings(enabled),
    onSuccess: (result) => {
      queryClient.setQueryData(["disbursement-settings"], result)
      queryClient.invalidateQueries({ queryKey: ["disbursement-settings"] })
    },
  })

  if (data === undefined) return null
  const enabled = data.enabled

  // Non-superusers only get a heads-up when the switch is off.
  if (!isSuperuser) {
    if (enabled) return null
    return (
      <span className="inline-flex h-11 items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 text-sm font-medium text-amber-700">
        <AlertTriangle className="size-4" />
        Disbursements disabled
      </span>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate(!enabled)}
      title={
        enabled
          ? "Disbursements are ON — the bank pollers run and Disburse is allowed"
          : "Disbursements are OFF — pollers pause and Disburse is blocked"
      }
      className={`inline-flex h-11 items-center gap-3 rounded-full border px-4 text-sm font-medium transition disabled:opacity-60 ${
        enabled
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border-border bg-white text-muted-foreground hover:bg-muted/50"
      }`}
    >
      <span>Disbursements {enabled ? "on" : "off"}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          enabled ? "bg-emerald-600" : "bg-muted-foreground/40"
        }`}
      >
        <span
          className={`absolute size-4 rounded-full bg-white shadow transition ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  )
}
