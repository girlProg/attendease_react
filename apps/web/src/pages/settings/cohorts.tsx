import { AlertCircle, EyeOff } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { QueryError } from "@/components/query-error"
import { TableSkeletonRows } from "@/components/skeleton"
import { useLogVisit } from "@/hooks/use-log-visit"
import { getCohortVisibility, setCohortHidden, type CohortVisibility } from "@/api/cohort-visibility"

// Cohorts are often named by number ("1"); say "Cohort 1" so it reads as one.
function cohortLabel(name: string) {
  return /^\d+$/.test(name) ? `Cohort ${name}` : name
}

/**
 * Hide a cohort (e.g. a test cohort) from everyone: it and all its students'
 * data drop out of every page, total, export and dropdown. Nothing is deleted;
 * showing it again brings everything back. Superusers only.
 */
export function CohortSettingsPage() {
  useLogVisit("Settings", "Visited Cohort Settings")
  const queryClient = useQueryClient()
  const cohorts = useQuery({ queryKey: ["cohort-visibility"], queryFn: getCohortVisibility })

  const toggle = useMutation({
    mutationFn: (cohort: CohortVisibility) => setCohortHidden(cohort.id, !cohort.hidden),
    onSuccess: () => {
      // Hiding changes every list, total and dropdown in the app.
      queryClient.invalidateQueries()
    },
  })

  if (cohorts.isError) return <QueryError />

  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-white p-5 md:max-w-3xl">
      <div>
        <h2 className="text-base font-bold text-foreground">Cohorts</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Hide a cohort, such as a test cohort, from everyone: it and all its students&apos; data
          drop out of every page, total, export and dropdown. Nothing is deleted, and showing it again
          brings everything back. Disbursement batches and the payment audit trail are never hidden.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cohort</TableHead>
            <TableHead>Year</TableHead>
            <TableHead className="text-right">Students</TableHead>
            <TableHead className="text-right">Shown to everyone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cohorts.isLoading ? (
            <TableSkeletonRows columns={4} rows={3} />
          ) : (
            (cohorts.data ?? []).map((cohort) => {
              const busy = toggle.isPending && toggle.variables?.id === cohort.id
              return (
                <TableRow key={cohort.id} className={cohort.hidden ? "bg-muted/30" : undefined}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {cohortLabel(cohort.name)}
                      {cohort.hidden && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          <EyeOff className="size-3" />
                          Hidden
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{cohort.year}</TableCell>
                  <TableCell className="text-right">{cohort.students.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!cohort.hidden}
                      aria-label={`${cohort.hidden ? "Show" : "Hide"} ${cohortLabel(cohort.name)}`}
                      disabled={busy}
                      onClick={() => toggle.mutate(cohort)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
                        cohort.hidden ? "bg-muted-foreground/40" : "bg-emerald-600"
                      }`}
                    >
                      <span
                        className={`absolute size-5 rounded-full bg-white shadow transition ${
                          cohort.hidden ? "translate-x-0.5" : "translate-x-5"
                        }`}
                      />
                    </button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {toggle.isError && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          Could not change the cohort. Please try again.
        </p>
      )}
    </section>
  )
}
