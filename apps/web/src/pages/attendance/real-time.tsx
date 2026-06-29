import { useState, useEffect } from "react"
import { PaginationBar } from "@/components/pagination-bar"
import { AttendanceTable } from "@/components/attendance-table"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { getAttendance } from "@/api/attendance"

export function RealTime({ search = "", filters = {} }: { search?: string; filters?: Record<string, string> }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)

  useEffect(() => { setPage(1) }, [search, filters])

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
        onRowsChange={(value) => {
          setPageSize(Number(value))
          setPage(1)
        }}
      />

      <AttendanceTable
        records={data?.results ?? []}
        page={page}
        pageSize={pageSize}
      />
    </div>
  )
}
