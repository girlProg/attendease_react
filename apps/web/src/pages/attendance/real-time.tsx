import { PaginationBar } from "@/components/pagination-bar"
import { AttendanceTable } from "@/components/attendance-table"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { getAttendance } from "@/api/attendance"
import { usePagination } from "@/hooks/use-pagination"

export function RealTime({ search = "", filters = {} }: { search?: string; filters?: Record<string, string> }) {
  const { page, setPage, pageSize, handleRowsChange } = usePagination([search, filters])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["attendance", page, pageSize, search, filters],
    queryFn: () => getAttendance(page, pageSize, search, filters),
    placeholderData: keepPreviousData,
  })

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0

  if (isLoading && !data) return <p>Loading…</p>
  if (isError) return <p>{String(error)}</p>

  return (
    <div className="space-y-6">
      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        defaultRows={String(pageSize)}
        onRowsChange={handleRowsChange}
      />

      <AttendanceTable
        records={data?.results ?? []}
        page={page}
        pageSize={pageSize}
      />
    </div>
  )
}
