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
  // The state's own school code, from the enrolment form.
  code?: string;
  school_type?: "primary" | "secondary" | "";
  student_count?: number;
  lga?: { id: number; name: string };
}

export interface Caregiver {
  id: number;
  name: string;
  phone_number: string;
  address: string;
  gender?: string;
  gender_label?: string;
  date_of_birth?: string | null;
  photo_url?: string;
  // A local copy of the enrolment photo exists on the server.
  has_photo?: boolean;
  // Financial/identity fields are absent for viewer accounts.
  bvn?: string;
  nin?: string;
  bank_name?: string;
  bank_account_number?: string;
  resolved_account_name?: string;
}

export interface Enrolment {
  id: number;
  beneficiary_id: string;
  serial_number: number;
  enrolment_class: string;
  enumerator_name: string;
  enumerator_phone: string;
  submitted_at?: string | null;
  form_started_at?: string | null;
  form_ended_at?: string | null;
  device_id?: string;
  consent_form_serial?: string;
  consent_form_photo_url?: string;
  // Admins can fetch the signed form from /enrolments/{id}/consent-form/.
  has_consent_form?: boolean;
  gps_latitude?: string | null;
  gps_longitude?: string | null;
  gps_altitude?: string | null;
  gps_precision?: string | null;
  kobo_submission_id?: number | null;
  kobo_uuid?: string;
  verified: boolean;
  verified_at?: string | null;
}

export interface Student {
  id: number;
  name: string;
  admission_number?: string;
  current_class: string;
  class_name: string;
  cohort: Cohort;
  school: School;
  lga: string;
  photo_url: string;
  // A local copy (and thumbnail) of the photo exists on the server.
  has_photo?: boolean;
  caregiver_name: string;
  caregiver_phone: string;
  caregiver?: Caregiver;
  enrolment?: Enrolment;
  graduated?: boolean;
  // From the enrolment form. The identity numbers are absent for viewers.
  date_of_birth?: string | null;
  nin?: string;
  bvn?: string;
  nin_from_agile?: boolean | null;
  disability_status?: string;
  disability_status_label?: string;
  disability_details?: string;
  caregiver_relationship?: string;
  caregiver_relationship_label?: string;
  caregiver_relationship_other?: string;
}

export interface AttendanceOverviewClass {
  class: string;
  recorded: number;
  average_attendance: number;
  qualifying_students: number;
}

// The same three attendance figures, over the rows that arrived in an uploaded
// register rather than being keyed in, seeded or migrated. Staff only — the
// backend omits the block for everyone else.
export interface SubmittedAttendanceStats {
  students_with_attendance: number;
  average_attendance: number;
  qualifying_students: number;
  qualifying_percentage: number;
  submissions: number;
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
  submitted?: SubmittedAttendanceStats;
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
export interface ChoiceOption {
  value: string;
  label: string;
}

export interface DeploymentConfig {
  active_days: DayName[];
  day_labels: Partial<Record<DayName, string>>;
  qualifying_attendance_average: number;
  // The enrolment form's choice lists, so dropdowns never hardcode them.
  choices?: {
    disability_status: ChoiceOption[];
    caregiver_relationship: ChoiceOption[];
    caregiver_gender: ChoiceOption[];
    school_type: ChoiceOption[];
  };
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
  is_superuser?: boolean;
  is_staff?: boolean;
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
