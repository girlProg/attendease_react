import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { AttendanceFilterBar } from "@/components/attendance-filter-bar"
import { SearchBar } from "@/components/search-bar"
import { useAuth } from "@/contexts/auth-context"
import { useAttendanceFilters } from "@/hooks/use-attendance-filters"
import { useLogVisit } from "@/hooks/use-log-visit"

import { Overview } from "./overview"
import { RealTime } from "./real-time"
import { Statistics } from "./statistics"

const tabs = ["Overview", "Historical", "Real-Time", "Statistics"] as const

export function AttendancePage() {
  const [activeTab, setActiveTab] = useState<string>("Overview")
  const [appliedSearch, setAppliedSearch] = useState("")
  const navigate = useNavigate()

  useLogVisit("Attendance", "Visited Attendance")
  const { canWrite } = useAuth()
  const { filters, setFilter, options, selectedIds } = useAttendanceFilters()

  // Filter attendance by the exact school ID, not its (icontains) name.
  const realTimeFilters = {
    ...filters,
    ...(selectedIds.school ? { schoolId: String(selectedIds.school) } : {}),
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      {activeTab === "Statistics" ? (
        <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} exclude={["term", "year", "school", "week"]} />
      ) : activeTab === "Overview" ? (
        <>
          <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} exclude={["week"]} />
          {canWrite && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
                onClick={() => navigate("/attendance/new")}
              >
                <Plus className="size-4" />
                New Attendance
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} />

          {/* Search + New Attendance */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <SearchBar onSearch={setAppliedSearch} />
            {canWrite && (
              <Button
                variant="outline"
                className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
                onClick={() => navigate("/attendance/new")}
              >
                <Plus className="size-4" />
                New Attendance
              </Button>
            )}
          </div>
        </>
      )}

      {/* Tabs */}
      <div className="flex justify-center pt-2">
        <div className="inline-flex items-center rounded-full border border-brand/40 bg-white p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={
                activeTab === tab
                  ? "rounded-full bg-brand px-6 py-2 text-sm font-semibold text-white transition-colors"
                  : "rounded-full px-6 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "Overview" && <Overview filters={filters} selectedIds={selectedIds} />}
      {activeTab === "Real-Time" && <RealTime search={appliedSearch} filters={realTimeFilters} />}
      {activeTab === "Historical" && <div className="py-12 text-center text-muted-foreground">Historical view coming soon</div>}
      {activeTab === "Statistics" && <Statistics filters={filters} />}
    </div>
  )
}
