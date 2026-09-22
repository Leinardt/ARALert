import React, { useEffect, useMemo, useState } from 'react';
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

  const attendanceColor = attendanceRate >= 81
    ? 'text-risk-low'
    : attendanceRate >= 75
      ? 'text-risk-medium'
      : 'text-risk-high';

  return (
    <div className="space-y-3">

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Primary: Attendance Rate — number-first, no icon container */}
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c111c] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Attendance Rate
          </p>
          <p className={`text-4xl font-extrabold tracking-tight mt-1 ${attendanceColor}`}>
            {attendanceRate}%
          </p>
          {/* Thin progress bar */}
          <div className="mt-3 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${attendanceRate >= 81 ? 'bg-emerald-500' : attendanceRate >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {attendance.length} recorded {attendance.length === 1 ? 'day' : 'days'} in attendance history.
          </p>
        </section>

        {/* Secondary: Faculty Type — clean label + value */}
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c111c] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Faculty Type
          </p>
          <p className="text-xl font-bold mt-1 text-slate-900 dark:text-white">
            {facultyType}
          </p>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Your assigned role within the ARAL Program faculty.
          </p>
        </section>
      </div>

      {/* Chart Section */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c111c] p-4 sm:p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Attendance Trend
          </h2>
          {attendance.length > 0 && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Last {Math.min(attendance.length, 8)} records
            </span>
          )}
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading attendance rate…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : chartPoints.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No attendance records yet.</p>
        ) : (
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Faculty attendance rate chart" className="mt-4 h-[210px] w-full overflow-visible">
            {[0, 50, 100].map((rate) => {
              const y = chartPadding.top + plotHeight - (rate / 100) * plotHeight;
              return <g key={rate}><line x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y} stroke="var(--slate-200, #E2E8F0)" strokeDasharray="3 3" opacity="0.7" /><text x={chartPadding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94A3B8">{rate}%</text></g>;
            })}
            <path d={linePath} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {pointCoordinates.map((point) => <g key={`${point.label}-${point.x}`}><circle cx={point.x} cy={point.y} r="3.5" fill="var(--brand)" stroke="#B6D4F8" strokeWidth="1.5" /><text x={point.x} y={chartHeight - 12} textAnchor="middle" fontSize="10" fill="#94A3B8">{point.label}</text></g>)}
          </svg>
        )}
      </section>
    </div>
  );
};
