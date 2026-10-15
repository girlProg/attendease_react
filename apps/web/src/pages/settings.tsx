import { useState } from "react"
import { CalendarDays, CalendarOff, Info, Trash2 } from "lucide-react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
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
  addTermHoliday,
  closeSchools,
  getClosuresByWeek,
  getSchoolClosures,
  getTermCalendar,
  removeTermHoliday,
  reopenSchools,
  setTermWeeks,
  type ClosureReason,
  type ClosureSelection,
  type TermCalendar,
} from "@/api/term-calendar"
import { formatAcademicYear, getTermLabel, ordinal } from "@/lib/formatters"

const TERMS = ["1", "2", "3"]
const ALL_SCHOOLS = "All schools in the LGA"

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
 * The school calendar for a term: how many weeks it ran, public holidays, and
 * the weeks schools were closed (e.g. for insecurity). Staff only. Every entry
 * changes who qualifies: holidays shorten their week, and a closed week does
 * not count for that school, so it can't pull a student's average down.
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
          <TermLengthSection key={`${year}-${term}`} calendar={calendar.data} />
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
    queryClient.invalidateQueries({ queryKey: ["school-closures"] })
    queryClient.invalidateQueries({ queryKey: ["closures-by-week"] })
    // Every qualification figure depends on the calendar.
    queryClient.invalidateQueries({ queryKey: ["attendance-overview"] })
    queryClient.invalidateQueries({ queryKey: ["term-averages"] })
    queryClient.invalidateQueries({ queryKey: ["students-summary"] })
    queryClient.invalidateQueries({ queryKey: ["cases"] })
  }
}

function TermLengthSection({ calendar }: { calendar: TermCalendar }) {
  const invalidate = useInvalidateCalendar()
  const [weeks, setWeeks] = useState(String(calendar.weeks))
  const save = useMutation({
    mutationFn: (value: number | null) => setTermWeeks(calendar.year, calendar.term, value),
    onSuccess: (result) => {
      setWeeks(String(result.weeks))
      invalidate()
    },
  })
  const parsed = Number(weeks)
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= calendar.max_weeks

  return (
    <Section
      title="Term length"
      description={`How many weeks ${getTermLabel(String(calendar.term))} ${formatAcademicYear(String(calendar.year))} ran. Used for "whole term" closures and the case-management outlook.`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <LabeledInput label="Weeks in term" type="number" value={weeks} onChange={setWeeks} />
        </div>
        <Button
          className="h-11 rounded-full bg-sidebar px-6 text-white hover:bg-sidebar/90 disabled:opacity-50"
          disabled={!valid || parsed === calendar.weeks || save.isPending}
          onClick={() => save.mutate(parsed)}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        {calendar.weeks_set && (
          <Button
            variant="outline"
            className="h-11 rounded-full px-5"
            disabled={save.isPending}
            onClick={() => save.mutate(null)}
          >
            Use the default
          </Button>
        )}
        <span className="pb-3 text-xs text-muted-foreground">
          {calendar.weeks_set ? "Set for this term." : "The default — not set for this term yet."}
        </span>
      </div>
      {save.isError && (
        <p className="text-xs text-red-600">{errorText(save.error, "Could not save the term length.")}</p>
      )}
    </Section>
  )
}

function HolidaysSection({ calendar }: { calendar: TermCalendar }) {
  const invalidate = useInvalidateCalendar()
  const [week, setWeek] = useState("")
  const [days, setDays] = useState("1")
  const [name, setName] = useState("")
  const takenWeeks = new Set(calendar.holidays.map((holiday) => holiday.week))
  const freeWeeks = Array.from({ length: calendar.weeks }, (_, index) => String(index + 1)).filter(
    (option) => !takenWeeks.has(Number(option)),
  )
  const dayOptions = Array.from({ length: calendar.school_days_per_week }, (_, index) =>
    String(index + 1),
  )

  const add = useMutation({
    mutationFn: () =>
      addTermHoliday({
        year: calendar.year,
        term: calendar.term,
        week: Number(week),
        days: Number(days),
        name: name.trim(),
      }),
    onSuccess: () => {
      setWeek("")
      setDays("1")
      setName("")
      invalidate()
    },
  })
  const remove = useMutation({ mutationFn: removeTermHoliday, onSuccess: invalidate })

  return (
    <Section
      title="Public holidays"
      description={`Days schools were shut state-wide, per week. A week with 1 holiday expects ${calendar.school_days_per_week - 1} days instead of ${calendar.school_days_per_week}; a week that is all holidays does not count.`}
    >
      {calendar.holidays.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold text-sidebar">Week</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Holiday days</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Name</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {calendar.holidays.map((holiday) => (
                <TableRow key={holiday.id} className="border-border/40">
                  <TableCell className="text-sm">Week {holiday.week}</TableCell>
                  <TableCell className="text-sm">
                    {holiday.days} of {calendar.school_days_per_week}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{holiday.name || "—"}</TableCell>
                  <TableCell>
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
      ) : (
        <p className="text-sm text-muted-foreground">No public holidays recorded for this term.</p>
      )}

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[8rem_8rem_1fr_auto]">
        <LabeledSelect
          label="Week"
          value={week}
          onValueChange={(value) => setWeek(value ?? "")}
          items={freeWeeks}
          placeholder="Week"
          formatItem={(value) => `Week ${value}`}
        />
        <LabeledSelect
          label="Holiday days"
          value={days}
          onValueChange={(value) => setDays(value ?? "1")}
          items={dayOptions}
          placeholder="Days"
        />
        <LabeledInput label="Name (optional)" value={name} onChange={setName} />
        <Button
          className="h-11 gap-2 rounded-full bg-sidebar px-6 text-white hover:bg-sidebar/90 disabled:opacity-50"
          disabled={!week || add.isPending}
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

  const selection: ClosureSelection | null =
    lgaId === undefined || (!wholeTerm && weeks.length === 0)
      ? null
      : {
          year,
          term,
          ...(schoolName === ALL_SCHOOLS ? { lga: lgaId } : { schools: schoolIds }),
          ...(wholeTerm ? { whole_term: true } : { weeks }),
        }

  const close = useMutation({
    mutationFn: () => closeSchools({ ...(selection as ClosureSelection), reason, note }),
    onSuccess: (response) => {
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

  const busy = close.isPending || reopen.isPending
  const weekNumbers = Array.from({ length: calendar.weeks }, (_, index) => index + 1)

  return (
    <Section
      title="School closures"
      description="Weeks a school did not open — insecurity, disasters, strikes. A closed week does not count for that school, so it cannot pull its students' averages down. Close a single school or a whole LGA, for chosen weeks or the whole term."
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
              {closed ? ` · ${closed}` : ""}
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
            items={(lgas ?? []).map((lga) => lga.name)}
            placeholder="Choose an LGA"
          />
          <LabeledSelect
            label="School"
            value={schoolName}
            onValueChange={(value) => setSchoolName(value ?? ALL_SCHOOLS)}
            items={[ALL_SCHOOLS, ...schoolNames]}
            placeholder="School"
          />
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
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="h-11 gap-2 rounded-full bg-amber-600 px-6 text-white hover:bg-amber-700 disabled:opacity-50"
            disabled={selection === null || busy}
            onClick={() => {
              setResult(null)
              close.mutate()
            }}
          >
            <CalendarOff className="size-4" />
            {close.isPending ? "Closing…" : "Mark closed"}
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-full px-6"
            disabled={selection === null || busy}
            onClick={() => {
              setResult(null)
              reopen.mutate()
            }}
          >
            {reopen.isPending ? "Reopening…" : "Reopen"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {selection === null
              ? "Choose an LGA and at least one week (or the whole term)."
              : `${schoolName === ALL_SCHOOLS ? `Every school in ${lgaName}` : schoolName}, ${
                  wholeTerm ? "the whole term" : `week${weeks.length === 1 ? "" : "s"} ${weeks.join(", ")}`
                }.`}
          </span>
        </div>
        {result && <p className="text-xs font-medium text-emerald-700">{result}</p>}
        {(close.isError || reopen.isError) && (
          <p className="text-xs text-red-600">
            {errorText(close.error ?? reopen.error, "Could not save the closure.")}
          </p>
        )}
      </div>

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
                message={lgaName ? `No closures in ${lgaName} this term.` : "No closures this term."}
              />
            ) : (
              (list.data?.results ?? []).map((closure) => (
                <TableRow key={closure.id} className="border-border/40">
                  <TableCell className="text-sm font-medium">{closure.school_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{closure.lga}</TableCell>
                  <TableCell className="text-sm">Week {closure.week}</TableCell>
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

