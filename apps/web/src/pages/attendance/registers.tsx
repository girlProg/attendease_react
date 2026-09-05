import { useRef, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import {
  Upload,
  AlertCircle,
  Images,
  CheckCircle2,
  CircleSlash,
  ChevronDown,
  ChevronRight,
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
import { SearchBar } from "@/components/search-bar"
import { TableEmptyState } from "@/components/table-empty-state"
import { TableSkeletonRows } from "@/components/skeleton"
import { RegisterSlideshow } from "@/components/register-slideshow"
import { usePagination } from "@/hooks/use-pagination"
import { useAuth } from "@/contexts/auth-context"
import {
  deleteRegisterPage,
  getRegisterCoverage,
  getSchoolRegisters,
  uploadSchoolRegister,
  type SchoolRegisterRow,
} from "@/api/attendance"

type SelectedIds = { school?: number; lga?: number; cohort?: number }

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
    err as { response?: { data?: { detail?: string; files?: string[] } } }
  )?.response?.data
  // DRF returns per-file validation errors under `files`.
  return data?.files?.[0] ?? data?.detail ?? fallback
}

/**
 * Termly school attendance registers. A register is the physical book,
 * photographed page by page — so an upload is a *set* of photos added to the
 * register for the selected school + year + term, and clicking a row pages
 * through those photos as a slideshow.
 *
 * Uploading is staff-only (`is_staff`), matching the server.
 */
export function Registers({
  filters = {},
  selectedIds = {},
}: {
  filters?: Record<string, string>
  selectedIds?: SelectedIds
}) {
  const { isStaffuser } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState("")
  const registerFilters = {
    school: selectedIds.school,
    year: filters.year,
    term: filters.term,
    search,
  }
  const { page, setPage, pageSize, handleRowsChange } = usePagination([registerFilters])

  const { data, isError, isLoading } = useQuery({
    queryKey: ["school-registers", page, pageSize, registerFilters],
    queryFn: () => getSchoolRegisters(page, pageSize, registerFilters),
    placeholderData: keepPreviousData,
  })

  const [uploadError, setUploadError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  // A staged upload: the files, plus the school they're bound for. The school
  // comes from the filter bar for the main button, or straight from a row in
  // the coverage panel — so it's carried explicitly rather than re-read from
  // the filters at submit time.
  const [pending, setPending] = useState<{
    files: File[]
    schoolId: number
    schoolName: string
  } | null>(null)

  const rows = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0
  // Re-read from the fresh list so the slideshow updates after a page delete.
  const viewingRegister = rows.find((row) => row.id === viewing) ?? null

  const canUpload =
    isStaffuser &&
    Boolean(selectedIds.school) &&
    Boolean(filters.year) &&
    Boolean(filters.term)

  // Does the school this upload is bound for already have a register this term?
  // Matched by ID — names repeat across cohorts.
  const existing = pending
    ? (rows.find(
        (row) =>
          row.school_id === pending.schoolId &&
          row.year === Number(filters.year) &&
          row.term === Number(filters.term),
      ) ?? null)
    : null

  const upload = useMutation({
    mutationFn: ({ files, schoolId }: { files: File[]; schoolId: number }) =>
      uploadSchoolRegister(
        schoolId,
        filters.year as string,
        filters.term as string,
        files,
      ),
    onSuccess: () => {
      setUploadError(null)
      setPending(null)
      queryClient.invalidateQueries({ queryKey: ["school-registers"] })
      queryClient.invalidateQueries({ queryKey: ["register-coverage"] })
    },
    onError: (err: unknown) => {
      setPending(null)
      setUploadError(errorMessage(err, "Upload failed. Please try again."))
    },
  })

  const removePage = useMutation({
    mutationFn: ({ registerId, pageId }: { registerId: number; pageId: number }) =>
      deleteRegisterPage(registerId, pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-registers"] })
      queryClient.invalidateQueries({ queryKey: ["register-coverage"] })
    },
    onError: (err: unknown) =>
      setUploadError(errorMessage(err, "Could not delete that page.")),
  })

  // Which school the next file-picker result belongs to. A ref, not state:
  // it's set immediately before opening the picker and read in its change
  // handler, so it must not wait for a re-render.
  const uploadTargetRef = useRef<{ schoolId: number; schoolName: string } | null>(null)

  function pickFilesFor(schoolId: number, schoolName: string) {
    uploadTargetRef.current = { schoolId, schoolName }
    fileInputRef.current?.click()
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const target = uploadTargetRef.current
    if (files.length && target) setPending({ files, ...target })
    e.target.value = ""
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBar placeholder="Find register by school name" onSearch={setSearch} />
        {isStaffuser && (
          <>
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
              onClick={() =>
                pickFilesFor(
                  selectedIds.school as number,
                  filters.school ?? `#${selectedIds.school}`,
                )
              }
              className="h-11 w-full shrink-0 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5 sm:w-auto"
            >
              <Upload className="size-4" />
              {upload.isPending ? "Uploading…" : "Upload Register Photos"}
            </Button>
          </>
        )}
      </div>

      {isStaffuser && !canUpload && (
        <p className="flex items-start gap-1 text-xs text-muted-foreground sm:justify-end">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          Select a school, year and term above to upload register photos.
        </p>
      )}
      {uploadError && (
        <p className="text-xs text-red-600 sm:text-right">{uploadError}</p>
      )}

      {isStaffuser && (
        <CoveragePanel
          filters={filters}
          selectedIds={selectedIds}
          onUploadFor={pickFilesFor}
        />
      )}

      {/* Confirm before sending: the filters above decide where these photos
          land, and a mis-set school filter is otherwise invisible. */}
      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogPopup className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto">
          <DialogTitle>Upload register photos?</DialogTitle>
          <DialogDescription>
            Check this is the right register before uploading.
          </DialogDescription>
          <dl className="mt-4 space-y-1 rounded-xl border border-border/60 p-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">School</dt>
              <dd className="min-w-0 break-words text-right font-medium text-foreground">
                {pending?.schoolName}
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
              <dd className="font-medium text-foreground">
                {pending?.files.length ?? 0}
              </dd>
            </div>
          </dl>
          {existing && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              This register already has {existing.page_count} photo(s). These{" "}
              {pending?.files.length ?? 0} will be <strong>added</strong> to it —
              nothing existing is replaced.
            </p>
          )}
          <ul className="mt-3 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-muted-foreground">
            {pending?.files.map((file) => (
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
              onClick={() =>
                pending &&
                upload.mutate({ files: pending.files, schoolId: pending.schoolId })
              }
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
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
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
            {isLoading ? (
              <TableSkeletonRows columns={7} />
            ) : rows.length === 0 ? (
              <TableEmptyState colSpan={7} />
            ) : (
              rows.map((row: SchoolRegisterRow) => (
                <TableRow
                  key={row.id}
                  onClick={() => setViewing(row.id)}
                  title="Click to page through this register"
                  className="cursor-pointer border-border/40 hover:bg-muted/30"
                >
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {viewingRegister && (
        <RegisterSlideshow
          register={viewingRegister}
          canWrite={isStaffuser}
          onDeletePage={(pageId) =>
            removePage.mutate({ registerId: viewingRegister.id, pageId })
          }
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

/**
 * Staff-only: for the selected year+term, which schools have handed in a
 * register and which still owe one. Collapsed by default so it doesn't crowd
 * the table.
 */
function CoveragePanel({
  filters,
  selectedIds,
  onUploadFor,
}: {
  filters: Record<string, string>
  selectedIds: SelectedIds
  onUploadFor: (schoolId: number, schoolName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ready = Boolean(filters.year) && Boolean(filters.term)

  const { data, isError } = useQuery({
    queryKey: [
      "register-coverage",
      filters.year,
      filters.term,
      selectedIds.lga,
      selectedIds.cohort,
    ],
    queryFn: () =>
      getRegisterCoverage({
        year: filters.year as string,
        term: filters.term as string,
        lga: selectedIds.lga ? String(selectedIds.lga) : undefined,
        cohort: selectedIds.cohort ? String(selectedIds.cohort) : undefined,
      }),
    enabled: ready,
  })

  if (!ready) {
    return (
      <div className="rounded-2xl border border-border/40 bg-white px-5 py-4 text-xs text-muted-foreground">
        Select a year and term above to see which schools are missing a register.
      </div>
    )
  }
  if (isError) return <QueryError />
  if (!data) return null

  return (
    <div className="rounded-2xl border border-border/40 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          Register coverage — {data.year} Term {data.term}
        </span>
        <span className="flex shrink-0 items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
            <CheckCircle2 className="size-4" />
            {data.uploaded_count} uploaded
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
            <CircleSlash className="size-4" />
            {data.missing_count} missing
          </span>
        </span>
      </button>

      {open && (
        <div className="grid gap-4 border-t border-border/40 p-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Missing ({data.missing_count})
            </p>
            {data.missing.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Every school has submitted a register. 🎉
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                {data.missing.map((school) => (
                  <li
                    key={school.school}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="min-w-0 break-words text-foreground">
                      {school.name}
                      <span className="ml-2 text-muted-foreground">{school.lga}</span>
                    </span>
                    {/* Upload straight from the row — no need to go back and
                        re-point the school filter at it. */}
                    <button
                      type="button"
                      onClick={() => onUploadFor(school.school, school.name)}
                      title={`Upload the register for ${school.name}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sidebar px-2.5 py-1 text-[11px] font-medium text-sidebar hover:bg-sidebar/5"
                    >
                      <Upload className="size-3" />
                      Upload
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Uploaded ({data.uploaded_count})
            </p>
            {data.uploaded.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No registers uploaded for this term yet.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                {data.uploaded.map((school) => (
                  <li key={school.school} className="flex justify-between gap-3">
                    <span className="min-w-0 break-words text-foreground">
                      {school.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {school.page_count} photo(s)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
