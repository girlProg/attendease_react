import type { UploadMatch, UploadReport } from "@/api/beneficiary-upload"

// One row per file row: who it found (the file's name beside the stored one)
// and what it will change, or why it is skipped. Built from the preview the
// server already sent, so long numbers are masked there.

const HEADERS = [
  "Row",
  "Action",
  "Beneficiary ID",
  "Serial",
  "Found with",
  "Name in file",
  "Stored name",
  "School",
  "LGA",
  "Changes",
  "Reason",
]

export function foundWith(match: UploadMatch): string {
  return Object.entries(match.found_with)
    .map(([label, value]) => `${label}: ${value}`)
    .join("; ")
}

export function describeChanges(match: UploadMatch): string {
  return match.changes
    .map((change) => `${change.field}: ${change.old || "(blank)"} → ${change.new}`)
    .join("; ")
}

function cell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function downloadPreviewCsv(report: UploadReport, filename: string) {
  const reasons = new Map<number, string>()
  for (const warning of report.warnings ?? []) {
    const earlier = reasons.get(warning.row)
    reasons.set(warning.row, earlier ? `${earlier} ${warning.error}` : warning.error)
  }
  const lines = [HEADERS.join(",")]
  for (const row of report.preview ?? []) {
    const match = row.match
    lines.push(
      [
        row.row,
        row.action,
        // Excel would read 2-1309 as a date; the upload parser unwraps this.
        row.beneficiary_id ? `="${row.beneficiary_id}"` : "",
        match?.serial,
        match ? foundWith(match) : "",
        match?.file_name,
        match?.name,
        match?.school,
        match?.lga,
        match ? describeChanges(match) : "",
        reasons.get(row.row) ?? row.note,
      ]
        .map(cell)
        .join(","),
    )
  }
  // A byte-order mark so Excel reads the names as UTF-8.
  const byteOrderMark = String.fromCharCode(0xfeff)
  const blob = new Blob([byteOrderMark + lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
