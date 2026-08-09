import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { getSchools, getAttendanceSummary } from "@/api/attendance"
import { AttendanceDialog } from "@/components/attendance-dialog"
import type { AttendanceDialogCell } from "@/components/attendance-dialog"
import { getTermLabel, formatAcademicYear, roundUpPercent } from "@/lib/formatters"
import type { AttendanceSummary, AttendanceSummaryTerm } from "@/types"

function normalizeCoverage(coverage: number): number {
  return coverage <= 1 ? coverage * 100 : coverage
}

function getCellColor(rawCoverage: number): string {
  const coverage = normalizeCoverage(rawCoverage)
  if (coverage >= 90) return "bg-emerald-600"
  if (coverage >= 80) return "bg-emerald-500"
  if (coverage >= 60) return "bg-emerald-400/80"
  if (coverage >= 50) return "bg-yellow-500"
  if (coverage >= 40) return "bg-orange-400"
  if (coverage >= 20) return "bg-orange-500"
  return "bg-red-500"
}

function getAverageColor(average: number): string {
  if (average >= 90) return "text-emerald-600"
  if (average >= 80) return "text-emerald-500"
  if (average >= 70) return "text-yellow-600"
  return "text-red-500"
}

function WeekCell({
  week,
  coverage,
  onClick,
}: {
  week: number
  coverage: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex size-5 items-center justify-center rounded-sm ${getCellColor(coverage)} cursor-pointer text-[7px] font-medium text-white/80 transition-opacity hover:opacity-80 hover:ring-2 hover:ring-sidebar/50`}
      title={`Week ${week}: ${roundUpPercent(normalizeCoverage(coverage))}%`}
    >
      {week}
    </button>
  )
}

function TermRow({
  term,
  schoolId,
  schoolName,
  year,
  totalEnrolled,
  cohort,
  onCellClick,
}: {
  term: AttendanceSummaryTerm
  schoolId: number
  schoolName: string
  year: string
  totalEnrolled: number
  cohort?: string
  onCellClick: (cell: AttendanceDialogCell) => void
}) {
  const termAverage = term.weeks.length > 0
    ? roundUpPercent(term.weeks.reduce((sum, week) => sum + normalizeCoverage(week.coverage), 0) / term.weeks.length)
    : 0

  return (
    <div className="flex items-center gap-2 pl-12">
      <span className="w-14 shrink-0 text-[11px] text-muted-foreground">{getTermLabel(term.term)}:</span>
      <div className="flex gap-0.5">
        {term.weeks.map((week) => (
          <WeekCell
            key={week.week}
            week={week.week}
            coverage={week.coverage}
            onClick={() => onCellClick({ schoolId, schoolName, year, term: term.term, week: week.week, totalEnrolled, cohort })}
          />
        ))}
      </div>
      <span className="text-[11px] font-semibold text-sidebar">{termAverage}%</span>
    </div>
  )
}

function SchoolHeatmap({
  summary,
  cohort,
  onCellClick,
}: {
  summary: AttendanceSummary
  cohort?: string
  onCellClick: (cell: AttendanceDialogCell) => void
}) {
  return (
    <div className="space-y-3">
      {summary.years.map((year) => (
        <div key={year.year} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-sidebar">{formatAcademicYear(year.year)}</span>
          </div>
          {year.terms.map((term) => (
            <TermRow
              key={term.term}
              term={term}
              schoolId={summary.school.id}
              schoolName={summary.school.name}
              year={year.year}
              totalEnrolled={summary.total_enrolled}
              cohort={cohort}
              onCellClick={onCellClick}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground">0%</span>
      <div className="flex h-2.5 w-36 overflow-hidden rounded-full">
        <div className="flex-1 bg-red-500" />
        <div className="flex-1 bg-orange-500" />
        <div className="flex-1 bg-orange-400" />
        <div className="flex-1 bg-yellow-500" />
        <div className="flex-1 bg-emerald-400/80" />
        <div className="flex-1 bg-emerald-500" />
        <div className="flex-1 bg-emerald-600" />
      </div>
      <span className="text-[10px] text-muted-foreground">100% marked</span>
    </div>
  )
}

function SchoolSummaryRow({
  schoolId,
  index,
  cohort,
  onCellClick,
}: {
  schoolId: number
  index: number
  cohort?: string
  onCellClick: (cell: AttendanceDialogCell) => void
}) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["attendance-summary", schoolId, cohort],
    queryFn: () => getAttendanceSummary(schoolId, cohort),
  })

  if (isLoading || !summary) {
    return (
      <TableRow className="border-border/40 align-top">
        <TableCell className="text-center text-sm text-muted-foreground">{index + 1}</TableCell>
        <TableCell colSpan={2} className="text-sm text-muted-foreground">Loading...</TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className="border-border/40 align-top">
      <TableCell className="text-center text-sm text-muted-foreground">{index + 1}</TableCell>
      <TableCell>
        <div className="space-y-0.5">
          <span className="text-sm font-bold text-foreground">{summary.school.name}</span>
          <p className="text-[11px] text-muted-foreground">{summary.total_enrolled} enrolled</p>
          <p className="flex items-baseline gap-1">
            <span className={`text-sm font-bold ${getAverageColor(summary.overall_average)}`}>
              {roundUpPercent(summary.overall_average)}%
            </span>
            <span className="text-[10px] text-muted-foreground">avg</span>
          </p>
        </div>
      </TableCell>
      <TableCell>
        <SchoolHeatmap summary={summary} cohort={cohort} onCellClick={onCellClick} />
      </TableCell>
    </TableRow>
  )
}

export function Statistics({ filters }: { filters: Record<string, string> }) {
  const [selectedCell, setSelectedCell] = useState<AttendanceDialogCell | null>(null)

  const { data: schools, isLoading } = useQuery({
    queryKey: ["schools-for-stats", filters.lga, filters.cohort],
    queryFn: () => getSchools(filters.lga, filters.cohort),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/40 bg-white px-6 py-5">
        <h2 className="text-base font-bold text-foreground">Weekly capture rate</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Every cell is one week. Shade shows the share of enrolled students whose attendance was taken that week.
        </p>
        <div className="mt-3">
          <Legend />
        </div>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading schools...</p>
      ) : !schools?.length ? (
        <p className="py-12 text-center text-muted-foreground">No schools found for the selected LGA.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-16 text-center text-xs font-semibold text-sidebar">S/N</TableHead>
                <TableHead className="w-40 text-xs font-semibold text-sidebar">School</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Weekly Capture</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map((school, index) => (
                <SchoolSummaryRow
                  key={school.id}
                  schoolId={school.id}
                  index={index}
                  cohort={filters.cohort}
                  onCellClick={setSelectedCell}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedCell && (
        <AttendanceDialog cell={selectedCell} onClose={() => setSelectedCell(null)} />
      )}
    </div>
  )
}
