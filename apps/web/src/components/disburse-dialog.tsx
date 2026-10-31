import { useState } from "react"
import { Plus, CheckCircle, AlertCircle, AlertTriangle, Loader2 } from "lucide-react"
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
  getCurrentDisbursement,
  getPendingPayments,
  generatePayments,
  type DisbursementRun,
} from "@/api/payments"
import { formatNaira } from "@/lib/formatters"
import type { Payee } from "@/types"

function errorDetail(error: unknown): string {
  const data = (error as { response?: { data?: { detail?: string; school?: string[] } } })
    ?.response?.data
  return (
    data?.detail ??
    data?.school?.[0] ??
    (error as Error)?.message ??
    "Could not disburse. Please try again."
  )
}

/** How far a run has got, as the progress panel shows it. */
export function RunProgress({ run }: { run: DisbursementRun }) {
  const finished = run.status === "sent" && run.waiting_at_bank === 0
  const tone =
    run.status === "stopped"
      ? "bg-amber-50 text-amber-800"
      : finished
        ? "bg-emerald-50 text-emerald-700"
        : "bg-sky-50 text-sky-800"
  const headline =
    run.status === "queued"
      ? "Waiting to start…"
      : run.status === "sending"
        ? `Sending upload ${Math.min(run.uploads_sent + 1, run.uploads_total || 1)} of ${run.uploads_total || "…"}…`
        : run.status === "stopped"
          ? `Stopped after ${run.uploads_sent} of ${run.uploads_total} upload(s).`
          : finished
            ? `Finished: ${run.uploads_sent} upload(s) sent and settled at the bank.`
            : `${run.uploads_sent} upload(s) sent; ${run.waiting_at_bank} transfer(s) waiting for the bank.`
  return (
    <div className={`space-y-1 rounded-lg p-3 text-sm ${tone}`}>
      <p className="flex items-center gap-2 font-medium">
        {run.status === "stopped" ? (
          <AlertTriangle className="size-4 shrink-0" />
        ) : finished ? (
          <CheckCircle className="size-4 shrink-0" />
        ) : (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        )}
        {run.school_name}: {headline}
      </p>
      {run.detail && <p className="text-xs">{run.detail}</p>}
      {run.uploads.length > 0 && (
        <ul className="list-disc pl-5 text-xs">
          {run.uploads.map((upload) => (
            <li key={upload.reference}>
              {upload.reference}: {upload.counts.total} transfer(s) —{" "}
              {upload.counts.successful} successful, {upload.counts.in_flight} in flight,{" "}
              {upload.counts.failed} failed
            </li>
          ))}
        </ul>
      )}
      {run.skipped_count > 0 && (
        <p className="text-xs">
          {run.skipped_count} payment(s) skipped (already paid, in progress or no account).
        </p>
      )}
      {run.not_sent_count > 0 && (
        <p className="text-xs">
          {run.not_sent_count} payment(s) were not sent and are still ready to send.
        </p>
      )}
    </div>
  )
}

/**
 * Disburse one school: generates a pending payment for every qualifying
 * student in the school, then sends all its pending payments for the selected
 * term. The sending happens in the background, so the panel follows it; the
 * next school can be paid once this one is finished at the bank.
 */
export function DisburseDialog({
  cohort,
  year,
  term,
  school,
  lga,
  scopeReady = true,
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
  lga?: number
  // False while the page's chosen cohort/LGA/school are still resolving to
  // IDs — disbursing then would target a wider scope than the one on screen.
  scopeReady?: boolean
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
  const ready =
    scopeReady && termSelected && amountValid && Boolean(cohort && year && term && school)

  // The last school disbursed: its progress, and whether the next can start.
  // Followed every few seconds while the dialog is open.
  const current = useQuery({
    queryKey: ["disbursement-current"],
    queryFn: getCurrentDisbursement,
    enabled: open,
    refetchInterval: open ? 3000 : false,
  })
  const refusal = current.data?.refusal ?? null

  const scope = {
    cohort: cohort as number,
    year: year as string,
    term: term as string,
    ...(school ? { school } : {}),
    ...(lga ? { lga } : {}),
    ...(name ? { name } : {}),
  }

  // Dry-run preview: how many payments would be created for the scope.
  const preview = useQuery({
    queryKey: ["disburse-preview", cohort, year, term, school, lga, name],
    queryFn: () => generatePayments(scope),
    enabled: open && ready,
  })

  const disburse = useMutation({
    mutationFn: async (): Promise<DisbursementRun> => {
      // 1. Create any missing pending payments for qualifying students.
      await generatePayments({ ...scope, commit: true })
      // 2. Collect every pending payment for the term in the school — on the
      //    server, in full (one page of the list holds at most 1,000 rows).
      const { payment_ids: paymentIds } = await getPendingPayments(scope)
      if (paymentIds.length === 0) {
        throw new Error("No pending payments to disburse for this school.")
      }
      // 3. Save the run; the uploads go in the background (never single-debit).
      return createDisbursementBatch({
        payment_ids: paymentIds,
        school: school as number,
        amount: amountNum,
        payee,
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["disbursement-current"] })
      queryClient.invalidateQueries({ queryKey: ["term-averages"] })
      queryClient.invalidateQueries({ queryKey: ["disburse-preview"] })
    },
  })

  // The run this press started, as it progresses.
  const startedRun =
    disburse.data && current.data?.run?.id === disburse.data.id
      ? current.data.run
      : disburse.data

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
          Pays one school at a time: creates a pending payment for every
          qualifying student in the selected school, then sends all its pending
          payments for {termLabel ?? "the term"} to the bank. The next school
          can be paid once this one is finished at the bank.
        </DialogDescription>

        <div className="mt-6 space-y-4">
          {!school && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              Choose a school on the page first — Disburse pays one school at a time.
            </div>
          )}

          {refusal && !startedRun && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {refusal}
              </div>
              {current.data?.run && <RunProgress run={current.data.run} />}
            </div>
          )}

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
                <SelectValue placeholder="Payee">
                  {payee === "student" ? "Pay Student" : "Pay Caregiver"}
                </SelectValue>
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

          {startedRun && (
            <>
              <RunProgress run={startedRun} />
              <p className="text-xs text-muted-foreground">
                You can close this window: the sending carries on, and the Payments
                page shows how far it has got. Don't press Disburse again for this
                school.
              </p>
            </>
          )}

          {disburse.isError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {errorDetail(disburse.error)}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
              Close
            </DialogClose>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={!ready || Boolean(refusal) || disburse.isPending || Boolean(startedRun)}
              onClick={() => disburse.mutate()}
            >
              {disburse.isPending ? "Starting…" : "Generate & Disburse"}
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
