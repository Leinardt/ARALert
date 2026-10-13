import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';
import {
  AlertCircle,
  BarChart2,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';
import dtrLogIcon from '../../assets/icons/dtrlog_light_active.png';

// ─── Types ──────────────────────────────────────────────────────────────────────
type TrendFilter = 'day' | 'week' | 'month';

interface FacultyChartPoint {
  label: string;
  fullDateLabel: string;
  dateRange: string;
  value: number;
  presentCount: number;
  totalCount: number;
}

// ─── Interactive Faculty Attendance Chart ──────────────────────────────────────
const InteractiveFacultyChart: React.FC<{
  data: FacultyChartPoint[];
  trendFilter: TrendFilter;
}> = ({ data, trendFilter }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 260 });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateSize();

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
  const isMobile = width < 520;
  const isSmallMobile = width < 380;
  const paddingLeft = isMobile ? 44 : 50;
  const paddingRight = isMobile ? 20 : 14;
  const paddingTop = isMobile ? 18 : 20;
  const paddingBottom = isMobile ? 26 : 24;

  const chartW = Math.max(10, width - paddingLeft - paddingRight);
  const chartH = Math.max(10, height - paddingTop - paddingBottom);

  const points = useMemo(() => {
    return data.map((d, idx) => {
      const x = paddingLeft + (data.length === 1 ? chartW / 2 : (idx * chartW) / (data.length - 1 || 1));
      const y = paddingTop + chartH - (d.value / 100) * chartH;
      return { x, y, ...d };
    });
  }, [data, paddingLeft, paddingTop, chartW, chartH]);

  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cp1x = p0.x + (p1.x - p0.x) / 3;
      const cp1y = p0.y;
      const cp2x = p1.x - (p1.x - p0.x) / 3;
      const cp2y = p1.y;
      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
  }

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartH} L ${points[0].x} ${paddingTop + chartH} Z`
    : '';

  // Density filter for x-axis ticks
  const visibleIndices = useMemo(() => {
    const total = data.length;
    if (total <= 1) return new Set([0]);
    if (!isMobile) {
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    const step = isSmallMobile ? 3 : 2;
    const indices: number[] = [];
    for (let i = 0; i < total; i += step) {
      indices.push(i);
    }
    const lastIdx = total - 1;
    const prevIdx = indices[indices.length - 1];
    if (lastIdx - prevIdx >= 2) {
      indices.push(lastIdx);
    } else if (indices.length > 1) {
      indices[indices.length - 1] = lastIdx;
    }
    return new Set(indices);
  }, [data, isMobile, isSmallMobile]);

  return (
    <div ref={containerRef} className="relative w-full h-full select-none min-w-0 overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full block"
        role="img"
        aria-label="Faculty Attendance Rate Trend Chart"
      >
        <defs>
          <linearGradient id="facultyChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
          <filter id="facultyChartGlow" x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Standard Y-Axis Grid Lines: 0%, 25%, 50%, 75%, 100% */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = paddingTop + chartH - (val / 100) * chartH;
          return (
            <g key={val}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--slate-200)"
                strokeWidth="0.5"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                className="fill-slate-400 font-semibold text-[9px] xs:text-[10px]"
                textAnchor="end"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* X-axis date labels */}
        {points.map((p, idx) => {
          if (!visibleIndices.has(idx)) return null;

          let textAnchor: 'start' | 'middle' | 'end' = 'middle';
          let labelX = p.x;
          if (idx === 0) {
            textAnchor = 'start';
            labelX = Math.max(paddingLeft, p.x - 3);
          } else if (idx === points.length - 1) {
            textAnchor = 'end';
            labelX = Math.min(width - paddingRight, p.x + 3);
          }

          return (
            <text
              key={`label-${idx}`}
              x={labelX}
              y={height - (isMobile ? 6 : 5)}
              className="fill-slate-500 dark:fill-slate-400 font-semibold text-[9px] xs:text-[10px]"
              textAnchor={textAnchor}
              style={{ whiteSpace: 'nowrap' }}
            >
              {p.label}
            </text>
          );
        })}

        {/* Royal Blue Trend Line & Gradient Area (#0052B7) */}
        {points.length > 0 && (
          <>
            <path d={areaD} fill="url(#facultyChartFill)" />
            <path
              d={pathD}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.28"
              filter="url(#facultyChartGlow)"
            />
            <path
              d={pathD}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Data point markers */}
        {points.map((p, idx) => (
          <circle
            key={`data-dot-${idx}`}
            cx={p.x}
            cy={p.y}
            r="3.5"
            fill="var(--brand)"
            stroke="#B6D4F8"
            strokeWidth="1.5"
          />
        ))}

        {/* Vertical line and dot on hover */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line
              x1={points[hoveredIdx].x}
              y1={paddingTop}
              x2={points[hoveredIdx].x}
              y2={paddingTop + chartH}
              stroke="var(--brand)"
              strokeWidth="1.5"
              opacity="0.7"
            />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="4.5" fill="var(--brand)" />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="8" fill="var(--brand)" opacity="0.25" />
          </g>
        )}

        {/* Hover hit test regions */}
        {points.map((p, idx) => {
          const barW = chartW / (data.length - 1 || 1);
          const xStart = idx === 0 ? paddingLeft : p.x - barW / 2;
          const xEnd = idx === data.length - 1 ? width - paddingRight : p.x + barW / 2;
          return (
            <rect
              key={idx}
              x={xStart}
              y={paddingTop}
              width={Math.max(12, xEnd - xStart)}
              height={chartH}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onTouchStart={() => setHoveredIdx(idx)}
              onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
            />
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (() => {
        const p = points[hoveredIdx];
        const isRightHalf = p.x > width * 0.5;
        const maxTooltipWidth = Math.min(230, Math.max(160, width - 24));

        let tooltipStyle: React.CSSProperties;

        if (isMobile) {
          const leftPos = Math.max(10, Math.min(width - maxTooltipWidth - 10, p.x - maxTooltipWidth / 2));
          tooltipStyle = {
            left: `${leftPos}px`,
            top: '8px',
            maxWidth: `${maxTooltipWidth}px`,
          };
        } else if (isRightHalf) {
          tooltipStyle = {
            right: `${Math.max(10, width - p.x + 12)}px`,
            top: '50%',
            transform: 'translateY(-50%)',
            maxWidth: `${maxTooltipWidth}px`,
          };
        } else {
          tooltipStyle = {
            left: `${Math.max(10, p.x + 12)}px`,
            top: '50%',
            transform: 'translateY(-50%)',
            maxWidth: `${maxTooltipWidth}px`,
          };
        }

        return (
          <div
            className="pointer-events-none absolute z-20 w-max rounded-xl border border-slate-200 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-900/95 p-3 text-left text-[11px] font-medium leading-normal text-slate-800 dark:text-white shadow-xl dark:shadow-2xl shadow-slate-900/10 dark:shadow-black/60 backdrop-blur-md transition-all duration-150 overflow-hidden"
            style={tooltipStyle}
          >
            <div className="font-extrabold text-[11px] text-[#0052B7] dark:text-[#60A5FA] break-words">
              {p.fullDateLabel || p.label}
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span
                className="text-sm font-extrabold"
                style={{
                  color: p.value >= 80 ? '#22C55E' : p.value >= 75 ? '#F59E0B' : '#EF4444',
                }}
              >
                {p.value}%
              </span>
              <span className="text-[9px] text-slate-500 dark:text-zinc-400">Attendance Rate</span>
            </div>
            <div className="text-[9px] text-slate-500 dark:text-zinc-400 mt-1.5 border-t border-slate-100 dark:border-zinc-800 pt-1 space-y-0.5">
              <div>
                {p.totalCount > 0
                  ? `${p.presentCount} of ${p.totalCount} session${p.totalCount === 1 ? '' : 's'} present`
                  : 'No sessions scheduled'}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── Main FacultyHome Page ─────────────────────────────────────────────────────
export const FacultyHome: React.FC = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('week');

  const loadAttendance = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const history = await academicService.getAttendanceHistory({ user_id: user.id });
      setAttendance(Array.isArray(history) ? history : []);
    } catch (err: any) {
      console.error('Failed to load faculty attendance history', err);
      setError(err?.response?.data?.detail || 'Unable to load attendance data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [user?.id]);

  // Total Present & Absent calculations
  const totalSessions = attendance.length;
  const presentCount = useMemo(() => {
    return attendance.filter((a) => a.status.toLowerCase() === 'present' || a.status.toLowerCase() === 'late').length;
  }, [attendance]);

  const avgAttendance = useMemo(() => {
    if (totalSessions === 0) return 0;
    return Math.round((presentCount / totalSessions) * 100);
  }, [totalSessions, presentCount]);

  // Today's DTR status based on faculty schedule:
  // Morning: Time in 8:00, Time out 11:30
  // Afternoon: Time in 1:00 (13:00), Time out 4:30 (16:30)
  const todayStatus = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const todayLog = attendance.find((a) => a.date === todayStr);

    if (todayLog) {
      const st = todayLog.status.toLowerCase();
      if (st === 'present' || st === 'late') {
        return { isPresent: true, isAbsent: false, log: todayLog };
      }
      if (st === 'absent') {
        return { isPresent: false, isAbsent: true, log: todayLog };
      }
    }

    // If no log yet, check if afternoon DTR window (16:30 / 4:30 PM) has completed on a weekday
    const dayOfWeek = now.getDay();
    const isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6;
    const currentHours = now.getHours() + now.getMinutes() / 60;

    if (isWeekday && currentHours >= 16.5) {
      return { isPresent: false, isAbsent: true, log: null };
    }

    return { isPresent: false, isAbsent: false, log: null };
  }, [attendance]);

  // Grouped Chart Data by Day, Week, Month
  const trendChartData = useMemo<FacultyChartPoint[]>(() => {
    if (attendance.length === 0) return [];

    const sorted = [...attendance].sort((a, b) => a.date.localeCompare(b.date));

    if (trendFilter === 'day') {
      // Last 10 school weekdays
      const recentDates = getRecentSchoolWeekdays(10);
      return recentDates.map((dObj) => {
        const year = dObj.getFullYear();
        const month = String(dObj.getMonth() + 1).padStart(2, '0');
        const day = String(dObj.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const logs = sorted.filter((a) => a.date === dateStr);
        const present = logs.filter((a) => a.status.toLowerCase() === 'present' || a.status.toLowerCase() === 'late').length;
        const total = logs.length;
        const rate = total > 0 ? Math.round((present / total) * 100) : (avgAttendance || 100);

        const label = dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const fullDateLabel = dObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

        return {
          label,
          fullDateLabel,
          dateRange: dateStr,
          value: rate,
          presentCount: present,
          totalCount: total,
        };
      });
    }

    if (trendFilter === 'week') {
      // Group last 6 distinct 7-day windows
      const numWeeks = 6;
      const points: FacultyChartPoint[] = [];
      const now = new Date();

      for (let i = numWeeks - 1; i >= 0; i--) {
        const start = new Date(now);
        start.setDate(now.getDate() - (i * 7 + 6));
        const end = new Date(now);
        end.setDate(now.getDate() - (i * 7));

        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);

        const logs = sorted.filter((a) => a.date >= startStr && a.date <= endStr);
        const present = logs.filter((a) => a.status.toLowerCase() === 'present' || a.status.toLowerCase() === 'late').length;
        const total = logs.length;
        const rate = total > 0 ? Math.round((present / total) * 100) : avgAttendance;

        const label = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

        points.push({
          label: `W${numWeeks - i} (${start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })})`,
          fullDateLabel: label,
          dateRange: `${startStr} to ${endStr}`,
          value: rate,
          presentCount: present,
          totalCount: total,
        });
      }
      return points;
    }

    // Month mode: last 6 months
    const numMonths = 6;
    const points: FacultyChartPoint[] = [];
    const now = new Date();

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const logs = sorted.filter((a) => a.date.startsWith(yearMonth));
      const present = logs.filter((a) => a.status.toLowerCase() === 'present' || a.status.toLowerCase() === 'late').length;
      const total = logs.length;
      const rate = total > 0 ? Math.round((present / total) * 100) : avgAttendance;

      points.push({
        label: d.toLocaleDateString(undefined, { month: 'short' }),
        fullDateLabel: monthStr,
        dateRange: yearMonth,
        value: rate,
        presentCount: present,
        totalCount: total,
      });
    }
    return points;
  }, [attendance, trendFilter, avgAttendance]);

  // Highest / Lowest / Trend stats
  const highestRate = useMemo(() => {
    if (trendChartData.length === 0) return avgAttendance;
    return Math.max(...trendChartData.map((d) => d.value));
  }, [trendChartData, avgAttendance]);

  const lowestRate = useMemo(() => {
    if (trendChartData.length === 0) return avgAttendance;
    return Math.min(...trendChartData.map((d) => d.value));
  }, [trendChartData, avgAttendance]);

  const trendDir = useMemo(() => {
    if (trendChartData.length < 2) return 'stable';
    const first = trendChartData[0].value;
    const last = trendChartData[trendChartData.length - 1].value;
    return last > first ? 'up' : last < first ? 'down' : 'stable';
  }, [trendChartData]);

  // Recent 10 Logs
  const recentLogs = useMemo(() => {
    return [...attendance]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  }, [attendance]);

  // ─── Loading Skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:h-[calc(100vh-8.5rem)] lg:min-h-[32rem] data-loaded-content w-full min-w-0 max-w-full">
        <div className="lg:col-span-3 flex flex-col gap-3 h-full min-h-0 w-full min-w-0 max-w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 h-[116px] sm:h-[120px] animate-pulse">
                <div className="h-3 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-7 w-20 bg-gray-200 dark:bg-gray-800 rounded mt-3" />
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 flex-1 animate-pulse">
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
            <div className="h-48 bg-gray-100 dark:bg-[#111111] rounded-lg" />
          </div>
        </div>
        <div className="lg:col-span-1 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 animate-pulse">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-[#111111] rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-md p-4">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load dashboard</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={loadAttendance}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-md text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:h-[calc(100vh-8.5rem)] lg:min-h-[32rem] data-loaded-content w-full min-w-0 max-w-full">
      {/* ── Left 3-Column Section: Top Summary Cards + Chart Below ──── */}
      <div className="lg:col-span-3 flex flex-col gap-3 h-full min-h-0 w-full min-w-0 max-w-full">
        {/* Row 1: Solo Average Attendance Rate Container + Two-Layer Present/Absent Container */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0 w-full min-w-0 max-w-full">
          {/* 1. Solo Container: Average Attendance Rate */}
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-3 sm:p-3.5 transition-colors flex flex-col justify-between h-[116px] sm:h-[120px] w-full min-w-0 shadow-2xs">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">
                AVERAGE ATTENDANCE RATE
              </p>
              <p
                className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold mt-0.5 sm:mt-1 tracking-tight ${
                  totalSessions === 0
                    ? 'text-gray-400 dark:text-slate-500'
                    : avgAttendance >= 80
                      ? 'text-risk-low'
                      : avgAttendance >= 75
                        ? 'text-risk-medium'
                        : 'text-risk-high'
                }`}
              >
                {totalSessions === 0 ? '—' : `${avgAttendance}%`}
              </p>
            </div>
            <p className="text-[11px] font-normal text-gray-400 dark:text-slate-500">
              {totalSessions === 0
                ? 'No attendance records logged'
                : `${presentCount} of ${totalSessions} sessions attended`}
            </p>
          </div>

          {/* 2. Two-Layer Container: Present & Absent Status for Today */}
          <div className="flex flex-col gap-1.5 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-2.5 h-[116px] sm:h-[120px] w-full min-w-0 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 px-1 shrink-0">
              ATTENDANCE STATUS FOR TODAY
            </p>

            {/* Top Layer: PRESENT */}
            <div
              className={`flex-1 flex items-center gap-3.5 px-3 rounded-md border bg-white dark:bg-[#0A0A0A] transition-colors min-w-0 ${
                todayStatus.isPresent
                  ? 'border-emerald-500 dark:border-emerald-500'
                  : 'border-gray-200 dark:border-[#1A1A1A]'
              }`}
            >
              <Check
                className={`w-6 h-6 shrink-0 ${
                  todayStatus.isPresent
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-300 dark:text-gray-700'
                }`}
                strokeWidth={3}
              />
              <p
                className={`text-[10px] font-bold uppercase tracking-wider truncate ${
                  todayStatus.isPresent
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-400 dark:text-slate-500'
                }`}
              >
                PRESENT
              </p>
            </div>

            {/* Bottom Layer: ABSENT */}
            <div
              className={`flex-1 flex items-center gap-3.5 px-3 rounded-md border bg-white dark:bg-[#0A0A0A] transition-colors min-w-0 ${
                todayStatus.isAbsent
                  ? 'border-rose-500 dark:border-rose-500'
                  : 'border-gray-200 dark:border-[#1A1A1A]'
              }`}
            >
              <X
                className={`w-6 h-6 shrink-0 ${
                  todayStatus.isAbsent
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-gray-300 dark:text-gray-700'
                }`}
                strokeWidth={3}
              />
              <p
                className={`text-[10px] font-bold uppercase tracking-wider truncate ${
                  todayStatus.isAbsent
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-gray-400 dark:text-slate-500'
                }`}
              >
                ABSENT
              </p>
            </div>
          </div>
        </div>

        {/* Row 2: Attendance Rate Trend Chart */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md px-3.5 py-3.5 sm:px-5 flex flex-col flex-1 min-h-0 w-full min-w-0 max-w-full shadow-2xs">
          <div className="flex items-center justify-between gap-2 shrink-0 pb-2.5 sm:pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight truncate">
                Faculty Attendance Performance Trend
              </h3>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
              <div className="hidden xs:flex items-center gap-2 sm:gap-3 shrink-0 whitespace-nowrap">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-[var(--brand)] inline-block shrink-0" />
                  <span>Attendance rate</span>
                </div>
              </div>
              <div className="flex bg-gray-100 dark:bg-[#111111] rounded-md p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
                {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTrendFilter(filter)}
                    className={`rounded-sm px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                      trendFilter === filter
                        ? 'bg-[var(--brand)] text-white shadow-xs'
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 gap-3 mt-3 sm:mt-4">
            <div className="relative flex-1 min-h-[180px] xs:min-h-[200px] sm:min-h-[220px] w-full min-w-0 max-w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-lg px-2 py-2 sm:px-5 sm:py-2.5 overflow-hidden">
              {trendChartData.length > 0 ? (
                <InteractiveFacultyChart data={trendChartData} trendFilter={trendFilter} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
                  <BarChart2 className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                    No attendance records logged
                  </p>
                  <p className="text-[11px] text-gray-300 dark:text-slate-600">
                    Your attendance graph will populate automatically after your daily DTR sessions are scanned
                  </p>
                </div>
              )}
            </div>

            {/* Bottom 4 Summary Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0 pt-1">
              {[
                {
                  label: 'Current Rate',
                  value: totalSessions === 0 ? '—' : `${avgAttendance}%`,
                  color:
                    totalSessions === 0
                      ? 'text-gray-400 dark:text-slate-500'
                      : avgAttendance >= 80
                        ? 'text-risk-low'
                        : avgAttendance >= 75
                          ? 'text-risk-medium'
                          : 'text-risk-high',
                },
                {
                  label: 'Highest Point',
                  value: trendChartData.length === 0 ? '—' : `${highestRate}%`,
                  color:
                    trendChartData.length === 0
                      ? 'text-gray-400 dark:text-slate-500'
                      : highestRate >= 80
                        ? 'text-risk-low'
                        : highestRate >= 75
                          ? 'text-risk-medium'
                          : 'text-risk-high',
                },
                {
                  label: 'Lowest Point',
                  value: trendChartData.length === 0 ? '—' : `${lowestRate}%`,
                  color:
                    trendChartData.length === 0
                      ? 'text-gray-400 dark:text-slate-500'
                      : lowestRate >= 80
                        ? 'text-risk-low'
                        : lowestRate >= 75
                          ? 'text-risk-medium'
                          : 'text-risk-high',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-gray-50/80 dark:bg-[#111111] p-2.5 rounded-lg border border-gray-100 dark:border-[#1A1A1A] text-center flex flex-col justify-center"
                >
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <p className={`text-base sm:text-lg font-extrabold mt-0.5 ${stat.color}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
              <div className="bg-gray-50/80 dark:bg-[#111111] p-2.5 rounded-lg border border-gray-100 dark:border-[#1A1A1A] text-center flex flex-col justify-center">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                  Trend
                </p>
                <div className="mt-0.5">
                  {trendChartData.length === 0 ? (
                    <span className="text-base sm:text-lg font-extrabold text-gray-400 dark:text-slate-500">
                      —
                    </span>
                  ) : (
                    <span
                      className={`text-base sm:text-lg font-extrabold capitalize ${
                        trendDir === 'up'
                          ? 'text-risk-low'
                          : trendDir === 'down'
                            ? 'text-risk-high'
                            : 'text-gray-900 dark:text-slate-100'
                      }`}
                    >
                      {trendDir === 'up' ? 'Upward' : trendDir === 'down' ? 'Declining' : 'Stable'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right 1-Column Section: Recent DTR Logs ──── */}
      <div className="lg:col-span-1 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md flex flex-col h-full min-h-0 overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between shrink-0">
          <h4 className="text-xs font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wide">
            Recent DTR Logs
          </h4>
        </div>

        <div className="p-2 space-y-1.5 flex-1 min-h-0 overflow-y-auto">
          {recentLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center text-xs text-gray-400 dark:text-slate-500">
              <Clock className="w-8 h-8 text-gray-200 dark:text-zinc-800 mb-2" />
              <p className="font-semibold text-gray-600 dark:text-slate-400">No recent logs</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                Scan your daily DTR to record attendance.
              </p>
            </div>
          ) : (
            recentLogs.map((log) => {
              const isPresent = log.status.toLowerCase() === 'present';
              const isLate = log.status.toLowerCase() === 'late';
              const formattedDate = new Date(`${log.date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={log.id}
                  className="p-2.5 rounded-md border border-gray-100 dark:border-[#1A1A1A] bg-gray-50/50 dark:bg-[#111111] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-slate-100 truncate">
                      {formattedDate}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">
                      {log.time_in ? (
                        <>
                          In: <span className="font-mono text-gray-600 dark:text-slate-300">{log.time_in}</span>
                          {log.time_out && (
                            <> • Out: <span className="font-mono text-gray-600 dark:text-slate-300">{log.time_out}</span></>
                          )}
                        </>
                      ) : (
                        log.aral_activity_title || 'Institutional instructional session'
                      )}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      isPresent
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                        : isLate
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Panel Footer Button with DTR Log Icon */}
        <div className="p-2.5 border-t border-gray-100 dark:border-[#1A1A1A] bg-gray-50/50 dark:bg-[#0D0D0D] shrink-0">
          <Link
            to="/staff/scan"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <img src={dtrLogIcon} alt="DTR Log" className="w-4 h-4 object-contain brightness-0 invert shrink-0" />
            Scan DTR Attendance QR
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FacultyHome;
