import { useEffect, useState } from "react"

// What the server accepts for a register page (school_register serializer).
export const REGISTER_ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.webp"

// Below this on its short side a phone photo of a register is usually too
// small to read every tick. Advice only: the uploader can go ahead anyway.
const MIN_SHORT_SIDE = 1000

function shortSide(file: File): Promise<number | null> {
  // PDFs (and HEIC in most browsers) can't be measured here; let them through.
  if (!file.type.startsWith("image/")) return Promise.resolve(null)
  return createImageBitmap(file)
    .then((bitmap) => {
      const side = Math.min(bitmap.width, bitmap.height)
      bitmap.close()
      return side
    })
    .catch(() => null)
}

/** The chosen photos that look too small to read. */
export function useSmallPhotos(files: File[]): File[] {
  const [small, setSmall] = useState<File[]>([])
  useEffect(() => {
    let cancelled = false
    Promise.all(files.map(shortSide)).then((sides) => {
      if (cancelled) return
      setSmall(files.filter((_file, index) => (sides[index] ?? Infinity) < MIN_SHORT_SIDE))
    })
    return () => {
      cancelled = true
    }
  }, [files])
  return small
}
