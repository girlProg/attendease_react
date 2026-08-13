import { useState, useRef } from "react"
import { Upload, CheckCircle, AlertCircle, ListChecks } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { PrimaryButton } from "@/components/primary-button"
import { uploadAttendanceCsv, type AttendanceUploadReport } from "@/api/attendance"

export function CsvUploadDialog() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ file, commit }: { file: File; commit: boolean }) =>
      uploadAttendanceCsv(file, commit),
    onSuccess: (report) => {
      if (!report.committed) return // a "Check file" preview writes nothing
      queryClient.invalidateQueries({ queryKey: ["attendance-map"] })
      queryClient.invalidateQueries({ queryKey: ["students"] })
      queryClient.invalidateQueries({ queryKey: ["attendance"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-popup"] })
    },
  })

  const report = mutation.data as AttendanceUploadReport | undefined
  const errors = report?.errors ?? []

  function resetFile(selected: File) {
    setFile(selected)
    mutation.reset()
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setFile(null)
      mutation.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-white hover:bg-brand/90">
        <Upload className="size-4" />
        Upload CSV Data
      </DialogTrigger>
      <DialogPopup className="max-h-[85vh] overflow-y-auto">
        <DialogTitle>Upload CSV File</DialogTitle>
        <DialogDescription>
          Select a CSV file to upload attendance data.
        </DialogDescription>
        <div className="mt-6 space-y-4">
          <div
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sidebar/30 p-8 transition-colors hover:border-sidebar/60"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-8 text-sidebar/50" />
            <p className="text-sm font-medium text-foreground">
              {file ? file.name : "Click to select a CSV file"}
            </p>
            {file && (
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const selected = event.target.files?.[0]
                if (selected) resetFile(selected)
              }}
            />
          </div>

          <div className="rounded-xl border border-border/60 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Check file</span> validates
            every row and lists any problem rows (student not found, graduated,
            missing/invalid year, term or week) <span className="font-medium">without
            saving</span>. Fix those rows first — otherwise Upload records the good
            rows and skips the rest, leaving a partial update.
          </div>

          {/* Preview / check result */}
          {report && !report.committed && (
            <div
              className={`rounded-lg p-3 text-sm ${
                report.valid
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              <p className="flex items-center gap-2 font-medium">
                {report.valid ? (
                  <CheckCircle className="size-4 shrink-0" />
                ) : (
                  <AlertCircle className="size-4 shrink-0" />
                )}
                {report.valid
                  ? `Looks good — ${report.total_processed} row(s) ready (nothing saved yet).`
                  : `${report.total_errors} problem row(s) found (nothing saved).`}
              </p>
              {errors.length > 0 && (
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
                  {errors.slice(0, 50).map((rowError, index) => (
                    <li key={index}>
                      Row {rowError.row}
                      {rowError.beneficiary_id ? ` (${rowError.beneficiary_id})` : ""}: {rowError.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Committed result */}
          {report?.committed && (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle className="size-4 shrink-0" />
                Saved — {report.created} added, {report.updated} updated
                {report.total_errors ? `, ${report.total_errors} skipped.` : "."}
              </p>
              {errors.length > 0 && (
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-amber-700">
                  {errors.slice(0, 50).map((rowError, index) => (
                    <li key={index}>
                      Row {rowError.row}
                      {rowError.beneficiary_id ? ` (${rowError.beneficiary_id})` : ""}: {rowError.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {(mutation.error as Error)?.message ?? "Upload failed. Please try again."}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
              Close
            </DialogClose>
            <button
              type="button"
              disabled={!file || mutation.isPending}
              onClick={() => file && mutation.mutate({ file, commit: false })}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5 disabled:opacity-50"
            >
              <ListChecks className="size-4" />
              {mutation.isPending && mutation.variables?.commit === false
                ? "Checking…"
                : "Check file"}
            </button>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={!file || mutation.isPending || report?.committed}
              onClick={() => file && mutation.mutate({ file, commit: true })}
            >
              {mutation.isPending && mutation.variables?.commit === true
                ? "Uploading…"
                : "Upload"}
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
