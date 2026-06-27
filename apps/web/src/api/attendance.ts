import { api } from "../lib/api";

export type DayStatus = "present" | "absent" | "late" | "excused" | "public holiday";

export interface CohortRecord {
  year: string;
}

export interface StudentRecord {
  name: string;
  current_class: string;
  cohort: CohortRecord;
}

export interface AttendanceRecord {
  id: number;
  student: StudentRecord;
  term: string;
  week: string;
  monday: DayStatus;
  tuesday: DayStatus;
  wednesday: DayStatus;
  thursday: DayStatus;
  reason: string | null;
  remark: string | null;
  attendance_average: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

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

export const searchStudents = (name: string, page = 1, pageSize = 100) =>
  api
    .get<PaginatedResponse<AttendanceRecord>>("/student/", {
      params: { name, page, page_size: pageSize },
    })
    .then((r) => r.data);

export const submitAttendance = (payload: Omit<AttendanceRecord, "id">) =>
  api.post<AttendanceRecord>("/attendance/", payload).then((r) => r.data);

export interface Cohort {
  id: number;
  name: string;
  year: string;
}

export interface LGA {
  id: number;
  name: string;
}

export interface School {
  id: number;
  name: string;
}

export const getCohorts = () =>
  api.get<PaginatedResponse<Cohort>>("/cohort/").then((r) => r.data.results);

export const getLGAs = () =>
  api.get<PaginatedResponse<LGA>>("/lga/").then((r) => r.data.results);

export const getSchools = () =>
  api.get<PaginatedResponse<School>>("/school/").then((r) => r.data.results);
