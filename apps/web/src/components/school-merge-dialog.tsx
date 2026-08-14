import { useMemo, useState } from "react"
import { GitMerge, AlertCircle, CheckCircle, Search } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { PrimaryButton } from "@/components/primary-button"
import {
  getSchoolsForMerge,
  mergeSchools,
  type MergeSchoolsResult,
} from "@/api/attendance"

export function SchoolMergeDialog({
  lga,
  lgaName,
  cohort,
  cohortName,
}: {
  lga?: number
  lgaName?: string
  cohort?: number
  cohortName?: string
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  // ids checked for merging, and which one to keep
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [keeper, setKeeper] = useState<number | null>(null)

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["schools-for-merge", lga, cohort],
    queryFn: () => getSchoolsForMerge(lga as number, cohort as number),
    enabled: open && Boolean(lga) && Boolean(cohort),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? schools.filter((s) => s.name.toLowerCase().includes(q))
      : schools
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [schools, search])

  const mutation = useMutation({
    mutationFn: () =>
      mergeSchools({
        into_id: keeper as number,
        from_ids: [...selected].filter((id) => id !== keeper),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school"] })
      queryClient.invalidateQueries({ queryKey: ["schools-for-merge", lga, cohort] })
      queryClient.invalidateQueries({ queryKey: ["students"] })
      queryClient.invalidateQueries({ queryKey: ["students-summary"] })
      setSelected(new Set())
      setKeeper(null)
    },
  })
  const result = mutation.data as MergeSchoolsResult | undefined

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        if (keeper === id) setKeeper(null)
      } else {
        next.add(id)
      }
      return next
    })
    mutation.reset()
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setSelected(new Set())
      setKeeper(null)
      setSearch("")
      mutation.reset()
    }
  }

  const ready = Boolean(lga) && Boolean(cohort)
  const sourceCount = [...selected].filter((id) => id !== keeper).length
  const canMerge = ready && keeper !== null && sourceCount >= 1 && !mutation.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5"
      >
        <GitMerge className="size-4" />
        Merge Schools
      </button>

      <DialogPopup className="flex max-h-[85vh] flex-col overflow-hidden">
        <DialogTitle>Merge duplicate schools</DialogTitle>
        <DialogDescription>
          Tick the schools that are the same, choose the one to <strong>keep</strong>,
          and merge. All students and attendance move onto the kept school; the
          others are deleted. Shows only schools in the selected LGA and cohort
          that have verified students.
        </DialogDescription>

        <div className="mt-4 space-y-3 overflow-hidden">
          {!ready && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="size-4 shrink-0" />
              Select an LGA and a cohort on the page first — merging is within one LGA.
            </div>
          )}

          {ready && (
            <>
              <div className="rounded-lg bg-muted/30 p-2 text-xs text-muted-foreground">
                LGA: <span className="font-semibold text-foreground">{lgaName ?? lga}</span>
                {" · "}Cohort: <span className="font-semibold text-foreground">{cohortName ?? cohort}</span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter schools by name"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 rounded-full border-sidebar/30 !bg-white pl-9"
                />
              </div>

              <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-border/60">
                {isLoading ? (
                  <p className="p-4 text-sm text-muted-foreground">Loading schools…</p>
                ) : filtered.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No schools found.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {filtered.map((school) => {
                      const checked = selected.has(school.id)
                      return (
                        <li
                          key={school.id}
                          className={`flex items-center gap-3 px-3 py-2 text-sm ${
                            checked ? "bg-sidebar/5" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(school.id)}
                            className="size-4 shrink-0 accent-sidebar"
                          />
                          <span className="flex-1 truncate text-foreground" title={school.name}>
                            {school.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {school.student_count ?? 0} students
                          </span>
                          <label
                            className={`flex shrink-0 items-center gap-1 text-xs ${
                              checked ? "text-sidebar" : "text-muted-foreground/40"
                            }`}
                          >
                            <input
                              type="radio"
                              name="keeper"
                              disabled={!checked}
                              checked={keeper === school.id}
                              onChange={() => {
                                setKeeper(school.id)
                                mutation.reset()
                              }}
                              className="size-3.5 accent-sidebar"
                            />
                            keep
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {result && (
                <div className="space-y-1 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                  <p className="flex items-center gap-2 font-medium">
                    <CheckCircle className="size-4 shrink-0" />
                    Merged {result.merged} school(s) — {result.moved} student(s) moved.
                  </p>
                  {result.skipped.length > 0 && (
                    <p className="text-xs text-amber-700">
                      {result.skipped.length} skipped: {result.skipped.map((s) => s.error).join("; ")}
                    </p>
                  )}
                </div>
              )}

              {mutation.isError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="size-4 shrink-0" />
                  Could not merge. Please try again.
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          <span className="text-xs text-muted-foreground">
            {keeper === null
              ? "Choose a school to keep"
              : `${sourceCount} school(s) will merge into the kept one`}
          </span>
          <div className="flex gap-3">
            <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
              Close
            </DialogClose>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={!canMerge}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Merging…" : "Merge"}
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
