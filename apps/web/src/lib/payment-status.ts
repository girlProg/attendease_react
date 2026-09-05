import type { StatusVariant } from "@/components/status-badge"

export interface StatusBadgeSpec {
  variant: StatusVariant
  label: string
}

// Badge for a bare transfer status (the canonical `status` on a disbursement
// transaction/batch), optionally labelled with the bank's own status word.
// Every state gets its own colour so no two stages look alike.
export function transferStatusBadge(status: string | null | undefined, bankStatus?: string | null): StatusBadgeSpec {
  const bankLabel = bankStatus?.trim().toUpperCase()
  switch (status) {
    case "successful":
      return { variant: "success", label: "SUCCESS" }
    case "pending":
      // The row exists but the upload never reached the bank.
      return { variant: "neutral", label: "NOT SENT" }
    case "submitted":
      return { variant: "submitted", label: bankLabel || "SUBMITTED" }
    case "processing":
      // Zenith's post-upload state is "awaiting approval" (mapped to processing).
      return { variant: "warning", label: bankLabel || "AWAITING APPROVAL" }
    case "unknown":
      return { variant: "unknown", label: bankLabel || "UNKNOWN" }
    case "failed":
      return { variant: "error", label: bankLabel || "FAILED" }
    case "failed_retryable":
      return { variant: "retry", label: bankLabel ? `${bankLabel} (RETRYABLE)` : "FAILED (RETRYABLE)" }
    default:
      return { variant: "muted", label: status ? status.toUpperCase() : "—" }
  }
}

// Map a payment (from the payments page) to its status badge. `disbursed`
// (bank-confirmed) wins; otherwise the colour follows our canonical mapping of
// the latest disbursement transaction, while the LABEL is the bank's own status
// word verbatim (`disbursement_bank_status`, e.g. "awaiting approval") whenever
// we have one — so the page always shows exactly what Zenith last said.
export function paymentStatusBadge(payment?: {
  disbursed: boolean
  disbursement_status?: string | null
  disbursement_bank_status?: string | null
}): StatusBadgeSpec {
  if (payment?.disbursement_status === "successful") {
    return { variant: "success", label: "SUCCESS" }
  }
  // A payment flagged disbursed with no transaction behind it is a legacy
  // import — same state, same colour, but labelled by its provenance.
  if (payment?.disbursed) {
    return { variant: "success", label: "DISBURSED" }
  }
  if (!payment?.disbursement_status) {
    return { variant: "muted", label: "NOT DISBURSED" }
  }
  return transferStatusBadge(payment.disbursement_status, payment.disbursement_bank_status)
}
