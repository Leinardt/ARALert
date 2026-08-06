import api from '../api/axios';
import type {
  Grade,
  AralActivity,
  AcademicRisk,
  AttendanceSession,
  Attendance,
  StudentAcademicProfile
} from '../types';

export interface GetGradesParams {
  student_id?: string;
  subject?: string;
  quarter?: number;
}

export interface GetAralActivitiesParams {
  student_id?: string;
  status?: string;
}

export interface GetAttendanceParams {
  date?: string;
  role?: string;
  status?: string;
  user_id?: string;
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

export interface GetPrincipalDashboardParams {
  days?: number;
}

export const academicService = {
  // Grades
  getGrades: async (params: GetGradesParams = {}): Promise<Grade[]> => {
    const response = await api.get<Grade[] | { results: Grade[] }>('/academics/grades/', { params });
    const data = response.data as any;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  createGrade: async (data: Partial<Grade>): Promise<Grade> => {
    const response = await api.post<Grade>('/academics/grades/', data);
    return response.data;
  },

  updateGrade: async (id: number, data: Partial<Grade>): Promise<Grade> => {
    const response = await api.patch<Grade>(`/academics/grades/${id}/`, data);
    return response.data;
  },

  deleteGrade: async (id: number): Promise<void> => {
    await api.delete(`/academics/grades/${id}/`);
  },

  // ARAL Activities
  getAralActivities: async (params: GetAralActivitiesParams = {}): Promise<AralActivity[]> => {
    const response = await api.get<AralActivity[] | { results: AralActivity[] }>('/academics/aral-activities/', { params });
    const data = response.data as any;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  createAralActivity: async (data: Partial<AralActivity>): Promise<AralActivity> => {
    const response = await api.post<AralActivity>('/academics/aral-activities/', data);
    return response.data;
  },

  updateAralActivity: async (id: number, data: Partial<AralActivity>): Promise<AralActivity> => {
    const response = await api.patch<AralActivity>(`/academics/aral-activities/${id}/`, data);
    return response.data;
  },

  deleteAralActivity: async (id: number): Promise<void> => {
    await api.delete(`/academics/aral-activities/${id}/`);
  },

  // Academic Risks
  getAcademicRisks: async (params: { student_id?: string } = {}): Promise<AcademicRisk[]> => {
    const response = await api.get<AcademicRisk[] | { results: AcademicRisk[] }>('/academics/risks/', { params });
    const data = response.data as any;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  createAcademicRisk: async (data: Partial<AcademicRisk>): Promise<AcademicRisk> => {
    const response = await api.post<AcademicRisk>('/academics/risks/', data);
    return response.data;
  },

  updateAcademicRisk: async (id: number, data: Partial<AcademicRisk>): Promise<AcademicRisk> => {
    const response = await api.patch<AcademicRisk>(`/academics/risks/${id}/`, data);
    return response.data;
  },

  deleteAcademicRisk: async (id: number): Promise<void> => {
    await api.delete(`/academics/risks/${id}/`);
  },

  // Attendance
  createAttendanceSession: async (data: {
    session_type: 'student' | 'staff';
    action?: 'time_in' | 'time_out' | 'arrival_am' | 'departure_am' | 'arrival_pm' | 'departure_pm';
    aral_activity_id?: number;
    expires_in_minutes?: number;
  }): Promise<AttendanceSession> => {
    const response = await api.post<AttendanceSession>('/academics/attendance/session/', data);
    return response.data;
  },

  scanQRCode: async (sessionId: string): Promise<{ message: string; attendance: Attendance }> => {
    const response = await api.post<{ message: string; attendance: Attendance }>('/academics/attendance/scan/', {
      session_id: sessionId
    });
    return response.data;
  },

  logManualAttendance: async (data: {
    student_id: string;
    date?: string;
    status: 'present' | 'late' | 'absent';
    aral_activity_id?: number;
  }): Promise<{ message: string; attendance: Attendance }> => {
    const response = await api.post<{ message: string; attendance: Attendance }>('/academics/attendance/manual/', data);
    return response.data;
  },

  getAttendanceHistory: async (params: GetAttendanceParams = {}): Promise<Attendance[]> => {
    const response = await api.get<Attendance[] | { results: Attendance[] }>('/academics/attendance/history/', { params });
    const data = response.data as any;
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  getPrincipalDashboard: async (params: GetPrincipalDashboardParams = {}): Promise<PrincipalDashboardResponse> => {
    const response = await api.get<PrincipalDashboardResponse>('/academics/principal-dashboard/', { params });
    return response.data;
  },

  // Student Profiles
  getStudentProfile: async (studentId: string): Promise<StudentAcademicProfile> => {
    const response = await api.get<StudentAcademicProfile>(`/academics/student-profile/${studentId}/`);
    return response.data;
  },

  getMyProfile: async (): Promise<StudentAcademicProfile> => {
    const response = await api.get<StudentAcademicProfile>('/academics/student-profile/');
    return response.data;
  }
};
