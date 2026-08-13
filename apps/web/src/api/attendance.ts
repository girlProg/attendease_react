import { api } from "../lib/api";
import { downloadBlobFromResponse } from "../lib/blob-download";
import type {
  PaginatedResponse,
  Cohort,
  DayName,
  LGA,
  School,
  Student,
  AttendanceRecord,
  AttendanceSummary,
  AttendanceOverview,
} from "@/types";


export const getAttendance = (
  page = 1,
  pageSize = 100,
  search = "",
  filters: Record<string, string> = {},
) => {
  const filterParams: Record<string, string> = {};
  if (search) filterParams.student__name = search;
  if (filters.cohort) filterParams.student__cohort__name = filters.cohort;
  if (filters.term) filterParams.term = filters.term;
  if (filters.year) filterParams.year = filters.year;
  if (filters.lga) filterParams.student__school__lga__name = filters.lga;
  // Prefer the exact school ID; name (icontains) can match same-prefixed schools.
  if (filters.schoolId) filterParams.student__school = filters.schoolId;
  else if (filters.school) filterParams.student__school__name = filters.school;
  if (filters.week && filters.week !== "All Weeks") filterParams.week = filters.week;

  return api
    .get<PaginatedResponse<AttendanceRecord>>("/attendance/", {
      params: { page, page_size: pageSize, ...filterParams },
    })
    .then((r) => r.data);
};

export const getStudents = (
  page = 1,
  pageSize = 100,
  filters: Record<string, string> = {},
) => {
  const filterParams: Record<string, string> = {};
  if (filters.cohort) filterParams.cohort__name = filters.cohort;
  if (filters.lga) filterParams.school__lga__name = filters.lga;
  // Prefer the exact school ID so the list matches the CSV template exactly.
  // Falling back to name (icontains) would leak in same-prefixed schools.
  if (filters.schoolId) filterParams.school = filters.schoolId;
  else if (filters.school) filterParams.school__name = filters.school;
  if (filters.name) filterParams.name = filters.name;
  // "true"/"false" are both truthy strings — pass either through.
  if (filters.graduated) filterParams.graduated = filters.graduated;

  return api
    .get<PaginatedResponse<Student>>("/student/", {
      params: { page, page_size: pageSize, ...filterParams },
    })
    .then((r) => r.data);
};

export const getAttendanceByStudentIds = async (
  studentIds: number[],
  filters: Record<string, string> = {},
) => {
  if (studentIds.length === 0) return new Map<number, AttendanceRecord>();

  const filterParams: Record<string, string> = {};
  if (filters.year) filterParams.year = filters.year;
  if (filters.term) filterParams.term = filters.term;
  if (filters.week && filters.week !== "All Weeks") filterParams.week = filters.week;

  const { data } = await api.get<PaginatedResponse<AttendanceRecord>>("/attendance/", {
    params: {
      student__id__in: studentIds.join(","),
      page_size: studentIds.length,
      ...filterParams,
    },
  });

  const map = new Map<number, AttendanceRecord>();
  for (const record of data.results) {
    map.set(record.student.id, record);
  }
  return map;
};

export const downloadExcelTemplate = (params: {
  school: number;
  cohort: number;
  term: string;
  week: string;
  year: string;
}) => {
  return api
    .get("/attendance/download-template/", {
      params,
      responseType: "blob",
    })
    .then((response) => downloadBlobFromResponse(response, "attendance_template.xlsx"));
};

export const downloadLgaTemplates = (params: {
  lga: number;
  cohort: number;
  term: string;
  week: string;
  year: string;
}) => {
  return api
    .get("/attendance/download-lga-templates/", {
      params,
      responseType: "blob",
    })
    .then((response) => downloadBlobFromResponse(response, "lga_templates.zip"));
};

export interface AttendanceUploadReport {
  valid: boolean;
  committed: boolean;
  created: number;
  updated: number;
  total_processed: number;
  total_errors: number;
  errors: { row: number; beneficiary_id?: string; error: string }[];
}

// commit=false is the "Check file" preview: validates every row and reports
// problem rows without writing anything. commit=true records the attendance.
export const uploadAttendanceCsv = (file: File, commit = true) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("commit", commit ? "true" : "false");
  return api
    .post<AttendanceUploadReport>("/attendance/upload-csv/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((response) => response.data);
};

export const submitAttendanceSubmission = (payload: {
  school_id: number;
  cohort_id: number;
  year: number;
  term: number;
  week: number;
  // Day booleans are per-deployment (Kaduna Mon-Thu, Niger Mon-Fri) so the set
  // is dynamic; the backend only accepts the active days for its deployment.
  records: ({
    student_id: number;
    reason?: string;
    remark?: string;
  } & Partial<Record<DayName, boolean>>)[];
}) => api.post("/attendance-submission/", payload).then((response) => response.data);

export const getCohorts = () =>
  api.get<PaginatedResponse<Cohort>>("/cohort/", { params: { page_size: 100 } }).then((r) => r.data.results);

export const getLGAs = () =>
  api.get<PaginatedResponse<LGA>>("/lga/", { params: { page_size: 100 } }).then((r) => r.data.results);

export const getSchools = (lga?: string, cohort?: string) => {
  const params: Record<string, string | number> = { page_size: 500 };
  if (lga) params.lga__name = lga;
  if (cohort) params.cohort__name = cohort;
  return api.get<PaginatedResponse<School>>("/school/", { params }).then((r) => r.data.results);
};

export const getAttendanceYears = () =>
  api.get<string[]>("/attendance/years/").then((response) => response.data);

export const exportStudents = (cohortId: number) => {
  return api
    .get("/student/export/", {
      params: { cohort: cohortId },
      responseType: "blob",
    })
    .then((response) => downloadBlobFromResponse(response, "students_export.xlsx"));
};

export const exportPayments = (params: Record<string, string | number>) => {
  return api
    .get("/student/export-payments/", {
      params,
      responseType: "blob",
    })
    .then((response) => downloadBlobFromResponse(response, "payments_export.csv"));
};

export interface NoObjectionResult {
  id: number;
  created: boolean;
  students_added: number;
  total_students: number;
  not_found: string[];
}

// Admin-only: mark students as having no objection for a (cohort, year, term).
// With a CSV file, students are matched on the "Beneficiary ID" column;
// otherwise the qualifying students for the scope are used.
export const buildNoObjection = (input: {
  cohort: number;
  year: string;
  term: string;
  file?: File | null;
}) => {
  if (input.file) {
    const data = new FormData();
    data.append("cohort", String(input.cohort));
    data.append("year", input.year);
    data.append("term", input.term);
    data.append("file", input.file);
    return api
      .post<NoObjectionResult>("/no-objection/build/", data)
      .then((response) => response.data);
  }
  return api
    .post<NoObjectionResult>("/no-objection/build/", {
      cohort: input.cohort,
      year: input.year,
      term: input.term,
      from_qualifying: true,
    })
    .then((response) => response.data);
};

export interface NoObjectionStatus {
  exists: boolean
  id: number | null
  total_students: number
}

// Does a no-objection submission already exist for this (cohort, year, term)?
export const getNoObjectionStatus = (params: {
  cohort?: number
  year?: string
  term?: string
}) =>
  api
    .get<NoObjectionStatus>("/no-objection/status/", { params })
    .then((response) => response.data)

// Superuser-only: delete the no-objection submission for a (cohort, year, term).
export const deleteNoObjection = (params: {
  cohort: number
  year: string
  term: string
}) =>
  api
    .delete<{ deleted: boolean }>("/no-objection/remove/", { params })
    .then((response) => response.data)

export const getTermAverages = (params: {
  year?: string;
  school?: number;
  cohort?: number;
  term?: string;
  name?: string;
  graduated?: string;
  qualifying?: string;
  page?: number;
  page_size?: number;
}) =>
  api.get<PaginatedResponse<{
    id: number;
    name: string;
    current_class: string;
    graduated: boolean;
    school: string;
    cohort: string;
    photo_url: string;
    term_1: number;
    term_2: number;
    term_3: number;
    average: number;
    account_no?: string;
    bank_name?: string;
    bank_code?: string;
    caregiver_name?: string;
    caregiver_phone?: string;
    bank_account_name?: string;
    payments?: {
      id: number;
      term: number;
      disbursed: boolean;
      amount_received: string;
      batch_reference: string;
      bvn: string;
      nin: string;
      bank_name: string;
      bank_account_number: string;
    }[];
  }>>("/student/term-averages/", { params }).then((response) => response.data);

export const getAttendanceSummary = (schoolId: number, cohort?: string, year?: string) => {
  const params: Record<string, string> = {};
  if (cohort) params.cohort = cohort;
  if (year) params.year = year;
  return api
    .get<AttendanceSummary>(`/school/${schoolId}/attendance-summary/`, { params })
    .then((r) => r.data);
};

export const getAttendanceOverview = (params: {
  cohort?: string | number;
  year?: string;
  term?: string;
  lga?: string | number;
  school?: string | number;
}) =>
  api
    .get<AttendanceOverview>("/attendance/overview/", { params })
    .then((response) => response.data);

export const bulkChangeClass = (payload: {
  cohort: number;
  target_class: string;
  destination_class: string;
}) =>
  api
    .post<{ updated: number }>("/student/bulk-change-class/", payload)
    .then((response) => response.data);

