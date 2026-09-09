import { api } from "@/lib/api";
import { downloadBlobFromResponse } from "@/lib/blob-download";

/** Whether a rise in a figure is good news. Sent by the backend, because it is
 *  programme policy — coverage up is good, data gaps up is not. */
export type Polarity = "up_good" | "down_good";

export interface SilentSchool {
  id: number;
  name: string;
  lga: string;
}

export interface CollectionFigures {
  submissions: number;
  schools_submitting: number;
  schools_owing: number;
  coverage_percent: number;
  attendance_rows: number;
  students_covered: number;
  backfilled_submissions: number;
  current_period: { year: number; term: number } | null;
  silent_schools: SilentSchool[];
  silent_school_count: number;
}

export interface OfficerRow {
  id: number;
  name: string;
  email: string;
  lgas: string[];
  logins: number;
  active_days: number;
  submissions: number;
  schools_covered: number;
  last_seen: string | null;
}

export interface ParticipationFigures {
  officers: OfficerRow[];
  officer_count: number;
  active_count: number;
  active_percent: number;
  silent_officers: string[];
  // False for months before participation was being recorded: those figures
  // are absent, not zero.
  tracked: boolean;
}

export interface DataGap {
  school: string;
  lga: string;
  year: number;
  term: number;
  week: number;
  students: number;
}

export interface QualityFigures {
  data_gaps: DataGap[];
  data_gap_count: number;
  data_gap_students: number;
  zero_rows: number;
  zero_row_percent: number;
  replaced_submissions: number;
  unsourced_submissions: number;
  unsourced_percent: number;
}

export interface PaymentFigures {
  any: boolean;
  disbursed: number;
  students_paid: number;
  amount: number;
  generated: number;
  awaiting: number;
}

export interface ProgrammeFigures {
  active_beneficiaries: number;
  graduated: number;
  dropped_out: number;
  transition: {
    from_year: number | null;
    to_year: number | null;
    students?: number;
    transitioned?: number;
    dropped_out?: number;
    rate: number | null;
  };
}

export interface LgaRow {
  lga_id: number;
  lga: string;
  schools_owing: number;
  schools_submitting: number;
  coverage_percent: number;
  submissions: number;
}

export interface ReportFigures {
  year: number;
  month: number;
  label: string;
  collection: CollectionFigures;
  participation: ParticipationFigures;
  quality: QualityFigures;
  payments: PaymentFigures;
  programme: ProgrammeFigures;
  by_lga: LgaRow[];
}

export interface MonthlyReport {
  id: number;
  period: string;
  label: string;
  year: number;
  month: number;
  generated_at: string;
  generated_by_name: string | null;
  stale: boolean;
  figures: ReportFigures;
  previous: Partial<ReportFigures>;
}

export interface MonthlyReportList {
  results: MonthlyReport[];
  polarity: Record<string, Polarity>;
}

export const getMonthlyReports = () =>
  api.get<MonthlyReportList>("/monthly-report/").then((response) => response.data);

export const getMonthlyReport = (period: string) =>
  api.get<MonthlyReport>(`/monthly-report/${period}/`).then((response) => response.data);

export const generateMonthlyReport = (period: string) =>
  api
    .post<MonthlyReport>(`/monthly-report/generate/${period}/`)
    .then((response) => response.data);

export const exportMonthlyReport = (period: string) =>
  api
    .get(`/monthly-report/${period}/export/`, { responseType: "blob" })
    .then((response) => downloadBlobFromResponse(response, `monthly-report-${period}.csv`));
