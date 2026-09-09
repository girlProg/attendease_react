import { useState } from "react"
import {
  AlertTriangle,
  Banknote,
  ClipboardCheck,
  Download,
  RefreshCw,
  School,
  Users,
} from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Button } from "@workspace/ui/components/button"
import { Chip } from "@/components/chip"
import { Delta } from "@/components/delta"
import { FilterSelect } from "@/components/filter-select"
import { PercentageBadge } from "@/components/percentage-badge"
import { QueryError } from "@/components/query-error"
import { StatCard } from "@/components/stat-card"
import { StatCardSkeleton } from "@/components/skeleton"
import { TableEmptyState } from "@/components/table-empty-state"
import { useLogVisit } from "@/hooks/use-log-visit"
import {
  exportMonthlyReport,
  generateMonthlyReport,
  getMonthlyReports,
} from "@/api/reports"
import type { MonthlyReport, Polarity, ReportFigures } from "@/api/reports"
import { formatDateTime, formatNaira } from "@/lib/formatters"

/** The month just ended — what "Generate" offers when nothing exists yet. */
function lastMonthPeriod() {
  const now = new Date()
  const month = now.getMonth() // 0-indexed, so this is already last month
  const year = month === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const monthNumber = month === 0 ? 12 : month
  return `${year}-${String(monthNumber).padStart(2, "0")}`
}

function Section({ title, note, children }: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-3">
        <h3 className="text-sm font-bold text-sidebar">{title}</h3>
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  )
}

export function ReportsPage() {
  useLogVisit("Reports", "Visited Monthly Report")
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState<string | undefined>()

  const { data, isError, isLoading } = useQuery({
    queryKey: ["monthly-reports"],
    queryFn: getMonthlyReports,
  })

  const generate = useMutation({
    mutationFn: generateMonthlyReport,
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ["monthly-reports"] })
      setPeriod(report.period)
    },
  })

  // The endpoint is deliberately unpaginated, but guard the shape anyway: a
  // paginated envelope here once turned the whole page into a white screen.
  const reports = Array.isArray(data?.results) ? data.results : []
  const polarity = data?.polarity ?? {}
  const report: MonthlyReport | undefined =
    reports.find((entry) => entry.period === period) ?? reports[0]

  if (isError) return <QueryError />

  if (!isLoading && reports.length === 0) {
    return (
      <div className="space-y-4 rounded-2xl border border-border/40 bg-white p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No monthly report has been generated yet.
        </p>
        <Button
          className="h-10 rounded-full bg-sidebar px-6 text-sm text-white hover:bg-sidebar/90"
          disabled={generate.isPending}
          onClick={() => generate.mutate(lastMonthPeriod())}
        >
          {generate.isPending ? "Building…" : `Generate ${lastMonthPeriod()}`}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          placeholder="Month"
          items={reports.map((entry) => entry.period)}
          value={report?.period}
          onValueChange={(value) => setPeriod(value ?? undefined)}
          formatItem={(value) =>
            reports.find((entry) => entry.period === value)?.label ?? value
          }
        />
        {report && (
          <p className="text-[11px] text-muted-foreground">
            Generated {formatDateTime(report.generated_at)}
            {report.generated_by_name ? ` by ${report.generated_by_name}` : ""}
          </p>
        )}
        {report?.stale && <Chip tone="amber">Data changed since generating</Chip>}
        <div className="ml-auto flex gap-2">
          {report && (
            <Button
              variant="outline"
              className="h-10 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
              onClick={() => exportMonthlyReport(report.period)}
            >
              <Download className="size-4" />
              Download CSV
            </Button>
          )}
          <Button
            variant="outline"
            className="h-10 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
            disabled={generate.isPending}
            onClick={() => generate.mutate(report?.period ?? lastMonthPeriod())}
          >
            <RefreshCw className="size-4" />
            {generate.isPending ? "Building…" : "Regenerate"}
          </Button>
        </div>
      </div>

      {isLoading || !report ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <ReportBody figures={report.figures} previous={report.previous} polarity={polarity} />
      )}
    </div>
  )
}

function ReportBody({
  figures,
  previous,
  polarity,
}: {
  figures: ReportFigures
  previous: Partial<ReportFigures>
  polarity: Record<string, Polarity>
}) {
  const collection = figures.collection
  const wasCollection = previous.collection
  const quality = figures.quality
  const wasQuality = previous.quality
  const participation = figures.participation
  const payments = figures.payments

  const cards = [
    {
      label: "Submissions",
      value: collection.submissions.toLocaleString(),
      sub: `${collection.attendance_rows.toLocaleString()} attendance rows`,
      icon: ClipboardCheck,
      color: "bg-[var(--stat-accent-1)]",
      delta: (
        <Delta
          current={collection.submissions}
          previous={wasCollection?.submissions}
          polarity={polarity.submissions}
        />
      ),
    },
    {
      label: "School Coverage",
      value: `${collection.coverage_percent}%`,
      sub: `${collection.schools_submitting} of ${collection.schools_owing} schools`,
      icon: School,
      color: "bg-[var(--stat-accent-2)]",
      delta: (
        <Delta
          current={collection.coverage_percent}
          previous={wasCollection?.coverage_percent}
          polarity={polarity.coverage_percent}
          suffix="pp"
        />
      ),
    },
    {
      label: "Officers Active",
      value: participation.tracked
        ? `${participation.active_count} of ${participation.officer_count}`
        : "Not recorded",
      sub: participation.tracked
        ? `${participation.active_percent}% of officers`
        : "before participation was logged",
      icon: Users,
      color: "bg-[var(--stat-accent-1)]",
      delta: participation.tracked ? (
        <Delta
          current={participation.active_count}
          previous={previous.participation?.tracked ? previous.participation.active_count : undefined}
          polarity={polarity.active_count}
        />
      ) : null,
    },
    {
      label: "Blank School-Weeks",
      value: quality.data_gap_count.toLocaleString(),
      sub: `${quality.data_gap_students.toLocaleString()} students affected`,
      icon: AlertTriangle,
      color: "bg-[var(--stat-accent-2)]",
      delta: (
        <Delta
          current={quality.data_gap_count}
          previous={wasQuality?.data_gap_count}
          polarity={polarity.data_gap_count}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="space-y-1">
            <StatCard {...card} />
            <div className="pl-1">{card.delta}</div>
          </div>
        ))}
      </div>

      <Section
        title="Data quality"
        note="Whether what arrived this month can be trusted"
      >
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border/40 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            label="Rows at 0%"
            value={`${quality.zero_rows.toLocaleString()} (${quality.zero_row_percent}%)`}
            delta={
              <Delta
                current={quality.zero_row_percent}
                previous={wasQuality?.zero_row_percent}
                polarity={polarity.zero_row_percent}
                suffix="pp"
              />
            }
          />
          <Figure
            label="Weeks re-uploaded"
            value={quality.replaced_submissions.toLocaleString()}
            delta={
              <Delta
                current={quality.replaced_submissions}
                previous={wasQuality?.replaced_submissions}
                polarity={polarity.replaced_submissions}
              />
            }
          />
          <Figure
            label="Keyed in, no file"
            value={`${quality.unsourced_submissions.toLocaleString()} (${quality.unsourced_percent}%)`}
            delta={
              <Delta
                current={quality.unsourced_percent}
                previous={wasQuality?.unsourced_percent}
                polarity={polarity.unsourced_percent}
                suffix="pp"
              />
            }
          />
          <Figure
            label="Backfilled submissions"
            value={collection.backfilled_submissions.toLocaleString()}
            delta={
              <Delta
                current={collection.backfilled_submissions}
                previous={wasCollection?.backfilled_submissions}
                polarity={polarity.backfilled_submissions}
              />
            }
          />
        </div>
      </Section>

      <Section
        title="Payments"
        note={payments.any ? undefined : "Disbursement runs are termly — a quiet month is normal"}
      >
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border/40 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
          {payments.any ? (
            <>
              <Figure label="Disbursed" value={payments.disbursed.toLocaleString()} />
              <Figure label="Students paid" value={payments.students_paid.toLocaleString()} />
              <Figure label="Total" value={formatNaira(payments.amount)} />
              <Figure label="Awaiting" value={payments.awaiting.toLocaleString()} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Banknote className="mr-2 inline size-4" />
              No payments were made this month.
            </p>
          )}
        </div>
      </Section>

      <Section title="By LGA" note="Lowest coverage first — where to chase">
        <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold text-sidebar">LGA</TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">
                  Schools
                </TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">
                  Submitting
                </TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">
                  Coverage
                </TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">
                  Submissions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {figures.by_lga.length === 0 ? (
                <TableEmptyState colSpan={5} message="No LGA has beneficiaries yet." />
              ) : (
                figures.by_lga.map((row) => (
                  <TableRow key={row.lga_id} className="border-border/40">
                    <TableCell className="text-xs font-semibold text-sidebar">
                      {row.lga}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {row.schools_owing}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {row.schools_submitting}
                    </TableCell>
                    <TableCell className="text-center">
                      <PercentageBadge value={row.coverage_percent} />
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {row.submissions}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section
        title="Officer participation"
        note={
          participation.tracked
            ? "Logins and page activity are recorded per officer"
            : "Not recorded for this month — participation logging started later"
        }
      >
        <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold text-sidebar">Officer</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">LGAs</TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">
                  Logins
                </TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">
                  Active days
                </TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">
                  Submissions
                </TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">
                  Schools
                </TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participation.officers.length === 0 ? (
                <TableEmptyState colSpan={7} message="No officer accounts exist." />
              ) : (
                participation.officers.map((officer) => (
                  <TableRow key={officer.id} className="border-border/40">
                    <TableCell className="text-xs font-semibold text-sidebar">
                      {officer.name}
                      {officer.submissions === 0 && officer.active_days === 0 && (
                        <span className="ml-2">
                          <Chip tone="red">silent</Chip>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {officer.lgas.join(", ") || "All"}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {officer.logins}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {officer.active_days}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {officer.submissions}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {officer.schools_covered}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {officer.last_seen ? formatDateTime(officer.last_seen) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Section>

      {collection.silent_schools.length > 0 && (
        <Section
          title="Schools that submitted nothing"
          note={`${collection.silent_school_count.toLocaleString()} in total`}
        >
          <div className="flex flex-wrap gap-2 rounded-2xl border border-border/40 bg-white p-5">
            {collection.silent_schools.slice(0, 60).map((school) => (
              <span
                key={school.id}
                className="rounded-full bg-red-50 px-3 py-1 text-[11px] text-red-700"
              >
                {school.name} · {school.lga}
              </span>
            ))}
            {collection.silent_school_count > 60 && (
              <span className="text-[11px] text-muted-foreground">
                and {(collection.silent_school_count - 60).toLocaleString()} more — see the CSV
              </span>
            )}
          </div>
        </Section>
      )}

      <Section title="Programme" note="Context for the collection figures">
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border/40 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            label="Active beneficiaries"
            value={figures.programme.active_beneficiaries.toLocaleString()}
          />
          <Figure label="Graduated" value={figures.programme.graduated.toLocaleString()} />
          <Figure
            label="Dropped out this month"
            value={figures.programme.dropped_out.toLocaleString()}
            delta={
              <Delta
                current={figures.programme.dropped_out}
                previous={previous.programme?.dropped_out}
                polarity={polarity.dropped_out}
              />
            }
          />
          <Figure
            label="Transition rate"
            value={
              figures.programme.transition.rate === null
                ? "—"
                : `${figures.programme.transition.rate}%`
            }
            hint={
              figures.programme.transition.from_year
                ? `${figures.programme.transition.from_year} → ${figures.programme.transition.to_year}`
                : "needs two years of attendance"
            }
          />
        </div>
      </Section>
    </div>
  )
}

function Figure({
  label,
  value,
  hint,
  delta,
}: {
  label: string
  value: string
  hint?: string
  delta?: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-bold text-foreground">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {delta}
    </div>
  )
}
