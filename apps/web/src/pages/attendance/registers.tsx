import { useRef, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import {
  Download,
  Upload,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Images,
} from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { PrimaryButton } from "@/components/primary-button"
import { PaginationBar } from "@/components/pagination-bar"
import { QueryError } from "@/components/query-error"
import { TableEmptyState } from "@/components/table-empty-state"
import { usePagination } from "@/hooks/use-pagination"
import { useAuth } from "@/contexts/auth-context"
import {
  deleteRegisterPage,
  downloadRegisterPage,
  getSchoolRegisters,
  uploadSchoolRegister,
  type SchoolRegisterRow,
} from "@/api/attendance"

type SelectedIds = { school?: number }

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function errorMessage(err: unknown, fallback: string): string {
  const data = (
    err as {
      response?: { data?: { detail?: string; files?: string[] } }
    }
  )?.response?.data
  // DRF returns per-file validation errors under `files`.
  return data?.files?.[0] ?? data?.detail ?? fallback
}

/**
 * Termly school attendance registers. A register is the physical book,
 * photographed page by page — so an upload is a *set* of photos that gets added
 * to the register for the selected school + year + term. Existing pages are
 * never overwritten; individual pages can be deleted to undo a mistake.
 */
export function Registers({
  filters = {},
  selectedIds = {},
}: {
  filters?: Record<string, string>
  selectedIds?: SelectedIds
}) {
  const { canWrite } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const registerFilters = {
    school: selectedIds.school,
    year: filters.year,
    term: filters.term,
  }
  const { page, setPage, pageSize, handleRowsChange } = usePagination([registerFilters])

  const { data, isError } = useQuery({
    queryKey: ["school-registers", page, pageSize, registerFilters],
    queryFn: () => getSchoolRegisters(page, pageSize, registerFilters),
    placeholderData: keepPreviousData,
  })

  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pending, setPending] = useState<File[] | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const rows = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0

  const canUpload =
    canWrite && Boolean(selectedIds.school) && Boolean(filters.year) && Boolean(filters.term)

  // The register the pending upload would land in, if one already exists — used
  // to tell the user what they're adding to before anything is sent.
  const existing = rows.find(
    (row) =>
      row.year === Number(filters.year) && row.term === Number(filters.term),
  )

  const upload = useMutation({
    mutationFn: (files: File[]) =>
      uploadSchoolRegister(
        selectedIds.school as number,
        filters.year as string,
        filters.term as string,
        files,
      ),
    onSuccess: () => {
      setUploadError(null)
      setPending(null)
      queryClient.invalidateQueries({ queryKey: ["school-registers"] })
    },
    onError: (err: unknown) => {
      setPending(null)
      setUploadError(errorMessage(err, "Upload failed. Please try again."))
    },
  })

  const removePage = useMutation({
    mutationFn: ({ registerId, pageId }: { registerId: number; pageId: number }) =>
      deleteRegisterPage(registerId, pageId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["school-registers"] }),
    onError: (err: unknown) =>
      setUploadError(errorMessage(err, "Could not delete that page.")),
  })

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) setPending(files)
    e.target.value = ""
  }

  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="flex flex-col items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
            className="hidden"
            onChange={handleFiles}
          />
          <Button
            variant="outline"
            disabled={!canUpload || upload.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
          >
            <Upload className="size-4" />
            {upload.isPending ? "Uploading…" : "Upload Register Photos"}
          </Button>
          {!canUpload && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="size-3.5" />
              Select a school, year and term above to upload register photos.
            </p>
          )}
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
        </div>
      )}

      {/* Confirm before sending: the filters above decide where these photos
          land, and a mis-set school filter is otherwise invisible. */}
      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogPopup>
          <DialogTitle>Upload register photos?</DialogTitle>
          <DialogDescription>
            Check this is the right register before uploading.
          </DialogDescription>
          <dl className="mt-4 space-y-1 rounded-xl border border-border/60 p-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">School</dt>
              <dd className="text-right font-medium text-foreground">
                {existing?.school ?? filters.schoolName ?? `#${selectedIds.school}`}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Year / Term</dt>
              <dd className="font-medium text-foreground">
                {filters.year} — Term {filters.term}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Photos</dt>
              <dd className="font-medium text-foreground">{pending?.length ?? 0}</dd>
            </div>
          </dl>
          {existing && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              This register already has {existing.page_count} photo(s). These{" "}
              {pending?.length ?? 0} will be <strong>added</strong> to it — nothing
              existing is replaced.
            </p>
          )}
          <ul className="mt-3 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-muted-foreground">
            {pending?.map((file) => (
              <li key={file.name} className="break-all">
                {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50"
            >
              Cancel
            </button>
            <PrimaryButton
              className="h-10 w-auto px-6"
              disabled={upload.isPending}
              onClick={() => pending && upload.mutate(pending)}
            >
              {upload.isPending ? "Uploading…" : "Upload"}
            </PrimaryButton>
          </div>
        </DialogPopup>
      </Dialog>

      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        defaultRows={String(pageSize)}
        onRowsChange={handleRowsChange}
      />

      {isError && <QueryError />}

      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-8" />
              <TableHead className="text-xs font-semibold text-sidebar">School</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">LGA</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Year</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Term</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Photos</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Uploaded By</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmptyState colSpan={8} />
            ) : (
              rows.map((row) => (
                <RegisterRow
                  key={row.id}
                  row={row}
                  isOpen={expanded === row.id}
                  onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
                  canWrite={canWrite}
                  onDeletePage={(pageId) =>
                    removePage.mutate({ registerId: row.id, pageId })
                  }
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function RegisterRow({
  row,
  isOpen,
  onToggle,
  canWrite,
  onDeletePage,
}: {
  row: SchoolRegisterRow
  isOpen: boolean
  onToggle: () => void
  canWrite: boolean
  onDeletePage: (pageId: number) => void
}) {
  return (
    <>
      <TableRow className="cursor-pointer border-border/40" onClick={onToggle}>
        <TableCell className="text-muted-foreground">
          {isOpen ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </TableCell>
        <TableCell className="text-xs font-semibold text-sidebar">{row.school}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{row.lga}</TableCell>
        <TableCell className="text-center text-xs text-muted-foreground">{row.year}</TableCell>
        <TableCell className="text-center text-xs text-muted-foreground">{row.term}</TableCell>
        <TableCell className="text-center text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Images className="size-3.5" />
            {row.page_count}
          </span>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{row.uploaded_by ?? "—"}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{formatWhen(row.updated_at)}</TableCell>
      </TableRow>
      {isOpen && (
        <TableRow className="border-border/40 bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={8} className="p-0">
            <ul className="divide-y divide-border/40">
              {row.pages.length === 0 ? (
                <li className="px-6 py-3 text-xs text-muted-foreground">
                  No photos in this register yet.
                </li>
              ) : (
                row.pages.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-4 px-6 py-2"
                  >
                    <span className="min-w-0 break-all text-xs text-muted-foreground">
                      <span className="mr-2 font-medium text-sidebar">{i + 1}.</span>
                      {p.original_filename || `page ${p.id}`}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        title="Download this page"
                        onClick={() =>
                          downloadRegisterPage(
                            row.id,
                            p.id,
                            p.original_filename || `register_${row.id}_${p.id}`,
                          )
                        }
                        className="inline-flex items-center justify-center rounded-full p-1.5 text-sidebar hover:bg-sidebar/10"
                      >
                        <Download className="size-4" />
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          title="Delete this page"
                          onClick={() => onDeletePage(p.id)}
                          className="inline-flex items-center justify-center rounded-full p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
