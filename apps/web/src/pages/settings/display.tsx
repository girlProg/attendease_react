import { useState } from "react"
import { AlertCircle, Info } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { LabeledInput, LabeledSelect } from "@/components/form-fields"
import { QueryError } from "@/components/query-error"
import { useLogVisit } from "@/hooks/use-log-visit"
import { getCohorts } from "@/api/attendance"
import { getPageDesign, setPageDesign } from "@/api/page-design"
import {
  addRegisterCardTerm,
  getRegisterCardTerms,
  getRegisterCardViewers,
  removeRegisterCardTerm,
  setRegisterCardsFor,
  type RegisterCardViewer,
} from "@/api/register-cards"
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
      <EnrolledCardsSection />
      <RegisterCardsSection />
      <ScInsDisplayForm display={display.data} />
    </div>
  )
}

function SwitchButton({
  label,
  on,
  disabled,
  onToggle,
}: {
  label: string
  on: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
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
  )
}

/** The Attendance Overview's enrolled-students cards, for every user at once. */
function EnrolledCardsSection() {
  const queryClient = useQueryClient()
  const design = useQuery({ queryKey: ["page-design"], queryFn: getPageDesign })
  const save = useMutation({
    mutationFn: (on: boolean) => setPageDesign({ enrolled_cohort_cards: on }),
    onSuccess: (result) => {
      queryClient.setQueryData(["page-design"], result)
      queryClient.invalidateQueries({ queryKey: ["attendance-overview"] })
    },
  })

  if (!design.data) return null
  const on = design.data.enrolled_cohort_cards

  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-white p-5 md:max-w-2xl">
      <div className="flex items-center gap-4">
        <span className="flex-1">
          <span className="block text-base font-bold text-foreground">
            Enrolled students cards
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Shows every user one card per cohort on the Attendance Overview: students enrolled,
            including graduated and dropped-out students but not replaced ones. The cards follow
            the cohort, LGA and school filters.
          </span>
        </span>
        <SwitchButton
          label="Enrolled students cards"
          on={on}
          disabled={save.isPending}
          onToggle={() => save.mutate(!on)}
        />
      </div>

      {save.isError && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {errorText(save.error, "Could not save the setting.")}
        </p>
      )}
    </section>
  )
}

const TERMS = ["1", "2", "3"]

const HOW: Record<RegisterCardViewer["how"], string> = {
  superuser: "Superuser, always",
  default: "By default",
  ticked: "Ticked",
  unticked: "Unticked",
}

/**
 * The Attendance Overview's uploaded-register cards: the cohort, year and term
 * they show on, and who sees them. A person's tick is their register_cards
 * permission, the same one as on Manage Users; the list previews who gains and
 * who loses the cards before anything is saved.
 */
function RegisterCardsSection() {
  const queryClient = useQueryClient()
  const terms = useQuery({ queryKey: ["register-card-terms"], queryFn: getRegisterCardTerms })
  const viewers = useQuery({
    queryKey: ["register-card-viewers"],
    queryFn: getRegisterCardViewers,
  })
  const { data: cohorts = [] } = useQuery({ queryKey: ["cohort"], queryFn: getCohorts })
  const [cohort, setCohort] = useState("")
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [term, setTerm] = useState("")
  // People whose tick has been changed here and not saved yet: id → sees.
  const [changes, setChanges] = useState<Record<number, boolean>>({})

  const refreshTerms = () => {
    queryClient.invalidateQueries({ queryKey: ["register-card-terms"] })
    queryClient.invalidateQueries({ queryKey: ["attendance-overview"] })
  }
  const add = useMutation({
    mutationFn: () =>
      addRegisterCardTerm({ cohort: Number(cohort), year: Number(year), term: Number(term) }),
    onSuccess: refreshTerms,
  })
  const remove = useMutation({ mutationFn: removeRegisterCardTerm, onSuccess: refreshTerms })
  const save = useMutation({
    mutationFn: () =>
      Promise.all(
        Object.entries(changes).map(([id, sees]) => setRegisterCardsFor(Number(id), sees)),
      ),
    onSuccess: () => {
      setChanges({})
      queryClient.invalidateQueries({ queryKey: ["register-card-viewers"] })
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ["register-card-viewers"] }),
  })

  const people = viewers.data ?? []
  const sees = (person: RegisterCardViewer) => changes[person.id] ?? person.sees
  const toggle = (person: RegisterCardViewer) => {
    const next = !sees(person)
    setChanges((current) => {
      const updated = { ...current }
      if (next === person.sees) delete updated[person.id]
      else updated[person.id] = next
      return updated
    })
  }
  const gaining = people.filter((person) => changes[person.id] === true)
  const losing = people.filter((person) => changes[person.id] === false)
  const seeing = people.filter(sees)
  const canAdd = Boolean(cohort && term && Number(year) > 2000) && !add.isPending
  const cohortName = (id: string) => cohorts.find((option) => String(option.id) === id)?.name ?? id
  const failure = add.error ?? remove.error ?? save.error
  const names = (group: RegisterCardViewer[]) => group.map((person) => person.name).join(", ")

  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-white p-5 md:max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-foreground">Uploaded-register cards</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Extra cards on the Attendance Overview with the figures from uploaded registers only, so
          collected attendance can be told apart from migrated or seeded rows. They show when the
          filters choose a cohort, year and term ticked here, to the people ticked below. Display
          only: who qualifies and who is paid does not change.
        </p>
      </div>

      {terms.isError ? (
        <QueryError />
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1.5 font-medium">Cohort</th>
              <th className="py-1.5 font-medium">Year</th>
              <th className="py-1.5 font-medium">Term</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(terms.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-sm text-muted-foreground">
                  No term is ticked: the cards don&apos;t show anywhere.
                </td>
              </tr>
            )}
            {(terms.data ?? []).map((ticked) => (
              <tr key={ticked.id} className="border-t border-border/40">
                <td className="py-2">{ticked.cohort_name}</td>
                <td className="py-2">{ticked.year}</td>
                <td className="py-2">{ticked.term}</td>
                <td className="py-2 text-right text-xs font-semibold">
                  <button
                    type="button"
                    className="text-red-600 hover:underline disabled:opacity-50"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Stop showing the cards for cohort ${ticked.cohort_name} · ${ticked.year} · term ${ticked.term}? ${seeing.length} people see them there now.`,
                        )
                      ) {
                        remove.mutate(ticked.id)
                      }
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
        <LabeledSelect
          label="Cohort"
          value={cohort}
          onValueChange={(value) => setCohort(value ?? "")}
          items={cohorts.map((option) => String(option.id))}
          placeholder="Cohort"
          formatItem={cohortName}
        />
        <LabeledInput label="Year" type="number" value={year} onChange={setYear} />
        <LabeledSelect
          label="Term"
          value={term}
          onValueChange={(value) => setTerm(value ?? "")}
          items={TERMS}
          placeholder="Term"
        />
        <Button className="h-11 rounded-full px-6" disabled={!canAdd} onClick={() => add.mutate()}>
          {add.isPending ? "Adding…" : "Add term"}
        </Button>
      </div>
      {canAdd && (
        <p className="text-xs text-muted-foreground">
          Adding it shows the cards there to the {seeing.length} people ticked below.
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Who sees them ({seeing.length} of {people.length} active accounts)
        </h3>
        {viewers.isError ? (
          <QueryError />
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-xl border border-border/40">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-1.5" />
                  <th className="py-1.5 font-medium">Name</th>
                  <th className="py-1.5 font-medium">Role</th>
                  <th className="px-3 py-1.5 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => {
                  const changed = person.id in changes
                  return (
                    <tr
                      key={person.id}
                      className={`border-t border-border/40 ${changed ? "bg-amber-50" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`${person.name} sees the cards`}
                          checked={sees(person)}
                          disabled={person.is_superuser || save.isPending}
                          onChange={() => toggle(person)}
                          className="size-4 accent-brand"
                        />
                      </td>
                      <td className="py-2">
                        <span className="block font-medium">{person.name}</span>
                        <span className="block text-xs text-muted-foreground">{person.email}</span>
                      </td>
                      <td className="py-2 capitalize">
                        {person.role}
                        {person.is_staff ? " · staff" : ""}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {changed ? "Changed, not saved" : HOW[person.how]}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(gaining.length > 0 || losing.length > 0) && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Before you save</p>
          {gaining.length > 0 && (
            <p>
              Will start seeing the cards ({gaining.length}): {names(gaining)}
            </p>
          )}
          {losing.length > 0 && (
            <p>
              Will stop seeing the cards ({losing.length}): {names(losing)}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <Button
              className="h-10 rounded-full px-5"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-full px-5"
              disabled={save.isPending}
              onClick={() => setChanges({})}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {failure && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {errorText(failure, "Could not save the setting.")}
        </p>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <Info className="mt-0.5 size-4 shrink-0" />
        A person&apos;s tick here is the same as &quot;See uploaded-register cards&quot; on their Manage
        Users page. Staff have it unless it&apos;s unticked; every change is in the activity log.
      </p>
    </section>
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
        <SwitchButton
          label="New Payments page"
          on={on}
          disabled={save.isPending}
          onToggle={() => save.mutate(!on)}
        />
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
