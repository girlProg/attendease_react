import { useState } from "react"
import { UserRoundPlus } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { LabeledInput, LabeledSelect } from "@/components/form-fields"
import { getConfig } from "@/api/config"
import { replaceStudent } from "@/api/attendance"
import type { Student } from "@/types"

function replaceError(error: unknown): string {
  const data = (error as { response?: { data?: { error?: string; detail?: string } } })
    ?.response?.data
  return data?.error ?? data?.detail ?? "Could not replace the student. Please try again."
}

/**
 * Hand this student's beneficiary slot to another child.
 *
 * The caregiver, enrolment (beneficiary id and account), school and cohort
 * all stay: only the child changes. The outgoing student keeps her
 * attendance and payments and stops counting; the new one starts fresh.
 */
export function ReplaceStudentDialog({ student }: { student: Student }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [admissionNumber, setAdmissionNumber] = useState("")
  const [currentClass, setCurrentClass] = useState(student.current_class || student.class_name || "")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [nin, setNin] = useState("")

  const { data: config } = useQuery({ queryKey: ["config"], queryFn: getConfig })
  const reasons = config?.choices?.replacement_reason ?? []
  const reasonLabel = (value: string) =>
    reasons.find((option) => option.value === value)?.label ?? value

  const replace = useMutation({
    mutationFn: () =>
      replaceStudent(student.id, {
        name,
        reason,
        note,
        admission_number: admissionNumber,
        current_class: currentClass,
        date_of_birth: dateOfBirth || undefined,
        nin,
      }),
    onSuccess: ({ student: incoming }) => {
      queryClient.invalidateQueries({ queryKey: ["students"] })
      queryClient.invalidateQueries({ queryKey: ["student", student.id] })
      queryClient.invalidateQueries({ queryKey: ["student-history", student.id] })
      setOpen(false)
      navigate(`/beneficiaries/${incoming.id}`)
    },
  })

  const ready = name.trim().length > 0 && reason.length > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        className="h-10 gap-2 rounded-full border-sidebar !bg-white px-5 text-sidebar hover:bg-sidebar/5"
        onClick={() => setOpen(true)}
      >
        <UserRoundPlus className="size-4" />
        Replace student
      </Button>

      <DialogPopup className="flex max-h-[85vh] max-w-xl flex-col overflow-hidden">
        <DialogTitle>Replace {student.name}</DialogTitle>
        <DialogDescription>
          The household keeps its place in the programme: the caregiver
          {student.caregiver_name ? ` (${student.caregiver_name})` : ""}, beneficiary ID
          and bank account all stay. {student.name}&apos;s attendance and payments are
          kept on her record; the new child starts from nothing.
        </DialogDescription>

        <div className="mt-4 space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <LabeledSelect
                label="Reason for replacement"
                value={reason}
                onValueChange={(value) => setReason(value ?? "")}
                items={reasons.map((option) => option.value)}
                placeholder="Why is she leaving the programme?"
                formatItem={reasonLabel}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Note</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="Anything worth recording about the change"
                className="mt-1 w-full rounded-lg border border-border/60 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              The new student
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <LabeledInput label="Full name" value={name} onChange={setName} />
              </div>
              <LabeledInput label="Class" value={currentClass} onChange={setCurrentClass} />
              <LabeledInput
                label="Admission number"
                value={admissionNumber}
                onChange={setAdmissionNumber}
              />
              <LabeledInput
                label="Date of birth"
                value={dateOfBirth}
                onChange={setDateOfBirth}
                type="date"
              />
              <LabeledInput label="NIN" value={nin} onChange={setNin} />
            </div>
          </div>

          {replace.isError && (
            <p className="text-xs font-medium text-red-600">{replaceError(replace.error)}</p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <DialogClose className="inline-flex h-10 items-center rounded-full border border-border px-6 text-sm font-medium text-muted-foreground hover:bg-muted/50">
            Cancel
          </DialogClose>
          <Button
            className="h-10 rounded-full bg-sidebar px-6 text-sm text-white hover:bg-sidebar/90 disabled:opacity-50"
            disabled={!ready || replace.isPending}
            onClick={() => replace.mutate()}
          >
            {replace.isPending ? "Replacing…" : "Replace student"}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
