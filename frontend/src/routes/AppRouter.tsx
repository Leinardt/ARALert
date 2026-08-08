import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Layouts
import { PublicLayout } from '../layouts/PublicLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';

// Route guard
import { ProtectedRoute } from './ProtectedRoute';

// Public pages
import { Landing } from '../pages/Landing/Landing';
import { Login } from '../pages/Login/Login';
import { ActivateAccount } from '../pages/Auth/ActivateAccount';
import { ForgotPassword } from '../pages/Auth/ForgotPassword';
import { ResetPassword } from '../pages/Auth/ResetPassword';
import { InvalidLink } from '../pages/Auth/InvalidLink';
import { SuccessPage } from '../pages/Auth/SuccessPage';
import { MFA } from '../pages/Auth/MFA';

// SuperAdmin pages
import { Dashboard } from '../pages/SuperAdmin/Dashboard';
import { UserList } from '../pages/SuperAdmin/UserList';
import { CreateUser } from '../pages/SuperAdmin/CreateUser';
import { EditUser } from '../pages/SuperAdmin/EditUser';
import { Profile } from '../pages/SuperAdmin/Profile';
import { Settings } from '../pages/SuperAdmin/Settings';
import { AuditLog } from '../pages/SuperAdmin/AuditLog';

// Role placeholder pages
import { AdminHome } from '../pages/Admin/AdminHome';
import { AdminAttendanceQR } from '../pages/Admin/AdminAttendanceQR';
import { PrincipalHome } from '../pages/Principal/PrincipalHome';
import { FacultyHome } from '../pages/Faculty/FacultyHome';
import { TutorHome } from '../pages/Tutor/TutorHome';
import { TutorQRGenerator } from '../pages/Tutor/TutorQRGenerator';
import { TutorStudentDirectory } from '../pages/Tutor/TutorStudentDirectory';
import { TutorStudentProfile } from '../pages/Tutor/TutorStudentProfile';
import { TutorAnalytics } from '../pages/Tutor/TutorAnalytics';
import { StaffAttendanceScanner } from '../pages/Tutor/StaffAttendanceScanner';
import TutorScores from '../pages/Tutor/TutorScores';
import { StudentHome } from '../pages/Student/StudentHome';

// Error pages
import { Forbidden403 } from '../pages/errors/Forbidden403';
import { NotFound404 } from '../pages/errors/NotFound404';
import { ServerError500 } from '../pages/errors/ServerError500';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes (Landing & Login) ───────── */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
        </Route>

        {/* ── Auth routes ───────────────────────────── */}
        <Route path="/activate" element={<ActivateAccount />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/mfa" element={<MFA />} />
        <Route path="/invalid-link" element={<InvalidLink />} />
        <Route path="/success" element={<SuccessPage />} />

        {/* ── SuperAdmin routes ─────────────────────── */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/superadmin" element={<Dashboard />} />
          <Route path="/superadmin/users" element={<UserList />} />
          <Route path="/superadmin/users/create" element={<CreateUser />} />
          <Route path="/superadmin/users/edit/:id" element={<EditUser />} />
          <Route path="/superadmin/profile" element={<Profile />} />
          <Route path="/superadmin/settings" element={<Settings />} />
          <Route path="/superadmin/audit-logs" element={<AuditLog />} />
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
          <Route path="/admin/students" element={<UserList />} />
          <Route path="/admin/students/create" element={<CreateUser />} />
          <Route path="/admin/students/edit/:id" element={<EditUser />} />
          <Route path="/admin/attendance" element={<AdminAttendanceQR />} />
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
            <ProtectedRoute allowedRoles={['admin', 'tutor', 'principal', 'faculty', 'student']}>
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
        </Route>

        {/* ── Error routes ──────────────────────────── */}
        <Route path="/403" element={<Forbidden403 />} />
        <Route path="/404" element={<NotFound404 />} />
        <Route path="/500" element={<ServerError500 />} />

        {/* ── Catch-all ─────────────────────────────── */}
        <Route path="*" element={<NotFound404 />} />
      </Routes>
    </BrowserRouter>
  );
};
