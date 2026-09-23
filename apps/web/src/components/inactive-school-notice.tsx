import { GraduationCap } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { getStudentStatusSummary } from "@/api/attendance"

/**
 * Why a school's attendance list is empty.
 *
 * An empty table says nothing: it could mean a school with no beneficiaries,
 * or one where every girl has finished. When a school is selected and no
 * student still counts, this says which — and, where they have all left,
 * how: graduated, replaced, or dropped out.
 */
export function InactiveSchoolNotice({
  school,
  schoolName,
  cohort,
}: {
  school?: number
  schoolName?: string
  cohort?: number
}) {
  const { data } = useQuery({
    queryKey: ["student-status-summary", school, cohort],
    queryFn: () => getStudentStatusSummary({ school: school!, cohort }),
    enabled: school !== undefined,
  })

  if (!data || data.active > 0) return null
  const name = schoolName ?? "this school"

  if (data.total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {name} has no beneficiaries{cohort ? " in this cohort" : ""}.
      </p>
    )
  }

  const parts = [
    data.graduated ? `${data.graduated} graduated` : "",
    data.replaced ? `${data.replaced} replaced` : "",
    data.dropped_out ? `${data.dropped_out} dropped out` : "",
  ].filter(Boolean)
  const everyone = data.graduated === data.total

  return (
    <div className="inline-flex flex-col items-center gap-1 text-sm">
      <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
        <GraduationCap className="size-4" aria-hidden="true" />
        {everyone
          ? `All ${data.total} student${data.total === 1 ? "" : "s"} at ${name} have graduated.`
          : `No student at ${name} still has attendance recorded.`}
      </span>
      <span className="text-xs text-muted-foreground">
        {everyone
          ? "There is no attendance to record for this school."
          : `Of ${data.total}: ${parts.join(", ")}.`}
      </span>
    </div>
  )
}
