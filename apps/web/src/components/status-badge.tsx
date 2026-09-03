// One distinct colour per state so no two disbursement stages share a badge.
const variantClasses = {
  success: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border border-red-200 bg-red-50 text-red-600",
  warning: "border border-amber-200 bg-amber-50 text-amber-700",
  info: "border border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border border-slate-200 bg-slate-50 text-slate-600",
  // Retryable failure: orange sits between "failed" red and "waiting" amber.
  retry: "border border-orange-200 bg-orange-50 text-orange-700",
  // Bank returned nothing we can interpret; needs a look, not an action.
  unknown: "border border-violet-200 bg-violet-50 text-violet-700",
  // Uploaded to the bank, awaiting its first status.
  submitted: "border border-indigo-200 bg-indigo-50 text-indigo-700",
  // No transaction at all — dashed outline, deliberately quieter.
  muted: "border border-dashed border-slate-300 bg-white text-slate-500",
} as const

export type StatusVariant = keyof typeof variantClasses

export function StatusBadge({
  variant,
  label,
}: {
  variant: StatusVariant
  label: string
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${variantClasses[variant]}`}>
      {label}
    </span>
  )
}
