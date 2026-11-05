import type { DisbursementRun } from "@/api/payments"
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

/** "00:58" today, "31 Oct 17:58" before. */
export function shortWhen(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  if (date.toDateString() === new Date().toDateString()) return time
  return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`
}
