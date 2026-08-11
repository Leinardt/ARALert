import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  TrendingUp,
  AlertCircle,
  QrCode,
  ArrowRight,
} from 'lucide-react';

export const Landing: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.is_superuser) return '/superadmin';
    return `/${user.role}`;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-6 py-20 transition-colors">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 mb-6 rounded-full bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-800">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Palanas National Agriculture High School</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl font-light text-slate-950 dark:text-slate-50 tracking-tight mb-6 leading-[1.2]">
            Detect risk.<br />
            Support growth.
          </h1>
          
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed mb-10">
            Intelligent monitoring for the ARAL program. Early detection, real-time tracking, and proactive interventions for student success.
          </p>

          {/* CTA Button */}
          <Link
            to={isAuthenticated ? getDashboardLink() : '/login'}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors font-medium text-base"
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Access Portal'} 
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Features Grid - Minimal Style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-slate-200 dark:border-slate-800">
          <div className="group">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 pt-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Performance Tracking</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Real-time consolidation of assessments and attendance data.</p>
              </div>
            </div>
          </div>

          <div className="group">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 pt-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Risk Alerts</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Proactive identification of high, medium, and low risk cases.</p>
              </div>
            </div>
          </div>

          <div className="group">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 pt-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                  <QrCode className="w-4 h-4" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">QR Attendance</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Precise timestamped tracking for students and staff.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};