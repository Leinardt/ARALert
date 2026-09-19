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
  assigned_tutor: string | null;
  assigned_tutor_name: string | null;
  assessment_weight: number;
  weekly_tasks_weight: number;
  attendance_weight: number;
  aral_level?: 'basic' | 'plus' | 'summer' | 'graduated' | null;
  subject?: 'Reading' | 'Science' | 'Math' | null;
  faculty_type?: string | null;
  grade_level?: string | null;
  section?: string | null;
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
