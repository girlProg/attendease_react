import { useState } from "react"
import { Upload, FileSpreadsheet } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { FilterSelect } from "@/components/filter-select"
import { PaginationBar } from "@/components/pagination-bar"

const cohorts = ["1st Cohort", "2nd Cohort", "3rd Cohort"]
const terms = ["Term", "1st Term", "2nd Term", "3rd Term"]
const years = ["Year", "2025/2026", "2024/2025"]
const lgas = ["Select LGA", "Agaie", "Bida", "Bosso", "Chanchaga", "Edati"]
const schools = ["Select School", "Govt. Sec. School Minna", "FGC Bida"]
const weeks = ["Week", ...Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`)]

type AttendanceEntry = {
  sn: number
  name: string
  id: string
  class: string
  days: Record<string, boolean>
  reason: string
  remark: string
}

const mockData: AttendanceEntry[] = [
  { sn: 1, name: "Abah Treasure", id: "1042", class: "JSS 1", days: { Mon: false, Tue: false, Wed: false, Thu: false }, reason: "", remark: "" },
  { sn: 2, name: "Abasiya Ibrahim", id: "1043", class: "JSS 1", days: { Mon: false, Tue: false, Wed: false, Thu: false }, reason: "", remark: "" },
  { sn: 3, name: "Abasiya Murtala", id: "1044", class: "JSS 1", days: { Mon: false, Tue: false, Wed: false, Thu: false }, reason: "", remark: "" },
  { sn: 4, name: "Abdullahi Fatima", id: "1045", class: "JSS 1", days: { Mon: false, Tue: false, Wed: false, Thu: false }, reason: "", remark: "" },
  { sn: 5, name: "Adamu Hauwa", id: "1046", class: "JSS 1", days: { Mon: false, Tue: false, Wed: false, Thu: false }, reason: "", remark: "" },
]

const dayColumns = ["Mon", "Tue", "Wed", "Thu"]

export function NewAttendancePage() {
  const [entries, setEntries] = useState(mockData)

  function toggleDay(sn: number, day: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.sn === sn ? { ...e, days: { ...e.days, [day]: !e.days[day] } } : e
      )
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <FilterSelect placeholder="1st Cohort" items={cohorts} />
        <FilterSelect placeholder="Term" items={terms} />
        <FilterSelect placeholder="Year" items={years} />
        <FilterSelect placeholder="Select LGA" items={lgas} />
        <FilterSelect placeholder="Select School" items={schools} />
        <FilterSelect placeholder="Week" items={weeks} />
      </div>

      {/* Action buttons */}
      <div className="flex flex-col justify-end gap-3 sm:flex-row">
        <Button className="h-11 gap-2 rounded-full bg-brand px-6 text-white hover:bg-brand/90">
          <Upload className="size-4" />
          Upload CSV Data
        </Button>
        <Button className="h-11 gap-2 rounded-full bg-emerald-500 px-6 text-white hover:bg-emerald-600">
          <FileSpreadsheet className="size-4" />
          Download Excel Template
        </Button>
      </div>

      <PaginationBar
        totalPages={4}
        rowOptions={["100", "500", "1000", "2000"]}
        defaultRows="2000"
      />

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-16 text-center text-xs font-semibold text-sidebar">S/N</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Name</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">ID</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Class</TableHead>
              {dayColumns.map((day) => (
                <TableHead key={day} className="text-center text-xs font-semibold text-sidebar">{day}</TableHead>
              ))}
              <TableHead className="text-center text-xs font-semibold text-sidebar">Reason</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Remark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((row) => (
              <TableRow key={row.sn} className="border-border/40">
                <TableCell className="text-center text-sm text-muted-foreground">{row.sn}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="size-8 shrink-0 rounded-md bg-muted" />
                    <span className="text-sm font-semibold text-foreground">{row.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.id}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.class}</TableCell>
                {dayColumns.map((day) => (
                  <TableCell key={day} className="text-center">
                    <button
                      type="button"
                      onClick={() => toggleDay(row.sn, day)}
                      className={`inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                        row.days[day] ? "bg-sidebar" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`pointer-events-none block size-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                          row.days[day] ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </TableCell>
                ))}
                <TableCell>
                  <Input
                    placeholder="Enter Reason"
                    className="h-9 rounded-lg border-border/60 bg-white text-sm"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Enter Remark"
                    className="h-9 rounded-lg border-border/60 bg-white text-sm"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
