import { useRef, useState } from "react"
import { ShieldCheck, Upload, CheckCircle, AlertCircle } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { PrimaryButton } from "@/components/primary-button"
import { buildNoObjection, type NoObjectionResult } from "@/api/attendance"

function errorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { error?: string } } })?.response?.data
  return data?.error ?? "Could not create the no-objection list. Please try again."
}

export function NoObjectionDialog({
  cohort,
  year,
  term,
}: {
  cohort?: number
  year?: string
  term?: string
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const ready = Boolean(cohort && year && term)

  const mutation = useMutation({
    mutationFn: () =>
      buildNoObjection({ cohort: cohort as number, year: year as string, term: term as string, file }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["term-averages"] })
    },
  })

  const result = mutation.data as NoObjectionResult | undefined

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setFile(null)
      mutation.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5"
      >
        <ShieldCheck className="size-4" />
        Create No Objection
      </button>
      <DialogPopup className="max-h-[85vh] overflow-y-auto">
        <DialogTitle>Create No Objection</DialogTitle>
        <DialogDescription>
          Mark students as having no objection for the selected cohort, year and term.
          Upload a CSV (matched on the “Beneficiary ID” column) to mark a specific list,
          or leave it empty to use all qualifying students in the current filter.
        </DialogDescription>

        <div className="mt-6 space-y-4">
          {!ready && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              Select a cohort, year and term on the page first.
            </div>
          )}

          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
            Scope — Cohort: <span className="font-semibold text-foreground">{cohort ?? "—"}</span>,
            Year: <span className="font-semibold text-foreground">{year ?? "—"}</span>,
            Term: <span className="font-semibold text-foreground">{term ?? "—"}</span>
          </div>

          <button
            type="button"
            className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sidebar/30 p-6 transition-colors hover:border-sidebar/60"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-7 text-sidebar/50" />
            <p className="text-sm font-medium text-foreground">
              {file ? file.name : "Optional: click to select a CSV of Beneficiary IDs"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const selected = event.target.files?.[0]
                if (selected) setFile(selected)
                if (mutation.data || mutation.error) mutation.reset()
              }}
            />
          </button>

          {result && (
            <div className="space-y-1 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle className="size-4 shrink-0" />
                Added {result.students_added} student(s) — {result.total_students} on the list.
              </p>
              {result.not_found.length > 0 && (
                <p className="text-xs text-amber-700">
                  {result.not_found.length} Beneficiary ID(s) not found in this cohort.
                </p>
              )}
            </div>
          )}

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {errorMessage(mutation.error)}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
              Close
            </DialogClose>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={!ready || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? "Creating…"
                : file
                  ? "Upload & Create"
                  : "Use Qualifying List"}
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
