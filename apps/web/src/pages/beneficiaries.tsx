import { useState } from "react"
import { Download, Phone } from "lucide-react"
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"

import { useLogVisit } from "@/hooks/use-log-visit"
import { useAuth } from "@/contexts/auth-context"
import { SchoolMergeDialog } from "@/components/school-merge-dialog"
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
import { getStudents, exportStudents, bulkChangeClass } from "@/api/attendance"

function classChangeError(error: unknown): string {
  const data = (error as { response?: { data?: { error?: string; detail?: string } } })
    ?.response?.data
  return data?.error ?? data?.detail ?? "Could not update the class. Please try again."
}

export function BeneficiariesPage() {
  useLogVisit("Beneficiaries", "Visited Beneficiaries")
  const queryClient = useQueryClient()
  const { isSuperuser } = useAuth()
  const { filters, setFilter, selectedIds, options } = useAttendanceFilters()

  const [appliedSearch, setAppliedSearch] = useState("")
  const { page, setPage, pageSize, handleRowsChange } = usePagination([appliedSearch, filters])
  const [targetClass, setTargetClass] = useState<string | undefined>()
  const [destinationClass, setDestinationClass] = useState<string | undefined>()

  const updateClass = useMutation({
    mutationFn: bulkChangeClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] })
      queryClient.invalidateQueries({ queryKey: ["students-summary"] })
      setTargetClass(undefined)
      setDestinationClass(undefined)
    },
  })

  function handleUpdateAll() {
    if (!selectedIds.cohort || !targetClass || !destinationClass) return
    updateClass.mutate({
      cohort: selectedIds.cohort,
      target_class: targetClass,
      destination_class: destinationClass,
    })
  }

  const { data, isError } = useQuery({
    queryKey: ["students", page, pageSize, appliedSearch, filters],
    queryFn: () => getStudents(page, pageSize, {
      ...filters,
      ...(selectedIds.school ? { schoolId: String(selectedIds.school) } : {}),
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
        {isSuperuser && (
          <SchoolMergeDialog lga={selectedIds.lga} lgaName={filters.lga} />
        )}
      </div>

      {/* Class Transfer */}
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-3 rounded-full border-2 border-dashed border-brand/60 bg-brand/10 px-6 py-3">
          <FilterSelect
            placeholder="Select a target class"
            items={CLASS_OPTIONS}
            value={targetClass}
            onValueChange={(value) => setTargetClass(value ?? undefined)}
          />
          <FilterSelect
            placeholder="Select a destination class"
            items={DESTINATION_OPTIONS}
            value={destinationClass}
            onValueChange={(value) => setDestinationClass(value ?? undefined)}
          />
          <Button
            className="h-11 rounded-full bg-brand px-6 text-white hover:bg-brand/90 disabled:opacity-50"
            disabled={
              !selectedIds.cohort ||
              !targetClass ||
              !destinationClass ||
              updateClass.isPending
            }
            onClick={handleUpdateAll}
          >
            {updateClass.isPending ? "Updating…" : "Update All"}
          </Button>
        </div>
        {!selectedIds.cohort && (
          <p className="text-xs text-muted-foreground">Select a cohort first.</p>
        )}
        {updateClass.isSuccess && (
          <p className="text-xs font-medium text-emerald-600">
            Updated {updateClass.data.updated} student(s).
          </p>
        )}
        {updateClass.isError && (
          <p className="text-xs font-medium text-red-600">
            {classChangeError(updateClass.error)}
          </p>
        )}
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
                    {record.graduated && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Graduated
                      </span>
                    )}
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
                <TableCell className="text-xs font-semibold text-brand">{record.class_name || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.current_class || record.class_name || "—"}</TableCell>
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

// Destination can also mark students Graduated (backend sets graduated=True).
const DESTINATION_OPTIONS = [...CLASS_OPTIONS, "Graduated"]
