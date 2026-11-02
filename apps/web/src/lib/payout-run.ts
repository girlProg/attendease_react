import type { DisbursementRun } from "@/api/payments"

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
