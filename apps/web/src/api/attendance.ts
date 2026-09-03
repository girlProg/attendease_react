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

export interface AttendanceUploadHistoryRow {
  id: number;
  school: string;
  lga: string;
  cohort: string;
  year: number | null;
  term: number;
  week: number;
  student_count: number;
  average_attendance: number | null;
  uploaded_by: string | null;
  has_source_file: boolean;
  created_at: string;
  updated_at: string;
}

// Download the original uploaded attendance file for a submission (LGA-scoped
// on the server; only present when has_source_file is true).
export const downloadAttendanceFile = (submissionId: number) =>
  api
    .get(`/attendance-submission/${submissionId}/file/`, { responseType: "blob" })
    .then((response) =>
      downloadBlobFromResponse(response, `attendance_${submissionId}.csv`),
    );

/**
 * Fetch the uploaded attendance file as raw text, for previewing it in-app.
 * Browsers can't render a CSV inline the way they do a PDF — they always
 * download it — so we pull the text and render it as a table instead.
 */
export const fetchAttendanceFileText = (submissionId: number) =>
  api
    .get(`/attendance-submission/${submissionId}/file/`, {
      responseType: "text",
      transformResponse: [(data) => data],
    })
    .then((response) => response.data as string);

// Attendance upload history: one row per submission (school/cohort/week) with
// the number of students recorded and the average attendance. Filters are by ID
// so same-named schools/LGAs don't leak in.
export const getAttendanceUploadHistory = (
  page = 1,
  pageSize = 50,
  filters: {
    cohort?: number;
    lga?: number;
    school?: number;
    year?: string;
    term?: string;
    week?: string;
  } = {},
) => {
  const params: Record<string, string | number> = { page, page_size: pageSize };
  if (filters.cohort) params.cohort = filters.cohort;
  if (filters.lga) params.lga = filters.lga;
  if (filters.school) params.school = filters.school;
  if (filters.year) params.year = filters.year;
  if (filters.term) params.term = filters.term;
  if (filters.week && filters.week !== "All Weeks") params.week = filters.week;

  return api
    .get<PaginatedResponse<AttendanceUploadHistoryRow>>(
      "/attendance-submission/history/",
      { params },
    )
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
  // Set when the file is missing students for the school — the upload is blocked
  // until every student is included; `template` drives the re-download button.
  missing_students?: { beneficiary_id: string; name: string }[];
  missing_count?: number;
  template?: {
    school: number;
    cohort: number;
    year: number;
    term: number;
    week: number;
  } | null;
  error_type?: string;
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

/**
 * Schools, optionally scoped to an LGA and cohort.
 *
 * Filters by **ID, never by name**. The name filters on the server are
 * `icontains`, so `lga__name=Kaura` also matches "Kaura Namoda" and drags in
 * every school from the other LGA — which is how one LGA came back with a
 * thousand-plus schools. School names also repeat legitimately (one School row
 * per cohort), so name filtering can never be exact here.
 */
export const getSchools = (lgaId?: number, cohortId?: number) => {
  const params: Record<string, string | number> = { page_size: 1000 };
  if (lgaId) params.lga = lgaId;
  if (cohortId) params.cohort = cohortId;
  return api.get<PaginatedResponse<School>>("/school/", { params }).then((r) => r.data.results);
};

// Schools in one LGA + cohort that have verified students, each with a
// student_count — for the merge UI.
export const getSchoolsForMerge = (lgaId: number, cohortId: number) =>
  api
    .get<PaginatedResponse<School>>("/school/", {
      params: { lga: lgaId, cohort: cohortId, verified: true, page_size: 1000 },
    })
    .then((r) => r.data.results);

export interface MergeSchoolsResult {
  merged: number;
  moved: number;
  skipped: { from_id: number | string; error: string }[];
}

// Superuser-only: merge from_ids schools into into_id (the keeper).
export const mergeSchools = (input: { into_id: number; from_ids: number[]; force?: boolean }) =>
  api
    .post<MergeSchoolsResult>("/school/merge/", input)
    .then((r) => r.data);

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

// Card figures for the payments page, computed server-side over the WHOLE
// filtered scope (the page is only a window onto it).
export interface TermAveragesSummary {
  students: number;
  successful: number;
  failed: number;
  awaiting: number;
  total_amount: string;
}

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
    account_number?: string;
    bank_name?: string;
    bank_code?: string;
    caregiver_name?: string;
    caregiver_phone?: string;
    bank_account_name?: string;
    payments?: {
      id: number;
      term: number;
      disbursed: boolean;
      disbursement_status?: string | null;
      disbursement_bank_status?: string | null;
      // Latest transaction's provider code + description, e.g. "30 Benef Acct
      // is not Active" — the bank's own words for a reject.
      disbursement_reason?: string | null;
      amount_received: string;
      batch_reference: string;
      bvn: string;
      nin: string;
      bank_name: string;
      bank_account_number: string;
    }[];
  }> & { summary?: TermAveragesSummary }>("/student/term-averages/", { params }).then((response) => response.data);

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


export interface SchoolRegisterPage {
  id: number;
  original_filename: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface SchoolRegisterRow {
  id: number;
  school: string;
  school_id: number;
  lga: string;
  year: number;
  term: number;
  pages: SchoolRegisterPage[];
  page_count: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// Termly school attendance registers, held as a set of scanned photos. One
// register per (school, year, term); uploading ADDS pages rather than replacing
// them. The server enforces LGA scoping and file type/size limits.
export const getSchoolRegisters = (
  page = 1,
  pageSize = 50,
  filters: {
    school?: number;
    year?: string;
    term?: string;
    search?: string;
  } = {},
) => {
  const params: Record<string, string | number> = { page, page_size: pageSize };
  if (filters.school) params.school = filters.school;
  if (filters.year) params.year = filters.year;
  if (filters.term) params.term = filters.term;
  if (filters.search) params.search = filters.search;
  return api
    .get<PaginatedResponse<SchoolRegisterRow>>("/school-register/", { params })
    .then((r) => r.data);
};

export interface RegisterCoverage {
  year: number;
  term: number;
  uploaded: {
    school: number;
    name: string;
    lga: string | null;
    register: number;
    page_count: number;
    updated_at: string;
  }[];
  missing: { school: number; name: string; lga: string | null }[];
  uploaded_count: number;
  missing_count: number;
  total: number;
}

// Staff-only: which schools have submitted a register for a year+term.
export const getRegisterCoverage = (filters: {
  year: string;
  term: string;
  lga?: string;
  cohort?: string;
}) =>
  api
    .get<RegisterCoverage>("/school-register/coverage/", { params: filters })
    .then((r) => r.data);

/**
 * Fetch a protected register page as an object URL, for showing it inline.
 * The endpoint requires auth, so an <img src> can't hit it directly — we pull
 * the bytes through axios and wrap them in a blob URL. Callers MUST revoke the
 * URL when done or the blobs leak for the life of the tab.
 */
export const fetchRegisterPageObjectUrl = (
  registerId: number,
  pageId: number,
) =>
  api
    .get(`/school-register/${registerId}/page/${pageId}/`, {
      params: { inline: 1 },
      responseType: "blob",
    })
    .then((response) => ({
      url: URL.createObjectURL(response.data as Blob),
      type: (response.data as Blob).type,
    }));

export const uploadSchoolRegister = (
  schoolId: number,
  year: number | string,
  term: number | string,
  files: File[],
) => {
  const form = new FormData();
  form.append("school", String(schoolId));
  form.append("year", String(year));
  form.append("term", String(term));
  files.forEach((file) => form.append("files", file));
  return api
    .post<SchoolRegisterRow>("/school-register/", form)
    .then((r) => r.data);
};

export const downloadRegisterPage = (
  registerId: number,
  pageId: number,
  filename: string,
) =>
  api
    .get(`/school-register/${registerId}/page/${pageId}/`, {
      responseType: "blob",
    })
    .then((response) => downloadBlobFromResponse(response, filename));

export const deleteRegisterPage = (registerId: number, pageId: number) =>
  api
    .delete(`/school-register/${registerId}/page/${pageId}/delete/`)
    .then((r) => r.data);
