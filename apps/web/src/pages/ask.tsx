import { useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { AxiosError } from "axios"
import { ChevronDown, Loader2, Send, Sparkles } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { askQuestion } from "@/api/ask"
import type { AskResult } from "@/api/ask"
import { FilterSelect } from "@/components/filter-select"
import { useLogVisit } from "@/hooks/use-log-visit"

const FILTERABLE_MAX_DISTINCT = 12

const SUGGESTIONS = [
  "How many students don't have attendance?",
  "Which schools have an average attendance below 70%?",
  "How many payments were disbursed per cohort?",
  "List LGAs by number of enrolled students",
]

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }
  return String(value)
}

function ResultCards({ result }: { result: AskResult }) {
  const entries =
    result.rows.length === 1
      ? Object.entries(result.rows[0] ?? {})
      : result.rows.map((row, index) => [`Item ${index + 1}`, row] as const)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="rounded-2xl border border-border/40 bg-white px-6 py-5"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {result.columns.find((column) => column.key === key)?.label ??
              key.replaceAll("__", " ").replaceAll("_", " ")}
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {formatCell(value)}
          </p>
        </div>
      ))}
    </div>
  )
}

function ResultTable({ result }: { result: AskResult }) {
  const [filters, setFilters] = useState<Record<string, string | null>>({})

  const filterableColumns = useMemo(
    () =>
      result.columns.filter((column) => {
        const distinct = new Set(
          result.rows.map((row) => formatCell(row[column.key])),
        )
        return distinct.size > 1 && distinct.size <= FILTERABLE_MAX_DISTINCT
      }),
    [result],
  )

  const filteredRows = result.rows.filter((row) =>
    filterableColumns.every((column) => {
      const selected = filters[column.key]
      return !selected || formatCell(row[column.key]) === selected
    }),
  )

  return (
    <div className="space-y-4">
      {filterableColumns.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {filterableColumns.map((column) => (
            <div key={column.key} className="w-44">
              <FilterSelect
                placeholder={column.label}
                items={[...new Set(result.rows.map((row) => formatCell(row[column.key])))].sort()}
                value={filters[column.key] ?? undefined}
                onValueChange={(value) =>
                  setFilters((previous) => ({ ...previous, [column.key]: value }))
                }
              />
            </div>
          ))}
          {Object.values(filters).some(Boolean) && (
            <Button
              variant="ghost"
              className="h-10 rounded-full text-xs text-muted-foreground"
              onClick={() => setFilters({})}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              {result.columns.map((column) => (
                <TableHead
                  key={column.key}
                  className="text-xs font-semibold text-sidebar"
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row, index) => (
              <TableRow key={index} className="border-border/40">
                {result.columns.map((column) => (
                  <TableCell key={column.key} className="text-xs text-foreground">
                    {formatCell(row[column.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {filteredRows.length} of {result.rows.length} rows
        {result.truncated && " (result capped at 500 rows)"}
      </p>
    </div>
  )
}

export function AskPage() {
  useLogVisit("Ask", "Visited Ask")
  const [question, setQuestion] = useState("")
  const [showExplanation, setShowExplanation] = useState(false)

  const { mutate, data, error, isPending, reset } = useMutation({
    mutationFn: askQuestion,
  })

  function submit(value: string) {
    const trimmed = value.trim()
    if (!trimmed || isPending) return
    setShowExplanation(false)
    mutate(trimmed)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ask</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask a question about students, attendance, schools or payments in plain
          English.
        </p>
      </div>

      <form
        className="flex gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          submit(question)
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="e.g. How many students don't have attendance?"
          className="h-12 flex-1 rounded-full border-2 border-border/60 bg-white px-6 text-sm outline-none transition-colors focus:border-sidebar"
        />
        <Button
          type="submit"
          disabled={isPending || !question.trim()}
          className="h-12 gap-2 rounded-full bg-sidebar px-6 text-white hover:bg-sidebar/90"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Ask
        </Button>
      </form>

      {!data && !isPending && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuestion(suggestion)
                submit(suggestion)
              }}
              className="rounded-full border border-border/60 bg-white px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-sidebar hover:text-sidebar"
            >
              <Sparkles className="mr-1 inline size-3" />
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
          <p className="font-semibold">
            {(error instanceof AxiosError &&
              (error.response?.data?.error as string)) ||
              "Couldn't answer that question."}
          </p>
          {error instanceof AxiosError && error.response?.data?.detail && (
            <code className="mt-2 block overflow-x-auto rounded-lg bg-red-100 p-2 text-[11px]">
              {String(error.response.data.detail)}
            </code>
          )}
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => reset()}
          >
            Try rephrasing
          </button>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">{data.title}</h2>

          {data.display === "cards" ? (
            <ResultCards result={data} />
          ) : (
            <ResultTable result={data} />
          )}

          <div className="rounded-2xl border border-border/40 bg-white">
            <button
              type="button"
              onClick={() => setShowExplanation((previous) => !previous)}
              className="flex w-full items-center justify-between px-6 py-3 text-xs font-medium text-muted-foreground"
            >
              How this was computed
              <ChevronDown
                className={`size-4 transition-transform ${showExplanation ? "rotate-180" : ""}`}
              />
            </button>
            {showExplanation && (
              <div className="space-y-2 border-t border-border/40 px-6 py-4">
                <p className="text-xs text-muted-foreground">{data.explanation}</p>
                <code className="block overflow-x-auto rounded-lg bg-muted/40 p-3 text-[11px] text-foreground">
                  {data.orm}
                </code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
