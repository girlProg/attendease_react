import { useState } from "react"
import { AlertCircle, Info } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { LabeledInput } from "@/components/form-fields"
import { QueryError } from "@/components/query-error"
import { useLogVisit } from "@/hooks/use-log-visit"
import { getPageDesign, setPageDesign } from "@/api/page-design"
import { getScInsDisplay, setScInsDisplay, type ScInsDisplay } from "@/api/sc-ins-display"
import type { ScInsDisplayMode } from "@/types"

function errorText(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (data && typeof data === "object") {
    const first = Object.values(data as Record<string, unknown>)[0]
    if (Array.isArray(first) && typeof first[0] === "string") return first[0]
    if (typeof first === "string") return first
  }
  return fallback
}

const USES_RANGE: ScInsDisplayMode[] = ["range_screen", "range_everywhere"]

/**
 * What an SC-INS term reads as. Superusers only, display only: who qualifies
 * and who is paid never changes. Every change goes to the activity log.
 */
export function DisplaySettingsPage() {
  useLogVisit("Settings", "Visited Display Settings")
  const display = useQuery({ queryKey: ["sc-ins-display"], queryFn: getScInsDisplay })

  if (display.isError) return <QueryError />
  if (!display.data) return null
  return (
    <div className="space-y-5">
      <PageDesignSection />
      <ScInsDisplayForm display={display.data} />
    </div>
  )
}

/** Redesigned pages, switched on for every user at once. */
function PageDesignSection() {
  const queryClient = useQueryClient()
  const design = useQuery({ queryKey: ["page-design"], queryFn: getPageDesign })
  const save = useMutation({
    mutationFn: (on: boolean) => setPageDesign({ new_payments_page: on }),
    onSuccess: (result) => {
      queryClient.setQueryData(["page-design"], result)
      // Every page reads which design to show from the config.
      queryClient.invalidateQueries({ queryKey: ["config"] })
    },
  })

  if (design.isError) return <QueryError />
  if (!design.data) return null
  const on = design.data.new_payments_page

  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-white p-5 md:max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-foreground">Page designs</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A redesigned page is switched on here for every user at once, and can be switched back
          the same way. The data and what each button does are the same in both designs.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <span className="flex-1">
          <span className="block text-sm font-medium text-foreground">New Payments page</span>
          <span className="block text-xs text-muted-foreground">
            The cohort, term and school in one bar, a live tracker while a school is being paid,
            and the students sorted into tabs by where their payment is.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="New Payments page"
          disabled={save.isPending}
          onClick={() => save.mutate(!on)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
            on ? "bg-emerald-600" : "bg-muted-foreground/40"
          }`}
        >
          <span
            className={`absolute size-5 rounded-full bg-white shadow transition ${
              on ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {save.isError && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {errorText(save.error, "Could not save the setting.")}
        </p>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <Info className="mt-0.5 size-4 shrink-0" />
        {on
          ? "Now: everyone sees the new Payments page."
          : "Now: everyone sees the current Payments page."}
        {design.data.updated_by ? ` Last changed by ${design.data.updated_by}.` : ""}
      </p>
    </section>
  )
}

function ScInsDisplayForm({ display }: { display: ScInsDisplay }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState(display.mode)
  const [low, setLow] = useState(String(display.range_low))
  const [high, setHigh] = useState(String(display.range_high))

  const usesRange = USES_RANGE.includes(mode)
  const lowNumber = Number(low)
  const highNumber = Number(high)
  const inRange = (number: number) => Number.isInteger(number) && number >= 0 && number <= 100
  const valid = !usesRange || (inRange(lowNumber) && inRange(highNumber) && lowNumber <= highNumber)
  const changed =
    mode !== display.mode ||
    (usesRange && (lowNumber !== display.range_low || highNumber !== display.range_high))

  const save = useMutation({
    mutationFn: () =>
      setScInsDisplay(usesRange ? { mode, range_low: lowNumber, range_high: highNumber } : { mode }),
    onSuccess: (result) => {
      queryClient.setQueryData(["sc-ins-display"], result)
      // Every term column, export and count reads this.
      queryClient.invalidateQueries()
    },
  })

  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-white p-5 md:max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-foreground">Closed all term (SC-INS)</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          What a term reads as for students whose school was closed every week of it (where the
          term&apos;s SC-INS switch is on, Settings › Term). Display only: who qualifies and who is
          paid does not change. A range gives each student and term the same number every time, so a
          page and its export agree.
        </p>
      </div>

      <fieldset className="space-y-2">
        {display.modes.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="radio"
              name="sc-ins-display"
              value={option.value}
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
              className="size-4 accent-brand"
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      {usesRange && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <LabeledInput label="From %" type="number" value={low} onChange={setLow} />
          </div>
          <div className="w-28">
            <LabeledInput label="To %" type="number" value={high} onChange={setHigh} />
          </div>
        </div>
      )}

      <Button
        className="h-11 rounded-full px-6"
        disabled={!changed || !valid || save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Saving…" : "Save"}
      </Button>

      {!valid && (
        <p className="text-sm text-red-600">
          Enter whole numbers from 0 to 100, the first no bigger than the second.
        </p>
      )}
      {save.isError && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {errorText(save.error, "Could not save the setting.")}
        </p>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <Info className="mt-0.5 size-4 shrink-0" />
        {`Now: ${display.modes.find((option) => option.value === display.mode)?.label ?? display.mode}`}
        {USES_RANGE.includes(display.mode) ? ` (${display.range_low}–${display.range_high}%)` : ""}.
      </p>
    </section>
  )
}
