import { api } from "@/lib/api"
import type { ExportSpec } from "@/lib/blob-download"

// M&E Stats: students paid by cohort, class at enrolment and year. A cell holds
// the figure a superuser entered, else what the payment records say.
export type MeStatsSource = "entered" | "system" | "none"

export interface MeStatsCell {
  step: number
  year: number
  class_name: string
  graduated: boolean
  paid: number | null
  amount: string | null
  source: MeStatsSource
  paid_after_graduating: boolean
}

export interface MeStatsRow {
  cohort: number
  entry_class: string
  details: string
  students: number
  cells: MeStatsCell[]
}

export interface MeStatsCohort {
  id: number
  title: string
  enrolment_year: number | null
}

export interface MeStatsTable {
  columns: string[]
  cohorts: MeStatsCohort[]
  rows: MeStatsRow[]
  students_without_a_class: number
  figures_not_shown: { cohort: number; entry_class: string; year: number; paid: number }[]
}

export const getMeStats = () =>
  api.get<MeStatsTable>("/me-stats/").then((response) => response.data)

export const setEnrolmentYear = (cohort: number, enrolmentYear: number | null) =>
  api
    .patch<MeStatsTable>(`/me-stats/cohort/${cohort}/`, { enrolment_year: enrolmentYear })
    .then((response) => response.data)

export const setPaidFigure = (figure: {
  cohort: number
  entry_class: string
  year: number
  paid_students: number | null
  amount: string | null
}) => api.put<MeStatsTable>("/me-stats/figure/", figure).then((response) => response.data)

export const meStatsExport: ExportSpec = {
  path: "/me-stats/export/",
  filename: "me_stats.csv",
  params: {},
}
