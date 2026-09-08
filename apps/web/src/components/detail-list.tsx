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
      <dd className="mt-0.5 text-xs font-medium text-sidebar">{value || "—"}</dd>
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
      <h3 className="text-sm font-bold text-sidebar">{title}</h3>
      {/* A white card like the stat tiles and tables around it: a translucent
          muted fill vanishes against the page's tinted background. */}
      <dl
        className={`grid ${columnClass} gap-4 rounded-2xl border border-border/40 bg-white p-5`}
      >
        {children}
      </dl>
    </section>
  )
}
