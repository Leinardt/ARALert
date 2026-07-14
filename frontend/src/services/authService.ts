import api from '../api/axios';
import type { AuthResponse, User } from '../types';

export const authService = {
  login: async (usernameOrEmail: string, password: string, rememberMe: boolean): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login/', {
      username_or_email: usernameOrEmail,
      password,
      remember_me: rememberMe,
    });
    return response.data;
  },

  studentLogin: async (fullName: string, lrn: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/student-login/', {
      full_name: fullName,
      lrn,
    });
    return response.data;
  },


  logout: async (refreshToken: string | null): Promise<void> => {
    if (refreshToken) {
      await api.post('/auth/logout/', { refresh: refreshToken });
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/profile/');
    return response.data;
  },
};
