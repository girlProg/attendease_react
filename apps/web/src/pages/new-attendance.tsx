import { useState, useEffect, useMemo } from "react"
import { FileSpreadsheet } from "lucide-react"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { AttendanceFilterBar } from "@/components/attendance-filter-bar"
import { PaginationBar } from "@/components/pagination-bar"
import { PrimaryButton } from "@/components/primary-button"
import { CsvUploadDialog } from "@/components/csv-upload-dialog"
import { useAttendanceFilters } from "@/hooks/use-attendance-filters"
import { getStudents, getAttendanceByStudentIds, downloadExcelTemplate, submitAttendanceSubmission } from "@/api/attendance"
import type { Student, AttendanceRecord } from "@/types"

const dayColumns = ["Mon", "Tue", "Wed", "Thu"] as const
const dayFields = ["monday", "tuesday", "wednesday", "thursday"] as const

export function NewAttendancePage() {
  const queryClient = useQueryClient()
  const { filters, setFilter, selectedIds, options } = useAttendanceFilters()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)

  const [dayOverrides, setDayOverrides] = useState<Record<number, Record<string, boolean>>>({})
  const [reasonOverrides, setReasonOverrides] = useState<Record<number, string>>({})
  const [remarkOverrides, setRemarkOverrides] = useState<Record<number, string>>({})
  const [successMessage, setSuccessMessage] = useState("")

  useEffect(() => {
    setPage(1)
    setDayOverrides({})
    setReasonOverrides({})
    setRemarkOverrides({})
  }, [filters])

  const { data: studentData } = useQuery({
    queryKey: ["students", "new", page, pageSize, filters],
    queryFn: () => getStudents(page, pageSize, filters),
    placeholderData: keepPreviousData,
  })

  const studentIds = useMemo(
    () => studentData?.results.map((student) => student.id) ?? [],
    [studentData],
  )

  const { data: attendanceMap } = useQuery({
    queryKey: ["attendance-map", "new", studentIds, filters.year, filters.term, filters.week],
    queryFn: () => getAttendanceByStudentIds(studentIds, filters),
    enabled: studentIds.length > 0,
  })

  const totalPages = studentData ? Math.ceil(studentData.count / pageSize) : 0

  function toggleDay(studentId: number, dayField: string) {
    setDayOverrides((previous) => {
      const currentAttendance = attendanceMap?.get(studentId)
      const existingValue = currentAttendance
        ? Boolean(currentAttendance[dayField as keyof AttendanceRecord])
        : false
      const currentOverride = previous[studentId]?.[dayField]
      const currentState = currentOverride !== undefined ? currentOverride : existingValue

      return {
        ...previous,
        [studentId]: {
          ...previous[studentId],
          [dayField]: !currentState,
        },
      }
    })
  }

  function isDayActive(student: Student, dayField: string) {
    const override = dayOverrides[student.id]?.[dayField]
    if (override !== undefined) return override

    const attendance = attendanceMap?.get(student.id)
    if (!attendance) return false
    return Boolean(attendance[dayField as keyof AttendanceRecord])
  }

  const { mutate: saveAttendance, isPending: isSaving } = useMutation({
    mutationFn: submitAttendanceSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-map"] })
      setDayOverrides({})
      setReasonOverrides({})
      setRemarkOverrides({})
      setSuccessMessage("Attendance saved successfully!")
      setTimeout(() => setSuccessMessage(""), 5000)
    },
  })

  function handleSave() {
    if (!selectedIds.school || !selectedIds.cohort || !filters.year || !filters.term || !filters.week) return
    const students = studentData?.results ?? []

    const records = students.map((student) => {
      const attendance = attendanceMap?.get(student.id)
      return {
        student_id: student.id,
        monday: isDayActive(student, "monday"),
        tuesday: isDayActive(student, "tuesday"),
        wednesday: isDayActive(student, "wednesday"),
        thursday: isDayActive(student, "thursday"),
        ...(reasonOverrides[student.id] || attendance?.reason
          ? { reason: reasonOverrides[student.id] ?? attendance?.reason ?? "" }
          : {}),
        ...(remarkOverrides[student.id] || attendance?.remark
          ? { remark: remarkOverrides[student.id] ?? attendance?.remark ?? "" }
          : {}),
      }
    })

    saveAttendance({
      school_id: selectedIds.school,
      cohort_id: selectedIds.cohort,
      year: Number(filters.year),
      term: Number(filters.term),
      week: Number(filters.week),
      records,
    })
  }

  return (
    <div className="space-y-6">
      <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} />

      {/* Action buttons */}
      <div className="flex flex-col justify-end gap-3 sm:flex-row">
        <CsvUploadDialog />
        <Button
          className="h-11 gap-2 rounded-full bg-emerald-500 px-6 text-white hover:bg-emerald-600 disabled:opacity-50"
          disabled={!selectedIds.school || !selectedIds.cohort}
          onClick={() => {
            if (selectedIds.school && selectedIds.cohort) {
              downloadExcelTemplate({
                school: selectedIds.school,
                cohort: selectedIds.cohort,
                term: filters.term,
                week: filters.week,
                year: filters.year,
              })
            }
          }}
        >
          <FileSpreadsheet className="size-4" />
          Download Excel Template
        </Button>
      </div>

      <PaginationBar
            totalPages={totalPages}
            currentPage={page}
            onPageChange={setPage}
            rowOptions={["100", "500", "1000", "2000"]}
            defaultRows={String(pageSize)}
            onRowsChange={(value) => {
              setPageSize(Number(value))
              setPage(1)
            }}
          />

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-16 text-center text-xs font-semibold text-sidebar">S/N</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Name</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">ID</TableHead>
                  <TableHead className="text-xs font-semibold text-sidebar">Class</TableHead>
                  {dayColumns.map((day) => (
                    <TableHead key={day} className="text-center text-xs font-semibold text-sidebar">{day}</TableHead>
                  ))}
                  <TableHead className="text-center text-xs font-semibold text-sidebar">Reason</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-sidebar">Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!studentData?.results || studentData.results.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      No data to display :/
                    </TableCell>
                  </TableRow>
                ) : studentData.results.map((student: Student, index: number) => {
                  const attendance = attendanceMap?.get(student.id)
                  return (
                    <TableRow key={student.id} className="border-border/40">
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {(page - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="size-8 shrink-0 rounded-md bg-muted" />
                          <span className="text-sm font-semibold text-foreground">{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{student.id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{student.current_class}</TableCell>
                      {dayFields.map((dayField) => {
                        const active = isDayActive(student, dayField)
                        return (
                          <TableCell key={dayField} className="text-center">
                            <button
                              type="button"
                              onClick={() => toggleDay(student.id, dayField)}
                              className={`inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                                active ? "bg-sidebar" : "bg-muted"
                              }`}
                            >
                              <span
                                className={`pointer-events-none block size-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                                  active ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </TableCell>
                        )
                      })}
                      <TableCell>
                        <Input
                          placeholder="Enter Reason"
                          value={reasonOverrides[student.id] ?? attendance?.reason ?? ""}
                          onChange={(event) =>
                            setReasonOverrides((previous) => ({ ...previous, [student.id]: event.target.value }))
                          }
                          className="h-9 rounded-lg border-border/60 bg-white text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Enter Remark"
                          value={remarkOverrides[student.id] ?? attendance?.remark ?? ""}
                          onChange={(event) =>
                            setRemarkOverrides((previous) => ({ ...previous, [student.id]: event.target.value }))
                          }
                          className="h-9 rounded-lg border-border/60 bg-white text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

      {successMessage && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
          {successMessage}
        </p>
      )}

      <div className="flex justify-center gap-3 pt-4">
        <PrimaryButton
          className="w-auto bg-destructive px-8 hover:bg-destructive/90"
          onClick={() => window.history.back()}
        >
          Cancel
        </PrimaryButton>
        <PrimaryButton
          className="w-auto px-8"
          disabled={isSaving || !selectedIds.school || !selectedIds.cohort || !filters.year || !filters.term || !filters.week}
          onClick={handleSave}
        >
          {isSaving ? "Saving…" : "Save Attendance"}
        </PrimaryButton>
      </div>
    </div>
  )
}
