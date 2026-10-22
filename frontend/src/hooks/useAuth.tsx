import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthResponse, User } from '../types';
import { authService } from '../services/authService';
import { initActivityTracker, resetActivity } from '../utils/activityTracker';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  googleLogin: (idToken: string) => Promise<AuthResponse>;
  studentLogin: (lrn: string) => Promise<AuthResponse>;
  completeAuthSession: (response: AuthResponse) => void;
  updateProfile: (data: FormData) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Session-based authentication: closing the browser or tab terminates the session.
    try {
      const storedUser = sessionStorage.getItem('user');
      if (!storedUser || storedUser === 'undefined' || storedUser === 'null') {
        return null;
      }
      return JSON.parse(storedUser);
    } catch (err) {
      console.warn('Failed to parse stored user from sessionStorage:', err);
      sessionStorage.removeItem('user');
      return null;
    }
  });

  const isAuthenticated = Boolean(user);

  const completeAuthSession = (response: AuthResponse) => {
    if (!response.access || !response.refresh || !response.user) {
      return;
    }
    resetActivity();
    sessionStorage.setItem('aralert_login_greeting_pending', 'true');
    sessionStorage.removeItem('aralert_greeting_played_in_session');
    sessionStorage.setItem('access_token', response.access);
    sessionStorage.setItem('refresh_token', response.refresh);
    sessionStorage.setItem('user', JSON.stringify(response.user));
    // Clean up any legacy localStorage keys
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(response.user);
  };

  const googleLogin = async (idToken: string) => {
    const response = await authService.googleLogin(idToken);
    completeAuthSession(response);
    return response;
  };

  const studentLogin = async (lrn: string) => {
    const response = await authService.studentLogin(lrn);
    completeAuthSession(response);
    return response;
  };

  const updateProfile = async (data: FormData) => {
    const updatedUser = await authService.updateProfile(data);
    sessionStorage.setItem('user', JSON.stringify(updatedUser));
    localStorage.removeItem('user');
    setUser(updatedUser);
    return updatedUser;
  };

  const logout = async () => {
    const refreshToken = sessionStorage.getItem('refresh_token') || localStorage.getItem('refresh_token');

    // Immediately clear all session & local storage to eliminate UI lag
    sessionStorage.removeItem('aralert_login_greeting_pending');
    sessionStorage.removeItem('aralert_greeting_played_in_session');
    sessionStorage.removeItem('aralert_is_first_login');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);

    try {
      await authService.logout(refreshToken);
    } catch (error) {
      console.warn('Logout request failed', error);
    }
  };

  useEffect(() => {
    // If no access token exists in session, clear user state
    const accessToken = sessionStorage.getItem('access_token');
    if (!accessToken) {
      setUser(null);
    }
  }, []);

  // ── 30-Minute AFK Inactivity Detection ─────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleAfkTimeout = async () => {
      await logout();
      const publicPaths = ['/login', '/activate', '/forgot-password', '/reset-password', '/mfa', '/invalid-link'];
      const isPublicPath = publicPaths.some((p) => window.location.pathname.startsWith(p));
      if (!isPublicPath) {
        window.location.assign('/login?expired=true');
      }
    };

    const cleanupTracker = initActivityTracker(handleAfkTimeout);
    return cleanupTracker;
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, googleLogin, studentLogin, completeAuthSession, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
