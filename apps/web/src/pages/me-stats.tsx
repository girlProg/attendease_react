import { AlertCircle, Download } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { MeStatsGrid, SourceTag } from "@/components/me-stats-table"
import { QueryError } from "@/components/query-error"
import { useColumnDownload } from "@/hooks/use-column-download"
import { useLogVisit } from "@/hooks/use-log-visit"
import { getMeStats, meStatsExport } from "@/api/me-stats"

/**
 * How many of each cohort's entry class were paid in each year, and the class
 * they were in, until they graduate. Read-only: enrolment years and figures are
 * set on Settings > M&E Stats.
 */
export function MeStatsPage() {
  useLogVisit("M&E Stats", "Visited M&E Stats")
  const { data, isError, isLoading } = useQuery({ queryKey: ["me-stats"], queryFn: getMeStats })
  const download = useColumnDownload(meStatsExport)

  if (isError) return <QueryError />

  const cohortsWithoutYear = (data?.cohorts ?? []).filter((cohort) => cohort.enrolment_year === null)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-3xl text-sm text-muted-foreground">
          For each year, how many students were paid and the class they were in, until they
          graduate. Each number says where it came from: <SourceTag source="entered" /> was typed in
          from the programme&apos;s own records, and <SourceTag source="system" /> is counted from
          payments marked as paid.
        </p>
        <Button
          variant="outline"
          className="h-11 shrink-0 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
          {...download.press}
        >
          <Download className="size-4" />
          Download
        </Button>
        {download.dialog}
      </div>

      {cohortsWithoutYear.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          <AlertCircle className="size-4 shrink-0" />
          No enrolment year yet for {cohortsWithoutYear.map((cohort) => cohort.title).join(", ")}, so
          {cohortsWithoutYear.length === 1 ? " its row is" : " their rows are"} empty. A superuser
          sets it on Settings › M&amp;E Stats.
        </p>
      )}

      {data && data.students_without_a_class > 0 && (
        <p className="text-xs text-muted-foreground">
          {data.students_without_a_class.toLocaleString()} students have no class at enrolment on
          record, so they aren&apos;t in any row.
        </p>
      )}

      <MeStatsGrid data={data} isLoading={isLoading} />
    </div>
  )
}
