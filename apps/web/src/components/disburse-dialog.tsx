import { useState } from "react"
import { Plus, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { PrimaryButton } from "@/components/primary-button"
import { createDisbursementBatch, type DisbursementBatch } from "@/api/payments"
import { formatNaira } from "@/lib/formatters"
import type { Payee } from "@/types"

interface BatchErrorData {
  detail?: string
  payments?: Record<string, string>
  batch?: DisbursementBatch
}

function errorData(error: unknown): BatchErrorData {
  return (error as { response?: { data?: BatchErrorData } })?.response?.data ?? {}
}

export function DisburseDialog({
  paymentIds,
  amount,
  payee,
  termLabel,
  termSelected,
}: {
  paymentIds: number[]
  amount: string
  payee: Payee
  termLabel: string | null
  termSelected: boolean
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [useSingleDebit, setUseSingleDebit] = useState(false)

  const amountNum = parseFloat(amount)
  const amountValid = Number.isFinite(amountNum) && amountNum > 0
  const count = paymentIds.length
  const ready = termSelected && amountValid && count > 0

  const mutation = useMutation({
    mutationFn: () =>
      createDisbursementBatch({
        payment_ids: paymentIds,
        amount: amountNum,
        use_single_debit: useSingleDebit,
        payee,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["term-averages"] })
    },
  })

  const result = mutation.data
  const failure = mutation.isError ? errorData(mutation.error) : undefined
  // A 502 means the batch WAS created but the bank call failed — it is tracked
  // and will be polled, so surface it as a warning, not a hard error.
  const parkedBatch = failure?.batch

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) mutation.reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5"
      >
        <Plus className="size-4" />
        Disburse Payment
      </button>

      <DialogPopup className="max-h-[85vh] overflow-y-auto">
        <DialogTitle>Disburse Payment</DialogTitle>
        <DialogDescription>
          Send a bank transfer for each pending payment in the current view. Only
          students who already have an undisbursed payment for the selected term
          are included.
        </DialogDescription>

        <div className="mt-6 space-y-4">
          {!termSelected && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              Select a term on the page first — payments are disbursed per term.
            </div>
          )}

          {!amountValid && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              Enter a valid “Amount Per Student” on the page first.
            </div>
          )}

          {termSelected && amountValid && count === 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              No pending (undisbursed) payments for {termLabel} in the current view.
            </div>
          )}

          <div className="space-y-1 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
            <p>
              Payments: <span className="font-semibold text-foreground">{count}</span>
              {termLabel ? ` (${termLabel})` : ""}
            </p>
            <p>
              Amount each:{" "}
              <span className="font-semibold text-foreground">
                {amountValid ? formatNaira(amountNum) : "—"}
              </span>
            </p>
            <p>
              Total debit:{" "}
              <span className="font-semibold text-foreground">
                {amountValid ? formatNaira(amountNum * count) : "—"}
              </span>
            </p>
            <p>
              Payee:{" "}
              <span className="font-semibold text-foreground">
                {payee === "student" ? "Student" : "Caregiver"}
              </span>
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={useSingleDebit}
              onChange={(event) => setUseSingleDebit(event.target.checked)}
              className="size-4 rounded border-border"
            />
            Single debit (one debit for the whole batch)
          </label>

          {result && (
            <div className="space-y-1 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle className="size-4 shrink-0" />
                Batch {result.reference} submitted — status {result.status}.
              </p>
              <p className="text-xs">
                {result.counts.total} transaction(s):{" "}
                {result.counts.successful} successful, {result.counts.in_flight} in
                flight, {result.counts.failed} failed.
              </p>
            </div>
          )}

          {parkedBatch && (
            <div className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4 shrink-0" />
                Batch {parkedBatch.reference} was created but the bank call did not
                confirm.
              </p>
              <p className="text-xs">
                It is queued for a status check — do not re-submit. {failure?.detail}
              </p>
            </div>
          )}

          {failure && !parkedBatch && (
            <div className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p className="flex items-center gap-2 font-medium">
                <AlertCircle className="size-4 shrink-0" />
                {failure.detail ?? "Could not disburse. Please try again."}
              </p>
              {failure.payments && (
                <ul className="list-disc pl-5 text-xs">
                  {Object.entries(failure.payments)
                    .slice(0, 5)
                    .map(([pk, message]) => (
                      <li key={pk}>
                        Payment #{pk}: {message}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
              Close
            </DialogClose>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={!ready || mutation.isPending || Boolean(result)}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Submitting…" : `Disburse ${count} Payment(s)`}
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
