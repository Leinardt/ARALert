import api from '../api/axios';
import type { User, UserStats } from '../types';

export interface GetUsersParams {
  search?: string;
  role?: string;
  status?: string;
  ordering?: string;
  page?: number;
  assigned_tutor?: string;
}

export interface GetUsersResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: User[];
}

export const userService = {
  getUsers: async (params: GetUsersParams = {}): Promise<GetUsersResponse> => {
    const response = await api.get<GetUsersResponse>('/users/', { params });
    return response.data;
  },

  getUser: async (id: string): Promise<User> => {
    const response = await api.get<User>(`/users/${id}/`);
    return response.data;
  },

  createUser: async (data: any): Promise<User> => {
    const response = await api.post<User>('/users/', data);
    return response.data;
  },

  updateUser: async (id: string, data: any): Promise<User> => {
    const response = await api.patch<User>(`/users/${id}/`, data);
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

  resetPassword: async (id: string, data: any): Promise<{ detail: string }> => {
    const response = await api.post<{ detail: string }>(`/users/${id}/reset-password/`, data);
    return response.data;
  },

  getStats: async (): Promise<UserStats> => {
    const response = await api.get<UserStats>('/users/stats/');
    return response.data;
  },

  getTutors: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/users/tutors/');
    return response.data;
  },
};
