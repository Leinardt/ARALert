import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';
import {
  Search,
  ArrowUpDown,
  Check,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Users,
  Info,
  X,
  Smile,
  Meh,
  Frown,

} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Attendance, Grade, User } from '../../types';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';
import {
  type EntryDescriptionType,
  type MilestoneType,
  getScoreDescription,
  getAttendanceDescription,
  getTutorAssignedMilestone,
} from '../../utils/sessionDescriptionHelpers';
import { matchesSearch } from '../../utils/searchHelpers';

interface ExtendedRiskRow extends StudentRiskRow {
  absentCount: number;
}

interface TrendPoint {
  dateKey: string;
  label: string;
  value: number;
}

type TrendFilter = 'day' | 'week' | 'month';
type AnalyticsTab = 'overall' | 'attendance' | 'score';
type RiskScope = 'all' | string;
type AttendanceDetailSortField = 'student' | 'aralLevel' | 'description' | 'present' | 'absent' | 'attendanceAverage';
type ScoreDetailSortField = 'student' | 'aralLevel' | 'description' | 'passed' | 'failed' | 'scoreAverage';

interface RiskTrendPoint {
  dateKey: string;
  label: string;
  high: number;
  medium: number;
  low: number;
}

const buildTrendPoints = (
  students: User[],
  grades: Grade[],
  attendanceLogs: Attendance[],
  metric: 'attendance' | 'score',
  filter: TrendFilter
): TrendPoint[] => {
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
    let point: TrendPoint | null = null;
    if (metric === 'attendance') {
      const records = attendanceLogs.filter((log) => {
        if (!studentIds.has(String(log.user)) || !log.date) return false;
        const date = new Date(`${log.date.slice(0, 10)}T00:00:00`);
        return date >= period.start && date < period.end;
      });
      if (records.length === 0) return { period, point };
      const attended = records.filter((log) => log.status === 'present').length;
      point = { dateKey: period.dateKey, label: period.label, value: Math.round((attended / records.length) * 100) };
      return { period, point };
    }

    const scoreRecords = grades.filter((grade) => (
      studentIds.has(String(grade.student))
      && grade.component_type !== 'attendance'
      && grade.date_logged
      && new Date(`${grade.date_logged.slice(0, 10)}T00:00:00`) >= period.start
      && new Date(`${grade.date_logged.slice(0, 10)}T00:00:00`) < period.end
    ));
    if (scoreRecords.length === 0) return { period, point };
    const average = scoreRecords.reduce((total, grade) => {
      const totalScore = Number(grade.total_score) || 100;
      return total + (Number(grade.score) / totalScore) * 100;
    }, 0) / scoreRecords.length;
    point = { dateKey: period.dateKey, label: period.label, value: Math.round(Math.min(Math.max(average, 0), 100)) };
    return { period, point };
  });

  const firstRecordedPoint = points.find(({ point }) => point !== null)?.point;
  if (!firstRecordedPoint) return [];

  let lastValue = firstRecordedPoint.value;
  return points.map(({ period, point }) => {
    if (point) {
      lastValue = point.value;
      return point;
    }
    return { dateKey: period.dateKey, label: period.label, value: lastValue };
  });
};

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
      && grade.date_logged
      && new Date(`${grade.date_logged.slice(0, 10)}T00:00:00`) < period.end
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
  if (!firstRecordedPoint) return [];
  let lastPoint = firstRecordedPoint;
  return points.map(({ period, point }) => {
    if (point) {
      lastPoint = point;
      return point;
    }
    return { dateKey: period.dateKey, label: period.label, high: lastPoint.high, medium: lastPoint.medium, low: lastPoint.low };
  });
};

const TrendChart: React.FC<{ data: TrendPoint[]; color: string; emptyLabel: string; valueLabel?: string }> = ({ data, color, emptyLabel, valueLabel = 'Class Average' }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const width = 800;
  const height = 160;
  const paddingLeft = 48;
  const paddingRight = 16;
  const paddingTop = 15;
  const paddingBottom = 28;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const points = data.map((point, index) => ({
    ...point,
    x: paddingLeft + (index * chartWidth) / (data.length - 1 || 1),
    y: paddingTop + chartHeight - (point.value / 100) * chartHeight,
  }));
  let path = '';
  if (points.length > 0) {
    path = `M ${points[0].x} ${points[0].y}`;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const controlOffset = (current.x - previous.x) / 3;
      path += ` C ${previous.x + controlOffset} ${previous.y}, ${current.x - controlOffset} ${current.y}, ${current.x} ${current.y}`;
    }
  }
  const areaPath = points.length > 0
    ? `${path} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  if (data.length === 0) return <div className="flex h-52 items-center justify-center text-xs text-gray-400 dark:text-slate-500">{emptyLabel}</div>;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-52 w-full overflow-visible" role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id="riskChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
          <filter id="riskChartGlow" x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 25, 50, 75, 100].map((value) => {
          const y = paddingTop + chartHeight - (value / 100) * chartHeight;
          return (
            <g key={value}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="var(--slate-200)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6" />
              <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="fill-slate-400 font-semibold text-[8px]">{value}%</text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#riskChartFill)" />
        <path d={path} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" filter="url(#riskChartGlow)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.dateKey}>
            <title>{`${point.label}: ${point.value}%`}</title>
            <circle cx={point.x} cy={point.y} r="3.5" fill={color} stroke="#DCFCE7" strokeWidth="1.5" />
            <text x={point.x} y={height - 4} textAnchor="middle" className="fill-slate-500 font-semibold text-[8px]">{point.label}</text>
          </g>
        ))}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line x1={points[hoveredIdx].x} y1={paddingTop} x2={points[hoveredIdx].x} y2={paddingTop + chartHeight} stroke={color} strokeWidth="1.5" opacity="0.7" />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="4.5" fill={color} />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="8" fill={color} opacity="0.25" />
          </g>
        )}
        {points.map((point, index) => {
          const step = chartWidth / (data.length - 1 || 1);
          const xStart = index === 0 ? paddingLeft : point.x - step / 2;
          const xEnd = index === data.length - 1 ? width - paddingRight : point.x + step / 2;
          return (
            <rect
              key={`hover-${point.dateKey}`}
              x={xStart}
              y={paddingTop}
              width={xEnd - xStart}
              height={chartHeight}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(index)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}
      </svg>
      {hoveredIdx !== null && points[hoveredIdx] && (() => {
        const p = points[hoveredIdx];
        const pointXPct = (p.x / width) * 100;
        const isNearRight = pointXPct > 75;
        const gapPx = 14;
        return (
          <div
            className="pointer-events-none absolute z-10 min-w-[150px] max-w-[260px] rounded-xl border border-slate-700/50 bg-slate-900/95 p-3 text-left text-[11px] leading-normal text-white shadow-xl"
            style={{
              left: isNearRight ? `calc(${pointXPct}% - ${gapPx}px)` : `calc(${pointXPct}% + ${gapPx}px)`,
              top: '50%',
              transform: isNearRight ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
            }}
          >
            <div className="text-[10px] font-extrabold uppercase text-slate-300">{p.label}</div>
            <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-sm font-extrabold" style={{ color }}>{p.value}%</span>
              <span className="text-[10px] font-medium text-slate-300 truncate max-w-[180px]" title={valueLabel}>{valueLabel}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

const RiskTrendChart: React.FC<{ data: RiskTrendPoint[]; total: number; isSingleStudent: boolean; studentName?: string }> = ({ data, total, isSingleStudent, studentName }) => {
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

  if (data.length === 0) return <div className="flex h-52 items-center justify-center text-xs text-gray-400">No risk trend data</div>;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-52 w-full overflow-visible" role="img" aria-label="Risk level trend chart">
        {axisSteps.map((value) => {
          const y = paddingTop + chartHeight - (value / maxValue) * chartHeight;
          return <g key={value}><line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="var(--slate-200)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6" /><text x={paddingLeft - 12} y={y + 3} textAnchor="end" className="fill-slate-400 font-semibold text-[8px]">{value}</text></g>;
        })}
        {data.map((point, index) => {
          const x = getBarX(index);
          let currentBottom = paddingTop + chartHeight;
          const bars = [...series].reverse().map((item) => {
            const barHeight = (point[item.key] / maxValue) * chartHeight;
            currentBottom -= barHeight;
            return <rect key={item.key} x={x - barWidth / 2} y={currentBottom} width={barWidth} height={barHeight} fill={item.color} fillOpacity="0.82" stroke="white" strokeWidth="1.25" strokeOpacity="0.8" />;
          });
          return <g key={point.dateKey} onMouseEnter={() => setHoveredIdx(index)} onMouseLeave={() => setHoveredIdx(null)}><text x={x} y={height - 4} textAnchor="middle" className="fill-slate-500 font-semibold text-[8px]">{point.label}</text>{bars}<rect x={x - barWidth / 2} y={paddingTop} width={barWidth} height={chartHeight} fill="transparent" className="cursor-pointer" /></g>;
        })}
        {hoveredIdx !== null && data[hoveredIdx] && <rect x={getBarX(hoveredIdx) - barWidth / 2} y={paddingTop} width={barWidth} height={chartHeight} fill="none" stroke="#0052B7" strokeWidth="1.5" opacity="0.8" />}
      </svg>
      {hoveredIdx !== null && data[hoveredIdx] && (() => {
        const barX = getBarX(hoveredIdx);
        const barLeftPct = ((barX - barWidth / 2) / width) * 100;
        const barRightPct = ((barX + barWidth / 2) / width) * 100;
        const isNearRight = barRightPct > 75;
        const gapPx = 14;

        return (
          <div
            className="pointer-events-none absolute z-10 min-w-[150px] max-w-[260px] rounded-xl border border-slate-700/50 bg-slate-900/95 p-3 text-left text-[11px] leading-normal text-white shadow-xl"
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



const getTierCls = (tier: string) => {
  switch (tier) {
    case 'Low': return 'badge-risk-low';
    case 'Medium': return 'badge-risk-medium';
    default: return 'badge-risk-high';
  }
};

const getCompositeScoreCls = (tier: string) => {
  if (tier === 'High') return 'text-risk-high font-semibold';
  if (tier === 'Medium') return 'text-risk-medium font-semibold';
  return 'text-risk-low font-semibold';
};

const getAttendanceRateCls = (rate: number) => {
  if (rate >= 81) return 'text-risk-low font-semibold';
  if (rate >= 75) return 'text-risk-medium font-semibold';
  return 'text-risk-high font-semibold';
};

const getScoreAvgCls = (score: number) => {
  if (score >= 81) return 'text-risk-low font-semibold';
  if (score >= 75) return 'text-risk-medium font-semibold';
  return 'text-risk-high font-semibold';
};

const riskTierOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

/** Show up to 2 decimal places but trim trailing zeros (100.00 → 100, 99.5 → 99.5) */
const smartPct = (n: number): string => parseFloat(n.toFixed(2)).toString();

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
  <span className="group relative inline-flex items-center gap-2 rounded-full transition hover:bg-gray-100 hover:text-gray-700">
    <button
      type="button"
      aria-label="Show how risk is calculated"
      className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-gray-500 outline-none"
    >
      HOW RISK LEVEL IS CALCULATED
    </button>
    <button
      type="button"
      aria-label="Show how risk is calculated"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 opacity-70 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
    >
      <Info className="h-3.5 w-3.5" />
    </button>
    <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-max max-w-[calc(100vw-2rem)] -translate-y-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-left text-xs font-semibold leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block">
      Risk level is calculated from the composite score of a student. Composite Score = 40% (Attendance Rate) + 60% (Average Score)
    </span>
  </span>
);

const StudentRiskFilter: React.FC<{ rows: ExtendedRiskRow[]; value: RiskScope; onChange: (value: RiskScope) => void }> = ({ rows, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const selectedStudent = rows.find((row) => String(row.student.id) === value)?.student.full_name;
  const selectedLabel = value === 'all' ? 'ALL STUDENTS' : selectedStudent || 'ALL STUDENTS';

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  return (
    <div ref={filterRef} className="relative">
      <button
        type="button"
        aria-label="Filter risk chart by student"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-9 min-w-40 items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-semibold tracking-normal text-gray-700 transition hover:border-gray-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-2 max-h-60 min-w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl" role="listbox" aria-label="Students">
          <button type="button" role="option" aria-selected={value === 'all'} onClick={() => { onChange('all'); setIsOpen(false); }} className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition hover:bg-emerald-50 hover:text-emerald-700 ${value === 'all' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'}`} style={{ fontFamily: 'var(--font-body)' }}>
            ALL STUDENTS
          </button>
          {rows.map((row) => {
            const studentValue = String(row.student.id);
            const isSelected = value === studentValue;
            return (
              <button key={studentValue} type="button" role="option" aria-selected={isSelected} onClick={() => { onChange(studentValue); setIsOpen(false); }} className={`block w-full truncate rounded-lg px-3 py-2 text-left text-xs font-semibold transition hover:bg-emerald-50 hover:text-emerald-700 ${isSelected ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'}`} style={{ fontFamily: 'var(--font-body)' }}>
                {row.student.full_name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const getAralBadge = (level?: string | null) => {
  switch (level) {
    case 'plus':      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">Plus</span>;
    case 'summer':    return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">Summer</span>;
    case 'graduated': return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Graduated</span>;
    default:          return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Basic</span>;
  }
};

export const TutorAnalytics: React.FC = () => {
  const { user } = useAuth();

  const [rows, setRows] = useState<ExtendedRiskRow[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [riskCounts, setRiskCounts] = useState({ high: 0, moderate: 0, low: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<AnalyticsTab>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    return requestedTab === 'overall' || requestedTab === 'attendance' || requestedTab === 'score' ? requestedTab : 'overall';
  });
  const [attendanceFilter, setAttendanceFilter] = useState<TrendFilter>('week');
  const [scoreFilter, setScoreFilter] = useState<TrendFilter>('week');
  const [riskScope, setRiskScope] = useState<RiskScope>('all');
  const [attendanceScope, setAttendanceScope] = useState<RiskScope>('all');
  const [scoreScope, setScoreScope] = useState<RiskScope>('all');
  const [riskTrendFilter, setRiskTrendFilter] = useState<TrendFilter>('week');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [scoreSearch, setScoreSearch] = useState('');
  const [attendanceDescFilter, setAttendanceDescFilter] = useState<'all' | 'Intervention Activity' | 'milestone'>('all');
  const [scoreDescFilter, setScoreDescFilter] = useState<'all' | 'Intervention Activity' | 'milestone'>('all');
  const [sortField, setSortField] = useState<keyof ExtendedRiskRow | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [attendanceSortField, setAttendanceSortField] = useState<AttendanceDetailSortField | null>(null);
  const [attendanceSortAsc, setAttendanceSortAsc] = useState(true);
  const [scoreSortField, setScoreSortField] = useState<ScoreDetailSortField | null>(null);
  const [scoreSortAsc, setScoreSortAsc] = useState(true);

  const assignedMilestone = useMemo<MilestoneType>(() => {
    return getTutorAssignedMilestone(user?.aral_level);
  }, [user?.aral_level]);



  const fetchAnalytics = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const [studentsResponse, grades, attendanceLogs] = await Promise.all([
        userService.getAllUsers({ role: 'student', assigned_tutor: user.id }),
        academicService.getGrades(),
        academicService.getAttendanceHistory(),
      ]);
      const students = Array.isArray(studentsResponse) ? studentsResponse : [];
      const safeAttendance = Array.isArray(attendanceLogs) ? attendanceLogs : [];
      const baseRows = computeStudentRiskRows(students, grades, safeAttendance);

      setGrades(Array.isArray(grades) ? grades : []);
      setAttendanceLogs(safeAttendance);
      const extendedRows: ExtendedRiskRow[] = baseRows.map((row) => {
        const studentAtt = safeAttendance.filter((a: Attendance) => String(a.user) === String(row.student.id));
        return { ...row, absentCount: studentAtt.filter((a: Attendance) => a.status === 'absent').length };
      });

      const counts = extendedRows.reduce(
        (acc, row) => {
          if (row.riskTier === 'High') acc.high += 1;
          else if (row.riskTier === 'Medium') acc.moderate += 1;
          else acc.low += 1;
          return acc;
        },
        { high: 0, moderate: 0, low: 0 }
      );

      setRiskCounts(counts);
      setRows(extendedRows);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Failed to load analytics data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, [user]);

  const handleSort = (field: keyof ExtendedRiskRow) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filteredAndSortedRows = useMemo(() => {
    return rows
      .filter((r) => {
        return matchesSearch(search, r.student.full_name, r.student.first_name, r.student.last_name, r.student.lrn);
      })
      .sort((a, b) => {
        if (sortField === null || sortField === 'riskTier') {
          const riskComparison = riskTierOrder[a.riskTier] - riskTierOrder[b.riskTier];
          return sortField === null || sortAsc ? riskComparison : -riskComparison;
        }
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        if (sortField === 'student') { valA = a.student.full_name; valB = b.student.full_name; }
        if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [rows, search, sortField, sortAsc]);

  const attendanceScopedRows = useMemo(() => (
    attendanceScope === 'all' ? rows : rows.filter((row) => String(row.student.id) === attendanceScope)
  ), [rows, attendanceScope]);
  const scoreScopedRows = useMemo(() => (
    scoreScope === 'all' ? rows : rows.filter((row) => String(row.student.id) === scoreScope)
  ), [rows, scoreScope]);
  const attendanceTrend = useMemo(() => buildTrendPoints(
    attendanceScopedRows.map((row) => row.student),
    grades,
    attendanceLogs,
    'attendance',
    attendanceFilter
  ), [attendanceScopedRows, grades, attendanceLogs, attendanceFilter]);
  const scoreTrend = useMemo(() => buildTrendPoints(
    scoreScopedRows.map((row) => row.student),
    grades,
    attendanceLogs,
    'score',
    scoreFilter
  ), [scoreScopedRows, grades, attendanceLogs, scoreFilter]);
  const riskScopedRows = useMemo(() => (
    riskScope === 'all' ? rows : rows.filter((row) => String(row.student.id) === riskScope)
  ), [rows, riskScope]);
  const selectedRiskStudent = useMemo(() => (
    riskScope === 'all' ? null : rows.find((row) => String(row.student.id) === riskScope)?.student || null
  ), [rows, riskScope]);
  const selectedAttendanceStudent = useMemo(() => (
    attendanceScope === 'all' ? null : rows.find((row) => String(row.student.id) === attendanceScope)?.student || null
  ), [rows, attendanceScope]);
  const selectedScoreStudent = useMemo(() => (
    scoreScope === 'all' ? null : rows.find((row) => String(row.student.id) === scoreScope)?.student || null
  ), [rows, scoreScope]);
  const riskTrend = useMemo(() => buildRiskTrendPoints(
    riskScopedRows.map((row) => row.student),
    grades,
    attendanceLogs,
    riskTrendFilter
  ), [riskScopedRows, grades, attendanceLogs, riskTrendFilter]);
  const attendanceSummary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayLogs = attendanceLogs.filter((log) => log.date && log.date.slice(0, 10) === todayStr);
    return {
      present: todayLogs.filter((log) => log.status === 'present').length,
      absent: todayLogs.filter((log) => log.status === 'absent').length,
    };
  }, [attendanceLogs]);

  const avgAttendance = useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.round((rows.reduce((acc, r) => acc + r.attendanceRate, 0) / rows.length) * 100) / 100;
  }, [rows]);

  const attendanceMood = useMemo(() => {
    if (attendanceLogs.length === 0) {
      return {
        icon: Meh,
        iconBg: 'bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-800/60',
        iconColor: 'text-amber-500',
        valueColor: 'text-amber-500',
      };
    }
    if (avgAttendance >= 81) {
      return {
        icon: Smile,
        iconBg: 'risk-card-low',
        iconColor: 'text-risk-low',
        valueColor: 'text-risk-low',
      };
    }
    if (avgAttendance >= 75) {
      return {
        icon: Meh,
        iconBg: 'risk-card-medium',
        iconColor: 'text-risk-medium',
        valueColor: 'text-risk-medium',
      };
    }
    return {
      icon: Frown,
      iconBg: 'risk-card-high',
      iconColor: 'text-risk-high',
      valueColor: 'text-risk-high',
    };
  }, [avgAttendance, attendanceLogs.length]);
  const scoreSummary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const scoreRecords = grades.filter((grade) =>
      grade.component_type !== 'attendance' &&
      grade.remarks !== 'Not Taken' &&
      grade.date_logged && grade.date_logged.slice(0, 10) === todayStr
    );
    return {
      passed: scoreRecords.filter((grade) => Number(grade.total_score) > 0 && (Number(grade.score) / Number(grade.total_score)) >= 0.7).length,
      failed: scoreRecords.filter((grade) => Number(grade.total_score) > 0 && (Number(grade.score) / Number(grade.total_score)) < 0.7).length,
    };
  }, [grades]);

  const avgScore = useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.round((rows.reduce((acc, r) => acc + r.scoreAvg, 0) / rows.length) * 100) / 100;
  }, [rows]);

  const scoreMood = useMemo(() => {
    const noGrades = grades.filter((g) => g.component_type !== 'attendance' && g.remarks !== 'Not Taken').length === 0;
    if (noGrades) {
      return {
        icon: Meh,
        iconBg: 'bg-amber-50 border-amber-100',
        iconColor: 'text-amber-500',
        valueColor: 'text-amber-500',
      };
    }
    if (avgScore >= 81) {
      return {
        icon: Smile,
        iconBg: 'risk-card-low',
        iconColor: 'text-risk-low',
        valueColor: 'text-risk-low',
      };
    }
    if (avgScore >= 70) {
      return {
        icon: Meh,
        iconBg: 'risk-card-medium',
        iconColor: 'text-risk-medium',
        valueColor: 'text-risk-medium',
      };
    }
    return {
      icon: Frown,
      iconBg: 'risk-card-high',
      iconColor: 'text-risk-high',
      valueColor: 'text-risk-high',
    };
  }, [avgScore, grades]);
  const attendanceDetails = useMemo(() => {
    const list: (ExtendedRiskRow & {
      description: EntryDescriptionType;
      present: number;
      absent: number;
      attendanceAverage: number;
    })[] = [];

    rows.forEach((row) => {
      const allStudentLogs = attendanceLogs.filter((log) => String(log.user) === String(row.student.id));

      const typesToGenerate: EntryDescriptionType[] = attendanceDescFilter === 'all'
        ? ['Intervention Activity', assignedMilestone]
        : attendanceDescFilter === 'milestone'
        ? [assignedMilestone]
        : ['Intervention Activity'];

      typesToGenerate.forEach((desc) => {
        const studentLogs = allStudentLogs.filter((log) => {
          const logDesc = getAttendanceDescription(log);
          if (desc === 'Intervention Activity') return logDesc === 'Intervention Activity';
          return logDesc !== 'Intervention Activity';
        });
        if (attendanceDescFilter === 'all' && desc !== 'Intervention Activity' && studentLogs.length === 0) {
          return;
        }
        const present = studentLogs.filter((log) => log.status === 'present').length;
        const absent = studentLogs.filter((log) => log.status === 'absent').length;
        const attended = studentLogs.filter((log) => log.status === 'present').length;
        list.push({
          ...row,
          description: desc,
          present,
          absent,
          attendanceAverage: studentLogs.length ? (attended / studentLogs.length) * 100 : 0,
        });
      });
    });

    return list
      .filter((row) => matchesSearch(attendanceSearch, row.student.full_name, row.student.first_name, row.student.last_name, row.student.lrn, row.description))
      .sort((firstRow, secondRow) => {
        if (attendanceSortField === null) return 0;
        const firstValue =
          attendanceSortField === 'student'
            ? firstRow.student.full_name
            : attendanceSortField === 'aralLevel'
            ? firstRow.student.aral_level || ''
            : attendanceSortField === 'description'
            ? firstRow.description
            : (firstRow as unknown as Record<string, string | number>)[attendanceSortField];
        const secondValue =
          attendanceSortField === 'student'
            ? secondRow.student.full_name
            : attendanceSortField === 'aralLevel'
            ? secondRow.student.aral_level || ''
            : attendanceSortField === 'description'
            ? secondRow.description
            : (secondRow as unknown as Record<string, string | number>)[attendanceSortField];
        if (typeof firstValue === 'string' && typeof secondValue === 'string') {
          return attendanceSortAsc ? firstValue.localeCompare(secondValue) : secondValue.localeCompare(firstValue);
        }
        return attendanceSortAsc ? Number(firstValue) - Number(secondValue) : Number(secondValue) - Number(firstValue);
      });
  }, [rows, attendanceLogs, attendanceSearch, attendanceDescFilter, attendanceSortField, attendanceSortAsc]);

  const scoreDetails = useMemo(() => {
    const list: (ExtendedRiskRow & {
      description: EntryDescriptionType;
      passed: number;
      failed: number;
      scoreAverage: number;
    })[] = [];

    rows.forEach((row) => {
      const allStudentGrades = grades.filter(
        (grade) => String(grade.student) === String(row.student.id) && grade.component_type !== 'attendance' && grade.remarks !== 'Not Taken'
      );

      const typesToGenerate: EntryDescriptionType[] = scoreDescFilter === 'all'
        ? ['Intervention Activity', assignedMilestone]
        : scoreDescFilter === 'milestone'
        ? [assignedMilestone]
        : ['Intervention Activity'];

      typesToGenerate.forEach((desc) => {
        const studentGrades = allStudentGrades.filter((grade) => {
          const gradeDesc = getScoreDescription(grade);
          if (desc === 'Intervention Activity') return gradeDesc === 'Intervention Activity';
          return gradeDesc !== 'Intervention Activity';
        });
        if (scoreDescFilter === 'all' && desc !== 'Intervention Activity' && studentGrades.length === 0) {
          return;
        }
        const percentages = studentGrades
          .filter((grade) => Number(grade.total_score) > 0)
          .map((grade) => (Number(grade.score) / Number(grade.total_score)) * 100);

        list.push({
          ...row,
          description: desc,
          passed: percentages.filter((percentage) => percentage >= 70).length,
          failed: percentages.filter((percentage) => percentage < 70).length,
          scoreAverage: percentages.length ? percentages.reduce((sum, percentage) => sum + percentage, 0) / percentages.length : 0,
        });
      });
    });

    return list
      .filter((row) => matchesSearch(scoreSearch, row.student.full_name, row.student.first_name, row.student.last_name, row.student.lrn, row.description))
      .sort((firstRow, secondRow) => {
        if (scoreSortField === null) return 0;
        const firstValue =
          scoreSortField === 'student'
            ? firstRow.student.full_name
            : scoreSortField === 'aralLevel'
            ? firstRow.student.aral_level || ''
            : scoreSortField === 'description'
            ? firstRow.description
            : (firstRow as unknown as Record<string, string | number>)[scoreSortField];
        const secondValue =
          scoreSortField === 'student'
            ? secondRow.student.full_name
            : scoreSortField === 'aralLevel'
            ? secondRow.student.aral_level || ''
            : scoreSortField === 'description'
            ? secondRow.description
            : (secondRow as unknown as Record<string, string | number>)[scoreSortField];
        if (typeof firstValue === 'string' && typeof secondValue === 'string') {
          return scoreSortAsc ? firstValue.localeCompare(secondValue) : secondValue.localeCompare(firstValue);
        }
        return scoreSortAsc ? Number(firstValue) - Number(secondValue) : Number(secondValue) - Number(firstValue);
      });
  }, [rows, grades, scoreSearch, scoreDescFilter, scoreSortField, scoreSortAsc]);
  const handleDetailSort = <Field extends string>(field: Field, currentField: Field | null, setField: React.Dispatch<React.SetStateAction<Field | null>>, setAscending: React.Dispatch<React.SetStateAction<boolean>>, ascending: boolean) => {
    if (currentField === field) setAscending(!ascending);
    else { setField(field); setAscending(true); }
  };
  const SortHeader: React.FC<{ field: string; children: React.ReactNode; align?: string; activeField?: string | null; ascending?: boolean; onSort?: (field: string) => void }> = ({ field, children, align = 'left', activeField = sortField, ascending = sortAsc, onSort = (value) => handleSort(value as keyof ExtendedRiskRow) }) => (
    <th
      onClick={() => onSort(field)}
      className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 transition-colors select-none text-${align}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {activeField === field ? (
          ascending ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </span>
    </th>
  );

  if (isLoading) {
    return (
      <div className="space-y-6 skeleton-container" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* ── View Tab Switcher Skeleton ── */}
        <div className="flex w-full rounded-2xl bg-gray-100 dark:bg-[#111111] p-1 gap-1 animate-pulse skeleton-row-1">
          <div className="h-9 flex-1 rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 flex-1 rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 flex-1 rounded-xl bg-gray-200 dark:bg-gray-800" />
        </div>

        {/* ── 3 Summary KPI Cards Skeleton ── */}
        <div className="grid gap-4 sm:grid-cols-3 skeleton-row-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 shadow-sm min-h-[114px] flex items-center gap-4 animate-pulse"
            >
              <div className="w-11 h-11 rounded-2xl bg-gray-200 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
                <div className="h-8 w-14 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-3 w-44 rounded bg-gray-100 dark:bg-gray-800/60 mt-2" />
              </div>
            </div>
          ))}
        </div>

        {/* ── Chart Card Skeleton ── */}
        <div className="w-full rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-6 shadow-sm animate-pulse skeleton-row-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1.5">
              <div className="h-4 w-52 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-40 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 w-44 rounded bg-gray-100 dark:bg-gray-800 hidden sm:block" />
              <div className="h-8 w-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
              <div className="h-8 w-28 rounded-xl bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
          <div className="mt-6">
            <div className="h-[228px] w-full rounded-2xl bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A]" />
          </div>
        </div>

        {/* ── Table Card Skeleton ── */}
        <div className="space-y-2 skeleton-row-3">
          <div className="w-full overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-[#1A1A1A] dark:bg-[#0A0A0A] animate-pulse">
            {/* Table toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div className="space-y-1">
                <div className="h-4 w-52 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="h-9 w-64 rounded-xl bg-gray-100 dark:bg-gray-800" />
            </div>

            {/* Table header bar */}
            <div className="bg-gray-50 dark:bg-[#111111] border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-3 flex items-center justify-between">
              <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-800" />
            </div>

            {/* Table rows */}
            <div className="divide-y divide-gray-100 dark:divide-[#1A1A1A]">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0" />
                  <div className="space-y-1">
                    <div className="h-3.5 w-36 rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-2.5 w-24 rounded bg-gray-100 dark:bg-gray-800" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-gray-100 dark:bg-gray-800 ml-8" />
                  <div className="h-3.5 w-16 rounded bg-gray-100 dark:bg-gray-800 ml-auto" />
                  <div className="h-3.5 w-16 rounded bg-gray-100 dark:bg-gray-800 ml-auto" />
                  <div className="h-3.5 w-16 rounded bg-gray-100 dark:bg-gray-800 ml-auto" />
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
          <p className="text-sm font-bold">Failed to load analytics</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 data-loaded-content" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── View Tab Switcher ── */}
      <div
        className="flex w-full rounded-2xl bg-gray-100 p-1 gap-1 dark:bg-[#111111]"
        role="tablist"
        aria-label="Analytics view"
      >
        {([
          ['overall', 'Overall'],
          ['attendance', 'Attendance'],
          ['score', 'Score'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeAnalyticsTab === tab}
            onClick={() => setActiveAnalyticsTab(tab)}
            className={`flex-1 h-9 rounded-xl px-4 flex items-center justify-center text-xs font-bold uppercase transition-all ${
              activeAnalyticsTab === tab
                ? 'bg-[var(--brand)] text-white shadow-sm'
                : 'text-gray-400 opacity-60 hover:bg-white/60 hover:text-gray-600 hover:opacity-100 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
          {/* ── Overall Tab Content ── */}
          {activeAnalyticsTab === 'overall' && (
            <>
              {/* ── Risk Summary Cards ─────────────────────────────────────── */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="relative rounded-3xl border risk-card-high p-5 shadow-sm min-h-[114px] flex items-center gap-4">
                  <div className="absolute right-4 top-4">
                    <RiskRangeInfo range="Composite score is below 70%" />
                  </div>
                  <div className="w-11 h-11 rounded-2xl border risk-badge-high flex items-center justify-center shrink-0">
                    <Frown className="w-5 h-5 text-risk-high" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-risk-high">
                      <p className="text-[11px] font-bold uppercase tracking-wider">High Risk</p>
                    </div>
                    <p className="text-3xl font-extrabold text-risk-high mt-0.5">{riskCounts.high}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-slate-400">Students needing immediate intervention</p>
                  </div>
                </div>

                <div className="relative rounded-3xl border risk-card-medium p-5 shadow-sm min-h-[114px] flex items-center gap-4">
                  <div className="absolute right-4 top-4">
                    <RiskRangeInfo range="Composite score is between 70% to 85%" />
                  </div>
                  <div className="w-11 h-11 rounded-2xl border risk-badge-medium flex items-center justify-center shrink-0">
                    <Meh className="w-5 h-5 text-risk-medium" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-risk-medium">
                      <p className="text-[11px] font-bold uppercase tracking-wider">Medium Risk</p>
                    </div>
                    <p className="text-3xl font-extrabold text-risk-medium mt-0.5">{riskCounts.moderate}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-slate-400">Students requiring monitoring</p>
                  </div>
                </div>

                <div className="relative rounded-3xl border risk-card-low p-5 shadow-sm min-h-[114px] flex items-center gap-4">
                  <div className="absolute right-4 top-4">
                    <RiskRangeInfo range="Composite score is between 86% to 100%" />
                  </div>
                  <div className="w-11 h-11 rounded-2xl border risk-badge-low flex items-center justify-center shrink-0">
                    <Smile className="w-5 h-5 text-risk-low" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-risk-low">
                      <p className="text-[11px] font-bold uppercase tracking-wider">Low Risk</p>
                    </div>
                    <p className="text-3xl font-extrabold text-risk-low mt-0.5">{riskCounts.low}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-slate-400">Students performing well</p>
                  </div>
                </div>
              </div>

              {/* ── Risk Level Trend Chart ── */}
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#1A1A1A] dark:bg-[#0A0A0A]" aria-labelledby="risk-overview-heading">
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
                  <div>
                    <h3 id="risk-overview-heading" className="text-sm font-bold uppercase text-gray-900 dark:text-slate-100">RISK LEVEL TREND CHART</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full shadow-xs" style={{ backgroundColor: '#EF4444' }} />High Risk</span>
                      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full shadow-xs" style={{ backgroundColor: '#F59E0B' }} />Medium Risk</span>
                      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full shadow-xs" style={{ backgroundColor: '#22C55E' }} />Low Risk</span>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <StudentRiskFilter rows={rows} value={riskScope} onChange={setRiskScope} />
                    </label>
                    <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-0.5 dark:bg-[#111111]" role="group" aria-label="Filter risk chart by time period">
                      {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                        <button key={filter} type="button" onClick={() => setRiskTrendFilter(filter)} className={`cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all ${riskTrendFilter === filter ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="relative rounded-2xl border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
                    <RiskTrendChart data={riskTrend} total={riskScopedRows.length} isSingleStudent={riskScope !== 'all'} studentName={selectedRiskStudent?.full_name} />
                  </div>
                </div>
              </section>

              {/* ── Student Performance Details Table ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1 pb-1 text-xs text-gray-500" style={{ fontFamily: 'var(--font-body)' }}>
                  <RiskCalculationInfo />
                </div>
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">STUDENT PERFORMANCE DETAILS</h3>
                        <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">{filteredAndSortedRows.length} Students</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-1 sm:flex-none sm:max-w-lg">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="search"
                          placeholder="Search Student Name"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs font-semibold text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white focus:ring-2 focus:ring-[var(--brand)]/10"
                        />
                      </div>
                    </div>
                  </div>

                  {filteredAndSortedRows.length === 0 ? (
                    <div className="py-16 text-center space-y-2">
                      <Users className="w-10 h-10 mx-auto text-gray-200" />
                      <p className="text-sm font-semibold text-gray-500">No students found</p>
                      <p className="text-xs text-gray-400">Try adjusting your search criteria.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm font-normal w-full" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                        <thead>
                          <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                            <SortHeader field="student">Student</SortHeader>
                            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">ARAL Level</th>
                            <SortHeader field="attendanceRate">Average Attendance Rate</SortHeader>
                            <SortHeader field="scoreAvg">Average Score</SortHeader>
                            <SortHeader field="compositeScore">COMPOSITE SCORE</SortHeader>
                            <SortHeader field="riskTier">Risk Level</SortHeader>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                          {filteredAndSortedRows.map((row) => (
                            <tr key={row.student.id} className="divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-white/5">
                              <td className="px-4 py-3.5 align-middle">
                                <div>
                                  <div className="font-semibold text-gray-900 dark:text-slate-100">{row.student.full_name}</div>
                                  <div className="text-xs text-gray-400 font-normal">LRN: {row.student.lrn || 'N/A'}</div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 align-middle">{getAralBadge(row.student.aral_level)}</td>
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
            </>
          )}

          {/* ── Attendance Tab Content ── */}
          {activeAnalyticsTab === 'attendance' && (
            <>
              {/* 3 Attendance Summary Cards */}
              <div className="grid w-full gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm min-h-[114px] flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-emerald-600" strokeWidth={3} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Present Today</p>
                    <p className="text-3xl font-extrabold text-emerald-900 mt-0.5">{attendanceSummary.present}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500">Students marked present today</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm min-h-[114px] flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                    <X className="w-5 h-5 text-rose-600" strokeWidth={3} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Absent Today</p>
                    <p className="text-3xl font-extrabold text-rose-900 mt-0.5">{attendanceSummary.absent}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500">Students marked absent today</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm min-h-[114px] flex items-center gap-4 dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${attendanceMood.iconBg}`}>
                    <attendanceMood.icon className={`w-5 h-5 ${attendanceMood.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">Average Attendance</p>
                    <p className={`text-3xl font-extrabold mt-0.5 ${attendanceMood.valueColor}`}>
                      {attendanceLogs.length === 0 ? '—' : `${smartPct(avgAttendance)}%`}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-slate-400">Class average attendance rate</p>
                  </div>
                </div>
              </div>

              {/* Attendance Trend Chart */}
              <div className="w-full rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
                  <div>
                    <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-slate-100">STUDENTS ATTENDANCE RATE TREND CHART</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0052B7] shadow-xs" />Attendance Rate</span>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <StudentRiskFilter rows={rows} value={attendanceScope} onChange={setAttendanceScope} />
                    </label>
                    <div className="flex rounded-xl bg-gray-100 p-0.5 dark:bg-[#111111]" aria-label="Attendance trend period">
                      {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                        <button key={filter} type="button" onClick={() => setAttendanceFilter(filter)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all ${attendanceFilter === filter ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="relative mt-6 h-56 w-full rounded-2xl border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
                  <TrendChart data={attendanceTrend} color="#0052B7" emptyLabel="No attendance trend data" valueLabel={selectedAttendanceStudent ? selectedAttendanceStudent.full_name : 'Class Average Attendance'} />
                </div>
              </div>

              {/* Student Attendance Details Table */}
              <div className="w-full overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                <div className="overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">STUDENT ATTENDANCE DETAILS</h3>
                      <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">{attendanceDetails.length} Students</p>
                    </div>
                    <div className="flex items-center gap-3 flex-1 sm:flex-none sm:max-w-lg">
                      {/* Description Filter */}
                      <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-0.5 gap-0.5 shrink-0">
                        {([
                          ['all', 'All'],
                          ['Intervention Activity', 'Intervention'],
                          ['milestone', assignedMilestone],
                        ] as const).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setAttendanceDescFilter(val)}
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                              attendanceDescFilter === val
                                ? 'bg-[var(--brand)] text-white shadow-sm'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="search" aria-label="Search attendance students" placeholder="Search Student Name" value={attendanceSearch} onChange={(event) => setAttendanceSearch(event.target.value)} className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs font-semibold text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white focus:ring-2 focus:ring-[var(--brand)]/10" />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm font-normal" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                      <thead><tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]"><SortHeader field="student" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>Student</SortHeader><SortHeader field="aralLevel" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>ARAL Level</SortHeader><SortHeader field="description" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>DESCRIPTION</SortHeader><SortHeader field="present" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>Total Present</SortHeader><SortHeader field="absent" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>Total Absent</SortHeader><SortHeader field="attendanceAverage" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>Average Attendance Rate</SortHeader></tr></thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">{attendanceDetails.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-gray-400">No students found</td></tr> : attendanceDetails.map((row, idx) => <tr key={`${row.student.id}-${row.description}-${idx}`} className="divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-white/5"><td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-slate-100">{row.student.full_name}</td><td className="px-4 py-3.5">{getAralBadge(row.student.aral_level)}</td><td className="px-4 py-3.5 text-left"><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${row.description !== 'Intervention Activity' ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{row.description}</span></td><td className="px-4 py-3.5 font-normal text-emerald-600">{row.present}</td><td className="px-4 py-3.5 font-normal text-rose-600">{row.absent}</td><td className="px-4 py-3.5 font-normal"><span className={`text-sm font-normal ${getAttendanceRateCls(row.attendanceAverage)}`}>{smartPct(row.attendanceAverage)}%</span></td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Score Tab Content ── */}
          {activeAnalyticsTab === 'score' && (
            <>
              {/* 3 Score Summary Cards */}
              <div className="grid w-full gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm min-h-[114px] flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-emerald-600" strokeWidth={3} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Passed Today</p>
                    <p className="text-3xl font-extrabold text-emerald-900 mt-0.5">{scoreSummary.passed}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500">Assessments scored ≥ 70% today</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm min-h-[114px] flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                    <X className="w-5 h-5 text-rose-600" strokeWidth={3} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Failed Today</p>
                    <p className="text-3xl font-extrabold text-rose-900 mt-0.5">{scoreSummary.failed}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500">Assessments scored &lt; 70% today</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm min-h-[114px] flex items-center gap-4 dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${scoreMood.iconBg}`}>
                    <scoreMood.icon className={`w-5 h-5 ${scoreMood.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">Average Score</p>
                    <p className={`text-3xl font-extrabold mt-0.5 ${scoreMood.valueColor}`}>
                      {grades.filter((g) => g.component_type !== 'attendance' && g.remarks !== 'Not Taken').length === 0 ? '—' : `${smartPct(avgScore)}%`}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-slate-400">Class average score rate</p>
                  </div>
                </div>
              </div>

              {/* Score Trend Chart */}
              <div className="w-full rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
                  <div>
                    <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-slate-100">STUDENTS AVERAGE SCORE TREND CHART</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0052B7] shadow-xs" />Average Score</span>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <StudentRiskFilter rows={rows} value={scoreScope} onChange={setScoreScope} />
                    </label>
                    <div className="flex rounded-xl bg-gray-100 p-0.5 dark:bg-[#111111]" aria-label="Score trend period">
                      {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                        <button key={filter} type="button" onClick={() => setScoreFilter(filter)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all ${scoreFilter === filter ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="relative mt-6 h-56 w-full rounded-2xl border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
                  <TrendChart data={scoreTrend} color="#0052B7" emptyLabel="No score trend data" valueLabel={selectedScoreStudent ? selectedScoreStudent.full_name : 'Class Average Score'} />
                </div>
              </div>

              {/* Student Score Details Table */}
              <div className="w-full overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                <div className="overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">STUDENT SCORE DETAILS</h3>
                      <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">{scoreDetails.length} Students</p>
                    </div>
                    <div className="flex items-center gap-3 flex-1 sm:flex-none sm:max-w-lg">
                      {/* Description Filter */}
                      <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-0.5 gap-0.5 shrink-0">
                        {([
                          ['all', 'All'],
                          ['Intervention Activity', 'Intervention'],
                          ['milestone', assignedMilestone],
                        ] as const).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setScoreDescFilter(val)}
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                              scoreDescFilter === val
                                ? 'bg-[var(--brand)] text-white shadow-sm'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="search" aria-label="Search score students" placeholder="Search Student Name" value={scoreSearch} onChange={(event) => setScoreSearch(event.target.value)} className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs font-semibold text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white focus:ring-2 focus:ring-[var(--brand)]/10" />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm font-normal" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                      <thead><tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]"><SortHeader field="student" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>Student</SortHeader><SortHeader field="aralLevel" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>ARAL Level</SortHeader><SortHeader field="description" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>DESCRIPTION</SortHeader><SortHeader field="passed" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>Total Passed</SortHeader><SortHeader field="failed" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>Total Failed</SortHeader><SortHeader field="scoreAverage" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>Average Score</SortHeader></tr></thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">{scoreDetails.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-gray-400">No students found</td></tr> : scoreDetails.map((row, idx) => <tr key={`${row.student.id}-${row.description}-${idx}`} className="divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-white/5"><td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-slate-100">{row.student.full_name}</td><td className="px-4 py-3.5">{getAralBadge(row.student.aral_level)}</td><td className="px-4 py-3.5 text-left"><span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${row.description !== 'Intervention Activity' ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{row.description}</span></td><td className="px-4 py-3.5 font-normal text-emerald-600">{row.passed}</td><td className="px-4 py-3.5 font-normal text-rose-600">{row.failed}</td><td className="px-4 py-3.5 font-normal"><span className={`text-sm font-normal ${getScoreAvgCls(row.scoreAverage)}`}>{smartPct(row.scoreAverage)}%</span></td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
    </div>
  );
};

export default TutorAnalytics;
