import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { FilterSelect } from "@/components/filter-select"

import { RealTime } from "./real-time"
import { Statistics } from "./statistics"

const cohorts = ["2nd Cohort", "3rd Cohort"]
const terms = ["1st Term", "2nd Term", "3rd Term"]
const years = ["2025/2026", "2024/2025"]
const lgas = ["LGA", "Agaie", "Bida", "Bosso", "Chanchaga", "Edati"]
const schools = ["School", "Govt. Sec. School Minna", "FGC Bida"]
const weeks = [
  "All Weeks",
  ...Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`),
]

const tabs = ["Historical", "Real-Time", "Statistics"] as const

export function AttendancePage() {
  const [activeTab, setActiveTab] = useState<string>("Real-Time")
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      {/* Filters */}
      {activeTab === "Statistics" ? (
        <div className="grid grid-cols-2 gap-3">
          <FilterSelect placeholder="1st Cohort" items={cohorts} />
          <FilterSelect placeholder="LGA" items={lgas} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <FilterSelect placeholder="2nd Cohort" items={cohorts} />
            <FilterSelect placeholder="1st Term" items={terms} />
            <FilterSelect placeholder="2025/2026" items={years} />
            <FilterSelect placeholder="LGA" items={lgas} />
            <FilterSelect placeholder="School" items={schools} />
            <FilterSelect placeholder="All Weeks" items={weeks} />
          </div>

          {/* Search + New Attendance */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex flex-1 items-center">
              <Search className="absolute left-3 size-4 text-muted-foreground" />
              <Input
                placeholder="Find Student by Name"
                className="h-11 rounded-full border-sidebar/30 bg-white pl-9 pr-24 shadow-sm focus-visible:border-sidebar/30 focus-visible:ring-0"
              />
              <Button className="absolute right-1.5 h-8 rounded-full bg-sidebar px-5 text-white hover:bg-sidebar/90">
                Search
              </Button>
            </div>
            <Button
              variant="outline"
              className="h-11 gap-2 rounded-full border-sidebar px-5 text-sidebar hover:bg-sidebar/5"
              onClick={() => navigate("/attendance/new")}
            >
              <Plus className="size-4" />
              New Attendance
            </Button>
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
      {activeTab === "Real-Time" && <RealTime />}
      {activeTab === "Historical" && <div className="py-12 text-center text-muted-foreground">Historical view coming soon</div>}
      {activeTab === "Statistics" && <Statistics />}
    </div>
  )
}
