import { api } from "@/lib/api"

// Settings > Cohorts (superusers): every cohort, hidden or not. A hidden cohort
// and all its students' data drop out of every page, total and dropdown.
export interface CohortVisibility {
  id: number
  name: string
  year: number
  hidden: boolean
  students: number
}

export const getCohortVisibility = () =>
  api.get<CohortVisibility[]>("/cohort-visibility/").then((response) => response.data)

export const setCohortHidden = (id: number, hidden: boolean) =>
  api
    .patch<CohortVisibility>(`/cohort-visibility/${id}/`, { hidden })
    .then((response) => response.data)
