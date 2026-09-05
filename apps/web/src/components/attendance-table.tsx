import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PercentageBadge } from "@/components/percentage-badge"
import { StudentPhoto } from "@/components/student-photo"
import { TableEmptyState } from "@/components/table-empty-state"
import { TableSkeletonRows } from "@/components/skeleton"
import type { AttendanceRecord } from "@/types"

interface AttendanceTableProps {
  records: AttendanceRecord[]
  page: number
  pageSize: number
  // First page still loading — show placeholder rows instead of "no data".
  isLoading?: boolean
}

export function AttendanceTable({ records, page, pageSize, isLoading = false }: AttendanceTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
      {/* min-w makes the wrapper's horizontal scroll actually engage — without
          it the table is w-full and 10 columns crush together on mobile. */}
      <Table className="min-w-[900px]">
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
          {isLoading ? (
            <TableSkeletonRows columns={10} />
          ) : records.length === 0 ? (
            <TableEmptyState colSpan={10} />
          ) : (
            records.map((record, index) => (
              <TableRow key={record.id} className="border-border/40">
                <TableCell className="text-center text-xs text-muted-foreground">
                  {(page - 1) * pageSize + index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StudentPhoto url={record.student?.photo_url} name={record.student?.name} studentId={record.student?.id} hasPhoto={record.student?.has_photo} />
                    <span className="text-xs font-semibold text-foreground">{record.student?.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.student?.id}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.student?.current_class}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.term} Term</TableCell>
                <TableCell className="text-xs text-muted-foreground">{record.year}</TableCell>
                <TableCell className="text-xs text-muted-foreground">Week {record.week}</TableCell>
                <TableCell className="text-center">
                  <PercentageBadge value={record.attendance_average} />
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{record.reason ?? "—"}</TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{record.remark ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
