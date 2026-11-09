import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/types"

// Settings > Kobo (superusers): the verification forms read from Kobo.
export interface KoboForm {
  id: number
  cohort: number
  cohort_name: string
  asset_uid: string
  label: string
  enabled: boolean
  last_checked_at: string | null
  last_error: string
  applied: number
  held: number
  waiting: number
  // Whether this server has the token it needs. The token itself never leaves it.
  token_configured: boolean
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

export const addKoboForm = (form: { cohort: number; asset_uid: string; label: string }) =>
  api.post<KoboForm>("/kobo-forms/", form).then((response) => response.data)

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
