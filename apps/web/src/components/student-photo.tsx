import { AvatarPhoto } from "@/components/avatar-photo"
import type { AvatarSize } from "@/components/avatar-photo"
import { useStudentThumbnail } from "@/hooks/use-protected-image"

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
  size?: AvatarSize
  studentId?: number
  // True once the server holds a local copy: render its small thumbnail
  // instead of the full-size camera photo from Kobo.
  hasPhoto?: boolean
}) {
  const useLocal = hasPhoto && studentId !== undefined
  const { data: thumbnailUrl, isError, isLoading } = useStudentThumbnail(studentId, useLocal)

  // Fall back to the Kobo link if the local copy cannot be fetched; if that is
  // dead too, AvatarPhoto shows the student's initials.
  const source = useLocal ? (isError ? url : thumbnailUrl) : url
  return (
    <AvatarPhoto
      src={source}
      name={name}
      size={size}
      loading={useLocal && isLoading && !isError}
    />
  )
}
