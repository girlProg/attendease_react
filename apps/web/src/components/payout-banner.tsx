import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

import { getCurrentDisbursement, type DisbursementRun } from "@/api/payments"
import { useAuth } from "@/contexts/auth-context"
import { formatAcademicYear } from "@/lib/formatters"
import { anyRunInProgress, runsInProgress, selectRun } from "@/lib/payout-run"

function sum(runs: DisbursementRun[], count: (run: DisbursementRun) => number) {
  return runs.reduce((total, run) => total + count(run), 0)
}

/**
 * In the header of every page, for whoever can see Payments, while schools are
 * being paid: how far they have got. One school: pressing it opens Payments on
 * that school, term and year. Several (Settings › Payments allows it): their
 * figures together, and pressing it opens Payments, where each is listed.
 */
export function PayoutBanner() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const canSee = can("view_payments")
  const current = useQuery({
    queryKey: ["disbursement-current"],
    queryFn: () => getCurrentDisbursement(),
    enabled: canSee,
    refetchInterval: (query) => (anyRunInProgress(query.state.data) ? 5000 : 60000),
  })
  const runs = runsInProgress(current.data)

  if (!canSee || runs.length === 0) return null

  const only = runs.length === 1 ? runs[0] : null
  const total = sum(runs, (run) => Math.max(run.payment_count - run.skipped_count, 0))
  const paid = sum(runs, (run) =>
    run.uploads.reduce((count, upload) => count + upload.counts.successful, 0),
  )
  const failed = sum(runs, (run) =>
    run.uploads.reduce((count, upload) => count + upload.counts.failed, 0),
  )
  const share = (value: number) => `${total ? Math.min((value / total) * 100, 100) : 0}%`
  const when = only
    ? [only.term && `Term ${only.term}`, only.year && formatAcademicYear(String(only.year))]
        .filter(Boolean)
        .join(", ")
    : ""
  const names = runs.map((run) => run.school_name).join(", ")

  return (
    <button
      type="button"
      title={only ? `Open ${only.school_name} on Payments` : `Open Payments: ${names}`}
      onClick={() => {
        if (only) selectRun(only)
        navigate("/payments")
      }}
      className="order-last w-full min-w-0 rounded-xl bg-sidebar/5 px-3.5 py-2 text-left transition hover:bg-sidebar/10 md:order-none md:mx-6 md:w-auto md:max-w-xl md:flex-1"
    >
      <span className="flex flex-wrap items-baseline gap-x-2 xl:flex-nowrap">
        <span className="relative flex size-2 shrink-0 self-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sidebar opacity-50" />
          <span className="relative inline-flex size-2 rounded-full bg-sidebar" />
        </span>
        {/* Short of room the name has its own line; the rest wraps under it. */}
        <span className="min-w-0 max-w-[calc(100%-1rem)] flex-1 basis-[calc(100%-1rem)] truncate text-[13px] font-bold text-sidebar xl:max-w-none xl:flex-initial xl:basis-auto">
          {only ? `Paying ${only.school_name}` : `Paying ${runs.length} schools`}
        </span>
        {when && <span className="shrink-0 text-xs text-muted-foreground">{when}</span>}
        {!only && (
          <span className="min-w-0 shrink truncate text-xs text-muted-foreground">{names}</span>
        )}
        <span className="ml-auto shrink-0 text-xs font-medium text-foreground">
          {paid.toLocaleString()} of {total.toLocaleString()} paid
          {failed > 0 && <span className="text-orange-700"> · {failed.toLocaleString()} failed</span>}
        </span>
      </span>
      <span
        role="progressbar"
        aria-label="Students paid"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={paid}
        className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-sidebar/10"
      >
        <span className="block bg-emerald-600 transition-all" style={{ width: share(paid) }} />
        <span className="block bg-orange-500 transition-all" style={{ width: share(failed) }} />
      </span>
    </button>
  )
}
