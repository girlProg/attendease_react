import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

export function PaginationBar({
  totalPages,
  currentPage = 1,
  onPageChange,
  rowOptions = ["10", "20", "30", "50", "100"],
  defaultRows = "100",
  onRowsChange,
}: {
  totalPages: number
  currentPage?: number
  onPageChange?: (page: number) => void
  rowOptions?: string[]
  defaultRows?: string
  onRowsChange?: (rows: string) => void
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="inline-flex items-center gap-2 rounded-full bg-sidebar/10 px-4 py-1.5 text-sm font-medium text-sidebar">
        Show
        <Select defaultValue={defaultRows} onValueChange={onRowsChange}>
          <SelectTrigger className="h-7 w-auto rounded-full border-0 bg-white px-3 text-sm font-semibold text-sidebar shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rowOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        Rows
      </div>

      <div className="max-w-[320px] overflow-x-auto rounded-lg bg-sidebar sm:max-w-[400px]">
        <div className="flex items-center">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange?.(page)}
              className={
                currentPage === page
                  ? "flex h-10 min-w-10 items-center justify-center bg-white text-sm font-semibold text-sidebar"
                  : "flex h-10 min-w-10 items-center justify-center text-sm font-medium text-white hover:bg-white/20"
              }
            >
              {page}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
