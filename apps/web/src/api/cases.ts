import { api } from "../lib/api";
import { downloadBlobFromResponse } from "../lib/blob-download";
import type { PaginatedResponse } from "@/types";

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
  dropped_out: boolean;
  // Present on flagged cases (default list); absent on the dropped-out list.
  category?: "critical" | "at_risk";
  category_label?: string;
  week_recent?: number;
  week_previous?: number;
  // Present on the dropped-out list.
  dropped_out_at?: string | null;
  dropped_out_by?: string | null;
}

export type CaseFilters = {
  cohort?: number;
  lga?: number;
  school?: number;
  dropped?: boolean;
};

function toParams(filters: CaseFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (filters.cohort) params.cohort = filters.cohort;
  if (filters.lga) params.lga = filters.lga;
  if (filters.school) params.school = filters.school;
  if (filters.dropped) params.dropped = "true";
  return params;
}

export const getCases = (page = 1, pageSize = 100, filters: CaseFilters = {}) =>
  api
    .get<PaginatedResponse<CaseRow>>("/case/", {
      params: { page, page_size: pageSize, ...toParams(filters) },
    })
    .then((response) => response.data);

export const setDroppedOut = (studentId: number, dropped: boolean) =>
  api
    .post(`/case/${studentId}/drop-out/`, { dropped })
    .then((response) => response.data);

export const exportCases = (filters: CaseFilters = {}) =>
  api
    .get("/case/export/", {
      params: toParams(filters),
      responseType: "blob",
    })
    .then((response) => downloadBlobFromResponse(response, "case_management.csv"));
