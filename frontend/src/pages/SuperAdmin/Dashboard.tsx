import React, { useEffect, useState } from 'react';
import { userService } from '../../services/userService';
import type { UserStats } from '../../types';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await userService.getStats();
        setStats(data);
      } catch (err: unknown) {
        console.error('Failed to load dashboard stats', err);
        setError('Unable to load dashboard statistics.');
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="w-full max-w-6xl mx-auto bg-white rounded-3xl shadow border border-slate-200 p-6 sm:p-8 flex flex-col flex-1 max-h-[85vh]">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">SuperAdmin Dashboard</h1>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500 flex-1 flex items-center justify-center">Loading statistics…</div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700 flex-1 flex items-center justify-center">{error}</div>
        ) : stats ? (
          <div className="grid gap-4 xl:grid-cols-4 lg:grid-cols-2 flex-1 items-start content-start">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Total users</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{stats.total_users}</p>
              <p className="mt-1 text-xs text-slate-500">Active: {stats.active_users} · Inactive: {stats.inactive_users}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Staff breakdown</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{stats.admins + stats.principals + stats.faculty + stats.tutors}</p>
              <p className="mt-1 text-xs text-slate-500">Admins {stats.admins} · Principals {stats.principals}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Tutors</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{stats.tutors}</p>
              <p className="mt-1 text-xs text-slate-500">Students assigned: {stats.assigned_students}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Students</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{stats.students}</p>
              <p className="mt-1 text-xs text-slate-500">Unassigned: {stats.unassigned_students}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
