import { ExternalLink, FileText, MapPin } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { useAuth } from "@/contexts/auth-context"
import { useProtectedImage } from "@/hooks/use-protected-image"
import { getStudent } from "@/api/attendance"
import type { Student } from "@/types"

function formatDate(value?: string | null): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function age(dateOfBirth?: string | null): string {
  if (!dateOfBirth) return ""
  const born = new Date(dateOfBirth)
  if (Number.isNaN(born.getTime())) return ""
  const now = new Date()
  let years = now.getFullYear() - born.getFullYear()
  const monthDiff = now.getMonth() - born.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) years -= 1
  return years >= 0 && years < 120 ? ` (${years})` : ""
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-xs text-sidebar">{value || "—"}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold text-sidebar">{title}</h3>
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/30 p-3">{children}</dl>
    </section>
  )
}

function CaregiverPhoto({ caregiverId, hasPhoto }: { caregiverId?: number; hasPhoto?: boolean }) {
  const enabled = Boolean(hasPhoto) && caregiverId !== undefined
  const { data: url } = useProtectedImage(
    caregiverId === undefined ? undefined : `/caregiver/${caregiverId}/photo/`,
    enabled,
  )
  if (!enabled) return null
  return url ? (
    <img src={url} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
  ) : (
    <div className="size-16 shrink-0 animate-pulse rounded-lg bg-muted" />
  )
}

function ConsentForm({ enrolmentId, hasForm }: { enrolmentId?: number; hasForm?: boolean }) {
  const { isAdmin } = useAuth()
  // The signed form carries the caregiver's written identity details, so the
  // server serves it to admins only. Don't even offer it to anyone else.
  const enabled = isAdmin && Boolean(hasForm) && enrolmentId !== undefined
  const { data: url } = useProtectedImage(
    enrolmentId === undefined ? undefined : `/enrolments/${enrolmentId}/consent-form/`,
    enabled,
  )
  if (!enabled) return null
  if (!url) return <div className="h-20 animate-pulse rounded-lg bg-muted" />
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-xs font-medium text-brand hover:underline"
    >
      <FileText className="size-4" />
      View signed consent form
      <ExternalLink className="size-3" />
    </a>
  )
}

export function BeneficiaryDetailsDialog({
  student,
  open,
  onOpenChange,
}: {
  // The list row, used to fill the dialog while the full record loads.
  student: Student | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // The list response is trimmed; the detail endpoint carries the nested
  // caregiver and enrolment this dialog shows.
  const { data: full } = useQuery({
    queryKey: ["student", student?.id],
    queryFn: () => getStudent(student!.id),
    enabled: open && student !== null,
  })
  const record = full ?? student
  if (!record) return null

  const caregiver = record.caregiver
  const enrolment = record.enrolment
  const latitude = enrolment?.gps_latitude
  const longitude = enrolment?.gps_longitude

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogTitle>{record.name}</DialogTitle>
        <DialogDescription>
          {enrolment?.beneficiary_id ?? "—"} · {record.school?.name ?? "—"} ·{" "}
          {record.lga}
        </DialogDescription>

        <div className="mt-4 space-y-4 overflow-y-auto pr-1">
          <Section title="Student">
            <Field label="Admission number" value={record.admission_number} />
            <Field label="Class" value={record.current_class || record.class_name} />
            <Field
              label="Date of birth"
              value={
                record.date_of_birth
                  ? `${formatDate(record.date_of_birth)}${age(record.date_of_birth)}`
                  : ""
              }
            />
            <Field label="NIN" value={record.nin} />
            <Field
              label="Disability"
              value={
                record.disability_status_label
                  ? [record.disability_status_label, record.disability_details]
                      .filter(Boolean)
                      .join(" — ")
                  : ""
              }
            />
            <Field
              label="NIN through AGILE"
              value={
                record.nin_from_agile === null || record.nin_from_agile === undefined
                  ? ""
                  : record.nin_from_agile
                    ? "Yes"
                    : "No"
              }
            />
          </Section>

          <section className="space-y-2">
            <h3 className="text-xs font-bold text-sidebar">Caregiver</h3>
            <div className="flex gap-3 rounded-xl bg-muted/30 p-3">
              <CaregiverPhoto caregiverId={caregiver?.id} hasPhoto={caregiver?.has_photo} />
              <dl className="grid flex-1 grid-cols-2 gap-3">
                <Field label="Name" value={caregiver?.name ?? record.caregiver_name} />
                <Field
                  label="Relationship"
                  value={
                    record.caregiver_relationship_label
                      ? [
                          record.caregiver_relationship_label,
                          record.caregiver_relationship_other,
                        ]
                          .filter(Boolean)
                          .join(" — ")
                      : ""
                  }
                />
                <Field
                  label="Phone"
                  value={caregiver?.phone_number ?? record.caregiver_phone}
                />
                <Field label="Gender" value={caregiver?.gender_label} />
                <Field
                  label="Date of birth"
                  value={formatDate(caregiver?.date_of_birth)}
                />
                <Field label="NIN" value={caregiver?.nin} />
                <Field label="Address" value={caregiver?.address} />
              </dl>
            </div>
          </section>

          <Section title="Enrolment">
            <Field label="Enumerator" value={enrolment?.enumerator_name} />
            <Field label="Enumerator phone" value={enrolment?.enumerator_phone} />
            <Field label="Submitted" value={formatDate(enrolment?.submitted_at)} />
            <Field label="Device" value={enrolment?.device_id} />
            <Field label="School code" value={record.school?.code} />
            <Field
              label="Consent form serial"
              value={enrolment?.consent_form_serial}
            />
          </Section>

          {(latitude || enrolment?.has_consent_form) && (
            <section className="flex flex-wrap items-center gap-4">
              {latitude && longitude && (
                <a
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-medium text-brand hover:underline"
                >
                  <MapPin className="size-4" />
                  {latitude}, {longitude}
                  <ExternalLink className="size-3" />
                </a>
              )}
              <ConsentForm
                enrolmentId={enrolment?.id}
                hasForm={enrolment?.has_consent_form}
              />
            </section>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <DialogClose className="h-9 rounded-full border border-border px-4 text-sm text-sidebar hover:bg-muted/50">
            Close
          </DialogClose>
        </div>
      </DialogPopup>
    </Dialog>
  )
}
