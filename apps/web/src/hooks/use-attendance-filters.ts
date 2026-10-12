import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getCohorts, getLGAs, getSchools, getAttendanceYears } from "@/api/attendance"

const TERMS = ["1", "2", "3"]
const WEEKS = [
  "All Weeks",
  ...Array.from({ length: 15 }, (_, i) => `${i + 1}`),
]

export type FilterKey = "cohort" | "term" | "year" | "lga" | "school" | "week"

/** Every filter the bar can show, in the order it shows them. */
export const ALL_FILTERS: readonly FilterKey[] = ["cohort", "term", "year", "lga", "school", "week"]

/**
 * The filters a page applies, as the API takes them: cohort, LGA and school by
 * ID (names collide — "Kaura" is inside "Kaura Namoda"), the rest verbatim.
 * Every endpoint behind the filter bar accepts exactly these names.
 */
export interface FilterScope {
  cohort?: number
  lga?: number
  school?: number
  year?: string
  term?: string
  week?: string
}

/**
 * The attendance filter bar's state, shared by every page that shows it.
 *
 * THE RULE: a filter applies on a page if and only if that page's bar shows it.
 * A page declares its filters once (`keys`), renders the bar from them, and
 * builds every request from `scope(keys).params` — never from `filters`
 * directly — and waits for `scope(keys).ready` before fetching. Then:
 *
 * - a visible filter always applies, by ID;
 * - a hidden one (saved from another page) never does;
 * - nothing is fetched while a chosen name is still resolving to its ID, so the
 *   first response is never an unfiltered one that a filtered one replaces;
 * - a saved choice that no longer exists (renamed, or outside a new scope) is
 *   cleared from the bar rather than silently ignored.
 */
export function useAttendanceFilters() {
  const [savedFilters, setFilters] = useState<Record<string, string>>(() => {
    try {
      const raw = sessionStorage.getItem("attendance-filters")
      const saved: Record<string, string> = raw ? JSON.parse(raw) : {}
      // A school is chosen within an LGA. One saved without its LGA is
      // invisible (the school box is disabled until an LGA is picked) yet would
      // still filter every page to that one school — drop it.
      if (!saved.lga) delete saved.school
      return saved
    } catch {
      return {}
    }
  })

  const { data: cohorts } = useQuery({ queryKey: ["cohort"], queryFn: getCohorts })
  const { data: attendanceYears } = useQuery({ queryKey: ["attendance-years"], queryFn: getAttendanceYears })
  const { data: lgaList } = useQuery({ queryKey: ["lga"], queryFn: getLGAs })
  const cohortId = cohorts?.find((cohort) => cohort.name === savedFilters.cohort)?.id
  const lgaId = lgaList?.find((lga) => lga.name === savedFilters.lga)?.id

  // Schools for the chosen LGA (and cohort). Only fetched once a chosen LGA has
  // resolved, so the first render never lists every school in the state.
  const schoolQuery = useQuery({
    queryKey: ["school", lgaId, cohortId],
    queryFn: () => getSchools(lgaId, cohortId),
    enabled: Boolean(savedFilters.lga) && lgaId !== undefined,
  })
  const schoolList = schoolQuery.data
  const schoolId = schoolList?.find((school) => school.name === savedFilters.school)?.id

  // A saved name that its loaded list doesn't contain (renamed, or not in the
  // newly chosen cohort) can never resolve. Treat it as cleared — the bar shows
  // the placeholder and nothing applies — and drop it on the next change,
  // rather than leaving `ready` false forever or ignoring it silently.
  const stale = new Set<string>()
  if (savedFilters.cohort && cohorts !== undefined && cohortId === undefined) stale.add("cohort")
  if (savedFilters.lga && lgaList !== undefined && lgaId === undefined) {
    stale.add("lga")
    stale.add("school")
  }
  if (savedFilters.school && schoolQuery.isSuccess && schoolId === undefined) stale.add("school")
  // Same object until its contents change: pages use `filters` as an effect
  // dependency (New Attendance resets its edits on change), so a fresh object
  // every render would loop forever.
  const staleKey = [...stale].sort().join(",")
  const filters = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        Object.entries(savedFilters).filter(([key]) => !staleKey.split(",").includes(key)),
      ),
    [savedFilters, staleKey],
  )

  const cohortNames = cohorts?.map((cohort) => cohort.name) ?? []
  const years = attendanceYears ?? []
  const lgaNames = lgaList?.map((lga) => lga.name) ?? []
  // One School row exists per cohort, so the same name legitimately repeats.
  // Collapse them for the dropdown — three identical "Kajuru Primary" entries
  // are unusable; picking a cohort is what disambiguates the underlying row.
  const schoolNames = [...new Set(schoolList?.map((school) => school.name) ?? [])]

  const setFilter = (key: string, value: string) =>
    setFilters((previous) => {
      const next = { ...previous }
      for (const staleKey of stale) delete next[staleKey]
      if (value === "__clear__") {
        delete next[key]
      } else {
        next[key] = value
      }
      if (key === "lga") delete next.school
      sessionStorage.setItem("attendance-filters", JSON.stringify(next))
      return next
    })

  /**
   * The request parameters for a page that shows `keys`, and whether they are
   * settled. Only shown filters are included; a chosen cohort, LGA or school
   * that hasn't resolved to its ID yet makes `ready` false.
   */
  const scope = (keys: readonly FilterKey[]): { params: FilterScope; ready: boolean } => {
    const shown = new Set(keys)
    const params: FilterScope = {}
    let ready = true
    const resolve = (key: "cohort" | "lga" | "school", id: number | undefined) => {
      if (!shown.has(key) || !filters[key]) return
      if (id === undefined) ready = false
      else params[key] = id
    }
    resolve("cohort", cohortId)
    resolve("lga", lgaId)
    // A school only counts inside its LGA (see the saved-state cleanup above).
    if (filters.lga) resolve("school", schoolId)
    if (shown.has("year") && filters.year) params.year = filters.year
    if (shown.has("term") && filters.term) params.term = filters.term
    if (shown.has("week") && filters.week && filters.week !== "All Weeks") {
      params.week = filters.week
    }
    return { params, ready }
  }

  return {
    filters,
    setFilter,
    scope,
    options: {
      cohorts: cohortNames,
      years,
      lgas: lgaNames,
      schools: schoolNames,
      terms: TERMS,
      weeks: WEEKS,
    },
  }
}
