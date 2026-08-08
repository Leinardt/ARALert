import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, UsersRound } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';

const formatDate = (date: string) => {
  const parsedDate = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsedDate.getTime())
    ? date
    : parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const FacultyHome: React.FC = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const loadAttendance = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const history = await academicService.getAttendanceHistory({ user_id: user.id });
        setAttendance(history);
      } catch (err) {
        console.error('Failed to load faculty attendance history', err);
        setError('Unable to load attendance data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadAttendance();
  }, [user?.id]);

  const attendanceRate = useMemo(() => {
    if (!attendance.length) return 0;
    const presentCount = attendance.filter((entry) => entry.status.toLowerCase() === 'present').length;
    return Math.round((presentCount / attendance.length) * 100);
  }, [attendance]);

  const chartPoints = useMemo(() => {
    const chronologicalRecords = [...attendance]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-8);

    let presentCount = 0;
    return chronologicalRecords.map((entry, index) => {
      if (entry.status.toLowerCase() === 'present') presentCount += 1;
      return {
        label: formatDate(entry.date),
        rate: Math.round((presentCount / (index + 1)) * 100),
      };
    });
  }, [attendance]);

  const facultyType = user?.faculty_type?.trim() || 'Not assigned';
  const chartWidth = 420;
  const chartHeight = 210;
  const chartPadding = { top: 18, right: 18, bottom: 38, left: 36 };
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const pointCoordinates = chartPoints.map((point, index) => ({
    ...point,
    x: chartPadding.left + (chartPoints.length === 1 ? plotWidth / 2 : (index * plotWidth) / (chartPoints.length - 1)),
    y: chartPadding.top + plotHeight - (point.rate / 100) * plotHeight,
  }));
  const linePath = pointCoordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Faculty overview</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Welcome back, {user?.full_name || 'Faculty'}</h1>
            <p className="mt-1 text-sm text-slate-600">Track your current profile and attendance trend in a single concise view.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-light)] px-3 py-2 text-sm font-semibold text-[var(--brand-dark)]">
            <UsersRound className="h-4 w-4" />
            {facultyType}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[var(--brand-light)] p-2.5 text-[var(--brand-dark)]">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Attendance rate</p>
              <p className="text-3xl font-semibold text-slate-900">{attendanceRate}%</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">{attendance.length} recorded {attendance.length === 1 ? 'day' : 'days'} across your recent attendance history.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Faculty type</p>
              <p className="text-xl font-semibold text-slate-900">{facultyType}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">This summary keeps the page focused on the essentials without distracting sections.</p>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[var(--brand-dark)]" />
          <h2 className="text-lg font-semibold text-slate-900">Your attendance trend</h2>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-600">Loading attendance rate…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-red-700">{error}</p>
        ) : chartPoints.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-600">No attendance records yet.</p>
        ) : (
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Faculty attendance rate chart" className="mt-4 h-[230px] w-full overflow-visible">
            {[0, 50, 100].map((rate) => {
              const y = chartPadding.top + plotHeight - (rate / 100) * plotHeight;
              return <g key={rate}><line x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y} stroke="#E2E8F0" /><text x={chartPadding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748B">{rate}%</text></g>;
            })}
            <path d={linePath} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {pointCoordinates.map((point) => <g key={`${point.label}-${point.x}`}><circle cx={point.x} cy={point.y} r="4" fill="var(--brand)" /><text x={point.x} y={chartHeight - 12} textAnchor="middle" fontSize="10" fill="#64748B">{point.label}</text></g>)}
          </svg>
        )}
      </section>
    </div>
  );
};
