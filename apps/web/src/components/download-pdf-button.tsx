import { useState } from "react"
import { FileDown } from "lucide-react"

import { downloadFile } from "@/lib/blob-download"

/**
 * Download this page as a PDF report, made on the server with the filters
 * passed in `params` (the page's own, so the PDF shows what the page shows).
 * `missing` greys the button out and says what to choose first.
 */
export function DownloadPdfButton({
  path,
  params,
  filename,
  missing,
  label = "Download report",
  className,
}: {
  path: string
  params: Record<string, string | number | undefined>
  filename: string
  missing?: string | null
  label?: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const query = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  )

  return (
    <button
      type="button"
      disabled={busy || Boolean(missing)}
      title={missing ?? "A report of this page with charts (PDF), for the filters chosen"}
      onClick={async () => {
        setBusy(true)
        try {
          await downloadFile(path, filename, { params: query })
        } finally {
          setBusy(false)
        }
      }}
      className={
        className ??
        "inline-flex h-11 items-center gap-2 rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      <FileDown className="size-4" />
      {busy ? "Making report…" : label}
    </button>
  )
}
