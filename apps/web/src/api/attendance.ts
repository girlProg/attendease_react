import { api } from "../lib/api";
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
  if (filters.year) filterParams.student__cohort__year = filters.year;
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
  if (filters.year) filterParams.cohort__year = filters.year;
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
    .then((response) => {
      const contentDisposition = response.headers["content-disposition"] ?? "";
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=["']?([^"';\n]+)/);
      const filename = filenameMatch?.[1] ?? "attendance_template.xlsx";

      const contentType = response.headers["content-type"] as string | undefined;
      const blob = new Blob([response.data], { ...(contentType && { type: contentType }) });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    });
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

export const submitAttendance = (payload: Omit<AttendanceRecord, "id">) =>
  api.post<AttendanceRecord>("/attendance/", payload).then((r) => r.data);

export const getCohorts = () =>
  api.get<PaginatedResponse<Cohort>>("/cohort/").then((r) => r.data.results);

export const getLGAs = () =>
  api.get<PaginatedResponse<LGA>>("/lga/").then((r) => r.data.results);

export const getSchools = (lga?: string) =>
  api.get<PaginatedResponse<School>>("/school/", {
    params: lga ? { lga__name: lga } : {},
  }).then((r) => r.data.results);

export const getAttendanceSummary = (schoolId: number) =>
  api.get<AttendanceSummary>(`/school/${schoolId}/attendance-summary/`).then((r) => r.data);
