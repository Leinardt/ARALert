import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthResponse, User } from '../types';
import { authService } from '../services/authService';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  googleLogin: (idToken: string) => Promise<AuthResponse>;
  studentLogin: (firstName: string, middleName: string, lastName: string, lrn: string) => Promise<AuthResponse>;
  completeAuthSession: (response: AuthResponse) => void;
  updateProfile: (data: FormData) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const isAuthenticated = Boolean(user);

  const completeAuthSession = (response: AuthResponse) => {
    if (!response.access || !response.refresh || !response.user) {
      return;
    }
    localStorage.setItem('access_token', response.access);
    localStorage.setItem('refresh_token', response.refresh);
    localStorage.setItem('user', JSON.stringify(response.user));
    setUser(response.user);
  };

  const googleLogin = async (idToken: string) => {
    const response = await authService.googleLogin(idToken);
    completeAuthSession(response);
    return response;
  };

  const studentLogin = async (firstName: string, middleName: string, lastName: string, lrn: string) => {
    const response = await authService.studentLogin(firstName, middleName, lastName, lrn);
    completeAuthSession(response);
    return response;
  };

  const updateProfile = async (data: FormData) => {
    const updatedUser = await authService.updateProfile(data);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    return updatedUser;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    try {
      await authService.logout(refreshToken);
    } catch (error) {
      console.warn('Logout request failed', error);
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  useEffect(() => {
    if (!user) return;

    const reloadProfile = async () => {
      try {
        const profile = await authService.getProfile();
        setUser(profile);
        localStorage.setItem('user', JSON.stringify(profile));
      } catch {
        await logout();
      }
    };

    reloadProfile();
  }, []);

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
