import { PaginationBar } from "@/components/pagination-bar"
import { AttendanceTable } from "@/components/attendance-table"
import { InactiveSchoolNotice } from "@/components/inactive-school-notice"
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

      {data && data.results.length === 0 && filters.schoolId && (
        <div className="rounded-2xl border border-border/40 bg-white px-5 py-4 text-center">
          <InactiveSchoolNotice
            school={Number(filters.schoolId)}
            schoolName={filters.school}
            cohort={filters.cohortId ? Number(filters.cohortId) : undefined}
          />
        </div>
      )}

      <AttendanceTable
        records={data?.results ?? []}
        page={page}
        pageSize={pageSize}
        isLoading={isLoading && !data}
      />
    </div>
  )
}
