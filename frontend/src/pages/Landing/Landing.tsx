import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  Shield,
  BarChart3,
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
    <div className="min-h-screen flex flex-col lg:flex-row font-body">
      
      {/* ── Left Side: Content & CTA ── */}
      <div className="flex-1 bg-slate-50 p-8 sm:p-12 lg:p-24 flex flex-col justify-center">
        <div className="max-w-xl mx-auto lg:mx-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold mb-6">
            <Shield className="w-4 h-4" />
            <span>Academic Recovery System</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15] mb-6 font-heading">
            Early Risk Detection & Performance Monitoring
          </h1>
          
          <p className="text-lg text-slate-600 mb-8 leading-relaxed">
            Empowering the Academic Recovery and Accessible Learning (ARAL) program with automated risk detection, real-time QR attendance tracking, weighted academic evaluation, and targeted intervention management.
          </p>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link
              to={isAuthenticated ? getDashboardLink() : '/login'}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg transition-all shadow-lg hover:shadow-blue-600/30 w-full sm:w-auto"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Access System Portal'} <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Feature Highlights Grid */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-8 pt-10 border-t border-slate-200/60">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Performance Tracking</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Consolidates assessments and attendance for instant indicators.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Risk Warning</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Algorithms surface high, medium, and low risk alerts proactively.</p>
              </div>
            </div>
            <div className="flex gap-4 sm:col-span-2">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">QR Attendance</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Precise timestamped clock-in and clock-out events for students and staff.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Side: Branding (Logo & Info) ── */}
      <div className="flex-1 p-8 sm:p-12 lg:p-24 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[40vh] lg:min-h-screen">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-white rounded-full mix-blend-overlay filter blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-white rounded-full mix-blend-overlay filter blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center">
            <img 
              src="/src/assets/ARALert_LOGO_light.png" 
              alt="ARALert Logo" 
              className="w-40 h-40 sm:w-56 sm:h-56 object-contain drop-shadow-xl"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/src/assets/ARALert_LOGO.png';
              }}
            />
        </div>
      </div>
    </div>
  );
};
