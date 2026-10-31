import { roundUpPercent } from "@/lib/formatters"

/** A term percentage, or "SC-INS" when the student's school was closed every
 * week of that term and the term's SC-INS switch is on. */
export function PercentageBadge({ value, scIns = false }: { value: number; scIns?: boolean }) {
  if (scIns) {
    return (
      <span
        className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
        title="School closed all term (insecurity): judged on the last term with open weeks"
      >
        SC-INS
      </span>
    )
  }
  const percent = roundUpPercent(value)
  const color =
    percent === 100
      ? "bg-emerald-100 text-emerald-600"
      : percent >= 50
        ? "bg-emerald-50 text-emerald-500"
        : "bg-red-50 text-red-500"

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {percent}%
    </span>
  )
}
