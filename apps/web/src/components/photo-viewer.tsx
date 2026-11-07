import { useState, type ReactNode } from "react"
import { ExternalLink, ImageOff } from "lucide-react"

import { Dialog, DialogPopup, DialogTitle } from "@workspace/ui/components/dialog"
import { useProtectedImage } from "@/hooks/use-protected-image"

/** A photo opened large in a window, with a link to it at full size. */
export function PhotoWindow({
  open,
  onOpenChange,
  title,
  url,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  url?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-h-[95vh] max-w-3xl overflow-y-auto">
        <DialogTitle>{title}</DialogTitle>
        {url && (
          <div className="mt-4 space-y-3">
            <img
              src={url}
              alt={title}
              className="max-h-[75vh] w-full rounded-lg bg-muted object-contain"
            />
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            >
              Open full size
              <ExternalLink className="size-3" />
            </a>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  )
}

/** A photo that opens large when pressed; `children` is how it looks closed. */
export function ExpandablePhoto({
  title,
  url,
  children,
}: {
  title: string
  url?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  if (!url) return <>{children}</>
  return (
    <>
      <button
        type="button"
        title={`Open ${title.toLowerCase()}`}
        onClick={() => setOpen(true)}
        className="shrink-0 cursor-zoom-in rounded-2xl transition hover:opacity-90"
      >
        {children}
      </button>
      <PhotoWindow open={open} onOpenChange={setOpen} title={title} url={url} />
    </>
  )
}

/**
 * One of the student's photos, as a card in the Photos section.
 *
 * `path` is the protected API path; `saved` says the server has a local copy.
 * Without one, the original link (Kobo's, which needs a Kobo sign-in) is offered.
 */
export function PhotoCard({
  title,
  path,
  saved,
  link,
}: {
  title: string
  path?: string
  saved: boolean
  // The original link, offered when there is no local copy to show.
  link?: string
}) {
  const { data: url, isLoading, isError } = useProtectedImage(path, saved)
  const shown = saved && !isError ? url : undefined

  return (
    <figure className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-white p-3">
      {shown ? (
        <ExpandablePhoto title={title} url={shown}>
          <img
            src={shown}
            alt={title}
            className="h-44 w-full rounded-xl bg-muted object-cover"
          />
        </ExpandablePhoto>
      ) : (
        <div
          className={`flex h-44 w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-muted text-xs text-muted-foreground ${saved && isLoading ? "animate-pulse" : ""}`}
        >
          {!(saved && isLoading) && (
            <>
              <ImageOff className="size-5" />
              {link ? "Not saved on the system yet" : "No photo"}
            </>
          )}
        </div>
      )}
      <figcaption className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{title}</span>
        {!shown && link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            title="Kobo asks you to sign in"
            className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
          >
            Open in Kobo
            <ExternalLink className="size-3" />
          </a>
        )}
      </figcaption>
    </figure>
  )
}
