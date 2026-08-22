import { useState } from "react"
import { Download, Users, CheckCircle2, XCircle, Banknote, RefreshCw } from "lucide-react"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"

import { useLogVisit } from "@/hooks/use-log-visit"
import { useAuth } from "@/contexts/auth-context"
import { NoObjectionDialog } from "@/components/no-objection-dialog"
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
import { AttendanceFilterBar } from "@/components/attendance-filter-bar"
import { PercentageBadge } from "@/components/percentage-badge"
import { SearchBar } from "@/components/search-bar"
import { QueryError } from "@/components/query-error"
import { StatusBadge } from "@/components/status-badge"
import { StudentPhoto } from "@/components/student-photo"
import { TableEmptyState } from "@/components/table-empty-state"
import { PaginationBar } from "@/components/pagination-bar"
import { useAttendanceFilters } from "@/hooks/use-attendance-filters"
import { usePagination } from "@/hooks/use-pagination"
import { getTermAverages, getCohorts, exportPayments } from "@/api/attendance"
import { pollPendingDisbursements } from "@/api/payments"
import { DisburseDialog } from "@/components/disburse-dialog"
import { DisbursementSwitch } from "@/components/disbursement-switch"
import { formatNaira, getTermLabel } from "@/lib/formatters"
import type { Payee } from "@/types"

// Map a payment to its status badge. `disbursed` (bank-confirmed) wins; otherwise
// show the latest disbursement-transaction status *as-is* so each stage is
// distinguishable (pending vs submitted vs processing vs unknown vs failed),
// not all collapsed into one "pending".
function paymentStatusBadge(payment?: {
  disbursed: boolean
  disbursement_status?: string | null
}): { variant: "success" | "warning" | "error" | "info" | "neutral"; label: string } {
  if (payment?.disbursed || payment?.disbursement_status === "successful") {
    return { variant: "success", label: "DISBURSED" }
  }
  switch (payment?.disbursement_status) {
    case "pending":
      return { variant: "neutral", label: "PENDING" }
    case "submitted":
      return { variant: "info", label: "SUBMITTED" }
    case "processing":
      // Zenith's post-upload state is "awaiting approval" (mapped internally to
      // processing) — show the bank's own wording.
      return { variant: "warning", label: "AWAITING APPROVAL" }
    case "unknown":
      return { variant: "warning", label: "UNKNOWN" }
    case "failed":
      return { variant: "error", label: "FAILED" }
    case "failed_retryable":
      return { variant: "error", label: "FAILED (RETRYABLE)" }
    default:
      return { variant: "neutral", label: "NOT DISBURSED" }
  }
}

export function PaymentsPage() {
  useLogVisit("Payments", "Visited Payments")
  const { isSuperuser } = useAuth()
  const { filters, setFilter, selectedIds, options } = useAttendanceFilters()

  const [appliedSearch, setAppliedSearch] = useState("")
  const [amountPerStudent, setAmountPerStudent] = useState("")
  const { page, setPage, pageSize, handleRowsChange } = usePagination([appliedSearch, filters], 300)

  // Payee defaults to the selected cohort's setting (Niger=student, Kaduna=
  // caregiver) and can be overridden per disbursement. The override is keyed to
  // the cohort so switching cohorts falls back to that cohort's default.
  const { data: cohorts } = useQuery({ queryKey: ["cohort"], queryFn: getCohorts })
  // Default payee for the selected cohort (Niger=student, Kaduna=caregiver); the
  // Disburse dialog lets you override it per disbursement.
  const cohortPayee: Payee =
    cohorts?.find((cohort) => cohort.id === selectedIds.cohort)?.payee ?? "caregiver"

  const { data, isError } = useQuery({
    queryKey: ["term-averages", filters.year, selectedIds.school, selectedIds.cohort, filters.term, appliedSearch, page, pageSize],
    queryFn: () => getTermAverages({
      ...(filters.year && { year: filters.year }),
      ...(selectedIds.school && { school: selectedIds.school }),
      ...(selectedIds.cohort && { cohort: selectedIds.cohort }),
      ...(filters.term && { term: filters.term }),
      ...(appliedSearch && { name: appliedSearch }),
      graduated: "false",  // graduated students are not paid
      qualifying: "true",  // only students who qualify in the filtered scope
      page,
      page_size: pageSize,
    }),
    placeholderData: keepPreviousData,
    // Live-refresh while any disbursement is still in-flight so the status
    // badges advance on their own (SUBMITTED -> AWAITING APPROVAL -> DISBURSED)
    // without a manual reload. Stops polling once everything is terminal.
    refetchInterval: (query) => {
      const rows = query.state.data?.results ?? []
      const inFlight = rows.some((record) =>
        (record.payments ?? []).some(
          (payment) =>
            !payment.disbursed &&
            ["pending", "submitted", "processing", "unknown"].includes(
              payment.disbursement_status ?? "",
            ),
        ),
      )
      return inFlight ? 8000 : false
    },
  })

  // Manual "check now": force a bank status poll of all in-flight batches, then
  // refetch the list so the badges reflect the freshest state.
  const queryClient = useQueryClient()
  const refreshStatuses = useMutation({
    mutationFn: pollPendingDisbursements,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["term-averages"] })
    },
  })

  const records = data?.results ?? []
  const totalCount = data?.count ?? 0
  const totalPages = data ? Math.ceil(totalCount / pageSize) : 0
  const termSelected = !!filters.term
  const selectedTerm = filters.term ? parseInt(filters.term, 10) : null

  // "Successful" means an actually-disbursed payment exists; a merely-pending
  // payment (created by Generate Payments, not yet sent) still counts as awaiting.
  const isDisbursed = (record: (typeof records)[number]) =>
    selectedTerm
      ? (record.payments?.some((p) => p.term === selectedTerm && p.disbursed) ?? false)
      : (record.payments?.some((p) => p.disbursed) ?? false)
  const isAwaiting = (record: (typeof records)[number]) => !isDisbursed(record)
  const awaitingCount = records.filter(isAwaiting).length

  // Clicking a card filters the (loaded) student list to just those rows.
  const [activeCard, setActiveCard] = useState<string | null>(null)
  const displayedRecords =
    activeCard === "successful"
      ? records.filter((record) => !isAwaiting(record))
      : activeCard === "awaiting"
        ? records.filter(isAwaiting)
        : activeCard === "failed"
          ? []
          : records

  const stats = [
    {
      key: "all",
      label: "Number of Students",
      value: totalCount.toLocaleString(),
      icon: Users,
      color: "bg-sidebar",
    },
    {
      key: "successful",
      label: "Successful Disbursements",
      value: (records.length - awaitingCount).toLocaleString(),
      icon: CheckCircle2,
      color: "bg-[var(--stat-accent-2)]",
    },
    {
      key: "failed",
      label: "Failed Disbursements",
      value: "0",
      icon: XCircle,
      color: "bg-[var(--stat-accent-1)]",
    },
    {
      label: "Total Amount Disbursed",
      value: formatNaira(0),
      icon: Banknote,
      color: "bg-[var(--stat-accent-2)]",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Filters */}
      <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} exclude={["week"]} />

      {/* Summary Stats — clickable cards filter the list below */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const clickable = Boolean(stat.key)
          const active = clickable && activeCard === stat.key
          return (
            <button
              key={stat.label}
              type="button"
              disabled={!clickable}
              onClick={() =>
                clickable &&
                setActiveCard((current) => (current === stat.key ? null : (stat.key as string)))
              }
              className={`flex items-center gap-4 rounded-2xl border bg-white p-5 text-left transition ${
                active
                  ? "border-sidebar ring-2 ring-sidebar/40"
                  : "border-border/40"
              } ${clickable ? "cursor-pointer hover:border-sidebar/60" : "cursor-default"}`}
            >
              <div className={`flex size-12 shrink-0 items-center justify-center rounded-full ${stat.color} text-white`}>
                <stat.icon className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
              </div>
            </button>
          )
        })}
      </div>

      {activeCard && (
        <div className="flex items-center justify-between rounded-xl border border-sidebar/30 bg-sidebar/5 px-4 py-2 text-sm text-sidebar">
          <span>
            Showing <span className="font-semibold">{displayedRecords.length.toLocaleString()}</span>{" "}
            {activeCard === "successful"
              ? "successful"
              : activeCard === "awaiting"
                ? "awaiting / ineligible"
                : activeCard === "failed"
                  ? "failed"
                  : "student"}{" "}
            record(s) on this page.
          </span>
          <button
            type="button"
            onClick={() => setActiveCard(null)}
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Search + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBar onSearch={setAppliedSearch} />
        {/* Amount input with the Disburse button embedded inside it */}
        <div className="relative flex items-center">
          <Input
            placeholder="Amount Per Student"
            value={amountPerStudent}
            onChange={(event) => setAmountPerStudent(event.target.value)}
            className="h-11 w-64 rounded-full border-sidebar/30 !bg-white pr-32 shadow-sm focus-visible:border-sidebar/30 focus-visible:ring-0"
          />
          <DisburseDialog
            cohort={selectedIds.cohort}
            year={filters.year}
            term={filters.term}
            school={selectedIds.school}
            name={appliedSearch || undefined}
            amount={amountPerStudent}
            defaultPayee={cohortPayee}
            termLabel={termSelected ? getTermLabel(filters.term) : null}
            termSelected={termSelected}
            triggerLabel="Disburse"
            triggerClassName="absolute right-1.5 inline-flex h-8 w-28 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
          />
        </div>
        <Button
          variant="outline"
          className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
          onClick={() =>
            exportPayments({
              ...(filters.year && { year: filters.year }),
              ...(selectedIds.school && { school: selectedIds.school }),
              ...(selectedIds.cohort && { cohort: selectedIds.cohort }),
              ...(filters.term && { term: filters.term }),
              ...(appliedSearch && { name: appliedSearch }),
              graduated: "false",
              qualifying: "true",
            })
          }
        >
          <Download className="size-4" />
          Download Data
        </Button>
      </div>

      {/* Disbursement switch + Refresh Status + No Objection — centered on one row */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <DisbursementSwitch />
        <Button
          variant="outline"
          className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
          disabled={refreshStatuses.isPending}
          onClick={() => refreshStatuses.mutate()}
          title="Check the bank for the latest status of in-flight disbursements"
        >
          <RefreshCw className={`size-4 ${refreshStatuses.isPending ? "animate-spin" : ""}`} />
          {refreshStatuses.isPending ? "Checking…" : "Refresh Status"}
        </Button>
        {isSuperuser && (
          <NoObjectionDialog
            cohort={selectedIds.cohort}
            cohortName={cohorts?.find((cohort) => cohort.id === selectedIds.cohort)?.name}
            year={filters.year}
            term={filters.term}
          />
        )}
      </div>

      {/* Pagination */}
      <PaginationBar
            totalPages={totalPages}
            currentPage={page}
            onPageChange={setPage}
            rowOptions={["100", "300", "500", "1000"]}
            defaultRows={String(pageSize)}
            onRowsChange={handleRowsChange}
          />

          {isError && <QueryError />}

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-16 text-center text-xs font-semibold text-sidebar">S/N</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Name</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Class</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Year</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Account No.</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Bank Name</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Bank Code</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Name Of Caregiver</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Phone No. Of Caregiver</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Bank Account Name</TableHead>
                  {termSelected ? (
                    <>
                      <TableHead className="text-center text-xs font-semibold text-sidebar">{getTermLabel(filters.term)}</TableHead>
                      <TableHead className="text-center text-xs font-semibold text-sidebar">Amount(₦)</TableHead>
                      <TableHead className="text-center text-xs font-semibold text-sidebar">Status</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-center text-xs font-semibold text-sidebar">1st Term</TableHead>
                      <TableHead className="text-center text-xs font-semibold text-sidebar">2nd Term</TableHead>
                      <TableHead className="text-center text-xs font-semibold text-sidebar">3rd Term</TableHead>
                      <TableHead className="text-center text-xs font-semibold text-sidebar">Average</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedRecords.length === 0 ? (
                  <TableEmptyState colSpan={9} />
                ) : displayedRecords.map((record, index) => (
                  <TableRow key={record.id} className="border-border/40">
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {activeCard ? index + 1 : (page - 1) * pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StudentPhoto url={record.photo_url} name={record.name} size="sm" />
                        <span className="text-xs font-semibold text-foreground">{record.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.current_class}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{filters.year}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.account_no ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.bank_name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.bank_code ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.caregiver_name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.caregiver_phone ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.bank_account_name || "—"}</TableCell>
                    {termSelected ? (
                      <>
                        <TableCell className="text-center">
                          <PercentageBadge value={
                            filters.term === "1" ? record.term_1
                            : filters.term === "2" ? record.term_2
                            : record.term_3
                          } />
                        </TableCell>
                        {(() => {
                          const payment = record.payments?.find((payment) => payment.term === selectedTerm)
                          return (
                            <>
                              <TableCell className="text-center text-xs text-muted-foreground">
                                {payment ? formatNaira(parseFloat(payment.amount_received)) : "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                {(() => {
                                  const badge = paymentStatusBadge(payment)
                                  return <StatusBadge variant={badge.variant} label={badge.label} />
                                })()}
                              </TableCell>
                            </>
                          )
                        })()}
                      </>
                    ) : (
                      <>
                        <TableCell className="text-center"><PercentageBadge value={record.term_1} /></TableCell>
                        <TableCell className="text-center"><PercentageBadge value={record.term_2} /></TableCell>
                        <TableCell className="text-center"><PercentageBadge value={record.term_3} /></TableCell>
                        <TableCell className="text-center"><PercentageBadge value={record.average} /></TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
    </div>
  )
}
