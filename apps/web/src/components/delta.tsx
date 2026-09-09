import { ArrowDown, ArrowUp, Minus } from "lucide-react"

import type { Polarity } from "@/api/reports"

/**
 * A figure's change since last month.
 *
 * Whether a rise is good news comes from the backend, not from here: coverage
 * rising is progress, data gaps rising is not, and that is programme policy
 * rather than a styling choice. Anything with no polarity is shown neutral.
 */
export function Delta({
  current,
  previous,
  polarity,
  suffix = "",
}: {
  current?: number
  previous?: number
  polarity?: Polarity
  suffix?: string
}) {
  if (current === undefined || previous === undefined) return null

  const change = Math.round((current - previous) * 10) / 10
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="size-3" aria-hidden="true" />
        no change
      </span>
    )
  }

  const rose = change > 0
  const good = polarity === undefined ? null : rose === (polarity === "up_good")
  const tone =
    good === null
      ? "text-muted-foreground"
      : good
        ? "text-emerald-600"
        : "text-red-600"
  const Icon = rose ? ArrowUp : ArrowDown

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${tone}`}>
      <Icon className="size-3" aria-hidden="true" />
      {Math.abs(change).toLocaleString()}
      {suffix} vs last month
    </span>
  )
}
