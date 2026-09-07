import type { LucideIcon } from "lucide-react"

import { StatValue } from "@/components/skeleton"

// The figure tile used across the dashboard, payments and attendance: an icon
// disc, a label, the number, and an optional line of context under it. Pass
// `onClick` for the payments variant, where a card also filters the table
// below and shows a ring while it is the active filter.
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  loading = false,
  onClick,
  active = false,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  icon: LucideIcon
  // Tailwind background class for the icon disc.
  color: string
  loading?: boolean
  onClick?: () => void
  active?: boolean
}) {
  const body = (
    <>
      <div
        className={`flex size-12 shrink-0 items-center justify-center rounded-full ${color} text-white`}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-xl font-bold text-foreground">
          <StatValue loading={loading}>{value}</StatValue>
        </p>
        {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </>
  )

  if (!onClick) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-border/40 bg-white p-5">
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-4 rounded-2xl border bg-white p-5 text-left transition ${
        active ? "border-sidebar ring-2 ring-sidebar/40" : "border-border/40 hover:border-sidebar/60"
      }`}
    >
      {body}
    </button>
  )
}
