import type { HistoricAttendance, HistoricPayment } from "@/api/historic"

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
