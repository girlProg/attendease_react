import { useWeekDates } from "@/hooks/use-week-dates"

/** "Week 4" with the date it started underneath, when the term is dated. */
export function WeekLabel({
  year,
  term,
  week,
  className = "",
}: {
  year: number | string | null | undefined
  term: number | string
  week: number | string
  className?: string
}) {
  const { weekLabel } = useWeekDates()
  const starts = weekLabel(year, term, week)
  return (
    <span className={className}>
      Week {week}
      {starts && (
        <span className="block text-[10px] text-muted-foreground">
          from {starts}
        </span>
      )}
    </span>
  )
}

/**
 * How a recorded week counts: "Closed" when the school was shut (the week
 * does not count), otherwise the percentage over the days open, noting any
 * holiday days. Falls back to the register's figure for older payloads.
 */
export function CountedWeek({
  record,
  render,
}: {
  record: {
    attendance_average: number | string
    counted_average?: string | null
    holiday_days?: number
    school_closed?: boolean
    after_term?: boolean
  }
  render: (percent: number) => React.ReactNode
}) {
  if (record.after_term) {
    return (
      <span
        className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600"
        title="After the term's length set on the Settings page — it does not count towards qualification"
      >
        After term
      </span>
    )
  }
  if (record.school_closed) {
    return (
      <span
        className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600"
        title="The school was closed this week — it does not count towards qualification"
      >
        Closed
      </span>
    )
  }
  if (record.counted_average === null) {
    return (
      <span
        className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600"
        title="Every school day of this week was a holiday — it does not count"
      >
        Holiday
      </span>
    )
  }
  const percent = Number(
    record.counted_average ?? record.attendance_average ?? 0
  )
  const holidays = record.holiday_days ?? 0
  return (
    <span className="inline-flex flex-col items-center">
      {render(percent)}
      {holidays > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {holidays} day{holidays === 1 ? "" : "s"} off
        </span>
      )}
    </span>
  )
}
