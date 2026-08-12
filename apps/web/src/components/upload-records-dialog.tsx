import { useRef, useState } from "react"
import { Upload, CheckCircle, AlertCircle, Plus } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  Dialog,
  DialogTrigger,
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
import { getCohorts } from "@/api/attendance"
import { uploadRecords, type UploadReport } from "@/api/beneficiary-upload"

const PAYEE_DEFAULT = "__default__"

function errorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { error?: string; detail?: string } } })
    ?.response?.data
  return data?.error ?? data?.detail ?? "Upload failed. Please try again."
}

export function UploadRecordsDialog() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [cohort, setCohort] = useState("")
  const [payee, setPayee] = useState(PAYEE_DEFAULT)
  const [updateExisting, setUpdateExisting] = useState(true)
  const [createNew, setCreateNew] = useState(false)

  const { data: cohorts = [] } = useQuery({ queryKey: ["cohorts"], queryFn: getCohorts })

  const mutation = useMutation({
    mutationFn: (commit: boolean) =>
      uploadRecords({
        file: file as File,
        cohort: Number(cohort),
        payee: payee === PAYEE_DEFAULT ? undefined : payee,
        update_existing: updateExisting,
        create_new: createNew,
        commit,
      }),
    onSuccess: (report: UploadReport) => {
      if (report.committed) {
        queryClient.invalidateQueries({ queryKey: ["students-summary"] })
        queryClient.invalidateQueries({ queryKey: ["students"] })
        queryClient.invalidateQueries({ queryKey: ["upload-batches"] })
      }
    },
  })

  const report = mutation.data
  const canPreview = Boolean(file && cohort) && !mutation.isPending
  const canCommit = Boolean(report?.valid && !report.committed) && !mutation.isPending

  function resetReport() {
    if (mutation.data || mutation.error) mutation.reset()
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setFile(null)
      setCohort("")
      setPayee(PAYEE_DEFAULT)
      setUpdateExisting(true)
      setCreateNew(false)
      mutation.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="inline-flex h-11 items-center gap-2 rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5">
        <Plus className="size-4" />
        Upload Records
      </DialogTrigger>
      <DialogPopup className="max-h-[85vh] overflow-y-auto">
        <DialogTitle>Upload Records</DialogTitle>
        <DialogDescription>
          Verify and update existing beneficiaries, and enrol new students, from a
          verification CSV. Preview first — nothing is saved until you confirm.
        </DialogDescription>

        <div className="mt-6 space-y-4">
          {/* File */}
          <button
            type="button"
            className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sidebar/30 p-6 transition-colors hover:border-sidebar/60"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-7 text-sidebar/50" />
            <p className="text-sm font-medium text-foreground">
              {file ? file.name : "Click to select a CSV file"}
            </p>
            {file && (
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const selected = event.target.files?.[0]
                if (selected) setFile(selected)
                resetReport()
              }}
            />
          </button>

          {/* Cohort + payee */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cohort</label>
              <Select
                value={cohort}
                onValueChange={(value) => {
                  setCohort(value ?? "")
                  resetReport()
                }}
              >
                <SelectTrigger className="h-11 w-full rounded-lg border-border/60 bg-white px-4">
                  <SelectValue placeholder="Select cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name} ({item.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Payee</label>
              <Select
                value={payee}
                onValueChange={(value) => {
                  setPayee(value ?? PAYEE_DEFAULT)
                  resetReport()
                }}
              >
                <SelectTrigger className="h-11 w-full rounded-lg border-border/60 bg-white px-4">
                  <SelectValue placeholder="Cohort default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PAYEE_DEFAULT}>Cohort default</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="caregiver">Caregiver</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mode toggles */}
          <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 accent-sidebar"
                checked={updateExisting}
                onChange={(event) => {
                  setUpdateExisting(event.target.checked)
                  resetReport()
                }}
              />
              Update existing beneficiaries (verify + write captured data)
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 accent-sidebar"
                checked={createNew}
                onChange={(event) => {
                  setCreateNew(event.target.checked)
                  resetReport()
                }}
              />
              Enrol new students
            </label>
          </div>

          {/* Report */}
          {report?.committed && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                Done — created {report.created ?? 0}, updated {report.updated ?? 0}
                {report.skipped ? `, skipped ${report.skipped}` : ""}. Batch #{report.batch_id}.
              </span>
            </div>
          )}

          {report && !report.committed && report.valid && (
            <div className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
              <p className="font-medium">Preview — nothing saved yet</p>
              <p className="mt-1">
                Will create {report.to_create ?? 0}, update {report.to_update ?? 0}, skip{" "}
                {report.skipped ?? 0}. Click “Confirm &amp; Commit” to apply.
              </p>
              {report.skip_reasons && Object.keys(report.skip_reasons).length > 0 && (
                <p className="mt-1 text-xs">
                  Skipped:{" "}
                  {Object.entries(report.skip_reasons)
                    .map(([reason, count]) => `${count} ${reason}`)
                    .join(", ")}
                  .
                </p>
              )}
              {report.preview && report.preview.some((row) => row.action === "skip") && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-medium">
                    Show skipped rows
                  </summary>
                  <ul className="mt-1 max-h-40 list-disc space-y-1 overflow-y-auto pl-5">
                    {report.preview
                      .filter((row) => row.action === "skip")
                      .slice(0, 100)
                      .map((row, index) => (
                        <li key={index}>
                          Row {row.row}
                          {row.beneficiary_id ? ` (${row.beneficiary_id})` : ""}
                          {row.note ? ` — ${row.note}` : ""}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {report && !report.valid && report.errors && (
            <div className="space-y-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p className="flex items-center gap-2 font-medium">
                <AlertCircle className="size-4 shrink-0" />
                {report.errors.length} row error(s) — fix the file and preview again.
              </p>
              <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
                {report.errors.slice(0, 50).map((rowError, index) => (
                  <li key={index}>
                    Row {rowError.row}
                    {rowError.beneficiary_id ? ` (${rowError.beneficiary_id})` : ""}: {rowError.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report?.warnings && report.warnings.length > 0 && (
            <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <p className="flex items-center gap-2 font-medium">
                <AlertCircle className="size-4 shrink-0" />
                {report.warnings.length} row(s) skipped — no matching beneficiary.
                {report.committed ? " The rest were saved." : " The rest will be saved."}
              </p>
              <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
                {report.warnings.slice(0, 50).map((rowWarning, index) => (
                  <li key={index}>
                    Row {rowWarning.row}
                    {rowWarning.beneficiary_id ? ` (${rowWarning.beneficiary_id})` : ""}: {rowWarning.error}
                  </li>
                ))}
              </ul>
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
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-full border border-sidebar bg-white px-6 text-sm font-medium text-sidebar hover:bg-sidebar/5 disabled:opacity-50"
              disabled={!canPreview}
              onClick={() => mutation.mutate(false)}
            >
              {mutation.isPending && !canCommit ? "Validating…" : "Preview"}
            </button>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={!canCommit}
              onClick={() => mutation.mutate(true)}
            >
              {mutation.isPending && canCommit ? "Committing…" : "Confirm & Commit"}
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
