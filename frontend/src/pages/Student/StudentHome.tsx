import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { buildPerformanceTrend, type PerformanceTrendPoint } from '../../utils/performanceTrendHelpers';
import type { StudentAcademicProfile, Attendance } from '../../types';
import {
  GraduationCap,
  Calendar,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Activity,
  X,
} from 'lucide-react';

/* ──────────────────────────────────────────────────
   Compact Sparkline Component
   ────────────────────────────────────────────────── */
const Sparkline: React.FC<{
  data: PerformanceTrendPoint[];
  width?: number;
  height?: number;
}> = ({ data, width = 280, height = 64 }) => {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.value), 100);
  const minVal = Math.min(...data.map((d) => d.value), 0);
  const range = maxVal - minVal || 1;
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: pad + i * step,
    y: pad + innerH - ((d.value - minVal) / range) * innerH,
  }));

  // Build smooth cubic bezier path
  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  // Fill area
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkFill)" />
      <path d={linePath} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Latest point dot */}
      {points.length > 0 && (
        <>
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill="var(--brand)" />
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="7" fill="var(--brand)" opacity="0.2" />
        </>
      )}
    </svg>
  );
};



/* ──────────────────────────────────────────────────
   ARAL Level Badge
   ────────────────────────────────────────────────── */
const ARAL_LEVELS = ['basic', 'plus', 'summer', 'graduated'] as const;
const ARAL_LABELS: Record<string, string> = {
  basic: 'Basic',
  plus: 'Plus',
  summer: 'Summer',
  graduated: 'Graduated',
};

const AralLevelProgress: React.FC<{ level: string | null | undefined }> = ({ level }) => {
  const currentIdx = ARAL_LEVELS.indexOf((level || 'basic') as any);
  const progress = currentIdx >= 0 ? ((currentIdx + 1) / ARAL_LEVELS.length) * 100 : 25;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>ARAL Level</span>
        <span className="text-sm font-extrabold" style={{ color: 'var(--brand)' }}>{ARAL_LABELS[level || 'basic'] || 'Basic'}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--slate-200)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--brand), var(--brand-hover))',
            transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
      <div className="flex justify-between">
        {ARAL_LEVELS.map((l, i) => (
          <span
            key={l}
            className="text-[9px] font-bold uppercase"
            style={{ color: i <= currentIdx ? 'var(--brand)' : 'var(--text-disabled)' }}
          >
            {ARAL_LABELS[l]}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export const StudentHome: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [performanceTrend, setPerformanceTrend] = useState<PerformanceTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);

  // ── Attendance filter state ───────────────────────────────────────
  // filterDate: null = show all; string (YYYY-MM-DD) = anchor date
  // filterScope: the range around the anchor date
  type FilterScope = 'day' | 'week' | 'month';
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterScope, setFilterScope] = useState<FilterScope>('day');

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
        setAttendanceLogs(logs);
      } catch (err: any) {
        console.error(err);
        setLogsError('Failed to load attendance history.');
      } finally {
        setLogsLoading(false);
      }
    };

    fetchAttendanceLogs();
  }, [user]);

  const formatDateString = (value: string | null | undefined): string => {
    if (!value) return '—';
    const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${weekday} | ${month} ${day}, ${year}`;
  };

  const formatTimeString = (value: string | null | undefined): string => {
    if (!value) return '—';

    // Handle standard "HH:MM:SS" or "HH:MM" time strings
    const timeParts = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeParts) {
      let hours = parseInt(timeParts[1], 10);
      const minutes = timeParts[2];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm}`;
    }

    // Handle full ISO / datetime strings
    const date = new Date(value.includes('T') || value.includes(' ') ? value : `1970-01-01T${value}`);
    if (!Number.isNaN(date.getTime())) {
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm}`;
    }

    return value;
  };

  // Trend direction computation
  const trendDirection = useMemo(() => {
    if (performanceTrend.length < 2) return 'neutral';
    const last = performanceTrend[performanceTrend.length - 1].value;
    const prev = performanceTrend[performanceTrend.length - 2].value;
    if (last > prev) return 'up';
    if (last < prev) return 'down';
    return 'neutral';
  }, [performanceTrend]);

  const latestTrendValue = performanceTrend.length > 0 ? performanceTrend[performanceTrend.length - 1].value : null;

  // ── Attendance filter helpers ─────────────────────────────────────
  const getWeekBounds = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
    return { from: fmt(mon), to: fmt(sun) };
  };

  const getMonthBounds = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { from, to };
  };

  const filteredLogs = useMemo(() => {
    if (!filterDate) return attendanceLogs;
    if (filterScope === 'day') return attendanceLogs.filter(l => l.date === filterDate);
    if (filterScope === 'week') {
      const { from, to } = getWeekBounds(filterDate);
      return attendanceLogs.filter(l => l.date >= from && l.date <= to);
    }
    if (filterScope === 'month') {
      const { from, to } = getMonthBounds(filterDate);
      return attendanceLogs.filter(l => l.date >= from && l.date <= to);
    }
    return attendanceLogs;
  }, [attendanceLogs, filterDate, filterScope]);

  const filterRangeLabel = () => {
    if (!filterDate) return null;
    const d = new Date(filterDate + 'T00:00:00');
    if (filterScope === 'day') return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (filterScope === 'week') {
      const { from, to } = getWeekBounds(filterDate);
      const f = new Date(from + 'T00:00:00');
      const t = new Date(to + 'T00:00:00');
      return `${f.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (filterScope === 'month') return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return null;
  };



  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)' }} className="rounded-xl p-4">
        {error || 'Profile could not be loaded.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div
        className="p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--slate-200)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Hello, {user?.first_name}!</h2>
          <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Your academic and attendance overview.
          </p>
        </div>
      </div>

      {/* ── Stat Cards Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Attendance Rate */}
        <div
          className="p-5 rounded-2xl flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md dark:hover:border-[var(--brand)] dark:hover:shadow-[0_4px_20px_-4px_var(--brand-glow)]"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Attendance Rate</p>
            <p className="mt-2 text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              {typeof attendanceRate === 'number' ? `${parseFloat(attendanceRate.toFixed(2)).toString()}%` : `${attendanceRate}%`}
            </p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' }}>
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Average Score */}
        <div
          className="p-5 rounded-2xl flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md dark:hover:border-[var(--brand)] dark:hover:shadow-[0_4px_20px_-4px_var(--brand-glow)]"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Average Score</p>
            <p className="mt-2 text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{averageScore > 0 ? `${parseFloat(averageScore.toFixed(2)).toString()}%` : 'N/A'}</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--brand-light)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}>
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        {/* Risk Level */}
        <div
          className="p-5 rounded-2xl flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          style={{
            background: riskLevelKey === 'high' ? 'var(--color-danger-bg)' : riskLevelKey === 'medium' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
            border: `1px solid ${riskLevelKey === 'high' ? 'var(--color-danger-border)' : riskLevelKey === 'medium' ? 'var(--color-warning-border)' : 'var(--color-success-border)'}`,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{
              color: riskLevelKey === 'high' ? 'var(--color-danger)' : riskLevelKey === 'medium' ? 'var(--color-warning)' : 'var(--color-success)'
            }}>Risk Level</p>
            <p className="mt-2 text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{riskLevel}</p>
          </div>
          <div className="p-3 rounded-xl" style={{
            background: riskLevelKey === 'high' ? 'var(--color-danger-bg)' : riskLevelKey === 'medium' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
            color: riskLevelKey === 'high' ? 'var(--color-danger)' : riskLevelKey === 'medium' ? 'var(--color-warning)' : 'var(--color-success)',
            border: `1px solid ${riskLevelKey === 'high' ? 'var(--color-danger-border)' : riskLevelKey === 'medium' ? 'var(--color-warning-border)' : 'var(--color-success-border)'}`,
          }}>
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── Performance Trend & ARAL Progress (Side by Side) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Performance Trend ── */}
        <div
          className="p-5 rounded-2xl space-y-3 flex flex-col justify-between"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Performance Trend</h3>
              </div>
              {latestTrendValue !== null && (
                <div className="flex items-center gap-1.5">
                  {trendDirection === 'up' ? (
                    <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                  ) : trendDirection === 'down' ? (
                    <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                  ) : (
                    <Activity className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  )}
                  <span className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{latestTrendValue}</span>
                  <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Latest</span>
                </div>
              )}
            </div>

            {performanceTrend.length === 0 ? (
              <div className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>No performance data yet.</div>
            ) : (
              <div className="flex flex-col gap-2 mt-3">
                <div className="w-full overflow-x-auto">
                  <Sparkline data={performanceTrend} width={Math.max(280, performanceTrend.length * 48)} height={72} />
                </div>
                {/* Date labels */}
                <div className="flex justify-between px-1">
                  {performanceTrend.length > 0 && (
                    <>
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{performanceTrend[0].label}</span>
                      {performanceTrend.length > 1 && (
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{performanceTrend[performanceTrend.length - 1].label}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {performanceTrend.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-semibold pt-2" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--slate-100)' }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--brand)' }} />
              Composite score (65% academic, 35% attendance)
            </div>
          )}
        </div>

        {/* ── ARAL Progress + Attendance Stats ── */}
        <div
          className="p-5 rounded-2xl space-y-4 flex flex-col justify-between"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}
        >
          <AralLevelProgress level={profile.student.aral_level} />

          {/* Attendance stats */}
          <div className="pt-3" style={{ borderTop: '1px solid var(--slate-200)' }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Attendance</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Present', value: profile.attendance.present, color: 'var(--color-success)' },
                { label: 'Late', value: profile.attendance.late, color: 'var(--color-warning)' },
                { label: 'Absent', value: profile.attendance.absent, color: 'var(--color-danger)' },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-2 rounded-lg" style={{ background: 'var(--surface-muted)' }}>
                  <p className="text-lg font-extrabold" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Attendance History Table ── */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--surface-card)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Attendance History</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Complete attendance log with date, time, and status.</p>
          </div>

          {/* ── Filter Controls ── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date picker */}
            <div className="relative flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                type="date"
                id="attendance-filter-date"
                value={filterDate ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterDate(val || null);
                  if (val) setFilterScope('day');
                }}
                className="text-xs font-semibold px-2 py-1.5 rounded-lg"
                style={{
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--slate-200)',
                  color: filterDate ? 'var(--text-primary)' : 'var(--text-muted)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
              {filterDate && (
                <button
                  id="attendance-filter-clear"
                  onClick={() => setFilterDate(null)}
                  className="p-1 rounded-full transition-colors"
                  style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)' }}
                  aria-label="Clear filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Scope pills — only visible once a date is picked */}
            {filterDate && (
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--slate-200)', background: 'var(--surface-muted)' }}>
                {(['day', 'week', 'month'] as const).map((scope) => (
                  <button
                    key={scope}
                    id={`attendance-scope-${scope}`}
                    onClick={() => setFilterScope(scope)}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all duration-150"
                    style={{
                      background: filterScope === scope ? 'var(--brand)' : 'transparent',
                      color: filterScope === scope ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            )}

            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)' }}>
              {filteredLogs.length} entr{filteredLogs.length === 1 ? 'y' : 'ies'}
            </span>
          </div>
        </div>

        {/* Active filter label */}
        {filterDate && filterRangeLabel() && (
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--brand)' }}>
            <Calendar className="w-3.5 h-3.5" />
            {filterRangeLabel()}
          </div>
        )}

        {logsLoading ? (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading history...</div>
        ) : logsError ? (
          <div className="text-sm" style={{ color: 'var(--color-danger)' }}>{logsError}</div>
        ) : attendanceLogs.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No attendance history found yet.</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            No attendance records found for this {filterScope}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y text-left text-sm" style={{ borderColor: 'var(--slate-200)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-muted)' }}>
                  <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Date</th>
                  <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Time In</th>
                  <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Time Out</th>
                  <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--slate-200)' }}>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="transition-colors" style={{ background: 'var(--surface-card)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-card)')}
                  >
                    <td className="px-3 py-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDateString(log.date)}</td>
                    <td className="px-3 py-2.5 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{formatTimeString(log.time_in)}</td>
                    <td className="px-3 py-2.5 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{formatTimeString(log.time_out)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{
                          background: log.status === 'present' ? 'var(--color-success-bg)' : log.status === 'late' ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)',
                          color: log.status === 'present' ? 'var(--color-success)' : log.status === 'late' ? 'var(--color-warning)' : 'var(--color-danger)',
                          border: `1px solid ${log.status === 'present' ? 'var(--color-success-border)' : log.status === 'late' ? 'var(--color-warning-border)' : 'var(--color-danger-border)'}`,
                        }}
                      >
                        {log.status_display}
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
  );
};
