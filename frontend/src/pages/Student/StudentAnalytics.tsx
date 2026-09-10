import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';
import {
  ShieldAlert,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Award,
  BookOpen,
  Calendar,
  Layers,
  Smile,
  Meh,
  Frown,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { Attendance, Grade } from '../../types';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';

/* ─── Types & Helpers ─────────────────────────────────────────── */

type AnalyticsTab = 'overall' | 'attendance' | 'score';
type TrendFilter = 'day' | 'week' | 'month';

interface TrendPoint {
  label: string;
  dateRange: string;
  compositeValue: number;
  attendanceValue: number;
  scoreValue: number;
}

const smartPct = (n: number): string => {
  const fixed2 = n.toFixed(2);
  return parseFloat(fixed2).toString();
};

/* ─── Interactive Bézier Trend Chart ─────────────────────────── */

const InteractiveStudentTrendChart: React.FC<{
  data: TrendPoint[];
  metric: 'composite' | 'attendance' | 'score';
}> = ({ data, metric }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 260 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: Math.max(220, containerRef.current.clientHeight),
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const padding = { top: 25, right: 30, bottom: 40, left: 45 };
  const chartW = Math.max(100, dimensions.width - padding.left - padding.right);
  const chartH = Math.max(100, dimensions.height - padding.top - padding.bottom);

  const getValue = (p: TrendPoint) => {
    if (metric === 'attendance') return p.attendanceValue;
    if (metric === 'score') return p.scoreValue;
    return p.compositeValue;
  };

  const points = useMemo(() => {
    if (data.length === 0) return [];
    const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW / 2;

    return data.map((d, i) => {
      const val = Math.max(0, Math.min(100, getValue(d)));
      const x = padding.left + (data.length > 1 ? i * stepX : chartW / 2);
      const y = padding.top + chartH - (val / 100) * chartH;
      return { x, y, data: d, val };
    });
  }, [data, chartW, chartH, padding.left, padding.top, metric]);

  // Smooth SVG cubic Bézier path
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i !== points.length - 2 ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }, [points]);

  // Area fill under curve
  const areaD = useMemo(() => {
    if (!pathD || points.length === 0) return '';
    const bottomY = padding.top + chartH;
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    return `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [pathD, points, padding.top, chartH]);

  const yTicks = [100, 75, 50, 25, 0];

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[16rem] select-none">
      <svg className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="studentChartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines & Y-axis labels */}
        {yTicks.map((tick) => {
          const y = padding.top + chartH - (tick / 100) * chartH;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartW}
                y2={y}
                stroke="currentColor"
                className="text-gray-100 dark:text-[#1F1F1F]"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="text-[10px] font-bold fill-gray-400 dark:fill-slate-500"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        {areaD && <path d={areaD} fill="url(#studentChartGrad)" />}

        {/* Line curve */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {points.map((p, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <g key={idx} className="cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : 4}
                fill="var(--brand)"
                stroke="#ffffff"
                strokeWidth={isHovered ? 3 : 2}
                className="transition-all duration-150 drop-shadow-sm"
              />
              {/* Invisible large touch target */}
              <circle
                cx={p.x}
                cy={p.y}
                r={16}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            </g>
          );
        })}

        {/* X-axis labels */}
        {points.map((p, idx) => (
          <text
            key={`label-${idx}`}
            x={p.x}
            y={padding.top + chartH + 20}
            textAnchor="middle"
            className="text-[10px] font-semibold fill-gray-500 dark:fill-slate-400"
          >
            {p.data.label}
          </text>
        ))}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className="absolute pointer-events-none z-20 px-3 py-2 rounded-xl bg-gray-900/95 dark:bg-black/95 text-white shadow-xl backdrop-blur-xs border border-gray-800 text-center transition-all duration-150 -translate-x-1/2 -translate-y-full"
          style={{
            left: `${points[hoveredIdx].x}px`,
            top: `${points[hoveredIdx].y - 12}px`,
          }}
        >
          <p className="text-[10px] font-medium text-gray-300">{points[hoveredIdx].data.dateRange}</p>
          <p className="text-xs font-extrabold text-[var(--brand-glow)] mt-0.5">
            {smartPct(points[hoveredIdx].val)}%
          </p>
        </div>
      )}
    </div>
  );
};

/* ─── Main Component ──────────────────────────────────────────── */

export const StudentAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overall');
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('week');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  // Load student records
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [gradesData, attData] = await Promise.all([
          academicService.getGrades({ student_id: String(user.id) }),
          academicService.getAttendanceHistory({ user_id: user.id }),
        ]);

        if (!cancelled) {
          // Strict student isolation
          const myGrades = gradesData.filter((g) => String(g.student) === String(user.id));
          const myAtt = attData.filter((a) => String(a.user) === String(user.id));
          setGrades(myGrades);
          setAttendanceLogs(myAtt);
        }
      } catch (err) {
        console.error('Failed to load student analytics:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Compute student risk row using the stakeholder-validated formula
  const riskRow: StudentRiskRow | null = useMemo(() => {
    if (!user) return null;
    const rows = computeStudentRiskRows([user], grades, attendanceLogs);
    return rows[0] || null;
  }, [user, grades, attendanceLogs]);

  // Dynamic Risk Card config matching StudentHome.tsx
  const studentRiskTier = riskRow?.riskTier || 'Low';
  const riskConfig = useMemo(() => {
    switch (studentRiskTier.toLowerCase()) {
      case 'high':
        return {
          containerClass: 'risk-card-high border-risk-high',
          iconColor: 'text-risk-high',
          valueColor: 'text-risk-high',
          text: 'HIGH',
          Icon: ShieldAlert,
        };
      case 'medium':
      case 'moderate':
        return {
          containerClass: 'risk-card-medium border-risk-medium',
          iconColor: 'text-risk-medium',
          valueColor: 'text-risk-medium',
          text: 'MEDIUM',
          Icon: AlertCircle,
        };
      case 'low':
      default:
        return {
          containerClass: 'risk-card-low border-risk-low',
          iconColor: 'text-risk-low',
          valueColor: 'text-risk-low',
          text: 'LOW',
          Icon: CheckCircle,
        };
    }
  }, [studentRiskTier]);

  // Attendance metrics
  const attendanceMetrics = useMemo(() => {
    const total = attendanceLogs.length;
    if (total === 0) return { rate: 100, present: 0, late: 0, absent: 0, total: 0 };
    const present = attendanceLogs.filter((a) => a.status === 'present').length;
    const late = attendanceLogs.filter((a) => a.status === 'late').length;
    const absent = attendanceLogs.filter((a) => a.status === 'absent').length;
    const rate = ((present + late) / total) * 100;
    return { rate, present, late, absent, total };
  }, [attendanceLogs]);

  // Score metrics
  const scoreMetrics = useMemo(() => {
    const total = grades.length;
    if (total === 0) return { avg: 100, passed: 0, failed: 0, total: 0, activities: 0, milestones: 0 };
    let sumPct = 0;
    let passed = 0;
    let activities = 0;
    let milestones = 0;

    grades.forEach((g) => {
      const max = g.total_score || 100;
      const pct = max > 0 ? (g.score / max) * 100 : 0;
      sumPct += pct;
      if (pct >= 70) passed++;
      if (g.component_type === 'assessment' || (g as any).period) milestones++;
      else activities++;
    });

    const avg = sumPct / total;
    const failed = total - passed;
    return { avg, passed, failed, total, activities, milestones };
  }, [grades]);

  // Trend points generation (Day / Week / Month)
  const trendPoints: TrendPoint[] = useMemo(() => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const formatDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    let periods: { start: Date; end: Date; label: string; dateRange: string }[];

    if (trendFilter === 'day') {
      const schoolDays = getRecentSchoolWeekdays(10, now);
      periods = schoolDays.map((d) => {
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
        return { start, end, label: formatDate(start), dateRange: start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) };
      });
    } else if (trendFilter === 'month') {
      const count = 6;
      periods = Array.from({ length: count }, (_, idx) => {
        const offset = count - 1 - idx;
        const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
        return {
          start,
          end,
          label: start.toLocaleDateString(undefined, { month: 'short' }),
          dateRange: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        };
      });
    } else {
      // week
      const count = 6;
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayOfWeek = now.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const currentWeekMon = new Date(startOfToday.getTime() + diffToMon * dayMs);

      periods = Array.from({ length: count }, (_, idx) => {
        const offset = count - 1 - idx;
        const start = new Date(currentWeekMon.getTime() - offset * 7 * dayMs);
        const fri = new Date(start.getTime() + 4 * dayMs);
        const end = new Date(start.getTime() + 5 * dayMs);
        return {
          start,
          end,
          label: `${formatDate(start)}`,
          dateRange: `${formatDate(start)} – ${formatDate(fri)}`,
        };
      });
    }

    return periods.map((p) => {
      // Filter attendance in period
      const attInPeriod = attendanceLogs.filter((a) => {
        if (!a.date) return false;
        const d = new Date(`${a.date}T00:00:00`);
        return d >= p.start && d < p.end;
      });
      const attRate =
        attInPeriod.length > 0
          ? (attInPeriod.filter((a) => a.status === 'present' || a.status === 'late').length / attInPeriod.length) * 100
          : 100;

      // Filter grades in period
      const gradesInPeriod = grades.filter((g) => {
        const dStr = g.date_logged || g.created_at;
        if (!dStr) return false;
        const d = new Date(dStr.slice(0, 10) + 'T00:00:00');
        return d >= p.start && d < p.end;
      });
      const scoreRate =
        gradesInPeriod.length > 0
          ? gradesInPeriod.reduce((acc, g) => acc + (g.score / (g.total_score || 100)) * 100, 0) / gradesInPeriod.length
          : 85;

      const composite = attRate * 0.4 + scoreRate * 0.6;

      return {
        label: p.label,
        dateRange: p.dateRange,
        compositeValue: composite,
        attendanceValue: attRate,
        scoreValue: scoreRate,
      };
    });
  }, [trendFilter, attendanceLogs, grades]);

  const studentFirstName = user?.first_name || user?.full_name?.trim().split(' ')[0] || 'Student';

  if (loading) {
    return (
      <div className="space-y-6 skeleton-container">
        {/* Tabs skeleton */}
        <div className="flex bg-gray-100 dark:bg-[#111111] rounded-2xl p-1 w-fit gap-1 animate-pulse">
          <div className="h-8 w-36 rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 w-36 rounded-xl bg-transparent" />
          <div className="h-8 w-32 rounded-xl bg-transparent" />
        </div>

        {/* 4 KPI Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 skeleton-row-1">
          {[1, 2, 3, 4].map((i) => (
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

        {/* Trend Curve Card skeleton */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl p-6 shadow-sm flex flex-col min-h-[26rem] animate-pulse skeleton-row-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div>
              <div className="h-4 w-64 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-40 rounded bg-gray-100 dark:bg-gray-800/80 mt-1.5" />
            </div>
            <div className="h-8 w-36 rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="flex-1 mt-6 rounded-2xl bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gray-200/50 dark:bg-gray-800/50" />
          </div>
        </div>

        {/* Split Bottom cards skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 skeleton-row-3">
          <div className="lg:col-span-6 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl p-6 shadow-sm space-y-4 animate-pulse">
            <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="space-y-3 pt-2">
              <div className="h-2.5 rounded bg-gray-100 dark:bg-gray-800 w-full" />
              <div className="h-2.5 rounded bg-gray-100 dark:bg-gray-800 w-full" />
              <div className="h-2.5 rounded bg-gray-100 dark:bg-gray-800 w-full" />
            </div>
          </div>
          <div className="lg:col-span-6 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl p-6 shadow-sm space-y-4 animate-pulse">
            <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              {[1, 2, 3, 4].map((k) => (
                <div key={k} className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800/70" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Tabs Navigation ─────────────────────────────────────────── */}
      <div className="flex bg-gray-100 dark:bg-[#111111] rounded-2xl p-1 w-fit gap-1 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('overall')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'overall'
              ? 'bg-white dark:bg-[#1C1C1C] text-gray-900 dark:text-slate-100 shadow-sm'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-slate-200'
          }`}
        >
          Overall Performance
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-white dark:bg-[#1C1C1C] text-gray-900 dark:text-slate-100 shadow-sm'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-slate-200'
          }`}
        >
          Attendance Analytics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('score')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'score'
              ? 'bg-white dark:bg-[#1C1C1C] text-gray-900 dark:text-slate-100 shadow-sm'
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-slate-200'
          }`}
        >
          Score Analytics
        </button>
      </div>

      {/* ── Top KPI Stat Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Composite Rating */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[var(--brand)] dark:text-sky-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Composite Rating</p>
            <p className="text-xl font-extrabold text-[var(--brand)] dark:text-sky-400 mt-0.5">
              {riskRow ? `${smartPct(riskRow.compositeScore)}%` : '—'}
            </p>
          </div>
        </div>

        {/* Attendance Consistency */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Attendance Rate</p>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {smartPct(attendanceMetrics.rate)}%
            </p>
          </div>
        </div>

        {/* Score Average */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Average Score</p>
            <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">
              {smartPct(scoreMetrics.avg)}%
            </p>
          </div>
        </div>

        {/* Dynamic Risk Level */}
        <div
          className={`border rounded-2xl p-4 flex items-center gap-3.5 shadow-sm transition-all duration-300 ${riskConfig.containerClass}`}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${riskConfig.iconColor}`}>
            <riskConfig.Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
              {studentFirstName}'s Risk Level
            </p>
            <p className={`text-xl font-extrabold mt-0.5 ${riskConfig.valueColor}`}>
              {riskConfig.text}
            </p>
          </div>
        </div>
      </div>

      {/* ── Interactive Trend Curve ────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl p-6 shadow-sm flex flex-col min-h-[26rem]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {activeTab === 'overall'
                ? `${studentFirstName}'S PERFORMANCE TREND CHART`
                : activeTab === 'attendance'
                ? 'Attendance Consistency Trend'
                : 'Assessment Score Trend'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {trendFilter === 'day' ? 'Daily School Weekdays' : trendFilter === 'month' ? 'Monthly Timeline' : 'Weekly Periods'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-1 gap-0.5">
              {(['day', 'week', 'month'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTrendFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                    trendFilter === filter
                      ? 'bg-[var(--brand)] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 mt-4">
          <InteractiveStudentTrendChart
            data={trendPoints}
            metric={activeTab === 'overall' ? 'composite' : activeTab === 'attendance' ? 'attendance' : 'score'}
          />
        </div>
      </div>

      {/* ── Tab Specific Content ───────────────────────────────────── */}
      {activeTab === 'overall' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Academic Weight Contribution (Stakeholder Validated 30/50/20 Breakdown) */}
          <div className="lg:col-span-6 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
              <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100">Evaluation Component Weights</h4>
              <span className="text-xs font-semibold text-[var(--brand)] dark:text-sky-400">ARAL Standard</span>
            </div>

            <div className="mt-5 space-y-4">
              {/* Quarterly Assessment: 50% */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-gray-700 dark:text-slate-300">Quarterly Assessment (BOSY/MOSY/EOSY)</span>
                  <span className="font-extrabold text-[var(--brand)]">50% Weight</span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 dark:bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--brand)] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, scoreMetrics.avg)}%` }}
                  />
                </div>
              </div>

              {/* Weekly Tasks: 30% */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-gray-700 dark:text-slate-300">Weekly Activities & Tasks</span>
                  <span className="font-extrabold text-sky-500">30% Weight</span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 dark:bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, scoreMetrics.avg)}%` }}
                  />
                </div>
              </div>

              {/* Attendance: 20% */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-gray-700 dark:text-slate-300">Attendance & Participation</span>
                  <span className="font-extrabold text-emerald-500">20% Weight</span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 dark:bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, attendanceMetrics.rate)}%` }}
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-5 pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
              Your composite score is computed using the validated 30% weekly tasks, 50% quarterly milestones, and 20% attendance model.
            </p>
          </div>

          {/* Academic Profile & Summary */}
          <div className="lg:col-span-6 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
                <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100">Learning Summary</h4>
                <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">Current Academic Year</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">ARAL Level</p>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100 mt-0.5 capitalize">
                    {user?.aral_level || 'Basic'}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Assigned Subject</p>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">
                    {user?.subject || 'Reading'}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Total Scans</p>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">
                    {attendanceMetrics.total} Sessions
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">Tests Completed</p>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">
                    {scoreMetrics.total} Items
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between text-xs text-gray-400 dark:text-slate-500">
              <span>LRN: {user?.lrn || '—'}</span>
              <span>Keep up the consistent effort!</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
            <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100">Attendance Logged Breakdown</h4>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {attendanceMetrics.present} of {attendanceMetrics.total} Present
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Present</p>
              <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">{attendanceMetrics.present}</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-0.5">On time arrivals</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Late</p>
              <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-1">{attendanceMetrics.late}</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">Arrivals after schedule</p>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40">
              <p className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">Absent</p>
              <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-400 mt-1">{attendanceMetrics.absent}</p>
              <p className="text-[11px] text-rose-600 dark:text-rose-500 mt-0.5">Unexcused missed sessions</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'score' && (
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
            <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100">Assessment Mastery Breakdown</h4>
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
              {scoreMetrics.passed} of {scoreMetrics.total} Passed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Passed (70%+)</p>
              <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">{scoreMetrics.passed}</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-0.5">Met ARAL mastery benchmark</p>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40">
              <p className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">Needs Support (&lt;70%)</p>
              <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-400 mt-1">{scoreMetrics.failed}</p>
              <p className="text-[11px] text-rose-600 dark:text-rose-500 mt-0.5">Benefiting from tutor guidance</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAnalytics;
