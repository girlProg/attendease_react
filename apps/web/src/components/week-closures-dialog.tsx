import { useMemo, useState } from "react"
import { AlertCircle, CalendarOff } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Dialog, DialogPopup, DialogTitle, DialogDescription, DialogClose } from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { LabeledInput, LabeledSelect } from "@/components/form-fields"
import { PrimaryButton } from "@/components/primary-button"
import { TableSkeletonRows } from "@/components/skeleton"
import { Table, TableBody } from "@workspace/ui/components/table"
import { getWeekSchools, type WeekSchool } from "@/api/attendance"
import { CLOSURE_REASONS, closeSchools, reopenSchools, type ClosureReason } from "@/api/term-calendar"
import { getTermLabel } from "@/lib/formatters"
import type { FilterScope } from "@/hooks/use-attendance-filters"

export type ClosureWeek = { year: number; term: number; week: number }

function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (data && typeof data === "object") {
    const first = Object.values(data as Record<string, unknown>)[0]
    if (Array.isArray(first) && typeof first[0] === "string") return first[0]
    if (typeof first === "string") return first
  }
  return fallback
}

// Cohorts are often named by number ("1"); say "Cohort 1" so it reads as one.
function cohortLabel(name: string) {
  return /^\d+$/.test(name) ? `Cohort ${name}` : name
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Mark which schools were closed in one week, from Attendance > Real-Time >
 * By week. Lists every school the page filters cover with attendance that
 * week, lowest register average first; tick to close, untick to reopen. Saves
 * only the changes, through the same closure records (and log) as Settings.
 */
export function WeekClosuresDialog({
  week,
  scope,
  onClose,
}: {
  week: ClosureWeek | null
  scope: FilterScope
  onClose: () => void
}) {
  return (
    <Dialog open={week !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {week && (
          <WeekClosuresForm
            key={`${week.year}-${week.term}-${week.week}`}
            week={week}
            scope={scope}
            onClose={onClose}
          />
        )}
      </DialogPopup>
    </Dialog>
  )
}

function WeekClosuresForm({
  week,
  scope,
  onClose,
}: {
  week: ClosureWeek
  scope: FilterScope
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const schools = useQuery({
    queryKey: ["attendance-week-schools", scope, week],
    queryFn: () => getWeekSchools(scope, week),
  })
  // The ticks the user has changed from what's saved: school id -> closed.
  const [changes, setChanges] = useState<Record<number, boolean>>({})
  const [reason, setReason] = useState<ClosureReason>("insecurity")
  const [note, setNote] = useState("")
  const [search, setSearch] = useState("")

  const isClosed = (school: WeekSchool) => changes[school.school] ?? school.closed
  const toClose = (schools.data ?? []).filter((school) => !school.closed && isClosed(school))
  const toReopen = (schools.data ?? []).filter((school) => school.closed && !isClosed(school))
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (schools.data ?? []).filter((school) => !needle || school.school_name.toLowerCase().includes(needle))
  }, [schools.data, search])

  const save = useMutation({
    mutationFn: async () => {
      const where = { year: week.year, term: week.term, weeks: [week.week] }
      if (toClose.length) {
        await closeSchools({ ...where, schools: toClose.map((school) => school.school), reason, note })
      }
      if (toReopen.length) {
        await reopenSchools({ ...where, schools: toReopen.map((school) => school.school) })
      }
    },
    onSuccess: () => {
      // Closures change every qualification figure.
      for (const key of [
        "attendance-by-week",
        "attendance-week-schools",
        "attendance",
        "attendance-by-school",
        "school-closures",
        "closures-by-week",
        "term-calendar",
        "attendance-overview",
        "term-averages",
        "students-summary",
        "cases",
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      onClose()
    },
  })

  return (
    <>
      <DialogTitle>
        Closures — week {week.week}, {getTermLabel(week.term)} {week.year}
      </DialogTitle>
      <DialogDescription>
        Tick the schools that didn&apos;t open this week; untick one to reopen it. A closed week
        doesn&apos;t count towards its students&apos; qualification. The registers aren&apos;t
        changed. Payments already generated and No Objection lists already created are not updated.
      </DialogDescription>

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <LabeledSelect
            label="Reason (for schools you close)"
            value={reason}
            onValueChange={(value) => setReason((value as ClosureReason) ?? "insecurity")}
            items={CLOSURE_REASONS.map((option) => option.value)}
            placeholder="Reason"
            formatItem={(value) => CLOSURE_REASONS.find((option) => option.value === value)?.label ?? value}
          />
          <LabeledInput label="Note (optional)" value={note} onChange={setNote} />
        </div>

        <Input
          placeholder="Find a school"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 rounded-lg bg-white"
        />

        <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-border/40">
          {schools.isLoading ? (
            <Table>
              <TableBody>
                <TableSkeletonRows columns={3} rows={5} />
              </TableBody>
            </Table>
          ) : shown.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No schools with attendance this week.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {shown.map((school) => {
                const ticked = isClosed(school)
                const changed = ticked !== school.closed
                return (
                  <li key={school.school}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-muted/30 ${changed ? "bg-amber-50/60" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-sidebar"
                        checked={ticked}
                        onChange={(event) =>
                          setChanges((current) => ({ ...current, [school.school]: event.target.checked }))
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold text-foreground">{school.school_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[school.lga, school.cohorts.map(cohortLabel).join(", ")].filter(Boolean).join(" · ")} ·{" "}
                          {school.students} student{school.students === 1 ? "" : "s"}
                          {school.top_reason
                            ? ` · ${capitalise(school.top_reason.reason)} (${school.top_reason.count})`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={`block text-sm font-bold ${school.register_average < 35 ? "text-red-600" : school.register_average < 70 ? "text-amber-600" : "text-emerald-600"}`}
                        >
                          {school.register_average}%
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {changed ? (ticked ? "will close" : "will reopen") : school.closed ? "closed" : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {schools.isError && (
          <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            Could not load the schools for this week.
          </p>
        )}
        {save.isError && (
          <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {errorMessage(save.error, "Could not save the closures.")}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-xs text-muted-foreground">
            {toClose.length || toReopen.length
              ? `${toClose.length} to close, ${toReopen.length} to reopen.`
              : "No changes yet."}
          </span>
          <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
            Cancel
          </DialogClose>
          <PrimaryButton
            className="h-10 w-auto gap-2 px-6"
            disabled={save.isPending || (toClose.length === 0 && toReopen.length === 0)}
            onClick={() => save.mutate()}
          >
            <CalendarOff className="size-4" />
            {save.isPending ? "Saving…" : "Save closures"}
          </PrimaryButton>
        </div>
      </div>
    </>
  )
}
