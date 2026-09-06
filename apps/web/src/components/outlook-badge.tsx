import type { CaseRow, Outlook } from "@/api/cases"

const TONES: Record<Outlook, string> = {
  on_track: "bg-emerald-100 text-emerald-700",
  recoverable: "bg-sky-100 text-sky-700",
  cannot_qualify: "bg-slate-200 text-slate-700",
}

export function OutlookBadge({
  row,
  detail = false,
}: {
  row: Pick<CaseRow, "outlook" | "outlook_label" | "weeks_needed" | "weeks_remaining" | "term_average" | "term_label">
  detail?: boolean
}) {
  if (!row.outlook) return <span className="text-xs text-muted-foreground">—</span>
  const title =
    row.outlook === "recoverable"
      ? `Term average ${row.term_average}% so far; ${row.weeks_needed} full week(s) of the ${row.weeks_remaining} left would lift it over the line.`
      : row.outlook === "cannot_qualify"
        ? `Term average ${row.term_average}% with ${row.weeks_remaining} week(s) left — the line cannot be reached this term.`
        : `Term average ${row.term_average}% — above the qualifying line.`
  return (
    <span className="inline-flex flex-col items-start gap-0.5" title={title}>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONES[row.outlook]}`}>
        {row.outlook === "recoverable" ? "Recoverable" : row.outlook_label}
      </span>
      {(detail || row.outlook === "recoverable") && (
        <span className="text-[10px] text-muted-foreground">
          {row.outlook === "recoverable"
            ? `Needs ${row.weeks_needed} of ${row.weeks_remaining} weeks`
            : `${row.term_label} avg ${row.term_average}%`}
        </span>
      )}
    </span>
  )
}
