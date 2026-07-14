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
}
