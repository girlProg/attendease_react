import { api } from "@/lib/api"
import type { ExportSpec } from "@/lib/blob-download"

// M&E Stats: students paid by cohort, class at enrolment and year. A cell holds
// the figure a superuser entered, else what the payment records say, with
// payments from before the MIS counted in ("historic").
export type MeStatsSource = "entered" | "system" | "historic" | "none"

// A term open for payment where someone it pays hasn't had an attempt yet.
export interface MeStatsOngoingTerm {
  term: number
  attempted: number
  students: number
}

export interface MeStatsCell {
  step: number
  year: number
  class_name: string
  graduated: boolean
  // A year still to come: its class, and no count.
  upcoming: boolean
  paid: number | null
  amount: string | null
  // Which terms of the year were paid; empty when a typed figure doesn't say.
  terms: number[]
  source: MeStatsSource
  // A typed figure with no amount shows the historic payments' amount.
  amount_from_historic: boolean
  paid_after_graduating: boolean
  ongoing_terms: MeStatsOngoingTerm[]
}

export interface MeStatsRow {
  cohort: number
  entry_class: string
  details: string
  // The students Settings > Cohorts shows, in this row.
  students: number
  cells: MeStatsCell[]
}

export interface MeStatsCohort {
  id: number
  title: string
  enrolment_year: number | null
}

export interface MeStatsTable {
  this_year: number
  columns: string[]
  cohorts: MeStatsCohort[]
  rows: MeStatsRow[]
  students_without_a_class: number
  figures_not_shown: { cohort: number; entry_class: string; year: number; paid: number }[]
  // Historic payments with no class at enrolment or no year on the table.
  historic_not_placed: {
    cohort: number
    title: string
    year: number
    students: number
    amount: string
  }[]
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
  terms: number[]
}) => api.put<MeStatsTable>("/me-stats/figure/", figure).then((response) => response.data)

export const meStatsExport: ExportSpec = {
  path: "/me-stats/export/",
  filename: "me_stats.csv",
  params: {},
}
