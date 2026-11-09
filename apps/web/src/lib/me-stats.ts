import type { CSSProperties } from "react"

import type { MeStatsCell, MeStatsRow } from "@/api/me-stats"

// Under this share of the row paid, a year reads as hardly paid at all.
export const HARDLY_PAID_SHARE = 0.01

export const NO_PAYMENTS_STRIPES: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgb(251 214 190 / 0.75) 0 5px, rgb(255 247 240) 5px 11px)",
}

export function shortNaira(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `₦${Math.round(amount / 1_000)}k`
  return `₦${amount.toLocaleString()}`
}

export function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`
}

export function isHistoric(cell: MeStatsCell): boolean {
  return cell.source === "entered" || cell.source === "historic"
}

export function isDue(cell: MeStatsCell, thisYear: number): boolean {
  return (
    cell.year === thisYear && cell.paid === null && !cell.graduated && cell.ongoing_terms.length === 0
  )
}

/** A past year with no payment and nothing still being paid. */
export function hasNoPayments(cell: MeStatsCell, thisYear: number): boolean {
  return (
    !cell.graduated &&
    !cell.upcoming &&
    cell.paid === null &&
    cell.ongoing_terms.length === 0 &&
    !isDue(cell, thisYear)
  )
}

/** A cohort's first term of its enrolment year is its enrollment payment. */
export function termName(step: number, term: number): string {
  return step === 0 && term === 1 ? "Enrollment" : `Term ${term}`
}

/** "Term 3", "Terms 1, 2 & 3", "Enrollment & Term 2". */
export function termsPaidText(cell: MeStatsCell): string {
  const hasEnrollment = cell.step === 0 && cell.terms.includes(1)
  const others = cell.terms.filter((term) => !(hasEnrollment && term === 1))
  const joined =
    others.length > 1
      ? `${others.slice(0, -1).join(", ")} & ${others[others.length - 1]}`
      : others.join("")
  const terms = others.length === 0 ? "" : `${others.length === 1 ? "Term" : "Terms"} ${joined}`
  if (!hasEnrollment) return terms
  return terms ? `Enrollment & ${terms}` : "Enrollment"
}

/** "1st Cohort (JSS 1)" without the class, which the page shows on its own. */
export function rowTitle(row: MeStatsRow): string {
  return row.details.replace(/\s*\([^)]*\)$/, "")
}
