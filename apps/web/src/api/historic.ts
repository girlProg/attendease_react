import { api } from "@/lib/api"
import { downloadFile } from "@/lib/blob-download"
import type { PaginatedResponse } from "@/types"

// Records from before the MIS, as written in the programme's own files.
interface HistoricRow {
  id: number
  cohort: number
  cohort_name: string
  student: number | null
  beneficiary_id: string
  match: "name_phone" | "name_school" | "name_lga" | "none"
  year: number
  term: number
  lga_name: string
  school_name: string
  student_name: string
  admission_number: string
  class_name: string
  guardian_name: string
  guardian_phone: string
  comment: string
  repeated: boolean
  // What this row says that the student's record no longer does.
  differs_from_current: string[]
}

export interface HistoricAttendance extends HistoricRow {
  days_expected: string | null
  days_present: string | null
  days_absent: string | null
  percent: string | null
  needs_check: boolean
}

export interface HistoricPayment extends HistoricRow {
  amount: string
  // Not sent to viewers.
  bank_name?: string
  account_number?: string
  bvn?: string
}

export type HistoricParams = Record<string, string | number | boolean | undefined>

const list = <Row>(path: string) => (params: HistoricParams) =>
  api.get<PaginatedResponse<Row>>(path, { params }).then((response) => response.data)

export const getHistoricAttendance = list<HistoricAttendance>("/historic-attendance/")
export const getHistoricPayments = list<HistoricPayment>("/historic-payment/")

interface HistoricFigures {
  records: number
  students: number
  // Attendance only.
  average?: string | null
  // Payments only.
  amount?: string | null
}

export interface HistoricSummary extends HistoricFigures {
  by_term: (HistoricFigures & { year: number; term: number })[]
}

export type HistoricKind = "attendance" | "payment"

// Totals for a page's filters, shown marked Historic beside its own figures.
export const getHistoricSummary = (kind: HistoricKind, params: HistoricParams) =>
  api
    .get<HistoricSummary>(`/historic-${kind}/summary/`, { params })
    .then((response) => response.data)

export const downloadHistoric = (kind: HistoricKind, params: HistoricParams) =>
  downloadFile(`/historic-${kind}/export/`, `Historic ${kind}.csv`, { params })
