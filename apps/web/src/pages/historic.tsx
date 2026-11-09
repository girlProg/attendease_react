import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { AttendanceFilterBar } from "@/components/attendance-filter-bar"
import { HistoricMarks } from "@/components/historic-records"
import { PaginationBar } from "@/components/pagination-bar"
import { PillTabs } from "@/components/pill-tabs"
import { QueryError } from "@/components/query-error"
import { SearchBar } from "@/components/search-bar"
import { TableSkeletonRows } from "@/components/skeleton"
import { Chip } from "@/components/chip"
import { useAuth } from "@/contexts/auth-context"
import { useAttendanceFilters, type FilterKey } from "@/hooks/use-attendance-filters"
import { useLogVisit } from "@/hooks/use-log-visit"
import { usePagination } from "@/hooks/use-pagination"
import { formatNaira } from "@/lib/formatters"
import {
  historicAccount,
  historicAttendanceFigure,
  historicTerm,
} from "@/lib/historic-format"
import {
  downloadHistoric,
  getHistoricAttendance,
  getHistoricPayments,
  type HistoricAttendance,
  type HistoricParams,
  type HistoricPayment,
} from "@/api/historic"

type Tab = "attendance" | "payment"
const FILTERS: readonly FilterKey[] = ["cohort", "lga", "school"]
const COLUMN_COUNT = 6

/** Attendance and payments from the programme's files before the MIS. Read-only. */
export function HistoricPage() {
  useLogVisit("Historic", "Visited Historic Records")
  const { can } = useAuth()
  const { filters, setFilter, options, scope } = useAttendanceFilters()
  const [tab, setTab] = useState<Tab>("attendance")
  const [search, setSearch] = useState("")
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)
  const { params, ready } = scope(FILTERS)
  const query: HistoricParams = {
    ...params,
    ...(search && { name: search }),
    ...(unlinkedOnly && { linked: false }),
  }
  const { page, setPage, pageSize, handleRowsChange } = usePagination([tab, query])
  const paged = { ...query, page, page_size: pageSize }
  const attendance = useQuery({
    queryKey: ["historic-attendance", paged],
    queryFn: () => getHistoricAttendance(paged),
    enabled: ready && tab === "attendance",
  })
  const payments = useQuery({
    queryKey: ["historic-payments", paged],
    queryFn: () => getHistoricPayments(paged),
    enabled: ready && tab === "payment",
  })
  const current = tab === "attendance" ? attendance : payments
  const canSeePayments = can("view_payments")
  const totalPages = current.data ? Math.ceil(current.data.count / pageSize) : 0

  if (current.isError) return <QueryError />

  return (
    <div className="space-y-5">
      <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} keys={FILTERS} />
      {canSeePayments && (
        <PillTabs
          tabs={[
            { value: "attendance", label: "Attendance" },
            { value: "payment", label: "Payments" },
          ]}
          active={tab}
          onChange={setTab}
        />
      )}
      <p className="text-sm text-muted-foreground">
        Historic records from the programme's files before the MIS, as they were written. They
        show on each student's page where the student could be found with certainty, and don't
        count towards qualification or Disburse.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar onSearch={setSearch} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unlinkedOnly}
            onChange={(event) => setUnlinkedOnly(event.target.checked)}
          />
          Only records not linked to a student
        </label>
        <Button
          variant="outline"
          className="h-11 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
          disabled={!ready}
          onClick={() => downloadHistoric(tab, query)}
        >
          Download
        </Button>
      </div>
      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        defaultRows={String(pageSize)}
        onRowsChange={handleRowsChange}
      />
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Cohort</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>School then</TableHead>
              <TableHead>{tab === "attendance" ? "Attendance" : "Payment"}</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {current.isLoading && <TableSkeletonRows rows={5} columns={COLUMN_COUNT} />}
            {tab === "attendance"
              ? attendance.data?.results.map((row) => (
                  <Row key={row.id} row={row} detail={historicAttendanceFigure(row)} />
                ))
              : payments.data?.results.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    detail={formatNaira(Number(row.amount))}
                    subDetail={historicAccount(row)}
                  />
                ))}
            {current.data?.results.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-8 text-center text-muted-foreground">
                  No historic records here.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function Row({
  row,
  detail,
  subDetail,
}: {
  row: HistoricAttendance | HistoricPayment
  detail: string
  subDetail?: string
}) {
  return (
    <TableRow>
      <TableCell>
        {row.student ? (
          <Link to={`/beneficiaries/${row.student}`} className="font-medium text-brand hover:underline">
            {row.student_name}
          </Link>
        ) : (
          row.student_name
        )}
        <div className="text-xs text-muted-foreground">
          {row.beneficiary_id || <Chip>Not linked</Chip>}
        </div>
      </TableCell>
      <TableCell>{row.cohort_name}</TableCell>
      <TableCell className="whitespace-nowrap">{historicTerm(row)}</TableCell>
      <TableCell>
        <div>{row.school_name}</div>
        <div className="text-xs text-muted-foreground">{row.lga_name}</div>
      </TableCell>
      <TableCell>
        <div>{detail}</div>
        {subDetail && <div className="text-xs text-muted-foreground">{subDetail}</div>}
      </TableCell>
      <TableCell className="max-w-xs whitespace-normal">
        <HistoricMarks row={row} />
        {row.comment && <div className="mt-1 text-xs text-muted-foreground">{row.comment}</div>}
      </TableCell>
    </TableRow>
  )
}
