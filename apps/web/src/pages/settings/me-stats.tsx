import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { LabeledInput } from "@/components/form-fields"
import { MeStatsGrid } from "@/components/me-stats-table"
import { PrimaryButton } from "@/components/primary-button"
import { QueryError } from "@/components/query-error"
import { useLogVisit } from "@/hooks/use-log-visit"
import {
  getMeStats,
  setEnrolmentYear,
  setPaidFigure,
  type MeStatsCell,
  type MeStatsCohort,
  type MeStatsRow,
  type MeStatsTable,
} from "@/api/me-stats"

function errorText(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (data && typeof data === "object") {
    const first = Object.values(data as Record<string, unknown>)[0]
    if (Array.isArray(first) && typeof first[0] === "string") return first[0]
    if (typeof first === "string") return first
  }
  return fallback
}

/** Type in one cell's figure, or clear it to go back to the payment records. */
function FigureDialog({
  row,
  cell,
  onClose,
  onSaved,
}: {
  row: MeStatsRow
  cell: MeStatsCell
  onClose: () => void
  onSaved: (table: MeStatsTable) => void
}) {
  const entered = cell.source === "entered"
  const [paid, setPaid] = useState(entered && cell.paid !== null ? String(cell.paid) : "")
  const [amount, setAmount] = useState(entered ? (cell.amount ?? "") : "")
  const [terms, setTerms] = useState<number[]>(entered ? cell.terms : [])

  const save = useMutation({
    mutationFn: (clear: boolean) =>
      setPaidFigure({
        cohort: row.cohort,
        entry_class: row.entry_class,
        year: cell.year,
        paid_students: clear ? null : Number(paid),
        amount: clear || amount === "" ? null : amount,
        terms: clear ? [] : terms,
      }),
    onSuccess: onSaved,
  })
  const valid = /^\d+$/.test(paid) && (amount === "" || Number(amount) >= 0)

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogPopup>
        <DialogTitle>{row.details}</DialogTitle>
        <DialogDescription>
          Students paid in {cell.year}, when they were in {cell.class_name}. It shows as entered,
          and the change goes to the logs.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          {cell.source === "system" && (
            <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              The payment records say {cell.paid?.toLocaleString()} students. What you enter here
              shows instead.
            </p>
          )}
          <LabeledInput label="Students paid" type="number" value={paid} onChange={setPaid} />
          <LabeledInput label="Amount paid (₦, optional)" type="number" value={amount} onChange={setAmount} />
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Terms paid (optional)</legend>
            <div className="mt-2 flex gap-4">
              {[1, 2, 3].map((term) => (
                <label key={term} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="size-4 accent-sidebar"
                    checked={terms.includes(term)}
                    onChange={(event) =>
                      setTerms((current) =>
                        event.target.checked
                          ? [...current, term].sort()
                          : current.filter((chosen) => chosen !== term),
                      )
                    }
                  />
                  Term {term}
                </label>
              ))}
            </div>
          </fieldset>

          {save.isError && (
            <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {errorText(save.error, "Could not save the figure.")}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            {entered && (
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => save.mutate(true)}
                className="mr-auto text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
              >
                Clear figure
              </button>
            )}
            <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
              Cancel
            </DialogClose>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={!valid || save.isPending}
              onClick={() => save.mutate(false)}
            >
              {save.isPending ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}

function EnrolmentYearField({
  cohort,
  onSaved,
}: {
  cohort: MeStatsCohort
  onSaved: (table: MeStatsTable) => void
}) {
  const stored = cohort.enrolment_year === null ? "" : String(cohort.enrolment_year)
  const [year, setYear] = useState(stored)
  const save = useMutation({
    mutationFn: () => setEnrolmentYear(cohort.id, year === "" ? null : Number(year)),
    onSuccess: onSaved,
  })

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-2">
        <div className="w-32">
          <LabeledInput label={cohort.title} type="number" value={year} onChange={setYear} />
        </div>
        <Button
          variant="outline"
          className="h-11 rounded-full px-4"
          disabled={year === stored || save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </Button>
      </div>
      {save.isError && (
        <p className="text-xs text-red-700">{errorText(save.error, "Could not save the year.")}</p>
      )}
    </div>
  )
}

/**
 * Where the M&E Stats page gets what the system can't know: the year each cohort
 * enrolled, and how many were paid in years the payment records don't hold.
 * Superusers only; every change goes to the logs.
 */
export function MeStatsSettingsPage() {
  useLogVisit("Settings", "Visited M&E Stats Settings")
  const queryClient = useQueryClient()
  const { data, isError, isLoading } = useQuery({ queryKey: ["me-stats"], queryFn: getMeStats })
  const [editing, setEditing] = useState<{ row: MeStatsRow; cell: MeStatsCell } | null>(null)

  const saved = (table: MeStatsTable) => {
    queryClient.setQueryData(["me-stats"], table)
    setEditing(null)
  }

  if (isError) return <QueryError />

  const titleOf = (id: number) => data?.cohorts.find((cohort) => cohort.id === id)?.title ?? id

  return (
    <div className="space-y-5">
      {data && (
        <section className="space-y-3 rounded-2xl border border-border/40 bg-white p-5">
          <div>
            <h2 className="text-base font-bold text-foreground">Enrolment years</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The year each cohort enrolled. Every later year and class is worked out from it.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            {data.cohorts.map((cohort) => (
              <EnrolmentYearField key={cohort.id} cohort={cohort} onSaved={saved} />
            ))}
          </div>
        </section>
      )}

      {data && data.figures_not_shown.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          <p className="flex items-center gap-2 font-semibold">
            <AlertCircle className="size-4 shrink-0" />
            Entered figures the table has no place for
          </p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {data.figures_not_shown.map((figure) => (
              <li key={`${figure.cohort}-${figure.entry_class}-${figure.year}`}>
                {titleOf(figure.cohort)} ({figure.entry_class}), {figure.year}:{" "}
                {figure.paid.toLocaleString()} paid
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-2">
        <div>
          <h2 className="text-base font-bold text-foreground">Students paid</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Click a year to enter how many were paid. An entered figure shows instead of the payment
            records, and is marked as entered. Years still to come and graduated years take no figure.
          </p>
        </div>
        <MeStatsGrid
          data={data}
          isLoading={isLoading}
          onEdit={(row, cell) => setEditing({ row, cell })}
        />
      </section>

      {editing && (
        <FigureDialog
          row={editing.row}
          cell={editing.cell}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </div>
  )
}
