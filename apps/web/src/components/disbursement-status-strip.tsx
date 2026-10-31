import { Send } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { RunProgress } from "@/components/disburse-dialog"
import { getCurrentDisbursement } from "@/api/payments"
import { formatDateTime } from "@/lib/formatters"

/**
 * Payments page, admins: the last school disbursed (its progress while it is
 * being sent or waiting at the bank, since the next school waits for it). How
 * far the bank statements reach is on the Reconciliation page.
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
  const run = current.data?.run
  const inProgress = Boolean(
    run && (run.status === "queued" || run.status === "sending" || run.waiting_at_bank),
  )

  if (!run) return null

  return inProgress ? (
    <RunProgress run={run} />
  ) : (
    <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
      <Send className="size-3.5" />
      Last school disbursed: <span className="font-medium text-foreground">{run.school_name}</span>
      {" — "}
      {run.status === "stopped" ? "stopped" : "finished"}{" "}
      {formatDateTime(run.finished_at ?? run.created_at)}
    </p>
  )
}
