import { useState } from "react"
import { History, AlertCircle, Undo2 } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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
import {
  getUploadBatches,
  reverseUploadBatch,
  type UploadBatch,
} from "@/api/beneficiary-upload"

function errorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { error?: string; detail?: string } } })
    ?.response?.data
  return data?.error ?? data?.detail ?? "Could not reverse this batch."
}

export function UploadBatchesDialog() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["upload-batches"],
    queryFn: getUploadBatches,
    enabled: open,
  })

  const reverse = useMutation({
    mutationFn: reverseUploadBatch,
    onSuccess: () => {
      setConfirmingId(null)
      queryClient.invalidateQueries({ queryKey: ["upload-batches"] })
      queryClient.invalidateQueries({ queryKey: ["students-summary"] })
      queryClient.invalidateQueries({ queryKey: ["students"] })
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setConfirmingId(null)
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
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {errorMessage(reverse.error)}
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
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
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
                      {new Date(batch.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-foreground">{batch.cohort_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{batch.user_email}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{batch.created_count}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{batch.updated_count}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          batch.status === "reversed"
                            ? "bg-muted text-muted-foreground"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {batch.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {batch.status === "committed" &&
                        (confirmingId === batch.id ? (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1 rounded-full bg-destructive px-3 text-xs font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
                            disabled={reverse.isPending}
                            onClick={() => reverse.mutate(batch.id)}
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
