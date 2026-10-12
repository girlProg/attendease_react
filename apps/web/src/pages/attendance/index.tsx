import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { AttendanceFilterBar } from "@/components/attendance-filter-bar"
import { SearchBar } from "@/components/search-bar"
import { useAuth } from "@/contexts/auth-context"
import { useAttendanceFilters, type FilterKey } from "@/hooks/use-attendance-filters"
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

// Which filters each tab shows — and therefore applies. Kept as data so the
// bar is rendered once, in one place (the tabs must sit immediately after it
// in every tab, or the strip jumps vertically as you switch between them), and
// so a tab's requests are built from exactly the filters it shows.
const TAB_FILTERS: Record<(typeof tabs)[number], readonly FilterKey[]> = {
  Overview: ["cohort", "term", "year", "lga", "school"],
  "Upload History": ["cohort", "term", "year", "lga", "school", "week"],
  Registers: ["cohort", "term", "year", "lga", "school"],
  "Real-Time": ["cohort", "term", "year", "lga", "school", "week"],
  Statistics: ["cohort", "lga"],
}

export function AttendancePage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview")
  const [appliedSearch, setAppliedSearch] = useState("")
  const navigate = useNavigate()

  useLogVisit("Attendance", "Visited Attendance")
  const { canWrite } = useAuth()
  const { filters, setFilter, options, scope } = useAttendanceFilters()
  const tabFilters = TAB_FILTERS[activeTab]
  const { params: scopeParams, ready: scopeReady } = scope(tabFilters)

  const newAttendanceButton = canWrite && (
    <Button
      variant="outline"
      className="h-11 w-full shrink-0 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5 sm:w-auto"
      onClick={() => navigate("/attendance/new")}
    >
      <Plus className="size-4" />
      New Attendance
    </Button>
  )

  return (
    <div className="space-y-6">
      {/* Filters — always first, and always the only thing above the tabs. */}
      <AttendanceFilterBar
        filters={filters}
        setFilter={setFilter}
        options={options}
        keys={tabFilters}
      />

      {/* Tabs — directly after the filters in every tab so the strip never
          shifts position. Five of them overflow a phone screen, so on small
          viewports it scrolls sideways (bleeding to the screen edge to hint at
          it) instead of pushing the whole page wide. */}
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

      {/* Per-tab actions now live BELOW the tabs, so they can't push the strip
          around. */}
      {activeTab === "Overview" && canWrite && (
        <div className="flex justify-stretch sm:justify-end">{newAttendanceButton}</div>
      )}
      {activeTab === "Real-Time" && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchBar onSearch={setAppliedSearch} />
          {newAttendanceButton}
        </div>
      )}

      {/* Tab content */}
      {activeTab === "Overview" && <Overview scope={scopeParams} ready={scopeReady} />}
      {activeTab === "Real-Time" && (
        <RealTime
          search={appliedSearch}
          scope={scopeParams}
          ready={scopeReady}
          schoolName={filters.school}
        />
      )}
      {activeTab === "Upload History" && <UploadHistory scope={scopeParams} ready={scopeReady} />}
      {activeTab === "Registers" && (
        <Registers scope={scopeParams} ready={scopeReady} schoolName={filters.school} />
      )}
      {activeTab === "Statistics" && (
        <Statistics scope={scopeParams} ready={scopeReady} cohortName={filters.cohort} />
      )}
    </div>
  )
}
