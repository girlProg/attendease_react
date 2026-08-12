import { api } from "@/lib/api";
import type { PaginatedResponse } from "@/types";

export interface UploadRowError {
  row: number;
  error: string;
  beneficiary_id?: string;
}

export interface UploadPreviewRow {
  row: number;
  action: string;
  beneficiary_id: string;
  note: string;
}

// The report returned by /student/upload-records/ for both preview and commit.
// A validation failure comes back as HTTP 400 carrying the same shape, so the
// api layer normalises 400-with-a-report into a resolved value (see below).
export interface UploadReport {
  valid: boolean;
  committed?: boolean;
  errors?: UploadRowError[];
  warnings?: UploadRowError[];
  preview?: UploadPreviewRow[];
  to_create?: number;
  to_update?: number;
  skipped?: number;
  created?: number;
  updated?: number;
  batch_id?: number;
}

export interface UploadBatch {
  id: number;
  user_email: string;
  cohort_name: string;
  payee: string;
  update_existing: boolean;
  create_new: boolean;
  filename: string;
  created_count: number;
  updated_count: number;
  status: "committed" | "reversed";
  reversed_at: string | null;
  created_at: string;
}

export interface UploadRecordsParams {
  file: File;
  cohort: number;
  payee?: string;
  update_existing: boolean;
  create_new: boolean;
  commit: boolean;
}

function isUploadReport(value: unknown): value is UploadReport {
  return Boolean(value) && typeof value === "object" && "valid" in (value as object);
}

export const uploadRecords = async (
  params: UploadRecordsParams,
): Promise<UploadReport> => {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("cohort", String(params.cohort));
  if (params.payee) formData.append("payee", params.payee);
  formData.append("update_existing", String(params.update_existing));
  formData.append("create_new", String(params.create_new));
  formData.append("commit", String(params.commit));

  try {
    const { data } = await api.post<UploadReport>(
      "/student/upload-records/",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  } catch (error) {
    // A clean-file preview validates 200; row errors come back 400 with the
    // same report body. Surface that as data, not a thrown error. Anything
    // without a report (auth, bad file, server error) still throws.
    const responseData = (error as { response?: { data?: unknown } })?.response?.data;
    if (isUploadReport(responseData)) return responseData;
    throw error;
  }
};

export const getUploadBatches = () =>
  api
    .get<PaginatedResponse<UploadBatch>>("/beneficiary-upload/", {
      params: { page_size: 100 },
    })
    .then((response) => response.data.results);

export const reverseUploadBatch = (id: number) =>
  api
    .post<{ batch_id: number; deleted: number; restored: number }>(
      `/beneficiary-upload/${id}/reverse/`,
    )
    .then((response) => response.data);
