import { AlertCircle, CheckCircle, Loader2, X } from "lucide-react"

import { dismissDownload, useDownloadNotices } from "@/lib/download-status"

function size(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** The corner notices for downloads in progress, saved or failed. */
export function DownloadNotices() {
  const notices = useDownloadNotices()
  if (notices.length === 0) return null

  return (
    <div
      className="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      aria-live="polite"
    >
      {notices.map((notice) => (
        <div
          key={notice.id}
          className="flex items-start gap-3 rounded-xl border border-border bg-white p-3 text-sm shadow-lg"
        >
          {notice.state === "preparing" ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-sidebar" />
          ) : notice.state === "done" ? (
            <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              {notice.state === "preparing"
                ? "Preparing your download…"
                : notice.state === "done"
                  ? "Downloaded"
                  : "Download failed"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {notice.filename}
              {notice.state === "preparing" && notice.received > 0
                ? ` · ${size(notice.received)} received`
                : ""}
              {notice.state === "failed" ? " · please try again" : ""}
            </p>
          </div>
          {notice.state !== "preparing" && (
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismissDownload(notice.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
