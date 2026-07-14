import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: (UserRole | 'superadmin')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="mt-4 text-sm font-medium text-gray-500">Loading session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    // Redirect to login screen but save current location context
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check roles if specified
  if (allowedRoles) {
    const userRole = user.is_superuser ? 'superadmin' : (user.role as UserRole);
    if (!allowedRoles.includes(userRole)) {
      // User role not authorized for this route
      return <Navigate to="/403" replace />;
    }
  }

  return <>{children}</>;
};
