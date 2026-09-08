import { useState } from "react"
import { User } from "lucide-react"

import { getInitials } from "@/lib/formatters"

const avatarSizes = {
  sm: "size-6 text-[8px]",
  md: "size-8 text-[10px]",
  lg: "size-16 text-sm",
  xl: "size-28 text-lg",
} as const

export type AvatarSize = keyof typeof avatarSizes

/**
 * A photo that always renders something.
 *
 * Kobo's attachment links do expire — the old media endpoint now 404s — so a
 * plain <img> leaves a broken-image glyph on rows whose photo was never synced
 * locally. On any load failure (and when there is no source at all) this falls
 * back to the person's initials, or a generic figure when even the name is
 * missing.
 */
export function AvatarPhoto({
  src,
  name,
  size = "md",
  loading = false,
  className = "",
}: {
  src?: string | null
  name?: string
  size?: AvatarSize
  // The source is still being fetched — show a pulse rather than initials.
  loading?: boolean
  className?: string
}) {
  // Remember *which* source failed rather than that one did: a row recycled
  // for the next student then retries its new photo instead of inheriting the
  // previous one's failure.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = src !== undefined && src !== null && src === failedSrc

  const box = `${avatarSizes[size]} shrink-0 overflow-hidden rounded-md ${className}`

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name ?? ""}
        onError={() => setFailedSrc(src)}
        className={`${box} bg-muted object-cover`}
      />
    )
  }

  if (loading) return <div className={`${box} animate-pulse bg-muted`} aria-hidden="true" />

  const initials = name ? getInitials(name) : ""
  return (
    <div
      className={`${box} flex items-center justify-center bg-muted font-semibold text-muted-foreground`}
      title={name || undefined}
    >
      {initials || <User className="size-1/2" aria-hidden="true" />}
    </div>
  )
}
