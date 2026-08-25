import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { Download } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PaginationBar } from "@/components/pagination-bar"
import { QueryError } from "@/components/query-error"
import { TableEmptyState } from "@/components/table-empty-state"
import { usePagination } from "@/hooks/use-pagination"
import {
  downloadAttendanceFile,
  getAttendanceUploadHistory,
} from "@/api/attendance"

type SelectedIds = { cohort?: number; lga?: number; school?: number }

function formatWhen(iso: string) {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function UploadHistory({
  filters = {},
  selectedIds = {},
}: {
  filters?: Record<string, string>
  selectedIds?: SelectedIds
}) {
  const historyFilters = {
    cohort: selectedIds.cohort,
    lga: selectedIds.lga,
    school: selectedIds.school,
    year: filters.year,
    term: filters.term,
    week: filters.week,
  }
  const { page, setPage, pageSize, handleRowsChange } = usePagination([historyFilters])

  const { data, isError } = useQuery({
    queryKey: ["attendance-upload-history", page, pageSize, historyFilters],
    queryFn: () => getAttendanceUploadHistory(page, pageSize, historyFilters),
    placeholderData: keepPreviousData,
  })

  const rows = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0

  return (
    <div className="space-y-6">
      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        defaultRows={String(pageSize)}
        onRowsChange={handleRowsChange}
      />

      {isError && <QueryError />}

      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        {/* min-w makes the wrapper's horizontal scroll actually engage — without
            it the table is w-full and 11 columns crush together on mobile. */}
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold text-sidebar">Uploaded</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Uploaded By</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">School</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">LGA</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Cohort</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Year</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Term</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Week</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Students</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Avg. Attendance</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmptyState colSpan={11} />
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="border-border/40">
                  <TableCell className="text-xs text-muted-foreground">
                    {formatWhen(row.created_at)}
                    {row.updated_at !== row.created_at && (
                      <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        re-uploaded
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.uploaded_by ?? "—"}</TableCell>
                  <TableCell className="text-xs font-semibold text-sidebar">{row.school}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.lga}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.cohort}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {row.year ?? "—"}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{row.term}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{row.week}</TableCell>
                  <TableCell className="text-center text-xs font-semibold text-brand">
                    {row.student_count}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {row.average_attendance === null ? "—" : `${row.average_attendance}%`}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.has_source_file ? (
                      <button
                        type="button"
                        onClick={() => downloadAttendanceFile(row.id)}
                        title="Download the uploaded attendance file"
                        className="inline-flex items-center justify-center rounded-full p-1.5 text-sidebar hover:bg-sidebar/10"
                      >
                        <Download className="size-4" />
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
