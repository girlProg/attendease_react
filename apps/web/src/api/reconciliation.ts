import { api } from "@/lib/api"
import { downloadFile } from "@/lib/blob-download"
import type { PaginatedResponse } from "@/types"

// Payments › Reconciliation: a Zenith statement matched against the transfers
// we sent, narration by narration. The statement and its result are kept.

export type FindingKind = "paid_twice" | "paid_not_recorded" | "recorded_not_debited" | "yet_to_reconcile"

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
  // Transfers sent the day before or after that the bank posted on these
  // dates (not in reconciliations from before 2026-11-03).
  sent_on_neighbouring_days?: number
  // Transfers sent on the statement's last day that it doesn't show yet: not
  // findings, for the next statement (not in reconciliations from before
  // 2026-11-12).
  yet_to_reconcile?: number
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
  yet_to_reconcile?: ReconciliationFinding[]
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

export const downloadStatement = (reconciliation: Reconciliation) =>
  downloadFile(`/payment-reconciliation/${reconciliation.id}/file/`, reconciliation.filename)

export const downloadFindings = (reconciliation: Reconciliation) =>
  downloadFile(
    `/payment-reconciliation/${reconciliation.id}/exceptions-csv/`,
    `reconciliation-${reconciliation.period_start}-to-${reconciliation.period_end}.csv`,
  )
