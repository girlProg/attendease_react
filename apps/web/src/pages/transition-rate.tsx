import { useQuery } from "@tanstack/react-query"
import { Users, CheckSquare, AlertTriangle, TrendingUp } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { FilterSelect } from "@/components/filter-select"
import { PaginationBar } from "@/components/pagination-bar"
import { useAttendanceFilters } from "@/hooks/use-attendance-filters"
import { useLogVisit } from "@/hooks/use-log-visit"
import { api } from "@/lib/api"
import { useState } from "react"

interface TransitionStudent {
  id: number
  name: string
  school: string
  cohort: string | number
  status: string
}

interface TransitionSummary {
  total_students: number
  transitioned: number
  dropped_out: number
  transition_rate: number
}

interface TransitionRateResponse {
  from_year: number
  to_year: number
  summary: TransitionSummary
  students: TransitionStudent[]
}

const getTransitionRate = (params: Record<string, string>) =>
  api.get<TransitionRateResponse>("/dashboard/transition-rate/", { params }).then((response) => response.data)

export function TransitionRatePage() {
  useLogVisit("Analytics", "Visited Transition Rate")
  const { filters, setFilter, selectedIds, options } = useAttendanceFilters()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)

  const queryParams: Record<string, string> = {}
  if (selectedIds.cohort) queryParams.cohort = String(selectedIds.cohort)
  if (filters.year) queryParams.year = filters.year

  const hasRequiredFilters = !!(selectedIds.cohort && filters.year)

  const { data, isLoading } = useQuery({
    queryKey: ["transition-rate", queryParams],
    queryFn: () => getTransitionRate(queryParams),
    enabled: hasRequiredFilters,
  })

  const summary = data?.summary
  const students = data?.students ?? []
  const fromYear = data?.from_year ?? filters.year ?? "—"
  const toYear = data?.to_year ?? (filters.year ? Number(filters.year) + 1 : "—")

  const totalPages = Math.ceil(students.length / pageSize)
  const pagedStudents = students.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-foreground">Transition</h1>
          {filters.year && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-4 py-1.5 text-sm font-semibold text-brand">
              {fromYear} <span className="text-brand/60">→</span> {toYear}
            </span>
          )}
        </div>
        <FilterSelect
          placeholder="All cohorts"
          value={filters.cohort}
          items={options.cohorts}
          onValueChange={(value) => setFilter("cohort", value ?? "__clear__")}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        How many beneficiaries progressed to the next academic year — and how attendance predicted it.
      </p>

      {/* Year filter */}
      <div className="flex gap-3">
        <FilterSelect
          placeholder="Year"
          value={filters.year}
          items={options.years}
          onValueChange={(value) => setFilter("year", value ?? "__clear__")}
        />
      </div>

      {!hasRequiredFilters && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Select a cohort and year to view transition rates.
        </p>
      )}

      {hasRequiredFilters && isLoading && (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      )}

      {data && summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <SummaryCard
              icon={<Users className="size-5" />}
              iconBg="bg-brand/10 text-brand"
              label="Students tracked"
              value={summary.total_students.toLocaleString()}
              subtitle={`${fromYear} cohort`}
            />
            <SummaryCard
              icon={<CheckSquare className="size-5" />}
              iconBg="bg-emerald-100 text-emerald-600"
              label="Transitioned"
              value={summary.transitioned.toLocaleString()}
              valueColor="text-emerald-600"
              subtitle={`progressed to ${toYear}`}
            />
            <SummaryCard
              icon={<AlertTriangle className="size-5" />}
              iconBg="bg-orange-100 text-orange-600"
              label="Dropped out"
              value={summary.dropped_out.toLocaleString()}
              valueColor="text-orange-600"
              subtitle="did not return"
            />
            <SummaryCard
              icon={<TrendingUp className="size-5" />}
              iconBg="bg-brand/10 text-brand"
              label="Transition rate"
              value={`${summary.transition_rate.toFixed(1)}%`}
              valueColor="text-brand"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* Outcome split donut */}
            <div className="rounded-2xl border border-border/40 bg-white p-6 lg:col-span-2">
              <h2 className="text-lg font-bold text-foreground">Outcome split</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Of {summary.total_students.toLocaleString()} tracked beneficiaries.
              </p>
              <div className="flex justify-center py-4">
                <DonutChart
                  transitioned={summary.transitioned}
                  dropped={summary.dropped_out}
                  rate={summary.transition_rate}
                />
              </div>
              <div className="mt-4 flex justify-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block size-3 rounded-sm bg-brand" /> Transitioned
                  </div>
                  <p className="mt-1 text-xl font-bold text-foreground">{summary.transitioned.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block size-3 rounded-sm bg-orange-300" /> Dropped out
                  </div>
                  <p className="mt-1 text-xl font-bold text-orange-600">{summary.dropped_out.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Status breakdown placeholder */}
            <div className="rounded-2xl border border-border/40 bg-white p-6 lg:col-span-3">
              <h2 className="text-lg font-bold text-foreground">Attendance predicts retention</h2>
              <p className="mb-6 text-xs text-muted-foreground">
                Students grouped by their {fromYear} attendance average. Dropout risk rises sharply below the 75% threshold.
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-sm bg-brand" /> Transitioned
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-sm bg-orange-300" /> Dropped out
                </span>
              </div>
              <div className="mt-6 flex h-8 overflow-hidden rounded-lg">
                <div
                  className="bg-brand"
                  style={{ width: `${summary.transition_rate}%` }}
                />
                <div
                  className="bg-orange-300"
                  style={{ width: `${100 - summary.transition_rate}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{summary.transitioned.toLocaleString()} transitioned</span>
                <span>{summary.dropped_out.toLocaleString()} dropped out</span>
              </div>
            </div>
          </div>

          {/* Student-level table */}
          <div className="rounded-2xl border border-border/40 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Student-level transition</h2>
              <button type="button" className="text-sm font-semibold text-brand hover:underline">
                Export CSV →
              </button>
            </div>

            <PaginationBar
              totalPages={totalPages}
              currentPage={page}
              onPageChange={setPage}
              rowOptions={["100", "500", "1000", "2000"]}
              defaultRows={String(pageSize)}
              onRowsChange={(value) => {
                setPageSize(Number(value))
                setPage(1)
              }}
            />

            <Table>
              <TableHeader>
                <TableRow className="border-border/40 bg-transparent hover:bg-transparent">
                  <TableHead className="w-16 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">S/N</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">School</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cohort</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No data to display :/
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedStudents.map((student, index) => {
                    const isTransitioned = student.status === "transitioned"
                    return (
                      <TableRow key={student.id} className="border-border/40">
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {(page - 1) * pageSize + index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <StudentAvatar name={student.name} />
                            <span className="text-sm font-semibold text-foreground">{student.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{student.school}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{student.cohort}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              isTransitioned
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border border-red-200 bg-red-50 text-red-600"
                            }`}
                          >
                            {isTransitioned ? "Transitioned" : "Dropped out"}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({
  icon,
  iconBg,
  label,
  value,
  valueColor,
  subtitle,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  valueColor?: string
  subtitle?: string
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex size-9 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
      </div>
      <p className={`text-3xl font-bold ${valueColor ?? "text-foreground"}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function DonutChart({
  transitioned,
  dropped,
  rate,
}: {
  transitioned: number
  dropped: number
  rate: number
}) {
  const total = transitioned + dropped
  const transitionedAngle = total > 0 ? (transitioned / total) * 360 : 360
  const r = 80
  const stroke = 24
  const cx = 110
  const cy = 110

  function arcPath(startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, endAngle)
    const end = polarToCartesian(cx, cy, r, startAngle)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
  }

  return (
    <svg width="220" height="220" viewBox="0 0 220 220">
      <path
        d={arcPath(transitionedAngle - 90, 270)}
        fill="none"
        stroke="#fdba74"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path
        d={arcPath(-90, transitionedAngle - 90)}
        fill="none"
        stroke="var(--color-brand, #4f46e5)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-brand text-3xl font-bold">
        {rate.toFixed(1)}%
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="fill-muted-foreground text-xs">
        transition rate
      </text>
    </svg>
  )
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function StudentAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
      {initials}
    </div>
  )
}
