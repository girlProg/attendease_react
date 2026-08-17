const variantClasses = {
  success: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border border-red-200 bg-red-50 text-red-600",
  warning: "border border-amber-200 bg-amber-50 text-amber-700",
  info: "border border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border border-slate-200 bg-slate-50 text-slate-600",
} as const

export function StatusBadge({
  variant,
  label,
}: {
  variant: keyof typeof variantClasses
  label: string
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${variantClasses[variant]}`}>
      {label}
    </span>
  )
}
