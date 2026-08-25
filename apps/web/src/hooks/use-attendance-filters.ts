import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getCohorts, getLGAs, getSchools, getAttendanceYears } from "@/api/attendance"

const TERMS = ["1", "2", "3"]
const WEEKS = [
  "All Weeks",
  ...Array.from({ length: 15 }, (_, i) => `${i + 1}`),
]

export function useAttendanceFilters() {
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    try {
      const saved = sessionStorage.getItem("attendance-filters")
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const { data: cohorts } = useQuery({ queryKey: ["cohort"], queryFn: getCohorts })
  const { data: attendanceYears } = useQuery({ queryKey: ["attendance-years"], queryFn: getAttendanceYears })
  const { data: lgaList } = useQuery({ queryKey: ["lga"], queryFn: getLGAs })
  const selectedCohortId = cohorts?.find((cohort) => cohort.name === filters.cohort)?.id
  const selectedLgaId = lgaList?.find((lga) => lga.name === filters.lga)?.id

  // Scope schools by ID, and only once the chosen LGA name has resolved to an
  // ID — otherwise the first render (before the LGA list lands) fetches every
  // school in the state.
  const { data: schoolList } = useQuery({
    queryKey: ["school", selectedLgaId, selectedCohortId],
    queryFn: () => getSchools(selectedLgaId, selectedCohortId),
    enabled: !filters.lga || selectedLgaId !== undefined,
  })

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
      if (value === "__clear__") {
        delete next[key]
      } else {
        next[key] = value
      }
      if (key === "lga") delete next.school
      sessionStorage.setItem("attendance-filters", JSON.stringify(next))
      return next
    })

  const allFiltersSelected = !!(
    filters.cohort &&
    filters.term &&
    filters.year &&
    filters.lga &&
    filters.school &&
    filters.week
  )

  const selectedSchoolId = schoolList?.find((school) => school.name === filters.school)?.id

  return {
    filters,
    setFilter,
    allFiltersSelected,
    selectedIds: {
      cohort: selectedCohortId,
      lga: selectedLgaId,
      school: selectedSchoolId,
    },
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
