import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PaginationBar } from "@/components/pagination-bar"
import { PercentageBadge } from "@/components/percentage-badge"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { getAttendance, type AttendanceRecord } from "@/api/attendance"

export function RealTime({ search = "", filters = {} }: { search?: string; filters?: Record<string, string> }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)

  useEffect(() => { setPage(1) }, [search, filters])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["attendance", page, pageSize, search, filters],
    queryFn: () => getAttendance(page, pageSize, search, filters),
    placeholderData: keepPreviousData,
  })

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0

  if (isLoading && !data) return <p>Loading…</p>
  if (isError) return <p>{String(error)}</p>

  return (
    <div className="space-y-6">
      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        defaultRows={String(pageSize)}
        onRowsChange={(v) => {
          setPageSize(Number(v))
          setPage(1)
        }}
      />

      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-16 text-center text-xs font-semibold text-sidebar">S/N</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Name</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">ID</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Class</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Term</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Year</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Week</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Percentage</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Reason</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Remark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.results.map((attendance: AttendanceRecord, index: number) => (
              <TableRow key={attendance.id} className="border-border/40">
                <TableCell className="text-center text-xs text-muted-foreground">
                  {(page - 1) * pageSize + index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="size-6 shrink-0 rounded-md bg-muted py-5" />
                    <span className="text-xs font-semibold text-foreground">{attendance.student.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{attendance.id}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{attendance.student.current_class}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{attendance.term}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{attendance.student.cohort.year}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{attendance.week}</TableCell>
                <TableCell className="text-center">
                  <PercentageBadge value={attendance.attendance_average} />
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{attendance.reason}</TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{attendance.remark}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
