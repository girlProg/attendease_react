import { useState } from "react"
import { Wallet, CheckCircle, AlertCircle } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { PrimaryButton } from "@/components/primary-button"
import { generatePayments, type GeneratePaymentsResult } from "@/api/payments"

function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { error?: string } } })?.response?.data
  return data?.error ?? fallback
}

/**
 * Creates pending Payment rows for the qualifying students in the selected
 * (cohort, year, term). Runs a dry-run preview first, then commits.
 */
export function GeneratePaymentsDialog({
  cohort,
  year,
  term,
}: {
  cohort?: number
  year?: string
  term?: string
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const ready = Boolean(cohort && year && term)

  const preview = useMutation({
    mutationFn: () =>
      generatePayments({ cohort: cohort as number, year: year as string, term: term as string }),
  })

  const commit = useMutation({
    mutationFn: () =>
      generatePayments({
        cohort: cohort as number,
        year: year as string,
        term: term as string,
        commit: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["term-averages"] })
    },
  })

  const result: GeneratePaymentsResult | undefined = commit.data ?? preview.data

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && ready) {
      preview.mutate() // fetch the dry-run counts as the dialog opens
    } else if (!next) {
      preview.reset()
      commit.reset()
    }
  }

  const done = Boolean(commit.data)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5"
      >
        <Wallet className="size-4" />
        Generate Payments
      </button>

      <DialogPopup className="max-h-[85vh] overflow-y-auto">
        <DialogTitle>Generate Payments</DialogTitle>
        <DialogDescription>
          Create a pending payment for each qualifying student in the selected
          cohort, year and term. Students already paid for the term, and those
          without a usable 10-digit account, are skipped. Safe to re-run.
        </DialogDescription>

        <div className="mt-6 space-y-4">
          {!ready && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              Select a cohort, year and term on the page first.
            </div>
          )}

          {preview.isPending && (
            <p className="text-sm text-muted-foreground">Checking candidates…</p>
          )}

          {result && (
            <div className="space-y-1 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
              <p>
                Qualifying students:{" "}
                <span className="font-semibold text-foreground">
                  {result.total_candidates}
                </span>
              </p>
              <p>
                {done ? "Created" : "Will create"}:{" "}
                <span className="font-semibold text-foreground">
                  {done ? result.created : result.would_create}
                </span>{" "}
                pending payment(s)
              </p>
              <p>
                Already paid (skipped):{" "}
                <span className="font-semibold text-foreground">
                  {result.skipped_existing}
                </span>
              </p>
              <p>
                No usable account (skipped):{" "}
                <span className="font-semibold text-foreground">
                  {result.skipped_no_account}
                </span>
              </p>
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle className="size-4 shrink-0" />
              Created {commit.data?.created} pending payment(s). They are now ready to
              disburse.
            </div>
          )}

          {(preview.isError || commit.isError) && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {errorMessage(
                preview.error ?? commit.error,
                "Could not generate payments. Please try again.",
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
              Close
            </DialogClose>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={
                !ready ||
                commit.isPending ||
                done ||
                (result ? result.would_create === 0 : true)
              }
              onClick={() => commit.mutate()}
            >
              {commit.isPending
                ? "Creating…"
                : `Create ${result?.would_create ?? 0} Payment(s)`}
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
