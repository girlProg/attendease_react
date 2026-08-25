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
import { Registers } from "./registers"
import { Statistics } from "./statistics"
import { UploadHistory } from "./upload-history"

const tabs = [
  "Overview",
  "Upload History",
  "Registers",
  "Real-Time",
  "Statistics",
] as const

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
            <div className="flex justify-stretch sm:justify-end">
              <Button
                variant="outline"
                className="h-11 w-full gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5 sm:w-auto"
                onClick={() => navigate("/attendance/new")}
              >
                <Plus className="size-4" />
                New Attendance
              </Button>
            </div>
          )}
        </>
      ) : activeTab === "Upload History" ? (
        <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} />
      ) : activeTab === "Registers" ? (
        <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} exclude={["week"]} />
      ) : (
        <>
          <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} />

          {/* Search + New Attendance */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <SearchBar onSearch={setAppliedSearch} />
            {canWrite && (
              <Button
                variant="outline"
                className="h-11 w-full shrink-0 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5 sm:w-auto"
                onClick={() => navigate("/attendance/new")}
              >
                <Plus className="size-4" />
                New Attendance
              </Button>
            )}
          </div>
        </>
      )}

      {/* Tabs — five of these overflow a phone screen, so on small viewports the
          strip scrolls sideways (bleeding to the screen edge to hint at it)
          instead of pushing the whole page wide. */}
      <div className="-mx-4 flex justify-start overflow-x-auto px-4 pt-2 [scrollbar-width:none] sm:mx-0 sm:justify-center sm:px-0 [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex shrink-0 items-center rounded-full border border-brand/40 bg-white p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={
                activeTab === tab
                  ? "whitespace-nowrap rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors sm:px-6"
                  : "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-6"
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
      {activeTab === "Upload History" && <UploadHistory filters={filters} selectedIds={selectedIds} />}
      {activeTab === "Registers" && <Registers filters={filters} selectedIds={selectedIds} />}
      {activeTab === "Statistics" && <Statistics filters={filters} />}
    </div>
  )
}
