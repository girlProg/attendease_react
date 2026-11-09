import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogPopup, DialogTitle } from "@workspace/ui/components/dialog"
import { LabeledInput } from "@/components/form-fields"
import {
  closeEnrolmentForm,
  previewEnrolmentClose,
  type KoboEnrolmentForm,
} from "@/api/kobo"

function errorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  return detail ?? "That didn't work. Please try again."
}

/** What closing will do, then the one press that makes students of it. */
export function CloseEnrolmentDialog({
  form,
  onClose,
}: {
  form: KoboEnrolmentForm
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [verified, setVerified] = useState(false)
  const [typed, setTyped] = useState("")
  const preview = useQuery({
    queryKey: ["kobo-enrolment-close", form.id],
    queryFn: () => previewEnrolmentClose(form.id),
    gcTime: 0,
    retry: false,
  })
  const close = useMutation({
    mutationFn: () => closeEnrolmentForm(form.id, verified, typed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kobo-enrolments"] })
      queryClient.invalidateQueries({ queryKey: ["kobo-enrolment-forms"] })
      queryClient.invalidateQueries({ queryKey: ["kobo-forms"] })
    },
  })
  const summary = preview.data

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="max-h-[95vh] max-w-xl overflow-y-auto">
        <DialogTitle>Close and enrol {form.label}</DialogTitle>
        <div className="mt-4 space-y-3 text-sm">
          {preview.isLoading && <p>Checking the latest submissions…</p>}
          {preview.isError && <p className="text-destructive">{errorMessage(preview.error)}</p>}

          {close.isSuccess ? (
            <>
              <p>
                {close.data.to_enrol.toLocaleString()} students are enrolled. They are in Upload
                History as batch {close.data.batch_id}, where they can be reversed. This form has
                been switched off.
              </p>
              <Button onClick={onClose}>Done</Button>
            </>
          ) : (
            summary && (
              <>
                <p>
                  <strong>{summary.to_enrol.toLocaleString()}</strong> students will be enrolled:
                  everyone Passed and Kept. {summary.out.toLocaleString()} Out and{" "}
                  {summary.removed.toLocaleString()} Removed will not.
                </p>
                {summary.review > 0 && (
                  <p className="text-destructive">
                    {summary.review.toLocaleString()} still need review. Decide those first.
                  </p>
                )}
                {summary.new_schools.length > 0 && (
                  <p>New schools to be added: {summary.new_schools.join(", ")}</p>
                )}
                {summary.problem_count > 0 && (
                  <div className="text-destructive">
                    <p>
                      The upload wouldn't take {summary.problem_count.toLocaleString()}. Remove or
                      fix these first:
                    </p>
                    <ul className="mt-1 list-disc pl-5">
                      {summary.problems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.can_close && (
                  <>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={verified}
                        onChange={(event) => setVerified(event.target.checked)}
                      />
                      <span>
                        Mark these students verified. Tick this for enrolment done during
                        verification (Enrolment +).
                      </span>
                    </label>
                    <LabeledInput
                      label="Type the form's name to confirm"
                      value={typed}
                      onChange={setTyped}
                    />
                    {close.isError && (
                      <p className="text-destructive">{errorMessage(close.error)}</p>
                    )}
                    <Button
                      disabled={typed !== form.label || close.isPending}
                      onClick={() => close.mutate()}
                    >
                      {close.isPending
                        ? "Enrolling…"
                        : `Enrol ${summary.to_enrol.toLocaleString()} students`}
                    </Button>
                  </>
                )}
              </>
            )
          )}
        </div>
      </DialogPopup>
    </Dialog>
  )
}
