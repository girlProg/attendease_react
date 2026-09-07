import {
  Users,
  UserCheck,
  ClipboardCheck,
  Percent,
  GraduationCap,
  School,
  Banknote,
  XCircle,
} from "lucide-react"
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
import { TableSkeletonRows } from "@/components/skeleton"
import { StatCard } from "@/components/stat-card"
import { useAuth } from "@/contexts/auth-context"
import { getAttendanceOverview } from "@/api/attendance"
import { formatNaira, roundUpPercent } from "@/lib/formatters"

function percentOf(part: number, whole: number): number {
  return whole > 0 ? roundUpPercent((part / whole) * 100) : 0
}

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

  const { isStaffuser } = useAuth()

  const { data, isError, isLoading } = useQuery({
    queryKey: ["attendance-overview", params],
    queryFn: () => getAttendanceOverview(params),
  })

  const beneficiaries = data?.total_beneficiaries ?? 0
  const active = data?.active_students ?? 0
  const recorded = data?.students_with_attendance ?? 0
  const graduated = data?.graduated_students ?? 0
  const schools = data?.total_schools ?? 0
  const submitted = data?.submitted

  const stats = [
    {
      label: "Beneficiaries",
      value: beneficiaries.toLocaleString(),
      sub: `${active.toLocaleString()} active · ${graduated.toLocaleString()} graduated`,
      icon: Users,
      color: "bg-sidebar",
    },
    {
      label: "Schools",
      value: schools.toLocaleString(),
      sub: schools ? `${Math.round(beneficiaries / schools)} avg / school` : undefined,
      icon: School,
      color: "bg-[var(--stat-accent-2)]",
    },
    {
      label: "Attendance Recorded",
      value: recorded.toLocaleString(),
      sub: `${percentOf(recorded, active)}% of active`,
      icon: ClipboardCheck,
      color: "bg-[var(--stat-accent-1)]",
    },
    {
      label: "Average Attendance",
      value: `${data?.average_attendance ?? 0}%`,
      sub: `across ${recorded.toLocaleString()} students`,
      icon: Percent,
      color: "bg-[var(--stat-accent-2)]",
    },
    {
      label: "Qualifying Students",
      value: (data?.qualifying_students ?? 0).toLocaleString(),
      sub: `${data?.qualifying_percentage ?? 0}% of recorded`,
      icon: UserCheck,
      color: "bg-[var(--stat-accent-1)]",
    },
    {
      label: "Graduated",
      value: graduated.toLocaleString(),
      sub: `${percentOf(graduated, beneficiaries)}% of beneficiaries`,
      icon: GraduationCap,
      color: "bg-sidebar",
    },
    {
      label: "Payments Made",
      value: (data?.payments_made ?? 0).toLocaleString(),
      sub: `${formatNaira(data?.total_disbursed_amount ?? 0)} disbursed`,
      icon: Banknote,
      color: "bg-[var(--stat-accent-1)]",
    },
    {
      label: "Failed Payments",
      value: (data?.failed_payments ?? 0).toLocaleString(),
      sub: `${percentOf(data?.failed_payments ?? 0, (data?.payments_made ?? 0) + (data?.failed_payments ?? 0))}% of attempts`,
      icon: XCircle,
      color: "bg-[var(--stat-accent-2)]",
    },
  ]

  const submittedRecorded = submitted?.students_with_attendance ?? 0
  const submittedStats = [
    {
      label: "Attendance Recorded",
      value: submittedRecorded.toLocaleString(),
      sub: `${percentOf(submittedRecorded, recorded)}% of all recorded`,
      icon: ClipboardCheck,
      color: "bg-[var(--stat-accent-1)]",
    },
    {
      label: "Average Attendance",
      value: `${submitted?.average_attendance ?? 0}%`,
      sub: `across ${submittedRecorded.toLocaleString()} students`,
      icon: Percent,
      color: "bg-[var(--stat-accent-2)]",
    },
    {
      label: "Qualifying Students",
      value: (submitted?.qualifying_students ?? 0).toLocaleString(),
      sub: `${submitted?.qualifying_percentage ?? 0}% of submitted`,
      icon: UserCheck,
      color: "bg-[var(--stat-accent-1)]",
    },
  ]

  return (
    <div className="space-y-4">
      {isError && <QueryError />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} loading={isLoading} />
        ))}
      </div>

      {/* Staff only: the same three figures over the attendance that arrived in
          an uploaded register, so collected data can be told from keyed-in. */}
      {isStaffuser && submitted && (
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-bold text-sidebar">Submitted attendance</h3>
            <p className="text-[11px] text-muted-foreground">
              From {submitted.submissions.toLocaleString()} uploaded register
              {submitted.submissions === 1 ? "" : "s"} · staff only
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {submittedStats.map((stat) => (
              <StatCard key={stat.label} {...stat} loading={isLoading} />
            ))}
          </div>
        </section>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table className="min-w-[520px]">
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
            {isLoading ? (
              <TableSkeletonRows columns={4} rows={5} />
            ) : !data?.by_class?.length ? (
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
