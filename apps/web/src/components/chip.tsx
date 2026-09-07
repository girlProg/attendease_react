// A small soft pill for facts attached to a row: a case category, a contact
// method, an outcome. Distinct from StatusBadge, which is the larger outlined
// badge used for a disbursement's state.
const toneClasses = {
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  gray: "bg-muted text-muted-foreground",
} as const

export type ChipTone = keyof typeof toneClasses

export function Chip({
  tone = "gray",
  children,
}: {
  tone?: ChipTone
  children: React.ReactNode
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}
