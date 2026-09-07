// Label-over-value pairs, the shape every "record details" panel uses.

export function DetailField({
  label,
  value,
}: {
  label: string
  // Anything empty renders as the same em dash the tables use.
  value?: string | null
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-xs text-sidebar">{value || "—"}</dd>
    </div>
  )
}

export function DetailSection({
  title,
  children,
  columns = 2,
}: {
  title: string
  children: React.ReactNode
  columns?: 1 | 2 | 3
}) {
  const columnClass = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" }[columns]
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold text-sidebar">{title}</h3>
      <dl className={`grid ${columnClass} gap-3 rounded-xl bg-muted/30 p-3`}>
        {children}
      </dl>
    </section>
  )
}
