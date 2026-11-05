import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { PrimaryButton } from "@/components/primary-button"
import { api } from "@/lib/api"
import type { ExportSpec } from "@/lib/blob-download"

/** Which columns a held download button's file holds (see useColumnDownload). */
export function ColumnPicker({
  spec,
  onClose,
  onDownload,
}: {
  spec: ExportSpec
  onClose: () => void
  onDownload: (columns?: string[]) => void
}) {
  const columns = useQuery({
    queryKey: ["export-columns", spec.path, spec.params],
    queryFn: () =>
      api
        .get<string[]>(spec.path, { params: { ...spec.params, list_columns: "true" } })
        .then((response) => response.data),
  })
  const [leftOut, setLeftOut] = useState<ReadonlySet<string>>(new Set())
  const all = columns.data ?? []
  const kept = all.filter((column) => !leftOut.has(column))

  function toggle(column: string) {
    const next = new Set(leftOut)
    if (!next.delete(column)) next.add(column)
    setLeftOut(next)
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="max-h-[85vh] overflow-y-auto">
        <DialogTitle>Choose the columns</DialogTitle>
        <DialogDescription>
          The file holds the same students as a normal download, with only the columns ticked here.
        </DialogDescription>

        <div className="mt-4 space-y-3">
          {columns.isError && (
            <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" />
              Could not load the columns. Please try again.
            </p>
          )}

          {all.length > 0 && (
            <>
              <div className="flex gap-3 text-xs font-semibold text-sidebar">
                <button type="button" className="hover:underline" onClick={() => setLeftOut(new Set())}>
                  Tick all
                </button>
                <button type="button" className="hover:underline" onClick={() => setLeftOut(new Set(all))}>
                  Clear all
                </button>
                <span className="ml-auto font-normal text-muted-foreground">
                  {kept.length} of {all.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {all.map((column) => (
                  <label key={column} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-sidebar"
                      checked={!leftOut.has(column)}
                      onChange={() => toggle(column)}
                    />
                    {column}
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
              Cancel
            </DialogClose>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={kept.length === 0}
              onClick={() => {
                onDownload(kept.length === all.length ? undefined : kept)
                onClose()
              }}
            >
              Download
            </PrimaryButton>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
