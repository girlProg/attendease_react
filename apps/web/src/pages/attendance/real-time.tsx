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

type AttendanceRecord = {
  sn: number
  name: string
  id: string
  class: string
  term: string
  year: string
  week: string
  percentage: number
  reason: string
  remark: string
}

const mockData: AttendanceRecord[] = [
  { sn: 1, name: "Abah Treasure", id: "1042", class: "JSS 1", term: "1st Term", year: "2025/2026", week: "Week 2", percentage: 75, reason: "-", remark: "-" },
  { sn: 2, name: "Abah Treasure", id: "1042", class: "JSS 1", term: "1st Term", year: "2025/2026", week: "Week 5", percentage: 100, reason: "-", remark: "-" },
  { sn: 3, name: "Abah Treasure", id: "1042", class: "JSS 1", term: "1st Term", year: "2025/2026", week: "Week 12", percentage: 75, reason: "-", remark: "-" },
  { sn: 4, name: "Abah Treasure", id: "1042", class: "JSS 1", term: "1st Term", year: "2025/2026", week: "Week 4", percentage: 75, reason: "-", remark: "-" },
  { sn: 5, name: "Abah Treasure", id: "1042", class: "JSS 1", term: "1st Term", year: "2025/2026", week: "Week 6", percentage: 75, reason: "-", remark: "-" },
]

export function RealTime() {
  return (
    <div className="space-y-6">
      <PaginationBar totalPages={32} />

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
            {mockData.map((row) => (
              <TableRow key={row.sn} className="border-border/40">
                <TableCell className="text-center text-sm text-muted-foreground">{row.sn}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="size-6 shrink-0 rounded-md bg-muted py-6" />
                    <span className="text-sm font-semibold text-foreground">{row.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.id}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.class}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.term}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.year}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.week}</TableCell>
                <TableCell className="text-center">
                  <PercentageBadge value={row.percentage} />
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">{row.reason}</TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">{row.remark}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
