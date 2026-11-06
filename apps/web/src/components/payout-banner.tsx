import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

import { getCurrentDisbursement } from "@/api/payments"
import { useAuth } from "@/contexts/auth-context"
import { formatAcademicYear } from "@/lib/formatters"
import { runInProgress, selectRun } from "@/lib/payout-run"

/**
 * In the header of every page, for whoever can see Payments, while a school is
 * being paid: how far it has got. Pressing it opens Payments on that school, term and year.
 */
export function PayoutBanner() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const canSee = can("view_payments")
  const current = useQuery({
    queryKey: ["disbursement-current"],
    queryFn: getCurrentDisbursement,
    enabled: canSee,
    refetchInterval: (query) => (runInProgress(query.state.data?.run) ? 5000 : 60000),
  })
  const run = current.data?.run

  if (!canSee || !run || !runInProgress(run)) return null

  const total = Math.max(run.payment_count - run.skipped_count, 0)
  const paid = run.uploads.reduce((sum, upload) => sum + upload.counts.successful, 0)
  const failed = run.uploads.reduce((sum, upload) => sum + upload.counts.failed, 0)
  const share = (value: number) => `${total ? Math.min((value / total) * 100, 100) : 0}%`
  const when = [run.term && `Term ${run.term}`, run.year && formatAcademicYear(String(run.year))]
    .filter(Boolean)
    .join(", ")

  return (
    <button
      type="button"
      title={`Open ${run.school_name} on Payments`}
      onClick={() => {
        selectRun(run)
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

          Paying {run.school_name}
        </span>
        {when && <span className="shrink-0 text-xs text-muted-foreground">{when}</span>}
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
