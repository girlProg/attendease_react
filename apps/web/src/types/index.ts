export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type Payee = "student" | "caregiver";

export interface Cohort {
  id: number;
  name: string;
  year: string;
  // Whose identity/name the disbursement uses for this cohort (Niger=student,
  // Kaduna=caregiver). Present once the backend cohort serializer exposes it.
  payee?: Payee;
}

export interface LGA {
  id: number;
  name: string;
}

export interface School {
  id: number;
  name: string;
}

export interface Student {
  id: number;
  name: string;
  current_class: string;
  class_name: string;
  cohort: Cohort;
  school: { id: number; name: string };
  lga: string;
  photo_url: string;
  caregiver_name: string;
  caregiver_phone: string;
  graduated?: boolean;
}

export interface AttendanceOverviewClass {
  class: string;
  recorded: number;
  average_attendance: number;
  qualifying_students: number;
}

export interface AttendanceOverview {
  total_beneficiaries: number;
  graduated_students: number;
  total_schools: number;
  payments_made: number;
  failed_payments: number;
  total_disbursed_amount: number;
  active_students: number;
  students_with_attendance: number;
  average_attendance: number;
  qualifying_students: number;
  qualifying_percentage: number;
  by_class: AttendanceOverviewClass[];
}

export interface AttendanceRecord {
  id: number;
  student: Student;
  year: string;
  term: string;
  week: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday?: boolean;
  reason: string | null;
  remark: string | null;
  attendance_average: number;
}

export type DayName =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday";

// Per-deployment config from GET /api/config/. The school week is state-specific
// (Kaduna Mon-Thu, Niger Mon-Fri) and must come from here, never hardcoded.
export interface DeploymentConfig {
  active_days: DayName[];
  day_labels: Partial<Record<DayName, string>>;
  qualifying_attendance_average: number;
}

export interface AttendanceSummaryWeek {
  week: number;
  submitted: number;
  total: number;
  coverage: number;
  average: number;
}

export interface AttendanceSummaryTerm {
  term: number;
  weeks: AttendanceSummaryWeek[];
}

export interface AttendanceSummaryYear {
  year: string;
  terms: AttendanceSummaryTerm[];
}

export interface AttendanceSummary {
  school: { id: number; name: string; lga: string };
  total_enrolled: number;
  overall_average: number;
  years: AttendanceSummaryYear[];
}

export interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  photo: string | null;
  role?: string;
  lgas?: string[];
}

export interface AppUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  photo: string | null;
  role: string;
  lgas: string[];
  last_active: string | null;
  is_active: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}
