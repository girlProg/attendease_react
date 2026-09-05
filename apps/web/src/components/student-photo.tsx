import { useStudentThumbnail } from "@/hooks/use-student-thumbnail"

const sizeClasses = {
  sm: "size-6",
  md: "size-8",
} as const

export function StudentPhoto({
  url,
  name,
  size = "md",
  studentId,
  hasPhoto = false,
}: {
  // Kobo's public link — only used when no local copy has been synced yet.
  url?: string | null
  name?: string
  size?: keyof typeof sizeClasses
  studentId?: number
  // True once the server holds a local copy: render its small thumbnail
  // instead of the full-size camera photo from Kobo.
  hasPhoto?: boolean
}) {
  const sizeClass = sizeClasses[size]
  const useLocal = hasPhoto && studentId !== undefined
  const { data: thumbnailUrl, isError } = useStudentThumbnail(studentId, useLocal)

  const source = useLocal ? (isError ? url : thumbnailUrl) : url
  if (source) {
    return <img src={source} alt={name ?? ""} className={`${sizeClass} shrink-0 rounded-md object-cover`} />
  }
  return (
    <div
      className={`${sizeClass} shrink-0 rounded-md bg-muted ${useLocal && !isError ? "animate-pulse" : ""}`}
    />
  )
}
