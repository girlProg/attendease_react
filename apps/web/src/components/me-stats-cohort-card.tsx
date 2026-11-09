import type { CSSProperties } from "react"

import type { MeStatsCell, MeStatsRow, MeStatsTable } from "@/api/me-stats"
import {
  HARDLY_PAID_SHARE,
  NO_PAYMENTS_STRIPES,
  hasNoPayments,
  isDue,
  isHistoric,
  plural,
  rowTitle,
  shortNaira,
  termName,
  termsPaidText,
} from "@/lib/me-stats"

function isHardlyPaid(cell: MeStatsCell, students: number): boolean {
  return cell.paid !== null && students > 0 && cell.paid / students < HARDLY_PAID_SHARE
}

function paidText(cell: MeStatsCell, students: number): string {
  const paid = cell.paid ?? 0
  if (students === 0 || paid > students || isHardlyPaid(cell, students)) {
    return `${paid.toLocaleString()} paid`
  }
  return `${Math.round((paid / students) * 100)}% paid`
}

function where(row: MeStatsRow, thisYear: number): string {
  const graduated = row.cells.find((cell) => cell.graduated && cell.year <= thisYear)
  if (graduated) return `Graduated ${graduated.year}`
  const years = row.cells.filter((cell) => !cell.graduated)
  const position = years.findIndex((cell) => cell.year === thisYear)
  if (position === -1) return ""
  return `Now in ${years[position].class_name} · year ${position + 1} of ${years.length}`
}

function YearSegment({
  cell,
  students,
  thisYear,
}: {
  cell: MeStatsCell
  students: number
  thisYear: number
}) {
  const noPayments = hasNoPayments(cell, thisYear)
  const due = isDue(cell, thisYear)
  const ongoing = cell.ongoing_terms.length > 0
  let bar = "bg-muted"
  let style: CSSProperties | undefined
  if (cell.paid !== null) bar = isHardlyPaid(cell, students) ? "bg-orange-300" : "bg-emerald-700"
  else if (ongoing) bar = "bg-sky-300"
  else if (due) bar = "border border-dashed border-sidebar/70 bg-white"
  else if (noPayments) style = NO_PAYMENTS_STRIPES

  return (
    <div className="min-w-0 flex-1">
      <span className={`block h-2 rounded-full ${bar}`} style={style} />
      <p className="mt-2 text-xs font-bold text-foreground">{cell.class_name}</p>
      <p className="text-[11px] text-muted-foreground">{cell.year}</p>
      {cell.paid !== null && (
        <p
          className={`text-[11px] font-bold ${
            isHardlyPaid(cell, students) ? "text-orange-800" : "text-emerald-800"
          }`}
        >
          {paidText(cell, students)}
        </p>
      )}
      {cell.terms.length > 0 && <p className="text-[11px] text-foreground/80">{termsPaidText(cell)}</p>}
      {cell.ongoing_terms.map((entry) => (
        <p key={entry.term} className="text-[11px] font-bold text-sky-800">
          {termName(cell.step, entry.term)} ongoing
        </p>
      ))}
      {due && <p className="text-[11px] font-bold text-sidebar">Due now</p>}
      {noPayments && <p className="text-[11px] font-bold text-orange-800">No payments</p>}
      {isHistoric(cell) && (
        <p className="text-[10px] font-semibold text-sky-800">Historic</p>
      )}
    </div>
  )
}

function notesFor(row: MeStatsRow, thisYear: number) {
  const noPayments = row.cells.filter((cell) => hasNoPayments(cell, thisYear))
  const notes: { text: string; tone: "warn" | "due" }[] = []
  if (noPayments.length > 0) {
    const years = noPayments.map((cell) => cell.year).join(", ")
    notes.push({
      text: `${plural(noPayments.length, "year")} with no payments (${years})`,
      tone: "warn",
    })
  }
  for (const cell of row.cells) {
    if (isHardlyPaid(cell, row.students)) {
      notes.push({
        text: `${cell.year}: only ${cell.paid?.toLocaleString()} of ${row.students.toLocaleString()} paid`,
        tone: "warn",
      })
    }
    if (isDue(cell, thisYear)) {
      notes.push({
        text: `${cell.year} payment due · ${row.students.toLocaleString()} students`,
        tone: "due",
      })
    }
    if (cell.paid_after_graduating) {
      notes.push({ text: `${cell.year}: payments after graduating`, tone: "warn" })
    }
  }
  return notes
}

/** One cohort and class group from enrolment to graduation. */
export function MeStatsCohortCard({
  row,
  thisYear,
  onOpen,
}: {
  row: MeStatsRow
  thisYear: number
  onOpen?: () => void
}) {
  const years = row.cells.filter((cell) => !cell.graduated)
  const amount = row.cells.reduce((total, cell) => total + Number(cell.amount ?? 0), 0)
  const notes = notesFor(row, thisYear)
  const first = row.cells[0]

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-base font-bold text-foreground">{rowTitle(row)}</h3>
        <span className="rounded-full bg-sidebar/10 px-2.5 py-0.5 text-xs font-semibold text-sidebar">
          from {row.entry_class}
          {first && ` · ${first.year}`}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {row.students.toLocaleString()} eligible
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl font-bold text-foreground">{shortNaira(amount)}</span>
        <span className="text-sm text-muted-foreground">paid to date</span>
        <span className="ml-auto text-xs font-semibold text-sidebar">{where(row, thisYear)}</span>
      </div>
      {years.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <div className="flex min-w-[420px] gap-1">
            {years.map((cell) => (
              <YearSegment key={cell.year} cell={cell} students={row.students} thisYear={thisYear} />
            ))}
          </div>
        </div>
      )}
      {notes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {notes.map((note) => (
            <span
              key={note.text}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                note.tone === "warn" ? "bg-orange-50 text-orange-800" : "bg-sidebar/10 text-sidebar"
              }`}
            >
              {note.text}
            </span>
          ))}
        </div>
      )}
    </>
  )

  const frame = "block w-full rounded-2xl border border-border/40 bg-white p-5 text-left"
  if (!onOpen) return <div className={frame}>{body}</div>
  return (
    <button type="button" onClick={onOpen} className={`${frame} transition hover:ring-2 hover:ring-sidebar/30`}>
      {body}
    </button>
  )
}

function Tile({ label, value, note, warn }: { label: string; value: string; note: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-white p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${warn ? "text-orange-800" : "text-foreground"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

/** Every cohort and class group, with the programme's totals on top. */
export function MeStatsSummaryCards({
  data,
  onOpen,
}: {
  data: MeStatsTable
  onOpen: (row: MeStatsRow) => void
}) {
  const cells = data.rows.flatMap((row) => row.cells)
  const amount = cells.reduce((total, cell) => total + Number(cell.amount ?? 0), 0)
  const studentYears = cells.reduce((total, cell) => total + (cell.paid ?? 0), 0)
  const eligible = data.rows.reduce((total, row) => total + row.students, 0)
  const missing = data.rows.flatMap((row) =>
    row.cells
      .filter((cell) => hasNoPayments(cell, data.this_year))
      .map((cell) => ({ cohort: row.cohort, year: cell.year })),
  )
  const missingYears = missing.map((entry) => entry.year)
  const missingCohorts = new Set(missing.map((entry) => entry.cohort)).size

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Eligible" value={eligible.toLocaleString()} note={plural(data.cohorts.length, "cohort")} />
        <Tile
          label="Disbursed to date"
          value={shortNaira(amount)}
          note={`₦${amount.toLocaleString()}`}
        />
        <Tile
          label="Student-years paid"
          value={studentYears.toLocaleString()}
          note="one per student per year paid"
        />
        <Tile
          label="Past years with no payments"
          value={missing.length.toLocaleString()}
          warn={missing.length > 0}
          note={
            missing.length > 0
              ? `across ${plural(missingCohorts, "cohort")}, ${Math.min(...missingYears)} to ${Math.max(...missingYears)}`
              : "none"
          }
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.rows.map((row) => (
          <MeStatsCohortCard
            key={`${row.cohort}-${row.entry_class}`}
            row={row}
            thisYear={data.this_year}
            onOpen={() => onOpen(row)}
          />
        ))}
      </div>
    </div>
  )
}
