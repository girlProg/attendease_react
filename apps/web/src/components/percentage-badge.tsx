export function PercentageBadge({ value }: { value: number }) {
  const color =
    value === 100
      ? "bg-emerald-100 text-emerald-600"
      : value >= 50
        ? "bg-emerald-50 text-emerald-500"
        : "bg-red-50 text-red-500"

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {value}%
    </span>
  )
}
