import { useState } from "react"
import { Plus } from "lucide-react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"

import { useAuth } from "@/contexts/auth-context"
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
import { AttendanceFilterBar } from "@/components/attendance-filter-bar"
import { PercentageBadge } from "@/components/percentage-badge"
import { QueryError } from "@/components/query-error"
import { StudentPhoto } from "@/components/student-photo"
import { TableEmptyState } from "@/components/table-empty-state"
import { SearchBar } from "@/components/search-bar"
import { PaginationBar } from "@/components/pagination-bar"
import { UploadRecordsDialog } from "@/components/upload-records-dialog"
import { UploadBatchesDialog } from "@/components/upload-batches-dialog"
import { useAttendanceFilters } from "@/hooks/use-attendance-filters"
import { usePagination } from "@/hooks/use-pagination"
import { getTermAverages } from "@/api/attendance"
import { formatNaira } from "@/lib/formatters"

export function StudentsPage() {
  useLogVisit("Students", "Visited Students")
  const { canWrite, isAdmin } = useAuth()
  const { filters, setFilter, selectedIds, options } = useAttendanceFilters()

  const [appliedSearch, setAppliedSearch] = useState("")
  const { page, setPage, pageSize, handleRowsChange } = usePagination([appliedSearch, filters])

  const { data, isError } = useQuery({
    queryKey: ["students-summary", filters.year, selectedIds.school, selectedIds.cohort, filters.term, appliedSearch, page, pageSize],
    queryFn: () => getTermAverages({
      ...(filters.year && { year: filters.year }),
      ...(selectedIds.school && { school: selectedIds.school }),
      ...(selectedIds.cohort && { cohort: selectedIds.cohort }),
      ...(filters.term && { term: filters.term }),
      ...(appliedSearch && { name: appliedSearch }),
      page,
      page_size: pageSize,
    }),
    placeholderData: keepPreviousData,
  })

  const records = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0

  return (
    <div className="space-y-6">
      {/* Filters */}
      <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} exclude={["week"]} />

      {/* Search + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBar onSearch={setAppliedSearch} />
        {isAdmin && (
          <>
            <UploadRecordsDialog />
            <UploadBatchesDialog />
          </>
        )}
        {canWrite && (
          <Button
            variant="outline"
            className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
          >
            <Plus className="size-4" />
            New Student
          </Button>
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
              <TableHead className="text-xs font-semibold text-sidebar">ID</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Caregiver Name</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Class</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">1st</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">2nd</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">3rd</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">1st ₦</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">2nd ₦</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">3rd ₦</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableEmptyState colSpan={11} />
            ) : (
              records.map((record, index) => {
                const term1Payment = record.payments?.find((payment) => payment.term === 1)
                const term2Payment = record.payments?.find((payment) => payment.term === 2)
                const term3Payment = record.payments?.find((payment) => payment.term === 3)

                return (
                  <TableRow key={record.id} className="border-border/40">
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {(page - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StudentPhoto url={record.photo_url} name={record.name} />
                        <span className="text-xs font-semibold text-foreground">{record.name}</span>
                        {record.graduated && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Graduated
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.caregiver_name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.current_class}</TableCell>
                    <TableCell className="text-center"><PercentageBadge value={record.term_1} /></TableCell>
                    <TableCell className="text-center"><PercentageBadge value={record.term_2} /></TableCell>
                    <TableCell className="text-center"><PercentageBadge value={record.term_3} /></TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {term1Payment ? formatNaira(parseFloat(term1Payment.amount_received)) : "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {term2Payment ? formatNaira(parseFloat(term2Payment.amount_received)) : "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {term3Payment ? formatNaira(parseFloat(term3Payment.amount_received)) : "—"}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
