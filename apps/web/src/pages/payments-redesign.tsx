import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ChevronRight,
  Download,
  FileCheck2,
  History,
  Info,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShieldX,
} from "lucide-react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useAuth } from "@/contexts/auth-context"
import { useLogVisit } from "@/hooks/use-log-visit"
import { HistoricPanel } from "@/components/historic-panel"
import { useAttendanceFilters, type FilterKey } from "@/hooks/use-attendance-filters"
import { useHistoricPayments } from "@/hooks/use-historic-payments"
import { includesHistoric } from "@/lib/historic-format"
import { usePagination } from "@/hooks/use-pagination"
import { getCohorts, getNoObjectionStatus, getTermAverages, paymentsExport } from "@/api/attendance"
import {
  findPayableTerm,
  getCurrentDisbursement,
  getDisbursementSettings,
  getPayableTerms,
  getSchoolPayouts,
  pollPendingDisbursements,
  setDisbursementSettings,
  type DisbursementSettings,
} from "@/api/payments"
import { useColumnDownload } from "@/hooks/use-column-download"
import { DisburseDialog } from "@/components/disburse-dialog"
import { DownloadPdfButton } from "@/components/download-pdf-button"
import { NoObjectionDialog } from "@/components/no-objection-dialog"
import { PayoutOutcome, PayoutTracker } from "@/components/payout-tracker"
import { PercentageBadge } from "@/components/percentage-badge"
import { QueryError } from "@/components/query-error"
import { SchoolPicker } from "@/components/school-picker"
import { TableSkeletonRows } from "@/components/skeleton"
import { StatusBadge } from "@/components/status-badge"
import { StudentLink } from "@/components/student-link"
import { StudentPhoto } from "@/components/student-photo"
import { TableEmptyState } from "@/components/table-empty-state"
import { formatAcademicYear, formatNaira, ordinal } from "@/lib/formatters"
import { paymentStatusBadge } from "@/lib/payment-status"
import { runInProgress, selectRun, shortWhen } from "@/lib/payout-run"
import type { Payee } from "@/types"

const PAYMENT_FILTERS: readonly FilterKey[] = ["cohort", "term", "year", "lga", "school"]

type PaymentRecord = Awaited<ReturnType<typeof getTermAverages>>["results"][number]

// Where a student's payment for the term is, as the tabs sort them.
type RowStatus = "not_sent" | "queued" | "in_flight" | "unknown" | "awaiting_bank" | "failed" | "paid"

// Tab names; each row's own badge keeps the bank's status word.
const TAB_LABEL: Record<RowStatus, string> = {
  not_sent: "Not sent",
  queued: "Queued",
  in_flight: "In flight",
  unknown: "Unknown",
  awaiting_bank: "Awaiting bank confirmation",
  failed: "Failed",
  paid: "Paid",
}

// Tabs in the order money moves; Failed and Paid always show, the rest only
// when someone is in them.
const TAB_ORDER: RowStatus[] = ["not_sent", "queued", "in_flight", "unknown", "awaiting_bank", "failed", "paid"]
const ALWAYS_SHOWN: RowStatus[] = ["failed", "paid"]

const DISMISSED_KEY = "payments-dismissed-run"

function readDismissed(): number | null {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

function writeDismissed(runId: number) {
  try {
    localStorage.setItem(DISMISSED_KEY, String(runId))
  } catch {
    // Private window or blocked storage: it is dismissed for this visit only.
  }
}

/** A cohort or term picked from a row of segments; picking the chosen one clears it. */
function Segments({
  items,
  value,
  onPick,
  label,
}: {
  items: string[]
  value?: string
  onPick: (value: string) => void
  label: string
}) {
  return (
    <div className="flex gap-0.5 rounded-[10px] bg-sidebar/5 p-[3px]" role="group" aria-label={label}>
      {items.map((item) => {
        const chosen = item === value
        return (
          <button
            key={item}
            type="button"
            aria-pressed={chosen}
            title={chosen ? `Clear the ${label.toLowerCase()}` : undefined}
            onClick={() => onPick(chosen ? "__clear__" : item)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
              chosen
                ? "bg-white text-sidebar shadow-[0_2px_6px_rgb(75_63_214/0.16)]"
                : "text-muted-foreground hover:text-sidebar"
            }`}
          >
            {ordinal(item)}
          </button>
        )
      })}
    </div>
  )
}

/** One dropdown of the scope bar: a small label over the chosen value. */
function ScopeSelect({
  placeholder,
  noun,
  items,
  value,
  onPick,
  disabled,
  format,
}: {
  placeholder: string
  // How the choice reads in a sentence ("Choose an LGA", "Any school").
  noun: string
  items: string[]
  value?: string
  onPick: (value: string) => void
  disabled?: boolean
  format?: (value: string) => string
}) {
  return (
    <Select
      value={value ?? null}
      onValueChange={(next) => next !== null && onPick(next)}
      disabled={disabled || items.length === 0}
    >
      <SelectTrigger
        aria-label={placeholder}
        className="h-[30px] w-full min-w-0 gap-2 border-0 bg-transparent px-0 text-[13.5px] font-semibold text-sidebar-accent-foreground shadow-none focus-visible:ring-0 data-[placeholder]:font-medium data-[placeholder]:text-muted-foreground"
      >
        <SelectValue placeholder={`Choose ${noun}`}>
          {value ? (format ? format(value) : value) : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__clear__" className="text-muted-foreground">
          Any {noun}
        </SelectItem>
        {items.map((item) => (
          <SelectItem key={item} value={item}>
            {format ? format(item) : item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ScopeLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
      {children}
    </div>
  )
}

function Toggle({ label, on, disabled, onToggle }: { label: string; on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-sidebar-accent-foreground hover:bg-sidebar/5 disabled:opacity-60"
    >
      {label}
      <span
        className={`relative ml-auto inline-flex h-[21px] w-9 shrink-0 rounded-full transition ${on ? "bg-emerald-600" : "bg-muted-foreground/30"}`}
      >
        <span
          className={`absolute top-[2.5px] size-4 rounded-full bg-white shadow transition-all ${on ? "left-[17.5px]" : "left-[2.5px]"}`}
        />
      </span>
    </button>
  )
}

/** The redesigned Payments page (switched on for everyone in Settings > Display). */
export function NewPaymentsPage() {
  useLogVisit("Payments", "Visited Payments")
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { can, isSuperuser } = useAuth()
  const canManageNoObjection = can("no_objection")
  const { filters, setFilter, scope, options } = useAttendanceFilters()
  const { params: scopeParams, ready: scopeReady } = scope(PAYMENT_FILTERS)

  const [searchText, setSearchText] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [tab, setTab] = useState<RowStatus | "all">("all")
  const [menuOpen, setMenuOpen] = useState(false)
  const [dismissedRun, setDismissedRun] = useState<number | null>(readDismissed)
  // Runs this visit has watched in progress: only those end in the outcome card.
  const [watchedRuns, setWatchedRuns] = useState<number[]>([])
  const { page, setPage, pageSize, handleRowsChange } = usePagination([appliedSearch, filters], 1000)

  const { data: cohorts } = useQuery({ queryKey: ["cohort"], queryFn: getCohorts })
  // The payment guard: each student is paid the selected term's amount on
  // Settings › Payments; a term not opened there can't be paid.
  const { data: payableTerms } = useQuery({ queryKey: ["payable-terms"], queryFn: getPayableTerms })
  const openTerm = findPayableTerm(payableTerms, scopeParams.cohort, scopeParams.year, scopeParams.term)
  // Cohorts read 1st, 2nd, 3rd left to right, whatever order they were made in.
  const cohortOptions = [...options.cohorts].sort(
    (first, second) => Number(first) - Number(second) || first.localeCompare(second),
  )
  const cohortPayee: Payee =
    cohorts?.find((cohort) => cohort.id === scopeParams.cohort)?.payee ?? "caregiver"

  const settings = useQuery({ queryKey: ["disbursement-settings"], queryFn: getDisbursementSettings })
  const toggle = useMutation({
    mutationFn: (changes: Partial<Pick<DisbursementSettings, "enabled" | "poll_logging">>) =>
      setDisbursementSettings(changes),
    onSuccess: (result) => {
      queryClient.setQueryData(["disbursement-settings"], result)
      queryClient.invalidateQueries({ queryKey: ["payment-audit"] })
    },
  })
  const disbursementsOn = settings.data?.enabled ?? true

  // The last school disbursed: followed while it moves money.
  const current = useQuery({
    queryKey: ["disbursement-current"],
    queryFn: getCurrentDisbursement,
    refetchInterval: (query) => (runInProgress(query.state.data?.run) ? 5000 : 60000),
    refetchIntervalInBackground: true,
  })
  const run = current.data?.run ?? null
  const running = runInProgress(run)
  if (run && running && !watchedRuns.includes(run.id)) setWatchedRuns((ids) => [...ids, run.id])
  const runIsHere = Boolean(
    run &&
      scopeParams.school &&
      run.school === scopeParams.school &&
      String(run.year) === scopeParams.year &&
      String(run.term) === scopeParams.term,
  )

  // Each school of the LGA with where its payout is, for the school picker.
  const payoutScope =
    scopeReady && scopeParams.cohort && scopeParams.lga && scopeParams.year && scopeParams.term
      ? { cohort: scopeParams.cohort, lga: scopeParams.lga, year: scopeParams.year, term: scopeParams.term }
      : null
  const schoolPayouts = useQuery({
    queryKey: ["school-payouts", payoutScope],
    queryFn: () => getSchoolPayouts(payoutScope as NonNullable<typeof payoutScope>),
    enabled: payoutScope !== null,
    refetchInterval: running ? 15000 : false,
  })

  // The No Objection list for the term: created or deleted from More.
  const [noObjectionOpen, setNoObjectionOpen] = useState(false)
  const noObjectionReady = Boolean(scopeParams.cohort && scopeParams.year && scopeParams.term)
  const noObjection = useQuery({
    queryKey: ["no-objection-status", scopeParams.cohort, scopeParams.year, scopeParams.term],
    queryFn: () =>
      getNoObjectionStatus({ cohort: scopeParams.cohort, year: scopeParams.year, term: scopeParams.term }),
    enabled: canManageNoObjection && noObjectionReady,
  })
  const noObjectionExists = noObjection.data?.exists ?? false

  const { data, isError, isLoading } = useQuery({
    queryKey: ["term-averages", scopeParams, appliedSearch, page, pageSize],
    queryFn: () =>
      getTermAverages({
        ...scopeParams,
        ...(appliedSearch && { name: appliedSearch }),
        graduated: "false", // graduated students are not paid
        qualifying: "true", // only students who qualify in the filtered scope
        page,
        page_size: pageSize,
      }),
    enabled: scopeReady,
    placeholderData: keepPreviousData,
    // Follow the statuses while money is moving, so rows change on their own.
    refetchInterval: (query) => {
      const rows = query.state.data?.results ?? []
      const inFlight = rows.some((record) =>
        (record.payments ?? []).some(
          (payment) =>
            !payment.disbursed &&
            ["pending", "sending", "submitted", "processing", "unknown"].includes(
              payment.disbursement_status ?? "",
            ),
        ),
      )
      return inFlight || running ? 5000 : false
    },
    refetchIntervalInBackground: true,
  })

  const refreshStatuses = useMutation({
    mutationFn: pollPendingDisbursements,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["term-averages"] })
      queryClient.invalidateQueries({ queryKey: ["disbursement-current"] })
    },
  })

  const records = data?.results ?? []
  const totalCount = data?.count ?? 0
  const totalPages = data ? Math.ceil(totalCount / pageSize) : 0
  const summary = data?.summary
  const termSelected = Boolean(filters.term)
  const selectedTerm = filters.term ? parseInt(filters.term, 10) : null

  const paymentFor = (record: PaymentRecord) =>
    selectedTerm
      ? record.payments?.find((payment) => payment.term === selectedTerm)
      : (record.payments?.find((payment) => payment.disbursed) ?? record.payments?.[0])

  const statusOf = (record: PaymentRecord): RowStatus => {
    const payment = paymentFor(record)
    const status = payment?.disbursement_status
    if (payment?.disbursed || status === "successful") return "paid"
    if (status === "failed" || status === "failed_retryable") return "failed"
    if (status === "unknown") return "unknown"
    if (status === "awaiting_bank") return "awaiting_bank"
    if (status === "sending" || status === "submitted" || status === "processing") return "in_flight"
    // Not at the bank yet: queued while this school's payout is going out.
    return running && runIsHere ? "queued" : "not_sent"
  }

  const statuses = new Map(records.map((record) => [record.id, statusOf(record)]))
  const counts = Object.fromEntries(
    TAB_ORDER.map((status) => [status, records.filter((record) => statuses.get(record.id) === status).length]),
  ) as Record<RowStatus, number>
  const tabs = TAB_ORDER.filter((status) => counts[status] > 0 || ALWAYS_SHOWN.includes(status))
  const activeTab = tab === "all" || tabs.includes(tab) ? tab : "all"
  const shownRecords =
    activeTab === "all" ? records : records.filter((record) => statuses.get(record.id) === activeTab)
  const wholeScopeLoaded = records.length >= totalCount

  const listScope = summary?.scope
  const emptyMessage =
    listScope?.eligible !== 0
      ? undefined
      : listScope.source === "no_objection"
        ? "None of the students in this selection are on the No Objection list."
        : "No student in this selection meets the attendance threshold for this year and term."

  // What Disburse would do here, in words on the button.
  const students = summary?.students ?? totalCount
  const successful = summary?.successful ?? 0
  // Only ever added to the strip: the school's progress reads the summary alone.
  const historic = useHistoricPayments(scopeParams, scopeReady)
  const failed = summary?.failed ?? 0
  const notPaid = Math.max(students - successful, 0)
  const disburseLabel = !disbursementsOn
    ? "Disbursements paused"
    : !termSelected || !scopeParams.school
      ? "Disburse"
      : notPaid === 0 && students > 0
        ? "Everyone here is paid"
        : failed > 0 && successful > 0 && notPaid === failed
          ? `Retry ${failed} failed`
          : `Disburse to ${notPaid.toLocaleString()} student${notPaid === 1 ? "" : "s"}`
  const disburseOff = !disbursementsOn || (termSelected && Boolean(scopeParams.school) && notPaid === 0 && students > 0)

  const lastRunText = run
    ? runIsHere
      ? `Last run here: ${shortWhen(run.finished_at ?? run.created_at)}`
      : `Last run: ${run.school_name}, ${shortWhen(run.finished_at ?? run.created_at)}`
    : null

  const showOutcome = Boolean(
    run && !running && runIsHere && watchedRuns.includes(run.id) && dismissedRun !== run.id,
  )

  const exportScope = {
    ...scopeParams,
    ...(appliedSearch && { name: appliedSearch }),
    graduated: "false",
    qualifying: "true",
  }
  const paymentsDownload = useColumnDownload(paymentsExport(exportScope), () => setMenuOpen(false))

  const openAuditTrail = () => {
    // Carry the page's scope across so the trail opens on the same term,
    // cohort and school.
    const params = new URLSearchParams()
    if (scopeParams.year) params.set("year", scopeParams.year)
    if (scopeParams.term) params.set("term", scopeParams.term)
    if (scopeParams.cohort) {
      params.set("cohort", String(scopeParams.cohort))
      const cohortName = cohorts?.find((cohort) => cohort.id === scopeParams.cohort)?.name
      if (cohortName) params.set("cohort_name", cohortName)
    }
    if (scopeParams.school) {
      params.set("school", String(scopeParams.school))
      if (filters.school) params.set("school_name", filters.school)
    }
    navigate({ pathname: "/payments/audit", search: params.toString() })
  }

  const statusPill = running
    ? { label: "Payout running", className: "bg-sidebar/10 text-sidebar" }
    : disbursementsOn
      ? { label: "Disbursements on", className: "bg-emerald-50 text-emerald-700" }
      : { label: "Disbursements paused", className: "bg-red-50 text-red-700" }

  const firstShown = totalCount === 0 ? 0 : (page - 1) * pageSize + 1

  return (
    <div className="space-y-3.5">
      {/* Scope bar: cohort, term, session, LGA, school (wraps on narrow screens) */}
      <div className="relative z-20 flex flex-wrap items-stretch rounded-2xl bg-white shadow-[0_4px_14px_rgb(75_63_214/0.06)]">
        <div className="shrink-0 px-4 pt-2.5 pb-3 pl-[18px]">
          <ScopeLabel>Cohort</ScopeLabel>
          <Segments
            label="Cohort"
            items={cohortOptions}
            value={filters.cohort}
            onPick={(value) => setFilter("cohort", value)}
          />
        </div>
        <div className="shrink-0 border-l border-border/40 px-4 pt-2.5 pb-3">
          <ScopeLabel>Term</ScopeLabel>
          <Segments
            label="Term"
            items={options.terms}
            value={filters.term}
            onPick={(value) => setFilter("term", value)}
          />
        </div>
        <div className="w-36 shrink-0 border-l border-border/40 px-4 pt-2.5 pb-3">
          <ScopeLabel>Session</ScopeLabel>
          <ScopeSelect
            placeholder="Session"
            noun="session"
            items={options.years}
            value={filters.year}
            format={formatAcademicYear}
            onPick={(value) => setFilter("year", value)}
          />
        </div>
        <div className="w-40 shrink-0 border-l border-border/40 px-4 pt-2.5 pb-3">
          <ScopeLabel>LGA</ScopeLabel>
          <ScopeSelect
            placeholder="LGA"
            noun="LGA"
            items={options.lgas}
            value={filters.lga}
            onPick={(value) => setFilter("lga", value)}
          />
        </div>
        <div className="min-w-64 flex-1 border-l border-border/40 px-4 pt-2.5 pb-3">
          <ScopeLabel>School</ScopeLabel>
          <SchoolPicker
            schools={options.schools}
            value={filters.school}
            disabled={!filters.lga}
            onPick={(value) => setFilter("school", value)}
            payouts={schoolPayouts.data?.schools}
            lga={filters.lga}
            noObjection={schoolPayouts.data?.source === "no_objection"}
            studentCount={scopeParams.school ? summary?.students : undefined}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-1">
        {canManageNoObjection && listScope?.source === "no_objection" && (
          <p className="flex items-center gap-2 text-xs text-sidebar">
            <Info className="size-4 shrink-0" />
            No Objection list active
          </p>
        )}
        <span
          className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusPill.className}`}
        >
          <span className="size-[7px] rounded-full bg-current" />
          {statusPill.label}
        </span>
      </div>

      <HistoricPanel kind="payment" scope={scopeParams} ready={scopeReady} />

      {/* Stat strip */}
      <div className="grid grid-cols-2 rounded-2xl bg-white shadow-[0_4px_14px_rgb(75_63_214/0.06)] md:grid-cols-4">
        {[
          { label: "Students", value: students.toLocaleString(), className: "text-sidebar-accent-foreground" },
          {
            label: "Successful",
            value: (successful + historic.payments).toLocaleString(),
            note: includesHistoric(undefined, historic.payments),
            className: "text-emerald-700",
          },
          { label: "Failed", value: failed.toLocaleString(), className: "text-orange-600" },
          {
            label: "Total disbursed",
            value: formatNaira(Number(summary?.total_amount ?? 0) + historic.amount),
            note: includesHistoric(undefined, historic.amount, formatNaira(historic.amount)),
            className: "text-sidebar-accent-foreground",
          },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={`px-5 py-3 ${index > 0 ? "border-l border-border/40" : ""} ${index === 2 ? "max-md:border-l-0 max-md:border-t" : ""} ${index === 3 ? "max-md:border-t" : ""}`}
          >
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className={`text-xl font-bold ${stat.className} ${isLoading ? "opacity-40" : ""}`}>
              {stat.value}
            </div>
            {stat.note && <div className="text-[11px] text-muted-foreground">{stat.note}</div>}
          </div>
        ))}
      </div>

      {/* Action bar, the live tracker while money moves, or the outcome once */}
      {run && running ? (
        <PayoutTracker
          run={run}
          otherSchool={!runIsHere}
          onSelect={() => selectRun(run)}
          onRefresh={can("disburse") ? () => refreshStatuses.mutate() : undefined}
          refreshing={refreshStatuses.isPending}
        />
      ) : run && showOutcome ? (
        <PayoutOutcome
          run={run}
          onReviewFailed={() => setTab("failed")}
          onDismiss={() => {
            writeDismissed(run.id)
            setDismissedRun(run.id)
          }}
        />
      ) : (
        <div className="relative z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-white py-3 pr-3.5 pl-[18px] shadow-[0_4px_14px_rgb(75_63_214/0.06)]">
          <span className="whitespace-nowrap text-[13px] text-muted-foreground">Amount per student</span>
          <span
            className="flex h-10 items-center rounded-xl border border-border/60 bg-white px-3 text-sm font-semibold text-sidebar-accent-foreground"
            title="Set per cohort, year and term on Settings › Payments"
          >
            {openTerm
              ? openTerm.amount === null
                ? "Chosen at Disburse"
                : formatNaira(Number(openTerm.amount))
              : termSelected
                ? "Term not open for payment"
                : "Choose a term"}
          </span>
          <DisburseDialog
            cohort={scopeParams.cohort}
            year={scopeParams.year}
            term={scopeParams.term}
            school={scopeParams.school}
            lga={scopeParams.lga}
            scopeReady={scopeReady}
            name={appliedSearch || undefined}
            defaultPayee={cohortPayee}
            termLabel={termSelected ? `${ordinal(filters.term)} Term` : null}
            termSelected={termSelected}
            triggerDisabled={disburseOff}
            triggerLabel={
              <>
                <Send className="size-[18px]" />
                {disburseLabel}
              </>
            }
            triggerClassName="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-700 px-4 text-[13px] font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground/70"
          />
          {lastRunText && (
            <span className="min-w-0 break-words text-xs text-muted-foreground/80">{lastRunText}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {can("disburse") && (
              <button
                type="button"
                disabled={refreshStatuses.isPending}
                onClick={() => refreshStatuses.mutate()}
                title="Ask the bank for the latest status of transfers still in flight"
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl bg-sidebar/5 px-4 text-[13px] font-semibold text-sidebar hover:bg-sidebar/10 disabled:opacity-60"
              >
                <RefreshCw className={`size-[18px] ${refreshStatuses.isPending ? "animate-spin" : ""}`} />
                {refreshStatuses.isPending ? "Checking…" : "Refresh status"}
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold ${
                  menuOpen ? "bg-sidebar text-white" : "bg-sidebar/5 text-sidebar hover:bg-sidebar/10"
                }`}
              >
                <MoreHorizontal className="size-[18px]" />
                More
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close the menu"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute top-12 right-0 z-20 w-[268px] rounded-[14px] bg-white p-2 shadow-[0_18px_44px_rgb(33_29_82/0.18),0_2px_6px_rgb(33_29_82/0.08)]">
                    {can("reconciliation") && (
                      <button
                        type="button"
                        onClick={() => navigate("/payments/reconciliation")}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-sidebar-accent-foreground hover:bg-sidebar/5"
                      >
                        <FileCheck2 className="size-[18px] text-muted-foreground" />
                        Reconciliation
                      </button>
                    )}
                    {can("payment_audit") && (
                      <button
                        type="button"
                        onClick={openAuditTrail}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-sidebar-accent-foreground hover:bg-sidebar/5"
                      >
                        <History className="size-[18px] text-muted-foreground" />
                        Audit trail
                      </button>
                    )}
                    {canManageNoObjection && (
                      <button
                        type="button"
                        disabled={!noObjectionReady}
                        title={noObjectionReady ? undefined : "Choose a cohort, session and term first"}
                        onClick={() => {
                          setMenuOpen(false)
                          setNoObjectionOpen(true)
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] hover:bg-sidebar/5 disabled:cursor-not-allowed disabled:opacity-50 ${
                          noObjectionExists ? "text-red-600" : "text-sidebar-accent-foreground"
                        }`}
                      >
                        {noObjectionExists ? (
                          <ShieldX className="size-[18px] text-red-600" />
                        ) : (
                          <ShieldCheck className="size-[18px] text-muted-foreground" />
                        )}
                        {noObjectionExists ? "Delete No Objection" : "Create No Objection"}
                      </button>
                    )}
                    <button
                      type="button"
                      {...paymentsDownload.press}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-sidebar-accent-foreground hover:bg-sidebar/5"
                    >
                      <Download className="size-[18px] text-muted-foreground" />
                      Download data
                    </button>
                    <DownloadPdfButton
                      path="/student/payments-pdf/"
                      params={{ ...scopeParams, ...(appliedSearch && { name: appliedSearch }) }}
                      filename="Payments.pdf"
                      label="Download report"
                      missing={
                        scopeParams.cohort && scopeParams.year && scopeParams.term
                          ? null
                          : "Choose a cohort, session and term first"
                      }
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-sidebar-accent-foreground hover:bg-sidebar/5 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:text-muted-foreground"
                    />
                    {settings.data && (isSuperuser || settings.data.poll_logging) && (
                      <>
                        <div className="mx-1 my-1.5 h-px bg-border/40" />
                        <div className="px-2.5 pt-1.5 pb-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                          Controls
                        </div>
                        {isSuperuser ? (
                          <>
                            <Toggle
                              label="Disbursements"
                              on={settings.data.enabled}
                              disabled={toggle.isPending}
                              onToggle={() => toggle.mutate({ enabled: !settings.data?.enabled })}
                            />
                            <Toggle
                              label="Log status checks"
                              on={settings.data.poll_logging}
                              disabled={toggle.isPending}
                              onToggle={() => toggle.mutate({ poll_logging: !settings.data?.poll_logging })}
                            />
                          </>
                        ) : (
                          <p className="px-2.5 py-2 text-xs text-muted-foreground">
                            Every bank status check is being recorded in the audit trail.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {canManageNoObjection && (
        <NoObjectionDialog
          cohort={scopeParams.cohort}
          cohortName={cohorts?.find((cohort) => cohort.id === scopeParams.cohort)?.name}
          year={scopeParams.year}
          term={scopeParams.term}
          open={noObjectionOpen}
          onOpenChange={setNoObjectionOpen}
        />
      )}

      {isError && <QueryError />}

      {/* Table card */}
      <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_4px_14px_rgb(75_63_214/0.06)]">
        <div className="flex flex-wrap items-center gap-1 border-b border-border/40 px-3.5 py-2.5">
          {[
            { key: "all" as RowStatus | "all", label: "All", count: wholeScopeLoaded ? records.length : totalCount },
            ...tabs.map((status) => ({ key: status as RowStatus | "all", label: TAB_LABEL[status], count: counts[status] })),
          ].map((item) => {
              const chosen = item.key === activeTab
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => setTab(item.key)}
                  className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] ${
                    chosen ? "bg-sidebar/10 font-semibold text-sidebar" : "font-medium text-muted-foreground hover:text-sidebar"
                  }`}
                >
                  {item.label}
                  <span
                    className={`rounded-full px-[7px] py-px text-[11px] font-bold ${
                      chosen ? "bg-sidebar text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.count.toLocaleString()}
                  </span>
                </button>
              )
            })}
          <div className="ml-auto flex items-center gap-2">
            <label className="flex h-[38px] w-full items-center gap-2 rounded-[11px] border border-border/60 px-3 sm:w-[250px]">
              <Search className="size-[18px] shrink-0 text-muted-foreground/70" />
              <input
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value)
                  if (!event.target.value) setAppliedSearch("")
                }}
                onKeyDown={(event) => event.key === "Enter" && setAppliedSearch(searchText.trim())}
                placeholder="Search name or beneficiary ID"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              />
            </label>
            <button
              type="button"
              aria-label="Download data"
              {...paymentsDownload.press}
              className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] bg-sidebar/5 text-sidebar hover:bg-sidebar/10"
            >
              <Download className="size-[18px]" />
            </button>
            {paymentsDownload.dialog}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                {["Student", "Bank details", "Caregiver", "Attendance"].map((heading) => (
                  <TableHead
                    key={heading}
                    className="px-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70"
                  >
                    {heading}
                  </TableHead>
                ))}
                <TableHead className="px-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                  Amount
                </TableHead>
                <TableHead className="px-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                  Status
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeletonRows columns={7} />
              ) : shownRecords.length === 0 ? (
                <TableEmptyState
                  colSpan={7}
                  message={activeTab === "all" ? emptyMessage : "No students in this view."}
                />
              ) : (
                shownRecords.map((record) => {
                  const payment = paymentFor(record)
                  const badge = paymentStatusBadge(payment)
                  const atBank = termSelected ? payment?.disbursement_account_name : null
                  return (
                    <TableRow key={record.id} className="border-border/30">
                      <TableCell className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <StudentPhoto
                            url={record.photo_url}
                            name={record.name}
                            size="sm"
                            studentId={record.id}
                            hasPhoto={record.has_photo}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <StudentLink
                                studentId={record.id}
                                className="text-[13px] font-semibold text-sidebar-accent-foreground"
                              >
                                {record.name}
                              </StudentLink>
                              {record.open_case && (
                                <button
                                  type="button"
                                  title="A case-management case is open for this student"
                                  onClick={() => navigate(`/cases/${record.id}`)}
                                  className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 hover:bg-amber-200"
                                >
                                  CASE
                                </button>
                              )}
                            </div>
                            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                              {[record.current_class, filters.year].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-[13px] text-sidebar-accent-foreground">
                        <div>{record.account_number || "—"}</div>
                        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {record.bank_name ?? "—"}
                          {record.bank_code ? (
                            ` · ${record.bank_code}`
                          ) : record.bank_name ? (
                            <span
                              className="font-semibold text-red-600"
                              title={`"${record.bank_name}" is not a bank Zenith recognises — correct the bank name to pay this student`}
                            >
                              {" "}
                              · UNKNOWN BANK
                            </span>
                          ) : null}
                        </div>
                        {(record.bank_account_name || atBank) && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {record.bank_account_name}
                            {atBank && (
                              <span
                                className="block text-sidebar"
                                title="The account holder's name the bank resolved, from the bank statement"
                              >
                                At bank: {atBank}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-[13px] text-sidebar-accent-foreground">
                        <div>{record.caregiver_name ?? "—"}</div>
                        <div className="mt-0.5 text-[11.5px] text-muted-foreground">{record.caregiver_phone ?? ""}</div>
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5">
                        {selectedTerm ? (
                          <PercentageBadge
                            value={
                              selectedTerm === 1 ? record.term_1 : selectedTerm === 2 ? record.term_2 : record.term_3
                            }
                            scIns={record.sc_ins_terms?.includes(selectedTerm)}
                            label={record.sc_ins_labels?.[String(selectedTerm)]}
                          />
                        ) : (
                          <PercentageBadge value={record.average} />
                        )}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-right text-[13px] font-semibold text-sidebar-accent-foreground">
                        {payment && parseFloat(payment.amount_received) > 0
                          ? formatNaira(parseFloat(payment.amount_received))
                          : "—"}
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5">
                        {/* The same badge as the current page: the bank's own
                            status word, one colour per stage. */}
                        <StatusBadge
                          variant={badge.variant}
                          label={badge.label}
                          title={payment?.disbursement_reason ?? undefined}
                        />
                        {statuses.get(record.id) === "failed" && payment?.disbursement_reason && (
                          <div className="mt-0.5 max-w-56 truncate text-[11.5px] text-red-600" title={payment.disbursement_reason}>
                            {payment.disbursement_reason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="w-10 px-3.5 py-2.5">
                        <StudentLink studentId={record.id} className="flex text-muted-foreground/40">
                          <ChevronRight className="size-4" />
                        </StudentLink>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-border/40 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {totalCount === 0
              ? "Nothing to show"
              : `Showing ${firstShown.toLocaleString()} to ${(firstShown + records.length - 1).toLocaleString()} of ${totalCount.toLocaleString()}`}
            {!wholeScopeLoaded && " · tab counts are for this page"}
          </span>
          <span className="ml-auto">Rows</span>
          <Select value={String(pageSize)} onValueChange={handleRowsChange}>
            <SelectTrigger className="h-7 w-auto rounded-lg border-border/60 px-2.5 text-xs font-semibold text-sidebar-accent-foreground shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["100", "300", "500", "1000"].map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {totalPages > 1 && (
            <div className="flex max-w-full items-center gap-0.5 overflow-x-auto">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => setPage(number)}
                  className={`rounded-lg px-2.5 py-1 ${
                    number === page ? "bg-sidebar font-semibold text-white" : "text-sidebar-accent-foreground hover:bg-sidebar/5"
                  }`}
                >
                  {number}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
