import { api } from "../lib/api";
import { downloadBlobFromResponse } from "../lib/blob-download";
import type {
  PaginatedResponse,
  Cohort,
  LGA,
  School,
  Student,
  AttendanceRecord,
  AttendanceSummary,
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
  if (filters.school) filterParams.student__school__name = filters.school;
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
  if (filters.school) filterParams.school__name = filters.school;
  if (filters.name) filterParams.name = filters.name;

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

export const uploadAttendanceCsv = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api
    .post("/attendance/upload-csv/", formData, {
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
  records: {
    student_id: number;
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    reason?: string;
    remark?: string;
  }[];
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

export const getTermAverages = (params: {
  year?: string;
  school?: number;
  cohort?: number;
  term?: string;
  name?: string;
  page?: number;
  page_size?: number;
}) =>
  api.get<PaginatedResponse<{
    id: number;
    name: string;
    current_class: string;
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

export const getAttendanceSummary = (schoolId: number) =>
  api.get<AttendanceSummary>(`/school/${schoolId}/attendance-summary/`).then((r) => r.data);

