import { useState } from "react"
import { Download, Phone } from "lucide-react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"

import { useLogVisit } from "@/hooks/use-log-visit"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { FilterSelect } from "@/components/filter-select"
import { SearchBar } from "@/components/search-bar"
import { QueryError } from "@/components/query-error"
import { StudentPhoto } from "@/components/student-photo"
import { TableEmptyState } from "@/components/table-empty-state"
import { PaginationBar } from "@/components/pagination-bar"
import { useAttendanceFilters } from "@/hooks/use-attendance-filters"
import { usePagination } from "@/hooks/use-pagination"
import { getStudents, exportStudents } from "@/api/attendance"

export function BeneficiariesPage() {
  useLogVisit("Beneficiaries", "Visited Beneficiaries")
  const { filters, setFilter, selectedIds, options } = useAttendanceFilters()

  const [appliedSearch, setAppliedSearch] = useState("")
  const { page, setPage, pageSize, handleRowsChange } = usePagination([appliedSearch, filters])
  const [targetClass, setTargetClass] = useState<string | undefined>()
  const [destinationClass, setDestinationClass] = useState<string | undefined>()

  const { data, isError } = useQuery({
    queryKey: ["students", page, pageSize, appliedSearch, filters],
    queryFn: () => getStudents(page, pageSize, {
      ...filters,
      ...(appliedSearch && { name: appliedSearch }),
    }),
    placeholderData: keepPreviousData,
  })

  const records = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0

  return (
    <div className="space-y-6">
      {/* Cohort Filter */}
      <div className="w-64">
        <FilterSelect
          placeholder="Cohort"
          items={options.cohorts}
          value={filters.cohort ?? undefined}
          onValueChange={(value) => { if (value !== null) setFilter("cohort", value) }}
          formatItem={(value) => {
            const num = parseInt(value, 10)
            const suffix = num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th"
            return `${num}${suffix} Cohort`
          }}
        />
      </div>

      {/* Search + Download */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBar onSearch={setAppliedSearch} />
        <Button
          variant="outline"
          className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
          onClick={() => selectedIds.cohort && exportStudents(selectedIds.cohort)}
          disabled={!selectedIds.cohort}
        >
          <Download className="size-4" />
          Download
        </Button>
      </div>

      {/* Class Transfer */}
      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center gap-3 rounded-full border-2 border-dashed border-brand/60 bg-brand/10 px-6 py-3">
          <FilterSelect
            placeholder="Select a target class"
            items={CLASS_OPTIONS}
            value={targetClass}
            onValueChange={(value) => setTargetClass(value ?? undefined)}
          />
          <FilterSelect
            placeholder="Select a destination class"
            items={CLASS_OPTIONS}
            value={destinationClass}
            onValueChange={(value) => setDestinationClass(value ?? undefined)}
          />
          <Button className="h-11 rounded-full bg-brand px-6 text-white hover:bg-brand/90">
            Update All
          </Button>
        </div>
      </div>

      {/* Pagination */}
      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        defaultRows={String(pageSize)}
        onRowsChange={handleRowsChange}
      />

      {isError && <QueryError />}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-16 text-center text-xs font-semibold text-sidebar">S/N</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Name</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">LGA</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">School</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Caregiver</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Class</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Current Class</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableEmptyState colSpan={7} />
            ) : records.map((record, index) => (
              <TableRow key={record.id} className="border-border/40">
                <TableCell className="text-center text-xs text-muted-foreground">
                  {(page - 1) * pageSize + index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StudentPhoto url={record.photo_url} name={record.name} />
                    <span className="text-xs font-semibold text-sidebar">{record.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.lga}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.school?.name ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-sidebar/10">
                      <Phone className="size-3.5 text-sidebar" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      ({record.caregiver_phone}) {record.caregiver_name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-xs font-semibold text-brand">{record.class_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.current_class}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

const CLASS_OPTIONS = [
  "JSS 1", "JSS 2", "JSS 3",
  "SSS 1", "SSS 2", "SSS 3",
]
