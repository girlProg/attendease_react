import { useState } from "react"
import { CalendarDays, CalendarOff, Info, Trash2 } from "lucide-react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogDescription, DialogPopup, DialogTitle } from "@workspace/ui/components/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { FilterSelect } from "@/components/filter-select"
import { LabeledInput, LabeledSelect } from "@/components/form-fields"
import { PaginationBar } from "@/components/pagination-bar"
import { QueryError } from "@/components/query-error"
import { TableEmptyState } from "@/components/table-empty-state"
import { TableSkeletonRows } from "@/components/skeleton"
import { useLogVisit } from "@/hooks/use-log-visit"
import { usePagination } from "@/hooks/use-pagination"
import { getAttendanceYears, getLGAs, getSchools } from "@/api/attendance"
import {
  CLOSURE_REASONS,
  addPublicHoliday,
  closeSchools,
  getClosuresByWeek,
  getPublicHolidays,
  getSchoolClosures,
  getTermCalendar,
  removePublicHoliday,
  reopenSchools,
  setTermCalendar,
  type ClosureReason,
  type ClosureSelection,
  type TermCalendar,
} from "@/api/term-calendar"
import { formatAcademicYear, getTermLabel, ordinal } from "@/lib/formatters"
import { formatShortDate } from "@/hooks/use-week-dates"
import { useAuth } from "@/contexts/auth-context"

const TERMS = ["1", "2", "3"]
const ALL_SCHOOLS = "All schools in the LGA"
const WHOLE_STATE = "Whole state (every LGA)"

function errorText(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    const first = Object.values(data as Record<string, unknown>)[0]
    if (Array.isArray(first) && typeof first[0] === "string") return first[0]
    if (typeof first === "string") return first
  }
  return fallback
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-white p-5">
      <div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

/**
 * The school calendar: when each term started and how many weeks it ran (school
 * weeks are calendar weeks from the start), public holidays by date, and the
 * weeks schools were closed (e.g. for insecurity). Staff only. Every entry
 * changes who qualifies: holidays take their school days out of a week, and a
 * closed week does not count for that school, so it can't pull a student's
 * average down. A dated term also refuses attendance for weeks still to come.
 */
export function SettingsPage() {
  useLogVisit("Settings", "Visited Settings")
  const { data: years } = useQuery({ queryKey: ["attendance-years"], queryFn: getAttendanceYears })
  const [chosenYear, setChosenYear] = useState<string | null>(null)
  const [term, setTerm] = useState("1")
  const latestYear = years && years.length > 0 ? String(Math.max(...years.map(Number))) : null
  const year = chosenYear ?? latestYear

  const calendar = useQuery({
    queryKey: ["term-calendar", year, term],
    queryFn: () => getTermCalendar(Number(year), Number(term)),
    enabled: year !== null,
  })

  return (
    <div className="space-y-6">
      {year !== null && (
        <div className="grid grid-cols-2 gap-3 md:max-w-xl">
          <FilterSelect
            placeholder="Year"
            items={(years ?? []).map(String)}
            value={year}
            onValueChange={(value) => value && value !== "__clear__" && setChosenYear(value)}
            formatItem={formatAcademicYear}
          />
          <FilterSelect
            placeholder="Term"
            items={TERMS}
            value={term}
            onValueChange={(value) => value && value !== "__clear__" && setTerm(value)}
            formatItem={(value) => `${ordinal(value)} Term`}
          />
        </div>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <Info className="mt-0.5 size-4 shrink-0" />
        These settings change who qualifies for payment. A public holiday takes days out of its
        week for every school; a closed week does not count for that school at all. The attendance
        registers are never changed — only how they are counted.
      </p>

      {calendar.isError && <QueryError />}
      {year !== null && calendar.data && (
        <>
          <TermDatesSection key={`${year}-${term}`} calendar={calendar.data} />
          <HolidaysSection calendar={calendar.data} />
          <ClosuresSection calendar={calendar.data} />
        </>
      )}
    </div>
  )
}

function useInvalidateCalendar() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ["term-calendar"] })
    queryClient.invalidateQueries({ queryKey: ["term-dates"] })
    queryClient.invalidateQueries({ queryKey: ["public-holidays"] })
    queryClient.invalidateQueries({ queryKey: ["school-closures"] })
    queryClient.invalidateQueries({ queryKey: ["closures-by-week"] })
    // Every qualification figure depends on the calendar.
    queryClient.invalidateQueries({ queryKey: ["attendance-overview"] })
    queryClient.invalidateQueries({ queryKey: ["term-averages"] })
    queryClient.invalidateQueries({ queryKey: ["students-summary"] })
    queryClient.invalidateQueries({ queryKey: ["cases"] })
  }
}

function weekRange(starts: string, ends: string) {
  return `${formatShortDate(starts)} – ${formatShortDate(ends)}`
}

function TermDatesSection({ calendar }: { calendar: TermCalendar }) {
  const invalidate = useInvalidateCalendar()
  const [startDate, setStartDate] = useState(calendar.start_date ?? "")
  const [weeks, setWeeks] = useState(String(calendar.weeks))
  const save = useMutation({
    mutationFn: (changes: { weeks?: number | null; start_date?: string | null }) =>
      setTermCalendar(calendar.year, calendar.term, changes),
    onSuccess: (result) => {
      setStartDate(result.start_date ?? "")
      setWeeks(String(result.weeks))
      invalidate()
    },
  })
  const parsedWeeks = Number(weeks)
  const weeksValid =
    Number.isInteger(parsedWeeks) && parsedWeeks >= 1 && parsedWeeks <= calendar.max_weeks
  const changed =
    (startDate || null) !== calendar.start_date || (weeksValid && parsedWeeks !== calendar.weeks)
  const termName = `${getTermLabel(String(calendar.term))} ${formatAcademicYear(String(calendar.year))}`

  return (
    <Section
      title="Term dates"
      description={`When ${termName} started and how many weeks it ran. School weeks are calendar weeks: week 1 is the week the term starts in. Once dated, attendance can't be recorded for a week that hasn't begun, and holidays fall into their weeks.`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <LabeledInput label="First day of term" type="date" value={startDate} onChange={setStartDate} />
        </div>
        <div className="w-36">
          <LabeledInput label="Weeks in term" type="number" value={weeks} onChange={setWeeks} />
        </div>
        <Button
          className="h-11 rounded-full bg-sidebar px-6 text-white hover:bg-sidebar/90 disabled:opacity-50"
          disabled={!weeksValid || !changed || save.isPending}
          onClick={() =>
            save.mutate({
              start_date: startDate || null,
              weeks: parsedWeeks === calendar.weeks && !calendar.weeks_set ? null : parsedWeeks,
            })
          }
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        {calendar.weeks_set && (
          <Button
            variant="outline"
            className="h-11 rounded-full px-5"
            disabled={save.isPending}
            onClick={() => save.mutate({ weeks: null })}
          >
            Default length
          </Button>
        )}
        <span className="pb-3 text-xs text-muted-foreground">
          {calendar.start_date ? "Dated." : "Not dated yet — weeks have no dates."}{" "}
          {calendar.weeks_set ? "" : `${calendar.weeks} weeks is the default.`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {calendar.weeks_set
          ? `Qualification counts weeks 1–${calendar.weeks} only: attendance recorded after week ${calendar.weeks} does not count. "Default length" removes the cap.`
          : "No length set, so every week with attendance counts. Saving a length caps qualification at it: weeks after it stop counting."}
      </p>
      {save.isError && (
        <p className="text-xs text-red-600">{errorText(save.error, "Could not save the term dates.")}</p>
      )}

      {calendar.week_dates.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold text-sidebar">Week</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Dates</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">School days</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Why fewer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calendar.week_dates.map((row) => {
                const open = calendar.school_days_per_week - row.days_off
                return (
                  <TableRow key={row.week} className="border-border/40">
                    <TableCell className="text-sm font-medium">Week {row.week}</TableCell>
                    <TableCell className="text-sm">{weekRange(row.starts, row.ends)}</TableCell>
                    <TableCell className={`text-sm ${row.days_off ? "font-semibold text-amber-700" : ""}`}>
                      {open <= 0 ? "None — does not count" : `${open} of ${calendar.school_days_per_week}`}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.reasons.join(", ") || "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  )
}

function holidayDates(holiday: { start_date: string; end_date: string; recurring: boolean }) {
  const options: Intl.DateTimeFormatOptions = holiday.recurring
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" }
  const format = (value: string) => {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day).toLocaleDateString(undefined, options)
  }
  return holiday.start_date === holiday.end_date
    ? format(holiday.start_date)
    : `${format(holiday.start_date)} – ${format(holiday.end_date)}`
}

function HolidaysSection({ calendar }: { calendar: TermCalendar }) {
  const invalidate = useInvalidateCalendar()
  const { data: holidays = [], isError } = useQuery({
    queryKey: ["public-holidays"],
    queryFn: getPublicHolidays,
  })
  const [name, setName] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [recurring, setRecurring] = useState(false)

  const add = useMutation({
    mutationFn: () =>
      addPublicHoliday({
        name: name.trim(),
        start_date: from,
        ...(to ? { end_date: to } : {}),
        recurring,
      }),
    onSuccess: () => {
      setName("")
      setFrom("")
      setTo("")
      setRecurring(false)
      invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: removePublicHoliday,
    onSuccess: invalidate,
  })
  const recurringHolidays = holidays.filter((holiday) => holiday.recurring)
  const oneOffHolidays = holidays.filter((holiday) => !holiday.recurring)

  return (
    <Section
      title="Public holidays"
      description={`Days schools were shut state-wide — a single date or a range (enter a mid-term break as one). Tick "every year" for fixed-date holidays such as Christmas. A holiday on a school day takes that day out of its week for every school; a week that is all holidays does not count.${calendar.start_date ? "" : " This term has no start date yet, so its holidays can't be placed in weeks."}`}
    >
      {isError && <QueryError />}
      {[
        { title: "Every year", rows: recurringHolidays },
        { title: "One-off", rows: oneOffHolidays },
      ].map(({ title, rows }) =>
        rows.length === 0 ? null : (
          <div key={title} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <Table>
                <TableBody>
                  {rows.map((holiday) => (
                    <TableRow key={holiday.id} className="border-border/40">
                      <TableCell className="text-sm font-medium">{holiday.name}</TableCell>
                      <TableCell className="text-sm">{holidayDates(holiday)}</TableCell>
                      <TableCell className="w-12">
                        <button
                          type="button"
                          title="Remove this holiday"
                          className="rounded-full p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(holiday.id)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ),
      )}
      {holidays.length === 0 && (
        <p className="text-sm text-muted-foreground">No public holidays recorded yet.</p>
      )}

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_11rem_auto_auto]">
        <LabeledInput label="Name" value={name} onChange={setName} />
        <LabeledInput label="From" type="date" value={from} onChange={setFrom} />
        <LabeledInput label="To (optional)" type="date" value={to} onChange={setTo} />
        <label className="flex h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(event) => setRecurring(event.target.checked)}
          />
          Every year
        </label>
        <Button
          className="h-11 gap-2 rounded-full bg-sidebar px-6 text-white hover:bg-sidebar/90 disabled:opacity-50"
          disabled={!name.trim() || !from || add.isPending}
          onClick={() => add.mutate()}
        >
          <CalendarDays className="size-4" />
          Add holiday
        </Button>
      </div>
      {(add.isError || remove.isError) && (
        <p className="text-xs text-red-600">
          {errorText(add.error ?? remove.error, "Could not save the holiday.")}
        </p>
      )}
    </Section>
  )
}

function ClosuresSection({ calendar }: { calendar: TermCalendar }) {
  const invalidate = useInvalidateCalendar()
  const { year, term } = calendar

  const { data: lgas } = useQuery({ queryKey: ["lga"], queryFn: getLGAs })
  const [lgaName, setLgaName] = useState("")
  // The whole state is offered only to accounts not limited to some LGAs
  // (the server refuses it for them too).
  const { profile } = useAuth()
  const canCloseState = !(profile?.role === "user" && (profile.lgas?.length ?? 0) > 0)
  const wholeState = canCloseState && lgaName === WHOLE_STATE
  const lgaId = lgas?.find((lga) => lga.name === lgaName)?.id
  const { data: schools } = useQuery({
    queryKey: ["closure-schools", lgaId],
    queryFn: () => getSchools(lgaId),
    enabled: lgaId !== undefined,
  })
  const [schoolName, setSchoolName] = useState(ALL_SCHOOLS)
  // One School row exists per cohort; a closed building is closed for all of
  // them, so a school chosen by name covers every row with that name here.
  const schoolNames = [...new Set((schools ?? []).map((school) => school.name))].sort()
  const schoolIds = (schools ?? [])
    .filter((school) => school.name === schoolName)
    .map((school) => school.id)

  const [weeks, setWeeks] = useState<number[]>([])
  const [wholeTerm, setWholeTerm] = useState(false)
  const [reason, setReason] = useState<ClosureReason>("insecurity")
  const [note, setNote] = useState("")
  const [result, setResult] = useState<string | null>(null)
  // A state-wide change waits here, with the server's counts, until confirmed.
  const [confirming, setConfirming] = useState<{ action: "close" | "reopen"; text: string } | null>(null)

  const selection: ClosureSelection | null =
    (lgaId === undefined && !wholeState) || (!wholeTerm && weeks.length === 0)
      ? null
      : {
          year,
          term,
          ...(wholeState
            ? { whole_state: true }
            : schoolName === ALL_SCHOOLS
              ? { lga: lgaId }
              : { schools: schoolIds }),
          ...(wholeTerm ? { whole_term: true } : { weeks }),
        }
  const weeksText = wholeTerm
    ? `the whole ${getTermLabel(term).toLowerCase()}`
    : `week${weeks.length === 1 ? "" : "s"} ${weeks.join(", ")} of the ${getTermLabel(term).toLowerCase()}`

  const preview = useMutation({
    mutationFn: async (action: "close" | "reopen") => {
      const chosen = selection as ClosureSelection
      if (action === "close") {
        const counts = await closeSchools({ ...chosen, reason, note }, true)
        return {
          action,
          text:
            `Close all ${counts.schools.toLocaleString()} schools in the state for ${weeksText}? ` +
            `${counts.created.toLocaleString()} school-week(s) will be marked closed` +
            (counts.already_closed ? ` (${counts.already_closed.toLocaleString()} already are).` : "."),
        }
      }
      const counts = await reopenSchools(chosen, true)
      return {
        action,
        text:
          `Reopen ${weeksText} for every school in the state? ` +
          `${counts.deleted.toLocaleString()} closed school-week(s) at ${(counts.schools ?? 0).toLocaleString()} school(s) will be removed.`,
      }
    },
    onSuccess: setConfirming,
  })

  const close = useMutation({
    mutationFn: () => closeSchools({ ...(selection as ClosureSelection), reason, note }),
    onSuccess: (response) => {
      setConfirming(null)
      setResult(
        `${response.created} school-week${response.created === 1 ? "" : "s"} closed` +
          (response.already_closed ? ` (${response.already_closed} already were)` : "") +
          ".",
      )
      invalidate()
    },
  })
  const reopen = useMutation({
    mutationFn: () => reopenSchools(selection as ClosureSelection),
    onSuccess: (response) => {
      setConfirming(null)
      setResult(`${response.deleted} school-week${response.deleted === 1 ? "" : "s"} reopened.`)
      invalidate()
    },
  })

  const toggleWeek = (number: number) =>
    setWeeks((current) =>
      current.includes(number) ? current.filter((item) => item !== number) : [...current, number].sort((a, b) => a - b),
    )

  const { data: byWeek } = useQuery({
    queryKey: ["closures-by-week", year, term],
    queryFn: () => getClosuresByWeek(year, term),
  })
  const closedByWeek = new Map((byWeek ?? []).map((row) => [row.week, row.schools]))

  const listFilters = { year, term, ...(lgaId ? { lga: lgaId } : {}) }
  const { page, setPage, pageSize, handleRowsChange } = usePagination([listFilters], 50)
  const list = useQuery({
    queryKey: ["school-closures", listFilters, page, pageSize],
    queryFn: () => getSchoolClosures(page, pageSize, listFilters),
    placeholderData: keepPreviousData,
  })
  const totalPages = list.data ? Math.ceil(list.data.count / pageSize) : 0

  const busy = close.isPending || reopen.isPending || preview.isPending
  // A state-wide change is counted and confirmed first; anything smaller saves.
  const run = (action: "close" | "reopen") => {
    setResult(null)
    if (wholeState) preview.mutate(action)
    else if (action === "close") close.mutate()
    else reopen.mutate()
  }
  const weekNumbers = Array.from({ length: calendar.weeks }, (_, index) => index + 1)
  const weekDate = new Map(calendar.week_dates.map((row) => [row.week, row.starts]))
  const dateOf = (number: number) => {
    const starts = weekDate.get(number)
    return starts ? formatShortDate(starts) : ""
  }

  return (
    <Section
      title="School closures"
      description="Weeks a school did not open — insecurity, disasters, strikes. A closed week does not count for that school, so it cannot pull its students' averages down. Close a single school, a whole LGA or every school in the state, for chosen weeks or the whole term."
    >
      <div className="flex flex-wrap gap-2">
        {weekNumbers.map((number) => {
          const closed = closedByWeek.get(number) ?? 0
          return (
            <span
              key={number}
              title={closed ? `${closed} school(s) closed in week ${number}` : `Week ${number}: no closures`}
              className={`rounded-full border px-3 py-1 text-xs ${
                closed
                  ? "border-amber-300 bg-amber-50 font-semibold text-amber-800"
                  : "border-border/60 text-muted-foreground"
              }`}
            >
              W{number}
              {dateOf(number) ? ` (${dateOf(number)})` : ""}
              {closed ? ` · ${closed} closed` : ""}
            </span>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {calendar.closed_school_weeks > 0
          ? `${calendar.closed_schools} school(s) closed for ${calendar.closed_school_weeks} school-week(s) this term.`
          : "No closures recorded for this term."}
      </p>

      <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LabeledSelect
            label="LGA"
            value={lgaName}
            onValueChange={(value) => {
              setLgaName(value ?? "")
              setSchoolName(ALL_SCHOOLS)
            }}
            items={[...(canCloseState ? [WHOLE_STATE] : []), ...(lgas ?? []).map((lga) => lga.name)]}
            placeholder="Choose an LGA"
          />
          {wholeState ? (
            <LabeledInput label="School" value="Every school in the state" onChange={() => {}} disabled />
          ) : (
            <LabeledSelect
              label="School"
              value={schoolName}
              onValueChange={(value) => setSchoolName(value ?? ALL_SCHOOLS)}
              items={[ALL_SCHOOLS, ...schoolNames]}
              placeholder="School"
            />
          )}
          <LabeledSelect
            label="Reason"
            value={reason}
            onValueChange={(value) => setReason((value as ClosureReason) ?? "insecurity")}
            items={CLOSURE_REASONS.map((option) => option.value)}
            placeholder="Reason"
            formatItem={(value) => CLOSURE_REASONS.find((option) => option.value === value)?.label ?? value}
          />
          <LabeledInput label="Note (optional)" value={note} onChange={setNote} />
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Weeks</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="mr-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={wholeTerm}
                onChange={(event) => setWholeTerm(event.target.checked)}
              />
              Whole term ({calendar.weeks} weeks)
            </label>
            {weekNumbers.map((number) => (
              <button
                key={number}
                type="button"
                disabled={wholeTerm}
                onClick={() => toggleWeek(number)}
                className={`h-8 min-w-10 rounded-full border px-3 text-xs font-medium transition disabled:opacity-40 ${
                  weeks.includes(number)
                    ? "border-sidebar bg-sidebar text-white"
                    : "border-border/60 bg-white text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {number}
                {dateOf(number) && (
                  <span className="ml-1 font-normal opacity-70">{dateOf(number)}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="h-11 gap-2 rounded-full bg-amber-600 px-6 text-white hover:bg-amber-700 disabled:opacity-50"
            disabled={selection === null || busy}
            onClick={() => run("close")}
          >
            <CalendarOff className="size-4" />
            {close.isPending ? "Closing…" : preview.isPending && preview.variables === "close" ? "Counting…" : "Mark closed"}
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-full px-6"
            disabled={selection === null || busy}
            onClick={() => run("reopen")}
          >
            {reopen.isPending ? "Reopening…" : preview.isPending && preview.variables === "reopen" ? "Counting…" : "Reopen"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {selection === null
              ? "Choose an LGA (or the whole state) and at least one week (or the whole term)."
              : `${wholeState ? "Every school in the state" : schoolName === ALL_SCHOOLS ? `Every school in ${lgaName}` : schoolName}, ${
                  wholeTerm ? "the whole term" : `week${weeks.length === 1 ? "" : "s"} ${weeks.join(", ")}`
                }.`}
          </span>
        </div>
        {result && <p className="text-xs font-medium text-emerald-700">{result}</p>}
        {(close.isError || reopen.isError || preview.isError) && (
          <p className="text-xs text-red-600">
            {errorText(close.error ?? reopen.error ?? preview.error, "Could not save the closure.")}
          </p>
        )}
      </div>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && !busy && setConfirming(null)}>
        <DialogPopup>
          <DialogTitle>
            {confirming?.action === "close" ? "Close every school in the state?" : "Reopen every school in the state?"}
          </DialogTitle>
          <DialogDescription>{confirming?.text}</DialogDescription>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" className="h-10 rounded-full px-5" disabled={busy} onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              className="h-10 rounded-full bg-amber-600 px-5 text-white hover:bg-amber-700"
              disabled={busy}
              onClick={() => (confirming?.action === "close" ? close.mutate() : reopen.mutate())}
            >
              {busy ? "Saving…" : confirming?.action === "close" ? "Close all schools" : "Reopen all schools"}
            </Button>
          </div>
        </DialogPopup>
      </Dialog>

      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        rowOptions={["50", "100", "300"]}
        defaultRows={String(pageSize)}
        onRowsChange={handleRowsChange}
      />
      {list.isError && <QueryError />}
      <div className="overflow-x-auto rounded-xl border border-border/40">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold text-sidebar">School</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">LGA</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Week</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Reason</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Note</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <TableSkeletonRows columns={6} />
            ) : (list.data?.results ?? []).length === 0 ? (
              <TableEmptyState
                colSpan={6}
                message={lgaName && !wholeState ? `No closures in ${lgaName} this term.` : "No closures this term."}
              />
            ) : (
              (list.data?.results ?? []).map((closure) => (
                <TableRow key={closure.id} className="border-border/40">
                  <TableCell className="text-sm font-medium">{closure.school_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{closure.lga}</TableCell>
                  <TableCell className="text-sm">
                    Week {closure.week}
                    {dateOf(closure.week) && (
                      <span className="ml-1 text-xs text-muted-foreground">({dateOf(closure.week)})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{closure.reason_label}</TableCell>
                  <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground" title={closure.note}>
                    {closure.note || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{closure.created_by ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Section>
  )
}

