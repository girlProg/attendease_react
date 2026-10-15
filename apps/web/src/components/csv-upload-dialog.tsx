import { useState, useRef } from "react"
import { Upload, CheckCircle, AlertCircle, ListChecks, Download } from "lucide-react"
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
import { RegisterRequestDialog } from "@/components/register-photo"
import {
  uploadAttendanceCsv,
  uploadSchoolRegister,
  downloadExcelTemplate,
  type AttendanceUploadReport,
  type RegisterRequest,
} from "@/api/attendance"
import { getTermLabel } from "@/lib/formatters"

// Pull the backend's typed error (wrong_format etc.) out of an axios failure.
function uploadErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { error?: string } } })?.response?.data
  return (
    data?.error ??
    (error as Error)?.message ??
    "Upload failed. Please try again."
  )
}

export function CsvUploadDialog() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  // Registers still to ask for after a committed upload (one per school-term
  // it recorded), asked one at a time; optional, like on New Attendance.
  const [registerQueue, setRegisterQueue] = useState<RegisterRequest[]>([])
  const [registerTotal, setRegisterTotal] = useState(0)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const currentRegister = registerQueue[0] ?? null

  function nextRegister() {
    setRegisterError(null)
    setRegisterQueue((queue) => queue.slice(1))
  }

  const registerUpload = useMutation({
    mutationFn: ({ request, files }: { request: RegisterRequest; files: File[] }) =>
      uploadSchoolRegister(request.school, request.year, request.term, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-registers"] })
      queryClient.invalidateQueries({ queryKey: ["register-coverage"] })
      nextRegister()
    },
    onError: (error) => {
      const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data
      const first = data ? Object.values(data)[0] : null
      const reason = Array.isArray(first) ? first[0] : typeof first === "string" ? first : null
      setRegisterError(
        typeof reason === "string" ? reason : "The register photo didn't upload. Please try again.",
      )
    },
  })

  const mutation = useMutation({
    mutationFn: ({ file, commit }: { file: File; commit: boolean }) =>
      uploadAttendanceCsv(file, commit),
    onSuccess: (report) => {
      if (!report.committed) return // a "Check file" preview writes nothing
      const requests = report.register_requests ?? []
      setRegisterQueue(requests)
      setRegisterTotal(requests.length)
      setRegisterError(null)
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
      setRegisterQueue([])
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
            <Upload className="size-8 shrink-0 text-sidebar/50" />
            <p className="w-full break-all px-2 text-center text-sm font-medium text-foreground">
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

          {/* Missing students — the whole upload is blocked until the file
              covers every student in the school. */}
          {report && (report.missing_students?.length ?? 0) > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <p className="flex items-center gap-2 font-medium">
                <AlertCircle className="size-4 shrink-0" />
                {report.missing_count} student(s) are missing from this file.
              </p>
              <p className="mt-1 text-xs">
                Attendance can’t be uploaded until every student is included.
                Download the updated attendance sheet for this school, fill in the
                new students, then upload again.
              </p>
              {report.template && (
                <button
                  type="button"
                  onClick={() =>
                    report.template &&
                    downloadExcelTemplate({
                      school: report.template.school,
                      cohort: report.template.cohort,
                      term: String(report.template.term),
                      week: String(report.template.week),
                      year: String(report.template.year),
                    })
                  }
                  className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-500 bg-white px-4 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  <Download className="size-4" />
                  Download updated attendance
                </button>
              )}
              <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
                {report.missing_students?.slice(0, 20).map((student) => (
                  <li key={student.beneficiary_id || student.name}>
                    {student.name}
                    {student.beneficiary_id ? ` (${student.beneficiary_id})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview / check result */}
          {report && !report.committed && !report.missing_students?.length && (
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
              {uploadErrorMessage(mutation.error)}
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

        <RegisterRequestDialog
          key={currentRegister ? `${currentRegister.school}-${currentRegister.year}-${currentRegister.term}` : "none"}
          open={currentRegister !== null}
          subject={currentRegister ? registerSubject(currentRegister, registerTotal - registerQueue.length + 1, registerTotal) : ""}
          isUploading={registerUpload.isPending}
          error={registerError}
          onUpload={(files) => currentRegister && registerUpload.mutate({ request: currentRegister, files })}
          onSkip={nextRegister}
        />
      </DialogPopup>
    </Dialog>
  )
}

function registerSubject(request: RegisterRequest, position: number, total: number) {
  const weeks = request.weeks.length === 1 ? `week ${request.weeks[0]}` : `weeks ${request.weeks.join(", ")}`
  const step = total > 1 ? ` (${position} of ${total})` : ""
  return `${request.school_name}, ${weeks}, ${getTermLabel(request.term)}${step}`
}
