import { useState } from "react"
import { AlertCircle, Download } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { LabeledInput } from "@/components/form-fields"
import { PrimaryButton } from "@/components/primary-button"
import { QueryError } from "@/components/query-error"
import { TableEmptyState } from "@/components/table-empty-state"
import { TableSkeletonRows } from "@/components/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { useColumnDownload } from "@/hooks/use-column-download"
import { useLogVisit } from "@/hooks/use-log-visit"
import { formatNaira } from "@/lib/formatters"
import {
  getMeStats,
  meStatsExport,
  setEnrolmentYear,
  setPaidFigure,
  type MeStatsCell,
  type MeStatsCohort,
  type MeStatsRow,
  type MeStatsSource,
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

const SOURCE_LABELS: Partial<Record<MeStatsSource, string>> = {
  entered: "Entered",
  system: "Payment records",
}

const SOURCE_STYLES: Partial<Record<MeStatsSource, string>> = {
  entered: "bg-sky-100 text-sky-800",
  system: "bg-emerald-100 text-emerald-800",
}

function SourceTag({ source }: { source: MeStatsSource }) {
  const label = SOURCE_LABELS[source]
  if (!label) return null
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_STYLES[source]}`}>
      {label}
    </span>
  )
}

function FigureCell({
  cell,
  students,
  onEdit,
}: {
  cell: MeStatsCell
  students: number
  onEdit?: () => void
}) {
  const heading = cell.step === 0 ? `${cell.year}` : `${cell.year} (${cell.class_name})`
  const body = (
    <span className="block space-y-1 text-left">
      <span className="block text-xs text-muted-foreground">{heading}</span>
      {cell.graduated ? (
        cell.paid_after_graduating ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <AlertCircle className="size-3 shrink-0" />
            Payment records show payments
          </span>
        ) : null
      ) : cell.paid === null ? (
        <span className="block text-sm text-muted-foreground">Not entered</span>
      ) : (
        <>
          <span
            className={`block text-sm font-bold ${cell.paid > students ? "text-amber-700" : "text-foreground"}`}
            title={cell.paid > students ? "More than the students enrolled in this row" : undefined}
          >
            {cell.paid.toLocaleString()} paid
          </span>
          {cell.amount !== null && (
            <span className="block text-[11px] text-muted-foreground">
              {formatNaira(Number(cell.amount))}
            </span>
          )}
          <SourceTag source={cell.source} />
        </>
      )}
    </span>
  )
  if (!onEdit || cell.graduated) return body
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Change the figure for ${heading}`}
      className="-m-1 block w-[calc(100%+0.5rem)] rounded-lg p-1 hover:bg-sidebar/5"
    >
      {body}
    </button>
  )
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

  const save = useMutation({
    mutationFn: (clear: boolean) =>
      setPaidFigure({
        cohort: row.cohort,
        entry_class: row.entry_class,
        year: cell.year,
        paid_students: clear ? null : Number(paid),
        amount: clear || amount === "" ? null : amount,
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
  const [year, setYear] = useState(cohort.enrolment_year === null ? "" : String(cohort.enrolment_year))
  const save = useMutation({
    mutationFn: () => setEnrolmentYear(cohort.id, year === "" ? null : Number(year)),
    onSuccess: onSaved,
  })
  const changed = year !== (cohort.enrolment_year === null ? "" : String(cohort.enrolment_year))

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-2">
        <div className="w-32">
          <LabeledInput label={cohort.title} type="number" value={year} onChange={setYear} />
        </div>
        <Button
          variant="outline"
          className="h-11 rounded-full px-4"
          disabled={!changed || save.isPending}
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
 * How many of each cohort's entry class were paid in each year, as they move up
 * a class a year. Admins and viewers read it; superusers set each cohort's
 * enrolment year and type in the figures the payment records don't hold.
 */
export function MeStatsPage() {
  useLogVisit("M&E Stats", "Visited M&E Stats")
  const queryClient = useQueryClient()
  const { isSuperuser } = useAuth()
  const { data, isError, isLoading } = useQuery({ queryKey: ["me-stats"], queryFn: getMeStats })
  const [editing, setEditing] = useState<{ row: MeStatsRow; cell: MeStatsCell } | null>(null)
  const download = useColumnDownload(meStatsExport)

  const saved = (table: MeStatsTable) => {
    queryClient.setQueryData(["me-stats"], table)
    setEditing(null)
  }

  if (isError) return <QueryError />

  const columns = data?.columns ?? []
  const rows = data?.rows ?? []
  const cohortsWithoutYear = (data?.cohorts ?? []).filter((cohort) => cohort.enrolment_year === null)
  const titleOf = (id: number) => data?.cohorts.find((cohort) => cohort.id === id)?.title ?? id

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Students paid, by the class each cohort enrolled in, as they move up a class each year.
          Each number says where it came from: <SourceTag source="entered" /> was typed in from the
          programme&apos;s own records, and <SourceTag source="system" /> is counted from payments
          marked as paid.
        </p>
        <Button
          variant="outline"
          className="h-11 shrink-0 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
          {...download.press}
        >
          <Download className="size-4" />
          Download
        </Button>
        {download.dialog}
      </div>

      {isSuperuser && data && (
        <section className="space-y-3 rounded-2xl border border-border/40 bg-white p-5">
          <div>
            <h2 className="text-base font-bold text-foreground">Enrolment years</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The year each cohort enrolled. The table works out every later year and class from it.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            {data.cohorts.map((cohort) => (
              <EnrolmentYearField key={cohort.id} cohort={cohort} onSaved={saved} />
            ))}
          </div>
        </section>
      )}

      {cohortsWithoutYear.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          <AlertCircle className="size-4 shrink-0" />
          No enrolment year yet for {cohortsWithoutYear.map((cohort) => cohort.title).join(", ")}, so
          {cohortsWithoutYear.length === 1 ? " its row is" : " their rows are"} empty.
          {isSuperuser ? "" : " A superuser sets it on this page."}
        </p>
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

      {data && data.students_without_a_class > 0 && (
        <p className="text-xs text-muted-foreground">
          {data.students_without_a_class.toLocaleString()} students have no class at enrolment on
          record, so they aren&apos;t in any row.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold text-sidebar">S/N</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Details</TableHead>
              <TableHead className="text-right text-xs font-semibold text-sidebar">Enrolled</TableHead>
              {columns.map((column) => (
                <TableHead key={column} className="text-xs font-semibold text-sidebar">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={Math.max(columns.length + 3, 6)} rows={4} />
            ) : rows.length === 0 ? (
              <TableEmptyState colSpan={columns.length + 3} message="No students enrolled yet." />
            ) : (
              rows.map((row, index) => (
                <TableRow key={`${row.cohort}-${row.entry_class}`} className="border-border/40 align-top">
                  <TableCell className="text-sm">{index + 1}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm font-medium">{row.details}</TableCell>
                  <TableCell className="text-right text-sm">{row.students.toLocaleString()}</TableCell>
                  {columns.map((column, step) => {
                    const cell = row.cells[step]
                    return (
                      <TableCell key={column} className="min-w-[150px]">
                        {cell && (
                          <FigureCell
                            cell={cell}
                            students={row.students}
                            onEdit={isSuperuser ? () => setEditing({ row, cell }) : undefined}
                          />
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
