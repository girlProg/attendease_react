import { api } from "@/lib/api"
import { downloadFile } from "@/lib/blob-download"
import type { PaginatedResponse } from "@/types"

export type KoboPurpose = "verification" | "enrolment"

// Settings > Kobo (superusers): the forms read from Kobo.
export interface KoboForm {
  id: number
  cohort: number
  cohort_name: string
  asset_uid: string
  label: string
  purpose: KoboPurpose
  household_cap: number
  enabled: boolean
  last_checked_at: string | null
  last_error: string
  applied: number
  held: number
  waiting: number
  passed: number
  review: number
  out: number
  kept: number
  removed: number
  enrolled: number
  // Whether this server has the token it needs. The token itself never leaves it.
  token_configured: boolean
  // Submissions are saved: its type, cohort and Kobo form ID are then fixed.
  has_records: boolean
}

export interface KoboFormDetails {
  cohort: number
  asset_uid: string
  label: string
  purpose: KoboPurpose
  household_cap?: number
}

export type KoboStatus = "pending" | "applied" | "held" | "replaced" | "dismissed"
export type KoboResolution = "retry" | "add_school" | "use_school" | "dismiss"

export interface KoboSubmission {
  id: number
  form: number
  form_label: string
  cohort_name: string
  submission_id: number
  submitted_at: string | null
  beneficiary_id: string
  student_name: string
  current_class: string
  lga: string
  school_name: string
  nin_given: boolean
  status: KoboStatus
  reason: string
}

export const getKoboForms = () =>
  api
    .get<PaginatedResponse<KoboForm>>("/kobo-forms/", { params: { page_size: 100 } })
    .then((response) => response.data.results)

export const addKoboForm = (form: KoboFormDetails) =>
  api.post<KoboForm>("/kobo-forms/", form).then((response) => response.data)

export const updateKoboForm = (id: number, form: KoboFormDetails) =>
  api.patch<KoboForm>(`/kobo-forms/${id}/`, form).then((response) => response.data)

// `confirm` is the form's name, needed once it has saved submissions.
export const deleteKoboForm = (id: number, confirm: string) =>
  api.delete(`/kobo-forms/${id}/`, { data: { confirm } })

export const setKoboFormEnabled = (id: number, enabled: boolean) =>
  api.patch<KoboForm>(`/kobo-forms/${id}/`, { enabled }).then((response) => response.data)

export const checkKoboFormNow = (id: number) =>
  api.post(`/kobo-forms/${id}/check/`).then((response) => response.data)

export const getHeldKoboSubmissions = (page: number, pageSize: number) =>
  api
    .get<PaginatedResponse<KoboSubmission>>("/kobo-submissions/", {
      params: { status: "held", page, page_size: pageSize },
    })
    .then((response) => response.data)

export const resolveKoboSubmission = (
  id: number,
  action: KoboResolution,
  school?: number
) =>
  api
    .post<KoboSubmission>(`/kobo-submissions/${id}/resolve/`, { action, school })
    .then((response) => response.data)

export type KoboEnrolmentOutcome = "waiting" | "passed" | "review" | "out"

// The enrolment holding list: nobody on it is a student yet. The server sends no NINs.
export interface KoboEnrolment {
  id: number
  form: number
  form_label: string
  cohort_name: string
  submission_id: number
  submitted_at: string | null
  student_name: string
  class_level: string
  lga: string
  school_name: string
  officer: string
  nin_given: boolean
  outcome: KoboEnrolmentOutcome
  step: number
  reason: string
  matches: string[]
  blanked: string[]
  compare_photos_with: string[]
  decision: "" | "keep" | "remove"
  decision_note: string
  decided_at: string | null
  decided_by_name: string
  is_enrolled: boolean
  beneficiary_id: string
}

export type KoboEnrolmentState = "review" | "out" | "passed" | "kept" | "removed" | "enrolled"

// What closing a form would do, and once done, what it did.
export interface EnrolmentCloseResult {
  to_enrol: number
  review: number
  out: number
  removed: number
  enrolled: number
  new_schools: string[]
  problems: string[]
  problem_count: number
  can_close: boolean
  batch_id?: number
}

export interface KoboEnrolmentForm extends Record<KoboEnrolmentState, number> {
  id: number
  label: string
  cohort_name: string
  household_cap: number
  enabled: boolean
  last_checked_at: string | null
}

export type ComparedField =
  | "student_name"
  | "date_of_birth"
  | "school"
  | "lga"
  | "caregiver_name"
  | "student_nin"
  | "caregiver_nin"
  | "caregiver_bvn"
  | "caregiver_phone"

// One record in the comparison window. The server masks the numbers.
export interface ComparedRecord extends Record<ComparedField, string> {
  reference: string
  on_the_mis: boolean
  class_level: string
  photos: { title: string; path: string; saved: boolean; link: string }[]
  // On a matched record: what it shares with the one under review.
  same?: ComparedField[]
  // On a student on the MIS: a student of the form's own cohort can be marked verified.
  student_id?: number
  verified?: boolean
  can_mark_verified?: boolean
}

export interface EnrolmentComparison {
  this: ComparedRecord
  others: ComparedRecord[]
  // What this submission has to carry over to a student marked verified.
  carry_over: { key: string; label: string }[]
}

export type EnrolmentAction = "keep" | "remove" | "undo" | "use_school" | "add_school"

export const getKoboEnrolmentForms = () =>
  api
    .get<KoboEnrolmentForm[]>("/kobo-enrolments/summary/")
    .then((response) => response.data)

export const getKoboEnrolments = (
  form: number,
  state: KoboEnrolmentState,
  page: number,
  pageSize: number
) =>
  api
    .get<PaginatedResponse<KoboEnrolment>>("/kobo-enrolments/", {
      params: { form, state, page, page_size: pageSize },
    })
    .then((response) => response.data)

export const getEnrolmentComparison = (id: number) =>
  api
    .get<EnrolmentComparison>(`/kobo-enrolments/${id}/compare/`)
    .then((response) => response.data)

export const previewEnrolmentClose = (form: number) =>
  api
    .post<EnrolmentCloseResult>("/kobo-enrolments/close/", { form })
    .then((response) => response.data)

export const closeEnrolmentForm = (form: number, verified: boolean, confirm: string) =>
  api
    .post<EnrolmentCloseResult>("/kobo-enrolments/close/", {
      form,
      commit: true,
      verified,
      confirm,
    })
    .then((response) => response.data)

export const downloadEnrolmentRemovalList = (form: number) =>
  downloadFile("/kobo-enrolments/removal-list/", "Enrolment removal list.csv", {
    params: { form },
  })

export const decideKoboEnrolment = (
  id: number,
  body: { action: EnrolmentAction; note?: string; school?: number }
) =>
  api
    .post<KoboEnrolment>(`/kobo-enrolments/${id}/decide/`, body)
    .then((response) => response.data)

export const markEnrolmentStudentVerified = (
  id: number,
  body: { student: number; carry: string[] }
) =>
  api
    .post<KoboEnrolment>(`/kobo-enrolments/${id}/mark-verified/`, body)
    .then((response) => response.data)
