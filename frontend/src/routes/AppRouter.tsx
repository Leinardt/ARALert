import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Layouts
import { PublicLayout } from '../layouts/PublicLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';

// Route guard
import { ProtectedRoute } from './ProtectedRoute';

import { lazyWithRetry } from '../utils/lazyWithRetry';

// Dynamic / Lazy-loaded Public pages
const Landing = lazyWithRetry(() => import('../pages/Landing/Landing').then(m => ({ default: m.Landing })));
const Login = lazyWithRetry(() => import('../pages/Login/Login').then(m => ({ default: m.Login })));
const TermsOfService = lazyWithRetry(() => import('../pages/Legal/TermsOfService').then(m => ({ default: m.TermsOfService })));
const PrivacyPolicy = lazyWithRetry(() => import('../pages/Legal/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const ActivateAccount = lazyWithRetry(() => import('../pages/Auth/ActivateAccount').then(m => ({ default: m.ActivateAccount })));
const ForgotPassword = lazyWithRetry(() => import('../pages/Auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazyWithRetry(() => import('../pages/Auth/ResetPassword').then(m => ({ default: m.ResetPassword })));
const InvalidLink = lazyWithRetry(() => import('../pages/Auth/InvalidLink').then(m => ({ default: m.InvalidLink })));
const SuccessPage = lazyWithRetry(() => import('../pages/Auth/SuccessPage').then(m => ({ default: m.SuccessPage })));
const MFA = lazyWithRetry(() => import('../pages/Auth/MFA').then(m => ({ default: m.MFA })));

// SuperAdmin / Admin pages
const UserList = lazyWithRetry(() => import('../pages/SuperAdmin/UserList').then(m => ({ default: m.UserList })));
const CreateUser = lazyWithRetry(() => import('../pages/SuperAdmin/CreateUser').then(m => ({ default: m.CreateUser })));
const EditUser = lazyWithRetry(() => import('../pages/SuperAdmin/EditUser').then(m => ({ default: m.EditUser })));
const Profile = lazyWithRetry(() => import('../pages/SuperAdmin/Profile').then(m => ({ default: m.Profile })));
const Settings = lazyWithRetry(() => import('../pages/SuperAdmin/Settings').then(m => ({ default: m.Settings })));
const AuditLog = lazyWithRetry(() => import('../pages/SuperAdmin/AuditLog').then(m => ({ default: m.AuditLog })));

// Role pages
const AdminHome = lazyWithRetry(() => import('../pages/Admin/AdminHome').then(m => ({ default: m.AdminHome })));
const AdminAttendanceQR = lazyWithRetry(() => import('../pages/Admin/AdminAttendanceQR').then(m => ({ default: m.AdminAttendanceQR })));
const AdminEvaluationHub = lazyWithRetry(() => import('../pages/Admin/AdminEvaluationHub').then(m => ({ default: m.AdminEvaluationHub })));
const AssessmentsArchive = lazyWithRetry(() => import('../pages/Admin/AssessmentsArchive').then(m => ({ default: m.AssessmentsArchive })));
const PrincipalHome = lazyWithRetry(() => import('../pages/Principal/PrincipalHome').then(m => ({ default: m.PrincipalHome })));
const PrincipalAnalytics = lazyWithRetry(() => import('../pages/Principal/PrincipalAnalytics').then(m => ({ default: m.PrincipalAnalytics })));
const FacultyHome = lazyWithRetry(() => import('../pages/Faculty/FacultyHome').then(m => ({ default: m.FacultyHome })));
const TutorHome = lazyWithRetry(() => import('../pages/Tutor/TutorHome').then(m => ({ default: m.TutorHome })));
const TutorQRGenerator = lazyWithRetry(() => import('../pages/Tutor/TutorQRGenerator').then(m => ({ default: m.TutorQRGenerator })));
const TutorStudentDirectory = lazyWithRetry(() => import('../pages/Tutor/TutorStudentDirectory').then(m => ({ default: m.TutorStudentDirectory })));
const TutorStudentProfile = lazyWithRetry(() => import('../pages/Tutor/TutorStudentProfile').then(m => ({ default: m.TutorStudentProfile })));
const TutorAnalytics = lazyWithRetry(() => import('../pages/Tutor/TutorAnalytics').then(m => ({ default: m.TutorAnalytics })));
const StaffAttendanceScanner = lazyWithRetry(() => import('../pages/Tutor/StaffAttendanceScanner').then(m => ({ default: m.StaffAttendanceScanner })));
const TutorScores = lazyWithRetry(() => import('../pages/Tutor/TutorScores'));
const StudentHome = lazyWithRetry(() => import('../pages/Student/StudentHome').then(m => ({ default: m.StudentHome })));
const StudentQRAttendance = lazyWithRetry(() => import('../pages/Student/StudentQRAttendance').then(m => ({ default: m.StudentQRAttendance })));
const StudentScores = lazyWithRetry(() => import('../pages/Student/StudentScores').then(m => ({ default: m.StudentScores })));
const StudentAnalytics = lazyWithRetry(() => import('../pages/Student/StudentAnalytics').then(m => ({ default: m.StudentAnalytics })));

// Error pages
const Forbidden403 = lazyWithRetry(() => import('../pages/errors/Forbidden403').then(m => ({ default: m.Forbidden403 })));
const NotFound404 = lazyWithRetry(() => import('../pages/errors/NotFound404').then(m => ({ default: m.NotFound404 })));
const ServerError500 = lazyWithRetry(() => import('../pages/errors/ServerError500').then(m => ({ default: m.ServerError500 })));

import { PageFallback } from '../components/PageFallback';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes (Landing, Login, Legal) ── */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        </Route>

        {/* ── Auth routes (without skeleton loading) ── */}
        <Route path="/activate" element={<Suspense fallback={<PageFallback />}><ActivateAccount /></Suspense>} />
        <Route path="/forgot-password" element={<Suspense fallback={<PageFallback />}><ForgotPassword /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<PageFallback />}><ResetPassword /></Suspense>} />
        <Route path="/mfa" element={<Suspense fallback={<PageFallback />}><MFA /></Suspense>} />
        <Route path="/invalid-link" element={<Suspense fallback={<PageFallback />}><InvalidLink /></Suspense>} />
        <Route path="/success" element={<Suspense fallback={<PageFallback />}><SuccessPage /></Suspense>} />

        {/* ── SuperAdmin routes ─────────────────────── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/superadmin" element={<AdminHome />} />
          <Route path="/superadmin/users" element={<UserList />} />
          <Route path="/superadmin/users/create" element={<CreateUser />} />
          <Route path="/superadmin/users/edit/:id" element={<EditUser />} />
          <Route path="/superadmin/students" element={<UserList />} />
          <Route path="/superadmin/students/create" element={<CreateUser />} />
          <Route path="/superadmin/students/edit/:id" element={<EditUser />} />
          <Route path="/superadmin/tutors" element={<UserList />} />
          <Route path="/superadmin/tutors/create" element={<CreateUser />} />
          <Route path="/superadmin/tutors/edit/:id" element={<EditUser />} />
          <Route path="/superadmin/faculty" element={<UserList />} />
          <Route path="/superadmin/faculty/create" element={<CreateUser />} />
          <Route path="/superadmin/faculty/edit/:id" element={<EditUser />} />
          <Route path="/superadmin/principals" element={<UserList />} />
          <Route path="/superadmin/principals/create" element={<CreateUser />} />
          <Route path="/superadmin/principals/edit/:id" element={<EditUser />} />
          <Route path="/superadmin/admins" element={<UserList />} />
          <Route path="/superadmin/admins/create" element={<CreateUser />} />
          <Route path="/superadmin/admins/edit/:id" element={<EditUser />} />
          <Route path="/superadmin/superadmins" element={<UserList />} />
          <Route path="/superadmin/superadmins/create" element={<CreateUser />} />
          <Route path="/superadmin/superadmins/edit/:id" element={<EditUser />} />
          <Route path="/superadmin/attendance" element={<AdminAttendanceQR />} />
          <Route path="/superadmin/evaluations" element={<AdminEvaluationHub />} />
          <Route path="/superadmin/archive" element={<AssessmentsArchive />} />
          <Route path="/superadmin/audit-logs" element={<AuditLog />} />
          <Route path="/superadmin/profile" element={<Profile />} />
          <Route path="/superadmin/settings" element={<Settings />} />
        </Route>

        {/* ── Admin routes ──────────────────────────── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/users" element={<UserList />} />
          <Route path="/admin/students" element={<UserList />} />
          <Route path="/admin/students/create" element={<CreateUser />} />
          <Route path="/admin/students/edit/:id" element={<EditUser />} />
          <Route path="/admin/tutors" element={<UserList />} />
          <Route path="/admin/tutors/create" element={<CreateUser />} />
          <Route path="/admin/tutors/edit/:id" element={<EditUser />} />
          <Route path="/admin/faculty" element={<UserList />} />
          <Route path="/admin/faculty/create" element={<CreateUser />} />
          <Route path="/admin/faculty/edit/:id" element={<EditUser />} />
          <Route path="/admin/principals" element={<UserList />} />
          <Route path="/admin/principals/create" element={<CreateUser />} />
          <Route path="/admin/principals/edit/:id" element={<EditUser />} />
          <Route path="/admin/admins" element={<UserList />} />
          <Route path="/admin/admins/create" element={<CreateUser />} />
          <Route path="/admin/admins/edit/:id" element={<EditUser />} />
          <Route path="/admin/attendance" element={<AdminAttendanceQR />} />
          <Route path="/admin/evaluations" element={<AdminEvaluationHub />} />
          <Route path="/admin/archive" element={<AssessmentsArchive />} />
          <Route path="/admin/audit-logs" element={<AuditLog />} />
          <Route path="/admin/profile" element={<Profile />} />
          <Route path="/admin/settings" element={<Settings />} />
        </Route>

        {/* ── Principal routes ──────────────────────── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['principal']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/principal" element={<PrincipalHome />} />
          <Route path="/principal/analytics" element={<PrincipalAnalytics />} />
        </Route>

        {/* ── Faculty routes ────────────────────────── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['faculty']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/faculty" element={<FacultyHome />} />
        </Route>

        {/* ── Tutor routes ──────────────────────────── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['tutor']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/tutor" element={<TutorHome />} />
          <Route path="/tutor/attendance/generate" element={<TutorQRGenerator />} />
          <Route path="/tutor/analytics" element={<TutorAnalytics />} />
          <Route path="/tutor/students" element={<TutorStudentDirectory />} />
          <Route path="/tutor/scores" element={<TutorScores />} />
          <Route path="/tutor/students/:id" element={<TutorStudentProfile />} />
        </Route>

        {/* ── Shared Staff routes ──────────────────── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['admin', 'tutor', 'faculty', 'student', 'principal']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/staff/scan" element={<StaffAttendanceScanner />} />
        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={['superadmin', 'admin', 'tutor', 'principal', 'faculty', 'student']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* ── Student routes ────────────────────────── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/student" element={<StudentHome />} />
          <Route path="/student/attendance" element={<StudentQRAttendance />} />
          <Route path="/student/scores" element={<StudentScores />} />
          <Route path="/student/academic-records" element={<StudentScores />} />
          <Route path="/student/analytics" element={<StudentAnalytics />} />
        </Route>

        {/* ── Error routes (without skeleton loading) ── */}
        <Route path="/403" element={<Suspense fallback={<PageFallback />}><Forbidden403 /></Suspense>} />
        <Route path="/404" element={<Suspense fallback={<PageFallback />}><NotFound404 /></Suspense>} />
        <Route path="/500" element={<Suspense fallback={<PageFallback />}><ServerError500 /></Suspense>} />

        {/* ── Catch-all ─────────────────────────────── */}
        <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound404 /></Suspense>} />
      </Routes>
    </BrowserRouter>
);
};

