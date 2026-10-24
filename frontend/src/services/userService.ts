import api from '../api/axios';
import type { User, UserStats, StudentEditRequest, CreateStudentEditRequestPayload } from '../types';
import { setCachedTutorStudents } from '../utils/tutorCohortHelpers';

export interface GetUsersParams {
  search?: string;
  role?: string;
  status?: string;
  ordering?: string;
  page?: number;
  assigned_tutor?: string;
  subject?: string;
  aral_level?: string;
  grade_level?: string;
  section?: string;
  include_graduated?: boolean;
}

export interface GetUsersResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: User[];
}

export interface UserActivityItem {
  id: string;
  timestamp: string;
  formatted_time: string;
  action: string;
  event_type: 'LOGIN' | 'LOGOUT' | 'OTHER';
  ip_address: string;
  user_agent: string;
  details: Record<string, any> | null;
}

export interface UserActivityResponse {
  user_id: string;
  full_name: string;
  email: string;
  count: number;
  activities: UserActivityItem[];
}

let cachedTutors: { data: User[]; timestamp: number } | null = null;
const TUTOR_CACHE_TTL_MS = 60000;

const tutorStudentsCache = new Map<string, { data: User[]; timestamp: number }>();
const TUTOR_STUDENTS_CACHE_TTL_MS = 60000;

export const invalidateTutorStudentsCache = (tutorId?: string | number): void => {
  if (tutorId) {
    tutorStudentsCache.delete(String(tutorId));
  } else {
    tutorStudentsCache.clear();
  }
};

export const userService = {
  getUsers: async (params: GetUsersParams = {}): Promise<GetUsersResponse> => {
    const response = await api.get<GetUsersResponse>('/users/', { params });
    return response.data;
  },

  getAllUsers: async (params: GetUsersParams = {}): Promise<User[]> => {
    const isPureTutorStudentsQuery =
      params.role === 'student' &&
      !!params.assigned_tutor &&
      !params.search &&
      !params.status &&
      !params.grade_level &&
      !params.section &&
      !params.subject &&
      !params.ordering;

    const tutorKey = isPureTutorStudentsQuery ? String(params.assigned_tutor) : null;

    if (tutorKey) {
      const cached = tutorStudentsCache.get(tutorKey);
      if (cached && Date.now() - cached.timestamp < TUTOR_STUDENTS_CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const users: User[] = [];
    let page = 1;
    let response = await userService.getUsers({ ...params, page });
    users.push(...response.results);
    while (response.next) {
      page += 1;
      response = await userService.getUsers({ ...params, page });
      users.push(...response.results);
    }

    if (tutorKey) {
      tutorStudentsCache.set(tutorKey, { data: users, timestamp: Date.now() });
      setCachedTutorStudents(tutorKey, users);
    }

    return users;
  },

  checkExistingLrns: async (lrns: string[]): Promise<string[]> => {
    if (!lrns || lrns.length === 0) return [];
    try {
      const response = await api.post<{ existing_lrns: string[] }>('/users/check-lrns/', { lrns });
      return response.data.existing_lrns || [];
    } catch (err) {
      console.warn('Failed to call check-lrns endpoint, falling back to student list check:', err);
      try {
        const existingStudents = await userService.getAllUsers({ role: 'student' });
        const set = new Set(existingStudents.map((s) => s.lrn).filter(Boolean));
        return lrns.filter((l) => set.has(l));
      } catch {
        return [];
      }
    }
  },

  getUser: async (id: string): Promise<User> => {
    const response = await api.get<User>(`/users/${id}/`);
    return response.data;
  },

  createUser: async (data: any): Promise<User> => {
    const response = await api.post<User>('/users/', data);
    if (data?.role === 'tutor') {
      cachedTutors = null;
    }
    if (data?.role === 'student' || data?.assigned_tutor) {
      invalidateTutorStudentsCache(data?.assigned_tutor);
    }
    return response.data;
  },

  updateUser: async (id: string, data: any): Promise<User> => {
    const response = await api.patch<User>(`/users/${id}/`, data);
    if (data?.role === 'tutor' || data?.tutor_type || data?.grade_level) {
      cachedTutors = null;
    }
    invalidateTutorStudentsCache(data?.assigned_tutor);
    return response.data;
  },

  activateUser: async (id: string): Promise<{ detail: string }> => {
    const response = await api.patch<{ detail: string }>(`/users/${id}/activate/`);
    return response.data;
  },

  deactivateUser: async (id: string): Promise<{ detail: string }> => {
    const response = await api.patch<{ detail: string }>(`/users/${id}/deactivate/`);
    return response.data;
  },

  bulkAssignTutor: async (
    studentIds: string[],
    tutorId: string | null
  ): Promise<{ detail: string; updated_count: number; tutor_name: string }> => {
    const response = await api.post<{ detail: string; updated_count: number; tutor_name: string }>(
      '/users/bulk-assign-tutor/',
      {
        student_ids: studentIds,
        tutor_id: tutorId,
      }
    );
    invalidateTutorStudentsCache(tutorId || undefined);
    return response.data;
  },

  getUserActivity: async (id: string): Promise<UserActivityResponse> => {
    const response = await api.get<UserActivityResponse>(`/users/${id}/activity/`);
    return response.data;
  },

  getStats: async (): Promise<UserStats> => {
    const response = await api.get<UserStats>('/users/stats/');
    return response.data;
  },

  getCachedTutors: (): User[] | null => {
    if (cachedTutors && (Date.now() - cachedTutors.timestamp) < TUTOR_CACHE_TTL_MS) {
      return cachedTutors.data;
    }
    return null;
  },

  clearTutorsCache: (): void => {
    cachedTutors = null;
  },

  getTutors: async (forceRefresh = false): Promise<User[]> => {
    if (!forceRefresh && cachedTutors && (Date.now() - cachedTutors.timestamp) < TUTOR_CACHE_TTL_MS) {
      return cachedTutors.data;
    }
    const response = await api.get<User[]>('/users/tutors/');
    cachedTutors = { data: response.data, timestamp: Date.now() };
    return response.data;
  },

  getStaff: async (): Promise<User[]> => {
    const response = await api.get<GetUsersResponse>('/users/', { params: { role: 'staff' } });
    return response.data.results;
  },

  getStudentEditRequests: async (params?: { status?: string; student_id?: string }): Promise<{ count: number; pending_count: number; results: StudentEditRequest[] }> => {
    const response = await api.get<{ count: number; pending_count: number; results: StudentEditRequest[] }>('/users/student-edit-requests/', { params });
    return response.data;
  },

  createStudentEditRequest: async (payload: CreateStudentEditRequestPayload): Promise<StudentEditRequest> => {
    const response = await api.post<StudentEditRequest>('/users/student-edit-requests/', payload);
    return response.data;
  },

  reviewStudentEditRequest: async (
    id: string,
    action: 'approve' | 'reject',
    rejection_reason?: string
  ): Promise<{ detail: string; request: StudentEditRequest }> => {
    const response = await api.patch<{ detail: string; request: StudentEditRequest }>(
      `/users/student-edit-requests/${id}/review/`,
      { action, rejection_reason }
    );
    return response.data;
  },

  cancelStudentEditRequest: async (id: string): Promise<{ detail: string }> => {
    const response = await api.delete<{ detail: string }>(`/users/student-edit-requests/${id}/`);
    return response.data;
  },
};


