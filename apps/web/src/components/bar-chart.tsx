interface BarChartProps {
  title: string
  data: { label: string; value: number }[]
  color?: string
  formatValue?: (value: number) => string
  isLoading?: boolean
}

export function BarChart({ title, data, color = "bg-sidebar", formatValue, isLoading }: BarChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)
  const display = formatValue ?? ((value: number) => value.toLocaleString())

  return (
    <div className="rounded-2xl border border-border/40 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {isLoading ? (
        <div className="flex items-end gap-2" style={{ height: 220 }}>
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-1">
              <div className="h-3 w-8 animate-pulse rounded bg-muted-foreground/20" />
              <div className="flex w-full justify-center" style={{ height: 180 }}>
                <div
                  className="w-full max-w-10 animate-pulse rounded-t-md bg-muted-foreground/15"
                  style={{ height: `${30 + ((index * 17) % 60)}%`, marginTop: "auto" }}
                />
              </div>
              <div className="h-3 w-10 animate-pulse rounded bg-muted-foreground/20" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No data</p>
      ) : (
        <div className="flex items-end gap-2" style={{ height: 220 }}>
          {data.map((item) => {
            const heightPct = (item.value / maxValue) * 100
            return (
              <div key={item.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-foreground">{display(item.value)}</span>
                <div className="flex w-full justify-center" style={{ height: 180 }}>
                  <div className="relative w-full max-w-10 overflow-hidden rounded-t-md bg-muted/40" style={{ height: "100%" }}>
                    <div
                      className={`absolute bottom-0 w-full rounded-t-md ${color} transition-all`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                </div>
                <span className="max-w-full truncate text-center text-[10px] text-muted-foreground">{item.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
