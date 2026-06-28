import { useState, useEffect, useMemo } from "react"
import { PaginationBar } from "@/components/pagination-bar"
import { AttendanceTable } from "@/components/attendance-table"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { getStudents, getAttendanceByStudentIds } from "@/api/attendance"

export function RealTime({ search = "", filters = {} }: { search?: string; filters?: Record<string, string> }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)

  useEffect(() => { setPage(1) }, [search, filters])

  const studentFilters = useMemo(() => ({
    ...filters,
    ...(search && { name: search }),
  }), [filters, search])

  const { data: studentData, isLoading, isError, error } = useQuery({
    queryKey: ["students", page, pageSize, studentFilters],
    queryFn: () => getStudents(page, pageSize, studentFilters),
    placeholderData: keepPreviousData,
  })

  const studentIds = useMemo(
    () => studentData?.results.map((student) => student.id) ?? [],
    [studentData],
  )

  const { data: attendanceMap } = useQuery({
    queryKey: ["attendance-map", studentIds, filters.term, filters.week],
    queryFn: () => getAttendanceByStudentIds(studentIds, filters),
    enabled: studentIds.length > 0,
  })

  const totalPages = studentData ? Math.ceil(studentData.count / pageSize) : 0

  if (isLoading && !studentData) return <p>Loading…</p>
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
        students={studentData?.results ?? []}
        attendanceMap={attendanceMap}
        page={page}
        pageSize={pageSize}
      />
    </div>
  )
}
