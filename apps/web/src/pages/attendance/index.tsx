import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Search, Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { FilterSelect } from "@/components/filter-select"
import { getCohorts, getLGAs, getSchools } from "@/api/attendance"

import { RealTime } from "./real-time"
import { Statistics } from "./statistics"

const terms = ["1", "2", "3"]
const weeks = [
  "All Weeks",
  ...Array.from({ length: 15 }, (_, i) => `${i + 1}`),
]

const tabs = ["Historical", "Real-Time", "Statistics"] as const

export function AttendancePage() {
  const [activeTab, setActiveTab] = useState<string>("Real-Time")
  const [search, setSearch] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [filters, setFilters] = useState<Record<string, string>>({})
  const navigate = useNavigate()

  const { data: cohorts } = useQuery({ queryKey: ["cohort"], queryFn: getCohorts })
  const { data: lgaList } = useQuery({ queryKey: ["lga"], queryFn: getLGAs })
  const { data: schoolList } = useQuery({ queryKey: ["school"], queryFn: getSchools })

  const cohortNames = cohorts?.map((c) => c.name) ?? []
  const cohortYears = [...new Set(cohorts?.map((c) => c.year) ?? [])]
  const lgaNames = lgaList?.map((l) => l.name) ?? []
  const schoolNames = schoolList?.map((s) => s.name) ?? []

  const setFilter = (key: string, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="space-y-6">
      {/* Filters */}
      {activeTab === "Statistics" ? (
        <div className="grid grid-cols-2 gap-3">
          <FilterSelect placeholder="Cohort" items={cohortNames} value={filters.cohort} onValueChange={(v) => setFilter("cohort", v)} />
          <FilterSelect placeholder="LGA" items={lgaNames} value={filters.lga} onValueChange={(v) => setFilter("lga", v)} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <FilterSelect placeholder="Cohort" items={cohortNames} value={filters.cohort} onValueChange={(v) => setFilter("cohort", v)} />
            <FilterSelect placeholder="Term" items={terms} value={filters.term} onValueChange={(v) => setFilter("term", v)} />
            <FilterSelect placeholder="Year" items={cohortYears} value={filters.year} onValueChange={(v) => setFilter("year", v)} />
            <FilterSelect placeholder="LGA" items={lgaNames} value={filters.lga} onValueChange={(v) => setFilter("lga", v)} />
            <FilterSelect placeholder="School" items={schoolNames} value={filters.school} onValueChange={(v) => setFilter("school", v)} />
            <FilterSelect placeholder="All Weeks" items={weeks} value={filters.week} onValueChange={(v) => setFilter("week", v)} />
          </div>

          {/* Search + New Attendance */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex flex-1 items-center">
              <Search className="absolute left-3 size-4 text-muted-foreground" />
              <Input
                placeholder="Find Student by Name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setAppliedSearch(search)}
                className="h-11 rounded-full border-sidebar/30 bg-white pl-9 pr-24 shadow-sm focus-visible:border-sidebar/30 focus-visible:ring-0"
              />
              <Button
                className="absolute right-1.5 h-8 rounded-full bg-sidebar px-5 text-white hover:bg-sidebar/90"
                onClick={() => setAppliedSearch(search)}
              >
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
      {activeTab === "Real-Time" && <RealTime search={appliedSearch} filters={filters} />}
      {activeTab === "Historical" && <div className="py-12 text-center text-muted-foreground">Historical view coming soon</div>}
      {activeTab === "Statistics" && <Statistics />}
    </div>
  )
}
