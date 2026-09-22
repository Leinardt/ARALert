import axios from 'axios';
import { timeService } from '../services/timeService';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// ── Request interceptor — attach access token & measure start time ──────────
api.interceptors.request.use((config) => {
  (config as any)._requestStartMonotonic = typeof performance !== 'undefined' ? performance.now() : 0;
  const accessToken = localStorage.getItem('access_token');
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

// ── Response interceptor — server time sync & 401 Unauthorized handling ────
api.interceptors.response.use(
  (response) => {
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
  (error) => {
    const serverTimestampStr = error.response?.headers?.['x-server-timestamp'];
    if (serverTimestampStr) {
      const serverTimestampMs = parseInt(serverTimestampStr, 10);
      timeService.syncFromHeader(serverTimestampMs);
    }
    if (error.response?.status === 401) {
      // Clear all auth state and redirect to login with an expiry notice
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('mfa_user_id');

      // Only redirect if we are not already on an auth page to avoid loops
      const publicPaths = ['/login', '/activate', '/forgot-password', '/reset-password', '/mfa', '/invalid-link'];
      const isPublicPath = publicPaths.some((p) => window.location.pathname.startsWith(p));
      if (!isPublicPath) {
        window.location.assign('/login?expired=true');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
