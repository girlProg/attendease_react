import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/types"

// The school calendar a term's attendance is judged against. Public holidays
// shorten a week for every school; a school closure takes the week out for
// that school. Both change who qualifies (the server applies them to every
// qualification figure); the registers themselves are never rewritten.

export interface TermHoliday {
  id: number
  year: number
  term: number
  week: number
  days: number
  name: string
}

export interface TermCalendar {
  year: number
  term: number
  weeks: number
  // False while the term uses the deployment's default length.
  weeks_set: boolean
  school_days_per_week: number
  max_weeks: number
  holidays: TermHoliday[]
  closed_school_weeks: number
  closed_schools: number
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

/** Set the term's length in weeks; `null` goes back to the default. */
export const setTermWeeks = (year: number, term: number, weeks: number | null) =>
  api
    .put<TermCalendar>("/term-calendar/", { year, term, weeks: weeks ?? "" })
    .then((response) => response.data)

export const addTermHoliday = (holiday: Omit<TermHoliday, "id">) =>
  api.post<TermHoliday>("/term-holidays/", holiday).then((response) => response.data)

export const removeTermHoliday = (id: number) => api.delete(`/term-holidays/${id}/`)

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
