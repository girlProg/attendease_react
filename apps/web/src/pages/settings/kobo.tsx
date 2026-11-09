import { useState } from "react"
import { AlertCircle, Info } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogPopup, DialogTitle } from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { LabeledInput } from "@/components/form-fields"
import { QueryError } from "@/components/query-error"
import { useLogVisit } from "@/hooks/use-log-visit"
import { getCohorts } from "@/api/attendance"
import {
  addKoboForm,
  checkKoboFormNow,
  deleteKoboForm,
  getKoboForms,
  setKoboFormEnabled,
  updateKoboForm,
  type KoboForm,
  type KoboFormDetails,
  type KoboPurpose,
} from "@/api/kobo"

function lastChecked(form: KoboForm): string {
  return form.last_checked_at
    ? `Last checked ${new Date(form.last_checked_at).toLocaleString()}`
    : "Not checked yet"
}

/**
 * Verification and enrolment forms read from Kobo every 15 minutes. Off until
 * switched on; the first check brings in everything already submitted.
 * Superusers only, and every change goes to the activity log.
 */
export function KoboSettingsPage() {
  useLogVisit("Settings", "Visited Kobo Settings")
  const forms = useQuery({ queryKey: ["kobo-forms"], queryFn: getKoboForms })

  if (forms.isError) return <QueryError />
  if (!forms.data) return null
  const noToken = forms.data.some((form) => !form.token_configured)

  return (
    <div className="space-y-5">
      <AddFormSection />
      {noToken && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" />
          This server has no Kobo token yet, so no form can be read.
        </p>
      )}
      {forms.data.map((form) => (
        <FormCard key={form.id} form={form} />
      ))}
    </div>
  )
}

interface Draft {
  purpose: KoboPurpose
  cohort: string
  label: string
  assetUid: string
  householdCap: string
}

const EMPTY_DRAFT: Draft = {
  purpose: "verification",
  cohort: "",
  label: "",
  assetUid: "",
  householdCap: "3",
}

function draftIsComplete(draft: Draft): boolean {
  const capIsValid = draft.purpose === "verification" || Number(draft.householdCap) >= 1
  return Boolean(draft.cohort && draft.label.trim() && draft.assetUid.trim() && capIsValid)
}

function detailsOf(draft: Draft): KoboFormDetails {
  return {
    cohort: Number(draft.cohort),
    label: draft.label.trim(),
    asset_uid: draft.assetUid.trim(),
    purpose: draft.purpose,
    ...(draft.purpose === "enrolment" ? { household_cap: Number(draft.householdCap) } : {}),
  }
}

/** The fields of a form, for adding one and for editing one. */
function FormFields({
  draft,
  onChange,
  locked = false,
}: {
  draft: Draft
  onChange: (changes: Partial<Draft>) => void
  // Submissions are saved, so its type, cohort and Kobo form ID are fixed.
  locked?: boolean
}) {
  const cohorts = useQuery({ queryKey: ["cohorts"], queryFn: getCohorts })
  const chosen = cohorts.data?.find((item) => String(item.id) === draft.cohort)

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Type</label>
        <Select
          value={draft.purpose}
          disabled={locked}
          onValueChange={(value) => onChange({ purpose: (value as KoboPurpose) ?? "verification" })}
        >
          <SelectTrigger aria-label="Type" className="w-full">
            <SelectValue>{draft.purpose === "enrolment" ? "Enrolment" : "Verification"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="verification">Verification</SelectItem>
            <SelectItem value="enrolment">Enrolment</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Cohort</label>
        <Select
          value={draft.cohort}
          disabled={locked}
          onValueChange={(value) => onChange({ cohort: value ?? "" })}
        >
          <SelectTrigger aria-label="Cohort" className="w-full">
            <SelectValue>{chosen ? `Cohort ${chosen.name}` : "Choose"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {cohorts.data?.map((item) => (
              <SelectItem key={item.id} value={String(item.id)}>
                Cohort {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <LabeledInput label="Name" value={draft.label} onChange={(label) => onChange({ label })} />
      <LabeledInput
        label="Kobo form ID"
        value={draft.assetUid}
        disabled={locked}
        onChange={(assetUid) => onChange({ assetUid })}
      />
      {draft.purpose === "enrolment" && (
        <LabeledInput
          label="Most students to a household"
          value={draft.householdCap}
          onChange={(householdCap) => onChange({ householdCap })}
        />
      )}
    </div>
  )
}

function AddFormSection() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const add = useMutation({
    mutationFn: () => addKoboForm(detailsOf(draft)),
    onSuccess: () => {
      setDraft(EMPTY_DRAFT)
      queryClient.invalidateQueries({ queryKey: ["kobo-forms"] })
    },
  })

  return (
    <section className="space-y-3 rounded-2xl border bg-white p-5">
      <h2 className="font-semibold">Add a form</h2>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        The form ID is the part after /forms/ in the form's Kobo address. A new form starts off. An
        enrolment form fills the Enrolment Holding List, and students are made from it at Close and
        enrol.
      </p>
      <FormFields draft={draft} onChange={(changes) => setDraft({ ...draft, ...changes })} />
      {add.isError && (
        <p className="text-sm text-destructive">
          This form could not be added. Its form ID may already be in use.
        </p>
      )}
      <Button disabled={!draftIsComplete(draft) || add.isPending} onClick={() => add.mutate()}>
        Add form
      </Button>
    </section>
  )
}

function EditFormDialog({ form, onClose }: { form: KoboForm; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>({
    purpose: form.purpose,
    cohort: String(form.cohort),
    label: form.label,
    assetUid: form.asset_uid,
    householdCap: String(form.household_cap),
  })
  const save = useMutation({
    mutationFn: () => updateKoboForm(form.id, detailsOf(draft)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kobo-forms"] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="max-w-3xl">
        <DialogTitle>Edit {form.label}</DialogTitle>
        <div className="mt-4 space-y-3">
          {form.has_records && (
            <p className="text-sm text-muted-foreground">
              Submissions have come in from this form, so its type, cohort and Kobo form ID can't
              change.
            </p>
          )}
          <FormFields
            draft={draft}
            locked={form.has_records}
            onChange={(changes) => setDraft({ ...draft, ...changes })}
          />
          {save.isError && (
            <p className="text-sm text-destructive">
              This could not be saved. The form ID may already be in use.
            </p>
          )}
          <Button disabled={!draftIsComplete(draft) || save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  )
}

function DeleteFormDialog({ form, onClose }: { form: KoboForm; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState("")
  const remove = useMutation({
    mutationFn: () => deleteKoboForm(form.id, typed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kobo-forms"] })
      queryClient.invalidateQueries({ queryKey: ["kobo-enrolment-forms"] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogTitle>Delete {form.label}?</DialogTitle>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {form.has_records
              ? "Its saved submissions are deleted with it. Students stay as they are, and anything applied can still be reversed from Upload History. Adding the form again would bring every submission in again."
              : "No submissions have come in from this form."}
          </p>
          {form.has_records && (
            <LabeledInput label="Type the form's name to confirm" value={typed} onChange={setTyped} />
          )}
          {remove.isError && (
            <p className="text-sm text-destructive">
              This could not be deleted. If the form is being checked, try again in a moment.
            </p>
          )}
          <Button
            variant="destructive"
            disabled={(form.has_records && typed !== form.label) || remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete form
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  )
}

function FormCard({ form }: { form: KoboForm }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<"edit" | "delete" | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["kobo-forms"] })
  const toggle = useMutation({
    mutationFn: () => setKoboFormEnabled(form.id, !form.enabled),
    onSuccess: refresh,
  })
  const check = useMutation({ mutationFn: () => checkKoboFormNow(form.id), onSuccess: refresh })

  return (
    <section className="space-y-3 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{form.label}</h2>
          <p className="text-sm text-muted-foreground">
            Cohort {form.cohort_name} · {form.purpose === "enrolment" ? "Enrolment" : "Verification"} ·{" "}
            {form.asset_uid}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {form.enabled && (
            <Button variant="outline" disabled={check.isPending} onClick={() => check.mutate()}>
              {check.isSuccess ? "Check started" : "Check now"}
            </Button>
          )}
          <Button
            variant={form.enabled ? "outline" : "default"}
            disabled={toggle.isPending}
            onClick={() => toggle.mutate()}
          >
            {form.enabled ? "Switch off" : "Switch on"}
          </Button>
          <Button variant="outline" onClick={() => setOpen("edit")}>
            Edit
          </Button>
          <Button variant="outline" onClick={() => setOpen("delete")}>
            Delete
          </Button>
        </div>
      </div>
      {open === "edit" && <EditFormDialog form={form} onClose={() => setOpen(null)} />}
      {open === "delete" && <DeleteFormDialog form={form} onClose={() => setOpen(null)} />}
      <p className="text-sm">
        {form.purpose === "enrolment"
          ? `${form.passed} passed · ${form.kept} kept · ${form.review} need review · ${form.out} out · ${form.removed} removed · ${form.enrolled} enrolled`
          : `${form.applied} applied · ${form.held} need review · ${form.waiting} waiting`}
      </p>
      <p className="text-sm text-muted-foreground">
        {form.enabled ? "On" : "Off"} · {lastChecked(form)}
      </p>
      {form.last_error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {form.last_error}
        </p>
      )}
    </section>
  )
}
