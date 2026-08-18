import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { buildPerformanceTrend, type PerformanceTrendPoint } from '../../utils/performanceTrendHelpers';
import type { StudentAcademicProfile, Attendance } from '../../types';
import {
  GraduationCap,
  Calendar,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';

export const StudentHome: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [performanceTrend, setPerformanceTrend] = useState<PerformanceTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);

  const attendanceRate = profile?.attendance.attendance_rate ?? 0;
  const averageScore = profile?.gpa ?? 0;
  const riskLevel = profile?.computed_risk_level
    ? profile.computed_risk_level.charAt(0).toUpperCase() + profile.computed_risk_level.slice(1)
    : profile?.academic_risks?.[0]?.risk_level_display ?? 'Low';
  const riskLevelKey = (profile?.computed_risk_level || 'low').toLowerCase() as 'low' | 'medium' | 'high';

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const [data, grades, logs] = await Promise.all([
        academicService.getMyProfile(),
        academicService.getGrades(),
        academicService.getAttendanceHistory({ user_id: user.id }),
      ]);
      setProfile(data);
      setPerformanceTrend(buildPerformanceTrend([user.id], grades, logs));
    } catch (err) {
      console.error(err);
      setError('Failed to fetch academic details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);


  useEffect(() => {
    const fetchAttendanceLogs = async () => {
      if (!user) return;
      setLogsLoading(true);
      setLogsError(null);

      try {
        const logs = await academicService.getAttendanceHistory({ user_id: user.id });
        setAttendanceLogs(logs.slice(0, 10));
      } catch (err: any) {
        console.error(err);
        setLogsError('Failed to load attendance history.');
      } finally {
        setLogsLoading(false);
      }
    };

    fetchAttendanceLogs();
  }, [user]);

  const formatDateString = (value: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimeString = (value: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const maxTrendValue = Math.max(...performanceTrend.map((point) => point.value), 100);
  const chartWidth = Math.max(320, performanceTrend.length * 72 + 80);
  const chartHeight = 180;
  const chartLeft = 20;
  const chartRight = chartWidth - 20;
  const chartBottom = 150;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
        {error || 'Profile could not be loaded.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Hello, {user?.first_name}!</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium">
            Your academic and attendance overview.
          </p>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Attendance Rate</p>
            <p className="mt-2 text-3xl font-extrabold text-gray-900">{attendanceRate}%</p>
          </div>
          <div className="p-3 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Average Score</p>
            <p className="mt-2 text-3xl font-extrabold text-gray-900">{averageScore > 0 ? averageScore.toFixed(2) : 'N/A'}</p>
          </div>
          <div className="p-3 rounded-xl bg-[var(--brand-light)] text-[var(--brand)] border border-[var(--brand-border)]">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${
          riskLevelKey === 'high'
            ? 'bg-red-50 border-red-100 text-red-900'
            : riskLevelKey === 'medium'
            ? 'bg-amber-50 border-amber-100 text-amber-900'
            : 'bg-green-50 border-green-100 text-green-900'
        }`}>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wide ${
              riskLevelKey === 'high'
                ? 'text-red-600'
                : riskLevelKey === 'medium'
                ? 'text-amber-600'
                : 'text-green-600'
            }`}>Risk Level</p>
            <p className="mt-2 text-3xl font-extrabold">{riskLevel}</p>
          </div>
          <div className={`p-3 rounded-xl border ${
            riskLevelKey === 'high'
              ? 'bg-red-100 text-red-600 border-red-200'
              : riskLevelKey === 'medium'
              ? 'bg-amber-100 text-amber-600 border-amber-200'
              : 'bg-green-100 text-green-600 border-green-200'
          }`}>
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[var(--brand)]" />
          <h3 className="text-lg font-bold text-gray-900">Performance Trend</h3>
        </div>
        {performanceTrend.length === 0 ? (
          <div className="text-sm text-gray-500">No performance trend data yet.</div>
        ) : (
          <div className="space-y-4">
            <div className="h-56 rounded-xl border border-gray-200 bg-slate-50 p-4 overflow-x-auto">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full min-w-full">
                <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#cbd5e1" strokeWidth="1" />
                <line x1={chartLeft} y1={chartBottom - 50} x2={chartRight} y2={chartBottom - 50} stroke="#e2e8f0" strokeWidth="1" />
                <line x1={chartLeft} y1={chartBottom - 100} x2={chartRight} y2={chartBottom - 100} stroke="#e2e8f0" strokeWidth="1" />
                {performanceTrend.length > 1 && (
                  <path
                    d={performanceTrend.map((point, index) => {
                      const x = chartLeft + (performanceTrend.length === 1 ? (chartRight - chartLeft) / 2 : index * ((chartRight - chartLeft) / (performanceTrend.length - 1)));
                      const y = chartBottom - (point.value / maxTrendValue) * 90;
                      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="var(--brand)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                )}
                {performanceTrend.map((point, index) => {
                  const x = chartLeft + (performanceTrend.length === 1 ? (chartRight - chartLeft) / 2 : index * ((chartRight - chartLeft) / (performanceTrend.length - 1)));
                  const y = chartBottom - (point.value / maxTrendValue) * 90;
                  return (
                    <g key={`${point.label}-${index}`}>
                      <circle cx={x} cy={y} r="5" fill="var(--brand)" />
                      <text x={x} y="168" textAnchor="middle" className="fill-slate-500 text-[10px]">{point.label}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--brand)' }} />Your composite performance trend</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Attendance History</h3>
            <p className="text-xs text-gray-500">Complete attendance log with date, time, and status.</p>
          </div>
          <span className="text-xs text-slate-500">{attendanceLogs.length} entries</span>
        </div>

        {logsLoading ? (
          <div className="text-sm text-gray-500">Loading history...</div>
        ) : logsError ? (
          <div className="text-sm text-red-600">{logsError}</div>
        ) : attendanceLogs.length === 0 ? (
          <div className="text-sm text-gray-500">No attendance history found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Time In</th>
                  <th className="px-3 py-2 font-medium">Time Out</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {attendanceLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2 text-sm text-slate-700">{formatDateString(log.date)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 font-mono">{formatTimeString(log.time_in)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 font-mono">{formatTimeString(log.time_out)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{log.status_display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
