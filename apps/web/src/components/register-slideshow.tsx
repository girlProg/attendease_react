import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  ExternalLink,
} from "lucide-react"

import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import {
  downloadRegisterPage,
  fetchRegisterPageObjectUrl,
  type SchoolRegisterRow,
} from "@/api/attendance"

/**
 * One page of the register, fetched through axios (the endpoint needs auth, so
 * a bare <img src> can't reach it) and shown from a blob URL. PDFs get an
 * <iframe> instead of an <img>.
 */
function PageView({
  registerId,
  pageId,
  alt,
}: {
  registerId: number
  pageId: number
  alt: string
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["register-page-blob", registerId, pageId],
    queryFn: () => fetchRegisterPageObjectUrl(registerId, pageId),
    staleTime: 10 * 60 * 1000,
  })

  // Blob URLs live until revoked; drop this one when the page unmounts or the
  // query returns a different object, or they accumulate for the tab's life.
  useEffect(() => {
    const url = data?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [data?.url])

  if (isLoading) {
    return (
      <p className="py-20 text-center text-sm text-muted-foreground">Loading…</p>
    )
  }
  if (isError || !data) {
    return (
      <p className="py-20 text-center text-sm text-red-600">
        Could not load this page.
      </p>
    )
  }
  if (data.type === "application/pdf") {
    return <iframe src={data.url} title={alt} className="h-[65vh] w-full" />
  }
  return (
    <img
      src={data.url}
      alt={alt}
      className="mx-auto max-h-[65vh] w-auto max-w-full rounded-lg object-contain"
    />
  )
}

/**
 * Open a register page in its own tab. The endpoint is JWT-protected, so a bare
 * URL wouldn't authenticate — we fetch the bytes and point the tab at a blob
 * instead. The tab is opened synchronously (before the await) or the popup
 * blocker eats it. This blob is deliberately not revoked: the new tab owns it
 * now, and the browser reclaims it when that tab closes.
 */
async function openPageInTab(registerId: number, pageId: number) {
  const tab = window.open("", "_blank")
  try {
    const { url } = await fetchRegisterPageObjectUrl(registerId, pageId)
    if (tab) tab.location.href = url
  } catch {
    tab?.close()
  }
}

/**
 * Full-screen slideshow of a register's photos — the register is a physical
 * book, so paging through it beats a list of filenames.
 */
export function RegisterSlideshow({
  register,
  canWrite,
  onDeletePage,
  onClose,
}: {
  register: SchoolRegisterRow
  canWrite: boolean
  onDeletePage: (pageId: number) => void
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const pages = register.pages
  const total = pages.length
  // A delete can shrink the set out from under the cursor.
  const safeIndex = Math.min(index, Math.max(total - 1, 0))
  const current = pages[safeIndex]

  const go = (delta: number) => {
    if (total === 0) return
    setIndex((i) => (Math.min(i, total - 1) + delta + total) % total)
  }

  // Arrow keys are the expected way to page through a slideshow.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1)
      if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="w-[calc(100%-2rem)] max-w-4xl">
        <DialogTitle className="pr-8 text-base">
          {register.school} — {register.year} Term {register.term}
        </DialogTitle>
        <DialogDescription>
          {total === 0
            ? "This register has no photos yet."
            : `Page ${safeIndex + 1} of ${total}`}
        </DialogDescription>

        {total > 0 && current && (
          <>
            <div className="relative mt-4 flex items-center justify-center rounded-xl bg-muted/30 p-2">
              <PageView
                registerId={register.id}
                pageId={current.id}
                alt={current.original_filename || `Page ${safeIndex + 1}`}
              />
              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="Previous page"
                    className="absolute left-2 inline-flex size-10 items-center justify-center rounded-full bg-white/90 text-sidebar shadow hover:bg-white"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="Next page"
                    className="absolute right-2 inline-flex size-10 items-center justify-center rounded-full bg-white/90 text-sidebar shadow hover:bg-white"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}
            </div>

            <p className="mt-2 break-all text-center text-xs text-muted-foreground">
              {current.original_filename}
            </p>

            {/* Thumbstrip: jump straight to a page in a long register. */}
            {total > 1 && (
              <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
                {pages.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={
                      i === safeIndex
                        ? "size-8 shrink-0 rounded-md bg-brand text-xs font-semibold text-white"
                        : "size-8 shrink-0 rounded-md bg-muted text-xs font-medium text-muted-foreground hover:bg-muted/70"
                    }
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => openPageInTab(register.id, current.id)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-muted/50"
              >
                <ExternalLink className="size-4" />
                Open in tab
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadRegisterPage(
                    register.id,
                    current.id,
                    current.original_filename || `register_${register.id}_${current.id}`,
                  )
                }
                className="inline-flex h-10 items-center gap-2 rounded-full border border-sidebar px-4 text-sm font-medium text-sidebar hover:bg-sidebar/5"
              >
                <Download className="size-4" />
                Download
              </button>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => onDeletePage(current.id)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-red-300 px-4 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="size-4" />
                  Delete page
                </button>
              )}
            </div>
          </>
        )}
      </DialogPopup>
    </Dialog>
  )
}
