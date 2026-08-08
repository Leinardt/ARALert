import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import type { User, UserStats } from '../../types';
import { Activity, AlertTriangle, GraduationCap, Shield, Sparkles, Users, X } from 'lucide-react';

export const AdminHome: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffDirectory, setStaffDirectory] = useState<User[]>([]);
  const [staffDirectoryLoading, setStaffDirectoryLoading] = useState(false);
  const [staffDirectoryError, setStaffDirectoryError] = useState<string | null>(null);
  const [staffFilterRole, setStaffFilterRole] = useState<string | null>(null);

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

  const openStaffDirectory = async (role?: string) => {
    setStaffFilterRole(role || null);
    setIsStaffModalOpen(true);
    if (staffDirectory.length) {
      return;
    }

    try {
      setStaffDirectoryLoading(true);
      setStaffDirectoryError(null);
      const staffResponse = await userService.getUsers({ role: 'staff' });
      const staffList = staffResponse.results.sort((a, b) =>
        (a.full_name || `${a.first_name} ${a.last_name}`).localeCompare(b.full_name || `${b.first_name} ${b.last_name}`)
      );
      setStaffDirectory(staffList);
    } catch (err: any) {
      console.error(err);
      setStaffDirectoryError(err.response?.data?.detail || 'Unable to load staff directory.');
    } finally {
      setStaffDirectoryLoading(false);
    }
  };

  const attendanceSummary = stats?.attendance_summary;
  const academicSummary = stats?.academic_summary;
  const riskSummary = stats?.risk_summary;
  const staffTotal = useMemo(() => (stats ? stats.admins + stats.principals + stats.faculty + stats.tutors : 0), [stats]);

  const filteredStaff = useMemo(() => {
    if (!staffFilterRole) return staffDirectory;
    return staffDirectory.filter(person => person.role === staffFilterRole);
  }, [staffDirectory, staffFilterRole]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">
                Track student progress, attendance, and staff activity from one concise workspace.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-light)] px-3 py-2 text-sm font-semibold text-[var(--brand-dark)]">
              <Shield className="h-4 w-4" />
              {user?.full_name ?? 'Admin'} Access
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : stats ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Students</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.total_users}</p>
                </div>
                <div className="rounded-xl bg-[var(--brand-light)] p-2.5 text-[var(--brand-dark)]">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Active</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stats.active_users}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Inactive</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stats.inactive_users}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Attendance</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{attendanceSummary?.total_logs ?? 0}</p>
                </div>
                <div className="rounded-xl bg-[var(--brand-light)] p-2.5 text-[var(--brand-dark)]">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Present</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{attendanceSummary?.present ?? 0}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Late</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{attendanceSummary?.late ?? 0}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Absent</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{attendanceSummary?.absent ?? 0}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Attendance rate: <span className="font-semibold text-slate-900">{academicSummary?.average_attendance_rate ?? 0}%</span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Performance</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{academicSummary?.average_score ?? 0}%</p>
                </div>
                <div className="rounded-xl bg-[var(--brand-light)] p-2.5 text-[var(--brand-dark)]">
                  <GraduationCap className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Grade entries</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{academicSummary?.grade_entries ?? 0}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Avg attendance</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{academicSummary?.average_attendance_rate ?? 0}%</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Risk overview</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{(riskSummary?.high ?? 0) + (riskSummary?.medium ?? 0)}</p>
                </div>
                <div className="rounded-xl bg-[var(--brand-light)] p-2.5 text-[var(--brand-dark)]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span>High risk</span>
                  <span className="font-semibold text-slate-900">{riskSummary?.high ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span>Medium risk</span>
                  <span className="font-semibold text-slate-900">{riskSummary?.medium ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span>Low risk</span>
                  <span className="font-semibold text-slate-900">{riskSummary?.low ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span>Resolved</span>
                  <span className="font-semibold text-slate-900">{riskSummary?.resolved ?? 0}</span>
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm sm:p-5 xl:col-span-2 flex flex-col"
            >
              <div className="flex items-center justify-between gap-3 cursor-pointer group" onClick={() => openStaffDirectory()}>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 group-hover:text-blue-600 transition-colors">Staff summary</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{staffTotal}</p>
                  <p className="mt-1 text-sm text-slate-600">View admins, principals, faculty, and tutors in one organized directory.</p>
                </div>
                <div className="rounded-xl bg-[var(--brand-light)] p-2.5 text-[var(--brand-dark)] group-hover:bg-blue-100 transition-colors">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-4">
                <button type="button" onClick={() => openStaffDirectory('admin')} className="rounded-xl bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Admins</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stats.admins}</p>
                </button>
                <button type="button" onClick={() => openStaffDirectory('principal')} className="rounded-xl bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Principals</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stats.principals}</p>
                </button>
                <button type="button" onClick={() => openStaffDirectory('faculty')} className="rounded-xl bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Faculty</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stats.faculty}</p>
                </button>
                <button type="button" onClick={() => openStaffDirectory('tutor')} className="rounded-xl bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Tutors</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{stats.tutors}</p>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" onClick={() => setIsStaffModalOpen(false)}>
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6 flex flex-col h-[75vh]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Staff directory</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Staff overview</h2>
                <p className="mt-1 text-sm text-slate-600">Admins, principals, faculty, and tutors are shown in a concise, responsive list.</p>
              </div>
              <button type="button" onClick={() => setIsStaffModalOpen(false)} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4">
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setStaffFilterRole(null)}
                  className={`px-3 py-1.5 rounded-full font-medium transition-colors ${!staffFilterRole ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  All Staff
                </button>
                <button
                  type="button"
                  onClick={() => setStaffFilterRole('admin')}
                  className={`px-3 py-1.5 rounded-full font-medium transition-colors ${staffFilterRole === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Admins
                </button>
                <button
                  type="button"
                  onClick={() => setStaffFilterRole('principal')}
                  className={`px-3 py-1.5 rounded-full font-medium transition-colors ${staffFilterRole === 'principal' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Principals
                </button>
                <button
                  type="button"
                  onClick={() => setStaffFilterRole('faculty')}
                  className={`px-3 py-1.5 rounded-full font-medium transition-colors ${staffFilterRole === 'faculty' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Faculty
                </button>
                <button
                  type="button"
                  onClick={() => setStaffFilterRole('tutor')}
                  className={`px-3 py-1.5 rounded-full font-medium transition-colors ${staffFilterRole === 'tutor' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Tutors
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 flex-1 flex flex-col">
              {staffDirectoryLoading ? (
                <div className="flex flex-1 items-center justify-center py-12 text-sm text-slate-600">Loading staff directory…</div>
              ) : staffDirectoryError ? (
                <div className="flex flex-1 items-center justify-center p-4 text-sm text-red-700">{staffDirectoryError}</div>
              ) : filteredStaff.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-4 text-sm text-slate-600">No staff accounts available for the selected role.</div>
              ) : (
                <div className="overflow-auto flex-1">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold text-slate-600">Full name</th>
                        <th className="px-3 py-3 text-left font-semibold text-slate-600">Username / Email</th>
                        <th className="px-3 py-3 text-left font-semibold text-slate-600">Role</th>
                        <th className="px-3 py-3 text-left font-semibold text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredStaff.map((person) => (
                        <tr key={person.id} className="hover:bg-slate-50">
                          <td className="px-3 py-3 font-medium text-slate-900">{person.full_name || `${person.first_name} ${person.last_name}`.trim()}</td>
                          <td className="px-3 py-3 text-slate-600">{person.username || person.email}</td>
                          <td className="px-3 py-3 text-slate-600 capitalize">{person.role ?? 'staff'}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${person.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              {person.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
