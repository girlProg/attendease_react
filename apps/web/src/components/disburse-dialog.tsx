import { useState } from "react"
import { Plus, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { PrimaryButton } from "@/components/primary-button"
import {
  createDisbursementBatch,
  generatePayments,
  type DisbursementBatch,
} from "@/api/payments"
import { getTermAverages } from "@/api/attendance"
import { formatNaira } from "@/lib/formatters"
import type { Payee } from "@/types"

interface BatchErrorData {
  detail?: string
  payments?: Record<string, string>
  batch?: DisbursementBatch
}

function errorInfo(error: unknown): BatchErrorData {
  const resp = (error as { response?: { data?: BatchErrorData } })?.response?.data
  if (resp) return resp
  const message = (error as Error)?.message
  return message ? { detail: message } : {}
}

/**
 * One-step disbursement: generates a pending payment for every qualifying
 * student in the current selection, then disburses all pending payments for the
 * selected term to the bank.
 */
export function DisburseDialog({
  cohort,
  year,
  term,
  school,
  name,
  amount,
  defaultPayee,
  termLabel,
  termSelected,
  triggerClassName,
  triggerLabel,
}: {
  cohort?: number
  year?: string
  term?: string
  school?: number
  name?: string
  amount: string
  defaultPayee: Payee
  termLabel: string | null
  termSelected: boolean
  triggerClassName?: string
  triggerLabel?: string
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  // Payee (Pay Student / Pay Caregiver): defaults to the cohort's setting, can
  // be overridden here for this disbursement.
  const [payeeOverride, setPayeeOverride] = useState<Payee | null>(null)
  const payee = payeeOverride ?? defaultPayee

  const amountNum = parseFloat(amount)
  const amountValid = Number.isFinite(amountNum) && amountNum > 0
  const ready = termSelected && amountValid && Boolean(cohort && year && term)

  const scope = {
    cohort: cohort as number,
    year: year as string,
    term: term as string,
    ...(school ? { school } : {}),
    ...(name ? { name } : {}),
  }

  // Dry-run preview: how many payments would be created for the scope.
  const preview = useQuery({
    queryKey: ["disburse-preview", cohort, year, term, school, name],
    queryFn: () => generatePayments(scope),
    enabled: open && ready,
  })

  const disburse = useMutation({
    mutationFn: async (): Promise<DisbursementBatch> => {
      // 1. Create any missing pending payments for qualifying students.
      await generatePayments({ ...scope, commit: true })
      // 2. Collect all undisbursed payment ids for the term across the scope.
      const list = await getTermAverages({
        ...(year ? { year } : {}),
        ...(school ? { school } : {}),
        ...(cohort ? { cohort } : {}),
        ...(term ? { term } : {}),
        ...(name ? { name } : {}),
        graduated: "false",
        qualifying: "true",
        page: 1,
        page_size: 5000,
      })
      const selectedTerm = Number(term)
      const paymentIds = list.results.flatMap((record) =>
        (record.payments ?? [])
          .filter((payment) => payment.term === selectedTerm && !payment.disbursed)
          .map((payment) => payment.id),
      )
      if (paymentIds.length === 0) {
        throw new Error("No pending payments to disburse for this selection.")
      }
      // 3. Create + submit the disbursement batch (never single-debit).
      return createDisbursementBatch({
        payment_ids: paymentIds,
        amount: amountNum,
        payee,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["term-averages"] })
      queryClient.invalidateQueries({ queryKey: ["disburse-preview"] })
    },
  })

  const result = disburse.data
  const failure = disburse.isError ? errorInfo(disburse.error) : undefined
  // A 502 means the batch WAS created but the bank call failed — it is tracked
  // and will be polled, so surface it as a warning, not a hard error.
  const parkedBatch = failure?.batch

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      disburse.reset()
      setPayeeOverride(null)
    }
  }

  const candidates = preview.data?.total_candidates ?? 0
  const willCreate = preview.data?.would_create ?? 0
  const toDisburse = preview.data?.to_disburse ?? 0
  const estimatedTotal = amountValid ? amountNum * toDisburse : 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex h-11 items-center gap-2 rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5"
        }
      >
        {!triggerClassName && <Plus className="size-4" />}
        {triggerLabel ?? "Disburse Payment"}
      </button>

      <DialogPopup className="max-h-[85vh] overflow-y-auto">
        <DialogTitle>Disburse Payment</DialogTitle>
        <DialogDescription>
          Creates a pending payment for every qualifying student in the current
          selection, then disburses all pending payments for{" "}
          {termLabel ?? "the term"} to the bank.
        </DialogDescription>

        <div className="mt-6 space-y-4">
          {!termSelected && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              Select a term on the page first — payments are disbursed per term.
            </div>
          )}

          {!cohort && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              Select a cohort on the page first — disbursement is scoped to one
              cohort.
            </div>
          )}

          {!year && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              Select a year on the page first — disbursement is scoped to one
              academic year.
            </div>
          )}

          {!amountValid && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              Enter a valid “Amount Per Student” on the page first.
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Payee</span>
            <Select
              value={payee}
              onValueChange={(value) => value && setPayeeOverride(value as Payee)}
            >
              <SelectTrigger className="h-10 w-44 rounded-full border-sidebar/30 !bg-white px-4">
                <SelectValue placeholder="Payee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Pay Student</SelectItem>
                <SelectItem value="caregiver">Pay Caregiver</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {ready && preview.isFetching && (
            <p className="text-sm text-muted-foreground">Checking candidates…</p>
          )}

          {ready && preview.data && (
            <div className="space-y-1 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
              <p>
                Qualifying students{termLabel ? ` (${termLabel})` : ""}:{" "}
                <span className="font-semibold text-foreground">{candidates}</span>
              </p>
              <p>
                New payments to create:{" "}
                <span className="font-semibold text-foreground">{willCreate}</span>
              </p>
              <p>
                Payments to disburse:{" "}
                <span className="font-semibold text-foreground">{toDisburse}</span>
              </p>
              <p>
                Amount each:{" "}
                <span className="font-semibold text-foreground">
                  {formatNaira(amountNum)}
                </span>
              </p>
              <p>
                Estimated total:{" "}
                <span className="font-semibold text-foreground">
                  {formatNaira(estimatedTotal)}
                </span>
              </p>
              <p>
                Payee:{" "}
                <span className="font-semibold text-foreground">
                  {payee === "student" ? "Student" : "Caregiver"}
                </span>
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-1 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle className="size-4 shrink-0" />
                Batch {result.reference} submitted — status {result.status}.
              </p>
              <p className="text-xs">
                {result.counts.total} transaction(s): {result.counts.successful}{" "}
                successful, {result.counts.in_flight} in flight,{" "}
                {result.counts.failed} failed.
              </p>
              {result.skipped && Object.keys(result.skipped).length > 0 && (
                <p className="text-xs">
                  {Object.keys(result.skipped).length} payment(s) skipped
                  (already in progress or disbursed).
                </p>
              )}
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
              disabled={!ready || disburse.isPending || Boolean(result)}
              onClick={() => disburse.mutate()}
            >
              {disburse.isPending ? "Disbursing…" : "Generate & Disburse"}
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
