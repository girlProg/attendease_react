import { Users, Building2, UserCheck, Banknote } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { AttendanceFilterBar } from "@/components/attendance-filter-bar"
import { BarChart } from "@/components/bar-chart"
import { QueryError } from "@/components/query-error"
import { StatValue } from "@/components/skeleton"
import { useAttendanceFilters } from "@/hooks/use-attendance-filters"
import { useLogVisit } from "@/hooks/use-log-visit"
import { api } from "@/lib/api"
import { formatNaira } from "@/lib/formatters"

interface DashboardSummary {
  total_students: number
  total_stipends_paid: number
  qualified_students: number
  cash_transfers: number
}

interface LgaSummary {
  lga_id: number
  lga: string
  total_students: number
  qualified_students: number
  qualified_students_percentage: number
  total_stipends_paid: number
  cash_transfers: number
}

const getDashboardSummary = (params: Record<string, string>) =>
  api.get<DashboardSummary>("/dashboard/summary/", { params }).then((response) => response.data)

const getLgaSummary = (params: Record<string, string>) =>
  api.get<LgaSummary[]>("/dashboard/lga-summary/", { params }).then((response) => response.data)

export function DashboardPage() {
  useLogVisit("Dashboard", "Visited Dashboard")
  const { filters, setFilter, selectedIds, options } = useAttendanceFilters()

  const queryParams: Record<string, string> = {}
  if (selectedIds.cohort) queryParams.cohort = String(selectedIds.cohort)
  if (filters.year) queryParams.year = filters.year

  const { data: summary, isError: isSummaryError, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["dashboard-summary", queryParams],
    queryFn: () => getDashboardSummary(queryParams),
  })

  const { data: lgaData, isLoading: isLgaLoading, isError: isLgaError } = useQuery({
    queryKey: ["dashboard-lga-summary", queryParams],
    queryFn: () => getLgaSummary(queryParams),
  })

  const lgaList = lgaData ?? []

  const stats = [
    {
      label: "Total Students",
      value: (summary?.total_students ?? 0).toLocaleString(),
      icon: Users,
      color: "bg-sidebar",
    },
    {
      label: "Total Stipends Paid",
      value: formatNaira(summary?.total_stipends_paid ?? 0),
      icon: Building2,
      color: "bg-[var(--stat-accent-1)]",
    },
    {
      label: "Qualified Students",
      value: (summary?.qualified_students ?? 0).toLocaleString(),
      icon: UserCheck,
      color: "bg-[var(--stat-accent-2)]",
    },
    {
      label: "No. Of Cash Transfers",
      value: (summary?.cash_transfers ?? 0).toLocaleString(),
      icon: Banknote,
      color: "bg-[var(--stat-accent-1)]",
    },
  ]

  return (
    <div className="space-y-6">
      <AttendanceFilterBar
        filters={filters}
        setFilter={setFilter}
        options={options}
        exclude={["term", "lga", "school", "week"]}
      />

      {(isSummaryError || isLgaError) && <QueryError />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 rounded-2xl border border-border/40 bg-white p-5"
          >
            <div className={`flex size-12 shrink-0 items-center justify-center rounded-full ${stat.color} text-white`}>
              <stat.icon className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold text-foreground">
                <StatValue loading={isSummaryLoading}>{stat.value}</StatValue>
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <BarChart
          title="Total Students per LGA"
          data={lgaList.map((item) => ({ label: item.lga, value: item.total_students }))}
          color="bg-sidebar"
          isLoading={isLgaLoading}
        />
        <BarChart
          title="Qualified Students per LGA"
          data={lgaList.map((item) => ({ label: item.lga, value: item.qualified_students }))}
          color="bg-[var(--stat-accent-2)]"
          isLoading={isLgaLoading}
        />
        <BarChart
          title="Qualified Students Percentage per LGA"
          data={lgaList.map((item) => ({ label: item.lga, value: item.qualified_students_percentage }))}
          color="bg-[var(--stat-accent-2)]"
          formatValue={(value) => `${value.toFixed(1)}%`}
          isLoading={isLgaLoading}
        />
        {/* <BarChart
          title="Total Stipends Paid per LGA"
          data={lgaList.map((item) => ({ label: item.lga, value: item.total_stipends_paid }))}
          color="bg-[var(--stat-accent-1)]"
          formatValue={formatNaira}
          isLoading={isLgaLoading}
        />
        <BarChart
          title="Cash Transfers per LGA"
          data={lgaList.map((item) => ({ label: item.lga, value: item.cash_transfers }))}
          color="bg-[var(--stat-accent-1)]"
          isLoading={isLgaLoading}
        /> */}
      </div>
    </div>
  )
}
