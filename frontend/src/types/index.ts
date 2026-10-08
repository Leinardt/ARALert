export type UserRole = 'admin' | 'principal' | 'faculty' | 'tutor' | 'student';

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  full_name: string;
  avatar: string | null;
  mfa_enabled?: boolean;
  role: UserRole | null; // null for SuperAdmin
  lrn: string | null;   // Learner Reference Number (students only)
  age?: number | string | null;
  sex?: string | null;
  gender?: string | null;
  is_active: boolean;
  email_verified?: boolean;
  password_setup_required?: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
  has_logged_in?: boolean;
  is_first_login?: boolean;
  privacy_consent_accepted_at?: string | null;
  assigned_tutor: string | null;
  assigned_tutor_name: string | null;
  assessment_weight: number;
  weekly_tasks_weight: number;
  attendance_weight: number;
  aral_level?: 'basic' | 'plus' | 'summer' | 'graduated' | null;
  tutor_type?: 'basic' | 'plus' | 'summer' | null;
  is_available_for_students?: boolean;
  subject?: 'Reading' | 'Science' | 'Math' | 'English' | string | null;
  faculty_type?: string | null;
  grade_level?: string | null;
  section?: string | null;
  parent_guardian_name?: string | null;
  contact_number?: string | null;
  has_bosy?: boolean;
  has_mosy?: boolean;
  has_eosy?: boolean;
  has_summer?: boolean;
}

export interface AralProgressionResult {
  student_id: string;
  student_name: string;
  previous_level: string;
  new_level: string;
  assessment_type: string;
  score_percentage: number | null;
  status: 'PROMOTED' | 'GRADUATED' | 'RETAINED' | 'ASSIGNED_SUMMER';
  message: string;
}

export interface AuthResponse {
  access?: string;
  refresh?: string;
  user?: User;
  redirect?: string;
  mfa_required?: boolean;
  user_id?: string;
  message?: string;
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  admins: number;
  principals: number;
  faculty: number;
  tutors: number;
  students: number;
  assigned_students: number;
  unassigned_students: number;
  attendance_summary?: {
    total_logs: number;
    present: number;
    late: number;
    absent: number;
  };
  academic_summary?: {
    average_score: number;
    average_attendance_rate: number;
    grade_entries: number;
  };
  risk_summary?: {
    low: number;
    medium: number;
    high: number;
    resolved: number;
  };
}

export interface Grade {
  id: number;
  student: string;
  student_name: string;
  tutor: string | null;
  tutor_name: string | null;
  subject: string;
  quarter: number;
  score: number;
  total_score: number;
  component_type: 'assessment' | 'weekly_task' | 'attendance';
  component_type_display: string;
  remarks: string | null;
  date_logged: string;
  batch_id: string;
  created_at: string | null;
}

export interface AralActivity {
  id: number;
  student: string;
  student_name: string;
  tutor: string;
  tutor_name: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  status_display: string;
  date_assigned: string;
  date_completed: string | null;
  remarks: string | null;
}

export interface AcademicRisk {
  id: number;
  student: string;
  student_name: string;
  risk_level: 'low' | 'medium' | 'high';
  risk_level_display: string;
  details: string;
  date_created: string;
  resolved: boolean;
  student_acknowledged: boolean;
}

export interface PrincipalDashboardTrendPoint {
  date: string;
  attendance_rate: number;
  average_score: number;
}

export interface PrincipalTutorTrend {
  tutor_id: string;
  tutor_name: string;
  trend: PrincipalDashboardTrendPoint[];
}

export interface PrincipalDashboardResponse {
  program_summary: {
    total_tutors: number;
    total_faculty: number;
    total_students: number;
  };
  risk_summary: {
    low: number;
    medium: number;
    high: number;
  };
  class_performance_trend: PrincipalDashboardTrendPoint[];
  per_tutor_performance: PrincipalTutorTrend[];
  staff_attendance_trend: Array<{
    date: string;
    tutor_attendance_rate: number;
    faculty_attendance_rate: number;
  }>;
}

export interface AttendanceSession {
  id: string;
  creator: string;
  creator_name: string;
  session_type: 'student' | 'staff';
  action: 'time_in' | 'time_out' | 'arrival_am' | 'departure_am' | 'arrival_pm' | 'departure_pm' | null;
  aral_activity: number | null;
  aral_activity_title: string | null;
  expires_at: string;
  is_active: boolean;
  time_left: number;
}

export interface Attendance {
  id: number;
  user: string;
  user_name: string;
  user_lrn: string | null;
  role: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  arrival_am: string | null;
  departure_am: string | null;
  arrival_pm: string | null;
  departure_pm: string | null;
  status: 'present' | 'absent';
  status_display: string;
  tutor: string | null;
  tutor_name: string | null;
  aral_activity: number | null;
  aral_activity_title: string | null;
  session: string | null;
}

export interface GradeSummary {
  subject: string;
  quarter: number;
  assessment_avg: number;
  weekly_task_avg: number;
  attendance_avg: number;
  final_grade: number;
}

export interface StudentAcademicProfile {
  student: {
    id: string;
    name: string;
    first_name: string;
    last_name: string;
    username: string;
    lrn: string | null;
    email: string;
    aral_level: 'basic' | 'plus' | 'summer';
  };
  assigned_tutor: {
    id: string;
    name: string;
    email: string;
    assessment_weight: number;
    weekly_tasks_weight: number;
    attendance_weight: number;
  } | null;
  gpa: number | null;
  grade_details: GradeSummary[];
  attendance: {
    attendance_rate: number;
    total_days: number;
    present: number;
    late: number;
    absent: number;
    logs: Attendance[];
  };
  aral_progress: {
    activities: AralActivity[];
    stats: Record<string, number>;
  };
  academic_risks: AcademicRisk[];
  computed_risk_level?: 'low' | 'medium' | 'high';
}

export interface StudentEditRequest {
  id: string;
  student: string;
  student_name: string;
  current_first_name: string;
  current_middle_name: string;
  current_last_name: string;
  current_lrn: string | null;
  current_aral_level: string;
  requested_by: string;
  requested_by_name: string;
  proposed_first_name: string;
  proposed_middle_name: string;
  proposed_last_name: string;
  proposed_lrn: string | null;
  proposed_aral_level: 'basic' | 'plus' | 'summer' | 'graduated' | string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  rejection_reason: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface CreateStudentEditRequestPayload {
  student: string;
  proposed_first_name: string;
  proposed_middle_name?: string;
  proposed_last_name: string;
  proposed_lrn?: string | null;
  proposed_aral_level: string;
  reason: string;
}

export interface SchoolYear {
  id: number;
  school_year: string;
  status: 'ACTIVE' | 'ARCHIVED';
  is_active: boolean;
  current_semester?: '1st' | '2nd' | 'summer';
  current_period?: string;
  active_milestone?: 'MOSY' | 'EOSY' | 'ARAL Summer Assessment';
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface StudentEnrollment {
  id: number;
  student: string;
  student_name: string;
  student_lrn: string;
  school_year: number;
  school_year_str: string;
  grade_level: string;
  program: 'basic' | 'plus' | 'summer';
  assigned_tutor: string | null;
  assigned_tutor_name: string;
  enrollment_status: 'active' | 'completed' | 'dropped' | 'inactive';
  mosy_result: 'pending' | 'passed' | 'failed' | 'exempted' | 'not_taken';
  eosy_result: 'pending' | 'passed' | 'failed' | 'exempted' | 'not_taken';
  final_result: string | null;
  evaluation_status: 'pending' | 'in_progress' | 'completed';
  graduation_status: 'not_eligible' | 'eligible' | 'graduated';
  summer_status: 'none' | 'summer_required' | 'summer_active' | 'evaluation_pending' | 'summer_passed' | 'summer_failed' | 'summer_completed';
  enrollment_date: string;
  completion_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TutorAssignmentHistory {
  id: number;
  student: string;
  student_name: string;
  student_lrn: string;
  tutor: string;
  tutor_name: string;
  school_year: number;
  school_year_str: string;
  period: 'MOSY' | 'EOSY' | 'FULL_YEAR';
  program: string;
  assigned_by: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string;
  created_at: string;
}

export interface SummerRecord {
  id: number;
  student: string;
  student_name: string;
  student_lrn: string;
  previous_enrollment: number | null;
  previous_program: string;
  previous_school_year: string;
  reason: 'BASIC_FAILED_TWICE' | 'PLUS_FAILED' | 'ADMIN_REFERRED';
  reason_display: string;
  summer_status: 'summer_required' | 'summer_active' | 'evaluation_pending' | 'summer_passed' | 'summer_failed' | 'summer_completed';
  status_display: string;
  summer_evaluation_status: 'pending' | 'completed';
  summer_result: 'passed' | 'failed' | null;
  start_date: string | null;
  completion_date: string | null;
  evaluating_tutor: string | null;
  evaluator_name: string | null;
  notes: string;
  created_at: string;
}

export interface IncompleteStudent {
  id: string;
  full_name: string;
  lrn: string | null;
  program: string;
}

export interface TutorProgressItem {
  tutor_id: string;
  tutor_name: string;
  email: string;
  tutor_type: string;
  assigned_students_count: number;
  evaluated_count: number;
  remaining_count: number;
  status: 'Completed' | 'In Progress' | 'Pending';
  has_no_students: boolean;
  incomplete_students: IncompleteStudent[];
}

export interface MosyMonitoringData {
  school_year: string;
  total_tutors: number;
  completed_tutors: number;
  in_progress_tutors: number;
  pending_tutors: number;
  total_assigned_students: number;
  total_students_evaluated: number;
  students_remaining: number;
  is_all_complete: boolean;
  tutors_progress: TutorProgressItem[];
  incomplete_tutors: TutorProgressItem[];
}

export interface EosyMonitoringData {
  current_school_year: string;
  next_school_year: string;
  current_school_year_status: string;
  eosy_completion_status: string;
  can_transition: boolean;
  warning_message: string | null;
  total_tutors: number;
  completed_tutors: number;
  in_progress_tutors: number;
  pending_tutors: number;
  total_assigned_students: number;
  total_students_evaluated: number;
  students_remaining: number;
  tutors_progress: TutorProgressItem[];
  incomplete_tutors: TutorProgressItem[];
}

export interface UnassignedPlusStudent {
  id: string;
  full_name: string;
  lrn: string | null;
  program: string;
  school_year: string;
  mosy_status: string;
  mosy_result: string;
  mosy_score_pct: number | null;
  previous_tutor: string;
  assignment_status: string;
  /** e.g. 'Leveled Up to PLUS' | 'Ready for Q3/Q4 PLUS Cohort' */
  status_badge: string;
  /** color hint: 'green' | 'blue' */
  status_color: string;
}

export interface BasicStudentAssignmentItem {
  id: string;
  full_name: string;
  lrn: string | null;
  program: string;
  school_year: string;
  mosy_status: string;
  mosy_result: string;
  mosy_score_pct: number | null;
  previous_tutor: string;
  assignment_status: string;
  /** e.g. 'Needs Basic Retake (Q3/Q4 or Summer)' | 'Passed MOSY — Awaiting Level-Up' | 'Pending MOSY Evaluation' */
  status_badge: string;
  /** color hint: 'yellow' | 'green' | 'gray' */
  status_color: string;
}

export interface GraduatedStudentItem {
  id: string;
  full_name: string;
  lrn: string | null;
  program: string;
  school_year: string;
  status: string;
  requires_tutor: boolean;
}

export interface MosyAssignmentData {
  school_year: string;
  unassigned_plus_students: UnassignedPlusStudent[];
  /** Unassigned basic students — failed MOSY retake or pending evaluation */
  unassigned_basic_students: BasicStudentAssignmentItem[];
  /** Backward-compat alias for unassigned_basic_students */
  basic_students: BasicStudentAssignmentItem[];
  graduated_students: GraduatedStudentItem[];
  total_unassigned: number;
}

export interface AvailableTutorItem {
  id: string;
  full_name: string;
  email: string;
  subject: string;
  tutor_type: string;
  tutor_type_display: string;
  current_students_count: number;
  /** Maximum cohort size (25) */
  total_slots: number;
  /** Remaining slots available for new students */
  available_slots: number;
  has_students: boolean;
  cohort_load_status?: string;
  is_available: boolean;
  availability_status: string;
}

export interface TransitionSummaryPreview {
  current_school_year: string;
  next_school_year: string;
  student_movement: {
    basic_to_plus: number;
    plus_to_graduated: number;
    basic_to_basic: number;
    basic_to_summer_required: number;
    plus_to_summer_required: number;
    dropped_inactive: number;
  };
  tutor_assignment: {
    basic_tutors: number;
    basic_tutors_available_for_additional_students: number;
    unassigned_basic_students: number;
    plus_tutors: number;
    plus_tutors_available_for_additional_students: number;
    unassigned_plus_students: number;
  };
}

export interface StudentHistoryEnrollmentItem {
  school_year: string;
  grade_level: string;
  program: string;
  tutor_name: string;
  mosy_result: string;
  eosy_result: string;
  final_result: string;
  status: string;
  graduation_status: string;
  summer_status: string;
}

export interface StudentHistoryTutorItem {
  tutor_name: string;
  school_year: string;
  period: string;
  program: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  notes: string;
}

export interface StudentHistorySummerItem {
  school_year: string;
  program: string;
  reason: string;
  status: string;
  evaluation_status: string;
  result: string;
  evaluator: string;
  start_date: string | null;
  completion_date: string | null;
}

export interface StudentCompleteHistory {
  student_id: string;
  full_name: string;
  lrn: string | null;
  current_level: string;
  current_tutor: string;
  enrollment_history: StudentHistoryEnrollmentItem[];
  tutor_history: StudentHistoryTutorItem[];
  summer_history: StudentHistorySummerItem[];
}

export interface ArchivedSchoolYearRecord {
  enrollment_id: number;
  student_id: string;
  student_name: string;
  lrn: string | null;
  grade_level: string;
  program: string;
  assigned_tutor: string;
  tutor_id: string | null;
  mosy_result: string;
  eosy_result: string;
  final_result: string;
  graduation_status: string;
  summer_status: string;
  enrollment_status: string;
}

export interface ArchivedSchoolYearSnapshot {
  school_year: string;
  status: string;
  is_read_only: boolean;
  total_students: number;
  records: ArchivedSchoolYearRecord[];
}

// ---------------------------------------------------------------------------
// Phase 2: Unified Assignment Queue & Bulk Cohort Dispatch
// ---------------------------------------------------------------------------

export interface AssignmentQueueItem {
  id: string;
  full_name: string;
  lrn: string | null;
  /** 'basic' | 'plus' */
  required_program: string;
  mosy_result: string;
  eosy_result: string;
  mosy_score_pct: number | null;
  previous_tutor: string;
  /** Human-readable explanation of why this student is in the queue */
  status_reason: string;
  /** Short display badge label */
  status_badge: string;
  /** Color hint: 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'gray' */
  status_color: string;
}

export interface AssignmentQueueData {
  school_year: string;
  total_unassigned: number;
  /** Students requiring a Plus-certified tutor */
  plus_queue: AssignmentQueueItem[];
  /** Students requiring a Basic-certified tutor */
  basic_queue: AssignmentQueueItem[];
  summary: {
    total_plus_queue: number;
    total_basic_queue: number;
    needs_plus_tutor: number;
    needs_basic_tutor: number;
  };
}

export interface BulkAssignResultStudent {
  student_id: string;
  student_name: string;
  lrn: string | null;
  program: string;
  history_id: number | null;
  reason?: string;
}

export interface BulkAssignResult {
  tutor_id: string;
  tutor_name: string;
  period: string;
  assigned: BulkAssignResultStudent[];
  skipped: BulkAssignResultStudent[];
  total_assigned: number;
  total_skipped: number;
}

// ---------------------------------------------------------------------------
// Phase 4: Tutor Historical Roster & Past Cohorts
// ---------------------------------------------------------------------------

export interface TutorActiveCohortStudent {
  student_id: string;
  student_name: string;
  lrn: string | null;
  email: string;
  program: string;
  grade_level: string;
  is_active: boolean;
}

export interface TutorHistoricalCohortRecord {
  history_id: number;
  student_id: string;
  student_name: string;
  lrn: string | null;
  email: string;
  school_year: string;
  period: string;
  program: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  notes: string;
  latest_score: string | null;
  latest_grade_remarks: string | null;
}

export interface TutorCohortHistoryData {
  tutor_id: string;
  tutor_name: string;
  email: string;
  tutor_type: string;
  active_students_count: number;
  active_cohort: TutorActiveCohortStudent[];
  past_records: TutorHistoricalCohortRecord[];
  total_historical_students: number;
}

