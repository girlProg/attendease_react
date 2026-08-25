import { useRef, useState } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"
import { Download, Upload, AlertCircle } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Button } from "@workspace/ui/components/button"
import { PaginationBar } from "@/components/pagination-bar"
import { QueryError } from "@/components/query-error"
import { TableEmptyState } from "@/components/table-empty-state"
import { usePagination } from "@/hooks/use-pagination"
import { useAuth } from "@/contexts/auth-context"
import {
  downloadSchoolRegister,
  getSchoolRegisters,
  uploadSchoolRegister,
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

/**
 * End-of-year school attendance registers. Upload a scanned register for the
 * selected school + year (replaces any existing one); download prior ones.
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

  const registerFilters = { school: selectedIds.school, year: filters.year }
  const { page, setPage, pageSize, handleRowsChange } = usePagination([registerFilters])

  const { data, isError } = useQuery({
    queryKey: ["school-registers", page, pageSize, registerFilters],
    queryFn: () => getSchoolRegisters(page, pageSize, registerFilters),
    placeholderData: keepPreviousData,
  })

  const [uploadError, setUploadError] = useState<string | null>(null)
  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadSchoolRegister(
        selectedIds.school as number,
        filters.year as string,
        file,
      ),
    onSuccess: () => {
      setUploadError(null)
      queryClient.invalidateQueries({ queryKey: ["school-registers"] })
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail
      setUploadError(detail ?? "Upload failed. Please try again.")
    },
  })

  const canUpload = canWrite && Boolean(selectedIds.school) && Boolean(filters.year)

  const rows = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / pageSize) : 0

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload.mutate(file)
    e.target.value = ""
  }

  return (
    <div className="space-y-6">
      {canWrite && (
        <div className="flex flex-col items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            variant="outline"
            disabled={!canUpload || upload.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="h-11 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
          >
            <Upload className="size-4" />
            {upload.isPending ? "Uploading…" : "Upload Register"}
          </Button>
          {!canUpload && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="size-3.5" />
              Select a school and a year above to upload a register.
            </p>
          )}
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
        </div>
      )}

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
              <TableHead className="text-xs font-semibold text-sidebar">School</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">LGA</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Year</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">File</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Uploaded By</TableHead>
              <TableHead className="text-xs font-semibold text-sidebar">Uploaded</TableHead>
              <TableHead className="text-center text-xs font-semibold text-sidebar">Download</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmptyState colSpan={7} />
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="border-border/40">
                  <TableCell className="text-xs font-semibold text-sidebar">{row.school}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.lga}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{row.year}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.original_filename || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.uploaded_by ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatWhen(row.updated_at)}</TableCell>
                  <TableCell className="text-center">
                    <button
                      type="button"
                      onClick={() =>
                        downloadSchoolRegister(
                          row.id,
                          row.original_filename || `register_${row.id}`,
                        )
                      }
                      title="Download the register"
                      className="inline-flex items-center justify-center rounded-full p-1.5 text-sidebar hover:bg-sidebar/10"
                    >
                      <Download className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
