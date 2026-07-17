export type UserRole = 'admin' | 'principal' | 'faculty' | 'tutor' | 'student';

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole | null; // null for SuperAdmin
  lrn: string | null;   // Learner Reference Number (students only)
  is_active: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
  assigned_tutor: string | null;
  assigned_tutor_name: string | null;
  assessment_weight: number;
  weekly_tasks_weight: number;
  attendance_weight: number;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
  redirect: string;
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
}

export interface AttendanceSession {
  id: string;
  creator: string;
  creator_name: string;
  session_type: 'student' | 'staff';
  action: 'time_in' | 'time_out' | null;
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
  status: 'present' | 'late' | 'absent';
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
    lrn: string | null;
    email: string;
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
}

