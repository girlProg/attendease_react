import { useState } from "react"
import { UserRoundCog } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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
import { getHouseholdSize, replaceCaregiver } from "@/api/attendance"
import type { Student } from "@/types"

function replaceError(error: unknown): string {
  const data = (error as { response?: { data?: { error?: string; detail?: string } } })
    ?.response?.data
  return data?.error ?? data?.detail ?? "Could not replace the caregiver. Please try again."
}

/**
 * Give this student a new caregiver.
 *
 * The student keeps her place; a new caregiver record takes over and the old
 * one is left as it was, so past payments still say who received them. Where
 * the programme pays the caregiver, the new account becomes the payee's.
 */
export function ReplaceCaregiverDialog({ student }: { student: Student }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [gender, setGender] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [nin, setNin] = useState("")
  const [bvn, setBvn] = useState("")
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [relationship, setRelationship] = useState("")
  const [relationshipOther, setRelationshipOther] = useState("")
  const [wholeHousehold, setWholeHousehold] = useState(true)

  const { data: config } = useQuery({ queryKey: ["config"], queryFn: getConfig })
  const reasons = config?.choices?.caregiver_replacement_reason ?? []
  const relationships = config?.choices?.caregiver_relationship ?? []
  const genders = config?.choices?.caregiver_gender ?? []
  const labelIn =
    (options: { value: string; label: string }[]) => (value: string) =>
      options.find((option) => option.value === value)?.label ?? value

  const caregiverId = student.caregiver?.id
  const { data: householdSize } = useQuery({
    queryKey: ["household-size", caregiverId],
    queryFn: () => getHouseholdSize(caregiverId!),
    enabled: open && caregiverId !== undefined,
  })
  const others = Math.max((householdSize ?? 1) - 1, 0)
  const paysCaregiver = student.cohort?.payee === "caregiver"

  const replace = useMutation({
    mutationFn: () =>
      replaceCaregiver(student.id, {
        name,
        reason,
        note,
        phone_number: phone,
        address,
        gender,
        date_of_birth: dateOfBirth || undefined,
        nin,
        bvn,
        bank_name: bankName,
        bank_account_number: accountNumber,
        relationship,
        relationship_other: relationshipOther,
        whole_household: others > 0 && wholeHousehold,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] })
      queryClient.invalidateQueries({ queryKey: ["student", student.id] })
      queryClient.invalidateQueries({ queryKey: ["student-history", student.id] })
      setOpen(false)
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
        <UserRoundCog className="size-4" />
        Replace caregiver
      </Button>

      <DialogPopup className="flex max-h-[85vh] max-w-xl flex-col overflow-hidden">
        <DialogTitle>Replace {student.caregiver_name || "the caregiver"}</DialogTitle>
        <DialogDescription>
          {student.name} keeps her place in the programme. A new caregiver record
          takes over; the old one stays on file so past payments still say who
          received them.
          {paysCaregiver
            ? " This cohort pays the caregiver, so the new account below becomes the payee account."
            : ""}
        </DialogDescription>

        <div className="mt-4 space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <LabeledSelect
                label="Reason for the change"
                value={reason}
                onValueChange={(value) => setReason(value ?? "")}
                items={reasons.map((option) => option.value)}
                placeholder="Why is the caregiver changing?"
                formatItem={labelIn(reasons)}
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

          {others > 0 && (
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <input
                type="checkbox"
                checked={wholeHousehold}
                onChange={(event) => setWholeHousehold(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                Also change the caregiver for the {others} other student
                {others === 1 ? "" : "s"} in this household. Untick to change it for{" "}
                {student.name} only.
              </span>
            </label>
          )}

          <div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              The new caregiver
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <LabeledInput label="Full name" value={name} onChange={setName} />
              </div>
              <LabeledSelect
                label={`Relationship to ${student.name}`}
                value={relationship}
                onValueChange={(value) => setRelationship(value ?? "")}
                items={relationships.map((option) => option.value)}
                placeholder="Select"
                formatItem={labelIn(relationships)}
              />
              {relationship === "other" ? (
                <LabeledInput
                  label="Specify relationship"
                  value={relationshipOther}
                  onChange={setRelationshipOther}
                />
              ) : (
                <LabeledSelect
                  label="Gender"
                  value={gender}
                  onValueChange={(value) => setGender(value ?? "")}
                  items={genders.map((option) => option.value)}
                  placeholder="Select"
                  formatItem={labelIn(genders)}
                />
              )}
              <LabeledInput label="Phone" value={phone} onChange={setPhone} />
              <LabeledInput
                label="Date of birth"
                value={dateOfBirth}
                onChange={setDateOfBirth}
                type="date"
              />
              <div className="sm:col-span-2">
                <LabeledInput label="Address" value={address} onChange={setAddress} />
              </div>
              <LabeledInput label="NIN" value={nin} onChange={setNin} />
              <LabeledInput label="BVN" value={bvn} onChange={setBvn} />
              <LabeledInput label="Bank" value={bankName} onChange={setBankName} />
              <LabeledInput
                label="Account number"
                value={accountNumber}
                onChange={setAccountNumber}
              />
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
            {replace.isPending ? "Replacing…" : "Replace caregiver"}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
