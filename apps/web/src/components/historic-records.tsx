import { useQuery } from "@tanstack/react-query"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Chip } from "@/components/chip"
import { useAuth } from "@/contexts/auth-context"
import { formatNaira } from "@/lib/formatters"
import {
  historicAccount,
  historicAttendanceFigure,
  historicTerm,
} from "@/lib/historic-format"
import { getHistoricAttendance, getHistoricPayments } from "@/api/historic"

/** What the old files say that needs a second look: shared by the page and a student's record. */
export function HistoricMarks({
  row,
}: {
  row: { differs_from_current: string[]; repeated: boolean; needs_check?: boolean }
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.differs_from_current.length > 0 && (
        <Chip tone="amber">Differs from current: {row.differs_from_current.join(", ")}</Chip>
      )}
      {row.repeated && <Chip tone="amber">Listed twice in the file</Chip>}
      {row.needs_check && <Chip tone="red">Figures look wrong</Chip>}
    </div>
  )
}

const heading = "text-xs font-semibold text-sidebar"
const cell = "text-xs text-muted-foreground"

/** A student's records from before the MIS. Shows nothing when there are none. */
export function StudentHistoricRecords({ studentId }: { studentId: number }) {
  const { can } = useAuth()
  const params = { student: studentId, page_size: 100 }
  const attendance = useQuery({
    queryKey: ["historic-attendance", "student", studentId],
    queryFn: () => getHistoricAttendance(params),
  })
  const payments = useQuery({
    queryKey: ["historic-payments", "student", studentId],
    queryFn: () => getHistoricPayments(params),
    enabled: can("view_payments"),
  })
  const attendanceRows = attendance.data?.results ?? []
  const paymentRows = payments.data?.results ?? []
  if (attendanceRows.length === 0 && paymentRows.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-sidebar">Historic records</h3>
        <Chip>Historic</Chip>
      </div>
      <p className="text-xs text-muted-foreground">
        From the programme's files before the MIS, as they were written. These don't count
        towards qualification or Disburse.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className={heading}>Term</TableHead>
              <TableHead className={heading}>Record</TableHead>
              <TableHead className={heading}>Details</TableHead>
              <TableHead className={heading}>School then</TableHead>
              <TableHead className={heading}>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendanceRows.map((row) => (
              <TableRow key={`attendance-${row.id}`} className="border-border/40">
                <TableCell className={cell}>{historicTerm(row)}</TableCell>
                <TableCell className={cell}>Attendance</TableCell>
                <TableCell className="text-xs font-semibold text-foreground">
                  {historicAttendanceFigure(row)}
                </TableCell>
                <TableCell className={cell}>{row.school_name}</TableCell>
                <TableCell className="whitespace-normal">
                  <HistoricMarks row={row} />
                </TableCell>
              </TableRow>
            ))}
            {paymentRows.map((row) => (
              <TableRow key={`payment-${row.id}`} className="border-border/40">
                <TableCell className={cell}>{historicTerm(row)}</TableCell>
                <TableCell className={cell}>Payment</TableCell>
                <TableCell className="text-xs font-semibold text-foreground">
                  {formatNaira(Number(row.amount))}
                  <div className="font-normal text-muted-foreground">{historicAccount(row)}</div>
                </TableCell>
                <TableCell className={cell}>{row.school_name}</TableCell>
                <TableCell className="whitespace-normal">
                  <HistoricMarks row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
