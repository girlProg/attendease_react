import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogPopup, DialogTitle } from "@workspace/ui/components/dialog"
import { DetailField } from "@/components/detail-list"
import { LabeledInput } from "@/components/form-fields"
import { KoboSchoolChoice } from "@/components/kobo-school-choice"
import { PhotoCard } from "@/components/photo-viewer"
import { QueryError } from "@/components/query-error"
import {
  decideKoboEnrolment,
  getEnrolmentComparison,
  type ComparedField,
  type ComparedRecord,
  type EnrolmentAction,
  type KoboEnrolment,
} from "@/api/kobo"

const NO_STUDENT_NIN_STEP = 2
const FIELDS: { key: ComparedField; label: string }[] = [
  { key: "student_name", label: "Student" },
  { key: "date_of_birth", label: "Date of birth" },
  { key: "school", label: "School" },
  { key: "lga", label: "LGA" },
  { key: "student_nin", label: "Student NIN" },
  { key: "caregiver_name", label: "Caregiver" },
  { key: "caregiver_nin", label: "Caregiver NIN" },
  { key: "caregiver_bvn", label: "Caregiver BVN" },
  { key: "caregiver_phone", label: "Caregiver phone" },
]
const SCHOOL_PROBLEMS = ["School not on the MIS", "The school is a number", "No school on this form"]

function errorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  return detail ?? "That didn't work. Please try again."
}

function RecordColumn({ title, record }: { title: string; record: ComparedRecord }) {
  return (
    <section className="w-72 shrink-0 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-sidebar">{title}</h3>
        <p className="text-xs text-muted-foreground">
          {record.reference}
          {record.class_level ? ` · ${record.class_level}` : ""}
        </p>
      </div>
      <dl className="space-y-1 rounded-2xl border border-border/40 bg-white p-3">
        {FIELDS.map(({ key, label }) => {
          const same = record.same?.includes(key)
          return (
            <div key={key} className={`rounded-lg p-1.5 ${same ? "bg-emerald-50" : ""}`}>
              <DetailField label={same ? `${label} · same` : label} value={record[key]} />
            </div>
          )
        })}
      </dl>
      {record.photos.map((photo) => (
        <PhotoCard
          key={photo.title}
          title={photo.title}
          path={photo.path}
          saved={photo.saved}
          link={photo.link || undefined}
        />
      ))}
    </section>
  )
}

/** One submission beside whoever it was matched with, and what to do about it. */
export function EnrolmentReviewDialog({
  enrolment,
  onClose,
}: {
  enrolment: KoboEnrolment
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState("")
  const comparison = useQuery({
    queryKey: ["kobo-enrolment-compare", enrolment.id],
    queryFn: () => getEnrolmentComparison(enrolment.id),
  })
  const decide = useMutation({
    mutationFn: (body: { action: EnrolmentAction; note?: string; school?: number }) =>
      decideKoboEnrolment(enrolment.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kobo-enrolments"] })
      queryClient.invalidateQueries({ queryKey: ["kobo-enrolment-forms"] })
      queryClient.invalidateQueries({ queryKey: ["kobo-enrolment-compare", enrolment.id] })
      onClose()
    },
  })
  const decided = enrolment.decision !== ""
  const schoolProblem = SCHOOL_PROBLEMS.some((problem) => enrolment.reason.includes(problem))
  const canKeep = enrolment.outcome !== "passed" && enrolment.step !== NO_STUDENT_NIN_STEP
  // Going against what the rules decided has to say why.
  const keepNeedsNote = canKeep && enrolment.outcome === "out"
  const removeNeedsNote = enrolment.outcome === "passed"
  const hasNote = note.trim() !== ""

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="max-h-[95vh] max-w-5xl overflow-y-auto">
        <DialogTitle>{enrolment.student_name || "Enrolment submission"}</DialogTitle>
        <p className="mt-1 text-sm text-muted-foreground">{enrolment.reason}</p>

        {comparison.isError && <QueryError />}
        {comparison.data && (
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
            <RecordColumn title="This submission" record={comparison.data.this} />
            {comparison.data.others.map((other) => (
              <RecordColumn
                key={other.reference}
                title={other.on_the_mis ? "On the MIS" : "Another submission"}
                record={other}
              />
            ))}
          </div>
        )}

        {/* Stays in view while the photos above are scrolled through. */}
        <div className="sticky -bottom-6 -mx-6 -mb-6 mt-4 space-y-3 border-t bg-white px-6 py-4">
          {enrolment.is_enrolled ? (
            <p className="text-sm">
              Enrolled as {enrolment.beneficiary_id}. To change this, reverse the upload in Upload
              History.
            </p>
          ) : decided ? (
            <>
              <p className="text-sm">
                {enrolment.decision === "keep" ? "Kept" : "Removed"}
                {enrolment.decided_by_name ? ` by ${enrolment.decided_by_name}` : ""}
                {enrolment.decision_note ? `: ${enrolment.decision_note}` : ""}
              </p>
              <Button
                variant="outline"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ action: "undo" })}
              >
                Undo
              </Button>
            </>
          ) : (
            <>
              {schoolProblem && (
                <div className="max-w-sm">
                  <KoboSchoolChoice
                    lga={enrolment.lga}
                    disabled={decide.isPending}
                    onUse={(school) => decide.mutate({ action: "use_school", school })}
                    onAdd={() => decide.mutate({ action: "add_school" })}
                  />
                </div>
              )}
              <LabeledInput
                label={keepNeedsNote || removeNeedsNote ? "Why (required)" : "Why (optional)"}
                value={note}
                onChange={setNote}
              />
              <div className="flex flex-wrap gap-2">
                {canKeep && (
                  <Button
                    disabled={decide.isPending || (keepNeedsNote && !hasNote)}
                    onClick={() => decide.mutate({ action: "keep", note })}
                  >
                    Keep
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={decide.isPending || (removeNeedsNote && !hasNote)}
                  onClick={() => decide.mutate({ action: "remove", note })}
                >
                  Remove
                </Button>
              </div>
            </>
          )}
          {decide.isError && (
            <p className="text-sm text-destructive">{errorMessage(decide.error)}</p>
          )}
        </div>
      </DialogPopup>
    </Dialog>
  )
}
