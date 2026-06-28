import { useState, useRef } from "react"
import { Upload, FileSpreadsheet } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
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
import { PrimaryButton } from "@/components/primary-button"
import { getCohorts, getLGAs, getSchools } from "@/api/attendance"

const terms = ["1st Term", "2nd Term", "3rd Term"]
const weeks = Array.from({ length: 15 }, (_, i) => `Week ${i + 1}`)

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
  const [filters, setFilters] = useState<Record<string, string>>({})

  const { data: cohorts } = useQuery({ queryKey: ["cohort"], queryFn: getCohorts })
  const { data: lgaList } = useQuery({ queryKey: ["lga"], queryFn: getLGAs })
  const { data: schoolList } = useQuery({ queryKey: ["school"], queryFn: getSchools })

  const cohortNames = cohorts?.map((c) => c.name) ?? []
  const cohortYears = [...new Set(cohorts?.map((c) => c.year) ?? [])]
  const lgaNames = lgaList?.map((l) => l.name) ?? []
  const schoolNames = schoolList?.map((s) => s.name) ?? []

  const setFilter = (key: string, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const allFiltersSelected = !!(filters.cohort && filters.term && filters.year && filters.lga && filters.school && filters.week)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        <FilterSelect placeholder="Cohort" items={cohortNames} value={filters.cohort} onValueChange={(value) => setFilter("cohort", value)} />
        <FilterSelect placeholder="Term" items={terms} value={filters.term} onValueChange={(value) => setFilter("term", value)} />
        <FilterSelect placeholder="Year" items={cohortYears} value={filters.year} onValueChange={(value) => setFilter("year", value)} />
        <FilterSelect placeholder="Select LGA" items={lgaNames} value={filters.lga} onValueChange={(value) => setFilter("lga", value)} />
        <FilterSelect placeholder="Select School" items={schoolNames} value={filters.school} onValueChange={(value) => setFilter("school", value)} />
        <FilterSelect placeholder="Week" items={weeks} value={filters.week} onValueChange={(value) => setFilter("week", value)} />
      </div>

      {/* Action buttons */}
      <div className="flex flex-col justify-end gap-3 sm:flex-row">
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-white hover:bg-brand/90"
          >
            <Upload className="size-4" />
            Upload CSV Data
          </DialogTrigger>
          <DialogPopup>
            <DialogTitle>Upload CSV File</DialogTitle>
            <DialogDescription>
              Select a CSV file to upload attendance data.
            </DialogDescription>
            <div className="mt-6 space-y-4">
              <div
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sidebar/30 p-8 transition-colors hover:border-sidebar/60"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-8 text-sidebar/50" />
                <p className="text-sm font-medium text-foreground">
                  {csvFile ? csvFile.name : "Click to select a CSV file"}
                </p>
                {csvFile && (
                  <p className="text-xs text-muted-foreground">
                    {(csvFile.size / 1024).toFixed(1)} KB
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) setCsvFile(file)
                  }}
                />
              </div>
              <div className="flex justify-end gap-3">
                <DialogClose
                  className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50"
                >
                  Cancel
                </DialogClose>
                <PrimaryButton
                  className="h-10 w-auto px-6"
                  disabled={!csvFile}
                  onClick={() => {
                    // TODO: handle CSV upload
                    setUploadOpen(false)
                    setCsvFile(null)
                  }}
                >
                  Upload
                </PrimaryButton>
              </div>
            </div>
          </DialogPopup>
        </Dialog>
        <Button
          className="h-11 gap-2 rounded-full bg-emerald-500 px-6 text-white hover:bg-emerald-600 disabled:opacity-50"
          disabled={!allFiltersSelected}
        >
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

      <div className="flex justify-center gap-3 pt-4">
        <PrimaryButton
          className="w-auto bg-destructive px-8 hover:bg-destructive/90"
          onClick={() => window.history.back()}
        >
          Cancel
        </PrimaryButton>
        <PrimaryButton className="w-auto px-8">
          Save Attendance
        </PrimaryButton>
      </div>
    </div>
  )
}
