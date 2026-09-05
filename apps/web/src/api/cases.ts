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
  // Open / treated / closed sections
  case_id?: number;
  status?: string;
  opened_at?: string;
  opened_by?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  note_count?: number;
  // Dropped section
  dropped_out_at?: string | null;
  dropped_out_by?: string | null;
}

export interface TimelineEntry {
  type: "note" | "event";
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
  cases: CaseSummary[];
  attendance: AttendanceHistoryEntry[];
  timeline: TimelineEntry[];
}

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
    .get<PaginatedResponse<CaseRow>>("/case/", {
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

export const setDroppedOut = (studentId: number, dropped: boolean) =>
  api.post(`/case/${studentId}/drop-out/`, { dropped }).then((r) => r.data);

export const exportCases = (filters: CaseFilters = {}) =>
  api
    .get("/case/export/", { params: toParams(filters), responseType: "blob" })
    .then((response) => downloadBlobFromResponse(response, "case_management.csv"));
