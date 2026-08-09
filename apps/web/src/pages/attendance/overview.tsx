import { Users, ClipboardCheck, Percent, UserCheck } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PercentageBadge } from "@/components/percentage-badge"
import { QueryError } from "@/components/query-error"
import { TableEmptyState } from "@/components/table-empty-state"
import { getAttendanceOverview } from "@/api/attendance"

export function Overview({
  filters,
  selectedIds,
}: {
  filters: Record<string, string>
  selectedIds: { cohort?: number; lga?: number; school?: number }
}) {
  const params = {
    ...(selectedIds.cohort ? { cohort: selectedIds.cohort } : {}),
    ...(selectedIds.lga ? { lga: selectedIds.lga } : {}),
    ...(selectedIds.school ? { school: selectedIds.school } : {}),
    ...(filters.year ? { year: filters.year } : {}),
    ...(filters.term ? { term: filters.term } : {}),
  }

  const { data, isError } = useQuery({
    queryKey: ["attendance-overview", params],
    queryFn: () => getAttendanceOverview(params),
  })

  const stats = [
    {
      label: "Active Students",
      value: (data?.active_students ?? 0).toLocaleString(),
      icon: Users,
      color: "bg-sidebar",
    },
    {
      label: "Attendance Recorded",
      value: (data?.students_with_attendance ?? 0).toLocaleString(),
      icon: ClipboardCheck,
      color: "bg-[var(--stat-accent-1)]",
    },
    {
      label: "Average Attendance",
      value: `${data?.average_attendance ?? 0}%`,
      icon: Percent,
      color: "bg-[var(--stat-accent-2)]",
    },
    {
      label: "Qualifying Students",
      value: `${(data?.qualifying_students ?? 0).toLocaleString()} (${data?.qualifying_percentage ?? 0}%)`,
      icon: UserCheck,
      color: "bg-[var(--stat-accent-1)]",
    },
  ]

  return (
    <div className="space-y-4">
      {isError && <QueryError />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 rounded-2xl border border-border/40 bg-white p-5"
          >
            <div
              className={`flex size-12 shrink-0 items-center justify-center rounded-full ${stat.color} text-white`}
            >
              <stat.icon className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold text-sidebar">Class</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">
                Attendance Recorded
              </TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">
                Average
              </TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">
                Qualifying
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data?.by_class?.length ? (
              <TableEmptyState colSpan={4} />
            ) : (
              data.by_class.map((row) => (
                <TableRow key={row.class} className="border-border/40">
                  <TableCell className="text-xs font-semibold text-foreground">
                    {row.class || "—"}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {row.recorded.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <PercentageBadge value={row.average_attendance} />
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {row.qualifying_students.toLocaleString()}
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
