import type { HistoricAttendance, HistoricParams, HistoricPayment } from "@/api/historic"
import type { FilterScope } from "@/hooks/use-attendance-filters"

// The records have no weeks, so a page's week filter doesn't apply to them.
export function historicScope({ cohort, lga, school, year, term }: FilterScope): HistoricParams {
  return { cohort, lga, school, year, term }
}

/** Added after a total's own note: what part of it is from before the MIS. */
export function includesHistoric(text: string | undefined, figure: number, shown?: string): string | undefined {
  if (!figure) return text
  const part = `incl. ${shown ?? figure.toLocaleString()} Historic`
  return text ? `${text} · ${part}` : part
}

export function historicTerm(row: { year: number; term: number }): string {
  return `Term ${row.term}, ${row.year}`
}

export function historicAttendanceFigure(row: HistoricAttendance): string {
  const expected = row.days_expected === null ? "?" : Number(row.days_expected)
  const days = row.days_present === null ? "" : `${Number(row.days_present)} of ${expected} days`
  const percent = row.percent === null ? "" : `${Number(row.percent)}%`
  return [days, percent].filter(Boolean).join(" · ")
}

export function historicAccount(row: HistoricPayment): string {
  return [row.bank_name, row.account_number].filter(Boolean).join(" · ")
}
