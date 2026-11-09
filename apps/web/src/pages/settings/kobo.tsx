import { useState } from "react"
import { AlertCircle, Info } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
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
  getKoboForms,
  setKoboFormEnabled,
  type KoboForm,
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

function AddFormSection() {
  const queryClient = useQueryClient()
  const cohorts = useQuery({ queryKey: ["cohorts"], queryFn: getCohorts })
  const [cohort, setCohort] = useState("")
  const [label, setLabel] = useState("")
  const [assetUid, setAssetUid] = useState("")
  const [purpose, setPurpose] = useState<KoboPurpose>("verification")
  const [householdCap, setHouseholdCap] = useState("3")
  const capIsValid = purpose === "verification" || Number(householdCap) >= 1
  const add = useMutation({
    mutationFn: () =>
      addKoboForm({
        cohort: Number(cohort),
        label: label.trim(),
        asset_uid: assetUid.trim(),
        purpose,
        ...(purpose === "enrolment" ? { household_cap: Number(householdCap) } : {}),
      }),
    onSuccess: () => {
      setLabel("")
      setAssetUid("")
      queryClient.invalidateQueries({ queryKey: ["kobo-forms"] })
    },
  })
  const chosen = cohorts.data?.find((item) => String(item.id) === cohort)

  return (
    <section className="space-y-3 rounded-2xl border bg-white p-5">
      <h2 className="font-semibold">Add a form</h2>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        The form ID is the part after /forms/ in the form's Kobo address. A new form starts off. An
        enrolment form only fills the Enrolment Holding List: nobody is enrolled from it yet.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Type</label>
          <Select
            value={purpose}
            onValueChange={(value) => setPurpose((value as KoboPurpose) ?? "verification")}
          >
            <SelectTrigger aria-label="Type" className="w-full">
              <SelectValue>{purpose === "enrolment" ? "Enrolment" : "Verification"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="verification">Verification</SelectItem>
              <SelectItem value="enrolment">Enrolment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Cohort</label>
          <Select value={cohort} onValueChange={(value) => setCohort(value ?? "")}>
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
        <LabeledInput label="Name" value={label} onChange={setLabel} />
        <LabeledInput label="Kobo form ID" value={assetUid} onChange={setAssetUid} />
        {purpose === "enrolment" && (
          <LabeledInput
            label="Most students to a household"
            value={householdCap}
            onChange={setHouseholdCap}
          />
        )}
      </div>
      {add.isError && (
        <p className="text-sm text-destructive">
          This form could not be added. Its form ID may already be in use.
        </p>
      )}
      <Button
        disabled={!cohort || !label.trim() || !assetUid.trim() || !capIsValid || add.isPending}
        onClick={() => add.mutate()}
      >
        Add form
      </Button>
    </section>
  )
}

function FormCard({ form }: { form: KoboForm }) {
  const queryClient = useQueryClient()
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
        </div>
      </div>
      <p className="text-sm">
        {form.purpose === "enrolment"
          ? `${form.passed} passed · ${form.review} need review · ${form.out} out`
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
