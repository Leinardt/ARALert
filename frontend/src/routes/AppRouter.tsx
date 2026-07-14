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

// SuperAdmin pages
import { Dashboard } from '../pages/SuperAdmin/Dashboard';
import { UserList } from '../pages/SuperAdmin/UserList';
import { CreateUser } from '../pages/SuperAdmin/CreateUser';
import { EditUser } from '../pages/SuperAdmin/EditUser';
import { Profile } from '../pages/SuperAdmin/Profile';
import { Settings } from '../pages/SuperAdmin/Settings';

// Role placeholder pages
import { AdminHome } from '../pages/Admin/AdminHome';
import { PrincipalHome } from '../pages/Principal/PrincipalHome';
import { FacultyHome } from '../pages/Faculty/FacultyHome';
import { TutorHome } from '../pages/Tutor/TutorHome';
import { StudentHome } from '../pages/Student/StudentHome';

// Error pages
import { Forbidden403 } from '../pages/errors/Forbidden403';
import { NotFound404 } from '../pages/errors/NotFound404';
import { ServerError500 } from '../pages/errors/ServerError500';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes ─────────────────────────── */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
        </Route>

        {/* ── Auth routes ───────────────────────────── */}
        <Route path="/login" element={<Login />} />

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
