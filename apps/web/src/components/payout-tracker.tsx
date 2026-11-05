import { useState } from "react"
import { AlertTriangle, Check, ChevronDown, Copy, LoaderCircle, RefreshCw, X } from "lucide-react"

import type { DisbursementRun } from "@/api/payments"
import { formatNaira } from "@/lib/formatters"
import { shortWhen } from "@/lib/payout-run"

type UploadState = "sent" | "sending" | "waiting" | "not_sent"

interface UploadTile {
  number: number
  state: UploadState
  reference: string | null
  total: number
  paid: number
  inFlight: number
  failed: number
  // Times the bank has been asked about it, and when last (sent uploads only).
  checks: number
  lastCheckedAt: string | null
}

const CHIP: Record<UploadState, string> = {
  sent: "Sent",
  sending: "Sending",
  waiting: "Waiting",
  not_sent: "Not sent",
}

// The fewest uploads of equal size, as the server splits what is left.
function equalSplit(count: number, uploads: number): number[] {
  if (uploads <= 0) return []
  const size = Math.floor(count / uploads)
  const larger = count % uploads
  return Array.from({ length: uploads }, (_, index) => size + (index < larger ? 1 : 0))
}

/** Every upload of the run, sent or still to go, for the bar and the tiles. */
function uploadTiles(run: DisbursementRun): UploadTile[] {
  const total = Math.max(run.uploads_total, run.uploads.length)
  const sentTransfers = run.uploads.reduce((sum, upload) => sum + upload.counts.total, 0)
  const toGo = total - run.uploads.length
  const queuedSizes = equalSplit(
    Math.max(run.payment_count - run.skipped_count - sentTransfers, 0),
    toGo,
  )
  const moving = run.status === "queued" || run.status === "sending"
  // An upload already saved and on its way: the next one waits for it.
  const oneOnItsWay = run.uploads.some(
    (upload) => upload.status === "sending" || upload.status === "pending",
  )
  return Array.from({ length: total }, (_, index) => {
    const upload = run.uploads[index]
    if (upload) {
      const beingSent = upload.status === "sending" || upload.status === "pending"
      return {
        number: index + 1,
        state: beingSent && moving ? "sending" : "sent",
        reference: upload.reference,
        total: upload.counts.total,
        paid: upload.counts.successful,
        inFlight: upload.counts.in_flight,
        failed: upload.counts.failed,
        checks: upload.checks ?? 0,
        lastCheckedAt: upload.last_checked_at ?? null,
      }
    }
    const nextUp = index === run.uploads.length && run.status === "sending" && !oneOnItsWay
    return {
      number: index + 1,
      state: run.status === "stopped" ? "not_sent" : nextUp ? "sending" : "waiting",
      reference: null,
      total: queuedSizes[index - run.uploads.length] ?? 0,
      paid: 0,
      inFlight: 0,
      failed: 0,
      checks: 0,
      lastCheckedAt: null,
    }
  })
}

function headline(run: DisbursementRun, tiles: UploadTile[]) {
  if (run.status === "queued") return "Waiting to start"
  if (run.status === "sending") {
    const sending = tiles.find((tile) => tile.state === "sending")
    return `Sending upload ${sending?.number ?? run.uploads_sent + 1} of ${tiles.length || "…"}`
  }
  return "Waiting for the bank"
}

// Long references differ only at the end: keep both ends visible.
function middleTruncate(text: string, keepStart = 16, keepEnd = 12) {
  return text.length <= keepStart + keepEnd + 1
    ? text
    : `${text.slice(0, keepStart)}…${text.slice(-keepEnd)}`
}

/** Paid, still at the bank and failed, as shares of one bar. */
function SplitBar({ tile, className = "h-1.5" }: { tile: UploadTile; className?: string }) {
  const share = (value: number) => `${tile.total ? (value / tile.total) * 100 : 0}%`
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={tile.total}
      aria-valuenow={tile.paid + tile.failed}
      className={`flex gap-0.5 overflow-hidden rounded-full bg-sidebar/10 ${className}`}
    >
      <div className="bg-emerald-600 transition-all" style={{ width: share(tile.paid) }} />
      <div className="stripes-moving bg-sidebar/60 transition-all" style={{ width: share(tile.inFlight) }} />
      <div className="bg-orange-500 transition-all" style={{ width: share(tile.failed) }} />
    </div>
  )
}

function Legend({ tile }: { tile: UploadTile }) {
  return (
    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-emerald-600" />
        {tile.paid} paid
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-sidebar/60" />
        {tile.inFlight} in flight
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-orange-500" />
        {tile.failed} failed
      </span>
      {tile.reference && (
        <span
          className="inline-flex items-center gap-1.5"
          title={
            tile.lastCheckedAt
              ? `Last asked the bank at ${new Date(tile.lastCheckedAt).toLocaleTimeString()}`
              : "Not asked yet"
          }
        >
          <RefreshCw className="size-3" />
          {tile.checks.toLocaleString()} check{tile.checks === 1 ? "" : "s"}
        </span>
      )}
    </div>
  )
}

function Reference({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={reference}
      onClick={() => {
        navigator.clipboard?.writeText(reference).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          },
          () => undefined,
        )
      }}
      className="flex w-full min-w-0 items-center gap-1.5 rounded-lg border border-border/60 bg-white px-2 py-1 font-mono text-[10.5px] text-muted-foreground hover:border-sidebar/30"
    >
      <span className="min-w-0 truncate">{middleTruncate(reference)}</span>
      <span className="ml-auto shrink-0 text-muted-foreground/60">
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      </span>
    </button>
  )
}

function UploadCard({ tile }: { tile: UploadTile }) {
  const sending = tile.state === "sending"
  const meta =
    tile.state === "sent"
      ? `${tile.total} transfers sent to the bank`
      : sending
        ? tile.reference
          ? `Sending ${tile.total} transfers`
          : "Sending…"
        : tile.state === "not_sent"
          ? `${tile.total} transfers not sent, still ready to send`
          : tile.total
            ? `${tile.total} transfers queued`
            : "Waiting to be sent"
  return (
    <div
      className={`min-w-0 rounded-xl border px-3.5 py-3 ${
        sending ? "border-sidebar/30 bg-sidebar/5" : "border-border/40 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            tile.state === "sent"
              ? "bg-sidebar text-white"
              : sending
                ? "bg-sidebar/10 text-sidebar"
                : "border-[1.5px] border-border bg-white text-muted-foreground/70"
          }`}
        >
          {tile.state === "sent" ? (
            <Check className="size-3.5" strokeWidth={3} />
          ) : sending ? (
            <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2.6} />
          ) : (
            tile.number
          )}
        </span>
        <span className="text-[13px] font-semibold text-sidebar-accent-foreground">Upload {tile.number}</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wide ${
            tile.state === "sent"
              ? "bg-sidebar/10 text-sidebar"
              : sending
                ? "bg-sidebar text-white"
                : tile.state === "not_sent"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-muted text-muted-foreground/80"
          }`}
        >
          {CHIP[tile.state]}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{meta}</p>
      <SplitBar tile={tile} className="mt-2 h-1.5" />
      <Legend tile={tile} />
      <div className="mt-2.5">
        {tile.reference ? (
          <Reference reference={tile.reference} />
        ) : (
          <p className="py-1 text-[11px] text-muted-foreground/70">Batch reference assigned when sent</p>
        )}
      </div>
    </div>
  )
}

/**
 * While a school is being paid: replaces the Disburse bar (so nobody can send
 * it twice) with where the run has got, one segment per upload, and opens to
 * one tile per upload with its paid / in flight / failed split and reference.
 */
export function PayoutTracker({
  run,
  otherSchool,
  onSelect,
  onRefresh,
  refreshing,
}: {
  run: DisbursementRun
  // The run is paying a school, term or year other than the page's.
  otherSchool: boolean
  // Pressing the card, outside its buttons: show the run's school on the page.
  onSelect: () => void
  onRefresh: () => void
  refreshing: boolean
}) {
  const [open, setOpen] = useState(true)
  const tiles = uploadTiles(run)
  const inFlight = tiles.reduce((sum, tile) => sum + tile.inFlight, 0)
  // With the tiles closed, the bar on top carries what they would show.
  const summary = (tile: UploadTile) => !open && tile.state === "sent"

  return (
    <div
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest("button")) onSelect()
      }}
      className={`rounded-2xl bg-white p-3.5 shadow-[0_0_0_1.5px_rgb(75_63_214/0.2),0_8px_24px_rgb(75_63_214/0.10)] ${
        otherSchool ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 max-w-full items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar/10">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-sidebar opacity-50" />
              <span className="relative inline-flex size-2.5 rounded-full bg-sidebar" />
            </span>
          </div>
          {/* Wraps on a phone rather than running off the card. */}
          <button
            type="button"
            onClick={onSelect}
            title={otherSchool ? `Show ${run.school_name}` : undefined}
            className="min-w-0 break-words text-left leading-tight"
          >
            <span className="block text-sm font-bold text-sidebar-accent-foreground">{headline(run, tiles)}</span>
            <span className="block text-xs text-muted-foreground">
              {otherSchool && <span className="font-medium text-foreground underline">{run.school_name}</span>}
              {otherSchool && " · "}
              {inFlight} in flight · started {shortWhen(run.started_at ?? run.created_at)} by {run.created_by}
            </span>
          </button>
        </div>

        {tiles.length > 0 && (
          <div className="min-w-0 flex-1 basis-full sm:min-w-48 sm:basis-0 sm:px-2">
            <div className="flex gap-1.5">
              {tiles.map((tile) =>
                // Details closed: a sent upload's segment shows its paid / in
                // flight / failed split, as its tile would.
                summary(tile) ? (
                  <SplitBar key={tile.number} tile={tile} className="h-2 flex-1" />
                ) : (
                  <div
                    key={tile.number}
                    className={`h-2 flex-1 rounded-full ${
                      tile.state === "sent"
                        ? "bg-sidebar"
                        : tile.state === "sending"
                          ? "stripes-moving bg-sidebar/60"
                          : tile.state === "not_sent"
                            ? "bg-amber-300"
                            : "bg-sidebar/10"
                    }`}
                  />
                ),
              )}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {tiles.map((tile) => (
                <span
                  key={tile.number}
                  className={`flex-1 truncate text-[11px] ${
                    tile.state === "sent"
                      ? "font-medium text-sidebar"
                      : tile.state === "sending"
                        ? "font-semibold text-sidebar-accent-foreground"
                        : "font-medium text-muted-foreground/70"
                  }`}
                >
                  {tile.number} · {summary(tile) ? `${tile.paid} of ${tile.total} paid` : CHIP[tile.state]}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="Ask the bank now for the latest status of these transfers"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-sidebar/5 px-4 text-[13px] font-semibold text-sidebar hover:bg-sidebar/10 disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Checking…" : "Refresh"}
          </button>
          {tiles.length > 0 && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold text-sidebar ${
                open ? "bg-sidebar/10" : "bg-sidebar/5 hover:bg-sidebar/10"
              }`}
            >
              Details
              <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {run.detail && <p className="mt-2 text-xs text-amber-700">{run.detail}</p>}

      {open && tiles.length > 0 && (
        <div className="mt-3.5 grid grid-cols-1 gap-3 border-t border-border/40 pt-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <UploadCard key={tile.number} tile={tile} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Once the bank has answered for every transfer: paid against failed, a way
 * to the failed ones, and Dismiss (it is shown once).
 */
export function PayoutOutcome({
  run,
  onReviewFailed,
  onDismiss,
}: {
  run: DisbursementRun
  onReviewFailed: () => void
  onDismiss: () => void
}) {
  const stopped = run.status === "stopped"
  const total = run.uploads.reduce((sum, upload) => sum + upload.counts.total, 0)
  const paid = run.uploads.reduce((sum, upload) => sum + upload.counts.successful, 0)
  const failed = run.uploads.reduce((sum, upload) => sum + upload.counts.failed, 0)
  const unanswered = run.uploads.reduce((sum, upload) => sum + upload.counts.in_flight, 0)
  const share = (value: number) => `${total ? (value / total) * 100 : 0}%`

  return (
    <div
      className={`flex flex-wrap items-center gap-4 rounded-2xl bg-white p-3.5 ${
        stopped
          ? "shadow-[0_0_0_1.5px_rgb(245_158_11/0.35),0_8px_24px_rgb(245_158_11/0.10)]"
          : "shadow-[0_0_0_1.5px_rgb(5_150_105/0.25),0_8px_24px_rgb(5_150_105/0.10)]"
      }`}
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
          stopped ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {stopped ? <AlertTriangle className="size-5" /> : <Check className="size-5" strokeWidth={2.6} />}
      </div>
      <div className="min-w-0 break-words leading-tight">
        <p className="text-sm font-bold text-sidebar-accent-foreground">
          {stopped ? "Payout stopped" : "Payout finished"}
        </p>
        <p className="text-xs text-muted-foreground">
          {run.uploads_sent} of {run.uploads_total} uploads {stopped ? "sent" : "back"} · finished{" "}
          {shortWhen(run.finished_at ?? run.created_at)}
        </p>
      </div>

      <div className="min-w-0 flex-1 basis-full sm:min-w-48 sm:basis-0 sm:px-2">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-sidebar/10">
          <div className="bg-emerald-600" style={{ width: share(paid) }} />
          <div className="bg-orange-500" style={{ width: share(failed) }} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-3.5 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-600" />
            <b className="text-emerald-700">{paid}</b> paid · {formatNaira(paid * Number(run.amount))}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-orange-500" />
            <b className="text-red-600">{failed}</b> failed
          </span>
          {unanswered > 0 && <span>{unanswered} not answered by the bank</span>}
          {run.not_sent_count > 0 && <span>{run.not_sent_count} still ready to send</span>}
        </div>
        {stopped && run.detail && <p className="mt-1 text-xs text-amber-700">{run.detail}</p>}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {failed > 0 && (
          <button
            type="button"
            onClick={onReviewFailed}
            className="inline-flex h-10 items-center rounded-xl bg-red-50 px-4 text-[13px] font-semibold text-red-700 hover:bg-red-100"
          >
            Review {failed} failed
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss"
          aria-label="Dismiss"
          className="flex size-10 items-center justify-center rounded-xl bg-sidebar/5 text-muted-foreground hover:bg-sidebar/10"
        >
          <X className="size-[18px]" />
        </button>
      </div>
    </div>
  )
}
