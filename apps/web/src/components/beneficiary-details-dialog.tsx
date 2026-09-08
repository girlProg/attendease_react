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
import { DetailField, DetailSection } from "@/components/detail-list"
import { ageInYears, formatDate } from "@/lib/formatters"
import { getStudent } from "@/api/attendance"
import type { Student } from "@/types"

/** A choice and its "specify" text as one line: "Other — Albinism". */
function withSpecified(label?: string, specified?: string) {
  if (!label) return ""
  return [label, specified].filter(Boolean).join(" — ")
}

function disabilityText(student: Student) {
  return withSpecified(student.disability_status_label, student.disability_details)
}

function relationshipText(student: Student) {
  return withSpecified(
    student.caregiver_relationship_label,
    student.caregiver_relationship_other,
  )
}

/** The class a student sits in now, falling back to the one they enrolled into. */
function classNow(student: Student) {
  return student.current_class || student.class_name || ""
}

/** A nullable boolean as a word; blank when the form never asked. */
function yesNo(value?: boolean | null) {
  if (value === null || value === undefined) return ""
  return value ? "Yes" : "No"
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
          <DetailSection title="Student">
            <DetailField label="Admission number" value={record.admission_number} />
            <DetailField
              label="Class"
              value={
                record.graduated
                  ? `Graduated${classNow(record) ? ` (from ${classNow(record)})` : ""}`
                  : classNow(record)
              }
            />
            <DetailField
              label="Date of birth"
              value={
                record.date_of_birth
                  ? [formatDate(record.date_of_birth), ageInYears(record.date_of_birth)]
                      .filter(Boolean)
                      .join(" · age ")
                  : ""
              }
            />
            <DetailField label="NIN" value={record.nin} />
            <DetailField label="Disability" value={disabilityText(record)} />
            <DetailField label="NIN through AGILE" value={yesNo(record.nin_from_agile)} />
          </DetailSection>

          <section className="space-y-2">
            <h3 className="text-xs font-bold text-sidebar">Caregiver</h3>
            <div className="flex gap-3 rounded-xl bg-muted/30 p-3">
              <CaregiverPhoto caregiverId={caregiver?.id} hasPhoto={caregiver?.has_photo} />
              <dl className="grid flex-1 grid-cols-2 gap-3">
                <DetailField
                  label="Name"
                  value={caregiver?.name ?? record.caregiver_name}
                />
                <DetailField label="Relationship" value={relationshipText(record)} />
                <DetailField
                  label="Phone"
                  value={caregiver?.phone_number ?? record.caregiver_phone}
                />
                <DetailField label="Gender" value={caregiver?.gender_label} />
                <DetailField
                  label="Date of birth"
                  value={formatDate(caregiver?.date_of_birth)}
                />
                <DetailField label="NIN" value={caregiver?.nin} />
                <DetailField label="Address" value={caregiver?.address} />
              </dl>
            </div>
          </section>

          <DetailSection title="Enrolment">
            <DetailField label="Enumerator" value={enrolment?.enumerator_name} />
            <DetailField label="Enumerator phone" value={enrolment?.enumerator_phone} />
            <DetailField label="Submitted" value={formatDate(enrolment?.submitted_at)} />
            <DetailField label="Device" value={enrolment?.device_id} />
            <DetailField label="School code" value={record.school?.code} />
            <DetailField
              label="Consent form serial"
              value={enrolment?.consent_form_serial}
            />
          </DetailSection>

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
