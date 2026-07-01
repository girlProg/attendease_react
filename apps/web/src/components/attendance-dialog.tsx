import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { getAttendance } from "@/api/attendance"

function getTermLabel(term: number): string {
  if (term === 1) return "1st Term"
  if (term === 2) return "2nd Term"
  return "3rd Term"
}

export interface AttendanceDialogCell {
  schoolId: number
  schoolName: string
  year: string
  term: number
  week: number
  totalEnrolled?: number
}

export function AttendanceDialog({
  cell,
  onClose,
}: {
  cell: AttendanceDialogCell
  onClose: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-popup", cell.schoolId, cell.year, cell.term, cell.week],
    queryFn: () =>
      getAttendance(1, 1000, "", {
        school: cell.schoolName,
        year: String(cell.year),
        term: String(cell.term),
        week: String(cell.week),
      }),
  })

  const records = data?.results ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">{cell.schoolName}</h2>
            <p className="text-xs text-muted-foreground">
              {cell.year} · {getTermLabel(cell.term)} · Week {cell.week}
              {!isLoading && cell.totalEnrolled != null && (
                <span className="ml-2 font-semibold">
                  · {records.length} of {cell.totalEnrolled} students recorded
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading attendance…</p>
          ) : records.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No attendance records found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-12 text-center text-xs font-semibold text-sidebar">S/N</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Student</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-sidebar">Mon</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-sidebar">Tue</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-sidebar">Wed</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-sidebar">Thu</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-sidebar">Avg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record, index) => (
                  <TableRow key={record.id} className="border-border/40">
                    <TableCell className="text-center text-xs text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">{record.student?.name}</TableCell>
                    <DayCell active={Boolean(record.monday)} />
                    <DayCell active={Boolean(record.tuesday)} />
                    <DayCell active={Boolean(record.wednesday)} />
                    <DayCell active={Boolean(record.thursday)} />
                    <TableCell className="text-center text-xs font-semibold text-muted-foreground">
                      {record.attendance_average != null ? `${Math.round(record.attendance_average)}%` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}

function DayCell({ active }: { active: boolean }) {
  return (
    <TableCell className="text-center">
      <span className={`inline-block size-3 rounded-full ${active ? "bg-emerald-500" : "bg-red-400"}`} />
    </TableCell>
  )
}
