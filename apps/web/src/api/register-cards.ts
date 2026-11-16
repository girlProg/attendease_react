import { api } from "@/lib/api"

// Settings > Display (superusers): the cohort, year and term where the Attendance
// Overview shows its uploaded-register cards, and who sees them (the
// register_cards permission, staff by default, ticked per person).
export interface RegisterCardTerm {
  id: number
  cohort: number
  cohort_name: string
  year: number
  term: number
  updated_by: string | null
}

export interface RegisterCardViewer {
  id: number
  name: string
  email: string
  role: string
  is_staff: boolean
  is_superuser: boolean
  sees: boolean
  default: boolean
  // superuser: always; default: from role and staff; ticked / unticked: chosen.
  how: "superuser" | "default" | "ticked" | "unticked"
}

export const getRegisterCardTerms = () =>
  api.get<RegisterCardTerm[]>("/register-card-terms/").then((response) => response.data)

export const addRegisterCardTerm = (term: { cohort: number; year: number; term: number }) =>
  api.post<RegisterCardTerm>("/register-card-terms/", term).then((response) => response.data)

export const removeRegisterCardTerm = (id: number) => api.delete(`/register-card-terms/${id}/`)

export const getRegisterCardViewers = () =>
  api
    .get<RegisterCardViewer[]>("/register-card-terms/viewers/")
    .then((response) => response.data)

// One person's tick, through the same endpoint as Manage Users (logged there).
export const setRegisterCardsFor = (userId: number, allowed: boolean) =>
  api.put(`/user/${userId}/permissions/`, { allowed: { register_cards: allowed } })
