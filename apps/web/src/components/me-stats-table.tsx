import { AlertCircle } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TableEmptyState } from "@/components/table-empty-state"
import { TableSkeletonRows } from "@/components/skeleton"
import { formatNaira } from "@/lib/formatters"
import type { MeStatsCell, MeStatsRow, MeStatsSource, MeStatsTable as Stats } from "@/api/me-stats"

const SOURCE_LABELS: Partial<Record<MeStatsSource, string>> = {
  entered: "Entered",
  system: "Payment records",
}

const SOURCE_STYLES: Partial<Record<MeStatsSource, string>> = {
  entered: "bg-sky-100 text-sky-800",
  system: "bg-emerald-100 text-emerald-800",
}

export function SourceTag({ source }: { source: MeStatsSource }) {
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
  const heading = `${cell.year} (${cell.class_name})`
  const body = (
    <span className="block space-y-1 text-left">
      <span className="block text-xs text-muted-foreground">{heading}</span>
      {cell.upcoming ? (
        cell.graduated ? null : (
          <span className="block text-sm text-muted-foreground/70">Upcoming</span>
        )
      ) : cell.graduated ? (
        cell.paid_after_graduating ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <AlertCircle className="size-3 shrink-0" />
            Payment records show payments
          </span>
        ) : null
      ) : cell.paid === null ? (
        <span className="block text-sm text-muted-foreground">No figure</span>
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
  if (!onEdit || cell.graduated || cell.upcoming) return body
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

/** Each cohort's entry class, year by year until they graduate. */
export function MeStatsGrid({
  data,
  isLoading,
  onEdit,
}: {
  data: Stats | undefined
  isLoading: boolean
  onEdit?: (row: MeStatsRow, cell: MeStatsCell) => void
}) {
  const columns = data?.columns ?? []
  const rows = data?.rows ?? []

  return (
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
                          onEdit={onEdit ? () => onEdit(row, cell) : undefined}
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
  )
}
