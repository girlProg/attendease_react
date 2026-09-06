import { api } from "../lib/api";
import { downloadBlobFromResponse } from "../lib/blob-download";
import type { PaginatedResponse } from "@/types";

export type CaseStatus = "flagged" | "open" | "treated" | "closed" | "dropped";

export interface CaseRow {
  id: number;
  name: string;
  current_class: string;
  school: string;
  lga: string;
  cohort: string | null;
  beneficiary_id: string;
  caregiver_name: string;
  caregiver_phone: string;
  photo_url: string;
  has_photo?: boolean;
  dropped_out: boolean;
  // Flagged section
  category?: "critical" | "at_risk";
  category_label?: string;
  recent_week?: string;
  recent_percent?: number;
  previous_week?: string;
  previous_percent?: number;
  // Term outlook (flagged + open sections): can the term average still be
  // lifted over the qualifying line with the weeks that remain?
  term_label?: string;
  term_average?: number | null;
  weeks_recorded?: number;
  weeks_remaining?: number | null;
  weeks_needed?: number | null;
  outlook?: Outlook | "";
  outlook_label?: string;
  // Open / treated / closed sections
  case_id?: number;
  status?: string;
  opened_at?: string;
  opened_by?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  note_count?: number;
  assigned_to?: string | null;
  assigned_to_id?: number | null;
  follow_up_count?: number;
  last_follow_up?: FollowUp | null;
  next_action_date?: string | null;
  // Dropped section
  dropped_out_at?: string | null;
  dropped_out_by?: string | null;
}

export type Outlook = "on_track" | "recoverable" | "cannot_qualify";

export interface TermOutlook {
  term_label: string;
  term_average: number;
  weeks_recorded: number;
  weeks_remaining: number;
  weeks_needed: number;
  outlook: Outlook;
  outlook_label: string;
}

// A school-week the detection skipped because every student was at 0% — an
// unfinished upload to chase, not a set of cases.
export interface DataGap {
  school_id: number;
  school: string;
  lga: string;
  year: number | null;
  term: number;
  week: number;
  label: string;
  students: number;
}

export type FollowUpMethod = "call" | "visit" | "sms" | "school" | "other";
export type FollowUpReason =
  | "illness"
  | "fees"
  | "work"
  | "relocated"
  | "marriage"
  | "family"
  | "school_closed"
  | "transport"
  | "insecurity"
  | "unknown"
  | "other";

export const FOLLOW_UP_METHODS: { value: FollowUpMethod; label: string }[] = [
  { value: "call", label: "Phone call" },
  { value: "visit", label: "Home visit" },
  { value: "sms", label: "SMS" },
  { value: "school", label: "Through the school" },
  { value: "other", label: "Other" },
];

export const FOLLOW_UP_REASONS: { value: FollowUpReason; label: string }[] = [
  { value: "illness", label: "Illness" },
  { value: "fees", label: "Fees / school costs" },
  { value: "work", label: "Farm, market or domestic work" },
  { value: "relocated", label: "Relocated / travelled" },
  { value: "marriage", label: "Marriage" },
  { value: "family", label: "Family circumstances" },
  { value: "school_closed", label: "School closed / no teacher" },
  { value: "transport", label: "Distance / transport" },
  { value: "insecurity", label: "Insecurity" },
  { value: "unknown", label: "Not established" },
  { value: "other", label: "Other" },
];

export interface FollowUp {
  id: number;
  case_id: number;
  method: FollowUpMethod;
  method_label: string;
  reached: boolean;
  reason: FollowUpReason | "";
  reason_label: string;
  next_action_date: string | null;
  note: string;
  author: string | null;
  at: string;
}

export interface Assignee {
  id: number;
  name: string;
}

export interface TimelineEntry {
  type: "note" | "event" | "follow_up";
  text: string;
  author: string | null;
  at: string;
  case_id: number;
}

export interface AttendanceHistoryEntry {
  year: number | null;
  term: number;
  week: number;
  label: string;
  percent: number;
  reason: string;
  remark: string;
  recorded_at: string;
}

export interface CaseSummary {
  id: number;
  status: string;
  opened_at: string;
  opened_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface CaseDetail {
  student: CaseRow & { graduated: boolean };
  open_case_id: number | null;
  assigned_to: string | null;
  assigned_to_id: number | null;
  outlook: TermOutlook | null;
  cases: CaseSummary[];
  follow_ups: FollowUp[];
  attendance: AttendanceHistoryEntry[];
  timeline: TimelineEntry[];
}

export type CaseListResponse = PaginatedResponse<CaseRow> & { data_gaps?: DataGap[] };

export type CaseFilters = {
  cohort?: number;
  lga?: number;
  school?: number;
  term?: string;
  year?: string;
  status?: CaseStatus;
};

function toParams(filters: CaseFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (filters.cohort) params.cohort = filters.cohort;
  if (filters.lga) params.lga = filters.lga;
  if (filters.school) params.school = filters.school;
  if (filters.term) params.term = filters.term;
  if (filters.year) params.year = filters.year;
  if (filters.status) params.status = filters.status;
  return params;
}

export const getCases = (page = 1, pageSize = 100, filters: CaseFilters = {}) =>
  api
    .get<CaseListResponse>("/case/", {
      params: { page, page_size: pageSize, ...toParams(filters) },
    })
    .then((response) => response.data);

export const getCaseDetail = (studentId: number) =>
  api.get<CaseDetail>(`/case/${studentId}/`).then((response) => response.data);

export const openCase = (studentId: number, note?: string) =>
  api.post(`/case/${studentId}/open/`, { note }).then((r) => r.data);

export const addCaseNote = (studentId: number, note: string) =>
  api.post(`/case/${studentId}/note/`, { note }).then((r) => r.data);

export const treatCase = (studentId: number) =>
  api.post(`/case/${studentId}/treat/`, {}).then((r) => r.data);

export const closeCase = (studentId: number) =>
  api.post(`/case/${studentId}/close/`, {}).then((r) => r.data);

export interface FollowUpInput {
  method: FollowUpMethod;
  reached: boolean;
  reason?: FollowUpReason | "";
  next_action_date?: string;
  note?: string;
}

export const addFollowUp = (studentId: number, input: FollowUpInput) =>
  api.post<FollowUp>(`/case/${studentId}/follow-up/`, input).then((r) => r.data);

export const assignCase = (studentId: number, userId: number | null) =>
  api.post(`/case/${studentId}/assign/`, { user: userId }).then((r) => r.data);

export const getAssignees = () =>
  api.get<Assignee[]>("/case/assignees/").then((r) => r.data);

export const setDroppedOut = (studentId: number, dropped: boolean) =>
  api.post(`/case/${studentId}/drop-out/`, { dropped }).then((r) => r.data);

export const exportCases = (filters: CaseFilters = {}) =>
  api
    .get("/case/export/", { params: toParams(filters), responseType: "blob" })
    .then((response) => downloadBlobFromResponse(response, "case_management.csv"));
