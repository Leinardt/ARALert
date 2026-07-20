import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const PublicLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.is_superuser) return '/superadmin';
    return `/${user.role}`;
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/src/assets/ARALert_LOGO.png" alt="ARALert logo" className="w-8 h-8" />
            <span className="font-bold text-xl text-gray-900 tracking-tight">ARALert</span>
          </div>

          <nav className="flex items-center space-x-4">
            <a href="#features" className="text-gray-600 hover:text-indigo-600 text-sm font-medium transition-colors">
              Features
            </a>
            <a href="#about" className="text-gray-600 hover:text-indigo-600 text-sm font-medium transition-colors">
              About
            </a>
            <a href="#contact" className="text-gray-600 hover:text-indigo-600 text-sm font-medium transition-colors">
              Contact
            </a>
            {isAuthenticated ? (
              <Link
                to={getDashboardLink()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium shadow-sm transition-all"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium shadow-sm transition-all"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              A
            </div>
            <span className="font-semibold text-white">ARALert</span>
          </div>
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} ARALert Student Performance Monitoring. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};
