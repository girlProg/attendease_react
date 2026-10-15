import { useQuery } from "@tanstack/react-query"

import { getTermDates } from "@/api/term-calendar"

const DAY_MS = 24 * 60 * 60 * 1000

function parseDay(value: string): Date {
  // "2025-09-08" as a local calendar day, not midnight UTC.
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function formatShortDate(value: Date | string): string {
  const date = typeof value === "string" ? parseDay(value) : value
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

/**
 * Dates for school weeks. School weeks are calendar weeks: week 1 is the
 * calendar week a term starts in, week N the (N-1)th after it — the same rule
 * the server applies. Terms without a start date have no dates.
 */
export function useWeekDates() {
  const { data } = useQuery({
    queryKey: ["term-dates"],
    queryFn: getTermDates,
    staleTime: 5 * 60 * 1000,
  })
  const starts = new Map(
    (data ?? [])
      .filter((term) => term.start_date)
      .map((term) => [`${term.year}-${term.term}`, term.start_date as string]),
  )

  /** Monday of the week (or the term's first day, for week 1), or null. */
  const weekStart = (
    year: number | string | null | undefined,
    term: number | string,
    week: number | string,
  ): Date | null => {
    if (year === null || year === undefined) return null
    const start = starts.get(`${year}-${term}`)
    if (!start) return null
    const first = parseDay(start)
    const monday = new Date(first.getTime() - ((first.getDay() + 6) % 7) * DAY_MS)
    const begins = new Date(monday.getTime() + (Number(week) - 1) * 7 * DAY_MS)
    return Number(week) === 1 && first > begins ? first : begins
  }

  /** "8 Sep" for the week's start, or "" when the term has no dates. */
  const weekLabel = (
    year: number | string | null | undefined,
    term: number | string,
    week: number | string,
  ): string => {
    const begins = weekStart(year, term, week)
    return begins ? formatShortDate(begins) : ""
  }

  return { weekStart, weekLabel }
}
