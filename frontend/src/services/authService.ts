import api from '../api/axios';
import type { AuthResponse, User } from '../types';

export const authService = {
  // Generate or retrieve a device ID for trusted device tracking.
  // Uses crypto.randomUUID() for a cryptographically secure identifier.
  getDeviceId: (): string => {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  },

  login: async (usernameOrEmail: string, password: string, rememberMe: boolean): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login/', {
      username_or_email: usernameOrEmail,
      password,
      remember_me: rememberMe,
      device_id: authService.getDeviceId(),
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

  activateAccount: async (token: string, username: string, password: string, confirmPassword: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/activate/', {
      token,
      username,
      password,
      confirm_password: confirmPassword,
    });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ detail: string }> => {
    const response = await api.post<{ detail: string }>('/auth/forgot-password/', { email });
    return response.data;
  },

  resetPassword: async (token: string, password: string, confirmPassword: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/reset-password/', {
      token,
      password,
      confirm_password: confirmPassword,
    });
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/profile/');
    return response.data;
  },

  updateProfile: async (data: FormData): Promise<User> => {
    const response = await api.patch<User>('/profile/', data);
    return response.data;
  },

  toggleMfa: async (enable: boolean): Promise<{ mfa_enabled: boolean }> => {
    const response = await api.post<{ mfa_enabled: boolean }>('/auth/mfa/', { enable });
    return response.data;
  },

  verifyOtp: async (userId: string, code: string, rememberDevice: boolean = false): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/verify-otp/', { 
      user_id: userId, 
      code, 
      remember_device: rememberDevice,
      device_id: authService.getDeviceId(),
    });
    return response.data;
  },
};
