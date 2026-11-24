import type { QueryClient } from "@tanstack/react-query"

import type { CurrentDisbursement, DisbursementRun } from "@/api/payments"
import { chooseFilters } from "@/hooks/use-attendance-filters"

/** Set the filters to this run's school, term and year. */
export function selectRun(run: DisbursementRun) {
  chooseFilters({
    cohort: run.cohort_name,
    lga: run.lga_name,
    school: run.school_name,
    year: run.year === null ? null : String(run.year),
    term: run.term === null ? null : String(run.term),
  })
}

/** A run is still moving money: being sent, or transfers the bank hasn't answered. */
export function runInProgress(run: DisbursementRun | null | undefined): boolean {
  return Boolean(
    run && (run.status === "queued" || run.status === "sending" || run.waiting_at_bank > 0),
  )
}

/** Every school in progress, oldest first (several can be: Settings › Payments). */
export function runsInProgress(current: CurrentDisbursement | undefined): DisbursementRun[] {
  if (!current) return []
  // A server from before `runs` sends only the last school.
  return current.runs ?? (runInProgress(current.run) && current.run ? [current.run] : [])
}

export function anyRunInProgress(current: CurrentDisbursement | undefined): boolean {
  return runsInProgress(current).length > 0
}

/**
 * After Refresh: the bank is asked in the background, so read the statuses now
 * and again as the answers land. Unknown rows aren't followed on their own
 * (nothing asks the bank about them until someone presses Refresh).
 */
export function rereadAfterRefresh(queryClient: QueryClient) {
  const reread = () => {
    queryClient.invalidateQueries({ queryKey: ["term-averages"] })
    queryClient.invalidateQueries({ queryKey: ["disbursement-current"] })
  }
  reread()
  for (const seconds of [5, 15, 30]) window.setTimeout(reread, seconds * 1000)
}

/** "00:58" today, "31 Oct 17:58" before. */
export function shortWhen(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  if (date.toDateString() === new Date().toDateString()) return time
  return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`
}
