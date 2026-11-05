import { api } from "@/lib/api"

export type CohortShows = "enrolled" | "verified"
export type CohortNinRule = "all" | "with_nin" | "without_nin"

// Settings > Cohorts (superusers): every cohort, hidden or not. A hidden cohort
// and all its students' data drop out of every page, total and dropdown; shows
// and nin_rule do the same for the students they leave out.
export interface CohortVisibility {
  id: number
  name: string
  year: number
  hidden: boolean
  shows: CohortShows
  nin_rule: CohortNinRule
  students: number
  verified: number
  with_nin: number
  // How many of its students its two choices leave showing.
  shown: number
}

export const getCohortVisibility = () =>
  api.get<CohortVisibility[]>("/cohort-visibility/").then((response) => response.data)

export const setCohortHidden = (id: number, hidden: boolean) =>
  api
    .patch<CohortVisibility>(`/cohort-visibility/${id}/`, { hidden })
    .then((response) => response.data)

export const setCohortShown = (
  id: number,
  changes: Partial<Pick<CohortVisibility, "shows" | "nin_rule">>,
) =>
  api
    .patch<CohortVisibility>(`/cohort-visibility/${id}/`, changes)
    .then((response) => response.data)
