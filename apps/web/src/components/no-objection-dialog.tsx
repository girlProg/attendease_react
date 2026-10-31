import { useRef, useState } from "react"
import {
  ShieldCheck,
  ShieldX,
  Upload,
  CheckCircle,
  AlertCircle,
  Trash2,
} from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { PrimaryButton } from "@/components/primary-button"
import { ProportionalNoObjection } from "@/components/proportional-no-objection"
import {
  buildNoObjection,
  deleteNoObjection,
  getNoObjectionStatus,
  type NoObjectionResult,
} from "@/api/attendance"

function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { error?: string } } })?.response
    ?.data
  return data?.error ?? fallback
}

export function NoObjectionDialog({
  cohort,
  cohortName,
  year,
  term,
}: {
  cohort?: number
  cohortName?: string
  year?: string
  term?: string
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  // The whole qualifying list (or a CSV), or a share of it split fairly by LGA.
  const [mode, setMode] = useState<"whole" | "proportional">("whole")
  // Set once a list is created, so the dialog says so instead of flipping
  // straight to "Delete" when the status refreshes.
  const [createdCount, setCreatedCount] = useState<number | null>(null)

  const ready = Boolean(cohort && year && term)

  // Does a submission already exist for this exact scope? Drives create vs delete.
  const { data: existing } = useQuery({
    queryKey: ["no-objection-status", cohort, year, term],
    queryFn: () => getNoObjectionStatus({ cohort, year, term }),
    enabled: ready,
  })
  const exists = existing?.exists ?? false

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["term-averages"] })
    queryClient.invalidateQueries({
      queryKey: ["no-objection-status", cohort, year, term],
    })
  }

  const buildMutation = useMutation({
    mutationFn: () =>
      buildNoObjection({
        cohort: cohort as number,
        year: year as string,
        term: term as string,
        file,
      }),
    onSuccess: (data: NoObjectionResult) => {
      setCreatedCount(data.total_students)
      invalidateAll()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteNoObjection({
        cohort: cohort as number,
        year: year as string,
        term: term as string,
      }),
    onSuccess: () => {
      invalidateAll()
      setOpen(false)
    },
  })

  const result = buildMutation.data as NoObjectionResult | undefined

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setFile(null)
      setMode("whole")
      setCreatedCount(null)
      buildMutation.reset()
      deleteMutation.reset()
    }
  }

  const scope = (
    <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
      Scope — Cohort:{" "}
      <span className="font-semibold text-foreground">
        {cohortName ?? (cohort ? `#${cohort}` : "—")}
      </span>
      , Year:{" "}
      <span className="font-semibold text-foreground">{year ?? "—"}</span>,
      Term: <span className="font-semibold text-foreground">{term ?? "—"}</span>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          exists
            ? "inline-flex h-11 items-center gap-2 rounded-full border border-red-500 bg-white px-5 text-sm font-medium text-red-600 hover:bg-red-50"
            : "inline-flex h-11 items-center gap-2 rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5"
        }
      >
        {exists ? (
          <ShieldX className="size-4" />
        ) : (
          <ShieldCheck className="size-4" />
        )}
        {exists ? "Delete No Objection" : "Create No Objection"}
      </button>

      <DialogPopup
        className={`max-h-[85vh] overflow-y-auto ${createdCount === null && !exists && mode === "proportional" ? "max-w-3xl" : ""}`}
      >
        {createdCount !== null ? (
          <>
            <DialogTitle>No Objection list created</DialogTitle>
            <div className="mt-6 space-y-4">
              {scope}
              <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                <CheckCircle className="size-4 shrink-0" />
                {createdCount.toLocaleString()} student(s) are on the list. The
                payments page now shows only them.
              </p>
              <div className="flex justify-end">
                <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
                  Close
                </DialogClose>
              </div>
            </div>
          </>
        ) : exists ? (
          <>
            <DialogTitle>Delete No Objection</DialogTitle>
            <DialogDescription>
              This removes the no-objection list for the selected cohort, year
              and term. The payments page will fall back to showing all
              qualifying students.
            </DialogDescription>

            <div className="mt-6 space-y-4">
              {scope}

              <div className="rounded-lg bg-muted/30 p-3 text-sm text-foreground">
                {existing?.total_students ?? 0} student(s) are currently on this
                list.
              </div>

              {deleteMutation.isError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="size-4 shrink-0" />
                  {errorMessage(
                    deleteMutation.error,
                    "Could not delete the list. Please try again."
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
                  Cancel
                </DialogClose>
                <button
                  type="button"
                  disabled={!ready || deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                  {deleteMutation.isPending ? "Deleting…" : "Delete List"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogTitle>Create No Objection</DialogTitle>
            <DialogDescription>
              Mark students as having no objection for the selected cohort, year
              and term.
            </DialogDescription>

            <div className="mt-6 space-y-4">
              {!ready && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                  <AlertCircle className="size-4 shrink-0" />
                  Select a cohort, year and term on the page first.
                </div>
              )}

              {scope}

              <div className="inline-flex rounded-full border border-border/60 p-0.5">
                {(
                  [
                    ["whole", "Whole list"],
                    ["proportional", "Proportional by LGA"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                      mode === value
                        ? "bg-sidebar text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === "proportional" ? (
                ready && (
                  <ProportionalNoObjection
                    cohort={cohort as number}
                    year={year as string}
                    term={term as string}
                    onCreated={(count) => {
                      setCreatedCount(count)
                      invalidateAll()
                    }}
                  />
                )
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Upload a CSV (matched on the “Beneficiary ID” column) to
                    mark a specific list, or leave it empty to use all
                    qualifying students in the current filter, plus everyone
                    already paid for the term.
                  </p>

                  <button
                    type="button"
                    className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sidebar/30 p-6 transition-colors hover:border-sidebar/60"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-7 text-sidebar/50" />
                    <p className="text-sm font-medium text-foreground">
                      {file
                        ? file.name
                        : "Optional: click to select a CSV of Beneficiary IDs"}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(event) => {
                        const selected = event.target.files?.[0]
                        if (selected) setFile(selected)
                        if (buildMutation.data || buildMutation.error)
                          buildMutation.reset()
                      }}
                    />
                  </button>

                  {result && (
                    <div className="space-y-1 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                      <p className="flex items-center gap-2 font-medium">
                        <CheckCircle className="size-4 shrink-0" />
                        Added {result.students_added} student(s) —{" "}
                        {result.total_students} on the list.
                      </p>
                      {result.not_found.length > 0 && (
                        <p className="text-xs text-amber-700">
                          {result.not_found.length} Beneficiary ID(s) not found
                          in this cohort.
                        </p>
                      )}
                    </div>
                  )}

                  {buildMutation.isError && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="size-4 shrink-0" />
                      {errorMessage(
                        buildMutation.error,
                        "Could not create the no-objection list. Please try again."
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
                      Close
                    </DialogClose>
                    <PrimaryButton
                      className="h-10 w-auto px-6"
                      disabled={!ready || buildMutation.isPending}
                      onClick={() => buildMutation.mutate()}
                    >
                      {buildMutation.isPending
                        ? "Creating…"
                        : file
                          ? "Upload & Create"
                          : "Use Qualifying List"}
                    </PrimaryButton>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </DialogPopup>
    </Dialog>
  )
}
