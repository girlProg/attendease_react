import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/types"

// Payments › Reconciliation: a Zenith statement matched against the transfers
// we sent, narration by narration. The statement and its result are kept.

export type FindingKind = "paid_twice" | "paid_not_recorded" | "recorded_not_debited"

export interface ReconciliationTotals {
  statement_lines: number
  transfer_debits: number
  transfer_debit_amount: string
  reversals: number
  reversal_amount: string
  net_debits: number
  transfers_sent: number
  recorded_paid: number
  recorded_paid_amount: string
  narrations_agree: number
  exceptions: number
  paid_twice: number
  paid_not_recorded: number
  recorded_not_debited: number
  // Lines starting "AGILE" that didn't read as a transfer.
  unreadable_lines: number
}

export interface ReconciliationFinding {
  kind: FindingKind
  label: string
  narration: string
  statement_debits: number
  statement_reversals: number
  recorded_paid: number
  difference: number
  transfers: {
    transaction_ref: string
    status: string
    payment: number
    student: string
    school: string
    batch: string
    sent_at: string
  }[]
  statement_lines: {
    line: number
    date: string
    bank_ref: string
    amount: string
    reversal: boolean
  }[]
}

export interface Reconciliation {
  id: number
  filename: string
  period_start: string
  period_end: string
  totals: ReconciliationTotals
  exception_count: number
  uploaded_by: string
  created_at: string
  // Detail only.
  exceptions?: ReconciliationFinding[]
}

export interface ReconciliationStatus {
  // The last day the statements uploaded so far cover; null before the first.
  reconciled_to: string | null
  // Transfers sent after it, not yet reconciled.
  sent_since: number
}

export const getReconciliations = (page = 1) =>
  api
    .get<PaginatedResponse<Reconciliation>>("/payment-reconciliation/", { params: { page } })
    .then((response) => response.data)

export const getReconciliation = (id: number) =>
  api.get<Reconciliation>(`/payment-reconciliation/${id}/`).then((response) => response.data)

export const getReconciliationStatus = () =>
  api
    .get<ReconciliationStatus>("/payment-reconciliation/status/")
    .then((response) => response.data)

/** Upload a statement (.xlsx); it is reconciled and kept. */
export const uploadStatement = (file: File) => {
  const data = new FormData()
  data.append("file", file)
  return api
    .post<Reconciliation>("/payment-reconciliation/upload/", data)
    .then((response) => response.data)
}

async function download(path: string, fallbackName: string) {
  const response = await api.get(path, { responseType: "blob" })
  const disposition = String(response.headers["content-disposition"] ?? "")
  const match = disposition.match(/filename="?([^";]+)"?/)
  const url = URL.createObjectURL(response.data as Blob)
  const link = document.createElement("a")
  link.href = url
  link.download = match?.[1] ?? fallbackName
  link.click()
  URL.revokeObjectURL(url)
}

export const downloadStatement = (reconciliation: Reconciliation) =>
  download(`/payment-reconciliation/${reconciliation.id}/file/`, reconciliation.filename)

export const downloadFindings = (reconciliation: Reconciliation) =>
  download(
    `/payment-reconciliation/${reconciliation.id}/exceptions-csv/`,
    `reconciliation-${reconciliation.period_start}-to-${reconciliation.period_end}.csv`,
  )
