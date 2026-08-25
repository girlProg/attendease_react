import { useQuery } from "@tanstack/react-query"
import { Download, FileSpreadsheet } from "lucide-react"

import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { QueryError } from "@/components/query-error"
import {
  downloadAttendanceFile,
  fetchAttendanceFileText,
} from "@/api/attendance"

/**
 * Split one CSV line, honouring quoted fields (a Reason/Remark cell can contain
 * a comma). Small hand-rolled parser — the alternative is pulling in a CSV
 * library for a preview.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let value = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          value += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        value += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      out.push(value)
      value = ""
    } else {
      value += char
    }
  }
  out.push(value)
  return out
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  // Match the backend: strip the UTF-8 BOM the template emits, and normalise
  // \r\n and lone \r (Excel on macOS) to \n.
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "")
  if (lines.length === 0) return { header: [], rows: [] }
  return {
    header: splitCsvLine(lines[0] as string),
    rows: lines.slice(1).map((line) => splitCsvLine(line)),
  }
}

// The template wraps IDs as ="1-03" so Excel doesn't read them as dates.
function unwrapExcelGuard(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('="') && trimmed.endsWith('"')) {
    return trimmed.slice(2, -1)
  }
  return trimmed
}

/**
 * Preview an uploaded attendance file without downloading it. Browsers download
 * CSVs rather than rendering them, so this parses the file and shows it as a
 * table — the same end result as a PDF opening in a tab.
 */
export function CsvPreviewDialog({
  submissionId,
  title,
  onClose,
}: {
  submissionId: number
  title: string
  onClose: () => void
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["attendance-file-text", submissionId],
    queryFn: () => fetchAttendanceFileText(submissionId),
    staleTime: 5 * 60 * 1000,
  })

  const parsed = data ? parseCsv(data) : null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="flex max-h-[88vh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden">
        <DialogTitle className="flex items-center gap-2 pr-8">
          <FileSpreadsheet className="size-4 shrink-0 text-sidebar" />
          <span className="min-w-0 break-words">{title}</span>
        </DialogTitle>
        <DialogDescription>
          {parsed
            ? `${parsed.rows.length} row(s) — the file exactly as it was uploaded.`
            : "Loading the uploaded file…"}
        </DialogDescription>

        {isError && (
          <div className="mt-4">
            <QueryError />
          </div>
        )}

        {isLoading && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        )}

        {parsed && parsed.header.length > 0 && (
          <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl border border-border/40">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr>
                  {parsed.header.map((cell, i) => (
                    <th
                      key={i}
                      className="whitespace-nowrap border-b border-border/40 px-3 py-2 text-left font-semibold text-sidebar"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row, r) => (
                  <tr key={r} className="even:bg-muted/20">
                    {parsed.header.map((_, c) => (
                      <td
                        key={c}
                        className="whitespace-nowrap border-b border-border/20 px-3 py-1.5 text-muted-foreground"
                      >
                        {unwrapExcelGuard(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex shrink-0 justify-end gap-3">
          <button
            type="button"
            onClick={() => downloadAttendanceFile(submissionId)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-sidebar px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5"
          >
            <Download className="size-4" />
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50"
          >
            Close
          </button>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
