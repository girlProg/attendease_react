const sizeClasses = {
  sm: "size-6",
  md: "size-8",
} as const

export function StudentPhoto({
  url,
  name,
  size = "md",
}: {
  url?: string | null
  name?: string
  size?: keyof typeof sizeClasses
}) {
  const sizeClass = sizeClasses[size]

  if (url) {
    return <img src={url} alt={name ?? ""} className={`${sizeClass} shrink-0 rounded-md object-cover`} />
  }
  return <div className={`${sizeClass} shrink-0 rounded-md bg-muted`} />
}
