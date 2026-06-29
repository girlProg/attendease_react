import { Users, Building2, UserCheck, Banknote } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { AttendanceFilterBar } from "@/components/attendance-filter-bar"
import { useAttendanceFilters } from "@/hooks/use-attendance-filters"
import { useLogVisit } from "@/hooks/use-log-visit"
import { api } from "@/lib/api"

interface DashboardSummary {
  total_students: number
  total_stipends_paid: number
  qualified_students: number
  cash_transfers: number
}

const getDashboardSummary = (params: Record<string, string>) =>
  api.get<DashboardSummary>("/dashboard/summary/", { params }).then((response) => response.data)

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString()}`
}

export function DashboardPage() {
  useLogVisit("Dashboard", "Visited Dashboard")
  const { filters, setFilter, selectedIds, options } = useAttendanceFilters()

  const queryParams: Record<string, string> = {}
  if (selectedIds.cohort) queryParams.cohort = String(selectedIds.cohort)
  if (filters.year) queryParams.year = filters.year

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary", queryParams],
    queryFn: () => getDashboardSummary(queryParams),
  })

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
      color: "bg-[#F4845F]",
    },
    {
      label: "Qualified Students",
      value: (summary?.qualified_students ?? 0).toLocaleString(),
      icon: UserCheck,
      color: "bg-[#48BB78]",
    },
    {
      label: "No. Of Cash Transfers",
      value: (summary?.cash_transfers ?? 0).toLocaleString(),
      icon: Banknote,
      color: "bg-[#F4845F]",
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
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
