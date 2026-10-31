import { api } from "../lib/api"
import type { Payee } from "@/types"

export interface DisbursementBatchCounts {
  total: number
  successful: number
  failed: number
  in_flight: number
}

export interface DisbursementBatch {
  id: number
  reference: string
  provider: string
  status: string
  provider_code: string
  provider_description: string
  amount: string
  use_single_debit: boolean
  submitted_at: string | null
  created_by: string
  counts: DisbursementBatchCounts
  created_at: string
  updated_at: string
}

export type DisbursementRunStatus = "queued" | "sending" | "sent" | "stopped"

// One press of Disburse: one school's payments, sent in the background as one
// or more uploads. The latest run is "the last school disbursed".
export interface DisbursementRun {
  id: number
  school: number
  school_name: string
  cohort: number | null
  year: number | null
  term: number | null
  amount: string
  status: DisbursementRunStatus
  status_label: string
  uploads_total: number
  uploads_sent: number
  payment_count: number
  // Payments left ready to send when the run stopped early.
  not_sent_count: number
  // Payments that couldn't go (already paid, in flight, no account...).
  skipped_count: number
  // Its transfers still being worked on at the bank (they hold up the next school).
  waiting_at_bank: number
  // Why it stopped, in words.
  detail: string
  created_by: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  uploads: { reference: string; status: string; counts: DisbursementBatchCounts }[]
}

export interface CurrentDisbursement {
  run: DisbursementRun | null
  // Why the next Disburse can't start yet; null when it can.
  refusal: string | null
}

export interface CreateDisbursementBatchParams {
  payment_ids: number[]
  // A Disburse pays one school; every payment must be in it.
  school: number
  amount: number
  use_single_debit?: boolean
  payee?: Payee
}

/**
 * Disburse one school: saves the run and returns at once; the uploads are sent
 * in the background (follow them with `getCurrentDisbursement`). Refused (409)
 * while the last school disbursed is still being sent or worked on at the bank.
 */
export const createDisbursementBatch = (params: CreateDisbursementBatchParams) =>
  api
    .post<DisbursementRun>("/disbursement-batch/", params)
    .then((response) => response.data)

/** The last school disbursed, its progress, and whether the next can start. */
export const getCurrentDisbursement = () =>
  api
    .get<CurrentDisbursement>("/disbursement-batch/current/")
    .then((response) => response.data)

export interface DisbursementSettings {
  enabled: boolean
  // Diagnostic: every bank status check is written to the audit trail.
  poll_logging: boolean
  // A bigger disbursement goes as several uploads of equal size; null = no limit.
  max_transfers_per_upload: number | null
  updated_at: string | null
  updated_by: string | null
}

/** Read the disbursement and status-check logging switches (admins). */
export const getDisbursementSettings = () =>
  api
    .get<DisbursementSettings>("/disbursement-settings/")
    .then((response) => response.data)

/** Flip either switch (superusers only); send just the one that changes. */
export const setDisbursementSettings = (
  changes: Partial<
    Pick<DisbursementSettings, "enabled" | "poll_logging" | "max_transfers_per_upload">
  >,
) =>
  api
    .put<DisbursementSettings>("/disbursement-settings/", changes)
    .then((response) => response.data)

export interface GeneratePaymentsResult {
  created: number
  would_create: number
  to_disburse: number
  skipped_existing: number
  skipped_no_account: number
  total_candidates: number
  committed: boolean
}

/**
 * Create pending (undisbursed) Payment rows for the disbursable students in the
 * current payments-page scope. The filters (cohort, year, term, school, search)
 * go as query params so the backend applies the same scoping as the list —
 * letting generation target a single school. Dry run unless `commit` is true;
 * idempotent (skips students already paid or without a usable account).
 */
/**
 * Manually kick a bank status-check for every in-flight disbursement batch.
 * Returns how many were queued. Advancing to terminal still depends on the
 * bank; this just forces a check now instead of waiting for the schedule.
 */
export const pollPendingDisbursements = () =>
  api
    .post<{ queued: number }>("/disbursement-batch/poll-pending/")
    .then((response) => response.data)

/**
 * Every payment the Disburse button should send for the page's filters, in
 * full (gathered on the server, so never limited to one page of the list):
 * the term's undisbursed payments of the students the page lists, minus any
 * already in flight at the bank.
 */
export const getPendingPayments = (scope: {
  cohort: number | string
  year: string | number
  term: string | number
  school?: number | string
  lga?: number
  name?: string
}) =>
  api
    .get<{ payment_ids: number[]; count: number; students: number }>(
      "/student/pending-payments/",
      { params: scope },
    )
    .then((response) => response.data)

export const generatePayments = ({
  commit,
  ...scope
}: {
  cohort: number | string
  year: string | number
  term: string | number
  school?: number | string
  lga?: number
  name?: string
  commit?: boolean
}) =>
  api
    .post<GeneratePaymentsResult>(
      "/student/generate-payments/",
      { commit },
      { params: scope },
    )
    .then((response) => response.data)
