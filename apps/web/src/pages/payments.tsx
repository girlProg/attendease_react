import { useState } from "react"
import { Plus, Download } from "lucide-react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"

import { useLogVisit } from "@/hooks/use-log-visit"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useAttendanceFilters } from "@/hooks/use-attendance-filters"
import { usePagination } from "@/hooks/use-pagination"
import { getTermAverages, getCohorts } from "@/api/attendance"
import { formatNaira, getTermLabel } from "@/lib/formatters"
import type { Payee } from "@/types"

export function PaymentsPage() {
  useLogVisit("Payments", "Visited Payments")
  const { filters, setFilter, selectedIds, options } = useAttendanceFilters()

  const [appliedSearch, setAppliedSearch] = useState("")
  const [amountPerStudent, setAmountPerStudent] = useState("")
  const { page, setPage, pageSize, handleRowsChange } = usePagination([appliedSearch, filters], 300)

  // Payee defaults to the selected cohort's setting (Niger=student, Kaduna=
  // caregiver) and can be overridden per disbursement. The override is keyed to
  // the cohort so switching cohorts falls back to that cohort's default.
  const { data: cohorts } = useQuery({ queryKey: ["cohort"], queryFn: getCohorts })
  const cohortPayee: Payee =
    cohorts?.find((cohort) => cohort.id === selectedIds.cohort)?.payee ?? "caregiver"
  const [payeeChoice, setPayeeChoice] = useState<{ cohortId?: number; value: Payee } | null>(null)
  const payee: Payee =
    payeeChoice && payeeChoice.cohortId === selectedIds.cohort
      ? payeeChoice.value
      : cohortPayee

  const { data, isError } = useQuery({
    queryKey: ["term-averages", filters.year, selectedIds.school, selectedIds.cohort, filters.term, appliedSearch, page, pageSize],
    queryFn: () => getTermAverages({
      ...(filters.year && { year: filters.year }),
      ...(selectedIds.school && { school: selectedIds.school }),
      ...(selectedIds.cohort && { cohort: selectedIds.cohort }),
      ...(filters.term && { term: filters.term }),
      ...(appliedSearch && { name: appliedSearch }),
      graduated: "false",  // graduated students are not paid
      page,
      page_size: pageSize,
    }),
    placeholderData: keepPreviousData,
  })

  const records = data?.results ?? []
  const totalCount = data?.count ?? 0
  const totalPages = data ? Math.ceil(totalCount / pageSize) : 0
  const termSelected = !!filters.term
  const selectedTerm = filters.term ? parseInt(filters.term, 10) : null
  const awaitingCount = records.filter((record) => {
    if (!selectedTerm) return !record.payments?.length
    return !record.payments?.find((payment) => payment.term === selectedTerm)
  }).length

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="space-y-4 rounded-2xl border border-border/40 bg-white p-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Number of Students: <span className="font-bold">{totalCount.toLocaleString()}</span></p>
          <p className="text-sm font-semibold text-foreground">Number of Successful Disbursements: <span className="font-bold">{(records.length - awaitingCount).toLocaleString()}</span></p>
          <p className="text-sm font-semibold text-foreground">Number of Failed Disbursements: <span className="font-bold">0</span></p>
          <p className="text-sm font-semibold text-foreground">Number of Awaiting/Ineligible Disbursements: <span className="font-bold">{awaitingCount.toLocaleString()}</span></p>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">Total Amount Debited: {formatNaira(0)}</p>
          <p className="text-sm font-bold text-foreground">Total Amount Disbursed: {formatNaira(0)}</p>
          <p className="text-sm font-bold text-foreground">Total Pending Credit: {formatNaira(0)}</p>
        </div>
      </div>

      {/* Filters */}
      <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} exclude={["week"]} />

      {/* Search + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBar onSearch={setAppliedSearch} />
        <Input
          placeholder="Amount Per Student"
          value={amountPerStudent}
          onChange={(event) => setAmountPerStudent(event.target.value)}
          className="h-11 w-52 rounded-full border-sidebar/30 !bg-white shadow-sm focus-visible:border-sidebar/30 focus-visible:ring-0"
        />
        <Select
          value={payee}
          onValueChange={(value) =>
            value &&
            setPayeeChoice({ cohortId: selectedIds.cohort, value: value as Payee })
          }
        >
          <SelectTrigger className="h-11 w-44 rounded-full border-sidebar/30 !bg-white px-4 shadow-sm">
            <SelectValue placeholder="Payee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Pay Student</SelectItem>
            <SelectItem value="caregiver">Pay Caregiver</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
        >
          <Plus className="size-4" />
          Disburse Payment
        </Button>
        <Button
          variant="outline"
          className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
        >
          <Download className="size-4" />
          Download Data
        </Button>
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
                {records.length === 0 ? (
                  <TableEmptyState colSpan={9} />
                ) : records.map((record, index) => (
                  <TableRow key={record.id} className="border-border/40">
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {(page - 1) * pageSize + index + 1}
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
                                <StatusBadge
                                  variant={payment?.disbursed ? "success" : "error"}
                                  label={payment?.disbursed ? "DISBURSED" : "NOT DISBURSED"}
                                />
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
