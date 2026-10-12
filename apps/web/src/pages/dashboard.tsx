import { Users, Building2, UserCheck, Banknote } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { AttendanceFilterBar } from "@/components/attendance-filter-bar"
import { BarChart } from "@/components/bar-chart"
import { QueryError } from "@/components/query-error"
import { StatCard } from "@/components/stat-card"
import { useAttendanceFilters, type FilterKey } from "@/hooks/use-attendance-filters"
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

const DASHBOARD_FILTERS: readonly FilterKey[] = ["cohort", "year"]

export function DashboardPage() {
  useLogVisit("Dashboard", "Visited Dashboard")
  const { filters, setFilter, scope, options } = useAttendanceFilters()
  const { params: scopeParams, ready: scopeReady } = scope(DASHBOARD_FILTERS)

  const queryParams: Record<string, string> = {}
  if (scopeParams.cohort) queryParams.cohort = String(scopeParams.cohort)
  if (scopeParams.year) queryParams.year = scopeParams.year

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", queryParams],
    queryFn: () => getDashboardSummary(queryParams),
    enabled: scopeReady,
  })
  const { data: summary, isError: isSummaryError } = summaryQuery
  const isSummaryLoading = summaryQuery.isLoading || !scopeReady

  const lgaQuery = useQuery({
    queryKey: ["dashboard-lga-summary", queryParams],
    queryFn: () => getLgaSummary(queryParams),
    enabled: scopeReady,
  })
  const { data: lgaData, isError: isLgaError } = lgaQuery
  const isLgaLoading = lgaQuery.isLoading || !scopeReady

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
        keys={DASHBOARD_FILTERS}
      />

      {(isSummaryError || isLgaError) && <QueryError />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} loading={isSummaryLoading} />
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
