import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { Attendance, Grade, User } from '../../types';
import {
  CheckCircle,
  ChevronRight,
  AlertCircle,
  Users,
  Smile,
  Meh,
  Frown,
  X,
  BarChart2,
} from 'lucide-react';
import { computeStudentRiskRows, type StudentRiskRow, getRiskAvatarClass } from '../../utils/analyticsHelpers';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';

interface TutorChartPoint {
  label: string;
  fullDateLabel?: string;
  dateRange: string;
  value: number;
  actualCount: number;
  attendanceCount?: number;
  assessmentLabels: string[];
}

const InteractiveTutorChart: React.FC<{ data: TutorChartPoint[] }> = ({ data }) => {
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
  const paddingLeft = 24;
  const paddingRight = 10;
  const paddingTop = 22;
  const paddingBottom = 26;

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

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="tutorChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
          <filter id="tutorChartGlow" x="-20%" y="-30%" width="140%" height="160%">
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
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="var(--slate-200)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6" />
              <text x={paddingLeft - 6} y={y + 3} className="fill-slate-400 font-semibold text-[8px]" textAnchor="end">{val}%</text>
            </g>
          );
        })}

        {/* Milestone guide lines (Lighter Accent) */}
        {points.map((p, idx) => {
          if (p.assessmentLabels.length === 0) return null;

          return (
            <g key={`milestone-${idx}`}>
              <title>{p.assessmentLabels.join(', ')}</title>
              {/* Subtle vertical reference line */}
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

        {/* X-axis date labels */}
        {points.map((p, idx) => (
          <text
            key={`label-${idx}`}
            x={p.x}
            y={height - 5}
            className="fill-slate-500 font-semibold text-[8px]"
            textAnchor="middle"
            style={{ whiteSpace: 'nowrap' }}
          >
            {p.label}
          </text>
        ))}

        {/* Royal Blue Trend Line & Area (#0052B7) */}
        {points.length > 0 && (
          <>
            <path d={areaD} fill="url(#tutorChartFill)" />
            <path d={pathD} fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" filter="url(#tutorChartGlow)" />
            <path d={pathD} fill="none" stroke="var(--brand)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {/* Data point markers */}
        {points.map((p, idx) => (
          <circle key={`data-dot-${idx}`} cx={p.x} cy={p.y} r="3.5" fill="var(--brand)" stroke="#B6D4F8" strokeWidth="1.5" />
        ))}

        {/* Milestone assessment dots */}
        {points.map((p, idx) => (
          p.assessmentLabels.length > 0 && (
            <g key={`milestone-dot-${idx}`}>
              <circle cx={p.x} cy={p.y} r="8.5" fill="#38BDF8" opacity="0.45" filter="url(#tutorChartGlow)" />
              <circle cx={p.x} cy={p.y} r="4.5" fill="#0284C7" stroke="#BAE6FD" strokeWidth="2" />
            </g>
          )
        ))}

        {/* Vertical line and dots on hover */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line x1={points[hoveredIdx].x} y1={paddingTop} x2={points[hoveredIdx].x} y2={paddingTop + chartH} stroke="var(--brand)" strokeWidth="1.5" opacity="0.7" />
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
            <rect key={idx} x={xStart} y={paddingTop} width={xEnd - xStart} height={chartH} fill="transparent" className="cursor-pointer" onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)} />
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (() => {
        const p = points[hoveredIdx];
        const pointXPct = (p.x / width) * 100;
        const isNearRight = pointXPct > 75;
        const gapPx = 14;

        return (
          <div
            className="pointer-events-none absolute z-10 min-w-[160px] rounded-xl border border-slate-700/50 bg-slate-900/95 p-3 text-left text-[11px] font-medium leading-normal text-white shadow-xl"
            style={{
              left: isNearRight ? `calc(${pointXPct}% - ${gapPx}px)` : `calc(${pointXPct}% + ${gapPx}px)`,
              top: '50%',
              transform: isNearRight ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
            }}
          >
            <div className="font-extrabold text-[11px] text-[#60A5FA] whitespace-nowrap">
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
              <span className="text-[9px] text-slate-400">Total Composite Rating</span>
            </div>
            {p.assessmentLabels.length > 0 && (
              <div className="mt-1.5 bg-[#0284C7]/20 border border-[#0284C7]/40 text-[#38BDF8] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-[0_0_8px_rgba(2,132,199,0.25)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_6px_rgba(56,189,248,0.8)] inline-block" />
                <span className="uppercase tracking-wider">{p.assessmentLabels.join(', ')}</span>
              </div>
            )}
            <div className="text-[9px] text-slate-400 mt-1 border-t border-slate-800 pt-1 space-y-0.5">
              <div>
                {p.actualCount > 0
                  ? `${p.actualCount} ${p.actualCount === 1 ? 'score' : 'scores'} logged`
                  : 'No scores logged'}
              </div>
              <div>
                {(p.attendanceCount ?? 0) > 0
                  ? `${p.attendanceCount} attendance record${p.attendanceCount === 1 ? '' : 's'} logged`
                  : 'No attendance records logged'}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── Types & Helpers ────────────────────────────────────────────────────────────
interface StudentStat extends StudentRiskRow { }
type TrendFilter = 'day' | 'week' | 'month';

function computeStudentStats(students: User[], grades: Grade[], attendanceLogs: Attendance[]): StudentStat[] {
  return computeStudentRiskRows(students, grades, attendanceLogs);
}

import { getStudentAvatarColor as avatarColor } from '../../utils/studentFormatters';


// ─── Main Component ─────────────────────────────────────────────────────────────
export const TutorHome: React.FC = () => {
  const { user } = useAuth();


  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('week');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [studentRes, gradesRes, attRes] = await Promise.all([
          userService.getAllUsers({ role: 'student', assigned_tutor: user.id }),
          academicService.getGrades(),
          academicService.getAttendanceHistory(),
        ]);
        setStudents(Array.isArray(studentRes) ? studentRes : []);
        setGrades(Array.isArray(gradesRes) ? gradesRes : []);
        setAttendance(Array.isArray(attRes) ? attRes : []);
      } catch (err: any) {
        console.error('TutorHome fetch error:', err);
        setError(err?.response?.data?.detail || 'Failed to load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user]);

  const studentStats = useMemo(() => computeStudentStats(students, grades, attendance), [students, grades, attendance]);
  const totalStudents = students.length;

  const avgAttendance = useMemo(() => {
    if (studentStats.length === 0) return 0;
    return Math.round((studentStats.reduce((acc, s) => acc + s.attendanceRate, 0) / studentStats.length) * 10) / 10;
  }, [studentStats]);

  const avgScore = useMemo(() => {
    const withScores = studentStats.filter((s) => s.scoreAvg > 0);
    if (withScores.length === 0) return 0;
    return Math.round((withScores.reduce((acc, s) => acc + s.scoreAvg, 0) / withScores.length) * 10) / 10;
  }, [studentStats]);

  const getAverageMood = (value: number, hasData: boolean) => {
    // No data yet: show happy face in neutral grey — not orange which implies known medium risk
    if (!hasData) return {
      icon: Smile,
      iconBg: 'bg-gray-100 border-gray-200 dark:bg-gray-800/80 dark:border-gray-700/70',
      iconColor: 'text-gray-400 dark:text-slate-500',
    };
    if (value >= 81) return { icon: Smile, iconBg: 'risk-card-low', iconColor: 'text-risk-low' };
    if (value >= 75) return { icon: Meh, iconBg: 'risk-card-medium', iconColor: 'text-risk-medium' };
    return { icon: Frown, iconBg: 'risk-card-high', iconColor: 'text-risk-high' };
  };

  const hasScoreData = grades.some((grade) => grade.remarks?.trim().toLowerCase() !== 'not taken');
  const attendanceMood = getAverageMood(avgAttendance, attendance.length > 0);
  const scoreMood = getAverageMood(avgScore, hasScoreData);

  const atRiskStudents = useMemo(
    () => studentStats
      .filter((s) => s.riskTier === 'High' || s.riskTier === 'Medium')
      .sort((a, b) => {
        const tierOrder = (tier: string) => tier === 'High' ? 0 : 1;
        return tierOrder(a.riskTier) - tierOrder(b.riskTier) || a.compositeScore - b.compositeScore;
      }),
    [studentStats]
  );

  const highRiskStudents = useMemo(
    () => studentStats.filter((s) => s.riskTier === 'High'),
    [studentStats]
  );

  const tutorMilestone = useMemo(() => {
    const level = (user?.aral_level || 'basic').toLowerCase();
    if (level === 'plus') return 'EOSY';
    if (level === 'summer') return 'ARAL Summer Assessment';
    return 'MOSY'; // for basic
  }, [user?.aral_level]);

  const last4WeeksData = useMemo(() => {
    if (students.length === 0 || grades.length === 0) return [];
    const studentIds = new Set(students.map((s) => String(s.id)));
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
          if (assessmentText.includes(tutorMilestone.toUpperCase())) {
            p.assessmentLabels.add(tutorMilestone);
          } else if (assessmentText.includes('ARAL SUMMER') || assessmentText.includes('SUMMER') || assessmentText.includes('BOSY')) {
            p.assessmentLabels.add('ARAL Summer Assessment');
          } else if (assessmentText.includes('MOSY')) {
            p.assessmentLabels.add('MOSY');
          } else if (assessmentText.includes('EOSY')) {
            p.assessmentLabels.add('EOSY');
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

    let lastValid = 70;
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
  }, [students, grades, attendance, trendFilter]);

  const highestScore = useMemo(() => last4WeeksData.length === 0 ? 0 : Math.max(...last4WeeksData.map((d) => d.value)), [last4WeeksData]);
  const lowestScore = useMemo(() => last4WeeksData.length === 0 ? 0 : Math.min(...last4WeeksData.map((d) => d.value)), [last4WeeksData]);
  const tutorTrendDir = useMemo(() => {
    if (last4WeeksData.length < 2) return 'stable';
    const first = last4WeeksData[0].value;
    const last = last4WeeksData[last4WeeksData.length - 1].value;
    return last > first ? 'up' : last < first ? 'down' : 'stable';
  }, [last4WeeksData]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col lg:h-[calc(100vh-8.5rem)] lg:min-h-[30rem] gap-3.5 skeleton-container">
        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 shrink-0 skeleton-row-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 shadow-sm animate-pulse">
              <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0 border border-gray-100 dark:border-gray-800" />
              <div className="flex-1">
                <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
                <div className="h-6 w-14 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>

        {/* Content rows skeleton */}
        <div className="grid gap-4 lg:grid-cols-4 items-stretch flex-1 min-h-0 skeleton-row-2">
          {/* Chart card skeleton */}
          <div className="lg:col-span-3 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex flex-col h-full min-h-0 animate-pulse">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 pb-3.5 sm:pb-4 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div>
                <div className="h-4 w-52 rounded bg-gray-200 dark:bg-gray-800 mt-0.5" />
                <div className="h-3 w-36 rounded bg-gray-100 dark:bg-gray-800 mt-1.5" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-28 rounded-full bg-gray-100 dark:bg-gray-800 hidden sm:block" />
                <div className="h-4 w-20 rounded-full bg-gray-100 dark:bg-gray-800 hidden sm:block" />
                <div className="h-7 w-28 rounded-xl bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 gap-3 mt-3.5 sm:mt-4">
              <div className="relative flex-1 min-h-0 w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-2xl" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 skeleton-row-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="bg-gray-50 dark:bg-[#111111] p-2 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] text-center">
                      <div className="h-2.5 w-12 rounded bg-gray-200 dark:bg-gray-800 mx-auto" />
                      <div className="h-5 w-14 rounded bg-gray-200 dark:bg-gray-800 mx-auto mt-1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* At-Risk panel skeleton */}
          <div className="lg:col-span-1 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl shadow-sm flex flex-col h-full min-h-0 overflow-hidden animate-pulse">
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between shrink-0">
              <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-5 w-7 rounded-full bg-rose-100 dark:bg-rose-950/40" />
            </div>
            <div className="p-2.5 sm:p-3 space-y-1.5 flex-1 min-h-0 overflow-y-auto skeleton-row-3">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="px-3 py-1.5 rounded-xl border border-gray-100 dark:border-[#1A1A1A] bg-gray-50/50 dark:bg-[#111111] flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-3.5 w-10 rounded-full bg-rose-100 dark:bg-rose-950/50 shrink-0" />
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="h-2.5 w-20 rounded bg-gray-100 dark:bg-gray-800" />
                    <div className="h-2.5 w-8 rounded bg-gray-200 dark:bg-gray-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-2xl p-5 shadow-sm">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load dashboard</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:h-[calc(100vh-8.5rem)] lg:min-h-[30rem] gap-3.5 data-loaded-content">
      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 shrink-0">
        {[
          {
            label: 'My Students',
            to: '/tutor/students',
            value: totalStudents,
            suffix: '',
            iconBg: 'bg-slate-100 border-slate-200 dark:bg-slate-800/80 dark:border-slate-700/70',
            icon: Users,
            iconColor: 'text-slate-800 dark:text-slate-100',
            valueColor: 'text-gray-900 dark:text-slate-100',
          },
          {
            label: 'Average Attendance',
            to: '/tutor/analytics?tab=attendance',
            value: attendance.length === 0 ? '—' : `${avgAttendance}%`,
            suffix: '',
            icon: attendanceMood.icon,
            iconBg: attendanceMood.iconBg,
            iconColor: attendanceMood.iconColor,
            valueColor: attendance.length === 0 ? 'text-gray-400 dark:text-slate-500' : avgAttendance >= 81 ? 'text-risk-low' : avgAttendance >= 75 ? 'text-risk-medium' : 'text-risk-high',
          },
          {
            label: 'Average Scores',
            to: '/tutor/analytics?tab=score',
            value: !hasScoreData ? '—' : `${avgScore}%`,
            suffix: '',
            icon: scoreMood.icon,
            iconBg: scoreMood.iconBg,
            iconColor: scoreMood.iconColor,
            valueColor: !hasScoreData ? 'text-gray-400 dark:text-slate-500' : avgScore >= 81 ? 'text-risk-low' : avgScore >= 75 ? 'text-risk-medium' : 'text-risk-high',
          },
          {
            label: 'High Risk Students',
            to: '/tutor/analytics',
            value: highRiskStudents.length,
            suffix: '',
            icon: Frown,
            iconBg: 'risk-card-high',
            iconColor: 'text-risk-high',
            valueColor: 'text-risk-high',
          },
        ].map((card) => {
          const Icon = card.icon;
          const iconImage = 'iconImage' in card ? card.iconImage as string | undefined : undefined;
          const iconImageLight = 'iconImageLight' in card ? card.iconImageLight as string | undefined : undefined;
          return (
            <Link
              key={card.label}
              to={card.to}
              className="group flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] dark:border-[#1A1A1A] dark:bg-[#0A0A0A] dark:hover:border-[var(--brand)] dark:hover:shadow-[0_4px_20px_-4px_var(--brand-glow)]"
            >
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${card.iconBg}`}>
                {iconImage ? (
                  iconImageLight ? (
                    <>
                      <img src={iconImageLight} alt="" className="w-5 h-5 object-contain dark:hidden" />
                      <img src={iconImage} alt="" className="hidden w-5 h-5 object-contain dark:block" />
                    </>
                  ) : (
                    <img src={iconImage} alt="" className="w-5 h-5 object-contain" />
                  )
                ) : Icon ? (
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                ) : null}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100">{card.label}</p>
                <p className={`text-2xl font-extrabold mt-0.5 ${card.valueColor}`}>{card.value}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Performance Trend + Risk ───────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-4 items-stretch flex-1 min-h-0">

        {/* Chart */}
        <div className="lg:col-span-3 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex flex-col h-full min-h-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 pb-3.5 sm:pb-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div>
              <h3 className="whitespace-nowrap text-base font-bold text-gray-900 dark:text-slate-100 mt-0.5">STUDENTS PERFORMANCE TREND CHART</h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)] inline-block shadow-xs" />
                <span>Total composite rating of all students</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8] inline-block ring-2 ring-[#38BDF8]/30 shadow-xs" />
                <span>{tutorMilestone}</span>
              </div>
              <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-0.5 gap-0.5 sm:ml-1">
                {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTrendFilter(filter)}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${trendFilter === filter ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 gap-3 mt-3.5 sm:mt-4">
            <div className="relative flex-1 min-h-0 w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-2xl px-4 py-2 sm:px-6 sm:py-2.5">
              {last4WeeksData.length > 0 ? (
                <InteractiveTutorChart data={last4WeeksData} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
                  <BarChart2 className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                    No student score records submitted yet
                  </p>
                  <p className="text-[11px] text-gray-300 dark:text-slate-600">
                    Data will appear once scores and attendance are logged for your students
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                {[
                  {
                    label: 'Highest',
                    value: last4WeeksData.length === 0 ? '—' : `${highestScore}%`,
                    color: last4WeeksData.length === 0 ? 'text-gray-400 dark:text-slate-500' : highestScore >= 81 ? 'text-risk-low' : highestScore >= 75 ? 'text-risk-medium' : 'text-risk-high',
                  },
                  {
                    label: 'Lowest',
                    value: last4WeeksData.length === 0 ? '—' : `${lowestScore}%`,
                    color: last4WeeksData.length === 0 ? 'text-gray-400 dark:text-slate-500' : lowestScore >= 81 ? 'text-risk-low' : lowestScore >= 75 ? 'text-risk-medium' : 'text-risk-high',
                  },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-50 dark:bg-[#111111] p-2 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] text-center">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{stat.label}</p>
                    <p className={`text-lg font-extrabold mt-0.5 ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
                <div className="bg-gray-50 dark:bg-[#111111] p-2 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] text-center">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Trend</p>
                  <div className="mt-0.5">
                    {last4WeeksData.length === 0 ? (
                      <span className="text-lg font-extrabold text-gray-400 dark:text-slate-500">—</span>
                    ) : tutorTrendDir === 'up' ? (
                      <span className="text-lg font-extrabold text-risk-low">Improving</span>
                    ) : tutorTrendDir === 'down' ? (
                      <span className="text-lg font-extrabold text-risk-high">Declining</span>
                    ) : (
                      <span className="text-lg font-extrabold text-gray-500 dark:text-slate-400">Stable</span>
                    )}
                  </div>
                </div>
                <Link
                  to="/tutor/analytics"
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-light)]/70 px-4 py-2.5 text-xs font-semibold text-[var(--brand)] dark:text-sky-400 transition hover:border-[var(--brand)] hover:bg-[var(--brand-light)] hover:text-[var(--brand-hover)] dark:hover:text-sky-300"
                >
                  <span className="decoration-[var(--brand)]/60 dark:decoration-sky-400/60">See More</span>
                  <span className="font-bold no-underline" aria-hidden="true">&gt;</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* At-Risk panel */}
        <div className="lg:col-span-1 h-full min-h-0">
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-gray-100 dark:border-[#1A1A1A] shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mt-0.5 flex items-center gap-2">
                  TOP STUDENTS AT-RISK
                </h3>
              </div>
              <div>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 text-[10px] font-extrabold text-gray-700 dark:text-slate-300">
                  {atRiskStudents.length}
                </span>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 space-y-1.5 flex-1 min-h-0 overflow-y-auto">
              {atRiskStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-8 px-4 gap-2">
                  <div className="w-12 h-12 rounded-2xl risk-card-low flex items-center justify-center">
                    <Smile className="w-6 h-6 text-risk-low" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">All students on track</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">No high or medium risk students.</p>
                </div>
              ) : (
                atRiskStudents.slice(0, 15).map((s) => (
                  <Link
                    key={s.student.id}
                    to={`/tutor/students/${s.student.id}`}
                    state={{ from: 'dashboard' }}
                    className={`block rounded-xl border px-3 py-1.5 transition-colors group ${s.riskTier === 'High'
                      ? 'risk-card-high'
                      : 'risk-card-medium'
                      }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-semibold text-xs text-gray-800 dark:text-slate-200 truncate block leading-tight">
                          {s.student.full_name}
                        </span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold shrink-0 border leading-none ${s.riskTier === 'High' ? 'risk-badge-high' : 'risk-badge-medium'}`}>
                          {s.riskTier.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <span className="text-gray-500 dark:text-slate-400 text-[10.5px] font-normal leading-tight">
                          Composite Rating:
                        </span>
                        <span className="text-xs font-normal text-gray-900 dark:text-slate-100 leading-tight">
                          {s.compositeScore.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default TutorHome;
