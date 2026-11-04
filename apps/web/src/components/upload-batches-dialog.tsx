import { useState } from "react"
import { History, AlertCircle, Undo2, Trash2 } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/contexts/auth-context"
import { formatDateTime } from "@/lib/formatters"

import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TableSkeletonRows } from "@/components/skeleton"
import {
  getUploadBatches,
  reverseUploadBatch,
  type UploadBatch,
} from "@/api/beneficiary-upload"

type ReverseErrorBody = {
  error?: string
  detail?: string
  // {kind of record: created students with one}, when that blocked it.
  records?: Record<string, number>
}

function errorBody(error: unknown): ReverseErrorBody {
  return (error as { response?: { data?: ReverseErrorBody } })?.response?.data ?? {}
}

function errorMessage(error: unknown): string {
  const data = errorBody(error)
  return data.error ?? data.detail ?? "Could not reverse this batch."
}

const STATUS_LABELS: Record<UploadBatch["status"], string> = {
  committed: "committed",
  reversed: "reversed",
  partly_reversed: "partly reversed",
}

export function UploadBatchesDialog() {
  const queryClient = useQueryClient()
  const { isSuperuser } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  // The batch whose reversal was refused for records, and the typed batch
  // number that confirms deleting attendance.
  const [blockedId, setBlockedId] = useState<number | null>(null)
  const [typedNumber, setTypedNumber] = useState("")

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["upload-batches"],
    queryFn: getUploadBatches,
    enabled: open,
  })

  const reverse = useMutation({
    mutationFn: reverseUploadBatch,
    onSuccess: () => {
      setConfirmingId(null)
      setBlockedId(null)
      setTypedNumber("")
      queryClient.invalidateQueries({ queryKey: ["upload-batches"] })
      queryClient.invalidateQueries({ queryKey: ["students-summary"] })
      queryClient.invalidateQueries({ queryKey: ["students"] })
    },
    onError: (error, variables) => {
      const records = errorBody(error).records
      if (records && Object.keys(records).length > 0) setBlockedId(variables.id)
    },
  })
  const blockedRecords = blockedId !== null ? errorBody(reverse.error).records ?? {} : {}
  const keptCount = Object.entries(blockedRecords)
    .filter(([kind]) => kind !== "attendance")
    .reduce((sum, [, count]) => sum + count, 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setConfirmingId(null)
          setBlockedId(null)
          setTypedNumber("")
          reverse.reset()
        }
      }}
    >
      <DialogTrigger className="inline-flex h-11 items-center gap-2 rounded-full border border-sidebar bg-white px-5 text-sm font-medium text-sidebar hover:bg-sidebar/5">
        <History className="size-4" />
        Upload History
      </DialogTrigger>
      <DialogPopup className="max-h-[85vh] w-full max-w-3xl overflow-y-auto">
        <DialogTitle>Upload History</DialogTitle>
        <DialogDescription>
          Recent record uploads. Reversing a batch deletes the students it created
          and restores the records it changed.
        </DialogDescription>

        {reverse.isError && (
          <div className="mt-4 space-y-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              {errorMessage(reverse.error)}
            </p>
            {blockedId !== null && (
              <div className="space-y-3 border-t border-red-100 pt-3 text-xs text-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-white px-3 font-medium hover:bg-muted/50 disabled:opacity-50"
                    disabled={reverse.isPending}
                    onClick={() => reverse.mutate({ id: blockedId, mode: "keep" })}
                  >
                    <Undo2 className="size-3.5" />
                    Reverse the rest, keep these students
                  </button>
                  <span className="text-muted-foreground">
                    They keep their attendance and payments; the batch shows as partly reversed.
                  </span>
                </div>
                {isSuperuser && "attendance" in blockedRecords && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={typedNumber}
                      onChange={(event) => setTypedNumber(event.target.value)}
                      placeholder={`Type ${blockedId}`}
                      className="h-8 w-24 rounded-full border border-border bg-white px-3"
                    />
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1 rounded-full bg-destructive px-3 font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
                      disabled={reverse.isPending || typedNumber.trim() !== String(blockedId)}
                      onClick={() =>
                        reverse.mutate({
                          id: blockedId,
                          mode: "delete_attendance",
                          confirm: typedNumber.trim(),
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                      Delete their attendance and reverse
                    </button>
                    <span className="text-muted-foreground">
                      Cannot be undone.
                      {keptCount > 0 &&
                        " Students with payments, a replacement or a No Objection entry are still kept."}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-border/40">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold text-sidebar">#</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">When</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">Cohort</TableHead>
                <TableHead className="text-xs font-semibold text-sidebar">By</TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">Created</TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">Updated</TableHead>
                <TableHead className="text-center text-xs font-semibold text-sidebar">Status</TableHead>
                <TableHead className="text-right text-xs font-semibold text-sidebar">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeletonRows columns={8} rows={4} />
              ) : batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No uploads yet.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((batch: UploadBatch) => (
                  <TableRow key={batch.id} className="border-border/40">
                    <TableCell className="text-xs text-muted-foreground">{batch.id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(batch.created_at)}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">
                      {batch.cohort_name}
                      <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {batch.purpose === "verification" ? "Verification" : "Record update"}
                      </span>
                      {batch.filename && (
                        <span
                          className="block max-w-[14rem] truncate text-[11px] text-muted-foreground"
                          title={
                            Object.keys(batch.column_mapping ?? {}).length
                              ? Object.entries(batch.column_mapping)
                                  .map(([column, key]) => `${column} → ${key}`)
                                  .join("\n")
                              : "Template headers"
                          }
                        >
                          {batch.filename}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{batch.user_email}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{batch.created_count}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{batch.updated_count}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          batch.status === "committed"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                        title={
                          batch.status === "partly_reversed"
                            ? `Kept ${batch.kept_student_ids.length} students who had records: ${batch.kept_student_ids.join(", ")}`
                            : undefined
                        }
                      >
                        {STATUS_LABELS[batch.status]}
                      </span>
                      {batch.status === "partly_reversed" && (
                        <span className="block text-[10px] text-muted-foreground">
                          kept {batch.kept_student_ids.length}
                        </span>
                      )}
                      {batch.attendance_deleted > 0 && (
                        <span className="block text-[10px] text-muted-foreground">
                          {batch.attendance_deleted} attendance rows deleted
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {batch.status === "committed" &&
                        (confirmingId === batch.id ? (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1 rounded-full bg-destructive px-3 text-xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
                            disabled={reverse.isPending}
                            onClick={() => reverse.mutate({ id: batch.id })}
                          >
                            {reverse.isPending ? "Reversing…" : "Confirm reverse"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                            onClick={() => setConfirmingId(batch.id)}
                          >
                            <Undo2 className="size-3.5" />
                            Reverse
                          </button>
                        ))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
