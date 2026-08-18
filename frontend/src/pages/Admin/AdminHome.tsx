import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import type { User, UserStats } from '../../types';
import {
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle,
  ChevronRight,
  GraduationCap,
  Shield,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';

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

  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3 animate-fade-in-up">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">School Administration</p>
          <h1 className="mt-0.5 text-xl font-extrabold text-gray-900">
            Welcome, {user?.first_name || user?.full_name || 'Admin'}!
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{today}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3.5 py-2 text-xs font-semibold text-indigo-600 shrink-0">
          <Shield className="w-4 h-4" />
          School Admin Access
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="w-10 h-10 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-600">Loading admin statistics…</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 shadow-sm">
          <p className="text-sm font-bold">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      ) : stats ? (
        <>
          {/* 4 Core Administrative KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Students */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4 animate-fade-in-up">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Students</p>
                <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{stats.total_users}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  Active: {stats.active_users} · Inactive: {stats.inactive_users}
                </p>
              </div>
            </div>

            {/* Attendance Rate */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Attendance Rate</p>
                <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
                  {academicSummary?.average_attendance_rate ?? 0}%
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {attendanceSummary?.total_logs ?? 0} total logs logged
                </p>
              </div>
            </div>

            {/* Performance Average */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Avg Performance</p>
                <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
                  {academicSummary?.average_score ?? 0}%
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {academicSummary?.grade_entries ?? 0} grade assessments
                </p>
              </div>
            </div>

            {/* Academic Risk */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">At-Risk Learners</p>
                <p className="text-2xl font-extrabold text-rose-600 mt-0.5">
                  {(riskSummary?.high ?? 0) + (riskSummary?.medium ?? 0)}
                </p>
                <p className="text-xs text-rose-400 mt-0.5 truncate">
                  {riskSummary?.high ?? 0} High · {riskSummary?.medium ?? 0} Medium
                </p>
              </div>
            </div>
          </div>

          {/* Staff Directory Overview Bar */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Staff Directory Overview</h3>
                <p className="text-xs text-gray-500">
                  {staffTotal} total staff members registered in the system
                </p>
              </div>
              <button
                type="button"
                onClick={() => openStaffDirectory()}
                className="text-xs font-bold text-[var(--brand)] hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
              >
                View Full Directory <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => openStaffDirectory('admin')}
                className="bg-gray-50 hover:bg-gray-100 p-3.5 rounded-xl border border-gray-100 text-left transition-all group flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                  <Shield className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Admins</p>
                  <p className="text-lg font-extrabold text-gray-900">{stats.admins}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openStaffDirectory('principal')}
                className="bg-gray-50 hover:bg-gray-100 p-3.5 rounded-xl border border-gray-100 text-left transition-all group flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                  <Award className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Principals</p>
                  <p className="text-lg font-extrabold text-gray-900">{stats.principals}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openStaffDirectory('faculty')}
                className="bg-gray-50 hover:bg-gray-100 p-3.5 rounded-xl border border-gray-100 text-left transition-all group flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Faculty</p>
                  <p className="text-lg font-extrabold text-gray-900">{stats.faculty}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openStaffDirectory('tutor')}
                className="bg-gray-50 hover:bg-gray-100 p-3.5 rounded-xl border border-gray-100 text-left transition-all group flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tutors</p>
                  <p className="text-lg font-extrabold text-gray-900">{stats.tutors}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Attendance and Risk Summary Rows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Attendance Breakdown */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Attendance Breakdown</h3>
                <span className="text-xs font-semibold text-gray-500">
                  {attendanceSummary?.total_logs ?? 0} total sessions
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Present
                  </p>
                  <p className="text-xl font-extrabold text-gray-900 mt-1">{attendanceSummary?.present ?? 0}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {attendanceSummary?.total_logs ? Math.round(((attendanceSummary.present ?? 0) / attendanceSummary.total_logs) * 100) : 0}% of logs
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Late
                  </p>
                  <p className="text-xl font-extrabold text-gray-900 mt-1">{attendanceSummary?.late ?? 0}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {attendanceSummary?.total_logs ? Math.round(((attendanceSummary.late ?? 0) / attendanceSummary.total_logs) * 100) : 0}% of logs
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Absent
                  </p>
                  <p className="text-xl font-extrabold text-gray-900 mt-1">{attendanceSummary?.absent ?? 0}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {attendanceSummary?.total_logs ? Math.round(((attendanceSummary.absent ?? 0) / attendanceSummary.total_logs) * 100) : 0}% of logs
                  </p>
                </div>
              </div>
            </div>

            {/* Risk Overview */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Academic Risk Distribution</h3>
                <span className="text-xs font-semibold text-gray-500">
                  {(riskSummary?.high ?? 0) + (riskSummary?.medium ?? 0) + (riskSummary?.low ?? 0)} monitored learners
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">High Risk</p>
                  <p className="text-lg font-extrabold text-rose-600 mt-1">{riskSummary?.high ?? 0}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Urgent support</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Med Risk</p>
                  <p className="text-lg font-extrabold text-amber-600 mt-1">{riskSummary?.medium ?? 0}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Monitoring</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Low Risk</p>
                  <p className="text-lg font-extrabold text-emerald-600 mt-1">{riskSummary?.low ?? 0}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">On track</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Resolved</p>
                  <p className="text-lg font-extrabold text-indigo-600 mt-1">{riskSummary?.resolved ?? 0}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Intervened</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Staff Directory Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" onClick={() => setIsStaffModalOpen(false)}>
          <div className="w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-6 flex flex-col h-[75vh]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">Staff directory</p>
                <h2 className="mt-0.5 text-xl font-bold text-gray-900">Staff Overview</h2>
                <p className="mt-0.5 text-xs text-gray-500">Admins, principals, faculty, and tutors directory.</p>
              </div>
              <button type="button" onClick={() => setIsStaffModalOpen(false)} className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex flex-wrap gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStaffFilterRole(null)}
                  className={`px-3 py-1.5 rounded-full font-bold transition-colors ${!staffFilterRole ? 'bg-[var(--brand)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  All Staff ({staffDirectory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStaffFilterRole('admin')}
                  className={`px-3 py-1.5 rounded-full font-bold transition-colors ${staffFilterRole === 'admin' ? 'bg-[var(--brand)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Admins
                </button>
                <button
                  type="button"
                  onClick={() => setStaffFilterRole('principal')}
                  className={`px-3 py-1.5 rounded-full font-bold transition-colors ${staffFilterRole === 'principal' ? 'bg-[var(--brand)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Principals
                </button>
                <button
                  type="button"
                  onClick={() => setStaffFilterRole('faculty')}
                  className={`px-3 py-1.5 rounded-full font-bold transition-colors ${staffFilterRole === 'faculty' ? 'bg-[var(--brand)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Faculty
                </button>
                <button
                  type="button"
                  onClick={() => setStaffFilterRole('tutor')}
                  className={`px-3 py-1.5 rounded-full font-bold transition-colors ${staffFilterRole === 'tutor' ? 'bg-[var(--brand)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Tutors
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 flex-1 flex flex-col">
              {staffDirectoryLoading ? (
                <div className="flex flex-1 items-center justify-center py-12 text-xs font-semibold text-gray-500">Loading staff directory…</div>
              ) : staffDirectoryError ? (
                <div className="flex flex-1 items-center justify-center p-4 text-xs font-semibold text-rose-700">{staffDirectoryError}</div>
              ) : filteredStaff.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-4 text-xs text-gray-500">No staff accounts found for this role.</div>
              ) : (
                <div className="overflow-auto flex-1">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Full Name</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Username / Email</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredStaff.map((person) => (
                        <tr key={person.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">{person.full_name || `${person.first_name} ${person.last_name}`.trim()}</td>
                          <td className="px-4 py-3 text-gray-500">{person.username || person.email}</td>
                          <td className="px-4 py-3 text-gray-500 capitalize">{person.role ?? 'staff'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${person.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
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
