import { useState } from "react"
import { Download, Phone } from "lucide-react"
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"

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
import { PaginationBar } from "@/components/pagination-bar"
import { QueryError } from "@/components/query-error"
import { StudentPhoto } from "@/components/student-photo"
import { TableEmptyState } from "@/components/table-empty-state"
import { useAttendanceFilters } from "@/hooks/use-attendance-filters"
import { useLogVisit } from "@/hooks/use-log-visit"
import { usePagination } from "@/hooks/use-pagination"
import { getCases, setDroppedOut, exportCases, type CaseRow } from "@/api/cases"

type View = "cases" | "dropped"

function CategoryBadge({ row }: { row: CaseRow }) {
  const critical = row.category === "critical"
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        critical ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {row.category_label ?? (critical ? "Critical" : "At risk")}
    </span>
  )
}

export function CaseManagementPage() {
  useLogVisit("Case Management", "Visited Case Management")
  const queryClient = useQueryClient()
  const { filters, setFilter, options, selectedIds } = useAttendanceFilters()
  const [view, setView] = useState<View>("cases")

  const caseFilters = {
    cohort: selectedIds.cohort,
    lga: selectedIds.lga,
    school: selectedIds.school,
    dropped: view === "dropped",
  }
  const { page, setPage, pageSize, handleRowsChange } = usePagination([view, filters])

  const { data, isError } = useQuery({
    queryKey: ["cases", view, page, pageSize, filters],
    queryFn: () => getCases(page, pageSize, caseFilters),
    placeholderData: keepPreviousData,
  })

  const mutation = useMutation({
    mutationFn: ({ id, dropped }: { id: number; dropped: boolean }) =>
      setDroppedOut(id, dropped),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] })
      queryClient.invalidateQueries({ queryKey: ["students"] })
      queryClient.invalidateQueries({ queryKey: ["students-summary"] })
    },
  })

  const rows = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0

  return (
    <div className="space-y-6">
      <AttendanceFilterBar
        filters={filters}
        setFilter={setFilter}
        options={options}
        exclude={["term", "year", "week"]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* View toggle */}
        <div className="inline-flex items-center rounded-full border border-brand/40 bg-white p-1">
          {(["cases", "dropped"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setView(tab)}
              className={
                view === tab
                  ? "rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white"
                  : "rounded-full px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {tab === "cases" ? "Flagged cases" : "Dropped out"}
            </button>
          ))}
        </div>

        {view === "cases" && (
          <Button
            variant="outline"
            className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
            onClick={() => exportCases(caseFilters)}
          >
            <Download className="size-4" />
            Download
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {view === "cases"
          ? "Students below the qualifying attendance line for their two most recent weeks. Critical = near-absent."
          : "Students marked dropped out — excluded from attendance averages and payments. Restore to include them again."}
      </p>

      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        defaultRows={String(pageSize)}
        onRowsChange={handleRowsChange}
      />

      {isError && <QueryError />}

      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              {view === "cases" && (
                <TableHead className="text-xs font-semibold text-sidebar">Category</TableHead>
              )}
              <TableHead className="text-xs font-semibold text-sidebar">Name</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Class</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">LGA</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">School</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Caregiver</TableHead>
              {view === "cases" && (
                <TableHead className="text-center text-xs font-semibold text-sidebar">
                  Last 2 weeks
                </TableHead>
              )}
              <TableHead className="text-right text-xs font-semibold text-sidebar">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmptyState colSpan={view === "cases" ? 7 : 6} />
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="border-border/40">
                  {view === "cases" && (
                    <TableCell>
                      <CategoryBadge row={row} />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StudentPhoto url={row.photo_url} name={row.name} />
                      <span className="text-xs font-semibold text-sidebar">{row.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.current_class || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.lga}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.school}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-full bg-sidebar/10">
                        <Phone className="size-3.5 text-sidebar" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        ({row.caregiver_phone}) {row.caregiver_name}
                      </span>
                    </div>
                  </TableCell>
                  {view === "cases" && (
                    <TableCell className="text-center text-xs font-semibold text-sidebar">
                      {row.week_previous}% → {row.week_recent}%
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {view === "cases" ? (
                      <Button
                        variant="outline"
                        className="h-8 rounded-full border-red-300 !bg-white px-4 text-xs text-red-600 hover:bg-red-50"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ id: row.id, dropped: true })}
                      >
                        Mark dropped out
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-8 rounded-full border-sidebar/40 !bg-white px-4 text-xs text-sidebar hover:bg-sidebar/5"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ id: row.id, dropped: false })}
                      >
                        Restore
                      </Button>
                    )}
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
