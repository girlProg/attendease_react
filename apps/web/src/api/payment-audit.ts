import { api } from "@/lib/api"
import { downloadBlobFromResponse } from "@/lib/blob-download"
import type { PaginatedResponse } from "@/types"

export type AuditEventType =
  | "batch_created"
  | "batch_submitted"
  | "batch_submit_failed"
  | "batch_status_changed"
  | "transaction_submitted"
  | "transaction_status_changed"
  | "payment_marked_paid"
  | "duplicate_payment_blocked"
  | "poll_cap_reached"
  | "refresh_requested"
  | "poll_pending_requested"
  | "disbursement_switch_toggled"
  | "payments_generated"
  | "no_objection_created"
  | "no_objection_deleted"
  | "status_snapshot"

// Human labels, in the order the filter dropdown lists them (mirrors the
// backend's AuditEventType choices).
export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  batch_created: "Batch created",
  batch_submitted: "Batch submitted to bank",
  batch_submit_failed: "Batch submission failed",
  batch_status_changed: "Batch status changed",
  transaction_submitted: "Transfer submitted",
  transaction_status_changed: "Transfer status changed",
  payment_marked_paid: "Payment marked as paid",
  duplicate_payment_blocked: "Duplicate payment blocked",
  poll_cap_reached: "Status polling gave up",
  refresh_requested: "Status refresh requested",
  poll_pending_requested: "Refresh of all in-flight batches",
  disbursement_switch_toggled: "Disbursements switched",
  payments_generated: "Payment records generated",
  no_objection_created: "No Objection list created",
  no_objection_deleted: "No Objection list deleted",
  status_snapshot: "Status snapshot (backfilled)",
}

export const AUDIT_EVENT_TYPES = Object.keys(AUDIT_EVENT_LABELS) as AuditEventType[]

export type AuditSource = "api" | "task" | "admin" | "migration"

export interface PaymentAuditEvent {
  id: number
  occurred_at: string
  event_type: AuditEventType
  event_type_label: string
  source: AuditSource
  source_label: string
  actor: number | null
  // null for system events (the background poller, a backfill)
  actor_name: string | null
  batch: number | null
  batch_reference: string
  transaction: number | null
  transaction_ref: string
  payment: number | null
  student: number | null
  student_name: string
  previous_status: string
  new_status: string
  bank_status: string
  provider_code: string
  description: string
  // Snapshot + event-specific extras; account numbers are already masked.
  details: Record<string, unknown>
}

// Every filter the audit endpoint declares. Unknown params are dropped
// server-side, so add new ones on both ends.
export interface PaymentAuditFilters {
  batch?: number
  batch_reference?: string
  transaction?: number
  payment?: number
  student?: number
  event_type?: AuditEventType | ""
  source?: AuditSource | ""
  actor?: number
  actor_name?: string
  occurred_after?: string
  occurred_before?: string
  term?: string | number
  year?: string | number
  cohort?: number
  school?: number
  lga?: number
  search?: string
}

function cleanParams(filters: PaymentAuditFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue
    params[key] = value as string | number
  }
  return params
}

export const getPaymentAuditEvents = (filters: PaymentAuditFilters, page: number, pageSize: number) =>
  api
    .get<PaginatedResponse<PaymentAuditEvent>>("/payment-audit/", {
      params: { ...cleanParams(filters), page, page_size: pageSize },
    })
    .then((response) => response.data)

export const exportPaymentAudit = (filters: PaymentAuditFilters) =>
  api
    .get("/payment-audit/export/", { params: cleanParams(filters), responseType: "blob" })
    .then((response) => downloadBlobFromResponse(response, "payment_audit.csv"))
