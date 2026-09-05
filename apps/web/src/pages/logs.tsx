import { useQuery, keepPreviousData } from "@tanstack/react-query"

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
import { TableSkeletonRows } from "@/components/skeleton"
import { useLogVisit } from "@/hooks/use-log-visit"
import { usePagination } from "@/hooks/use-pagination"
import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/types"

interface LogEntry {
  id: number
  user: number
  first_name: string
  last_name: string
  type: string
  action: string
  created_at: string
}

const getLogs = (page: number, pageSize: number) =>
  api.get<PaginatedResponse<LogEntry>>("/activity-log/", {
    params: { page, page_size: pageSize },
  }).then((response) => response.data)

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatTime(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function LogsPage() {
  useLogVisit("Logs", "Visited Logs")
  const { page, setPage, pageSize, handleRowsChange } = usePagination([], 10)

  const { data, isError, isLoading } = useQuery({
    queryKey: ["logs", page, pageSize],
    queryFn: () => getLogs(page, pageSize),
    placeholderData: keepPreviousData,
  })

  const records = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0

  return (
    <div className="space-y-6">
      {/* Pagination */}
      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        rowOptions={["10", "25", "50"]}
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
              <TableHead className="text-xs font-semibold text-sidebar">User</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Action</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Description</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Date</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={6} rows={pageSize} />
            ) : records.length === 0 ? (
              <TableEmptyState colSpan={6} />
            ) : records.map((record, index) => (
              <TableRow key={record.id} className="border-border/40">
                <TableCell className="text-center text-xs text-muted-foreground">
                  {(page - 1) * pageSize + index + 1}
                </TableCell>
                <TableCell className="text-xs font-semibold text-foreground">{record.first_name} {record.last_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.type}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.action}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(record.created_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatTime(record.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
