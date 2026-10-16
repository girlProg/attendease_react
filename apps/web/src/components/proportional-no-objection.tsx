import { Fragment, useState } from "react"
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { useMutation } from "@tanstack/react-query"

import { Input } from "@workspace/ui/components/input"
import { PrimaryButton } from "@/components/primary-button"
import {
  proportionalNoObjection,
  type ProportionalAllocation,
} from "@/api/attendance"

type Measure = "number" | "percent"

function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { error?: string } } })?.response
    ?.data
  return data?.error ?? fallback
}

/**
 * Build a No Objection list when payment is approved for fewer students than
 * qualify: every LGA, and every school within it, gets the same percentage of
 * its qualifying students; within a school the highest attendance goes first.
 * Preview first — "Create list" saves exactly what was previewed.
 */
export function ProportionalNoObjection({
  cohort,
  year,
  term,
  onCreated,
}: {
  cohort: number
  year: string
  term: string
  // Called with the number of students on the new list.
  onCreated: (count: number) => void
}) {
  const [measure, setMeasure] = useState<Measure>("number")
  const [amount, setAmount] = useState("")
  const [openLgas, setOpenLgas] = useState<Set<string>>(new Set())

  const value = Number(amount)
  const valid = amount.trim() !== "" && Number.isFinite(value) && value > 0
  const request =
    measure === "number" ? { target: Math.floor(value) } : { percent: value }

  const preview = useMutation({
    mutationFn: () =>
      proportionalNoObjection({ cohort, year, term, ...request }),
  })
  const create = useMutation({
    mutationFn: (allocation: ProportionalAllocation) =>
      proportionalNoObjection({
        cohort,
        year,
        term,
        target: allocation.target,
        commit: true,
      }),
    onSuccess: (created) => onCreated(created.target),
  })
  const allocation = create.data ?? preview.data

  const changeAmount = (next: string) => {
    setAmount(next)
    preview.reset()
  }
  const toggleLga = (key: string) =>
    setOpenLgas((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        For when payment is approved for fewer students than qualify. Every LGA,
        and every school within it, gets the same share of its own qualifying
        students; within a school the highest attendance goes first. Students
        with and without bank accounts both count.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-full border border-border/60 p-0.5">
          {(
            [
              ["number", "Number of students"],
              ["percent", "Percentage"],
            ] as [Measure, string][]
          ).map(([option, label]) => (
            <button
              key={option}
              type="button"
              aria-pressed={measure === option}
              onClick={() => {
                setMeasure(option)
                preview.reset()
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                measure === option
                  ? "bg-sidebar text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={measure === "percent" ? 100 : undefined}
            value={amount}
            onChange={(event) => changeAmount(event.target.value)}
            placeholder={measure === "number" ? "e.g. 8000" : "e.g. 80"}
            className="h-10 w-36 rounded-lg bg-white"
          />
          {measure === "percent" && (
            <span className="text-sm text-muted-foreground">%</span>
          )}
        </div>
        <button
          type="button"
          disabled={!valid || preview.isPending || create.isSuccess}
          onClick={() => preview.mutate()}
          className="inline-flex h-10 items-center rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5 disabled:opacity-50"
        >
          {preview.isPending ? "Working it out…" : "Preview allocation"}
        </button>
      </div>

      {preview.isError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {errorMessage(preview.error, "Could not work out the allocation.")}
        </div>
      )}

      {allocation && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            {allocation.target.toLocaleString()} of{" "}
            {allocation.qualifying.toLocaleString()} qualifying students (
            {allocation.percent}%), shared across {allocation.lgas.length} LGA
            {allocation.lgas.length === 1 ? "" : "s"}. Click an LGA to see its
            schools.
          </p>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border/40">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 text-left text-sidebar">
                <tr>
                  <th className="px-3 py-2 font-semibold">LGA / school</th>
                  <th className="px-3 py-2 text-right font-semibold">
                    Qualifying
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">Places</th>
                  <th className="px-3 py-2 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {allocation.lgas.map((lga) => {
                  const key = `${lga.lga ?? "none"}`
                  const expanded = openLgas.has(key)
                  return (
                    <Fragment key={key}>
                      <tr
                        className="cursor-pointer border-t border-border/40 hover:bg-muted/30"
                        onClick={() => toggleLga(key)}
                      >
                        <td className="px-3 py-2 font-semibold text-foreground">
                          <span className="inline-flex items-center gap-1">
                            {expanded ? (
                              <ChevronDown className="size-3" />
                            ) : (
                              <ChevronRight className="size-3" />
                            )}
                            {lga.lga_name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {lga.qualifying.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-brand">
                          {lga.allocated.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {lga.percent}%
                        </td>
                      </tr>
                      {expanded &&
                        lga.schools.map((school) => (
                          <tr
                            key={`${key}-${school.school ?? "none"}`}
                            className="bg-muted/10 text-muted-foreground"
                          >
                            <td className="py-1.5 pr-3 pl-8">
                              {school.school_name}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {school.qualifying.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {school.allocated.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {school.qualifying
                                ? Math.round(
                                    (school.allocated * 1000) /
                                      school.qualifying
                                  ) / 10
                                : 0}
                              %
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {create.isError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              {errorMessage(create.error, "Could not create the list.")}
            </div>
          )}
          {create.isSuccess ? (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              <CheckCircle className="size-4 shrink-0" />
              No Objection list created with{" "}
              {allocation.target.toLocaleString()} students.
            </p>
          ) : (
            <div className="flex justify-end">
              <PrimaryButton
                className="h-10 w-auto px-6"
                disabled={create.isPending || !preview.data}
                onClick={() => preview.data && create.mutate(preview.data)}
              >
                {create.isPending
                  ? "Creating…"
                  : `Create list of ${allocation.target.toLocaleString()} students`}
              </PrimaryButton>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
