import { FilterSelect } from "@/components/filter-select"
import type { useAttendanceFilters } from "@/hooks/use-attendance-filters"

type FilterBarProps = Pick<ReturnType<typeof useAttendanceFilters>, "filters" | "setFilter" | "options"> & {
  exclude?: string[]
}

export function formatAcademicYear(value: string) {
  const year = parseInt(value, 10)
  return `${year}/${year + 1}`
}

function ordinal(value: string) {
  const num = parseInt(value, 10)
  if (num === 1) return "1st"
  if (num === 2) return "2nd"
  if (num === 3) return "3rd"
  return `${num}th`
}

const allFilters = [
  { key: "cohort", placeholder: "Cohort", format: (value: string) => `${ordinal(value)} Cohort` },
  { key: "term", placeholder: "Term", format: (value: string) => `${ordinal(value)} Term` },
  { key: "year", placeholder: "Year", format: formatAcademicYear },
  { key: "lga", placeholder: "LGA" },
  { key: "school", placeholder: "School", disabledKey: "lga" },
  { key: "week", placeholder: "Week" },
] as const

const optionsMap: Record<string, keyof FilterBarProps["options"]> = {
  cohort: "cohorts",
  term: "terms",
  year: "years",
  lga: "lgas",
  school: "schools",
  week: "weeks",
}

export function AttendanceFilterBar({ filters, setFilter, options, exclude = [] }: FilterBarProps) {
  const visible = allFilters.filter((filter) => !exclude.includes(filter.key))
  const cols = visible.length <= 2 ? "grid-cols-2" : visible.length <= 4 ? "grid-cols-2 md:grid-cols-4" : visible.length <= 5 ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-6"

  return (
    <div className={`grid gap-3 ${cols}`}>
      {visible.map((filter) => (
        <FilterSelect
          key={filter.key}
          placeholder={filter.placeholder}
          items={options[optionsMap[filter.key]] ?? []}
          value={filters[filter.key] ?? undefined}
          onValueChange={(value) => { if (value !== null) setFilter(filter.key, value) }}
          disabled={"disabledKey" in filter ? !filters[filter.disabledKey] : false}
          formatItem={"format" in filter && filter.format ? filter.format : undefined}
        />
      ))}
    </div>
  )
}
