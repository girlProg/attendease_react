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
import { Chip } from "@/components/chip"
import { HistoricMarks } from "@/components/historic-records"
import { PaginationBar } from "@/components/pagination-bar"
import { SearchBar } from "@/components/search-bar"
import { TableSkeletonRows } from "@/components/skeleton"
import { useAuth } from "@/contexts/auth-context"
import type { FilterScope } from "@/hooks/use-attendance-filters"
import { usePagination } from "@/hooks/use-pagination"
import { formatNaira, roundUpPercent } from "@/lib/formatters"
import {
  historicAccount,
  historicAttendanceFigure,
  historicScope,
  historicTerm,
} from "@/lib/historic-format"
import {
  downloadHistoric,
  getHistoricAttendance,
  getHistoricPayments,
  getHistoricSummary,
  type HistoricAttendance,
  type HistoricKind,
  type HistoricParams,
  type HistoricPayment,
} from "@/api/historic"

const COLUMN_COUNT = 6
const heading = "text-xs font-semibold text-sidebar"
const cell = "text-xs text-muted-foreground"

function averageText(average: string | null | undefined): string {
  return `${roundUpPercent(Number(average ?? 0))}%`
}

function HistoricHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-sidebar">{title}</h3>
        <Chip tone="sky">Historic</Chip>
      </div>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

/** The files' records under a page's filters, marked Historic. Shows nothing when there are none. */
export function HistoricPanel({
  kind,
  scope,
  ready,
}: {
  kind: HistoricKind
  scope: FilterScope
  ready: boolean
}) {
  const { can } = useAuth()
  const allowed = kind === "attendance" || can("view_payments")
  const [open, setOpen] = useState(true)
  const [search, setSearch] = useState("")
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)
  const filters = historicScope(scope)
  const query: HistoricParams = {
    ...filters,
    ...(search && { name: search }),
    ...(unlinkedOnly && { linked: false }),
  }
  const { page, setPage, pageSize, handleRowsChange } = usePagination([kind, query], 10)
  const paged = { ...query, page, page_size: pageSize }
  const summary = useQuery({
    queryKey: ["historic-summary", kind, filters],
    queryFn: () => getHistoricSummary(kind, filters),
    enabled: ready && allowed,
  })
  const attendance = useQuery({
    queryKey: ["historic-attendance", paged],
    queryFn: () => getHistoricAttendance(paged),
    enabled: ready && open && kind === "attendance",
  })
  const payments = useQuery({
    queryKey: ["historic-payments", paged],
    queryFn: () => getHistoricPayments(paged),
    enabled: ready && open && allowed && kind === "payment",
  })
  const current = kind === "attendance" ? attendance : payments
  if (!summary.data?.records) return null

  const totalPages = current.data ? Math.ceil(current.data.count / pageSize) : 0
  const figures =
    kind === "attendance"
      ? `${summary.data.students.toLocaleString()} students · ${averageText(summary.data.average)} average`
      : `${summary.data.records.toLocaleString()} payments · ${formatNaira(Number(summary.data.amount ?? 0))}`

  return (
    <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HistoricHeading
          title={kind === "attendance" ? "Attendance" : "Payments"}
          note={`${figures}. From the programme's files before the MIS, as they were written. Not counted towards qualification or Disburse.`}
        />
        <Button
          variant="outline"
          className="h-9 rounded-full border-sidebar !bg-white px-4 text-sidebar hover:bg-sidebar/5"
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide records" : "Show records"}
        </Button>
      </div>
      {open && (
        <>
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
              onClick={() => downloadHistoric(kind, query)}
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
                  <TableHead>{kind === "attendance" ? "Attendance" : "Payment"}</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.isLoading && <TableSkeletonRows rows={5} columns={COLUMN_COUNT} />}
                {kind === "attendance"
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
                      No historic records match.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
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

/** Attendance per term: the records hold no weeks to shade. */
export function HistoricAttendanceByTerm({ scope, ready }: { scope: FilterScope; ready: boolean }) {
  const filters = historicScope(scope)
  const { data } = useQuery({
    queryKey: ["historic-summary", "attendance", filters],
    queryFn: () => getHistoricSummary("attendance", filters),
    enabled: ready,
  })
  if (!data?.records) return null

  return (
    <section className="space-y-3">
      <HistoricHeading title="Attendance by term" note="Whole terms from the programme's files before the MIS." />
      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table className="min-w-[420px]">
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className={heading}>Term</TableHead>
              <TableHead className={`text-center ${heading}`}>Students</TableHead>
              <TableHead className={`text-center ${heading}`}>Average</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.by_term.map((row) => (
              <TableRow key={`${row.year}-${row.term}`} className="border-border/40">
                <TableCell className="text-xs font-semibold text-foreground">{historicTerm(row)}</TableCell>
                <TableCell className={`text-center ${cell}`}>{row.students.toLocaleString()}</TableCell>
                <TableCell className={`text-center ${cell}`}>{averageText(row.average)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
