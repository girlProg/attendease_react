import { api } from "@/lib/api"

// Settings > Display (superusers): the redesigned pages switched on for
// everyone. Every user learns which design to show from /config's features.
export interface PageDesign {
  new_payments_page: boolean
  // One card per cohort on the Attendance Overview, which then carries the counts.
  enrolled_cohort_cards: boolean
  updated_at: string | null
  updated_by: string | null
}

export const getPageDesign = () =>
  api.get<PageDesign>("/page-design/").then((response) => response.data)

export const setPageDesign = (
  changes: Partial<Pick<PageDesign, "new_payments_page" | "enrolled_cohort_cards">>
) =>
  api.put<PageDesign>("/page-design/", changes).then((response) => response.data)
