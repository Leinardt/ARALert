import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, QrCode, User, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';
import { StatsGridSkeleton, CardSkeleton } from '../../components/SkeletonLoader';

const formatDate = (date: string) => {
  const parsedDate = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsedDate.getTime())
    ? date
    : parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatFullDate = (date: string) => {
  const parsedDate = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsedDate.getTime())
    ? date
    : parsedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

// ─── Responsive Faculty Attendance Chart Component ─────────────────────────────
interface FacultyChartProps {
  data: { label: string; fullDate: string; rate: number }[];
}

const FacultyAttendanceChart: React.FC<FacultyChartProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 240,
  });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.round(width),
            height: Math.round(height),
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;
  const isMobile = width < 480;
  const paddingLeft = isMobile ? 32 : 36;
  const paddingRight = isMobile ? 18 : 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartW = Math.max(10, width - paddingLeft - paddingRight);
  const chartH = Math.max(10, height - paddingTop - paddingBottom);

  const points = useMemo(() => {
    return data.map((d, idx) => {
      const x = paddingLeft + (data.length === 1 ? chartW / 2 : (idx * chartW) / (data.length - 1 || 1));
      const y = paddingTop + chartH - (d.rate / 100) * chartH;
      return { ...d, x, y };
    });
  }, [data, paddingLeft, paddingTop, chartW, chartH]);

  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cpx = (p0.x + p1.x) / 2;
      pathD += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
  }

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartH} L ${points[0].x} ${paddingTop + chartH} Z`
    : '';

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Attendance Records</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          Attendance history will appear here once verified sessions are logged.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-[220px] sm:h-[250px]">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-label="Faculty attendance performance trend"
      >
        <defs>
          <linearGradient id="facultyChartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid reference lines */}
        {[0, 50, 80, 100].map((val) => {
          const y = paddingTop + chartH - (val / 100) * chartH;
          const isTarget = val === 80;
          return (
            <g key={val}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="currentColor"
                className={isTarget ? 'text-emerald-500/40 dark:text-emerald-500/40' : 'text-slate-200 dark:text-neutral-800'}
                strokeDasharray={isTarget ? '4 3' : '3 3'}
                strokeWidth={isTarget ? 1.2 : 1}
              />
              <text
                x={paddingLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                className={`text-[10px] font-semibold ${isTarget ? 'fill-emerald-600 dark:fill-emerald-400' : 'fill-slate-400 dark:fill-slate-500'}`}
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        {areaD && <path d={areaD} fill="url(#facultyChartGradient)" />}

        {/* Line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Points & Labels */}
        {points.map((p, idx) => {
          const isHovered = hoveredIdx === idx;
          const showLabel = points.length <= 6 || idx % 2 === 0 || idx === points.length - 1;

          return (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : 4}
                className="fill-[#3b82f6] stroke-white dark:stroke-[#000000] transition-all"
                strokeWidth={2}
              />
              {showLabel && (
                <text
                  x={p.x}
                  y={height - 10}
                  textAnchor="middle"
                  className="text-[10px] font-medium fill-slate-500 dark:fill-slate-400"
                >
                  {p.label}
                </text>
              )}
              {/* Hit area */}
              <circle
                cx={p.x}
                cy={p.y}
                r={22}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  setHoveredIdx(idx);
                }}
                onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
              />
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (() => {
        const pt = points[hoveredIdx];
        const isRightHalf = pt.x > width * 0.55;
        return (
          <div
            className="pointer-events-none absolute z-10 w-44 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-[#000000]/95 p-3 text-left shadow-xl backdrop-blur-md transition-all text-slate-800 dark:text-white"
            style={{
              left: isRightHalf ? `${Math.max(10, pt.x - 185)}px` : `${Math.min(width - 190, pt.x + 15)}px`,
              top: `${Math.max(10, Math.min(height - 75, pt.y - 30))}px`,
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              {pt.fullDate}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-base font-extrabold ${pt.rate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : pt.rate >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {pt.rate}%
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Cumulative Rate</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── Main FacultyHome Component ────────────────────────────────────────────────
export const FacultyHome: React.FC = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAttendance = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
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

  useEffect(() => {
    loadAttendance();
  }, [user?.id]);

  const attendanceRate = useMemo(() => {
    if (!attendance.length) return 0;
    const presentCount = attendance.filter((entry) => entry.status.toLowerCase() === 'present').length;
    return Math.round((presentCount / attendance.length) * 100);
  }, [attendance]);

  const presentCount = useMemo(() => {
    return attendance.filter((entry) => entry.status.toLowerCase() === 'present').length;
  }, [attendance]);

  const sortedChronological = useMemo(() => {
    return [...attendance].sort((a, b) => a.date.localeCompare(b.date));
  }, [attendance]);

  const chartData = useMemo(() => {
    const records = sortedChronological.slice(-8);
    let cumulativePresent = 0;
    return records.map((entry, index) => {
      if (entry.status.toLowerCase() === 'present') cumulativePresent += 1;
      return {
        label: formatDate(entry.date),
        fullDate: formatFullDate(entry.date),
        rate: Math.round((cumulativePresent / (index + 1)) * 100),
      };
    });
  }, [sortedChronological]);

  const recentRecords = useMemo(() => {
    return [...attendance]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }, [attendance]);

  const highestRate = useMemo(() => {
    if (chartData.length === 0) return attendanceRate;
    return Math.max(...chartData.map((d) => d.rate));
  }, [chartData, attendanceRate]);

  const trendDir = useMemo(() => {
    if (chartData.length < 2) return 'stable';
    const first = chartData[0].rate;
    const last = chartData[chartData.length - 1].rate;
    return last > first ? 'up' : last < first ? 'down' : 'stable';
  }, [chartData]);

  const facultyType = user?.faculty_type?.trim() || 'Instructional Faculty';

  // Compliance status derivation
  const complianceStatus = useMemo(() => {
    if (attendance.length === 0) return { label: 'Pending Logs', color: 'text-slate-400 dark:text-slate-500', badge: 'border-slate-500/20 bg-slate-500/10 text-slate-400' };
    if (attendanceRate >= 80) return { label: 'Good Standing', color: 'text-emerald-600 dark:text-emerald-400', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
    if (attendanceRate >= 75) return { label: 'Satisfactory', color: 'text-amber-600 dark:text-amber-400', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' };
    return { label: 'Needs Review', color: 'text-rose-600 dark:text-rose-400', badge: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400' };
  }, [attendance.length, attendanceRate]);

  // ─── Loading Skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 data-loaded-content w-full min-w-0 max-w-full">
        <StatsGridSkeleton count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            <CardSkeleton rows={6} />
            <CardSkeleton rows={4} />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <CardSkeleton rows={4} />
            <CardSkeleton rows={3} />
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-5 sm:p-6 text-rose-800 dark:text-rose-200">
        <p className="text-sm font-bold text-rose-900 dark:text-rose-200">Failed to load faculty dashboard</p>
        <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">{error}</p>
        <button
          type="button"
          onClick={loadAttendance}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-rose-900/40 text-rose-700 dark:text-rose-200 text-xs font-semibold hover:bg-rose-100/60 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 data-loaded-content w-full min-w-0 max-w-full">
      {/* ── 1. Top Metrics KPI Strip (Standardized Super Admin 4-Card Grid) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Attendance Rate */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Attendance Rate
          </span>
          <div className={`text-3xl font-bold tracking-tight mt-2 ${attendance.length === 0 ? 'text-slate-900 dark:text-white' : attendanceRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : attendanceRate >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {attendance.length === 0 ? '—' : `${attendanceRate}%`}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
            {presentCount} of {attendance.length} sessions attended
          </p>
        </div>

        {/* Metric 2: Recorded Sessions */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Recorded Sessions
          </span>
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {attendance.length.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
            Verified logged days in attendance history
          </p>
        </div>

        {/* Metric 3: Faculty Designation */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Faculty Assignment
          </span>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2 truncate" title={facultyType}>
            {facultyType}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
            ARAL Program instructional specialization
          </p>
        </div>

        {/* Metric 4: Compliance Status */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Compliance Status
          </span>
          <div className={`text-2xl sm:text-3xl font-bold tracking-tight mt-2 ${complianceStatus.color}`}>
            {complianceStatus.label}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Based on 80% institutional threshold
          </p>
        </div>
      </div>

      {/* ── 2. Standardized 12-Column Layout (7-col Left, 5-col Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── LEFT COLUMN (7 cols) ── */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card 1: Attendance Trend */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Attendance Performance Trend
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cumulative session attendance compliance over time
                </p>
              </div>
              {attendance.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-400 self-start sm:self-auto">
                  Last {Math.min(attendance.length, 8)} records
                </span>
              )}
            </div>

            <div className="pt-4">
              <FacultyAttendanceChart data={chartData} />
            </div>

            {/* Trend Summary Strip */}
            {attendance.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-neutral-800 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Current Rate
                  </span>
                  <span className={`text-sm sm:text-base font-bold mt-0.5 block ${attendanceRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : attendanceRate >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {attendanceRate}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Highest Point
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {highestRate}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    Trend
                  </span>
                  <span className="text-sm sm:text-base font-bold mt-0.5 block capitalize text-slate-900 dark:text-white">
                    {trendDir === 'up' ? 'Upward' : trendDir === 'down' ? 'Declining' : 'Stable'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Recent Session Attendance Records */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Recent Session Logs
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Latest verified daily session attendance records
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {attendance.length} total logs
              </span>
            </div>

            {recentRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No session attendance records available yet.
              </div>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-neutral-800/80">
                {recentRecords.map((record) => {
                  const isPresent = record.status.toLowerCase() === 'present';
                  const isLate = record.status.toLowerCase() === 'late';
                  return (
                    <div key={record.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {formatFullDate(record.date)}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {record.time_in
                            ? `Time In: ${record.time_in}${record.time_out ? ` • Out: ${record.time_out}` : ''}`
                            : (record.aral_activity_title || 'Daily instructional session verified')}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide uppercase ${
                          isPresent
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : isLate
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {record.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN (5 cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card 1: Faculty Profile Overview */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Faculty Profile
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Institutional credentials & role
                </p>
              </div>
              <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-neutral-800/80">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Full Name</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'Faculty Member'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-neutral-800/80">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Email</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {user?.email || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-neutral-800/80">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Program Role</span>
                <span className="font-semibold text-slate-900 dark:text-white">Faculty Member</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-neutral-800/80">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Specialization</span>
                <span className="font-semibold text-slate-900 dark:text-white">{facultyType}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Department</span>
                <span className="font-semibold text-slate-900 dark:text-white">ARAL Program</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-neutral-800">
              <Link
                to="/profile"
                className="inline-flex items-center justify-center w-full gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-900 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                Manage Profile & Credentials <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Faculty Quick Operations */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-neutral-800">
              Faculty Operations
            </h2>

            <div className="mt-4 space-y-2.5">
              <Link
                to="/staff/scan"
                className="group flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 bg-white dark:bg-[#000000] hover:bg-slate-50 dark:hover:bg-neutral-900/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">DTR QR Scanner</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Scan QR to time in or time out</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>

              <Link
                to="/profile"
                className="group flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 bg-white dark:bg-[#000000] hover:bg-slate-50 dark:hover:bg-neutral-900/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">Account Settings</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Security & notification settings</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
            </div>
          </div>

          {/* Card 3: Institutional Compliance Standards */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-neutral-800">
              Institutional Benchmarks
            </h2>

            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-slate-900 dark:text-white">≥ 80% Attendance: Good Standing</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Target baseline for all faculty instructional sessions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-slate-900 dark:text-white">75% – 79%: Satisfactory</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Permissible threshold with advisory monitoring.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-slate-900 dark:text-white">&lt; 75%: Action Required</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Requires coordination with the school principal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
