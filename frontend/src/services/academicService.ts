import api from '../api/axios';
import type {
  Grade,
  AralActivity,
  AcademicRisk,
  AttendanceSession,
  Attendance,
  StudentAcademicProfile,
  AralProgressionResult,
  SchoolYear,
  MosyMonitoringData,
  EosyMonitoringData,
  MosyAssignmentData,
  TransitionSummaryPreview,
  AvailableTutorItem,
  SummerRecord,
  ArchivedSchoolYearSnapshot,
  StudentCompleteHistory,
} from '../types';

export interface GetGradesParams {
  student_id?: string;
  subject?: string;
  quarter?: number;
  page?: number;
}

export interface GetAralActivitiesParams {
  student_id?: string;
  status?: string;
}

export interface GetAttendanceParams {
  date?: string;
  date_from?: string;
  date_to?: string;
  role?: string;
  status?: string;
  user_id?: string;
  page?: number;
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

const inFlightGradesRequests = new Map<string, Promise<Grade[]>>();
const gradesCache = new Map<string, { data: Grade[]; timestamp: number }>();
const inFlightAttendanceRequests = new Map<string, Promise<Attendance[]>>();
const attendanceCache = new Map<string, { data: Attendance[]; timestamp: number }>();
const CACHE_TTL_MS = 5000;

export const invalidateAcademicCache = () => {
  gradesCache.clear();
  attendanceCache.clear();
};

export const academicService = {
  // Grades
  getGrades: async (params: GetGradesParams = {}): Promise<Grade[]> => {
    const key = JSON.stringify(params);
    const cached = gradesCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    const inFlight = inFlightGradesRequests.get(key);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const response = await api.get<Grade[] | { results: Grade[]; next?: string | null }>('/academics/grades/', {
        params: { ...params, page_size: params.page !== undefined ? undefined : 200 }
      });
      const data = response.data as any;
      if (Array.isArray(data)) {
        gradesCache.set(key, { data, timestamp: Date.now() });
        return data;
      }

      const grades = [...(data?.results ?? [])];
      if (params.page !== undefined) return grades;

      let page = 1;
      let next = data?.next;
      const MAX_PAGES = 50;
      while (next && page < MAX_PAGES) {
        page += 1;
        const nextResponse = await api.get<Grade[] | { results: Grade[]; next?: string | null }>('/academics/grades/', {
          params: { ...params, page, page_size: 200 }
        });
        const nextData = nextResponse.data as any;
        if (Array.isArray(nextData)) {
          grades.push(...nextData);
          break;
        }
        grades.push(...(nextData?.results ?? []));
        next = nextData?.next;
      }
      gradesCache.set(key, { data: grades, timestamp: Date.now() });
      return grades;
    })().finally(() => {
      inFlightGradesRequests.delete(key);
    });

    inFlightGradesRequests.set(key, promise);
    return promise;
  },

  createGrade: async (data: Partial<Grade>): Promise<Grade> => {
    const response = await api.post<Grade>('/academics/grades/', data);
    gradesCache.clear();
    return response.data;
  },

  saveGradesBulk: async (
    entriesToCreate: Partial<Grade>[],
    entriesToUpdate: { id: number; data: Partial<Grade> }[] = []
  ): Promise<Grade[]> => {
    const payload = [
      ...entriesToCreate,
      ...entriesToUpdate.map(({ id, data }) => ({ id, ...data })),
    ];
    if (payload.length === 0) return [];

    try {
      const response = await api.post<Grade[]>('/academics/grades/', payload);
      gradesCache.clear();
      return Array.isArray(response.data) ? response.data : [];
    } catch (err: any) {
      // Safe fallback if backend hasn't deployed bulk list support yet
      if (err?.response?.status === 400 && err?.response?.data?.non_field_errors) {
        const res = await Promise.all([
          ...entriesToCreate.map((entry) => academicService.createGrade(entry)),
          ...entriesToUpdate.map(({ id, data }) => academicService.updateGrade(id, data)),
        ]);
        gradesCache.clear();
        return res;
      }
      throw err;
    }
  },

  updateGrade: async (id: number, data: Partial<Grade>): Promise<Grade> => {
    const response = await api.patch<Grade>(`/academics/grades/${id}/`, data);
    gradesCache.clear();
    return response.data;
  },

  deleteGrade: async (id: number): Promise<void> => {
    await api.delete(`/academics/grades/${id}/`);
    gradesCache.clear();
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

  getActiveAttendanceSession: async (sessionType: 'student' | 'staff' = 'student'): Promise<AttendanceSession | null> => {
    try {
      const response = await api.get<{ session: AttendanceSession | null }>('/academics/attendance/session/', {
        params: { session_type: sessionType }
      });
      return response.data?.session || null;
    } catch {
      return null;
    }
  },

  closeAttendanceSession: async (sessionId: string, data?: { student_ids?: string[] }): Promise<{ message: string; session: AttendanceSession }> => {
    const response = await api.post<{ message: string; session: AttendanceSession }>(`/academics/attendance/session/${sessionId}/close/`, data || {});
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
    status: 'present' | 'absent';
    aral_activity_id?: number;
  }): Promise<{ message: string; attendance: Attendance }> => {
    const response = await api.post<{ message: string; attendance: Attendance }>('/academics/attendance/manual/', data);
    return response.data;
  },

  getAttendanceHistory: async (params: GetAttendanceParams = {}): Promise<Attendance[]> => {
    const key = JSON.stringify(params);
    const cached = attendanceCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    const inFlight = inFlightAttendanceRequests.get(key);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const response = await api.get<Attendance[] | { results: Attendance[]; next?: string | null }>('/academics/attendance/history/', {
        params: { ...params, page_size: params.page !== undefined ? undefined : 200 }
      });
      const data = response.data as any;
      if (Array.isArray(data)) {
        attendanceCache.set(key, { data, timestamp: Date.now() });
        return data;
      }

      const records = [...(data?.results ?? [])];
      if (params.page !== undefined) return records;

      let page = 1;
      let next = data?.next;
      const MAX_PAGES = 50;
      while (next && page < MAX_PAGES) {
        page += 1;
        const nextRes = await api.get<Attendance[] | { results: Attendance[]; next?: string | null }>('/academics/attendance/history/', {
          params: { ...params, page, page_size: 200 }
        });
        const nextData = nextRes.data as any;
        if (Array.isArray(nextData)) {
          records.push(...nextData);
          break;
        }
        records.push(...(nextData?.results ?? []));
        next = nextData?.next;
      }
      attendanceCache.set(key, { data: records, timestamp: Date.now() });
      return records;
    })().finally(() => {
      inFlightAttendanceRequests.delete(key);
    });

    inFlightAttendanceRequests.set(key, promise);
    return promise;
  },

  clearAttendanceHistory: async (params?: { date?: string; all?: boolean; student_ids?: string[] }): Promise<{ message: string; count: number }> => {
    const response = await api.delete<{ message: string; count: number }>('/academics/attendance/history/', {
      params: { date: params?.date, all: params?.all ? 'true' : undefined },
      data: { student_ids: params?.student_ids },
    });
    attendanceCache.clear();
    return response.data;
  },

  updateAttendance: async (id: number | string, data: Partial<Pick<Attendance, 'date' | 'status' | 'time_in' | 'time_out'>>): Promise<Attendance> => {
    const response = await api.patch<Attendance>(`/academics/attendance/${id}/`, data);
    attendanceCache.clear();
    return response.data;
  },

  deleteAttendance: async (id: number | string): Promise<void> => {
    await api.delete(`/academics/attendance/${id}/`);
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
  },

  // ARAL Level Progression
  evaluateAralLevelUp: async (studentId?: string): Promise<AralProgressionResult[]> => {
    const response = await api.post<{ results: AralProgressionResult[] }>('/academics/level-up/evaluate/', {
      student_id: studentId
    });
    return response.data.results;
  },

  // School Year Management
  getSchoolYears: async (): Promise<SchoolYear[]> => {
    const response = await api.get<SchoolYear[]>('/academics/school-years/');
    return response.data;
  },

  getCurrentSchoolYear: async (): Promise<SchoolYear> => {
    const response = await api.get<SchoolYear>('/academics/school-years/current/');
    return response.data;
  },

  setActiveSemester: async (semester: '1st' | '2nd' | 'summer'): Promise<{ message: string; school_year: SchoolYear }> => {
    const response = await api.post<{ message: string; school_year: SchoolYear }>('/academics/school-years/current/', { semester });
    return response.data;
  },

  // MOSY Evaluation & Assignments
  getMosyMonitoring: async (): Promise<MosyMonitoringData> => {
    const response = await api.get<MosyMonitoringData>('/academics/evaluations/mosy-monitoring/');
    return response.data;
  },

  processMosyCompletion: async (): Promise<{ status: string; message: string; plus_unassigned_count: number; basic_unassigned_count: number }> => {
    const response = await api.post<{ status: string; message: string; plus_unassigned_count: number; basic_unassigned_count: number }>('/academics/evaluations/mosy-process/', {});
    return response.data;
  },

  getMosyAssignments: async (): Promise<MosyAssignmentData> => {
    const response = await api.get<MosyAssignmentData>('/academics/evaluations/mosy-assignments/');
    return response.data;
  },

  // EOSY Evaluation & Transition
  getEosyMonitoring: async (): Promise<EosyMonitoringData> => {
    const response = await api.get<EosyMonitoringData>('/academics/evaluations/eosy-monitoring/');
    return response.data;
  },

  getTransitionSummaryPreview: async (): Promise<TransitionSummaryPreview> => {
    const response = await api.get<TransitionSummaryPreview>('/academics/evaluations/transition-summary/');
    return response.data;
  },

  startNewSchoolYear: async (): Promise<{ status: string; message: string; previous_school_year: string; new_school_year: string; summary: any }> => {
    const response = await api.post<{ status: string; message: string; previous_school_year: string; new_school_year: string; summary: any }>('/academics/evaluations/start-new-school-year/');
    return response.data;
  },

  // Available Tutors (No Capacity) & Assignment
  getAvailableTutors: async (program?: string): Promise<AvailableTutorItem[]> => {
    const response = await api.get<AvailableTutorItem[]>('/academics/tutors/available/', { params: program ? { program } : {} });
    return response.data;
  },

  assignTutor: async (payload: { student_id: string; tutor_id?: string | null; period?: string; notes?: string }): Promise<{ message: string; student_id: string; tutor_id: string | null; tutor_name: string }> => {
    const response = await api.post<{ message: string; student_id: string; tutor_id: string | null; tutor_name: string }>('/academics/tutors/assign/', payload);
    return response.data;
  },

  // Summer Remediation Program
  getSummerList: async (): Promise<SummerRecord[]> => {
    const response = await api.get<SummerRecord[]>('/academics/summer/');
    return response.data;
  },

  startSummerParticipation: async (id: number): Promise<{ message: string; record: SummerRecord }> => {
    const response = await api.post<{ message: string; record: SummerRecord }>(`/academics/summer/${id}/start/`);
    return response.data;
  },

  evaluateSummerStudent: async (id: number, payload: { result: 'passed' | 'failed'; notes?: string }): Promise<{ message: string; record: SummerRecord }> => {
    const response = await api.post<{ message: string; record: SummerRecord }>(`/academics/summer/${id}/evaluate/`, payload);
    return response.data;
  },

  // School Year Archive
  getArchivedSchoolYears: async (): Promise<SchoolYear[]> => {
    const response = await api.get<SchoolYear[]>('/academics/archive/');
    return response.data;
  },

  getArchivedSchoolYearDetail: async (schoolYear: string): Promise<ArchivedSchoolYearSnapshot> => {
    const response = await api.get<ArchivedSchoolYearSnapshot>(`/academics/archive/${schoolYear}/`);
    return response.data;
  },

  // Student Complete History
  getStudentCompleteHistory: async (studentId: string): Promise<StudentCompleteHistory> => {
    const response = await api.get<StudentCompleteHistory>(`/academics/students/${studentId}/history/`);
    return response.data;
  },

  // Unified Post-Milestone Assignment Queue
  getAssignmentQueue: async (): Promise<import('../types').AssignmentQueueData> => {
    const response = await api.get<import('../types').AssignmentQueueData>('/academics/evaluations/assignment-queue/');
    return response.data;
  },

  // Bulk Cohort Dispatch
  bulkAssignTutor: async (payload: {
    tutor_id: string;
    student_ids: string[];
    period?: string;
    notes?: string;
  }): Promise<import('../types').BulkAssignResult> => {
    const response = await api.post<import('../types').BulkAssignResult>('/academics/tutors/assign-bulk/', payload);
    return response.data;
  },

  // Tutor Cohort History (Active & Past Archives)
  getTutorCohortHistory: async (tutorId?: string, schoolYear?: string): Promise<import('../types').TutorCohortHistoryData> => {
    const url = tutorId ? `/academics/tutors/${tutorId}/cohort-history/` : '/academics/tutors/cohort-history/';
    const response = await api.get<import('../types').TutorCohortHistoryData>(url, {
      params: schoolYear ? { school_year: schoolYear } : {},
    });
    return response.data;
  },
};
