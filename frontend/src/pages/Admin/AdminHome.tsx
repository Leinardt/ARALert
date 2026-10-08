import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { Attendance, Grade, User, UserStats } from '../../types';
import {
  BarChart2,
  AlertCircle,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { StatsGridSkeleton, CardSkeleton } from '../../components/SkeletonLoader';
import { computeStudentRiskRows } from '../../utils/analyticsHelpers';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';

// ─── Chart Types & Interactive Chart Component ─────────────────────────────────

interface AdminChartPoint {
  label: string;
  fullDateLabel?: string;
  dateRange: string;
  value: number;
  actualCount: number;
  attendanceCount?: number;
  assessmentLabels: string[];
}

const formatShortDateRange = (label: string): string => {
  const match = label.match(/^([A-Za-z]+)\s+(\d+)\s*[–—\-]\s*([A-Za-z]+)\s+(\d+)$/);
  if (match) {
    const [, m1, d1, m2, d2] = match;
    if (m1.toLowerCase() === m2.toLowerCase()) {
      return `${m1} ${d1}–${d2}`;
    }
    return `${m1} ${d1}–${m2} ${d2}`;
  }
  return label;
};

const InteractiveAdminPerformanceChart: React.FC<{ data: AdminChartPoint[]; trendFilter?: TrendFilter }> = ({ data, trendFilter = 'week' }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
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
  const paddingLeft = isMobile ? 32 : 28;
  const paddingRight = isMobile ? 20 : 14;
  const paddingTop = isMobile ? 18 : 20;
  const paddingBottom = isMobile ? 26 : 24;

  const chartW = Math.max(10, width - paddingLeft - paddingRight);
  const chartH = Math.max(10, height - paddingTop - paddingBottom);

  const points = data.map((d, idx) => {
    const x = paddingLeft + (idx * chartW) / (data.length - 1 || 1);
    const y = paddingTop + chartH - (d.value / 100) * chartH;
    return { x, y, ...d };
  });

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

  // Dynamic tick density to prevent all label overlap
  const visibleIndices = useMemo(() => {
    const total = data.length;
    if (total <= 1) return new Set([0]);
    if (!isMobile) {
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    if (trendFilter === 'month') {
      if (width < 380) {
        return new Set([0, 2, 4, total - 1]);
      }
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    if (trendFilter === 'week') {
      if (width < 430) {
        return new Set([0, 2, 4, total - 1]);
      }
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    // Day mode (10 school days)
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
    const set = new Set(indices);
    data.forEach((p, idx) => {
      if (p.assessmentLabels.length > 0 && !set.has(idx - 1) && !set.has(idx + 1)) {
        set.add(idx);
      }
    });
    return set;
  }, [data, isMobile, isSmallMobile, trendFilter, width]);

  const getFormattedLabel = (p: AdminChartPoint) => {
    if (!isMobile) return p.label;
    if (trendFilter === 'week') {
      return formatShortDateRange(p.label);
    }
    if (trendFilter === 'month') {
      if (width < 400) {
        return p.label.split(' ')[0] || p.label;
      }
      return p.label.replace(/\s+20(\d\d)/, " '$1");
    }
    return p.label;
  };

  return (
    <div ref={containerRef} className="relative w-full h-full select-none min-w-0 overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full block" role="img" aria-label="Performance Trend Chart">
        <defs>
          <linearGradient id="adminChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
          <filter id="adminChartGlow" x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

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
              <text x={paddingLeft - 6} y={y + 3} className="fill-slate-400 font-semibold text-[9px] xs:text-[10px]" textAnchor="end">
                {val}%
              </text>
            </g>
          );
        })}

        {/* Milestone guide lines */}
        {points.map((p, idx) => {
          if (p.assessmentLabels.length === 0) return null;
          return (
            <g key={`milestone-${idx}`}>
              <title>{p.assessmentLabels.join(', ')}</title>
              <line
                x1={p.x}
                y1={paddingTop}
                x2={p.x}
                y2={paddingTop + chartH}
                stroke="#38BDF8"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.35"
              />
            </g>
          );
        })}

        {/* X-axis date labels with collision and clipping prevention */}
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
              {getFormattedLabel(p)}
            </text>
          );
        })}

        {/* Brand Trend Line & Area */}
        {points.length > 0 && (
          <>
            <path d={areaD} fill="url(#adminChartFill)" />
            <path
              d={pathD}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.28"
              filter="url(#adminChartGlow)"
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

        {/* Milestone assessment dots */}
        {points.map((p, idx) =>
          p.assessmentLabels.length > 0 ? (
            <g key={`milestone-dot-${idx}`}>
              <circle cx={p.x} cy={p.y} r="8.5" fill="#38BDF8" opacity="0.45" filter="url(#adminChartGlow)" />
              <circle cx={p.x} cy={p.y} r="4.5" fill="#0284C7" stroke="#BAE6FD" strokeWidth="2" />
            </g>
          ) : null
        )}

        {/* Vertical line and dots on hover */}
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
              width={xEnd - xStart}
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

      {/* Floating Tooltip (Guaranteed zero-overflow) */}
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
            className="pointer-events-none absolute z-20 w-max rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-[#000000]/95 p-3 text-left text-[11px] font-medium leading-normal text-slate-800 dark:text-white shadow-xl dark:shadow-2xl shadow-slate-900/10 dark:shadow-black/60 backdrop-blur-md transition-all duration-150 overflow-hidden"
            style={tooltipStyle}
          >
            <div className="font-extrabold text-[11px] text-[#0052B7] dark:text-[#60A5FA] break-words">
              {p.fullDateLabel || p.label}
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span
                className="text-sm font-extrabold"
                style={{
                  color: p.value >= 81 ? '#22C55E' : p.value >= 75 ? '#F59E0B' : '#EF4444',
                }}
              >
                {p.value}%
              </span>
              <span className="text-[9px] text-slate-500 dark:text-zinc-400">Average Composite Rating</span>
            </div>
            {p.assessmentLabels.length > 0 && (
              <div className="mt-1.5 bg-sky-50 dark:bg-[#0284C7]/20 border border-sky-200 dark:border-[#0284C7]/40 text-sky-700 dark:text-[#38BDF8] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-sm dark:shadow-[0_0_8px_rgba(2,132,199,0.25)]">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-600 dark:bg-[#38BDF8] shadow-none dark:shadow-[0_0_6px_rgba(56,189,248,0.8)] inline-block" />
                <span className="uppercase tracking-wider">{p.assessmentLabels.join(', ')}</span>
              </div>
            )}
            <div className="text-[9px] text-slate-500 dark:text-zinc-400 mt-1 border-t border-slate-100 dark:border-zinc-800 pt-1 space-y-0.5">
              <div>
                {p.actualCount > 0
                  ? `${p.actualCount} ${p.actualCount === 1 ? 'assessment' : 'assessments'} logged`
                  : 'No assessments logged'}
              </div>
              <div>
                {(p.attendanceCount ?? 0) > 0
                  ? `${p.attendanceCount} attendance record${p.attendanceCount === 1 ? '' : 's'}`
                  : 'No attendance records'}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── Main AdminHome Component ──────────────────────────────────────────────────

type TrendFilter = 'day' | 'week' | 'month';

export const AdminHome: React.FC = () => {
  const { user } = useAuth();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [tutors, setTutors] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trendFilter, setTrendFilter] = useState<TrendFilter>('week');
  const [selectedTutorId, setSelectedTutorId] = useState<string>('all');

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [statsData, tutorsData, studentsData, gradesData, attendanceData] = await Promise.all([
          userService.getStats(),
          userService.getAllUsers({ role: 'tutor' }),
          userService.getAllUsers({ role: 'student' }),
          academicService.getGrades().catch((err) => {
            console.warn('Could not load grades for admin dashboard:', err);
            return [] as Grade[];
          }),
          academicService.getAttendanceHistory().catch(() => [] as Attendance[]),
        ]);

        setStats(statsData);
        setTutors(Array.isArray(tutorsData) ? tutorsData : []);
        setStudents(Array.isArray(studentsData) ? studentsData : []);
        setGrades(Array.isArray(gradesData) ? gradesData : []);
        setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      } catch (err: any) {
        console.error('AdminHome fetch error:', err);
        setError(err?.response?.data?.detail || 'Failed to load school administration dashboard.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  // Filter students based on selected tutor
  const filteredStudents = useMemo(() => {
    if (selectedTutorId === 'all') return students;
    return students.filter((s) => String(s.assigned_tutor) === String(selectedTutorId));
  }, [students, selectedTutorId]);

  const selectedTutorObj = useMemo(() => {
    if (selectedTutorId === 'all') return null;
    return tutors.find((t) => String(t.id) === String(selectedTutorId)) || null;
  }, [tutors, selectedTutorId]);

  const tutorFirstName = useMemo(() => {
    if (!selectedTutorObj) return null;
    return (
      selectedTutorObj.first_name ||
      selectedTutorObj.full_name?.trim().split(' ')[0] ||
      'TUTOR'
    ).toUpperCase();
  }, [selectedTutorObj]);

  // Compute performance trend combining composite scores
  const chartTrendData = useMemo(() => {
    if (filteredStudents.length === 0 || grades.length === 0) return [];
    const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
    const assessmentGrades = grades.filter((g) => studentIds.has(String(g.student)) && g.component_type === 'assessment');
    if (assessmentGrades.length === 0) return [];

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const formatMonth = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

    let periods: {
      label: string;
      fullDateLabel?: string;
      dateRange: string;
      start: Date;
      end: Date;
      scores: number[];
      attendanceCount: number;
      assessmentLabels: Set<string>;
    }[];

    if (trendFilter === 'day') {
      const schoolDays = getRecentSchoolWeekdays(10, now);
      periods = schoolDays.map((d) => {
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
        const weekdayName = start.toLocaleDateString('en-US', { weekday: 'long' });
        const monthFull = start.toLocaleDateString('en-US', { month: 'long' });
        const dayNum = start.getDate();
        const year = start.getFullYear();
        const label = formatDate(start);
        const fullDateLabel = `${monthFull} ${dayNum}, ${year} | ${weekdayName}`;
        return {
          label,
          fullDateLabel,
          dateRange: fullDateLabel,
          start,
          end,
          scores: [] as number[],
          attendanceCount: 0,
          assessmentLabels: new Set<string>(),
        };
      });
    } else {
      const periodCount = 6;
      periods = Array.from({ length: periodCount }).map((_, index) => {
        let start: Date, end: Date, label: string, fullDateLabel: string;
        if (trendFilter === 'month') {
          const offset = periodCount - 1 - index;
          start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
          end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
          label = formatMonth(start);
          const monthFull = start.toLocaleDateString('en-US', { month: 'long' });
          const year = start.getFullYear();
          fullDateLabel = `${monthFull} ${year}`;
        } else {
          // week (5 school weekdays: Mon–Fri)
          const offset = periodCount - 1 - index;
          const dayOfWeek = now.getDay();
          const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const currentWeekMon = new Date(startOfToday.getTime() + diffToMon * oneDay);
          start = new Date(currentWeekMon.getTime() - offset * 7 * oneDay);
          const fri = new Date(start.getTime() + 4 * oneDay);
          end = new Date(start.getTime() + 5 * oneDay);
          label = `${formatDate(start)} – ${formatDate(fri)}`;
          const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
          const friMonth = fri.toLocaleDateString('en-US', { month: 'long' });
          const startDay = start.getDate();
          const friDay = fri.getDate();
          const friYear = fri.getFullYear();
          const rangeText = startMonth === friMonth
            ? `${startMonth} ${startDay}–${friDay}, ${friYear}`
            : `${startMonth} ${startDay} – ${friMonth} ${friDay}, ${friYear}`;
          fullDateLabel = `${rangeText} | Monday – Friday`;
        }
        return {
          label,
          fullDateLabel,
          dateRange: fullDateLabel,
          start,
          end,
          scores: [] as number[],
          attendanceCount: 0,
          assessmentLabels: new Set<string>(),
        };
      });
    }

    assessmentGrades.forEach((g) => {
      const dateStr = g.date_logged ? g.date_logged.slice(0, 10) : '';
      if (!dateStr) return;
      const gDate = new Date(`${dateStr}T00:00:00`);
      if (isNaN(gDate.getTime())) return;
      for (const p of periods) {
        if (gDate >= p.start && gDate < p.end) {
          const scorePercent = g.total_score > 0 ? (g.score / g.total_score) * 100 : g.score;
          p.scores.push(scorePercent);
          const assessmentText = `${g.subject} ${g.remarks ?? ''}`.toUpperCase();
          if (assessmentText.includes('MOSY')) {
            p.assessmentLabels.add('MOSY');
          } else if (assessmentText.includes('EOSY')) {
            p.assessmentLabels.add('EOSY');
          } else if (assessmentText.includes('ARAL SUMMER') || assessmentText.includes('SUMMER') || assessmentText.includes('BOSY')) {
            p.assessmentLabels.add('ARAL Summer Assessment');
          }
          break;
        }
      }
    });

    attendance.forEach((att) => {
      if (!studentIds.has(String(att.user))) return;
      const dateStr = att.date ? att.date.slice(0, 10) : '';
      if (!dateStr) return;
      const attDate = new Date(`${dateStr}T00:00:00`);
      if (isNaN(attDate.getTime())) return;
      for (const p of periods) {
        if (attDate >= p.start && attDate < p.end) {
          p.attendanceCount += 1;
          break;
        }
      }
    });

    const points = periods.map((p) => ({
      label: p.label,
      fullDateLabel: p.fullDateLabel,
      dateRange: p.dateRange,
      value: p.scores.length > 0 ? Math.round(p.scores.reduce((a, b) => a + b, 0) / p.scores.length) : null,
      count: p.scores.length,
      attendanceCount: p.attendanceCount,
      assessmentLabels: Array.from(p.assessmentLabels),
    }));

    if (points.every((p) => p.value === null)) return [];

    let lastValid = 75;
    return points.map((p) => {
      if (p.value !== null) lastValid = p.value;
      return {
        label: p.label,
        fullDateLabel: p.fullDateLabel,
        dateRange: p.dateRange,
        value: p.value !== null ? p.value : lastValid,
        actualCount: p.count,
        attendanceCount: p.attendanceCount,
        assessmentLabels: p.assessmentLabels,
      };
    });
  }, [filteredStudents, grades, attendance, trendFilter]);

  const highestScore = useMemo(() => (chartTrendData.length === 0 ? 0 : Math.max(...chartTrendData.map((d) => d.value))), [chartTrendData]);
  const lowestScore = useMemo(() => (chartTrendData.length === 0 ? 0 : Math.min(...chartTrendData.map((d) => d.value))), [chartTrendData]);

  const trendDir = useMemo(() => {
    if (chartTrendData.length < 2) return 'stable';
    const first = chartTrendData[0].value;
    const last = chartTrendData[chartTrendData.length - 1].value;
    return last > first ? 'up' : last < first ? 'down' : 'stable';
  }, [chartTrendData]);

  const totalStudentsCount = stats?.students ?? students.length;
  const totalTutorsCount = stats?.tutors ?? tutors.length;
  const totalFacultyCount = stats?.faculty ?? 0;
  const totalPrincipalsCount = stats?.principals ?? 0;

  // ── Stakeholder-Validated Overall Metrics Calculations ───────────────────────
  const studentRiskRows = useMemo(() => {
    if (filteredStudents.length === 0) return [];
    return computeStudentRiskRows(filteredStudents, grades, attendance);
  }, [filteredStudents, grades, attendance]);

  const hasAttendanceData = useMemo(() => {
    const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
    const hasLogs = attendance.some((a) => {
      const aUser = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
      const aUserId = (a as any).user_id || (a as any).student_id;
      return studentIds.has(String(aUser)) || studentIds.has(String(aUserId));
    });
    if (hasLogs) return true;
    if (selectedTutorId === 'all' && (stats?.attendance_summary?.total_logs ?? 0) > 0) return true;
    if (selectedTutorId === 'all' && (stats?.academic_summary?.average_attendance_rate ?? 0) > 0) return true;
    return false;
  }, [filteredStudents, attendance, selectedTutorId, stats]);

  const hasScoreData = useMemo(() => {
    const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
    const hasScores = grades.some((g) => {
      const gStudent = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
      const gStudentId = (g as any).student_id;
      const isStudent = studentIds.has(String(gStudent)) || studentIds.has(String(gStudentId));
      return isStudent && g.component_type !== 'attendance' && g.remarks?.trim().toLowerCase() !== 'not taken';
    });
    if (hasScores) return true;
    if (selectedTutorId === 'all' && (stats?.academic_summary?.average_score ?? 0) > 0) return true;
    return false;
  }, [filteredStudents, grades, selectedTutorId, stats]);

  const overallAttendanceRate = useMemo(() => {
    if (studentRiskRows.length > 0 && attendance.length > 0) {
      const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
      const matchingAtt = attendance.filter((a) => {
        const aUser = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
        const aUserId = (a as any).user_id || (a as any).student_id;
        return studentIds.has(String(aUser)) || studentIds.has(String(aUserId));
      });
      if (matchingAtt.length > 0) {
        const presentCount = matchingAtt.filter((a) => a.status === 'present').length;
        return Math.round((presentCount / matchingAtt.length) * 1000) / 10;
      }
    }
    if (selectedTutorId === 'all' && stats?.academic_summary?.average_attendance_rate !== undefined && stats.academic_summary.average_attendance_rate > 0) {
      return stats.academic_summary.average_attendance_rate;
    }
    if (selectedTutorId === 'all' && stats?.attendance_summary && stats.attendance_summary.total_logs > 0) {
      return Math.round((stats.attendance_summary.present / stats.attendance_summary.total_logs) * 1000) / 10;
    }
    return 0;
  }, [studentRiskRows, attendance, filteredStudents, selectedTutorId, stats]);

  const overallAvgScore = useMemo(() => {
    if (studentRiskRows.length > 0 && hasScoreData) {
      const validScores = studentRiskRows.filter((r) => r.scoreAvg > 0);
      if (validScores.length > 0) {
        const total = validScores.reduce((sum, r) => sum + r.scoreAvg, 0);
        return Math.round((total / validScores.length) * 10) / 10;
      }
    }
    if (selectedTutorId === 'all' && stats?.academic_summary?.average_score !== undefined && stats.academic_summary.average_score > 0) {
      return stats.academic_summary.average_score;
    }
    return 0;
  }, [studentRiskRows, hasScoreData, selectedTutorId, stats]);

  const overallCompositeScore = useMemo(() => {
    if (overallAttendanceRate > 0 && overallAvgScore > 0) {
      return Math.round(((overallAttendanceRate * 0.4) + (overallAvgScore * 0.6)) * 10) / 10;
    }
    if (overallAttendanceRate > 0) return overallAttendanceRate;
    if (overallAvgScore > 0) return overallAvgScore;
    return 0;
  }, [overallAttendanceRate, overallAvgScore]);

  // ── Status Border Helpers (Border-primary with subtle glass background) ──────
  const getScoreBorderBadge = (score: number) => {
    if (score >= 80) {
      return 'border border-emerald-500/70 dark:border-emerald-400/80 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    }
    if (score >= 75) {
      return 'border border-amber-500/70 dark:border-amber-400/80 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    }
    return 'border border-rose-500/70 dark:border-rose-400/80 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  };

  const getTrendBadge = (dir: 'up' | 'down' | 'stable') => {
    if (dir === 'up') {
      return {
        text: 'Improving',
        className: 'border border-emerald-500/70 dark:border-emerald-400/80 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      };
    }
    if (dir === 'down') {
      return {
        text: 'Declining',
        className: 'border border-rose-500/70 dark:border-rose-400/80 bg-rose-500/10 text-rose-700 dark:text-rose-300',
      };
    }
    return {
      text: 'Stable',
      className: 'border border-slate-300 dark:border-zinc-700 bg-slate-100/60 dark:bg-zinc-800/60 text-slate-700 dark:text-slate-300',
    };
  };

  const trendBadge = getTrendBadge(trendDir);

  // ─── Loading Skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 data-loaded-content w-full min-w-0 max-w-full">
        <StatsGridSkeleton count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            <CardSkeleton rows={6} />
            <CardSkeleton rows={5} />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <CardSkeleton rows={4} />
            <CardSkeleton rows={5} />
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-5 sm:p-6 text-rose-800 dark:text-rose-200">
        <p className="text-sm font-bold text-rose-900 dark:text-rose-200">Failed to load admin dashboard</p>
        <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-rose-900/40 text-rose-700 dark:text-rose-200 text-xs font-semibold hover:bg-rose-100/60 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const totalStaff = totalTutorsCount + totalFacultyCount + totalPrincipalsCount;
  const totalDirectory = totalStudentsCount + totalStaff;

  const directoryBreakdown = [
    { label: 'Students', count: totalStudentsCount, link: '/admin/students' },
    { label: 'Tutors', count: totalTutorsCount, link: '/admin/tutors' },
    { label: 'Faculty Members', count: totalFacultyCount, link: '/admin/faculty' },
    { label: 'Principals', count: totalPrincipalsCount, link: '/admin/principals' },
  ];

  // ─── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 data-loaded-content w-full min-w-0 max-w-full">
      {/* ── 1. Top Metrics KPI Strip (Clean, Minimalist, Generous Whitespace) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Students */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Total Students
          </span>
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {totalStudentsCount.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
            {filteredStudents.length} active in current selection
          </p>
        </div>

        {/* Metric 2: Academic Staff */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Academic Staff
          </span>
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {totalStaff.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
            {totalTutorsCount} Tutors • {totalFacultyCount} Faculty • {totalPrincipalsCount} Principals
          </p>
        </div>

        {/* Metric 3: Attendance Rate */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Attendance Rate
          </span>
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {!hasAttendanceData ? '—' : `${overallAttendanceRate}%`}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Institutional session attendance compliance
          </p>
        </div>

        {/* Metric 4: Average Evaluation */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Average Score
          </span>
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {!hasScoreData ? '—' : `${overallAvgScore}%`}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Composite rating: {overallCompositeScore > 0 ? `${overallCompositeScore}%` : '—'}
          </p>
        </div>
      </div>

      {/* ── 2. Streamlined Dashboard Layout (Clean Surfaces, Focused Hierarchy) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── Left Column (7 cols): Performance Trend & Institutional Directory ── */}
        <div className="lg:col-span-7 space-y-4">
          {/* Performance Trend Card */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-neutral-800">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
                  {selectedTutorObj
                    ? `${selectedTutorObj.full_name.toUpperCase()}'S PERFORMANCE TREND`
                    : 'ACADEMIC PERFORMANCE TREND'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cohort progress and assessment trajectory over time
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Tutor Filter Select */}
                <select
                  aria-label="Filter by Tutor Class"
                  value={selectedTutorId}
                  onChange={(e) => setSelectedTutorId(e.target.value)}
                  style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-800 dark:text-slate-200 cursor-pointer outline-none transition focus:border-[var(--brand)] max-w-[180px] sm:max-w-[200px] truncate"
                >
                  <option value="all">ALL TUTORS</option>
                  {tutors.map((tutor) => {
                    const fullName = (tutor.full_name || `${tutor.first_name} ${tutor.last_name}`).trim().toUpperCase();
                    return (
                      <option key={tutor.id} value={tutor.id}>
                        {fullName}
                      </option>
                    );
                  })}
                </select>

                {/* Granularity Tabs */}
                <div className="flex bg-slate-100 dark:bg-neutral-900 rounded-lg p-0.5 gap-1 shrink-0 border border-slate-200/60 dark:border-neutral-800">
                  {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setTrendFilter(filter)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        trendFilter === filter
                          ? 'border border-[#0052B7] dark:border-blue-400 bg-[#0052B7]/10 dark:bg-blue-500/15 text-[#0052B7] dark:text-blue-300 shadow-xs'
                          : 'border border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart Canvas */}
            <div className="relative min-h-[220px] sm:min-h-[250px] w-full mt-4 bg-slate-50/50 dark:bg-neutral-950/40 border border-slate-100 dark:border-neutral-800/80 rounded-lg p-2 sm:p-3 overflow-hidden">
              {chartTrendData.length > 0 ? (
                <InteractiveAdminPerformanceChart data={chartTrendData} trendFilter={trendFilter} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
                  <BarChart2 className="w-8 h-8 text-slate-300 dark:text-neutral-700" />
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    No student assessment records found for this selection
                  </p>
                </div>
              )}
            </div>

            {/* Summary Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-neutral-800">
              <div className="p-2 text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                  Highest Score
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-bold ${chartTrendData.length > 0 ? getScoreBorderBadge(highestScore) : 'text-slate-400'}`}>
                  {chartTrendData.length > 0 ? `${highestScore}%` : '—'}
                </span>
              </div>

              <div className="p-2 text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                  Lowest Score
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-bold ${chartTrendData.length > 0 ? getScoreBorderBadge(lowestScore) : 'text-slate-400'}`}>
                  {chartTrendData.length > 0 ? `${lowestScore}%` : '—'}
                </span>
              </div>

              <div className="p-2 text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                  Cohort Trend
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-bold ${chartTrendData.length > 0 ? trendBadge.className : 'text-slate-400'}`}>
                  {chartTrendData.length > 0 ? trendBadge.text : '—'}
                </span>
              </div>

              <div className="p-2 text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                  Active Learners
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block">
                  {filteredStudents.length}
                </span>
              </div>
            </div>
          </div>

          {/* Institutional Directory Card */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  Institutional Directory
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Academic user distribution across stakeholders
                </p>
              </div>
              <Link
                to="/admin/students"
                className="text-xs font-semibold text-[#0052B7] dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-neutral-800/80 mt-1">
              {directoryBreakdown.map((item) => {
                const percentage = totalDirectory > 0
                  ? Math.max(1, Math.round((item.count / totalDirectory) * 100))
                  : 0;
                return (
                  <Link
                    key={item.label}
                    to={item.link}
                    className="py-3 px-2 flex items-center justify-between gap-4 text-sm hover:bg-slate-50/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors no-underline"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                        {percentage}%
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white min-w-[2.5rem] text-right">
                        {item.count.toLocaleString()}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right Column (5 cols): Administrative Actions & Benchmark Overview ── */}
        <div className="lg:col-span-5 space-y-4">
          {/* Core Administrative Actions */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight pb-4 border-b border-slate-100 dark:border-neutral-800">
              Administrative Actions
            </h2>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <Link
                to="/admin/students"
                className="p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-[#0052B7] dark:hover:border-blue-400 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors no-underline group"
              >
                <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors">
                  Students
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                  Manage learners
                </span>
              </Link>

              <Link
                to="/admin/tutors"
                className="p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-[#0052B7] dark:hover:border-blue-400 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors no-underline group"
              >
                <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors">
                  Tutors
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                  Staff & classes
                </span>
              </Link>

              <Link
                to="/admin/faculty"
                className="p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-[#0052B7] dark:hover:border-blue-400 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors no-underline group"
              >
                <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors">
                  Faculty
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                  Teaching roster
                </span>
              </Link>

              <Link
                to="/admin/attendance"
                className="p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-[#0052B7] dark:hover:border-blue-400 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors no-underline group"
              >
                <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors">
                  QR Attendance
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                  Verify logs
                </span>
              </Link>
            </div>
          </div>

          {/* Academic Health Summary */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight pb-4 border-b border-slate-100 dark:border-neutral-800">
              Academic Health Summary
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-neutral-800/80 mt-1">
              <div className="py-3 px-2 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">Attendance Compliance</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Threshold: 80% target</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {!hasAttendanceData ? '—' : `${overallAttendanceRate}%`}
                  </span>
                </div>
              </div>

              <div className="py-3 px-2 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">Assessment Average</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Cohort grade average</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {!hasScoreData ? '—' : `${overallAvgScore}%`}
                  </span>
                </div>
              </div>

              <div className="py-3 px-2 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">Composite Rating</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Weighted metric (40% att, 60% eval)</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#0052B7] dark:text-blue-400 text-sm">
                    {overallCompositeScore > 0 ? `${overallCompositeScore}%` : '—'}
                  </span>
                </div>
              </div>

              <div className="py-3 px-2 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">Total Logged Assessments</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Recorded grades in system</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {chartTrendData.reduce((acc, p) => acc + p.actualCount, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
