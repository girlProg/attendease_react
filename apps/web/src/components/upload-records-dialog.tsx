import { useMemo, useRef, useState } from "react"
import { Upload, CheckCircle, AlertCircle, Plus, ArrowLeft, Wand2 } from "lucide-react"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { PrimaryButton } from "@/components/primary-button"
import { createCohort, getCohorts } from "@/api/attendance"
import type { Payee } from "@/types"
import {
  inspectUploadRecords,
  uploadRecords,
  type UploadField,
  type UploadInspection,
  type UploadReport,
  type UploadRowType,
} from "@/api/beneficiary-upload"

const PAYEE_DEFAULT = "__default__"
const IGNORE_COLUMN = "__ignore__"
const NEW_COHORT = "__new__"
const ACCEPTED_FILES = ".csv,.xlsx"

// DRF field errors ({name: ["…"], non_field_errors: ["…"]}) flattened to a line.
function cohortErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!data) return "Could not create the cohort."
  const parts = Object.entries(data).map(([key, value]) => {
    const text = Array.isArray(value) ? value.join(" ") : String(value)
    return key === "non_field_errors" || key === "detail" ? text : `${key}: ${text}`
  })
  return parts.join(" ") || "Could not create the cohort."
}

function errorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { error?: string; detail?: string } } })
    ?.response?.data
  return data?.error ?? data?.detail ?? "Upload failed. Please try again."
}

// Field options for the mapping select, grouped as the catalogue groups them
// (Matching, Student, Caregiver, Bank account, School, Enumerator).
function groupFields(fields: UploadField[]): { group: string; fields: UploadField[] }[] {
  const groups: { group: string; fields: UploadField[] }[] = []
  for (const field of fields) {
    const existing = groups.find((entry) => entry.group === field.group)
    if (existing) existing.fields.push(field)
    else groups.push({ group: field.group, fields: [field] })
  }
  return groups
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

  // Inline "new cohort" form (admin feature): shown when the cohort select is
  // set to "Add a new cohort…".
  const [newCohortName, setNewCohortName] = useState("")
  const [newCohortYear, setNewCohortYear] = useState(String(new Date().getFullYear()))
  const [newCohortPayee, setNewCohortPayee] = useState<Payee>("caregiver")

  // Step 2: the file's columns matched to fields ({column: field key}).
  const [inspection, setInspection] = useState<UploadInspection | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [defaultRowType, setDefaultRowType] = useState<UploadRowType>("returning")
  // Which row of the sheet holds the column names; the server guesses, the
  // user can correct it (files often carry a title row above the headers).
  const [headerRow, setHeaderRow] = useState<number | null>(null)

  const { data: cohorts = [] } = useQuery({ queryKey: ["cohorts"], queryFn: getCohorts })

  const addCohort = useMutation({
    mutationFn: () =>
      createCohort({ name: newCohortName.trim(), year: Number(newCohortYear), payee: newCohortPayee }),
    onSuccess: (created) => {
      // Both keys are in use across the app (filter bar vs. this dialog).
      queryClient.invalidateQueries({ queryKey: ["cohorts"] })
      queryClient.invalidateQueries({ queryKey: ["cohort"] })
      setCohort(String(created.id))
      setNewCohortName("")
    },
  })
  const creatingCohort = cohort === NEW_COHORT
  const canAddCohort =
    creatingCohort && newCohortName.trim().length > 0 && /^\d{4}$/.test(newCohortYear) && !addCohort.isPending

  const inspect = useMutation({
    mutationFn: ({ selected, row }: { selected: File; row?: number }) =>
      inspectUploadRecords(selected, row),
    onSuccess: (result) => {
      setInspection(result)
      setMapping(result.suggested_mapping)
      setHeaderRow(result.header_row)
      resetReport()
    },
  })

  const upload = useMutation({
    mutationFn: (commit: boolean) =>
      uploadRecords({
        file: file as File,
        cohort: Number(cohort),
        payee: payee === PAYEE_DEFAULT ? undefined : payee,
        update_existing: updateExisting,
        create_new: createNew,
        commit,
        mapping,
        default_row_type: defaultRowType,
        header_row: headerRow ?? undefined,
      }),
    onSuccess: (report: UploadReport) => {
      if (report.committed) {
        queryClient.invalidateQueries({ queryKey: ["students-summary"] })
        queryClient.invalidateQueries({ queryKey: ["students"] })
        queryClient.invalidateQueries({ queryKey: ["upload-batches"] })
      }
    },
  })

  const report = upload.data
  const onMappingStep = inspection !== null
  const canInspect = Boolean(file && cohort) && !creatingCohort && !inspect.isPending
  const canCommit = Boolean(report?.valid && !report.committed) && !upload.isPending

  const mappedKeys = useMemo(() => new Set(Object.values(mapping)), [mapping])
  const mappedCount = Object.keys(mapping).length
  const fieldGroups = useMemo(() => groupFields(inspection?.fields ?? []), [inspection])
  const fieldByKey = useMemo(
    () => new Map((inspection?.fields ?? []).map((field) => [field.key, field])),
    [inspection],
  )
  const sourceMapped = mappedKeys.has("source")

  // Gentle guidance — the server still validates every row.
  const mappingWarnings: string[] = []
  if (inspection) {
    if (updateExisting && !mappedKeys.has("studentsn") && (sourceMapped || defaultRowType === "returning")) {
      mappingWarnings.push(
        "Returning beneficiaries can't be matched without a column mapped to “Student S/N or Beneficiary ID”.",
      )
    }
    if (createNew && (sourceMapped || defaultRowType === "new")) {
      const missing = (inspection.fields ?? [])
        .filter((field) => field.required_for === "create" && !mappedKeys.has(field.key))
        .map((field) => field.label)
      if (missing.length > 0) {
        mappingWarnings.push(`New students need: ${missing.join(", ")}.`)
      }
    }
    if (!updateExisting && !createNew) {
      mappingWarnings.push("Both “update existing” and “enrol new” are off — every row will be skipped.")
    }
  }
  const canPreview = onMappingStep && mappedCount > 0 && !upload.isPending

  function resetReport() {
    if (upload.data || upload.error) upload.reset()
  }

  function resetAll() {
    setFile(null)
    setCohort("")
    setPayee(PAYEE_DEFAULT)
    setUpdateExisting(true)
    setCreateNew(false)
    setNewCohortName("")
    setNewCohortPayee("caregiver")
    addCohort.reset()
    setInspection(null)
    setMapping({})
    setDefaultRowType("returning")
    setHeaderRow(null)
    inspect.reset()
    upload.reset()
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetAll()
  }

  function setColumnField(column: string, key: string | null) {
    resetReport()
    setMapping((current) => {
      const next = { ...current }
      if (!key || key === IGNORE_COLUMN) {
        delete next[column]
        return next
      }
      // A field can only come from one column: unmap it elsewhere first.
      for (const [otherColumn, otherKey] of Object.entries(next)) {
        if (otherKey === key && otherColumn !== column) delete next[otherColumn]
      }
      next[column] = key
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="inline-flex h-11 items-center gap-2 rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5">
        <Plus className="size-4" />
        Upload Records
      </DialogTrigger>
      <DialogPopup
        className={`max-h-[88vh] overflow-y-auto ${onMappingStep ? "w-[min(96vw,64rem)] max-w-none" : ""}`}
      >
        <DialogTitle>{onMappingStep ? "Match columns to fields" : "Upload Records"}</DialogTitle>
        <DialogDescription>
          {onMappingStep
            ? "Any spreadsheet works — tell us which column holds which field. Columns marked “Ignore” are not read. Preview first; nothing is saved until you confirm."
            : "Verify and update existing beneficiaries, and enrol new students, from any CSV. You'll match its columns to fields on the next step."}
        </DialogDescription>

        {!onMappingStep && (
          <div className="mt-6 space-y-4">
            {/* File */}
            <button
              type="button"
              className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sidebar/30 p-6 transition-colors hover:border-sidebar/60"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-7 text-sidebar/50" />
              <p className="text-sm font-medium text-foreground">
                {file ? file.name : "Click to select a CSV or Excel (.xlsx) file"}
              </p>
              {file && (
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILES}
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0]
                  if (selected) setFile(selected)
                  inspect.reset()
                  resetReport()
                }}
              />
            </button>

            {/* Cohort + payee */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Cohort</label>
                <Select value={cohort} onValueChange={(value) => setCohort(value ?? "")}>
                  <SelectTrigger className="h-11 w-full rounded-lg border-border/60 bg-white px-4">
                    <SelectValue placeholder="Select cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name} ({item.year})
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_COHORT} className="font-medium text-sidebar">
                      + Add a new cohort…
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Payee</label>
                <Select value={payee} onValueChange={(value) => setPayee(value ?? PAYEE_DEFAULT)}>
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

            {creatingCohort && (
              <div className="space-y-3 rounded-lg border border-sidebar/30 bg-sidebar/5 p-3">
                <p className="text-sm font-medium text-foreground">New cohort</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <input
                      value={newCohortName}
                      onChange={(event) => setNewCohortName(event.target.value)}
                      placeholder="e.g. 3rd Cohort"
                      className="h-10 w-full rounded-lg border border-border/60 bg-white px-3 text-sm focus:border-sidebar/50 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Year</label>
                    <input
                      value={newCohortYear}
                      onChange={(event) => setNewCohortYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
                      inputMode="numeric"
                      placeholder="2026"
                      className="h-10 w-full rounded-lg border border-border/60 bg-white px-3 text-sm focus:border-sidebar/50 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Who is paid</label>
                    <Select value={newCohortPayee} onValueChange={(value) => value && setNewCohortPayee(value as Payee)}>
                      <SelectTrigger className="h-10 w-full rounded-lg border-border/60 bg-white px-3 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="caregiver">Caregiver</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {addCohort.isError && (
                  <p className="text-xs text-red-600">{cohortErrorMessage(addCohort.error)}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-full border border-border px-4 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                    onClick={() => {
                      setCohort("")
                      addCohort.reset()
                    }}
                  >
                    Cancel
                  </button>
                  <PrimaryButton className="h-9 w-auto px-4 text-xs" disabled={!canAddCohort} onClick={() => addCohort.mutate()}>
                    {addCohort.isPending ? "Creating…" : "Create cohort"}
                  </PrimaryButton>
                </div>
              </div>
            )}

            {/* Mode toggles */}
            <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-sidebar"
                  checked={updateExisting}
                  onChange={(event) => setUpdateExisting(event.target.checked)}
                />
                Update existing beneficiaries (verify + write captured data)
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-sidebar"
                  checked={createNew}
                  onChange={(event) => setCreateNew(event.target.checked)}
                />
                Enrol new students
              </label>
            </div>

            {inspect.isError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="size-4 shrink-0" />
                {errorMessage(inspect.error)}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
                Close
              </DialogClose>
              <PrimaryButton
                className="h-10 w-auto px-6"
                disabled={!canInspect}
                onClick={() => file && inspect.mutate({ selected: file })}
              >
                {inspect.isPending ? "Reading file…" : "Next: match columns"}
              </PrimaryButton>
            </div>
          </div>
        )}

        {onMappingStep && inspection && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{file?.name}</span> ·{" "}
                {inspection.row_count.toLocaleString()} row{inspection.row_count === 1 ? "" : "s"} ·{" "}
                {mappedCount} of {inspection.headers.length} columns matched
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-sidebar underline-offset-2 hover:underline"
                onClick={() => {
                  setMapping(inspection.suggested_mapping)
                  resetReport()
                }}
              >
                <Wand2 className="size-3.5" />
                Reset to suggested
              </button>
            </div>

            {/* Header row picker: which row of the sheet names the columns */}
            {inspection.raw_preview.length > 1 && (
              <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3 sm:flex-row sm:items-center">
                <label className="shrink-0 text-xs font-medium text-muted-foreground">
                  Column names are in row
                </label>
                <Select
                  value={String(headerRow ?? inspection.header_row)}
                  onValueChange={(value) => {
                    const row = Number(value)
                    if (!value || row === headerRow || !file) return
                    setHeaderRow(row)
                    inspect.mutate({ selected: file, row })
                  }}
                >
                  <SelectTrigger className="h-9 w-full rounded-lg border-border/60 bg-white px-3 text-xs sm:max-w-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {inspection.raw_preview.map((cells, index) => {
                      const preview = cells.filter(Boolean).slice(0, 6).join(" · ")
                      return (
                        <SelectItem key={index} value={String(index + 1)}>
                          Row {index + 1}: {preview || "(blank)"}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {inspect.isPending && <span className="text-xs text-muted-foreground">Re-reading…</span>}
              </div>
            )}

            {/* Mapping table */}
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left text-xs font-semibold text-sidebar">
                  <tr>
                    <th className="px-3 py-2">Column in your file</th>
                    <th className="px-3 py-2">Sample values</th>
                    <th className="w-72 px-3 py-2">Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {inspection.headers.map((header, columnIndex) => {
                    const key = mapping[header]
                    const field = key ? fieldByKey.get(key) : undefined
                    const samples = inspection.sample
                      .map((row) => row[columnIndex])
                      .filter(Boolean)
                      .slice(0, 3)
                    return (
                      <tr key={header} className={key ? "" : "bg-muted/10"}>
                        <td className="px-3 py-2 font-medium text-foreground">{header}</td>
                        <td className="max-w-[18rem] truncate px-3 py-2 text-xs text-muted-foreground" title={samples.join(" · ")}>
                          {samples.length ? samples.join(" · ") : <span className="italic">empty</span>}
                        </td>
                        <td className="px-3 py-1.5">
                          <Select value={key ?? IGNORE_COLUMN} onValueChange={(value) => setColumnField(header, value)}>
                            <SelectTrigger className={`h-9 w-full rounded-lg border-border/60 bg-white px-3 text-xs ${key ? "" : "text-muted-foreground"}`}>
                              <SelectValue>{field ? field.label : "Ignore this column"}</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              <SelectItem value={IGNORE_COLUMN} className="text-muted-foreground">
                                Ignore this column
                              </SelectItem>
                              {fieldGroups.map((group) => (
                                <SelectGroup key={group.group}>
                                  <SelectLabel>{group.group}</SelectLabel>
                                  {group.fields.map((option) => {
                                    const usedElsewhere = mappedKeys.has(option.key) && mapping[header] !== option.key
                                    return (
                                      <SelectItem key={option.key} value={option.key}>
                                        {option.label}
                                        {usedElsewhere ? " (mapped)" : ""}
                                      </SelectItem>
                                    )
                                  })}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                          {field?.description && key && (
                            <p className="mt-1 text-[11px] text-muted-foreground">{field.description}</p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Row type when the file has no Source column */}
            <div className="rounded-lg bg-muted/30 p-3 text-sm">
              {sourceMapped ? (
                <p className="text-muted-foreground">
                  Row type comes from the column mapped to “Row type”: rows containing “new” enrol a
                  new student; other rows are treated as{" "}
                  <span className="font-medium text-foreground">
                    {defaultRowType === "new" ? "new students" : "returning beneficiaries"}
                  </span>{" "}
                  when blank.
                </p>
              ) : (
                <p className="font-medium text-foreground">Every row in this file is a…</p>
              )}
              <div className="mt-2 flex flex-wrap gap-4">
                {(
                  [
                    ["returning", "Returning beneficiary (matched by S/N or beneficiary ID)"],
                    ["new", "New student to enrol"],
                  ] as [UploadRowType, string][]
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name="default-row-type"
                      className="size-4 accent-sidebar"
                      checked={defaultRowType === value}
                      onChange={() => {
                        setDefaultRowType(value)
                        resetReport()
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {mappingWarnings.length > 0 && !report && (
              <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                {mappingWarnings.map((warning) => (
                  <li key={warning} className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            )}

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
                    <summary className="cursor-pointer font-medium">Show skipped rows</summary>
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
                  {report.errors.length} row error(s) — fix the mapping or the file and preview again.
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

            {upload.isError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="size-4 shrink-0" />
                {errorMessage(upload.error)}
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-3 pt-2">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                disabled={upload.isPending || Boolean(report?.committed)}
                onClick={() => {
                  setInspection(null)
                  inspect.reset()
                  upload.reset()
                }}
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              <div className="flex gap-3">
                <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
                  Close
                </DialogClose>
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-full border border-sidebar bg-white px-6 text-sm font-medium text-sidebar hover:bg-sidebar/5 disabled:opacity-50"
                  disabled={!canPreview || Boolean(report?.committed)}
                  onClick={() => upload.mutate(false)}
                >
                  {upload.isPending && !canCommit ? "Validating…" : "Preview"}
                </button>
                <PrimaryButton
                  className="h-10 w-auto px-6"
                  disabled={!canCommit}
                  onClick={() => upload.mutate(true)}
                >
                  {upload.isPending && canCommit ? "Committing…" : "Confirm & Commit"}
                </PrimaryButton>
              </div>
            </div>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  )
}
