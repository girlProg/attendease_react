import { formatShortDate, useWeekDates } from "@/hooks/use-week-dates"
import { StudentLink } from "@/components/student-link"
import { useState, useEffect, useMemo, useRef } from "react"
import { Camera, FileArchive, FileSpreadsheet } from "lucide-react"
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
import { StudentPhoto } from "@/components/student-photo"
import { InactiveSchoolNotice } from "@/components/inactive-school-notice"
import { RegisterPhotoTips, RegisterRequestDialog, SmallPhotoWarning } from "@/components/register-photo"
import { REGISTER_ACCEPT, useSmallPhotos } from "@/hooks/use-small-photos"
import { TableSkeletonRows } from "@/components/skeleton"
import { useAttendanceFilters, type FilterKey } from "@/hooks/use-attendance-filters"
import { usePagination } from "@/hooks/use-pagination"
import { useSchoolWeek } from "@/hooks/use-school-week"
import {
  getStudents,
  getAttendanceByStudentIds,
  downloadExcelTemplate,
  downloadLgaTemplates,
  getSchoolRegisters,
  submitAttendanceSubmission,
  uploadSchoolRegister,
} from "@/api/attendance"
import { getTermLabel } from "@/lib/formatters"
import type { Student, AttendanceRecord } from "@/types"

const NEW_ATTENDANCE_FILTERS: readonly FilterKey[] = ["cohort", "term", "year", "lga", "school", "week"]

export function NewAttendancePage() {
  const queryClient = useQueryClient()
  const { filters, setFilter, scope, options } = useAttendanceFilters()
  const { params: scopeParams, ready: scopeReady } = scope(NEW_ATTENDANCE_FILTERS)
  const { activeDays, labelFor } = useSchoolWeek()

  const { page, setPage, pageSize, handleRowsChange } = usePagination([filters])

  const [dayOverrides, setDayOverrides] = useState<Record<number, Record<string, boolean>>>({})
  const [reasonOverrides, setReasonOverrides] = useState<Record<number, string>>({})
  const [remarkOverrides, setRemarkOverrides] = useState<Record<number, string>>({})
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  // The school register this week was recorded in: optional, sent after the
  // attendance saves. One register per school per term — an upload replaces
  // the photos already saved for that term.
  const [registerFiles, setRegisterFiles] = useState<File[]>([])
  const registerInputRef = useRef<HTMLInputElement>(null)
  const smallRegisterPhotos = useSmallPhotos(registerFiles)
  // The week just saved without a register, while we ask for one.
  const [registerRequest, setRegisterRequest] = useState<{
    schoolId: number
    year: number
    term: number
    week: number
  } | null>(null)
  const [registerError, setRegisterError] = useState<string | null>(null)

  useEffect(() => {
    setDayOverrides({})
    setReasonOverrides({})
    setRemarkOverrides({})
    setRegisterFiles([])
  }, [filters])

  const registerFilters = {
    school: scopeParams.school,
    year: scopeParams.year,
    term: scopeParams.term,
  }
  const { data: currentRegister } = useQuery({
    queryKey: ["school-registers", "new-attendance", registerFilters],
    queryFn: () => getSchoolRegisters(1, 1, registerFilters).then((data) => data.results[0] ?? null),
    enabled: scopeReady && Boolean(scopeParams.school && scopeParams.year && scopeParams.term),
  })

  const studentFilters = {
    cohort: scopeParams.cohort,
    lga: scopeParams.lga,
    school: scopeParams.school,
    // Only students who still count: graduated, replaced and dropped-out
    // girls no longer have attendance recorded.
    active: "true",
  }

  const studentQuery = useQuery({
    queryKey: ["students", "new", page, pageSize, studentFilters],
    queryFn: () => getStudents(page, pageSize, studentFilters),
    enabled: scopeReady,
    placeholderData: keepPreviousData,
  })
  const studentData = studentQuery.data
  const isStudentsLoading = studentQuery.isLoading || !scopeReady

  const studentIds = useMemo(
    () => studentData?.results.map((student) => student.id) ?? [],
    [studentData],
  )

  const { data: attendanceMap } = useQuery({
    queryKey: ["attendance-map", "new", studentIds, scopeParams.year, scopeParams.term, scopeParams.week],
    queryFn: () => getAttendanceByStudentIds(studentIds, scopeParams),
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

  const { mutate: uploadRegister, isPending: isUploadingRegister } = useMutation({
    mutationFn: ({ week, files }: { week: { schoolId: number; year: number; term: number }; files: File[] }) =>
      uploadSchoolRegister(week.schoolId, week.year, week.term, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-registers"] })
      queryClient.invalidateQueries({ queryKey: ["register-coverage"] })
      setRegisterFiles([])
      setRegisterRequest(null)
      setRegisterError(null)
      setSuccessMessage("Attendance and register photo saved.")
      setTimeout(() => setSuccessMessage(""), 5000)
    },
    onError: (error) => {
      const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data
      const first = data ? Object.values(data)[0] : null
      const reason = Array.isArray(first) ? first[0] : typeof first === "string" ? first : null
      const message =
        typeof reason === "string" ? reason : "The register photo didn't upload. Please try again."
      if (registerRequest) {
        setRegisterError(message)
      } else {
        setErrorMessage(`Attendance saved, but ${message.charAt(0).toLowerCase()}${message.slice(1)}`)
      }
    },
  })

  const { mutate: saveAttendance, isPending: isSaving } = useMutation({
    mutationFn: submitAttendanceSubmission,
    onSuccess: (_data, saved) => {
      const week = { schoolId: saved.school_id, year: saved.year, term: saved.term, week: saved.week }
      if (registerFiles.length > 0) {
        uploadRegister({ week, files: registerFiles })
      } else {
        setRegisterError(null)
        setRegisterRequest(week)
      }
      queryClient.invalidateQueries({ queryKey: ["attendance"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-map"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] })
      queryClient.invalidateQueries({ queryKey: ["attendance-popup"] })
      setDayOverrides({})
      setReasonOverrides({})
      setRemarkOverrides({})
      setErrorMessage("")
      setSuccessMessage("Attendance saved successfully!")
      setTimeout(() => setSuccessMessage(""), 5000)
    },
    onError: (error) => {
      setSuccessMessage("")
      // The server says why when it refuses — e.g. a week that hasn't begun.
      const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data
      const week = data?.week
      const reason = Array.isArray(week) ? week[0] : typeof week === "string" ? week : null
      setErrorMessage(
        typeof reason === "string" ? reason : "Failed to save attendance. Please try again.",
      )
    },
  })

  // The chosen week's dates (dated terms only), and whether it has begun —
  // the server refuses attendance for a week still to come.
  const { weekStart } = useWeekDates()
  const chosenWeekStart = scopeParams.week
    ? weekStart(scopeParams.year, scopeParams.term ?? "", scopeParams.week)
    : null
  const weekNotBegun = chosenWeekStart !== null && chosenWeekStart > new Date()

  function handleSave() {
    if (!scopeReady || !scopeParams.school || !scopeParams.cohort || !scopeParams.year || !scopeParams.term || !scopeParams.week) return
    const students = studentData?.results ?? []

    const records = students.map((student) => {
      const attendance = attendanceMap?.get(student.id)
      const dayValues = Object.fromEntries(
        activeDays.map((day) => [day, isDayActive(student, day)]),
      )
      return {
        student_id: student.id,
        ...dayValues,
        ...(reasonOverrides[student.id] || attendance?.reason
          ? { reason: reasonOverrides[student.id] ?? attendance?.reason ?? "" }
          : {}),
        ...(remarkOverrides[student.id] || attendance?.remark
          ? { remark: remarkOverrides[student.id] ?? attendance?.remark ?? "" }
          : {}),
      }
    })

    saveAttendance({
      school_id: scopeParams.school,
      cohort_id: scopeParams.cohort,
      year: Number(scopeParams.year),
      term: Number(scopeParams.term),
      week: Number(scopeParams.week),
      records,
    })
  }

  return (
    <div className="space-y-6">
      <AttendanceFilterBar filters={filters} setFilter={setFilter} options={options} keys={NEW_ATTENDANCE_FILTERS} />

      {/* Action buttons */}
      <div className="flex flex-col justify-end gap-3 sm:flex-row">
        <CsvUploadDialog />
        <Button
          className="h-11 gap-2 rounded-full bg-emerald-500 px-6 text-white hover:bg-emerald-600 disabled:opacity-50"
          disabled={!scopeParams.school || !scopeParams.cohort || !scopeParams.term || !scopeParams.week || !scopeParams.year}
          onClick={() => {
            if (scopeParams.school && scopeParams.cohort && scopeParams.term && scopeParams.week && scopeParams.year) {
              downloadExcelTemplate({
                school: scopeParams.school,
                cohort: scopeParams.cohort,
                term: scopeParams.term,
                week: scopeParams.week,
                year: scopeParams.year,
              })
            }
          }}
        >
          <FileSpreadsheet className="size-4" />
          Download Excel Template
        </Button>
        <Button
          className="h-11 gap-2 rounded-full bg-emerald-500 px-6 text-white hover:bg-emerald-600 disabled:opacity-50"
          disabled={!scopeParams.lga || !scopeParams.cohort || !scopeParams.term || !scopeParams.week || !scopeParams.year}
          onClick={() => {
            if (scopeParams.lga && scopeParams.cohort && scopeParams.term && scopeParams.week && scopeParams.year) {
              downloadLgaTemplates({
                lga: scopeParams.lga,
                cohort: scopeParams.cohort,
                term: scopeParams.term,
                week: scopeParams.week,
                year: scopeParams.year,
              })
            }
          }}
        >
          <FileArchive className="size-4" />
          Download All LGA Templates
        </Button>
      </div>

      {chosenWeekStart && (
        <p
          className={`rounded-xl border px-4 py-2 text-sm ${
            weekNotBegun
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-border/40 bg-white text-muted-foreground"
          }`}
        >
          Week {scopeParams.week} starts {formatShortDate(chosenWeekStart)}
          {weekNotBegun ? " — attendance can't be saved for a week that hasn't begun." : "."}
        </p>
      )}

      <PaginationBar
            totalPages={totalPages}
            currentPage={page}
            onPageChange={setPage}
            rowOptions={["100", "500", "1000", "2000"]}
            defaultRows={String(pageSize)}
            onRowsChange={handleRowsChange}
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
                  {activeDays.map((day) => (
                    <TableHead key={day} className="text-center text-xs font-semibold text-sidebar">{labelFor(day)}</TableHead>
                  ))}
                  <TableHead className="text-center text-xs font-semibold text-sidebar">Reason</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-sidebar">Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isStudentsLoading ? (
                  <TableSkeletonRows columns={6 + activeDays.length} />
                ) : (!studentData?.results || studentData.results.length === 0) ? (
                  <TableRow>
                    <TableCell
                      colSpan={6 + activeDays.length}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      {scopeParams.school ? (
                        <InactiveSchoolNotice
                          school={scopeParams.school}
                          schoolName={filters.school}
                          cohort={scopeParams.cohort}
                        />
                      ) : (
                        "No data to display :/"
                      )}
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
                          <StudentPhoto url={student.photo_url} name={student.name} studentId={student.id} hasPhoto={student.has_photo} />
                          <StudentLink studentId={student.id} newTab className="text-sm font-semibold text-foreground">{student.name}</StudentLink>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{student.id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{student.current_class}</TableCell>
                      {activeDays.map((dayField) => {
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

      {errorMessage && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
          {errorMessage}
        </p>
      )}

      {scopeParams.school && scopeParams.year && scopeParams.term && (
        <section className="space-y-3 rounded-2xl border border-border/40 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Register photo <span className="font-normal text-muted-foreground">(optional)</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A photo of the school register this week was recorded in, with this week filled
                in. It replaces the register photos saved for the{" "}
                {getTermLabel(scopeParams.term).toLowerCase()}.
                {currentRegister
                  ? ` Current: ${currentRegister.page_count} photo(s), uploaded ${formatShortDate(new Date(currentRegister.updated_at))}.`
                  : " None uploaded for this term yet."}
              </p>
            </div>
            <input
              ref={registerInputRef}
              type="file"
              multiple
              accept={REGISTER_ACCEPT}
              className="hidden"
              onChange={(event) => {
                setRegisterFiles(Array.from(event.target.files ?? []))
                event.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 gap-2 rounded-full"
              onClick={() => registerInputRef.current?.click()}
            >
              <Camera className="size-4" />
              {registerFiles.length === 0
                ? "Choose photo(s)"
                : registerFiles.length === 1
                  ? registerFiles[0].name
                  : `${registerFiles.length} photos chosen`}
            </Button>
          </div>
          <RegisterPhotoTips />
          <SmallPhotoWarning files={smallRegisterPhotos} />
        </section>
      )}

      <RegisterRequestDialog
        key={registerRequest ? `${registerRequest.schoolId}-${registerRequest.year}-${registerRequest.term}-${registerRequest.week}` : "none"}
        open={registerRequest !== null}
        week={registerRequest ? `week ${registerRequest.week}, ${getTermLabel(registerRequest.term)}` : ""}
        isUploading={isUploadingRegister}
        error={registerError}
        onUpload={(files) => registerRequest && uploadRegister({ week: registerRequest, files })}
        onSkip={() => {
          setRegisterRequest(null)
          setRegisterError(null)
        }}
      />

      <div className="flex justify-center gap-3 pt-4">
        <PrimaryButton
          className="w-auto bg-destructive px-8 hover:bg-destructive/90"
          onClick={() => window.history.back()}
        >
          Cancel
        </PrimaryButton>
        <PrimaryButton
          className="w-auto px-8"
          disabled={isSaving || !scopeReady || weekNotBegun || !scopeParams.school || !scopeParams.cohort || !scopeParams.year || !scopeParams.term || !scopeParams.week}
          onClick={handleSave}
        >
          {isSaving ? "Saving…" : isUploadingRegister ? "Uploading register…" : "Save Attendance"}
        </PrimaryButton>
      </div>
    </div>
  )
}
