import { useState } from "react"
import { useNavigate } from "react-router-dom"
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
import { TableSkeletonRows } from "@/components/skeleton"
import { useAttendanceFilters } from "@/hooks/use-attendance-filters"
import { useLogVisit } from "@/hooks/use-log-visit"
import { usePagination } from "@/hooks/use-pagination"
import {
  getCases,
  openCase,
  setDroppedOut,
  exportCases,
  type CaseRow,
  type CaseStatus,
} from "@/api/cases"

const SECTIONS: { key: CaseStatus; label: string }[] = [
  { key: "flagged", label: "Flagged" },
  { key: "open", label: "Open cases" },
  { key: "treated", label: "Treated" },
  { key: "closed", label: "Closed" },
  { key: "dropped", label: "Dropped out" },
]

const SECTION_HINT: Record<CaseStatus, string> = {
  flagged: "Students below the qualifying line for their two most recent weeks. Critical = near-absent.",
  open: "Cases currently being managed. Open a student to add notes or mark them treated.",
  treated: "Resolved cases — the student resumed class. History is kept if they are flagged again.",
  closed: "Cases closed without treatment.",
  dropped: "Students marked dropped out — excluded from attendance averages and payments.",
}

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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { filters, setFilter, options, selectedIds } = useAttendanceFilters()
  const [view, setView] = useState<CaseStatus>("flagged")

  const caseFilters = {
    cohort: selectedIds.cohort,
    lga: selectedIds.lga,
    school: selectedIds.school,
    term: filters.term,
    year: filters.year,
    status: view,
  }
  const { page, setPage, pageSize, handleRowsChange } = usePagination([view, filters])

  const { data, isError, isLoading } = useQuery({
    queryKey: ["cases", view, page, pageSize, filters, selectedIds],
    queryFn: () => getCases(page, pageSize, caseFilters),
    placeholderData: keepPreviousData,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["cases"] })

  const open = useMutation({
    mutationFn: (id: number) => openCase(id),
    onSuccess: (_data, id) => {
      invalidate()
      navigate(`/cases/${id}`)
    },
  })
  const restore = useMutation({
    mutationFn: (id: number) => setDroppedOut(id, false),
    onSuccess: invalidate,
  })

  const rows = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0
  const busy = open.isPending || restore.isPending

  return (
    <div className="space-y-6">
      <AttendanceFilterBar
        filters={filters}
        setFilter={setFilter}
        options={options}
        exclude={["week"]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap items-center rounded-full border border-brand/40 bg-white p-1">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setView(s.key)}
              className={
                view === s.key
                  ? "rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {s.label}
            </button>
          ))}
        </div>

        {view === "flagged" && (
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

      <p className="text-xs text-muted-foreground">{SECTION_HINT[view]}</p>

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
              {view === "flagged" && (
                <TableHead className="text-xs font-semibold text-sidebar">Category</TableHead>
              )}
              <TableHead className="text-xs font-semibold text-sidebar">Name</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">LGA</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">School</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Caregiver</TableHead>
              {view === "flagged" && (
                <TableHead className="text-center text-xs font-semibold text-sidebar">
                  Two most recent weeks
                </TableHead>
              )}
              {(view === "open" || view === "treated" || view === "closed") && (
                <TableHead className="text-xs font-semibold text-sidebar">Case</TableHead>
              )}
              <TableHead className="text-right text-xs font-semibold text-sidebar">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={view === "flagged" ? 7 : 6} />
            ) : rows.length === 0 ? (
              <TableEmptyState colSpan={view === "flagged" ? 7 : 6} />
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer border-border/40 hover:bg-muted/20"
                  onClick={() => navigate(`/cases/${row.id}`)}
                >
                  {view === "flagged" && (
                    <TableCell>
                      <CategoryBadge row={row} />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StudentPhoto url={row.photo_url} name={row.name} />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-sidebar">{row.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {row.current_class || "—"}
                        </span>
                      </div>
                    </div>
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
                  {view === "flagged" && (
                    <TableCell className="text-center text-xs font-semibold text-sidebar">
                      {row.previous_week} ({row.previous_percent}%) → {row.recent_week} (
                      {row.recent_percent}%)
                    </TableCell>
                  )}
                  {(view === "open" || view === "treated" || view === "closed") && (
                    <TableCell className="text-xs text-muted-foreground">
                      {view === "open"
                        ? `Opened ${row.opened_at ? new Date(row.opened_at).toLocaleDateString() : "—"} · ${row.note_count ?? 0} note(s)`
                        : `Resolved ${row.resolved_at ? new Date(row.resolved_at).toLocaleDateString() : "—"}${row.resolved_by ? ` by ${row.resolved_by}` : ""}`}
                    </TableCell>
                  )}
                  <TableCell
                    className="text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {view === "flagged" && (
                      <Button
                        variant="outline"
                        className="h-8 rounded-full border-sidebar/40 !bg-white px-4 text-xs text-sidebar hover:bg-sidebar/5"
                        disabled={busy}
                        onClick={() => open.mutate(row.id)}
                      >
                        Open case
                      </Button>
                    )}
                    {view === "dropped" && (
                      <Button
                        variant="outline"
                        className="h-8 rounded-full border-sidebar/40 !bg-white px-4 text-xs text-sidebar hover:bg-sidebar/5"
                        disabled={busy}
                        onClick={() => restore.mutate(row.id)}
                      >
                        Restore
                      </Button>
                    )}
                    {(view === "open" || view === "treated" || view === "closed") && (
                      <Button
                        variant="outline"
                        className="h-8 rounded-full border-sidebar/40 !bg-white px-4 text-xs text-sidebar hover:bg-sidebar/5"
                        onClick={() => navigate(`/cases/${row.id}`)}
                      >
                        View
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
