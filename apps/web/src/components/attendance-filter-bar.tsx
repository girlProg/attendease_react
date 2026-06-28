import { FilterSelect } from "@/components/filter-select"
import type { useAttendanceFilters } from "@/hooks/use-attendance-filters"

type AttendanceFilters = ReturnType<typeof useAttendanceFilters>

export function AttendanceFilterBar({
  filters,
  setFilter,
  options,
}: Pick<AttendanceFilters, "filters" | "setFilter" | "options">) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
      <FilterSelect placeholder="Cohort" items={options.cohorts} value={`${filters.cohort} Cohort`} onValueChange={(value) => setFilter("cohort", value)} />
      <FilterSelect placeholder="Term" items={options.terms} value={`${filters.term} Term`} onValueChange={(value) => setFilter("term", value)} />
      <FilterSelect placeholder="Year" items={options.years} value={filters.year} onValueChange={(value) => setFilter("year", value)} />
      <FilterSelect placeholder="LGA" items={options.lgas} value={filters.lga} onValueChange={(value) => setFilter("lga", value)} />
      <FilterSelect placeholder="School" items={options.schools} value={filters.school} onValueChange={(value) => setFilter("school", value)} />
      <FilterSelect placeholder="Week" items={options.weeks} value={filters.week} onValueChange={(value) => setFilter("week", value)} />
    </div>
  )
}
