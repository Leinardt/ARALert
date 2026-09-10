import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance, Grade, User, StudentAcademicProfile } from '../../types';
import {
  CheckCircle,
  ShieldAlert,
  AlertCircle,
  Smile,
  Meh,
  Frown,
  Calendar,
  X,
  BarChart2,
} from 'lucide-react';
import { computeStudentRiskRows } from '../../utils/analyticsHelpers';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';

// ─── Chart Types & Interactive Chart ─────────────────────────────────────────

interface StudentChartPoint {
  label: string;
  dateRange: string;
  value: number;
  actualCount: number;
  assessmentLabels: string[];
}

type TrendFilter = 'day' | 'week' | 'month';

const InteractiveStudentChart: React.FC<{ data: StudentChartPoint[] }> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 200 });

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
  const paddingTop = 18;
  const paddingBottom = 22;

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
          <linearGradient id="studentChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
          <filter id="studentChartGlow" x="-20%" y="-30%" width="140%" height="160%">
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
                stroke="currentColor"
                className="text-gray-100 dark:text-[#1F1F1F]"
                strokeDasharray={val === 0 || val === 100 ? undefined : '3 3'}
                strokeWidth={val === 0 || val === 100 ? 1.5 : 1}
              />
              <text
                x={paddingLeft - 6}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] fill-gray-400 dark:fill-slate-600 font-mono select-none"
              >
                {val}
              </text>
            </g>
          );
        })}


        {/* Shaded Area Fill */}
        {areaD && <path d={areaD} fill="url(#studentChartFill)" />}

        {/* Bézier Glowing Stroke */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="var(--brand)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#studentChartGlow)"
          />
        )}

        {/* Data points & milestone markers */}
        {points.map((p, idx) => {
          const isHovered = hoveredIdx === idx;
          const hasAssessment = p.assessmentLabels.length > 0;
          return (
            <g key={idx}>
              {/* Baseline circular indicator */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : hasAssessment ? 5 : 3.5}
                fill={hasAssessment ? '#38BDF8' : 'var(--brand)'}
                stroke="#ffffff"
                strokeWidth={2}
                className="transition-all duration-150"
              />

              {/* DepEd Milestone Tag Pill */}
              {hasAssessment && (
                <g className="select-none pointer-events-none">
                  <rect
                    x={p.x - 20}
                    y={Math.max(6, p.y - 24)}
                    width={40}
                    height={16}
                    rx={8}
                    fill="#0284C7"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    className="shadow-md"
                  />
                  <text
                    x={p.x}
                    y={Math.max(6, p.y - 24) + 11}
                    textAnchor="middle"
                    fill="#ffffff"
                    className="text-[8px] font-black tracking-wider uppercase font-sans"
                  >
                    {Array.from(p.assessmentLabels)[0]}
                  </text>
                </g>
              )}

              {/* X-axis Label */}
              <text
                x={p.x}
                y={height - 6}
                textAnchor="middle"
                className={`text-[10px] font-semibold transition-colors duration-150 select-none ${
                  isHovered
                    ? 'fill-[var(--brand)] font-bold'
                    : 'fill-gray-400 dark:fill-slate-500'
                }`}
              >
                {p.label}
              </text>
            </g>
          );
        })}

        {/* Hover hit regions */}
        {points.map((p, idx) => {
          const stepW = chartW / (points.length || 1);
          const xStart = Math.max(paddingLeft, p.x - stepW / 2);
          const xEnd = Math.min(width - paddingRight, p.x + stepW / 2);
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
            />
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className={`absolute z-10 min-w-[160px] bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-left pointer-events-none border border-slate-700/50 text-[11px] leading-normal font-medium ${
            hoveredIdx === 0
              ? 'left-2'
              : hoveredIdx === points.length - 1
              ? 'right-2'
              : '-translate-x-1/2'
          }`}
          style={{
            left:
              hoveredIdx === 0 || hoveredIdx === points.length - 1
                ? undefined
                : `${(points[hoveredIdx].x / width) * 100}%`,
            top: `${Math.max(4, (points[hoveredIdx].y / height) * 100 - 45)}%`,
          }}
        >
          <div className="font-extrabold text-[10px] uppercase text-[#60A5FA]">
            {points[hoveredIdx].label}
          </div>
          <div className="whitespace-nowrap text-[9px] text-slate-300">
            {points[hoveredIdx].dateRange}
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className="text-sm font-extrabold"
              style={{
                color:
                  points[hoveredIdx].value >= 81
                    ? '#22C55E'
                    : points[hoveredIdx].value >= 75
                    ? '#F59E0B'
                    : '#EF4444',
              }}
            >
              {points[hoveredIdx].value}%
            </span>
            <span className="text-[9px] text-slate-400">Assessment Score</span>
          </div>
          {points[hoveredIdx].assessmentLabels.length > 0 && (
            <div className="mt-1.5 bg-[#0284C7]/20 border border-[#0284C7]/40 text-[#38BDF8] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-[0_0_8px_rgba(2,132,199,0.25)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_6px_rgba(56,189,248,0.8)] inline-block" />
              <span className="uppercase tracking-wider">
                {points[hoveredIdx].assessmentLabels.join(', ')}
              </span>
            </div>
          )}
          <div className="text-[9px] text-slate-400 mt-1 border-t border-slate-800 pt-1">
            {points[hoveredIdx].actualCount > 0
              ? `${points[hoveredIdx].actualCount} score${
                  points[hoveredIdx].actualCount === 1 ? '' : 's'
                } logged`
              : 'No scores logged'}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main StudentHome Component ──────────────────────────────────────────────

export const StudentHome: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trendFilter, setTrendFilter] = useState<TrendFilter>('week');

  // Attendance filter state for the history table
  type FilterScope = 'day' | 'week' | 'month';
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterScope, setFilterScope] = useState<FilterScope>('day');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const [profData, gradesData, attendanceData] = await Promise.all([
          academicService.getMyProfile().catch(() => null),
          academicService.getGrades({ student_id: user.id }).catch(() => []),
          academicService.getAttendanceHistory({ user_id: user.id }).catch(() => []),
        ]);
        setProfile(profData);
        setGrades(gradesData);
        setAttendanceLogs(attendanceData);
      } catch (err) {
        console.error('StudentHome fetch error:', err);
        setError('Failed to load student dashboard. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // ── Strict Student Data Isolation ──────────────────────────────────────────
  const studentId = user?.id ? String(user.id) : '';

  const isStudentGrade = (g: Grade) => {
    if (!studentId) return true;
    const gStudent = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
    const gStudentId = (g as any).student_id;
    return String(gStudent) === studentId || String(gStudentId) === studentId;
  };

  const isStudentAttendance = (a: Attendance) => {
    if (!studentId) return true;
    const aUser = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
    const aUserId = (a as any).user_id || (a as any).student_id;
    return String(aUser) === studentId || String(aUserId) === studentId;
  };

  const currentStudentGrades = useMemo(() => {
    return grades.filter(isStudentGrade);
  }, [grades, studentId]);

  const currentStudentAttendance = useMemo(() => {
    return attendanceLogs.filter(isStudentAttendance);
  }, [attendanceLogs, studentId]);

  // ── Stakeholder-Validated Metrics Calculation ──────────────────────────────
  const studentStats = useMemo(() => {
    if (!user) return [];
    return computeStudentRiskRows([user], currentStudentGrades, currentStudentAttendance);
  }, [user, currentStudentGrades, currentStudentAttendance]);

  const studentStat = studentStats[0];

  const avgAttendance = useMemo(() => {
    if (currentStudentAttendance.length === 0) return 0;
    return studentStat?.attendanceRate ?? Math.round((profile?.attendance.attendance_rate ?? 0) * 10) / 10;
  }, [currentStudentAttendance, studentStat, profile]);

  const avgScore = useMemo(() => {
    if (studentStat && studentStat.scoreAvg > 0) return studentStat.scoreAvg;
    return profile?.gpa ?? 0;
  }, [studentStat, profile]);

  const hasScoreData = useMemo(() => {
    return currentStudentGrades.some((g) => g.remarks?.trim().toLowerCase() !== 'not taken');
  }, [currentStudentGrades]);

  const getAverageMood = (value: number, hasData: boolean) => {
    if (!hasData) {
      return {
        icon: Smile,
        iconBg: 'bg-gray-100 border-gray-200 dark:bg-gray-800/80 dark:border-gray-700/70',
        iconColor: 'text-gray-400 dark:text-slate-500',
      };
    }
    if (value >= 81) return { icon: Smile, iconBg: 'risk-card-low', iconColor: 'text-risk-low' };
    if (value >= 75) return { icon: Meh, iconBg: 'risk-card-medium', iconColor: 'text-risk-medium' };
    return { icon: Frown, iconBg: 'risk-card-high', iconColor: 'text-risk-high' };
  };

  const attendanceMood = getAverageMood(avgAttendance, currentStudentAttendance.length > 0);
  const scoreMood = getAverageMood(avgScore, hasScoreData);

  // Student Milestone
  const studentMilestone = useMemo(() => {
    const level = (user?.aral_level || 'basic').toLowerCase();
    if (level === 'plus') return 'EOSY';
    if (level === 'summer') return 'BOSY';
    return 'MOSY'; // for basic
  }, [user?.aral_level]);

  // Student Risk Tier & Dynamic Card Styling (Container changes color depending on risk)
  const studentRiskTier = studentStat?.riskTier || (profile?.computed_risk_level === 'high' ? 'High' : profile?.computed_risk_level === 'medium' ? 'Medium' : 'Low');

  const riskCardConfig = useMemo(() => {
    if (studentRiskTier === 'High') {
      return {
        icon: ShieldAlert,
        cardBg: 'risk-card-high',
        iconBg: 'risk-badge-high',
        iconColor: 'text-risk-high',
        valueColor: 'text-risk-high',
        text: 'HIGH',
      };
    }
    if (studentRiskTier === 'Medium') {
      return {
        icon: AlertCircle,
        cardBg: 'risk-card-medium',
        iconBg: 'risk-badge-medium',
        iconColor: 'text-risk-medium',
        valueColor: 'text-risk-medium',
        text: 'MEDIUM',
      };
    }
    return {
      icon: CheckCircle,
      cardBg: 'risk-card-low',
      iconBg: 'risk-badge-low',
      iconColor: 'text-risk-low',
      valueColor: 'text-risk-low',
      text: 'LOW',
    };
  }, [studentRiskTier]);

  // ── Performance Trend Data (10 days / 6 weeks / 6 months) ───────────────────
  const last4WeeksData = useMemo(() => {
    const assessmentGrades = currentStudentGrades.filter((g) => g.component_type === 'assessment');
    if (assessmentGrades.length === 0) return [];

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const formatMonth = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

    let periods: {
      label: string;
      dateRange: string;
      start: Date;
      end: Date;
      scores: number[];
      assessmentLabels: Set<string>;
    }[];

    if (trendFilter === 'day') {
      const schoolDays = getRecentSchoolWeekdays(10, now);
      periods = schoolDays.map((d) => {
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
        const weekdayName = start.toLocaleDateString(undefined, { weekday: 'short' });
        const label = formatDate(start);
        const dateRange = `${weekdayName}, ${formatDate(start)}, ${start.getFullYear()}`;
        return {
          label,
          dateRange,
          start,
          end,
          scores: [] as number[],
          assessmentLabels: new Set<string>(),
        };
      });
    } else {
      const periodCount = 6;
      periods = Array.from({ length: periodCount }).map((_, index) => {
        let start: Date, end: Date, label: string, dateRange: string;
        if (trendFilter === 'month') {
          const offset = periodCount - 1 - index;
          start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
          end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
          label = formatMonth(start);
          dateRange = label;
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
          dateRange = `${formatDate(start)} – ${formatDate(fri)}, ${fri.getFullYear()}`;
        }
        return {
          label,
          dateRange,
          start,
          end,
          scores: [] as number[],
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
          if (assessmentText.includes(studentMilestone)) {
            p.assessmentLabels.add(studentMilestone);
          } else if (assessmentText.includes('BOSY') || assessmentText.includes('MOSY') || assessmentText.includes('EOSY')) {
            const matched = ['BOSY', 'MOSY', 'EOSY'].find((m) => assessmentText.includes(m));
            if (matched) p.assessmentLabels.add(matched);
          }
          break;
        }
      }
    });

    const points = periods.map((p) => ({
      label: p.label,
      dateRange: p.dateRange,
      value: p.scores.length > 0 ? Math.round(p.scores.reduce((a, b) => a + b, 0) / p.scores.length) : null,
      count: p.scores.length,
      assessmentLabels: Array.from(p.assessmentLabels),
    }));

    if (points.every((p) => p.value === null)) return [];

    let lastValid = 70;
    return points.map((p) => {
      if (p.value !== null) lastValid = p.value;
      return {
        label: p.label,
        dateRange: p.dateRange,
        value: p.value !== null ? p.value : lastValid,
        actualCount: p.count,
        assessmentLabels: p.assessmentLabels,
      };
    });
  }, [currentStudentGrades, trendFilter, studentMilestone]);

  const highestScore = useMemo(() => (last4WeeksData.length === 0 ? 0 : Math.max(...last4WeeksData.map((d) => d.value))), [last4WeeksData]);
  const lowestScore = useMemo(() => (last4WeeksData.length === 0 ? 0 : Math.min(...last4WeeksData.map((d) => d.value))), [last4WeeksData]);

  const studentTrendDir = useMemo(() => {
    if (last4WeeksData.length < 2) return 'flat';
    const last = last4WeeksData[last4WeeksData.length - 1].value;
    const prev = last4WeeksData[last4WeeksData.length - 2].value;
    if (last > prev) return 'up';
    if (last < prev) return 'down';
    return 'flat';
  }, [last4WeeksData]);

  const studentFirstName = (user?.first_name || 'STUDENT').toUpperCase();

  // ── Render States ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3.5 sm:gap-4 skeleton-container">
        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5 shrink-0 skeleton-row-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 rounded-2xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 shadow-sm animate-pulse"
            >
              <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0 border border-gray-100 dark:border-gray-800" />
              <div className="flex-1 min-w-0">
                <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
                <div className="h-6 w-16 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>

        {/* Performance Trend Chart skeleton */}
        <div className="w-full bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl shadow-sm px-4 py-3.5 sm:px-6 sm:py-4 flex flex-col min-h-[21rem] sm:min-h-[22.5rem] animate-pulse skeleton-row-2">
          {/* Header skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 shrink-0 pb-3 sm:pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div>
              <div className="h-4 w-60 rounded bg-gray-200 dark:bg-gray-800 mt-0.5" />
              <div className="h-3 w-36 rounded bg-gray-100 dark:bg-gray-800/80 mt-1.5" />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-4 w-28 rounded-full bg-gray-100 dark:bg-gray-800 hidden sm:block" />
              <div className="h-4 w-20 rounded-full bg-gray-100 dark:bg-gray-800 hidden sm:block" />
              <div className="h-7 w-28 rounded-xl bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>

          {/* Canvas area skeleton */}
          <div className="flex-1 flex flex-col min-h-0 gap-2.5 sm:gap-3 mt-3 sm:mt-3.5">
            <div className="relative flex-1 min-h-[10.5rem] sm:min-h-[12rem] w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-2xl flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-gray-200/40 dark:bg-gray-800/40" />
            </div>

            {/* Bottom 4 stat cards skeleton */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 skeleton-row-3">
                {[1, 2, 3, 4].map((j) => (
                  <div
                    key={j}
                    className="bg-gray-50 dark:bg-[#111111] p-2 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] text-center"
                  >
                    <div className="h-2.5 w-12 rounded bg-gray-200 dark:bg-gray-800 mx-auto" />
                    <div className="h-5 w-14 rounded bg-gray-200 dark:bg-gray-800 mx-auto mt-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[24rem]">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-6 max-w-md text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-gray-900 dark:text-slate-100">Failed to load dashboard</p>
          <p className="text-xs mt-1 text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const RiskIcon = riskCardConfig.icon;

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 data-loaded-content">
      {/* ── KPI Cards (3 Cards Evenly Distributed) ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5 shrink-0">
        {/* Card 1: Average Attendance */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md dark:border-[#1A1A1A] dark:bg-[#0A0A0A] dark:hover:border-[var(--brand)] dark:hover:shadow-[0_4px_20px_-4px_var(--brand-glow)]">
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 ${attendanceMood.iconBg}`}>
            <attendanceMood.icon className={`w-5 h-5 ${attendanceMood.iconColor}`} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100">
              Average Attendance
            </p>
            <p className={`text-2xl font-extrabold mt-0.5 ${attendanceLogs.length === 0 ? 'text-gray-400 dark:text-slate-500' : avgAttendance >= 81 ? 'text-risk-low' : avgAttendance >= 75 ? 'text-risk-medium' : 'text-risk-high'}`}>
              {attendanceLogs.length === 0 ? '—' : `${avgAttendance}%`}
            </p>
          </div>
        </div>

        {/* Card 2: Average Scores */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md dark:border-[#1A1A1A] dark:bg-[#0A0A0A] dark:hover:border-[var(--brand)] dark:hover:shadow-[0_4px_20px_-4px_var(--brand-glow)]">
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 ${scoreMood.iconBg}`}>
            <scoreMood.icon className={`w-5 h-5 ${scoreMood.iconColor}`} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100">
              Average Scores
            </p>
            <p className={`text-2xl font-extrabold mt-0.5 ${!hasScoreData ? 'text-gray-400 dark:text-slate-500' : avgScore >= 81 ? 'text-risk-low' : avgScore >= 75 ? 'text-risk-medium' : 'text-risk-high'}`}>
              {!hasScoreData ? '—' : `${avgScore}%`}
            </p>
          </div>
        </div>

        {/* Card 3: [FIRST NAME]'S RISK LEVEL */}
        <div className={`flex items-center gap-3.5 rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${riskCardConfig.cardBg}`}>
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 ${riskCardConfig.iconBg}`}>
            <RiskIcon className={`w-5 h-5 ${riskCardConfig.iconColor}`} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100">
              {studentFirstName}'S RISK LEVEL
            </p>
            <p className={`text-2xl font-extrabold mt-0.5 ${riskCardConfig.valueColor}`}>
              {riskCardConfig.text}
            </p>
          </div>
        </div>
      </div>

      {/* ── [FIRSTNAME] PERFORMANCE TREND CHART (Expanded Full Width) ──────── */}
      <div className="w-full bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl shadow-sm px-4 py-3.5 sm:px-6 sm:py-4 flex flex-col min-h-[21rem] sm:min-h-[22.5rem]">
        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 shrink-0 pb-3 sm:pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div>
            <h3 className="whitespace-nowrap text-base font-bold text-gray-900 dark:text-slate-100 mt-0.5">
              {studentFirstName}'S PERFORMANCE TREND CHART
            </h3>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">
              {trendFilter === 'day' ? 'Daily' : trendFilter === 'month' ? 'Monthly' : 'Weekly'} performance trend
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)] inline-block shadow-xs" />
              <span>Total Composite Rating</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
              <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8] inline-block ring-2 ring-[#38BDF8]/30 shadow-xs" />
              <span>{studentMilestone}</span>
            </div>
            <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-0.5 gap-0.5 sm:ml-1">
              {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTrendFilter(filter)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    trendFilter === filter
                      ? 'bg-[var(--brand)] text-white shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="flex-1 flex flex-col min-h-0 gap-2.5 sm:gap-3 mt-3 sm:mt-3.5">
          <div className="relative flex-1 min-h-[10.5rem] sm:min-h-[12rem] w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-2xl px-4 py-2 sm:px-6 sm:py-2">
            {last4WeeksData.length > 0 ? (
              <InteractiveStudentChart data={last4WeeksData} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
                <BarChart2 className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                  No score records submitted yet
                </p>
                <p className="text-[11px] text-gray-300 dark:text-slate-600">
                  Data will appear once scores and attendance are logged for your assessments
                </p>
              </div>
            )}
          </div>

          {/* Bottom Stats Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
              {[
                {
                  label: 'Highest',
                  value: last4WeeksData.length === 0 ? '—' : `${highestScore}%`,
                  color:
                    last4WeeksData.length === 0
                      ? 'text-gray-400 dark:text-slate-500'
                      : highestScore >= 81
                      ? 'text-risk-low'
                      : highestScore >= 75
                      ? 'text-risk-medium'
                      : 'text-risk-high',
                },
                {
                  label: 'Lowest',
                  value: last4WeeksData.length === 0 ? '—' : `${lowestScore}%`,
                  color:
                    last4WeeksData.length === 0
                      ? 'text-gray-400 dark:text-slate-500'
                      : lowestScore >= 81
                      ? 'text-risk-low'
                      : lowestScore >= 75
                      ? 'text-risk-medium'
                      : 'text-risk-high',
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
                  ) : studentTrendDir === 'up' ? (
                    <span className="text-lg font-extrabold text-risk-low">Improving</span>
                  ) : studentTrendDir === 'down' ? (
                    <span className="text-lg font-extrabold text-risk-high">Declining</span>
                  ) : (
                    <span className="text-lg font-extrabold text-gray-500 dark:text-slate-400">Stable</span>
                  )}
                </div>
              </div>

              <Link
                to="/student/analytics"
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-light)]/70 px-4 py-2.5 text-xs font-semibold text-[var(--brand)] dark:text-sky-400 transition hover:border-[var(--brand)] hover:bg-[var(--brand-light)] hover:text-[var(--brand-hover)] dark:hover:text-sky-300"
              >
                <span className="decoration-[var(--brand)]/60 dark:decoration-sky-400/60">See More</span>
                <span className="font-bold no-underline" aria-hidden="true">&gt;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentHome;
