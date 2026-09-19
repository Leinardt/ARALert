import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';
import {
  AlertCircle,
  Smile,
  Meh,
  Frown,
  Info,
  Users,
} from 'lucide-react';
import type { Attendance, Grade, User } from '../../types';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';

/* ─── Types & Helpers ─────────────────────────────────────────── */

type TrendFilter = 'day' | 'week' | 'month';

interface RiskTrendPoint {
  dateKey: string;
  label: string;
  high: number;
  medium: number;
  low: number;
}

interface PerformanceRow {
  student: User;
  aral_level: string;
  attendanceRate: number;
  scoreAvg: number;
  compositeScore: number;
  riskTier: string;
}

/** Show up to 2 decimal places but trim trailing zeros (100.00 → 100, 99.5 → 99.5) */
const smartPct = (n: number): string => parseFloat(n.toFixed(2)).toString();

const getTierCls = (tier: string) => {
  switch (tier) {
    case 'Low':
      return 'badge-risk-low';
    case 'Medium':
      return 'badge-risk-medium';
    default:
      return 'badge-risk-high';
  }
};


const getAttendanceRateCls = (rate: number) => {
  if (rate >= 81) return 'text-risk-low text-emerald-600 dark:text-emerald-400 font-semibold';
  if (rate >= 75) return 'text-risk-medium text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-risk-high text-rose-600 dark:text-rose-400 font-semibold';
};

const getScoreAvgCls = (score: number) => {
  if (score >= 81) return 'text-risk-low text-emerald-600 dark:text-emerald-400 font-semibold';
  if (score >= 70) return 'text-risk-medium text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-risk-high text-rose-600 dark:text-rose-400 font-semibold';
};

const getCompositeScoreCls = (tier: string) => {
  if (tier === 'High') return 'text-risk-high text-rose-600 dark:text-rose-400 font-semibold';
  if (tier === 'Medium') return 'text-risk-medium text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-risk-low text-emerald-600 dark:text-emerald-400 font-semibold';
};

const RiskRangeInfo: React.FC<{ range: string }> = ({ range }) => (
  <span className="group relative inline-flex">
    <button
      type="button"
      aria-label={`Show ${range} risk range`}
      className="cursor-pointer inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 opacity-80 transition hover:bg-black/5 hover:text-gray-600 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
    >
      <Info className="h-3.5 w-3.5" />
    </button>
    <span className="pointer-events-none absolute right-full top-1/2 z-20 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover:block group-focus-within:block">
      {range}
    </span>
  </span>
);

const RiskCalculationInfo: React.FC = () => (
  <span className="group relative inline-flex items-center gap-2 rounded-full transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5">
    <button
      type="button"
      aria-label="Show how risk is calculated"
      className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 outline-none"
    >
      HOW RISK LEVEL IS CALCULATED
    </button>
    <button
      type="button"
      aria-label="Show how risk is calculated"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 dark:text-slate-400 opacity-70 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
    >
      <Info className="h-3.5 w-3.5" />
    </button>
    <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-max max-w-[calc(100vw-2rem)] -translate-y-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-left text-xs font-semibold leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block">
      Risk level is calculated from the composite score of a student. Composite Score = 40% (Attendance Rate) + 60% (Average Score)
    </span>
  </span>
);

/* ─── Risk Trend Builders & Stacked Bar Chart Component ───────────── */

const buildRiskTrendPoints = (
  students: User[],
  grades: Grade[],
  attendanceLogs: Attendance[],
  filter: TrendFilter
): RiskTrendPoint[] => {
  const studentIds = new Set(students.map((student) => String(student.id)));
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  let periods: { start: Date; end: Date; label: string; dateKey: string }[];
  if (filter === 'day') {
    const schoolDays = getRecentSchoolWeekdays(10, now);
    periods = schoolDays.map((d) => {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
      return { start, end, label: formatDate(start), dateKey: start.toISOString().slice(0, 10) };
    });
  } else {
    const periodCount = 6;
    periods = Array.from({ length: periodCount }, (_, index) => {
      const offset = periodCount - 1 - index;
      let start: Date;
      let end: Date;
      let label: string;
      if (filter === 'month') {
        start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
        label = start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      } else {
        const dayOfWeek = now.getDay();
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const currentWeekMon = new Date(startOfToday.getTime() + diffToMon * dayMs);
        start = new Date(currentWeekMon.getTime() - offset * 7 * dayMs);
        const fri = new Date(start.getTime() + 4 * dayMs);
        end = new Date(start.getTime() + 5 * dayMs);
        label = `${formatDate(start)} – ${formatDate(fri)}`;
      }
      return { start, end, label, dateKey: start.toISOString().slice(0, 10) };
    });
  }

  const points = periods.map((period) => {
    const periodGrades = grades.filter((grade) => (
      studentIds.has(String(grade.student))
      && (grade.date_logged || grade.created_at)
      && new Date(`${(grade.date_logged || grade.created_at || '').slice(0, 10)}T00:00:00`) < period.end
    ));
    const periodAttendance = attendanceLogs.filter((log) => (
      studentIds.has(String(log.user))
      && log.date
      && new Date(`${log.date.slice(0, 10)}T00:00:00`) < period.end
    ));
    if (periodGrades.length === 0 && periodAttendance.length === 0) return { period, point: null };
    const snapshot = computeStudentRiskRows(students, periodGrades, periodAttendance);
    return {
      period,
      point: {
        dateKey: period.dateKey,
        label: period.label,
        high: snapshot.filter((row) => row.riskTier === 'High').length,
        medium: snapshot.filter((row) => row.riskTier === 'Medium').length,
        low: snapshot.filter((row) => row.riskTier === 'Low').length,
      },
    };
  });

  const firstRecordedPoint = points.find(({ point }) => point !== null)?.point;
  if (!firstRecordedPoint) {
    const snapshot = computeStudentRiskRows(students, [], []);
    const defaultPoint = {
      high: snapshot.filter((row) => row.riskTier === 'High').length,
      medium: snapshot.filter((row) => row.riskTier === 'Medium').length,
      low: snapshot.filter((row) => row.riskTier === 'Low').length,
    };
    return periods.map((period) => ({
      dateKey: period.dateKey,
      label: period.label,
      ...defaultPoint,
    }));
  }
  let lastPoint = firstRecordedPoint;
  return points.map(({ period, point }) => {
    if (point) {
      lastPoint = point;
      return point;
    }
    return { dateKey: period.dateKey, label: period.label, high: lastPoint.high, medium: lastPoint.medium, low: lastPoint.low };
  });
};

const RiskTrendChart: React.FC<{
  data: RiskTrendPoint[];
  total: number;
  isSingleStudent: boolean;
  studentName?: string;
}> = ({ data, total, isSingleStudent, studentName }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const width = 800;
  const height = 160;
  const paddingLeft = 48;
  const paddingRight = 6;
  const paddingTop = 15;
  const paddingBottom = 28;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = isSingleStudent ? 1 : Math.max(5, Math.ceil(total / 5) * 5);
  const axisSteps = isSingleStudent
    ? [0, 1]
    : Array.from({ length: maxValue / 5 + 1 }, (_, index) => index * 5);
  const series = [
    { key: 'high' as const, color: '#EF4444', label: 'High Risk' },
    { key: 'medium' as const, color: '#F59E0B', label: 'Medium Risk' },
    { key: 'low' as const, color: '#22C55E', label: 'Low Risk' },
  ];
  const barWidth = Math.max(18, Math.min(72, (chartWidth / data.length) * 0.65));
  const getBarX = (index: number) => paddingLeft + barWidth / 2 + (index * (chartWidth - barWidth)) / (data.length - 1 || 1);

  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-xs text-gray-400 dark:text-slate-500">
        No risk trend data
      </div>
    );
  }

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-52 w-full overflow-visible"
        role="img"
        aria-label="Risk level trend chart"
      >
        {axisSteps.map((value) => {
          const y = paddingTop + chartHeight - (value / maxValue) * chartHeight;
          return (
            <g key={value}>
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
                x={paddingLeft - 12}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 font-semibold text-[8px]"
              >
                {value}
              </text>
            </g>
          );
        })}
        {data.map((point, index) => {
          const x = getBarX(index);
          let currentBottom = paddingTop + chartHeight;
          const bars = [...series].reverse().map((item) => {
            const barHeight = (point[item.key] / maxValue) * chartHeight;
            currentBottom -= barHeight;
            return (
              <rect
                key={item.key}
                x={x - barWidth / 2}
                y={currentBottom}
                width={barWidth}
                height={barHeight}
                fill={item.color}
                fillOpacity="0.82"
                stroke="white"
                strokeWidth="1.25"
                strokeOpacity="0.8"
              />
            );
          });
          return (
            <g
              key={point.dateKey}
              onMouseEnter={() => setHoveredIdx(index)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <text x={x} y={height - 4} textAnchor="middle" className="fill-slate-500 font-semibold text-[8px]">
                {point.label}
              </text>
              {bars}
              <rect
                x={x - barWidth / 2}
                y={paddingTop}
                width={barWidth}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
              />
            </g>
          );
        })}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <rect
            x={getBarX(hoveredIdx) - barWidth / 2}
            y={paddingTop}
            width={barWidth}
            height={chartHeight}
            fill="none"
            stroke="#0052B7"
            strokeWidth="1.5"
            opacity="0.8"
          />
        )}
      </svg>
      {hoveredIdx !== null && data[hoveredIdx] && (() => {
        const barX = getBarX(hoveredIdx);
        const barLeftPct = ((barX - barWidth / 2) / width) * 100;
        const barRightPct = ((barX + barWidth / 2) / width) * 100;
        const isNearRight = barRightPct > 75;
        const gapPx = 14;

        return (
          <div
            className="pointer-events-none absolute z-10 min-w-[150px] max-w-[260px] rounded-xl border border-slate-700/50 bg-slate-900/95 p-3 text-left text-[11px] leading-normal text-white shadow-xl backdrop-blur-xs"
            style={{
              left: isNearRight ? `calc(${barLeftPct}% - ${gapPx}px)` : `calc(${barRightPct}% + ${gapPx}px)`,
              top: '50%',
              transform: isNearRight ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase text-slate-300">{data[hoveredIdx].label}</span>
              {isSingleStudent && studentName && (
                <span className="text-[9.5px] font-semibold text-slate-300 truncate max-w-[140px]" title={studentName}>
                  {studentName}
                </span>
              )}
            </div>
            {series.map((item) => (
              <div key={item.key} className="mt-1 flex items-center justify-between gap-4">
                <span style={{ color: item.color }}>{item.label}</span>
                <span className="font-bold">{data[hoveredIdx][item.key]}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

/* ─── Main StudentAnalytics Component ─────────────────────────── */

export const StudentAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('week');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Student Records
  const fetchStudentData = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const [gradesData, attData] = await Promise.all([
        academicService.getGrades({ student_id: String(user.id) }),
        academicService.getAttendanceHistory({ user_id: user.id }),
      ]);

      const myGrades = Array.isArray(gradesData)
        ? gradesData.filter((g) => String(g.student) === String(user.id))
        : [];
      const myAtt = Array.isArray(attData)
        ? attData.filter((a) => String(a.user) === String(user.id))
        : [];

      setGrades(myGrades);
      setAttendanceLogs(myAtt);
    } catch (err: any) {
      console.error('Failed to load student analytics:', err);
      setError(err?.response?.data?.detail || 'Failed to load student analytics data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [user]);

  // Compute student risk row using the stakeholder-validated 30/50/20 formula
  const riskRow: StudentRiskRow | null = useMemo(() => {
    if (!user) return null;
    const rows = computeStudentRiskRows([user], grades, attendanceLogs);
    return rows[0] || null;
  }, [user, grades, attendanceLogs]);

  const studentRiskTier = riskRow?.riskTier || 'Low';

  // ── Risk Trend Points Generation (Specific to this student) ─────────

  const riskTrend = useMemo(() => {
    if (!user) return [];
    return buildRiskTrendPoints([user], grades, attendanceLogs, trendFilter);
  }, [user, grades, attendanceLogs, trendFilter]);

  // ── Performance Details Table Rows ──────────────────────────────────

  const performanceRows: PerformanceRow[] = useMemo(() => {
    if (!user || !riskRow) return [];
    return [
      {
        student: user,
        aral_level: user.aral_level || 'basic',
        attendanceRate: riskRow.attendanceRate,
        scoreAvg: riskRow.scoreAvg,
        compositeScore: riskRow.compositeScore,
        riskTier: riskRow.riskTier,
      },
    ];
  }, [user, riskRow]);

  const studentFirstName = user?.first_name || user?.full_name?.trim().split(' ')[0] || 'Student';

  // ── Loading Skeleton ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="space-y-6 skeleton-container"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        {/* 3 Summary KPI Cards Skeleton */}
        <div className="grid gap-4 sm:grid-cols-3 skeleton-row-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 shadow-sm min-h-[114px] flex items-center gap-4 animate-pulse"
            >
              <div className="w-11 h-11 rounded-2xl bg-gray-200 dark:bg-gray-800 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
                <div className="h-7 w-16 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-2.5 w-36 rounded bg-gray-100 dark:bg-gray-800/60 mt-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Chart Card Skeleton */}
        <div className="w-full rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-6 shadow-sm animate-pulse skeleton-row-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1.5">
              <div className="h-4 w-52 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-40 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-28 rounded-xl bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
          <div className="mt-6">
            <div className="h-52 w-full rounded-2xl bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A]" />
          </div>
        </div>

        {/* Bottom Table Skeleton */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl p-6 shadow-sm space-y-4 animate-pulse">
          <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((k) => (
              <div key={k} className="h-12 rounded-2xl bg-gray-100 dark:bg-gray-800/70" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error View ──────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-2xl p-5 shadow-sm">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load analytics</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={fetchStudentData}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 data-loaded-content"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── 3 Risk Level Summary Cards (Active is colored, others inactive gray) ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* 1. HIGH RISK CARD */}
        <div
          className={`relative rounded-3xl border p-5 shadow-sm min-h-[114px] flex items-center gap-4 transition-all duration-300 ${
            studentRiskTier === 'High'
              ? 'risk-card-high'
              : 'border-gray-200 bg-gray-50/70 dark:border-[#1A1A1A] dark:bg-[#0A0A0A] opacity-60'
          }`}
        >
          <div className="absolute right-4 top-4">
            <RiskRangeInfo range="Composite score is below 70%" />
          </div>
          <div
            className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
              studentRiskTier === 'High'
                ? 'risk-badge-high'
                : 'bg-gray-100 dark:bg-[#1A1A1A] border-gray-200 dark:border-[#262626]'
            }`}
          >
            <Frown
              className={`w-5 h-5 ${
                studentRiskTier === 'High'
                  ? 'text-risk-high'
                  : 'text-gray-400 dark:text-slate-500'
              }`}
            />
          </div>
          <div className="min-w-0">
            {studentRiskTier === 'High' && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-white truncate">
                {studentFirstName}'S RISK LEVEL
              </p>
            )}
            <p
              className={`text-2xl font-extrabold mt-0.5 ${
                studentRiskTier === 'High'
                  ? 'text-risk-high'
                  : 'text-gray-400 dark:text-slate-500'
              }`}
            >
              HIGH RISK
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-slate-300">
              Students needing immediate intervention
            </p>
          </div>
        </div>

        {/* 2. MEDIUM RISK CARD */}
        <div
          className={`relative rounded-3xl border p-5 shadow-sm min-h-[114px] flex items-center gap-4 transition-all duration-300 ${
            studentRiskTier === 'Medium'
              ? 'risk-card-medium'
              : 'border-gray-200 bg-gray-50/70 dark:border-[#1A1A1A] dark:bg-[#0A0A0A] opacity-60'
          }`}
        >
          <div className="absolute right-4 top-4">
            <RiskRangeInfo range="Composite score is between 70% to 85%" />
          </div>
          <div
            className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
              studentRiskTier === 'Medium'
                ? 'risk-badge-medium'
                : 'bg-gray-100 dark:bg-[#1A1A1A] border-gray-200 dark:border-[#262626]'
            }`}
          >
            <Meh
              className={`w-5 h-5 ${
                studentRiskTier === 'Medium'
                  ? 'text-risk-medium'
                  : 'text-gray-400 dark:text-slate-500'
              }`}
            />
          </div>
          <div className="min-w-0">
            {studentRiskTier === 'Medium' && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-white truncate">
                {studentFirstName}'S RISK LEVEL
              </p>
            )}
            <p
              className={`text-2xl font-extrabold mt-0.5 ${
                studentRiskTier === 'Medium'
                  ? 'text-risk-medium'
                  : 'text-gray-400 dark:text-slate-500'
              }`}
            >
              MEDIUM RISK
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-slate-300">
              Students requiring monitoring
            </p>
          </div>
        </div>

        {/* 3. LOW RISK CARD */}
        <div
          className={`relative rounded-3xl border p-5 shadow-sm min-h-[114px] flex items-center gap-4 transition-all duration-300 ${
            studentRiskTier === 'Low'
              ? 'risk-card-low'
              : 'border-gray-200 bg-gray-50/70 dark:border-[#1A1A1A] dark:bg-[#0A0A0A] opacity-60'
          }`}
        >
          <div className="absolute right-4 top-4">
            <RiskRangeInfo range="Composite score is between 86% to 100%" />
          </div>
          <div
            className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
              studentRiskTier === 'Low'
                ? 'risk-badge-low'
                : 'bg-gray-100 dark:bg-[#1A1A1A] border-gray-200 dark:border-[#262626]'
            }`}
          >
            <Smile
              className={`w-5 h-5 ${
                studentRiskTier === 'Low'
                  ? 'text-risk-low'
                  : 'text-gray-400 dark:text-slate-500'
              }`}
            />
          </div>
          <div className="min-w-0">
            {studentRiskTier === 'Low' && (
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-white truncate">
                {studentFirstName}'S RISK LEVEL
              </p>
            )}
            <p
              className={`text-2xl font-extrabold mt-0.5 ${
                studentRiskTier === 'Low'
                  ? 'text-risk-low'
                  : 'text-gray-400 dark:text-slate-500'
              }`}
            >
              LOW RISK
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-slate-300">
              Students performing well
            </p>
          </div>
        </div>
      </div>

      {/* ── Risk Level Trend Chart ── */}
      <section
        className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#1A1A1A] dark:bg-[#0A0A0A]"
        aria-labelledby="risk-overview-heading"
      >
        <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
          <div>
            <h3
              id="risk-overview-heading"
              className="text-sm font-bold uppercase text-gray-900 dark:text-slate-100"
            >
              RISK LEVEL TREND CHART
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full shadow-xs" style={{ backgroundColor: '#EF4444' }} />
                High Risk
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full shadow-xs" style={{ backgroundColor: '#F59E0B' }} />
                Medium Risk
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full shadow-xs" style={{ backgroundColor: '#22C55E' }} />
                Low Risk
              </span>
            </div>
            <div
              className="flex items-center gap-1 rounded-xl bg-gray-100 p-0.5 dark:bg-[#111111]"
              role="group"
              aria-label="Filter risk chart by time period"
            >
              {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTrendFilter(filter)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all ${
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

        <div className="mt-6">
          <div className="relative rounded-2xl border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
            <RiskTrendChart
              data={riskTrend}
              total={1}
              isSingleStudent={true}
              studentName={user?.full_name || studentFirstName}
            />
          </div>
        </div>
      </section>

      {/* ── Student Performance Details Table (Replaces Component Weights) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1 pb-1 text-xs text-gray-500" style={{ fontFamily: 'var(--font-body)' }}>
          <RiskCalculationInfo />
        </div>
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 uppercase">
              {studentFirstName}'S PERFORMANCE DETAILS
            </h3>
          </div>

          {performanceRows.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Users className="w-10 h-10 mx-auto text-gray-200 dark:text-gray-700" />
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm font-normal w-full" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                <thead>
                  <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">STUDENT</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">AVERAGE ATTENDANCE RATE</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">AVERAGE SCORE</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">COMPOSITE SCORE</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">RISK LEVEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                  {performanceRows.map((row) => (
                    <tr key={row.student.id} className="divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-white/5">
                      <td className="px-4 py-3.5 align-middle">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-slate-100">{row.student.full_name}</div>
                          <div className="text-xs text-gray-400 dark:text-slate-500 font-mono">LRN: {row.student.lrn || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className={`text-sm font-normal ${getAttendanceRateCls(row.attendanceRate)}`}>
                          {smartPct(row.attendanceRate)}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className={`text-sm font-normal ${getScoreAvgCls(row.scoreAvg)}`}>
                          {smartPct(row.scoreAvg)}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className={`text-sm font-normal ${getCompositeScoreCls(row.riskTier)}`}>
                          {smartPct(row.compositeScore)}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold border ${getTierCls(row.riskTier)}`}>
                          {row.riskTier}
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
    </div>
  );
};

export default StudentAnalytics;
