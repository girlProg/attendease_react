import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle, ArrowLeft, Download, FileSpreadsheet, Upload } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { QueryError } from "@/components/query-error"
import { StatusBadge } from "@/components/status-badge"
import { TableEmptyState } from "@/components/table-empty-state"
import { TableSkeletonRows } from "@/components/skeleton"
import { useLogVisit } from "@/hooks/use-log-visit"
import {
  downloadFindings,
  downloadStatement,
  getReconciliation,
  getReconciliations,
  getReconciliationStatus,
  uploadStatement,
  type FindingKind,
  type Reconciliation,
} from "@/api/reconciliation"
import { formatDate, formatDateTime, formatNaira } from "@/lib/formatters"
import { transferStatusBadge } from "@/lib/payment-status"

const FINDING_TONE: Record<FindingKind, string> = {
  paid_twice: "bg-red-50 text-red-700",
  paid_not_recorded: "bg-amber-50 text-amber-800",
  recorded_not_debited: "bg-sky-50 text-sky-800",
}

function errorDetail(error: unknown): string {
  const data = (error as { response?: { data?: { detail?: string } } })?.response?.data
  return data?.detail ?? "Could not read the statement."
}

/**
 * Payments › Reconciliation (admins): upload a Zenith statement and see where
 * it and our records disagree, narration by narration — paid more often than
 * recorded, paid but not recorded as paid, recorded as paid but not debited.
 * Every upload is kept, file and result, for downloading again.
 */
export function ReconciliationPage() {
  useLogVisit("Payments", "Visited Reconciliation")
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const status = useQuery({ queryKey: ["reconciliation-status"], queryFn: getReconciliationStatus })
  const list = useQuery({ queryKey: ["reconciliations"], queryFn: () => getReconciliations() })
  const shownId = selectedId ?? list.data?.results[0]?.id ?? null
  const detail = useQuery({
    queryKey: ["reconciliation", shownId],
    queryFn: () => getReconciliation(shownId as number),
    enabled: shownId !== null,
  })

  const upload = useMutation({
    mutationFn: (chosen: File) => uploadStatement(chosen),
    onSuccess: (saved) => {
      setFile(null)
      if (fileInput.current) fileInput.current.value = ""
      setSelectedId(saved.id)
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] })
      queryClient.invalidateQueries({ queryKey: ["reconciliation-status"] })
    },
  })

  const reconciliations = list.data?.results ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/payments")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-white hover:bg-foreground/90"
          title="Back to payments"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-foreground">Reconciliation</h2>
          <p className="text-sm text-muted-foreground">
            Upload a Zenith account statement to check it against the payments sent. Each
            student's debits (less reversals) are matched to the transfers the bank confirmed,
            by the narration on the statement.
          </p>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border border-border/40 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="text-sm"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              upload.reset()
            }}
          />
          <Button
            className="h-10 gap-2 rounded-full bg-sidebar px-5 text-white hover:bg-sidebar/90 disabled:opacity-50"
            disabled={!file || upload.isPending}
            onClick={() => file && upload.mutate(file)}
          >
            <Upload className="size-4" />
            {upload.isPending ? "Reconciling…" : "Upload and reconcile"}
          </Button>
        </div>
        {upload.isError && (
          <p className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {errorDetail(upload.error)}
          </p>
        )}
        {status.data && (
          <p className={`text-xs ${status.data.sent_since ? "text-amber-700" : "text-muted-foreground"}`}>
            {status.data.reconciled_to
              ? `Reconciled up to ${formatDate(status.data.reconciled_to)}.`
              : "No statement reconciled yet."}
            {status.data.sent_since > 0 &&
              ` ${status.data.sent_since.toLocaleString()} transfer(s) sent since then are not yet reconciled.`}
          </p>
        )}
      </section>

      {list.isError && <QueryError />}
      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold text-sidebar">Period</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Statement</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Uploaded</TableHead>
              <TableHead className="text-right text-xs font-semibold text-sidebar">Debits (net)</TableHead>
              <TableHead className="text-right text-xs font-semibold text-sidebar">Recorded paid</TableHead>
              <TableHead className="text-right text-xs font-semibold text-sidebar">Findings</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && <TableSkeletonRows columns={7} rows={3} />}
            {!list.isLoading && reconciliations.length === 0 && (
              <TableEmptyState colSpan={7} message="No statements uploaded yet." />
            )}
            {reconciliations.map((item) => (
              <TableRow
                key={item.id}
                className={`cursor-pointer border-border/40 ${item.id === shownId ? "bg-sidebar/5" : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                <TableCell className="text-sm font-medium">
                  {formatDate(item.period_start)} – {formatDate(item.period_end)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.filename}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.uploaded_by}, {formatDateTime(item.created_at)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {item.totals.net_debits.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {item.totals.recorded_paid.toLocaleString()}
                </TableCell>
                <TableCell
                  className={`text-right text-sm font-semibold ${item.exception_count ? "text-red-700" : "text-emerald-700"}`}
                >
                  {item.exception_count ? item.exception_count.toLocaleString() : "None"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="outline"
                      className="h-8 gap-1 rounded-full px-3 text-xs"
                      title="Download the statement as uploaded"
                      onClick={() => downloadStatement(item)}
                    >
                      <FileSpreadsheet className="size-3.5" />
                      Statement
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 gap-1 rounded-full px-3 text-xs"
                      title="Download the findings as CSV"
                      onClick={() => downloadFindings(item)}
                    >
                      <Download className="size-3.5" />
                      Findings
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {detail.data && <ReconciliationDetail reconciliation={detail.data} />}
    </div>
  )
}

function ReconciliationDetail({ reconciliation }: { reconciliation: Reconciliation }) {
  const totals = reconciliation.totals
  const findings = reconciliation.exceptions ?? []
  const figures = [
    ["Transfer debits", totals.transfer_debits.toLocaleString(), formatNaira(Number(totals.transfer_debit_amount))],
    ["Reversals", totals.reversals.toLocaleString(), formatNaira(Number(totals.reversal_amount))],
    ["Net debits", totals.net_debits.toLocaleString(), ""],
    ["Recorded paid", totals.recorded_paid.toLocaleString(), formatNaira(Number(totals.recorded_paid_amount))],
    ["Transfers sent", totals.transfers_sent.toLocaleString(), ""],
    ["Narrations agreeing", totals.narrations_agree.toLocaleString(), ""],
  ]

  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-white p-5">
      <div>
        <h3 className="text-base font-bold text-foreground">
          {formatDate(reconciliation.period_start)} – {formatDate(reconciliation.period_end)}
        </h3>
        <p className="text-xs text-muted-foreground">
          {findings.length
            ? `${totals.paid_twice} paid more often than recorded, ${totals.paid_not_recorded} paid but not recorded as paid, ${totals.recorded_not_debited} recorded as paid but not debited.`
            : "The statement and our records agree."}
          {totals.unreadable_lines > 0 &&
            ` ${totals.unreadable_lines} AGILE line(s) on the statement couldn't be read and were left out.`}
          {" "}A transfer sent on the last day can show as not debited if the bank posted it the next day.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {figures.map(([label, count, amount]) => (
          <div key={label} className="rounded-xl bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold text-foreground">{count}</p>
            {amount && <p className="text-xs text-muted-foreground">{amount}</p>}
          </div>
        ))}
      </div>

      {findings.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold text-sidebar">Finding</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Narration on the statement</TableHead>
                <TableHead className="text-right text-xs font-semibold text-sidebar">Debits − reversals</TableHead>
                <TableHead className="text-right text-xs font-semibold text-sidebar">Recorded paid</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Our transfers</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Statement lines</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((finding) => (
                <TableRow key={`${finding.kind}-${finding.narration}`} className="border-border/40 align-top">
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${FINDING_TONE[finding.kind]}`}>
                      {finding.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{finding.narration}</TableCell>
                  <TableCell className="text-right text-sm">
                    {finding.statement_debits} − {finding.statement_reversals}
                  </TableCell>
                  <TableCell className="text-right text-sm">{finding.recorded_paid}</TableCell>
                  <TableCell className="space-y-1 text-xs">
                    {finding.transfers.length === 0 && <span className="text-muted-foreground">None on record</span>}
                    {finding.transfers.map((transfer) => {
                      const badge = transferStatusBadge(transfer.status)
                      return (
                        <div key={transfer.transaction_ref} className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge variant={badge.variant} label={badge.label} />
                          <span className="font-mono">{transfer.transaction_ref}</span>
                          <span className="text-muted-foreground">
                            {transfer.student}
                            {transfer.sent_at ? `, ${formatDateTime(transfer.sent_at)}` : ""}
                          </span>
                        </div>
                      )
                    })}
                  </TableCell>
                  <TableCell className="space-y-0.5 text-xs text-muted-foreground">
                    {finding.statement_lines.length === 0 && "None"}
                    {finding.statement_lines.map((line) => (
                      <div key={line.line}>
                        {formatDate(line.date)} · {line.bank_ref || "no ref"}
                        {line.reversal ? " · reversal" : ""}
                      </div>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
