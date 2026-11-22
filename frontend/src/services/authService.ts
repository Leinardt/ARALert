import api from '../api/axios';
import type { AuthResponse, User } from '../types';
import { clearActivity } from '../utils/activityTracker';

export interface AllowedEmail {
  id: number;
  email: string;
  note: string;
  added_by: string | null;
  date_added: string;
}

export interface LoginHistoryItem {
  id: string;
  event_type: 'login' | 'logout';
  action: string;
  action_label: string;
  timestamp: string;
}

export const authService = {
  getDeviceId: (): string => {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  },

  googleLogin: async (idToken: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/google/', {
      id_token: idToken,
    });
    return response.data;
  },

  studentLogin: async (lrn: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/student-login/', {
      lrn,
    });
    return response.data;
  },

  logout: async (refreshToken: string | null, accessToken?: string | null): Promise<void> => {
    // Capture access token before wiping storage so backend logout endpoint
    // can authenticate, blacklist the refresh token, and record LOGOUT_SUCCESS.
    const tokenToUse =
      accessToken || sessionStorage.getItem('access_token') || localStorage.getItem('access_token');

    // 1. Immediately wipe local auth credentials and activity
    clearActivity();
    sessionStorage.clear();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    // 2. Notify backend to blacklist refresh token and record LOGOUT_SUCCESS audit event
    if (refreshToken) {
      try {
        await api.post(
          '/auth/logout/',
          { refresh: refreshToken },
          tokenToUse ? { headers: { Authorization: `Bearer ${tokenToUse}` } } : undefined
        );
      } catch (err) {
        console.warn('Logout notification completed with error:', err);
      }
    }
  },

  getLoginHistory: async (): Promise<LoginHistoryItem[]> => {
    const response = await api.get<{ results: LoginHistoryItem[]; count: number }>('/auth/login-history/');
    return Array.isArray(response.data?.results) ? response.data.results : [];
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/profile/');
    return response.data;
  },

  updateProfile: async (data: FormData): Promise<User> => {
    const response = await api.patch<User>('/profile/', data);
    return response.data;
  },

  // SuperAdmin: Allowed Emails Whitelist Management
  getAllowedEmails: async (): Promise<AllowedEmail[]> => {
    const response = await api.get<AllowedEmail[]>('/auth/allowed-emails/');
    return response.data;
  },

  addAllowedEmail: async (email: string, note: string = ''): Promise<AllowedEmail> => {
    const response = await api.post<AllowedEmail>('/auth/allowed-emails/', { email, note });
    return response.data;
  },

  deleteAllowedEmail: async (id: number): Promise<void> => {
    await api.delete(`/auth/allowed-emails/${id}/`);
  },

  // Legacy stubs for unused password/MFA pages
  activateAccount: async (..._args: any[]): Promise<any> => {
    return { redirect: '/login' };
  },
  forgotPassword: async (..._args: any[]): Promise<any> => {
    return { detail: 'Password operations are not applicable. All accounts use Google OAuth.' };
  },
  resetPassword: async (..._args: any[]): Promise<any> => {
    return { redirect: '/login' };
  },
  toggleMfa: async (..._args: any[]): Promise<any> => {
    return { mfa_enabled: false };
  },
  verifyOtp: async (..._args: any[]): Promise<any> => {
    return { redirect: '/login' };
  },
};
