import type { CSSProperties, ReactNode } from "react"
import { AlertCircle } from "lucide-react"

import type { MeStatsCell, MeStatsRow, MeStatsTable as Stats } from "@/api/me-stats"

// Under this share of the row paid, a year reads as hardly paid at all.
const HARDLY_PAID_SHARE = 0.01

const NO_PAYMENTS_STRIPES: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgb(251 214 190 / 0.75) 0 5px, rgb(255 247 240) 5px 11px)",
}

const CELL_CLASS = "block h-full min-h-[84px] w-full rounded-xl border p-2 text-left"

function shortNaira(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `₦${Math.round(amount / 1_000)}k`
  return `₦${amount.toLocaleString()}`
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`
}

function isDue(cell: MeStatsCell, thisYear: number): boolean {
  return (
    cell.year === thisYear && cell.paid === null && !cell.graduated && cell.ongoing_terms.length === 0
  )
}

function TermsPaid({ cell }: { cell: MeStatsCell }) {
  if (cell.terms.length === 0) return null
  const [last, ...earlier] = [...cell.terms].reverse()
  const names = earlier.length > 0 ? `${[...earlier].reverse().join(", ")} & ${last}` : `${last}`
  return (
    <span className="block text-[11px] font-medium text-foreground/80">
      {cell.terms.length === 1 ? "Term" : "Terms"} {names}
    </span>
  )
}

function OngoingTerms({ cell }: { cell: MeStatsCell }) {
  return (
    <>
      {cell.ongoing_terms.map((entry) => (
        <span key={entry.term} className="mt-1 block text-[11px] text-muted-foreground">
          <span className="block font-bold text-sky-800">Term {entry.term} ongoing</span>
          {entry.attempted.toLocaleString()} of {entry.students.toLocaleString()} attempted
        </span>
      ))}
    </>
  )
}

function PaidBody({ cell, students }: { cell: MeStatsCell; students: number }) {
  const paid = cell.paid ?? 0
  const share = students > 0 ? paid / students : 0
  const tooMany = paid > students
  return (
    <>
      <span className="block text-[11px] font-semibold text-muted-foreground">{cell.class_name}</span>
      {cell.amount !== null && (
        <span className="block text-base font-bold text-emerald-900">
          {shortNaira(Number(cell.amount))}
        </span>
      )}
      <span
        className={
          cell.amount !== null
            ? `block text-[11px] ${tooMany ? "font-semibold text-amber-700" : "text-muted-foreground"}`
            : `block text-base font-bold ${tooMany ? "text-amber-700" : "text-emerald-900"}`
        }
        title={tooMany ? "More than the eligible students in this row" : undefined}
      >
        {plural(paid, "student")}
      </span>
      <TermsPaid cell={cell} />
      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-emerald-100">
        <span
          className="block h-full rounded-full bg-emerald-700"
          style={{ width: `${Math.min(100, share * 100)}%` }}
        />
      </span>
      {cell.source === "entered" && (
        <span className="mt-1 block text-[10px] font-semibold text-sky-800">Entered</span>
      )}
      <OngoingTerms cell={cell} />
    </>
  )
}

/** One year of one row. ``onEdit`` makes it clickable (Settings). */
function YearCell({
  cell,
  students,
  thisYear,
  onEdit,
}: {
  cell: MeStatsCell
  students: number
  thisYear: number
  onEdit?: () => void
}) {
  if (cell.graduated) {
    return (
      <span className="flex h-full min-h-[84px] items-center px-2 text-xs font-semibold text-muted-foreground/70">
        {cell.paid_after_graduating ? (
          <span className="flex items-center gap-1 text-amber-700">
            <AlertCircle className="size-3 shrink-0" />
            Graduated, payments on record
          </span>
        ) : (
          "Graduated"
        )}
      </span>
    )
  }
  if (cell.upcoming) {
    return (
      <span className={`${CELL_CLASS} border-transparent bg-muted/60`}>
        <span className="block text-[11px] font-semibold text-muted-foreground/60">
          {cell.class_name}
        </span>
      </span>
    )
  }

  let style: CSSProperties | undefined
  let tone: string
  let body: ReactNode
  const paid = cell.paid
  if (paid !== null && (students === 0 || paid / students >= HARDLY_PAID_SHARE)) {
    tone = "border-emerald-200 bg-emerald-50"
    body = <PaidBody cell={cell} students={students} />
  } else if (paid !== null) {
    tone = "border-orange-200 bg-orange-50"
    body = (
      <>
        <span className="block text-[11px] font-semibold text-muted-foreground">{cell.class_name}</span>
        {cell.amount !== null && (
          <span className="block text-sm font-bold text-orange-800">
            {shortNaira(Number(cell.amount))}
          </span>
        )}
        <span
          className={
            cell.amount !== null
              ? "block text-[11px] text-muted-foreground"
              : "block text-sm font-bold text-orange-800"
          }
        >
          {paid.toLocaleString()} of {students.toLocaleString()} paid
        </span>
        <TermsPaid cell={cell} />
        {cell.source === "entered" && (
          <span className="mt-1 block text-[10px] font-semibold text-sky-800">Entered</span>
        )}
        <OngoingTerms cell={cell} />
      </>
    )
  } else if (cell.ongoing_terms.length > 0) {
    tone = "border-sky-300 bg-sky-50"
    body = (
      <>
        <span className="block text-[11px] font-semibold text-muted-foreground">{cell.class_name}</span>
        <OngoingTerms cell={cell} />
      </>
    )
  } else if (isDue(cell, thisYear)) {
    tone = "border-2 border-dashed border-sidebar/70 bg-sidebar/5"
    body = (
      <>
        <span className="block text-[11px] font-semibold text-sidebar">{cell.class_name}</span>
        <span className="block text-sm font-bold text-sidebar">Due</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {students.toLocaleString()} eligible
        </span>
      </>
    )
  } else {
    tone = "border-orange-200"
    style = NO_PAYMENTS_STRIPES
    body = (
      <>
        <span className="block text-[11px] font-semibold text-muted-foreground">{cell.class_name}</span>
        <span className="block text-sm font-bold text-orange-800">No payments</span>
      </>
    )
  }

  if (!onEdit) {
    return (
      <span className={`${CELL_CLASS} ${tone}`} style={style}>
        {body}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Change the figure for ${cell.class_name}, ${cell.year}`}
      className={`${CELL_CLASS} ${tone} transition hover:ring-2 hover:ring-sidebar/40`}
      style={style}
    >
      {body}
    </button>
  )
}

function rowSummary(row: MeStatsRow): string {
  const paidCells = row.cells.filter((cell) => cell.paid !== null)
  const amount = paidCells.reduce((total, cell) => total + Number(cell.amount ?? 0), 0)
  const eligible = `${row.students.toLocaleString()} eligible`
  if (paidCells.length === 0) return `${eligible} · nothing paid yet`
  if (amount === 0) return `${eligible} · paid, amount not given`
  return `${eligible} · ${shortNaira(amount)} paid`
}

function YearTotal({ year, rows, thisYear }: { year: number; rows: MeStatsRow[]; thisYear: number }) {
  if (year > thisYear) return null
  const cells = rows.flatMap((row) => row.cells.filter((cell) => cell.year === year))
  const paidCells = cells.filter((cell) => cell.paid !== null)
  const due = cells.filter((cell) => isDue(cell, thisYear)).length
  const ongoing = cells.filter((cell) => cell.ongoing_terms.length > 0).length
  const students = paidCells.reduce((total, cell) => total + (cell.paid ?? 0), 0)
  const amount = paidCells.reduce((total, cell) => total + Number(cell.amount ?? 0), 0)

  return (
    <div className="px-1 text-xs">
      {paidCells.length > 0 ? (
        <>
          <span className="block text-sm font-bold text-foreground">
            {amount > 0 ? shortNaira(amount) : plural(students, "student")}
          </span>
          {amount > 0 && <span className="block text-muted-foreground">{plural(students, "student")}</span>}
        </>
      ) : due === 0 && ongoing === 0 ? (
        <span className="block text-sm font-bold text-orange-800">None</span>
      ) : null}
      {ongoing > 0 && (
        <span className="block font-bold text-sky-800">
          {ongoing} {ongoing === 1 ? "group" : "groups"} ongoing
        </span>
      )}
      {due > 0 && (
        <>
          <span className="block text-sm font-bold text-sidebar">{due} due</span>
          <span className="block text-muted-foreground">{due === 1 ? "group" : "groups"}</span>
        </>
      )}
    </div>
  )
}

function LegendItem({ swatch, style, label }: { swatch: string; style?: CSSProperties; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-4 rounded ${swatch}`} style={style} />
      {label}
    </span>
  )
}

export function MeStatsSummary({ data }: { data: Stats }) {
  const eligible = data.rows.reduce((total, row) => total + row.students, 0)
  const amount = data.rows
    .flatMap((row) => row.cells)
    .reduce((total, cell) => total + Number(cell.amount ?? 0), 0)
  return (
    <p className="text-sm text-muted-foreground">
      {plural(data.cohorts.length, "cohort")} · {plural(data.rows.length, "class group")} ·{" "}
      {eligible.toLocaleString()} eligible · {shortNaira(amount)} paid
    </p>
  )
}

export function MeStatsLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <LegendItem swatch="border border-emerald-200 bg-emerald-50" label="Paid (bar = share of eligible)" />
      <LegendItem swatch="border border-orange-200" style={NO_PAYMENTS_STRIPES} label="No payments" />
      <LegendItem swatch="border border-sky-300 bg-sky-50" label="Ongoing" />
      <LegendItem swatch="border-2 border-dashed border-sidebar/70 bg-sidebar/5" label="Due this year" />
      <LegendItem swatch="bg-muted" label="Upcoming" />
    </div>
  )
}

/** Each cohort's entry class laid out by calendar year, until they graduate. */
export function MeStatsGrid({
  data,
  isLoading,
  onEdit,
}: {
  data: Stats | undefined
  isLoading: boolean
  onEdit?: (row: MeStatsRow, cell: MeStatsCell) => void
}) {
  if (isLoading || !data) {
    return (
      <div className="rounded-2xl border border-border/40 bg-white p-8 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }
  const { rows, this_year: thisYear } = data
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border/40 bg-white p-8 text-center text-sm text-muted-foreground">
        No eligible students yet.
      </div>
    )
  }

  const allYears = rows.flatMap((row) => row.cells.map((cell) => cell.year))
  const years: number[] = []
  if (allYears.length > 0) {
    for (let year = Math.min(...allYears); year <= Math.max(...allYears); year += 1) years.push(year)
  }
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `minmax(230px, 1.4fr) repeat(${Math.max(years.length, 1)}, minmax(104px, 1fr))`,
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white p-5">
      <div className="grid min-w-max gap-1.5" style={gridStyle}>
        <div className="self-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Cohort
        </div>
        {years.length === 0 && <div />}
        {years.map((year) => (
          <div
            key={year}
            className={`rounded-lg px-2.5 py-1.5 text-sm font-bold ${
              year === thisYear
                ? "bg-sidebar text-white"
                : year > thisYear
                  ? "text-muted-foreground/70"
                  : "text-foreground"
            }`}
          >
            {year}
            {year === thisYear && <span className="block text-[11px] font-medium">This year</span>}
          </div>
        ))}

        {rows.map((row) => {
          const title = row.details.replace(/\s*\([^)]*\)$/, "")
          return (
            <div key={`${row.cohort}-${row.entry_class}`} className="contents">
              <div className="self-center pr-3">
                <p className="text-sm">
                  <span className="font-bold text-foreground">{title}</span>{" "}
                  <span className="text-foreground/80">({row.entry_class})</span>
                </p>
                <p className="text-xs text-muted-foreground">{rowSummary(row)}</p>
              </div>
              {years.length === 0 && (
                <div className="self-center text-xs text-muted-foreground">No enrolment year yet</div>
              )}
              {years.map((year) => {
                const cell = row.cells.find((candidate) => candidate.year === year)
                if (!cell) return <div key={year} />
                return (
                  <YearCell
                    key={year}
                    cell={cell}
                    students={row.students}
                    thisYear={thisYear}
                    onEdit={onEdit ? () => onEdit(row, cell) : undefined}
                  />
                )
              })}
            </div>
          )
        })}

        {years.length > 0 && (
          <>
            <div className="col-span-full mt-2 border-t border-border/60" />
            <div className="self-start text-sm font-bold text-foreground">Paid that year</div>
            {years.map((year) => (
              <YearTotal key={year} year={year} rows={rows} thisYear={thisYear} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
