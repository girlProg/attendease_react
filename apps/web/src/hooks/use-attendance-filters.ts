import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getCohorts, getLGAs, getSchools, getAttendanceYears } from "@/api/attendance"

const TERMS = ["1", "2", "3"]
const WEEKS = [
  "All Weeks",
  ...Array.from({ length: 15 }, (_, i) => `${i + 1}`),
]

export function useAttendanceFilters() {
  const [filters, setFilters] = useState<Record<string, string>>({})

  const { data: cohorts } = useQuery({ queryKey: ["cohort"], queryFn: getCohorts })
  const { data: attendanceYears } = useQuery({ queryKey: ["attendance-years"], queryFn: getAttendanceYears })
  const { data: lgaList } = useQuery({ queryKey: ["lga"], queryFn: getLGAs })
  const { data: schoolList } = useQuery({
    queryKey: ["school", filters.lga, filters.cohort],
    queryFn: () => getSchools(filters.lga, filters.cohort),
  })

  const cohortNames = cohorts?.map((cohort) => cohort.name) ?? []
  const years = attendanceYears ?? []
  const lgaNames = lgaList?.map((lga) => lga.name) ?? []
  const schoolNames = schoolList?.map((school) => school.name) ?? []

  const setFilter = (key: string, value: string) =>
    setFilters((previous) => {
      const next = { ...previous }
      if (value === "choose") {
        delete next[key]
      } else {
        next[key] = value
      }
      if (key === "lga") delete next.school
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

  const selectedCohortId = cohorts?.find((cohort) => cohort.name === filters.cohort)?.id
  const selectedSchoolId = schoolList?.find((school) => school.name === filters.school)?.id

  return {
    filters,
    setFilter,
    allFiltersSelected,
    selectedIds: {
      cohort: selectedCohortId,
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
