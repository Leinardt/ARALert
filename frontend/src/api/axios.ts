import axios from 'axios';
import { timeService } from '../services/timeService';
import { isUserAfk, recordActivity, clearActivity } from '../utils/activityTracker';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// State for refreshing access token seamlessly when active
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const handleForceLogout = () => {
  clearActivity();
  sessionStorage.clear();
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('mfa_user_id');

  const publicPaths = ['/login', '/activate', '/forgot-password', '/reset-password', '/mfa', '/invalid-link'];
  const isPublicPath = publicPaths.some((p) => window.location.pathname.startsWith(p));
  if (!isPublicPath) {
    window.location.assign('/login?expired=true');
  }
};

// ── Request interceptor — attach access token & measure start time ──────────
api.interceptors.request.use((config) => {
  (config as any)._requestStartMonotonic = typeof performance !== 'undefined' ? performance.now() : 0;

  // If user has been AFK for 30 minutes, abort and force session expiry
  if (isUserAfk()) {
    handleForceLogout();
    return Promise.reject(new Error('Session expired due to inactivity.'));
  }

  const accessToken = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  if (config.data instanceof FormData) {
    config.headers = config.headers || {};
    delete config.headers['Content-Type'];
  }

  return config;
});

// ── Response interceptor — server time sync & silent token refresh / 401 handling ────
api.interceptors.response.use(
  (response) => {
    recordActivity();
    const serverTimestampStr = response.headers?.['x-server-timestamp'];
    if (serverTimestampStr) {
      const serverTimestampMs = parseInt(serverTimestampStr, 10);
      const startMono = (response.config as any)?._requestStartMonotonic || 0;
      const endMono = typeof performance !== 'undefined' ? performance.now() : 0;
      const latency = startMono > 0 ? Math.max(0, endMono - startMono) : 0;
      timeService.syncFromHeader(serverTimestampMs, latency);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const serverTimestampStr = error.response?.headers?.['x-server-timestamp'];
    if (serverTimestampStr) {
      const serverTimestampMs = parseInt(serverTimestampStr, 10);
      timeService.syncFromHeader(serverTimestampMs);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // 1. If user is AFK for >= 30 mins, expire session immediately
      if (isUserAfk()) {
        handleForceLogout();
        return Promise.reject(error);
      }

      const refreshToken = sessionStorage.getItem('refresh_token') || localStorage.getItem('refresh_token');
      // If no refresh token is available, or this request was already an auth endpoint, logout
      if (
        !refreshToken ||
        originalRequest.url?.includes('/auth/refresh/') ||
        originalRequest.url?.includes('/auth/google/') ||
        originalRequest.url?.includes('/auth/student-login/')
      ) {
        handleForceLogout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the ongoing refresh completes
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint directly using raw axios to avoid interceptor loop
        const refreshResponse = await axios.post<{ access: string; refresh?: string }>(
          `${baseURL}/auth/refresh/`,
          { refresh: refreshToken },
          { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
        );

        const newAccessToken = refreshResponse.data.access;
        const newRefreshToken = refreshResponse.data.refresh || refreshToken;

        sessionStorage.setItem('access_token', newAccessToken);
        sessionStorage.setItem('refresh_token', newRefreshToken);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        recordActivity();

        processQueue(null, newAccessToken);

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        handleForceLogout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
