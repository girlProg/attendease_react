import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ScrollText } from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import {
  getDisbursementSettings,
  setDisbursementSettings,
  type DisbursementSettings,
} from "@/api/payments"

type SwitchName = "enabled" | "poll_logging"

function SwitchPill({
  label,
  on,
  disabled,
  title,
  onToggle,
}: {
  label: string
  on: boolean
  disabled: boolean
  title: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      title={title}
      className={`inline-flex h-11 items-center gap-3 rounded-full border px-4 text-sm font-medium transition disabled:opacity-60 ${
        on
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border-border bg-white text-muted-foreground hover:bg-muted/50"
      }`}
    >
      <span>
        {label} {on ? "on" : "off"}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          on ? "bg-emerald-600" : "bg-muted-foreground/40"
        }`}
      >
        <span
          className={`absolute size-4 rounded-full bg-white shadow transition ${
            on ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  )
}

/**
 * The disbursement kill-switch and the status-check logging switch.
 *
 * Superusers get both toggles. Other admins get a badge only when something
 * is unusual: disbursements off (so they know why Disburse refuses), or
 * logging on (so they know where the extra audit rows come from).
 */
export function DisbursementSwitch() {
  const { isSuperuser } = useAuth()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ["disbursement-settings"],
    queryFn: getDisbursementSettings,
  })

  const toggle = useMutation({
    mutationFn: (changes: Partial<Pick<DisbursementSettings, SwitchName>>) =>
      setDisbursementSettings(changes),
    onSuccess: (result) => {
      queryClient.setQueryData(["disbursement-settings"], result)
      queryClient.invalidateQueries({ queryKey: ["disbursement-settings"] })
      queryClient.invalidateQueries({ queryKey: ["payment-audit"] })
    },
  })

  if (data === undefined) return null
  const { enabled, poll_logging: pollLogging } = data

  if (!isSuperuser) {
    return (
      <>
        {!enabled && (
          <span className="inline-flex h-11 items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 text-sm font-medium text-amber-700">
            <AlertTriangle className="size-4" />
            Disbursements disabled
          </span>
        )}
        {pollLogging && (
          <span
            className="inline-flex h-11 items-center gap-2 rounded-full border border-sky-300 bg-sky-50 px-4 text-sm font-medium text-sky-700"
            title="Every bank status check is being recorded in the Audit Trail"
          >
            <ScrollText className="size-4" />
            Status checks logged
          </span>
        )}
      </>
    )
  }

  return (
    <>
      <SwitchPill
        label="Disbursements"
        on={enabled}
        disabled={toggle.isPending}
        onToggle={() => toggle.mutate({ enabled: !enabled })}
        title={
          enabled
            ? "Disbursements are ON — the bank pollers run and Disburse is allowed"
            : "Disbursements are OFF — pollers pause and Disburse is blocked"
        }
      />
      <SwitchPill
        label="Log status checks"
        on={pollLogging}
        disabled={toggle.isPending}
        onToggle={() => toggle.mutate({ poll_logging: !pollLogging })}
        title={
          pollLogging
            ? "Every bank status check is recorded in the Audit Trail: what the bank answered for each transfer, or why the check failed. These rows are permanent — turn it off once you have your answer."
            : "Only status checks that change something are recorded. Turn on to record every check and the bank's exact answer."
        }
      />
    </>
  )
}
