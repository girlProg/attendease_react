import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/types"

// The school calendar a term's attendance is judged against. School weeks are
// calendar weeks from the term's start date. Public holidays (dates, ranges,
// or every year) take their school days out of a week for every school; a
// school closure takes the week out for that school. Both change who
// qualifies (the server applies them to every qualification figure); the
// registers themselves are never rewritten.

/** A day or range schools were shut state-wide; optionally every year. */
export interface PublicHoliday {
  id: number
  name: string
  start_date: string
  end_date: string
  recurring: boolean
}

/** One school week of a dated term. */
export interface WeekDates {
  week: number
  starts: string
  ends: string
  // School days lost to holidays (or before the term began), and why.
  days_off: number
  reasons: string[]
}

export interface TermCalendar {
  year: number
  term: number
  weeks: number
  // False while the term uses the deployment's default length.
  weeks_set: boolean
  // First school day; week 1 is the calendar week containing it.
  start_date: string | null
  school_days_per_week: number
  max_weeks: number
  // Empty until the term has a start date.
  week_dates: WeekDates[]
  closed_school_weeks: number
  closed_schools: number
}

/** A term's start and length, for labelling weeks with dates anywhere. */
export interface TermDates {
  year: number
  term: number
  weeks: number | null
  start_date: string | null
}

export type ClosureReason = "insecurity" | "disaster" | "strike" | "other"

export const CLOSURE_REASONS: { value: ClosureReason; label: string }[] = [
  { value: "insecurity", label: "Insecurity" },
  { value: "disaster", label: "Flood or other disaster" },
  { value: "strike", label: "Strike" },
  { value: "other", label: "Other" },
]

export interface SchoolClosure {
  id: number
  school: number
  school_name: string
  lga: string
  year: number
  term: number
  week: number
  reason: ClosureReason
  reason_label: string
  note: string
  created_by: string | null
  created_at: string
}

/** Which school-weeks a bulk closure (or reopening) covers. */
export interface ClosureSelection {
  year: number
  term: number
  // Specific school rows, or every school in `lga`.
  schools?: number[]
  lga?: number
  // Specific weeks, or the whole term.
  weeks?: number[]
  whole_term?: boolean
}

export const getTermCalendar = (year: number, term: number) =>
  api
    .get<TermCalendar>("/term-calendar/", { params: { year, term } })
    .then((response) => response.data)

/** Set the term's start date and/or length; `null` clears either. */
export const setTermCalendar = (
  year: number,
  term: number,
  changes: { weeks?: number | null; start_date?: string | null },
) =>
  api
    .put<TermCalendar>("/term-calendar/", {
      year,
      term,
      ...("weeks" in changes ? { weeks: changes.weeks ?? "" } : {}),
      ...("start_date" in changes ? { start_date: changes.start_date ?? "" } : {}),
    })
    .then((response) => response.data)

export const getTermDates = () =>
  api.get<TermDates[]>("/term-calendars/").then((response) => response.data)

export const getPublicHolidays = () =>
  api.get<PublicHoliday[]>("/public-holidays/").then((response) => response.data)

export const addPublicHoliday = (holiday: Omit<PublicHoliday, "id" | "end_date"> & { end_date?: string }) =>
  api.post<PublicHoliday>("/public-holidays/", holiday).then((response) => response.data)

export const removePublicHoliday = (id: number) => api.delete(`/public-holidays/${id}/`)

export const getSchoolClosures = (
  page: number,
  pageSize: number,
  filters: { year: number; term: number; lga?: number; school?: number },
) =>
  api
    .get<PaginatedResponse<SchoolClosure>>("/school-closures/", {
      params: {
        page,
        page_size: pageSize,
        year: filters.year,
        term: filters.term,
        ...(filters.lga ? { school__lga: filters.lga } : {}),
        ...(filters.school ? { school: filters.school } : {}),
      },
    })
    .then((response) => response.data)

export const getClosuresByWeek = (year: number, term: number) =>
  api
    .get<{ week: number; schools: number }[]>("/school-closures/by-week/", {
      params: { year, term },
    })
    .then((response) => response.data)

export const closeSchools = (
  selection: ClosureSelection & { reason: ClosureReason; note?: string },
) =>
  api
    .post<{ created: number; already_closed: number; schools: number; weeks: number[] }>(
      "/school-closures/bulk/",
      selection,
    )
    .then((response) => response.data)

export const reopenSchools = (selection: ClosureSelection) =>
  api
    .post<{ deleted: number }>("/school-closures/bulk-delete/", selection)
    .then((response) => response.data)
