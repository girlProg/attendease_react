import { useState } from "react"
import { AlertCircle, ArrowLeft, Download, LayoutGrid } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { MeStatsCohortCard, MeStatsSummaryCards } from "@/components/me-stats-cohort-card"
import { MeStatsGrid, MeStatsLegend, MeStatsSummary } from "@/components/me-stats-table"
import { QueryError } from "@/components/query-error"
import { useColumnDownload } from "@/hooks/use-column-download"
import { useLogVisit } from "@/hooks/use-log-visit"
import { getMeStats, meStatsExport, type MeStatsRow } from "@/api/me-stats"

type View = { kind: "table" } | { kind: "summary" } | { kind: "row"; cohort: number; entryClass: string }

const VIEW_BUTTON =
  "h-11 shrink-0 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"

/**
 * How many of each cohort's entry class were paid in each year, and the class
 * they were in, until they graduate. Pressing a row opens its card. Read-only:
 * enrolment years and figures are set on Settings > M&E Stats.
 */
export function MeStatsPage() {
  useLogVisit("M&E Stats", "Visited M&E Stats")
  const { data, isError, isLoading } = useQuery({ queryKey: ["me-stats"], queryFn: getMeStats })
  const download = useColumnDownload(meStatsExport)
  const [view, setView] = useState<View>({ kind: "table" })

  if (isError) return <QueryError />

  const cohortsWithoutYear = (data?.cohorts ?? []).filter((cohort) => cohort.enrolment_year === null)
  const openRow = (row: MeStatsRow) =>
    setView({ kind: "row", cohort: row.cohort, entryClass: row.entry_class })
  const shownRow =
    view.kind === "row"
      ? data?.rows.find((row) => row.cohort === view.cohort && row.entry_class === view.entryClass)
      : undefined

  if (data && view.kind !== "table") {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className={VIEW_BUTTON} onClick={() => setView({ kind: "table" })}>
            <ArrowLeft className="size-4" />
            Back to table
          </Button>
          {view.kind === "row" && (
            <Button variant="outline" className={VIEW_BUTTON} onClick={() => setView({ kind: "summary" })}>
              <LayoutGrid className="size-4" />
              View entire summary
            </Button>
          )}
        </div>
        {view.kind === "summary" ? (
          <>
            <h2 className="text-2xl font-bold text-foreground">Cohorts</h2>
            <MeStatsSummaryCards data={data} onOpen={openRow} />
          </>
        ) : (
          shownRow && <MeStatsCohortCard row={shownRow} thisYear={data.this_year} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Cohort payments by year</h2>
          {data && <MeStatsSummary data={data} />}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <MeStatsLegend />
          <Button variant="outline" className={VIEW_BUTTON} {...download.press}>
            <Download className="size-4" />
            Download
          </Button>
          {download.dialog}
        </div>
      </div>

      {cohortsWithoutYear.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          <AlertCircle className="size-4 shrink-0" />
          No enrolment year set: {cohortsWithoutYear.map((cohort) => cohort.title).join(", ")}.
        </p>
      )}

      {data && data.students_without_a_class > 0 && (
        <p className="text-xs text-muted-foreground">
          {data.students_without_a_class.toLocaleString()} students with no class at enrolment are
          not shown.
        </p>
      )}

      <MeStatsGrid data={data} isLoading={isLoading} onOpen={openRow} />

      <p className="text-xs text-muted-foreground">
        Historic: from the programme&apos;s records. Ongoing: open for payment, with students not yet
        attempted.
      </p>
    </div>
  )
}
