import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, ChevronDown, ChevronRight, Download, X } from "lucide-react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { FilterSelect } from "@/components/filter-select"
import { PaginationBar } from "@/components/pagination-bar"
import { QueryError } from "@/components/query-error"
import { SearchBar } from "@/components/search-bar"
import { StatusBadge } from "@/components/status-badge"
import { TableEmptyState } from "@/components/table-empty-state"
import { useLogVisit } from "@/hooks/use-log-visit"
import { usePagination } from "@/hooks/use-pagination"
import {
  AUDIT_EVENT_LABELS,
  AUDIT_EVENT_TYPES,
  exportPaymentAudit,
  getPaymentAuditEvents,
  type AuditEventType,
  type AuditSource,
  type PaymentAuditEvent,
  type PaymentAuditFilters,
} from "@/api/payment-audit"
import { getTermLabel } from "@/lib/formatters"
import { transferStatusBadge } from "@/lib/payment-status"

const SOURCE_LABELS: Record<AuditSource, string> = {
  api: "User action",
  task: "Background poller",
  admin: "Django admin",
  migration: "Backfill",
}
const SOURCES = Object.keys(SOURCE_LABELS) as AuditSource[]

const COLUMN_COUNT = 9

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

// `<input type="date">` gives a local calendar day; send the bank-facing API
// the full day's span in UTC so the filter matches what the user sees.
function startOfDayIso(day: string) {
  return new Date(`${day}T00:00:00`).toISOString()
}
function endOfDayIso(day: string) {
  return new Date(`${day}T23:59:59.999`).toISOString()
}

// Statuses that are not transfer states (the disbursement switch records
// "enabled"/"disabled") are shown as plain text rather than a coloured badge.
const TRANSFER_STATUSES = new Set([
  "pending",
  "submitted",
  "processing",
  "successful",
  "failed",
  "failed_retryable",
  "unknown",
])

function StatusCell({ event }: { event: PaymentAuditEvent }) {
  const { previous_status: previous, new_status: next, bank_status: bankStatus } = event
  if (!previous && !next) return <span className="text-muted-foreground">—</span>
  if (!TRANSFER_STATUSES.has(next) && !TRANSFER_STATUSES.has(previous)) {
    return (
      <span className="text-xs text-foreground">
        {previous ? `${previous} → ` : ""}
        <span className="font-semibold">{next}</span>
      </span>
    )
  }
  const nextBadge = transferStatusBadge(next, bankStatus)
  if (!previous || previous === next) {
    return <StatusBadge variant={nextBadge.variant} label={nextBadge.label} />
  }
  const previousBadge = transferStatusBadge(previous)
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <StatusBadge variant={previousBadge.variant} label={previousBadge.label} />
      <span className="text-muted-foreground">→</span>
      <StatusBadge variant={nextBadge.variant} label={nextBadge.label} />
    </span>
  )
}

// A text filter that applies on Enter or when the field loses focus, so
// typing doesn't fire a request per keystroke. Parents pass `key={value}` so
// an outside change (the batch link in the table, Clear filters) remounts it
// with the new applied value.
function AppliedInput({
  placeholder,
  value,
  onApply,
  className = "",
}: {
  placeholder: string
  value: string
  onApply: (value: string) => void
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  return (
    <Input
      placeholder={placeholder}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onApply(draft.trim())}
      onKeyDown={(event) => event.key === "Enter" && onApply(draft.trim())}
      className={`h-11 rounded-full border-border/60 !bg-white px-4 shadow-sm focus-visible:border-sidebar/30 focus-visible:ring-0 ${className}`}
    />
  )
}

export function PaymentAuditPage() {
  useLogVisit("Payments", "Visited Payment Audit Trail")
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Scope carried over from the payments page's filter bar (all optional).
  const scope = {
    year: searchParams.get("year") ?? "",
    term: searchParams.get("term") ?? "",
    cohort: searchParams.get("cohort") ?? "",
    school: searchParams.get("school") ?? "",
    cohortName: searchParams.get("cohort_name") ?? "",
    schoolName: searchParams.get("school_name") ?? "",
  }
  const [scopeActive, setScopeActive] = useState(Boolean(scope.year || scope.term || scope.cohort || scope.school))

  const [eventType, setEventType] = useState<AuditEventType | "">("")
  const [source, setSource] = useState<AuditSource | "">("")
  const [actorName, setActorName] = useState("")
  const [batchReference, setBatchReference] = useState(searchParams.get("batch_reference") ?? "")
  const [search, setSearch] = useState("")
  const [afterDay, setAfterDay] = useState("")
  const [beforeDay, setBeforeDay] = useState("")
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const filters: PaymentAuditFilters = {
    event_type: eventType,
    source,
    actor_name: actorName,
    batch_reference: batchReference,
    search,
    ...(afterDay && { occurred_after: startOfDayIso(afterDay) }),
    ...(beforeDay && { occurred_before: endOfDayIso(beforeDay) }),
    ...(scopeActive && scope.year && { year: scope.year }),
    ...(scopeActive && scope.term && { term: scope.term }),
    ...(scopeActive && scope.cohort && { cohort: Number(scope.cohort) }),
    ...(scopeActive && scope.school && { school: Number(scope.school) }),
  }

  const { page, setPage, pageSize, handleRowsChange } = usePagination([filters], 50)

  const { data, isError, isFetching } = useQuery({
    queryKey: ["payment-audit", filters, page, pageSize],
    queryFn: () => getPaymentAuditEvents(filters, page, pageSize),
    placeholderData: keepPreviousData,
  })

  const records = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0
  const hasNarrowing = Boolean(eventType || source || actorName || batchReference || search || afterDay || beforeDay)

  const clearFilters = () => {
    setEventType("")
    setSource("")
    setActorName("")
    setBatchReference("")
    setSearch("")
    setAfterDay("")
    setBeforeDay("")
  }

  const scopeChips = [
    scope.year && `Year ${scope.year}`,
    scope.term && getTermLabel(scope.term),
    scope.cohort && (scope.cohortName || `Cohort #${scope.cohort}`),
    scope.school && (scope.schoolName || `School #${scope.school}`),
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-6">
      {/* Back + heading */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/payments")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-white hover:bg-foreground/90"
          title="Back to payments"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-foreground">Payment audit trail</h2>
          <p className="text-sm text-muted-foreground">
            Every action taken on payments — who did it, when, and what the bank said. Newest first.
          </p>
        </div>
      </div>

      {/* Scope carried over from the payments page */}
      {scopeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/40 bg-white px-4 py-3 text-sm">
          <span className="font-semibold text-sidebar">{scopeActive ? "Showing" : "Scope off:"}</span>
          {scopeChips.map((chip) => (
            <span
              key={chip}
              className={`rounded-full px-3 py-1 text-xs font-medium ${scopeActive ? "bg-sidebar/10 text-sidebar" : "bg-muted text-muted-foreground line-through"}`}
            >
              {chip}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setScopeActive((active) => !active)}
            className="ml-auto text-xs font-semibold text-sidebar underline-offset-2 hover:underline"
          >
            {scopeActive ? "Show all payments" : "Restore scope"}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          placeholder="Event"
          items={AUDIT_EVENT_TYPES}
          value={eventType || undefined}
          formatItem={(value) => AUDIT_EVENT_LABELS[value as AuditEventType]}
          onValueChange={(value) => setEventType(value && value !== "__clear__" ? (value as AuditEventType) : "")}
        />
        <FilterSelect
          placeholder="Source"
          items={SOURCES}
          value={source || undefined}
          formatItem={(value) => SOURCE_LABELS[value as AuditSource]}
          onValueChange={(value) => setSource(value && value !== "__clear__" ? (value as AuditSource) : "")}
        />
        <AppliedInput key={`actor:${actorName}`} placeholder="Actor (name or email)" value={actorName} onApply={setActorName} />
        <AppliedInput key={`batch:${batchReference}`} placeholder="Batch reference" value={batchReference} onApply={setBatchReference} />
        <Input
          type="date"
          value={afterDay}
          max={beforeDay || undefined}
          onChange={(event) => setAfterDay(event.target.value)}
          title="From date"
          className="h-11 rounded-full border-border/60 !bg-white px-4 shadow-sm focus-visible:border-sidebar/30 focus-visible:ring-0"
        />
        <Input
          type="date"
          value={beforeDay}
          min={afterDay || undefined}
          onChange={(event) => setBeforeDay(event.target.value)}
          title="To date"
          className="h-11 rounded-full border-border/60 !bg-white px-4 shadow-sm focus-visible:border-sidebar/30 focus-visible:ring-0"
        />
        <div className="md:col-span-2">
          <SearchBar placeholder="Find by student, transaction ref or batch" onSearch={setSearch} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {data ? `${data.count.toLocaleString()} event${data.count === 1 ? "" : "s"}` : "Loading…"}
            {isFetching && data ? " · refreshing" : ""}
          </span>
          {hasNarrowing && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-sidebar underline-offset-2 hover:underline"
            >
              <X className="size-3" />
              Clear filters
            </button>
          )}
        </div>
        <Button
          variant="outline"
          className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
          onClick={() => exportPaymentAudit(filters)}
          title="Download the events matching the current filters as CSV"
        >
          <Download className="size-4" />
          Download CSV
        </Button>
      </div>

      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        rowOptions={["25", "50", "100", "300"]}
        defaultRows={String(pageSize)}
        onRowsChange={handleRowsChange}
      />

      {isError && <QueryError />}

      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-8" />
              <TableHead className="text-xs font-semibold text-sidebar">Time</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Actor</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Event</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Student</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Batch</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Transaction ref</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Status</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableEmptyState colSpan={COLUMN_COUNT} message="No audit events match these filters." />
            ) : (
              records.map((event) => {
                const expanded = expandedId === event.id
                return (
                  <AuditRow
                    key={event.id}
                    event={event}
                    expanded={expanded}
                    onToggle={() => setExpandedId(expanded ? null : event.id)}
                    onBatchClick={() => setBatchReference(event.batch_reference)}
                  />
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function AuditRow({
  event,
  expanded,
  onToggle,
  onBatchClick,
}: {
  event: PaymentAuditEvent
  expanded: boolean
  onToggle: () => void
  onBatchClick: () => void
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight
  const isSystem = event.actor_name === null
  return (
    <>
      <TableRow className="border-border/40 align-top">
        <TableCell className="px-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            title={expanded ? "Hide details" : "Show details"}
          >
            <Chevron className="size-4" />
          </button>
        </TableCell>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatTimestamp(event.occurred_at)}</TableCell>
        <TableCell className="text-xs">
          <span className={isSystem ? "italic text-muted-foreground" : "font-semibold text-foreground"}>
            {event.actor_name ?? "System"}
          </span>
          <span className="block text-[11px] text-muted-foreground">{event.source_label}</span>
        </TableCell>
        <TableCell className="text-xs font-medium text-foreground">{event.event_type_label}</TableCell>
        <TableCell className="text-xs text-foreground">
          {event.student_name || <span className="text-muted-foreground">—</span>}
          {typeof event.details.beneficiary_id === "string" && event.details.beneficiary_id && (
            <span className="block text-[11px] text-muted-foreground">{event.details.beneficiary_id}</span>
          )}
        </TableCell>
        <TableCell className="text-xs">
          {event.batch_reference ? (
            <button
              type="button"
              onClick={onBatchClick}
              className="max-w-[16rem] truncate text-left font-mono text-[11px] text-sidebar underline-offset-2 hover:underline"
              title={`Show only events for ${event.batch_reference}`}
            >
              {event.batch_reference}
            </button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="font-mono text-[11px] text-muted-foreground">{event.transaction_ref || "—"}</TableCell>
        <TableCell>
          <StatusCell event={event} />
          {event.provider_code && (
            <span className="block pt-1 text-[11px] text-muted-foreground">code {event.provider_code}</span>
          )}
        </TableCell>
        <TableCell className="max-w-[24rem] text-xs text-muted-foreground">{event.description || "—"}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="border-border/40 bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={COLUMN_COUNT} className="px-6 py-3">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground">
              {JSON.stringify(event.details, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
