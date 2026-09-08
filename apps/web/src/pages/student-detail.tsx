import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ChevronRight, ExternalLink, FileText, MapPin } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Button } from "@workspace/ui/components/button"
import { AvatarPhoto } from "@/components/avatar-photo"
import { Chip } from "@/components/chip"
import { DetailField, DetailSection } from "@/components/detail-list"
import { PercentageBadge } from "@/components/percentage-badge"
import { QueryError } from "@/components/query-error"
import { TableEmptyState } from "@/components/table-empty-state"
import { StatCard } from "@/components/stat-card"
import { useAuth } from "@/contexts/auth-context"
import { useLogVisit } from "@/hooks/use-log-visit"
import { useProtectedImage } from "@/hooks/use-protected-image"
import { useSchoolWeek } from "@/hooks/use-school-week"
import {
  getStudent,
  getStudentAttendance,
  getStudentPayments,
} from "@/api/attendance"
import { getCaseDetail } from "@/api/cases"
import {
  ageInYears,
  formatDate,
  formatDateTime,
  formatNaira,
  roundUpPercent,
} from "@/lib/formatters"
import { ClipboardCheck, Percent, Banknote } from "lucide-react"
import type { AttendanceRecord, DayName, Student } from "@/types"

/** A choice and its "specify" text as one line: "Other — Albinism". */
function withSpecified(label?: string, specified?: string) {
  if (!label) return ""
  return [label, specified].filter(Boolean).join(" — ")
}

/** A nullable boolean as a word; blank when the form never asked. */
function yesNo(value?: boolean | null) {
  if (value === null || value === undefined) return ""
  return value ? "Yes" : "No"
}

function classNow(student: Student) {
  return student.current_class || student.class_name || ""
}

/** Attendance weeks bucketed by academic year, newest first. */
function groupByYear(weeks: AttendanceRecord[]) {
  const buckets = new Map<string, AttendanceRecord[]>()
  for (const week of weeks) {
    const year = String(week.year ?? "—")
    const bucket = buckets.get(year)
    if (bucket) bucket.push(week)
    else buckets.set(year, [week])
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([year, yearWeeks]) => ({
      year,
      weeks: [...yearWeeks].sort(
        (left, right) =>
          Number(right.term) - Number(left.term) || Number(right.week) - Number(left.week),
      ),
      average: averageOf(yearWeeks),
    }))
}

function averageOf(weeks: AttendanceRecord[]) {
  if (weeks.length === 0) return 0
  const total = weeks.reduce(
    (sum, week) => sum + Number(week.attendance_average || 0),
    0,
  )
  return total / weeks.length
}

function termLabel(record: { year: string | number; term: string | number }) {
  return `${record.year} · Term ${record.term}`
}

function CaregiverPhoto({ caregiverId, hasPhoto, name }: {
  caregiverId?: number
  hasPhoto?: boolean
  name?: string
}) {
  const enabled = Boolean(hasPhoto) && caregiverId !== undefined
  const { data: url, isLoading } = useProtectedImage(
    caregiverId === undefined ? undefined : `/caregiver/${caregiverId}/photo/`,
    enabled,
  )
  return <AvatarPhoto src={url} name={name} size="lg" loading={enabled && isLoading} />
}

function ConsentForm({ enrolmentId, hasForm }: { enrolmentId?: number; hasForm?: boolean }) {
  const { isAdmin } = useAuth()
  // The signed form carries the caregiver's written identity details, so the
  // server serves it to admins only. Don't even offer it to anyone else.
  const enabled = isAdmin && Boolean(hasForm) && enrolmentId !== undefined
  const { data: url } = useProtectedImage(
    enrolmentId === undefined ? undefined : `/enrolments/${enrolmentId}/consent-form/`,
    enabled,
  )
  if (!enabled || !url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-xs font-medium text-brand hover:underline"
    >
      <FileText className="size-4" />
      View signed consent form
      <ExternalLink className="size-3" />
    </a>
  )
}

/** The student's photo, at the size the header wants. */
function StudentPortrait({ student }: { student: Student }) {
  const enabled = Boolean(student.has_photo)
  const { data: url, isError, isLoading } = useProtectedImage(
    `/student/${student.id}/photo/`,
    enabled,
  )
  return (
    <AvatarPhoto
      src={enabled && !isError ? url : student.photo_url}
      name={student.name}
      size="xl"
      loading={enabled && isLoading}
      className="rounded-2xl"
    />
  )
}

export function StudentDetailPage() {
  useLogVisit("Beneficiaries", "Visited Student Detail")
  const { id } = useParams<{ id: string }>()
  const studentId = Number(id)
  const navigate = useNavigate()
  const { isViewer } = useAuth()
  const { activeDays, labelFor } = useSchoolWeek()
  const [toggledYears, setToggledYears] = useState<Record<string, boolean>>({})

  const { data: student, isError, isLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: () => getStudent(studentId),
    enabled: Number.isFinite(studentId),
  })

  const { data: attendance = [] } = useQuery({
    queryKey: ["student-attendance", studentId],
    queryFn: () => getStudentAttendance(studentId),
    enabled: Number.isFinite(studentId),
  })

  const { data: payments = [] } = useQuery({
    queryKey: ["student-payments", studentId],
    queryFn: () => getStudentPayments(studentId),
    enabled: Number.isFinite(studentId),
  })

  // A case exists only for students who have been flagged; a 404 here is the
  // normal answer, not a failure.
  const { data: caseDetail } = useQuery({
    queryKey: ["case-detail", studentId],
    queryFn: () => getCaseDetail(studentId),
    enabled: Number.isFinite(studentId),
    retry: false,
  })

  if (isError) return <QueryError />
  if (isLoading || !student) {
    return <p className="py-12 text-center text-muted-foreground">Loading student…</p>
  }

  const caregiver = student.caregiver
  const enrolment = student.enrolment
  const latitude = enrolment?.gps_latitude
  const longitude = enrolment?.gps_longitude

  const weeksRecorded = attendance.length
  const overallAverage = weeksRecorded
    ? roundUpPercent(
        attendance.reduce((total, week) => total + Number(week.attendance_average || 0), 0) /
          weeksRecorded,
      )
    : 0
  const paid = payments.filter((payment) => payment.disbursed)
  const totalPaid = paid.reduce(
    (total, payment) => total + Number(payment.amount_received || 0),
    0,
  )

  // One card per academic year, newest first, each with its own average.
  const attendanceYears = groupByYear(attendance)
  const newestYear = attendanceYears[0]?.year
  // Only years the user has actually clicked are recorded; everything else
  // follows the default of "newest open, the rest closed".
  const isYearOpen = (year: string) => toggledYears[year] ?? year === newestYear
  const toggleYear = (year: string) =>
    setToggledYears((current) => ({ ...current, [year]: !isYearOpen(year) }))

  const summary = [
    {
      label: "Weeks Recorded",
      value: weeksRecorded.toLocaleString(),
      sub: weeksRecorded ? termLabel(attendance[0] as AttendanceRecord) : "no attendance yet",
      icon: ClipboardCheck,
      color: "bg-[var(--stat-accent-1)]",
    },
    {
      label: "Average Attendance",
      value: `${overallAverage}%`,
      sub: `across ${weeksRecorded} week${weeksRecorded === 1 ? "" : "s"}`,
      icon: Percent,
      color: "bg-[var(--stat-accent-2)]",
    },
    {
      label: "Payments Received",
      value: paid.length.toLocaleString(),
      sub: `${formatNaira(totalPaid)} in total`,
      icon: Banknote,
      color: "bg-[var(--stat-accent-1)]",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-5 rounded-2xl border border-border/40 bg-white p-6">
        <button
          type="button"
          onClick={() => navigate("/beneficiaries")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-white hover:bg-foreground/90"
          title="Back to beneficiaries"
        >
          <ArrowLeft className="size-4" />
        </button>
        <StudentPortrait student={student} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">{student.name}</h2>
            {student.graduated && <Chip tone="green">Graduated</Chip>}
            {student.dropped_out && <Chip tone="red">Dropped out</Chip>}
            {enrolment?.verified && <Chip tone="sky">Verified</Chip>}
            {caseDetail?.open_case_id && <Chip tone="amber">Open case</Chip>}
          </div>
          <p className="text-sm text-muted-foreground">
            {enrolment?.beneficiary_id ?? "—"} · {student.school?.name ?? "—"} ·{" "}
            {student.lga}
          </p>
          <p className="text-xs text-muted-foreground">
            {student.cohort?.name ? `Cohort ${student.cohort.name}` : "—"} ·{" "}
            {student.graduated ? "Graduated" : classNow(student) || "no class"} · enrolled
            into {student.class_name || "—"}
          </p>
        </div>
        {caseDetail?.open_case_id && (
          <Button
            variant="outline"
            className="h-10 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
            onClick={() => navigate(`/cases/${student.id}`)}
          >
            Open case
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailSection title="Student">
          <DetailField label="Admission number" value={student.admission_number} />
          <DetailField
            label="Class"
            value={
              student.graduated
                ? `Graduated${classNow(student) ? ` (from ${classNow(student)})` : ""}`
                : classNow(student)
            }
          />
          <DetailField
            label="Date of birth"
            value={
              student.date_of_birth
                ? [formatDate(student.date_of_birth), ageInYears(student.date_of_birth)]
                    .filter(Boolean)
                    .join(" · age ")
                : ""
            }
          />
          <DetailField label="NIN" value={student.nin} />
          <DetailField
            label="Disability"
            value={withSpecified(student.disability_status_label, student.disability_details)}
          />
          <DetailField label="NIN through AGILE" value={yesNo(student.nin_from_agile)} />
        </DetailSection>

        <section className="space-y-2">
          <h3 className="text-sm font-bold text-sidebar">Caregiver</h3>
          <div className="flex gap-4 rounded-2xl border border-border/40 bg-white p-5">
            <CaregiverPhoto
              caregiverId={caregiver?.id}
              hasPhoto={caregiver?.has_photo}
              name={caregiver?.name ?? student.caregiver_name}
            />
            <dl className="grid flex-1 grid-cols-2 gap-4">
              <DetailField label="Name" value={caregiver?.name ?? student.caregiver_name} />
              <DetailField
                label="Relationship"
                value={withSpecified(
                  student.caregiver_relationship_label,
                  student.caregiver_relationship_other,
                )}
              />
              <DetailField
                label="Phone"
                value={caregiver?.phone_number ?? student.caregiver_phone}
              />
              <DetailField label="Gender" value={caregiver?.gender_label} />
              <DetailField
                label="Date of birth"
                value={formatDate(caregiver?.date_of_birth)}
              />
              <DetailField label="NIN" value={caregiver?.nin} />
              <DetailField label="Address" value={caregiver?.address} />
            </dl>
          </div>
        </section>

        <DetailSection title="Enrolment">
          <DetailField label="Beneficiary ID" value={enrolment?.beneficiary_id} />
          <DetailField label="Enrolled into" value={student.class_name} />
          <DetailField label="Enumerator" value={enrolment?.enumerator_name} />
          <DetailField label="Enumerator phone" value={enrolment?.enumerator_phone} />
          <DetailField label="Submitted" value={formatDate(enrolment?.submitted_at)} />
          <DetailField label="Device" value={enrolment?.device_id} />
          <DetailField label="School code" value={student.school?.code} />
          <DetailField label="Consent form serial" value={enrolment?.consent_form_serial} />
        </DetailSection>

        {/* The payee account is NDPR-sensitive: the API already withholds it
            from viewers, so the whole block is pointless for them. */}
        {!isViewer && (
          <DetailSection title="Payee account">
            <DetailField label="Bank" value={enrolment?.bank_name} />
            <DetailField label="Account number" value={enrolment?.bank_account_number} />
            <DetailField label="Account name" value={enrolment?.resolved_account_name} />
            <DetailField label="Caregiver BVN" value={caregiver?.bvn} />
          </DetailSection>
        )}
      </div>

      {(latitude || enrolment?.has_consent_form) && (
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/40 bg-white px-5 py-4">
          {latitude && longitude && (
            <a
              href={`https://www.google.com/maps?q=${latitude},${longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-brand hover:underline"
            >
              <MapPin className="size-4" />
              {latitude}, {longitude}
              <ExternalLink className="size-3" />
            </a>
          )}
          <ConsentForm
            enrolmentId={enrolment?.id}
            hasForm={enrolment?.has_consent_form}
          />
        </section>
      )}

      {/* Attendance, one collapsible card per academic year */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h3 className="text-sm font-bold text-sidebar">Attendance</h3>
          <p className="text-[11px] text-muted-foreground">
            {weeksRecorded.toLocaleString()} week{weeksRecorded === 1 ? "" : "s"} across{" "}
            {attendanceYears.length} year{attendanceYears.length === 1 ? "" : "s"}
          </p>
        </div>

        {attendanceYears.length === 0 ? (
          <p className="rounded-2xl border border-border/40 bg-white p-5 text-sm text-muted-foreground">
            No attendance recorded for this student yet.
          </p>
        ) : (
          attendanceYears.map(({ year, weeks, average }) => {
            const open = isYearOpen(year)
            return (
              <div
                key={year}
                className="overflow-hidden rounded-2xl border border-border/40 bg-white"
              >
                <button
                  type="button"
                  onClick={() => toggleYear(year)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/40"
                >
                  <ChevronRight
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold text-sidebar">{year}</span>
                  <span className="text-xs text-muted-foreground">
                    {weeks.length} week{weeks.length === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto">
                    <PercentageBadge value={average} />
                  </span>
                </button>

                {open && (
                  <div className="overflow-x-auto border-t border-border/40">
                    <Table className="min-w-[520px]">
                      <TableHeader>
                        <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-xs font-semibold text-sidebar">
                            Term
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-sidebar">
                            Week
                          </TableHead>
                          {activeDays.map((day) => (
                            <TableHead
                              key={day}
                              className="text-center text-xs font-semibold text-sidebar"
                            >
                              {labelFor(day)}
                            </TableHead>
                          ))}
                          <TableHead className="text-center text-xs font-semibold text-sidebar">
                            Average
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeks.map((week) => (
                          <TableRow key={week.id} className="border-border/40">
                            <TableCell className="text-xs text-muted-foreground">
                              {week.term}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {week.week}
                            </TableCell>
                            {activeDays.map((day) => (
                              <TableCell key={day} className="text-center text-xs">
                                {week[day as DayName] ? (
                                  <span className="text-emerald-600">●</span>
                                ) : (
                                  <span className="text-muted-foreground/40">○</span>
                                )}
                              </TableCell>
                            ))}
                            <TableCell className="text-center">
                              <PercentageBadge
                                value={Number(week.attendance_average || 0)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </section>

      {/* Payments */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold text-sidebar">Payments</h3>
        <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold text-sidebar">Year</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Term</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Amount</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Status</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Batch</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableEmptyState
                  colSpan={6}
                  message="No payments have been generated for this student."
                />
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id} className="border-border/40">
                    <TableCell className="text-xs text-muted-foreground">
                      {payment.year ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {payment.term ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">
                      {formatNaira(Number(payment.amount_received || 0))}
                    </TableCell>
                    <TableCell>
                      {payment.disbursed ? (
                        <Chip tone="green">Paid</Chip>
                      ) : (
                        <Chip tone="amber">Not paid</Chip>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {payment.batch_reference || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(payment.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Case history, only where there is one */}
      {caseDetail && caseDetail.cases.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline gap-3">
            <h3 className="text-sm font-bold text-sidebar">Case history</h3>
            <button
              type="button"
              onClick={() => navigate(`/cases/${student.id}`)}
              className="text-xs font-medium text-brand hover:underline"
            >
              Open the full case
            </button>
          </div>
          <ul className="space-y-2 rounded-2xl border border-border/40 bg-white p-4">
            {caseDetail.cases.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-2 text-xs">
                <Chip tone={entry.status === "open" ? "amber" : "gray"}>{entry.status}</Chip>
                <span className="text-muted-foreground">
                  opened {formatDate(entry.opened_at)}
                  {entry.resolved_at ? `, resolved ${formatDate(entry.resolved_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
