import { CalendarCheck, Send } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { RunProgress } from "@/components/disburse-dialog"
import { getCurrentDisbursement } from "@/api/payments"
import { getReconciliationStatus } from "@/api/reconciliation"
import { formatDate, formatDateTime } from "@/lib/formatters"

/**
 * Payments page, admins: the last school disbursed (its progress while it is
 * being sent or waiting at the bank, since the next school waits for it), and
 * how far the uploaded bank statements reach.
 */
export function DisbursementStatusStrip() {
  const current = useQuery({
    queryKey: ["disbursement-current"],
    queryFn: getCurrentDisbursement,
    // Follow a school while it is in progress; otherwise check now and then.
    refetchInterval: (query) => {
      const run = query.state.data?.run
      return run && (run.status === "queued" || run.status === "sending" || run.waiting_at_bank)
        ? 5000
        : 60000
    },
  })
  const reconciliation = useQuery({
    queryKey: ["reconciliation-status"],
    queryFn: getReconciliationStatus,
  })

  const run = current.data?.run
  const inProgress = Boolean(
    run && (run.status === "queued" || run.status === "sending" || run.waiting_at_bank),
  )
  const reconciledTo = reconciliation.data?.reconciled_to
  const sentSince = reconciliation.data?.sent_since ?? 0

  if (!run && !reconciliation.data) return null

  return (
    <div className="space-y-2">
      {run && inProgress && <RunProgress run={run} />}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        {run && !inProgress && (
          <span className="inline-flex items-center gap-1.5">
            <Send className="size-3.5" />
            Last school disbursed: <span className="font-medium text-foreground">{run.school_name}</span>
            {" — "}
            {run.status === "stopped" ? "stopped" : "finished"}{" "}
            {formatDateTime(run.finished_at ?? run.created_at)}
          </span>
        )}
        {reconciliation.data && (
          <span
            className={`inline-flex items-center gap-1.5 ${sentSince ? "text-amber-700" : ""}`}
          >
            <CalendarCheck className="size-3.5" />
            {reconciledTo
              ? `Reconciled with the bank statement up to ${formatDate(reconciledTo)}`
              : "No bank statement reconciled yet"}
            {sentSince > 0 && `; ${sentSince.toLocaleString()} transfer(s) sent since, not yet reconciled`}
          </span>
        )}
      </div>
    </div>
  )
}
