import { Send } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { RunProgress } from "@/components/disburse-dialog"
import { getCurrentDisbursement } from "@/api/payments"
import { formatDateTime } from "@/lib/formatters"
import { anyRunInProgress, runsInProgress, selectRun } from "@/lib/payout-run"

/**
 * Payments page, admins: every school in progress (being sent or waiting at
 * the bank, since each holds a place the next school needs), or the last
 * school disbursed once none is. How far the bank statements reach is on the
 * Reconciliation page.
 */
export function DisbursementStatusStrip() {
  const current = useQuery({
    queryKey: ["disbursement-current"],
    queryFn: () => getCurrentDisbursement(),
    // Follow schools while any is in progress; otherwise check now and then.
    refetchInterval: (query) => (anyRunInProgress(query.state.data) ? 5000 : 60000),
  })
  const run = current.data?.run
  const inProgress = runsInProgress(current.data)

  if (!run) return null

  return inProgress.length > 0 ? (
    <div className="space-y-2">
      {inProgress.map((running) => (
        <button
          key={running.id}
          type="button"
          title={`Show ${running.school_name}`}
          onClick={() => selectRun(running)}
          className="block w-full text-left"
        >
          <RunProgress run={running} />
        </button>
      ))}
    </div>
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
