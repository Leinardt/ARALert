import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import type { UserStats } from '../../types';
import { Activity, AlertTriangle, GraduationCap, Shield, Sparkles, Users } from 'lucide-react';

export const AdminHome: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await userService.getStats();
        setStats(data);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.detail || 'Unable to load admin statistics.');
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  const attendanceSummary = stats?.attendance_summary;
  const academicSummary = stats?.academic_summary;
  const riskSummary = stats?.risk_summary;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className="mt-2 text-slate-600">
                Track adoption, attendance, academic performance, and intervention needs in one place.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
              <Shield className="h-5 w-5" />
              {user?.full_name ?? 'Admin'} Access
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-center py-24">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">
            {error}
          </div>
        ) : stats ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Total users</p>
                  <p className="mt-4 text-4xl font-extrabold text-slate-900">{stats.total_users}</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <Users className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.active_users}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Inactive</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.inactive_users}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Attendance snapshot</p>
                  <p className="mt-4 text-4xl font-extrabold text-slate-900">{attendanceSummary?.total_logs ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <Activity className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Present</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{attendanceSummary?.present ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Late</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{attendanceSummary?.late ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Absent</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{attendanceSummary?.absent ?? 0}</p>
                </div>
              </div>
              <div className="mt-4 text-sm text-slate-600">
                Attendance rate: <span className="font-semibold text-slate-900">{academicSummary?.average_attendance_rate ?? 0}%</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Academic health</p>
                  <p className="mt-4 text-4xl font-extrabold text-slate-900">{academicSummary?.average_score ?? 0}%</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <GraduationCap className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Grade entries</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{academicSummary?.grade_entries ?? 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg attendance</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{academicSummary?.average_attendance_rate ?? 0}%</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Risk overview</p>
                  <p className="mt-4 text-4xl font-extrabold text-slate-900">{(riskSummary?.high ?? 0) + (riskSummary?.medium ?? 0)}</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-6 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                  <span>High risk</span>
                  <span className="font-semibold text-slate-900">{riskSummary?.high ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                  <span>Medium risk</span>
                  <span className="font-semibold text-slate-900">{riskSummary?.medium ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                  <span>Low risk</span>
                  <span className="font-semibold text-slate-900">{riskSummary?.low ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                  <span>Resolved</span>
                  <span className="font-semibold text-slate-900">{riskSummary?.resolved ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Staff summary</p>
                  <p className="mt-4 text-4xl font-extrabold text-slate-900">{stats.admins + stats.principals + stats.faculty + stats.tutors}</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admins</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.admins}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Principals</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.principals}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Faculty</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.faculty}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tutors</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.tutors}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
