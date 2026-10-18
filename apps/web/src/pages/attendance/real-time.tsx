import { useState } from "react"
import { X } from "lucide-react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PaginationBar } from "@/components/pagination-bar"
import { AttendanceTable } from "@/components/attendance-table"
import { InactiveSchoolNotice } from "@/components/inactive-school-notice"
import { SearchBar } from "@/components/search-bar"
import { TableEmptyState } from "@/components/table-empty-state"
import { TableSkeletonRows } from "@/components/skeleton"
import { WeekLabel } from "@/components/week-cell"
import {
  getAttendance,
  getAttendanceBySchool,
  getAttendanceByWeek,
  getAttendanceReasons,
  type AttendanceWeekSummary,
  type NoteFilters,
} from "@/api/attendance"
import { getConfig } from "@/api/config"
import { getTermLabel } from "@/lib/formatters"
import { usePagination } from "@/hooks/use-pagination"
import type { FilterScope } from "@/hooks/use-attendance-filters"

type View = "rows" | "schools" | "weeks"
type PickedWeek = { year: number | null; term: number; week: number }

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Every attendance row under the bar's filters, with this tab's own filters on
 * the rows' reason and remark (they live here, not in the shared bar, because
 * only this tab shows reasons and remarks). "By school" counts the same rows
 * per school, and "By week" sums them per week — the average as qualification
 * counts it beside the registers' own, closures, holidays and top reasons.
 * Picking a school or a week there narrows the rows to it.
 */
export function RealTime({
  search = "",
  scope,
  ready,
  schoolName,
}: {
  search?: string
  scope: FilterScope
  ready: boolean
  schoolName?: string
}) {
  const [view, setView] = useState<View>("rows")
  const [note, setNote] = useState("")
  const [reason, setReason] = useState("")
  const [hasNote, setHasNote] = useState(false)
  const [pickedSchool, setPickedSchool] = useState<{ id: number; name: string } | null>(null)
  const [pickedWeek, setPickedWeek] = useState<PickedWeek | null>(null)

  // The bar's school wins; a pick from By school narrows only when it has none.
  const narrowedTo = pickedSchool && !scope.school ? pickedSchool : null
  // Likewise a week picked from By week, only while the bar has no week.
  const narrowedWeek = pickedWeek && !scope.week ? pickedWeek : null
  const rowScope: FilterScope = narrowedWeek
    ? {
        ...scope,
        ...(narrowedWeek.year ? { year: String(narrowedWeek.year) } : {}),
        term: String(narrowedWeek.term),
        week: String(narrowedWeek.week),
      }
    : scope
  const notes: NoteFilters = {
    ...(note ? { note } : {}),
    ...(reason ? { reason } : {}),
    ...(hasNote ? { hasNote } : {}),
    ...(narrowedTo ? { school: narrowedTo.id } : {}),
  }
  const noteFiltered = Boolean(note || reason || hasNote)

  const { page, setPage, pageSize, handleRowsChange } = usePagination([search, rowScope, notes, view])

  const rows = useQuery({
    queryKey: ["attendance", page, pageSize, search, rowScope, notes],
    queryFn: () => getAttendance(page, pageSize, search, rowScope, notes),
    enabled: ready && view === "rows",
    placeholderData: keepPreviousData,
  })
  const schools = useQuery({
    queryKey: ["attendance-by-school", page, pageSize, search, rowScope, notes],
    queryFn: () => getAttendanceBySchool(page, pageSize, search, rowScope, notes),
    enabled: ready && view === "schools",
    placeholderData: keepPreviousData,
  })
  // Every week under the bar's filters (a picked week doesn't narrow this).
  const weeks = useQuery({
    queryKey: ["attendance-by-week", search, scope, notes],
    queryFn: () => getAttendanceByWeek(search, scope, notes),
    enabled: ready && view === "weeks",
    placeholderData: keepPreviousData,
  })
  const { data: commonReasons } = useQuery({
    queryKey: ["attendance-reasons", search, rowScope, { ...notes, reason: undefined }],
    queryFn: () => getAttendanceReasons(search, rowScope, notes),
    enabled: ready,
    placeholderData: keepPreviousData,
  })
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: getConfig, staleTime: Infinity })
  const qualifying = config?.qualifying_attendance_average ?? 70

  const paged = view === "rows" ? rows : schools
  const totalPages = paged.data ? Math.ceil(paged.data.count / pageSize) : 0
  const failed = view === "weeks" ? weeks : paged

  if (failed.isError) return <p>{String(failed.error)}</p>

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-border/40 bg-white p-4">
        <SearchBar placeholder="Reason or remark contains…" onSearch={(value) => setNote(value.trim())} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={hasNote}
              onChange={(event) => setHasNote(event.target.checked)}
            />
            Only rows with a reason or remark
          </label>
          <div className="inline-flex shrink-0 rounded-full border border-border/60 p-0.5">
            {(
              [
                ["rows", "Rows"],
                ["schools", "By school"],
                ["weeks", "By week"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  view === value ? "bg-sidebar text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {(commonReasons?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Common reasons:</span>
            {commonReasons?.map((item) => (
              <button
                key={item.reason}
                type="button"
                aria-pressed={reason === item.reason}
                onClick={() => setReason(reason === item.reason ? "" : item.reason)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  reason === item.reason
                    ? "border-sidebar bg-sidebar text-white"
                    : "border-border/60 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {capitalise(item.reason)} ({item.count.toLocaleString()})
              </button>
            ))}
          </div>
        )}

        {(note || reason || narrowedTo || narrowedWeek) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Showing:</span>
            {note && <FilterChip label={`contains "${note}"`} onClear={() => setNote("")} />}
            {reason && <FilterChip label={`reason: ${capitalise(reason)}`} onClear={() => setReason("")} />}
            {narrowedTo && <FilterChip label={narrowedTo.name} onClear={() => setPickedSchool(null)} />}
            {narrowedWeek && (
              <FilterChip
                label={`week ${narrowedWeek.week}, ${getTermLabel(narrowedWeek.term)}${narrowedWeek.year ? ` ${narrowedWeek.year}` : ""}`}
                onClear={() => setPickedWeek(null)}
              />
            )}
          </div>
        )}
      </div>

      {view !== "weeks" && (
        <PaginationBar
          totalPages={totalPages}
          currentPage={page}
          onPageChange={setPage}
          defaultRows={String(pageSize)}
          onRowsChange={handleRowsChange}
        />
      )}

      {view === "weeks" ? (
        <WeekTable
          weeks={weeks.data}
          isLoading={(weeks.isLoading && !weeks.data) || !ready}
          qualifying={qualifying}
          onPick={(week) => {
            setPickedWeek({ year: week.year, term: week.term, week: week.week })
            setView("rows")
          }}
        />
      ) : view === "rows" ? (
        <>
          {rows.data && rows.data.results.length === 0 && scope.school && !noteFiltered && (
            <div className="rounded-2xl border border-border/40 bg-white px-5 py-4 text-center">
              <InactiveSchoolNotice school={scope.school} schoolName={schoolName} cohort={scope.cohort} />
            </div>
          )}
          <AttendanceTable
            records={rows.data?.results ?? []}
            page={page}
            pageSize={pageSize}
            isLoading={(rows.isLoading && !rows.data) || !ready}
          />
        </>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold text-sidebar">School</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">LGA</TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">Rows</TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">Students</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(schools.isLoading && !schools.data) || !ready ? (
                <TableSkeletonRows columns={4} />
              ) : (schools.data?.results.length ?? 0) === 0 ? (
                <TableEmptyState colSpan={4} />
              ) : (
                schools.data?.results.map((row) => (
                  <TableRow
                    key={row.school}
                    className="cursor-pointer border-border/40 hover:bg-muted/30"
                    title="Show this school's rows"
                    onClick={() => {
                      setPickedSchool({ id: row.school, name: row.school_name })
                      setView("rows")
                    }}
                  >
                    <TableCell className="text-xs font-semibold text-sidebar">{row.school_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.lga ?? "—"}</TableCell>
                    <TableCell className="text-center text-xs font-semibold text-brand">
                      {row.rows.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {row.students.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function percentClass(value: number | null, qualifying: number) {
  if (value === null) return "text-muted-foreground"
  if (value < qualifying / 2) return "text-red-600"
  if (value < qualifying) return "text-amber-600"
  return "text-emerald-600"
}

/** One row per week: the two averages, closures, holidays and top reasons. */
function WeekTable({
  weeks,
  isLoading,
  qualifying,
  onPick,
}: {
  weeks: AttendanceWeekSummary[] | undefined
  isLoading: boolean
  qualifying: number
  onPick: (week: AttendanceWeekSummary) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Counted</span> is the average as qualification
        counts it: over the days schools were open, closed weeks and weeks after the term&apos;s set
        length left out. <span className="font-medium text-foreground">Register</span> is the
        registers as recorded. Weeks under {qualifying}% are highlighted; click one to see its rows.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold text-sidebar">Week</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Students</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Counted</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Register</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Closed schools</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Holiday days</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Top reasons</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={7} />
            ) : (weeks?.length ?? 0) === 0 ? (
              <TableEmptyState colSpan={7} />
            ) : (
              weeks?.map((week) => {
                const low = week.counted_average !== null && week.counted_average < qualifying
                return (
                  <TableRow
                    key={`${week.year}-${week.term}-${week.week}`}
                    className={`cursor-pointer border-border/40 hover:bg-muted/30 ${low ? "bg-red-50/40" : ""}`}
                    title="Show this week's rows"
                    onClick={() => onPick(week)}
                  >
                    <TableCell className="text-xs font-semibold text-sidebar">
                      {getTermLabel(week.term)}{" "}
                      <WeekLabel year={week.year} term={week.term} week={week.week} />
                      {week.year ? <span className="ml-1 font-normal text-muted-foreground">{week.year}</span> : null}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {week.students.toLocaleString()}
                    </TableCell>
                    <TableCell className={`text-center text-xs font-bold ${percentClass(week.counted_average, qualifying)}`}>
                      {week.counted_average === null
                        ? week.after_term
                          ? "After term"
                          : "Doesn't count"
                        : `${week.counted_average}%`}
                    </TableCell>
                    <TableCell className={`text-center text-xs ${percentClass(week.register_average, qualifying)}`}>
                      {week.register_average === null ? "—" : `${week.register_average}%`}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {week.closed_schools ? week.closed_schools.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {week.holiday_days || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {week.reasons.length === 0
                        ? "—"
                        : week.reasons
                            .map((item) => `${capitalise(item.reason)} (${item.count.toLocaleString()})`)
                            .join(" · ")}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sidebar/10 px-3 py-1 font-medium text-sidebar">
      {label}
      <button type="button" onClick={onClear} aria-label={`Clear ${label}`} className="rounded-full hover:bg-sidebar/20">
        <X className="size-3" />
      </button>
    </span>
  )
}
