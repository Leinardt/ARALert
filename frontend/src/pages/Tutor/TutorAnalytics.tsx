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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Attendance, Grade, User } from '../../types';
import { getRecentSchoolWeekdays, compareNamesByLastName } from '../../utils/studentFormatters';
import {
  type EntryDescriptionType,
  type MilestoneType,
  getScoreDescription,
  getAttendanceDescription,
  getCurrentSemesterMilestone,
  getActiveSystemMilestone,
  getActiveSystemSemester,
  setActiveSystemSemester,
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
type OverallSortField = keyof ExtendedRiskRow | 'student' | 'aralLevel';
type AttendanceDetailSortField = 'student' | 'aralLevel' | 'description' | 'present' | 'absent' | 'attendanceAverage';
type ScoreDetailSortField = 'student' | 'aralLevel' | 'description' | 'passed' | 'failed' | 'scoreAverage';

const aralLevelRank: Record<string, number> = {
  basic: 1,
  plus: 2,
  summer: 3,
  'aral summer': 3,
  intervention: 1,
  enrichment: 2,
  advanced: 3,
};

interface RiskTrendPoint {
  dateKey: string;
  label: string;
  high: number;
  medium: number;
  low: number;
}

const toLocalDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getLogUserId = (log: Attendance | any): string => {
  if (!log) return '';
  if (typeof log.user === 'object' && log.user !== null) {
    return String(log.user.id ?? log.user.pk ?? log.user.user_id ?? '');
  }
  if (typeof log.student === 'object' && log.student !== null) {
    return String(log.student.id ?? log.student.pk ?? log.student.user_id ?? '');
  }
  return String(log.user ?? log.student ?? log.user_id ?? '');
};

const getGradeStudentId = (grade: Grade | any): string => {
  if (!grade) return '';
  if (typeof grade.student === 'object' && grade.student !== null) {
    return String(grade.student.id ?? grade.student.pk ?? grade.student.user_id ?? '');
  }
  return String(grade.student ?? grade.student_id ?? '');
};

const getRecordDate = (rec: any): Date | null => {
  if (!rec) return null;
  const rawDate = rec.date || rec.date_logged || rec.created_at || rec.time_in || '';
  if (!rawDate) return null;
  const dateStr = typeof rawDate === 'string' ? rawDate.slice(0, 10) : '';
  if (!dateStr || dateStr.length < 10) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
};

const isAttendedStatus = (status?: string | null): boolean => {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'present' || s === 'p' || s === 'late';
};

const isAbsentStatus = (status?: string | null): boolean => {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'absent' || s === 'a';
};

const buildTrendPoints = (
  students: User[],
  grades: Grade[],
  attendanceLogs: Attendance[],
  metric: 'attendance' | 'score',
  filter: TrendFilter
): TrendPoint[] => {
  const studentIds = new Set(students.map((student) => String(student.id)));
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  let periods: { start: Date; end: Date; label: string; dateKey: string }[];
  if (filter === 'day') {
    const schoolDays = getRecentSchoolWeekdays(10, now);
    periods = schoolDays.map((d) => {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
      return { start, end, label: formatDate(start), dateKey: toLocalDateKey(start) };
    });
  } else {
    const periodCount = 6;
    periods = Array.from({ length: periodCount }, (_, index) => {
      const offset = periodCount - 1 - index;
      let start: Date;
      let end: Date;
      let label: string;
      if (filter === 'month') {
        start = new Date(now.getFullYear(), now.getMonth() - offset, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1, 0, 0, 0, 0);
        label = start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      } else {
        const dayOfWeek = now.getDay();
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const currentWeekMon = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() + diffToMon, 0, 0, 0, 0);
        start = new Date(currentWeekMon.getFullYear(), currentWeekMon.getMonth(), currentWeekMon.getDate() - offset * 7, 0, 0, 0, 0);
        const fri = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 4, 0, 0, 0, 0);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, 0, 0, 0, 0);
        label = `${formatDate(start)} – ${formatDate(fri)}`;
      }
      return { start, end, label, dateKey: toLocalDateKey(start) };
    });
  }

  const points = periods.map((period) => {
    if (metric === 'attendance') {
      const records = attendanceLogs.filter((log) => {
        const uid = getLogUserId(log);
        if (!studentIds.has(uid)) return false;
        const d = getRecordDate(log);
        if (!d) return false;
        return d >= period.start && d < period.end;
      });
      if (records.length === 0) return { period, point: null };
      const attended = records.filter((log) => isAttendedStatus(log.status)).length;
      const point: TrendPoint = {
        dateKey: period.dateKey,
        label: period.label,
        value: Math.round((attended / records.length) * 100),
      };
      return { period, point };
    }

    const scoreRecords = grades.filter((grade) => {
      const sid = getGradeStudentId(grade);
      if (!studentIds.has(sid) || grade.component_type === 'attendance' || grade.remarks === 'Not Taken') return false;
      const d = getRecordDate(grade);
      if (!d) return false;
      return d >= period.start && d < period.end;
    });
    if (scoreRecords.length === 0) return { period, point: null };
    const average = scoreRecords.reduce((total, grade) => {
      const totalScore = Number(grade.total_score) > 0 ? Number(grade.total_score) : 100;
      return total + (Number(grade.score) / totalScore) * 100;
    }, 0) / scoreRecords.length;
    const point: TrendPoint = {
      dateKey: period.dateKey,
      label: period.label,
      value: Math.round(Math.min(Math.max(average, 0), 100)),
    };
    return { period, point };
  });

  if (points.every(({ point }) => point === null)) return [];

  const firstRecordedPoint = points.find(({ point }) => point !== null)?.point;
  let lastValue = firstRecordedPoint ? firstRecordedPoint.value : (metric === 'attendance' ? 100 : 75);
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
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  let periods: { start: Date; end: Date; label: string; dateKey: string }[];
  if (filter === 'day') {
    const schoolDays = getRecentSchoolWeekdays(10, now);
    periods = schoolDays.map((d) => {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
      return { start, end, label: formatDate(start), dateKey: toLocalDateKey(start) };
    });
  } else {
    const periodCount = 6;
    periods = Array.from({ length: periodCount }, (_, index) => {
      const offset = periodCount - 1 - index;
      let start: Date;
      let end: Date;
      let label: string;
      if (filter === 'month') {
        start = new Date(now.getFullYear(), now.getMonth() - offset, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1, 0, 0, 0, 0);
        label = start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
      } else {
        const dayOfWeek = now.getDay();
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const currentWeekMon = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() + diffToMon, 0, 0, 0, 0);
        start = new Date(currentWeekMon.getFullYear(), currentWeekMon.getMonth(), currentWeekMon.getDate() - offset * 7, 0, 0, 0, 0);
        const fri = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 4, 0, 0, 0, 0);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, 0, 0, 0, 0);
        label = `${formatDate(start)} – ${formatDate(fri)}`;
      }
      return { start, end, label, dateKey: toLocalDateKey(start) };
    });
  }

  const points = periods.map((period) => {
    const periodGrades = grades.filter((grade) => {
      const sid = getGradeStudentId(grade);
      if (!studentIds.has(sid)) return false;
      const d = getRecordDate(grade);
      if (!d) return false;
      return d < period.end;
    });
    const periodAttendance = attendanceLogs.filter((log) => {
      const uid = getLogUserId(log);
      if (!studentIds.has(uid)) return false;
      const d = getRecordDate(log);
      if (!d) return false;
      return d < period.end;
    });
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

  if (points.every(({ point }) => point === null)) return [];

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

const formatShortDateRange = (label?: string | null): string => {
  if (!label || typeof label !== 'string') return '';
  const match = label.match(/^([A-Za-z]+)\s+(\d+)\s*[–—\-]\s*([A-Za-z]+)\s+(\d+)$/);
  if (match) {
    const [, m1, d1, m2, d2] = match;
    if (m1.toLowerCase() === m2.toLowerCase()) {
      return `${m1} ${d1}–${d2}`;
    }
    return `${m1} ${d1} – ${m2} ${d2}`;
  }
  return label;
};

const TrendChart: React.FC<{
  data: TrendPoint[];
  color: string;
  emptyLabel: string;
  valueLabel?: string;
  trendFilter?: TrendFilter;
}> = ({ data, color, emptyLabel, valueLabel = 'Class Average', trendFilter = 'week' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 240 });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    setHoveredIdx(null);
  }, [data, trendFilter]);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({
          width: Math.max(300, Math.round(clientWidth || 800)),
          height: Math.max(180, Math.round(clientHeight || 240)),
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
  const paddingRight = isMobile ? 18 : 20;
  const paddingTop = 20;
  const paddingBottom = isMobile ? 32 : 30;

  const chartWidth = Math.max(10, width - paddingLeft - paddingRight);
  const chartHeight = Math.max(10, height - paddingTop - paddingBottom);

  const colorId = color.replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `trendChartFill_${colorId}`;
  const filterId = `trendChartGlow_${colorId}`;

  const visibleIndices = useMemo(() => {
    const total = data.length;
    if (total <= 1) return new Set([0]);
    if (!isMobile) {
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    if (trendFilter === 'month') {
      if (width < 380) return new Set([0, 2, 4, total - 1]);
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    if (trendFilter === 'week') {
      if (width < 430) return new Set([0, 2, 4, total - 1]);
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
  }, [data.length, isMobile, isSmallMobile, trendFilter, width]);

  const getFormattedLabel = (label?: string | null) => {
    if (!label) return '';
    if (trendFilter === 'week') return formatShortDateRange(label);
    if (trendFilter === 'month' && isSmallMobile) {
      return label.split(' ')[0] || label;
    }
    return label;
  };

  if (data.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs font-medium text-gray-400 dark:text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  const points = data.map((point, index) => {
    const val = typeof point.value === 'number' && !isNaN(point.value) ? point.value : 0;
    return {
      ...point,
      value: val,
      x: paddingLeft + (index * chartWidth) / (data.length - 1 || 1),
      y: paddingTop + chartHeight - (val / 100) * chartHeight,
    };
  });

  let path = '';
  if (points.length === 1) {
    path = `M ${paddingLeft} ${points[0].y} L ${width - paddingRight} ${points[0].y}`;
  } else if (points.length > 1) {
    path = `M ${points[0].x} ${points[0].y}`;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const controlOffset = (current.x - previous.x) / 3;
      path += ` C ${previous.x + controlOffset} ${previous.y}, ${current.x - controlOffset} ${current.y}, ${current.x} ${current.y}`;
    }
  }

  const areaPath = points.length === 1
    ? `M ${paddingLeft} ${points[0].y} L ${width - paddingRight} ${points[0].y} L ${width - paddingRight} ${paddingTop + chartHeight} L ${paddingLeft} ${paddingTop + chartHeight} Z`
    : points.length > 1
    ? `${path} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  return (
    <div ref={containerRef} className="relative w-full h-full select-none min-w-0 overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full block" role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
          <filter id={filterId} x="-20%" y="-30%" width="140%" height="160%">
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
              <text x={paddingLeft - 8} y={y + 3.5} textAnchor="end" className="fill-slate-400 font-bold text-[9px] xs:text-[10px]">{value}%</text>
            </g>
          );
        })}
        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" filter={`url(#${filterId})`} />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((point, idx) => {
          if (!visibleIndices.has(idx)) return null;
          const formattedLabel = getFormattedLabel(point.label);
          return (
            <g key={point.dateKey || `pt-${idx}`}>
              <title>{`${point.label}: ${point.value}%`}</title>
              <circle cx={point.x} cy={point.y} r="4" fill={color} stroke="#FFFFFF" strokeWidth="2" />
              <text x={point.x} y={height - 8} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 font-bold text-[9px] xs:text-[10px]">{formattedLabel}</text>
            </g>
          );
        })}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line x1={points[hoveredIdx].x} y1={paddingTop} x2={points[hoveredIdx].x} y2={paddingTop + chartHeight} stroke={color} strokeWidth="1.5" opacity="0.7" />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="4.5" fill={color} stroke="#FFFFFF" strokeWidth="2" />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="8" fill={color} opacity="0.25" />
          </g>
        )}
        {points.map((point, index) => {
          const step = chartWidth / (data.length - 1 || 1);
          const xStart = index === 0 ? paddingLeft : point.x - step / 2;
          const xEnd = index === data.length - 1 ? width - paddingRight : point.x + step / 2;
          return (
            <rect
              key={`hover-${point.dateKey || index}`}
              x={xStart}
              y={paddingTop}
              width={xEnd - xStart}
              height={chartHeight}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(index)}
              onMouseLeave={() => setHoveredIdx(null)}
              onTouchStart={(e) => { e.preventDefault(); setHoveredIdx(index); }}
              onClick={() => setHoveredIdx(hoveredIdx === index ? null : index)}
            />
          );
        })}
      </svg>
      {hoveredIdx !== null && points[hoveredIdx] && (() => {
        const p = points[hoveredIdx];
        const percentX = (p.x / width) * 100;
        const isRightHalf = percentX > 50;

        return (
          <div
            className="pointer-events-none absolute z-10 w-max rounded-xl border border-slate-200 dark:border-zinc-700/50 bg-white/95 dark:bg-zinc-900/95 p-3 text-left text-[11px] leading-normal text-slate-800 dark:text-white shadow-xl shadow-slate-900/10 dark:shadow-black/60 overflow-hidden backdrop-blur-md"
            style={{
              left: `${percentX}%`,
              top: '12%',
              transform: isRightHalf ? 'translate(-105%, 0)' : 'translate(5%, 0)',
              maxWidth: '240px',
            }}
          >
            <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 break-words">{p.label}</div>
            <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-sm font-extrabold" style={{ color }}>{p.value}%</span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 truncate max-w-[180px]" title={valueLabel}>{valueLabel}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};





const DesktopRiskTrendChart: React.FC<{
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
  const { maxValue, axisSteps } = useMemo(() => {
    if (isSingleStudent) {
      return { maxValue: 1, axisSteps: [0, 1] };
    }
    const safeTotal = Math.max(1, total);
    // Target ~4 to 6 intervals so Y-axis tick numbers are never cramped
    let step = 5;
    if (safeTotal <= 10) {
      step = 2;
    } else if (safeTotal <= 35) {
      step = 5;
    } else if (safeTotal <= 70) {
      step = 10;
    } else if (safeTotal <= 120) {
      step = safeTotal % 15 === 0 ? 15 : 20;
    } else if (safeTotal <= 250) {
      step = safeTotal % 25 === 0 ? 25 : 50;
    } else if (safeTotal <= 500) {
      step = 50;
    } else {
      const rawStep = safeTotal / 5;
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const residual = rawStep / magnitude;
      if (residual <= 1.5) step = magnitude;
      else if (residual <= 3) step = 2 * magnitude;
      else if (residual <= 7) step = 5 * magnitude;
      else step = 10 * magnitude;
    }

    const calculatedMax = Math.max(step, Math.ceil(safeTotal / step) * step);
    const steps: number[] = [];
    for (let val = 0; val <= calculatedMax; val += step) {
      steps.push(val);
    }
    return { maxValue: calculatedMax, axisSteps: steps };
  }, [total, isSingleStudent]);
  const series = [
    { key: 'high' as const, color: '#EF4444', label: 'High Risk' },
    { key: 'medium' as const, color: '#F59E0B', label: 'Medium Risk' },
    { key: 'low' as const, color: '#22C55E', label: 'Low Risk' },
  ];
  const barWidth = Math.max(14, Math.min(34, (chartWidth / (data.length || 1)) * 0.35));
  const getBarX = (index: number) =>
    paddingLeft + barWidth / 2 + (index * (chartWidth - barWidth)) / (data.length - 1 || 1);

  return (
    <div className="relative overflow-hidden">
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
              <text
                x={x}
                y={height - 4}
                textAnchor="middle"
                className="fill-slate-500 font-semibold text-[8px]"
              >
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
        const isRightHalf = barX > width * 0.5;
        const maxTooltipWidth = Math.min(240, Math.max(150, width - 24));

        let tooltipStyle: React.CSSProperties;
        if (isRightHalf) {
          tooltipStyle = {
            right: `${Math.max(10, width - (barX - barWidth / 2) + 14)}px`,
            top: '50%',
            transform: 'translateY(-50%)',
            maxWidth: `${maxTooltipWidth}px`,
          };
        } else {
          tooltipStyle = {
            left: `${Math.max(10, barX + barWidth / 2 + 14)}px`,
            top: '50%',
            transform: 'translateY(-50%)',
            maxWidth: `${maxTooltipWidth}px`,
          };
        }

        return (
          <div
            className="pointer-events-none absolute z-10 w-max rounded-xl border border-slate-200 dark:border-zinc-700/50 bg-white/95 dark:bg-zinc-900/95 p-3 text-left text-[11px] leading-normal text-slate-800 dark:text-white shadow-xl shadow-slate-900/10 dark:shadow-black/60 overflow-hidden backdrop-blur-md"
            style={tooltipStyle}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 break-words">{data[hoveredIdx].label}</span>
              {isSingleStudent && studentName && (
                <span className="text-[9.5px] font-semibold text-slate-500 dark:text-zinc-400 truncate max-w-[140px]" title={studentName}>
                  {studentName}
                </span>
              )}
            </div>
            {series.map((item) => (
              <div key={item.key} className="mt-1 flex items-center justify-between gap-4">
                <span style={{ color: item.color }}>{item.label}</span>
                <span className="font-bold text-slate-800 dark:text-white">{data[hoveredIdx][item.key]}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

const MobileRiskTrendChart: React.FC<{
  data: RiskTrendPoint[];
  total: number;
  isSingleStudent: boolean;
  studentName?: string;
}> = ({ data, total, isSingleStudent, studentName }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Compact bar slot and responsive margins so bars and labels fit comfortably on mobile
  const minBarSlot = 44;
  const paddingLeft = 38;
  const paddingRight = 24;
  const paddingTop = 20;
  const paddingBottom = 48;

  const width = Math.max(300, data.length * minBarSlot + paddingLeft + paddingRight);
  const height = 240;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const axisSteps = isSingleStudent ? [0, 1] : [0, 25, 50, 75, 100];

  const series = [
    { key: 'high' as const, color: '#EF4444', label: 'High Risk' },
    { key: 'medium' as const, color: '#F59E0B', label: 'Medium Risk' },
    { key: 'low' as const, color: '#22C55E', label: 'Low Risk' },
  ];

  // Dynamic bar width: 12px to 18px (clean, proportionate, non-bulky)
  const barWidth = Math.max(12, Math.min(18, (chartWidth / (data.length || 1)) * 0.38));
  const getBarX = (index: number) =>
    paddingLeft + barWidth / 2 + (index * (chartWidth - barWidth)) / (data.length - 1 || 1);

  return (
    <div className="relative select-none w-full max-w-full min-w-0 overflow-hidden">
      {/* Mobile Swipe / Tap hint */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 pb-1.5 px-1 font-medium">
        <span>Tap bar for details</span>
        <span className="text-[11px] text-gray-400">Swipe to view history &rarr;</span>
      </div>

      <div className="w-full max-w-full min-w-0 overflow-x-auto mobile-scroll-table overscroll-x-contain -mx-1 px-1 rounded-md">
        <div style={{ minWidth: `${width}px`, width: `${width}px` }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-[240px] block"
            role="img"
            aria-label="Risk level trend chart"
          >
            {/* Horizontal Grid lines and crisp Y-axis labels (0, 25, 50, 75, 100) */}
            {axisSteps.map((value) => {
              const y = paddingTop + chartHeight - (isSingleStudent ? value * chartHeight : (value / 100) * chartHeight);
              return (
                <g key={value}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="var(--slate-200, #E2E8F0)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    className="opacity-70 dark:opacity-20"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-slate-500 dark:fill-slate-400 font-semibold"
                    style={{ fontSize: '10px' }}
                  >
                    {value}
                  </text>
                </g>
              );
            })}

            {/* Bars and X-axis Labels */}
            {data.map((point, index) => {
              const x = getBarX(index);
              const shouldShowLabel = data.length <= 6 || index % 2 === 0 || index === data.length - 1;
              const shortLabel = formatShortDateRange(point.label);

              const highCount = point.high || 0;
              const medCount = point.medium || 0;
              const lowCount = point.low || 0;
              const pointTotal = isSingleStudent ? 1 : (highCount + medCount + lowCount || 1);

              const lowPct = (lowCount / pointTotal) * 100;
              const medPct = (medCount / pointTotal) * 100;
              const highPct = (highCount / pointTotal) * 100;

              const lowH = (lowPct / 100) * chartHeight;
              const medH = (medPct / 100) * chartHeight;
              const highH = (highPct / 100) * chartHeight;

              const segments = [
                { key: 'low', color: '#22C55E', height: lowH, count: lowCount, pct: lowPct },
                { key: 'medium', color: '#F59E0B', height: medH, count: medCount, pct: medPct },
                { key: 'high', color: '#EF4444', height: highH, count: highCount, pct: highPct },
              ];

              let currentY = paddingTop + chartHeight;
              const isHovered = hoveredIdx === index;

              return (
                <g
                  key={point.dateKey}
                  onMouseEnter={() => setHoveredIdx(index)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setHoveredIdx(hoveredIdx === index ? null : index);
                  }}
                  onClick={() => setHoveredIdx(hoveredIdx === index ? null : index)}
                  className="cursor-pointer"
                >
                  {/* Stacked Bar segments: green, orange, red */}
                  {segments.map((seg) => {
                    if (seg.height <= 0) return null;
                    currentY -= seg.height;
                    return (
                      <rect
                        key={seg.key}
                        x={x - barWidth / 2}
                        y={currentY}
                        width={barWidth}
                        height={seg.height}
                        fill={seg.color}
                        fillOpacity={isHovered ? 1 : 0.88}
                        stroke="#FFFFFF"
                        strokeWidth="1.2"
                        rx={seg.key === 'high' || (seg.key === 'medium' && highH === 0) || (seg.key === 'low' && highH === 0 && medH === 0) ? 3 : 0}
                      />
                    );
                  })}

                  {/* Hover outline ring */}
                  {isHovered && (
                    <rect
                      x={x - barWidth / 2 - 2}
                      y={paddingTop + chartHeight - (lowH + medH + highH) - 2}
                      width={barWidth + 4}
                      height={lowH + medH + highH + 4}
                      fill="none"
                      stroke="#0052B7"
                      strokeWidth="2"
                      rx={4}
                      className="pointer-events-none"
                    />
                  )}

                  {/* X-Axis Rotated ~25° Date Label */}
                  {shouldShowLabel && (
                    <g transform={`translate(${x}, ${paddingTop + chartHeight + 10})`}>
                      <text
                        transform="rotate(-25)"
                        textAnchor="end"
                        className="fill-slate-600 dark:fill-slate-300 select-none font-semibold"
                        style={{ fontSize: '10px' }}
                      >
                        {shortLabel}
                      </text>
                    </g>
                  )}

                  {/* Wide touch region */}
                  <rect
                    x={x - Math.max(barWidth, 40) / 2}
                    y={paddingTop}
                    width={Math.max(barWidth, 40)}
                    height={chartHeight + 40}
                    fill="transparent"
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Floating Mobile Tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (() => {
        const p = data[hoveredIdx];
        const barX = getBarX(hoveredIdx);
        const barLeftPct = ((barX - barWidth / 2) / width) * 100;
        const mobileLeftPct = Math.max(4, Math.min(60, barLeftPct - 15));

        const highCount = p.high || 0;
        const medCount = p.medium || 0;
        const lowCount = p.low || 0;
        const pointTotal = isSingleStudent ? 1 : (highCount + medCount + lowCount);

        return (
          <div
            className="pointer-events-none absolute z-20 min-w-[160px] max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-900/95 p-3 text-left text-xs leading-normal text-slate-800 dark:text-white shadow-xl dark:shadow-2xl shadow-slate-900/10 dark:shadow-black/60 backdrop-blur-sm"
            style={{
              left: `${mobileLeftPct}%`,
              top: '12px',
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-700/80 pb-1.5 mb-2">
              <span className="text-xs font-bold uppercase text-slate-700 dark:text-zinc-200">{p.label}</span>
              {isSingleStudent && studentName && (
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 truncate max-w-[120px]" title={studentName}>
                  {studentName}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {series.map((item) => {
                const count = p[item.key] || 0;
                const pct = pointTotal > 0 ? Math.round((count / pointTotal) * 100) : 0;
                return (
                  <div key={item.key} className="flex items-center justify-between gap-4 text-xs font-medium">
                    <span className="flex items-center gap-1.5" style={{ color: item.color }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {isSingleStudent ? (count > 0 ? 'Active' : 'No') : `${count} (${pct}%)`}
                    </span>
                  </div>
                );
              })}
            </div>

            {!isSingleStudent && (
              <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-zinc-700/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-semibold">
                <span>Total evaluated</span>
                <span className="text-slate-800 dark:text-white">{pointTotal} students</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

const RiskTrendChart: React.FC<{
  data: RiskTrendPoint[];
  total: number;
  isSingleStudent: boolean;
  studentName?: string;
  emptyLabel?: string;
}> = ({ data, total, isSingleStudent, studentName, emptyLabel = 'No recorded performance data' }) => {
  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-xs font-medium text-gray-400 dark:text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      {/* ── DESKTOP VIEW (Preserves original desktop layout exactly) ── */}
      <div className="hidden sm:block">
        <DesktopRiskTrendChart
          data={data}
          total={total}
          isSingleStudent={isSingleStudent}
          studentName={studentName}
        />
      </div>

      {/* ── MOBILE VIEW (Phone-specific responsive layout, readable labels, no clipping) ── */}
      <div className="block sm:hidden">
        <MobileRiskTrendChart
          data={data}
          total={total}
          isSingleStudent={isSingleStudent}
          studentName={studentName}
        />
      </div>
    </>
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
    <span className="pointer-events-none absolute right-full top-1/2 z-20 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-white shadow-lg group-hover:block group-focus-within:block">
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
    <span className="pointer-events-none absolute left-0 top-full mt-2 sm:left-full sm:top-1/2 sm:mt-0 sm:ml-2 z-20 hidden w-72 sm:w-80 max-w-[calc(100vw-2rem)] sm:-translate-y-1/2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5 sm:px-3 sm:py-2 text-left text-xs font-semibold leading-relaxed text-slate-800 dark:text-white shadow-lg group-hover:block group-focus-within:block">
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
  const formatted = level ? level.charAt(0).toUpperCase() + level.slice(1).toLowerCase() : 'Basic';
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 dark:bg-[#1A1A1A] dark:text-slate-300 dark:border-[#262626]">
      {formatted}
    </span>
  );
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
  const [sortField, setSortField] = useState<OverallSortField | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [attendanceSortField, setAttendanceSortField] = useState<AttendanceDetailSortField | null>(null);
  const [attendanceSortAsc, setAttendanceSortAsc] = useState(true);
  const [scoreSortField, setScoreSortField] = useState<ScoreDetailSortField | null>(null);
  const [scoreSortAsc, setScoreSortAsc] = useState(true);

  const [activeSystemSem, setActiveSystemSem] = useState(() => getActiveSystemSemester());

  useEffect(() => {
    academicService.getCurrentSchoolYear().then((sy) => {
      if (sy && sy.current_semester) {
        setActiveSystemSemester(sy.current_semester as any);
        setActiveSystemSem(sy.current_semester as any);
      }
    }).catch(() => {});

    const handleSemChange = (e: any) => {
      const newSem = e?.detail?.semester || getActiveSystemSemester();
      setActiveSystemSem(newSem);
    };

    window.addEventListener('system_semester_changed', handleSemChange);
    return () => window.removeEventListener('system_semester_changed', handleSemChange);
  }, []);

  const assignedMilestone = useMemo<MilestoneType>(() => {
    return getActiveSystemMilestone();
  }, [activeSystemSem]);



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
        const studentAtt = safeAttendance.filter((a: Attendance) => getLogUserId(a) === String(row.student.id));
        return { ...row, absentCount: studentAtt.filter((a: Attendance) => isAbsentStatus(a.status)).length };
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

  const handleSort = (field: OverallSortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const hasMultipleOverallAralLevels = useMemo(() => {
    const distinct = new Set(rows.map((r) => (r.student.aral_level || '').trim().toLowerCase()).filter(Boolean));
    return distinct.size > 1;
  }, [rows]);

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
        if (sortField === 'student') {
          const cmp = compareNamesByLastName(a.student, b.student);
          return sortAsc ? cmp : -cmp;
        }
        if (sortField === 'aralLevel') {
          const valA = (a.student.aral_level || '').toLowerCase();
          const valB = (b.student.aral_level || '').toLowerCase();
          const rankA = aralLevelRank[valA] ?? 0;
          const rankB = aralLevelRank[valB] ?? 0;
          if (rankA !== rankB) return sortAsc ? rankA - rankB : rankB - rankA;
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        let valA: any = a[sortField as keyof ExtendedRiskRow];
        let valB: any = b[sortField as keyof ExtendedRiskRow];
        if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
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
  const highRiskRows = useMemo(() => rows.filter((row) => row.riskTier === 'High'), [rows]);
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
    const todayStr = toLocalDateKey(new Date());
    const todayLogs = attendanceLogs.filter((log) => {
      const d = getRecordDate(log);
      return d ? toLocalDateKey(d) === todayStr : false;
    });
    return {
      present: todayLogs.filter((log) => isAttendedStatus(log.status)).length,
      absent: todayLogs.filter((log) => isAbsentStatus(log.status)).length,
    };
  }, [attendanceLogs]);

  const avgAttendance = useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.round((rows.reduce((acc, r) => acc + r.attendanceRate, 0) / rows.length) * 100) / 100;
  }, [rows]);

  const scoreSummary = useMemo(() => {
    const todayStr = toLocalDateKey(new Date());
    const scoreRecords = grades.filter((grade) => {
      if (grade.component_type === 'attendance' || grade.remarks === 'Not Taken') return false;
      const d = getRecordDate(grade);
      return d ? toLocalDateKey(d) === todayStr : false;
    });
    return {
      passed: scoreRecords.filter((grade) => Number(grade.total_score) > 0 && (Number(grade.score) / Number(grade.total_score)) >= 0.7).length,
      failed: scoreRecords.filter((grade) => Number(grade.total_score) > 0 && (Number(grade.score) / Number(grade.total_score)) < 0.7).length,
    };
  }, [grades]);

  const avgScore = useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.round((rows.reduce((acc, r) => acc + r.scoreAvg, 0) / rows.length) * 100) / 100;
  }, [rows]);
  const attendanceDetails = useMemo(() => {
    const list: (ExtendedRiskRow & {
      description: EntryDescriptionType;
      present: number;
      absent: number;
      attendanceAverage: number;
    })[] = [];

    rows.forEach((row) => {
      const allStudentLogs = attendanceLogs.filter((log) => getLogUserId(log) === String(row.student.id));

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
        const present = studentLogs.filter((log) => isAttendedStatus(log.status)).length;
        const absent = studentLogs.filter((log) => isAbsentStatus(log.status)).length;
        list.push({
          ...row,
          description: desc,
          present,
          absent,
          attendanceAverage: studentLogs.length ? (present / studentLogs.length) * 100 : 0,
        });
      });
    });

    return list
      .filter((row) => matchesSearch(attendanceSearch, row.student.full_name, row.student.first_name, row.student.last_name, row.student.lrn, row.description))
      .sort((firstRow, secondRow) => {
        if (attendanceSortField === null) return 0;
        if (attendanceSortField === 'aralLevel') {
          const rankA = aralLevelRank[(firstRow.student.aral_level || '').toLowerCase()] ?? 0;
          const rankB = aralLevelRank[(secondRow.student.aral_level || '').toLowerCase()] ?? 0;
          if (rankA !== rankB) return attendanceSortAsc ? rankA - rankB : rankB - rankA;
          return attendanceSortAsc ? (firstRow.student.aral_level || '').localeCompare(secondRow.student.aral_level || '') : (secondRow.student.aral_level || '').localeCompare(firstRow.student.aral_level || '');
        }
        if (attendanceSortField === 'student') {
          const cmp = compareNamesByLastName(firstRow.student, secondRow.student);
          return attendanceSortAsc ? cmp : -cmp;
        }
        const firstValue =
          attendanceSortField === 'description'
            ? firstRow.description
            : (firstRow as unknown as Record<string, string | number>)[attendanceSortField];
        const secondValue =
          attendanceSortField === 'description'
            ? secondRow.description
            : (secondRow as unknown as Record<string, string | number>)[attendanceSortField];
        if (typeof firstValue === 'string' && typeof secondValue === 'string') {
          return attendanceSortAsc ? firstValue.localeCompare(secondValue) : secondValue.localeCompare(firstValue);
        }
        return attendanceSortAsc ? Number(firstValue) - Number(secondValue) : Number(secondValue) - Number(firstValue);
      });
  }, [rows, attendanceLogs, attendanceSearch, attendanceDescFilter, attendanceSortField, attendanceSortAsc]);

  const hasMultipleAttendanceAralLevels = useMemo(() => {
    const distinct = new Set(attendanceDetails.map((r) => (r.student.aral_level || '').trim().toLowerCase()).filter(Boolean));
    return distinct.size > 1;
  }, [attendanceDetails]);

  const scoreDetails = useMemo(() => {
    const list: (ExtendedRiskRow & {
      description: EntryDescriptionType;
      passed: number;
      failed: number;
      scoreAverage: number;
    })[] = [];

    rows.forEach((row) => {
      const allStudentGrades = grades.filter(
        (grade) => getGradeStudentId(grade) === String(row.student.id) && grade.component_type !== 'attendance' && grade.remarks !== 'Not Taken'
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
        if (scoreSortField === 'aralLevel') {
          const rankA = aralLevelRank[(firstRow.student.aral_level || '').toLowerCase()] ?? 0;
          const rankB = aralLevelRank[(secondRow.student.aral_level || '').toLowerCase()] ?? 0;
          if (rankA !== rankB) return scoreSortAsc ? rankA - rankB : rankB - rankA;
          return scoreSortAsc ? (firstRow.student.aral_level || '').localeCompare(secondRow.student.aral_level || '') : (secondRow.student.aral_level || '').localeCompare(firstRow.student.aral_level || '');
        }
        if (scoreSortField === 'student') {
          const cmp = compareNamesByLastName(firstRow.student, secondRow.student);
          return scoreSortAsc ? cmp : -cmp;
        }
        const firstValue =
          scoreSortField === 'description'
            ? firstRow.description
            : (firstRow as unknown as Record<string, string | number>)[scoreSortField];
        const secondValue =
          scoreSortField === 'description'
            ? secondRow.description
            : (secondRow as unknown as Record<string, string | number>)[scoreSortField];
        if (typeof firstValue === 'string' && typeof secondValue === 'string') {
          return scoreSortAsc ? firstValue.localeCompare(secondValue) : secondValue.localeCompare(firstValue);
        }
        return scoreSortAsc ? Number(firstValue) - Number(secondValue) : Number(secondValue) - Number(firstValue);
      });
  }, [rows, grades, scoreSearch, scoreDescFilter, scoreSortField, scoreSortAsc]);

  const hasMultipleScoreAralLevels = useMemo(() => {
    const distinct = new Set(scoreDetails.map((r) => (r.student.aral_level || '').trim().toLowerCase()).filter(Boolean));
    return distinct.size > 1;
  }, [scoreDetails]);

  const handleDetailSort = <Field extends string>(field: Field, currentField: Field | null, setField: React.Dispatch<React.SetStateAction<Field | null>>, setAscending: React.Dispatch<React.SetStateAction<boolean>>, ascending: boolean) => {
    if (currentField === field) setAscending(!ascending);
    else { setField(field); setAscending(true); }
  };
  const SortHeader: React.FC<{ field: string; children: React.ReactNode; align?: string; activeField?: string | null; ascending?: boolean; onSort?: (field: string) => void }> = ({ field, children, align = 'left', activeField = sortField, ascending = sortAsc, onSort = (value) => handleSort(value as OverallSortField) }) => (
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
      <div className="space-y-4 skeleton-container" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* ── View Tab Switcher Skeleton ── */}
        <div className="flex w-full rounded-md bg-gray-100 dark:bg-[#111111] p-0.5 gap-0.5 animate-pulse skeleton-row-1">
          <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
        </div>

        {/* ── 3 Summary KPI Cards Skeleton ── */}
        <div className="grid gap-3 sm:grid-cols-3 skeleton-row-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 min-h-[100px] flex items-center gap-3.5 animate-pulse"
            >
              <div className="w-10 h-10 rounded-md bg-gray-200 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
                <div className="h-7 w-14 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-2 w-44 rounded bg-gray-100 dark:bg-gray-800/60 mt-2" />
              </div>
            </div>
          ))}
        </div>

        {/* ── Chart Card Skeleton ── */}
        <div className="w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 animate-pulse skeleton-row-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1.5">
              <div className="h-4 w-52 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-40 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 w-44 rounded bg-gray-100 dark:bg-gray-800 hidden sm:block" />
              <div className="h-7 w-24 rounded-md bg-gray-100 dark:bg-gray-800" />
              <div className="h-7 w-28 rounded-md bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
          <div className="mt-4">
            <div className="h-[228px] w-full rounded-md bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A]" />
          </div>
        </div>

        {/* ── Table Card Skeleton ── */}
        <div className="space-y-2 skeleton-row-3">
          <div className="w-full overflow-hidden rounded-md border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] animate-pulse">
            {/* Table toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div className="space-y-1">
                <div className="h-4 w-52 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="h-8 w-64 rounded-md bg-gray-100 dark:bg-gray-800" />
            </div>

            {/* Table header bar */}
            <div className="bg-gray-50 dark:bg-[#111111] border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-2.5 flex items-center justify-between">
              <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-2.5 w-28 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
            </div>

            {/* Table rows */}
            <div className="divide-y divide-gray-100 dark:divide-[#1A1A1A]">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-8 h-8 rounded-md bg-gray-200 dark:bg-gray-800 shrink-0" />
                  <div className="space-y-1">
                    <div className="h-3 w-36 rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-2 w-24 rounded bg-gray-100 dark:bg-gray-800" />
                  </div>
                  <div className="h-4 w-16 rounded-full bg-gray-100 dark:bg-gray-800 ml-8" />
                  <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800 ml-auto" />
                  <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800 ml-auto" />
                  <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800 ml-auto" />
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
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-md p-4">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load analytics</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-md text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 data-loaded-content" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── View Tab Switcher ── */}
      <div
        className="flex w-full rounded-md bg-gray-100 p-0.5 gap-0.5 dark:bg-[#111111]"
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
            className={`flex-1 h-8 rounded-sm px-4 flex items-center justify-center text-xs font-bold uppercase transition-all ${
              activeAnalyticsTab === tab
                ? 'bg-[var(--brand)] text-white'
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="relative rounded-md border risk-card-high p-4 min-h-[100px] flex flex-col justify-center">
                  <div className="absolute right-3 top-3">
                    <RiskRangeInfo range="Composite score is 69% and below" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-risk-high">
                      <p className="text-[10px] font-bold uppercase tracking-wider">High Risk</p>
                    </div>
                    <p className="text-2xl font-extrabold text-risk-high mt-0.5">{riskCounts.high}</p>
                    <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Students needing immediate intervention</p>
                  </div>
                </div>

                <div className="relative rounded-md border risk-card-medium p-4 min-h-[100px] flex flex-col justify-center">
                  <div className="absolute right-3 top-3">
                    <RiskRangeInfo range="Composite score is between 70% to 85%" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-risk-medium">
                      <p className="text-[10px] font-bold uppercase tracking-wider">Medium Risk</p>
                    </div>
                    <p className="text-2xl font-extrabold text-risk-medium mt-0.5">{riskCounts.moderate}</p>
                    <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Students requiring monitoring</p>
                  </div>
                </div>

                <div className="relative rounded-md border risk-card-low p-4 min-h-[100px] flex flex-col justify-center">
                  <div className="absolute right-3 top-3">
                    <RiskRangeInfo range="Composite score is between 86% to 100%" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-risk-low">
                      <p className="text-[10px] font-bold uppercase tracking-wider">Low Risk</p>
                    </div>
                    <p className="text-2xl font-extrabold text-risk-low mt-0.5">{riskCounts.low}</p>
                    <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Students performing well</p>
                  </div>
                </div>
              </div>

              {/* ── Risk Level Trend Chart ── */}
              <section className="rounded-md border border-gray-200 bg-white p-5 dark:border-[#1A1A1A] dark:bg-[#0A0A0A]" aria-labelledby="risk-overview-heading">
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
                  <div>
                    <h3 id="risk-overview-heading" className="text-sm font-bold uppercase text-gray-900 dark:text-slate-100">RISK LEVEL TREND CHART</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#EF4444' }} />High Risk</span>
                      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} />Medium Risk</span>
                      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#22C55E' }} />Low Risk</span>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <StudentRiskFilter rows={rows} value={riskScope} onChange={setRiskScope} />
                    </label>
                    <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#111111]" role="group" aria-label="Filter risk chart by time period">
                      {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                        <button key={filter} type="button" onClick={() => setRiskTrendFilter(filter)} className={`cursor-pointer rounded-sm px-3 py-1.5 text-[10px] font-bold uppercase transition-all ${riskTrendFilter === filter ? 'bg-[var(--brand)] text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="relative rounded-md border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
                    <RiskTrendChart
                      data={riskTrend}
                      total={riskScopedRows.length}
                      isSingleStudent={riskScope !== 'all'}
                      studentName={selectedRiskStudent?.full_name}
                      emptyLabel={riskTrendFilter === 'day' ? 'No recorded performance data today' : riskTrendFilter === 'week' ? 'No recorded performance data this week' : 'No recorded performance data this month'}
                    />
                  </div>
                </div>
              </section>

              {/* ── Student Performance Details Table ── */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1 text-xs text-gray-500" style={{ fontFamily: 'var(--font-body)' }}>
                  <RiskCalculationInfo />
                </div>
                <div className="bg-white rounded-md border border-gray-200 overflow-hidden dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                  <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3.5 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
                    <div className="min-w-0 flex-1 truncate">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase truncate">STUDENT PERFORMANCE DETAILS</h3>
                      <p className="mt-0.5 text-[10px] sm:text-xs font-normal text-gray-500 dark:text-slate-400 truncate">{filteredAndSortedRows.length} Students</p>
                    </div>
                    <div className="relative w-28 xs:w-36 sm:w-56 shrink-0">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="search"
                        placeholder="Search student..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-7.5 sm:h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-2.5 text-[11px] sm:text-xs font-medium text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white focus:ring-1 focus:ring-[var(--brand)] dark:border-[#262626] dark:bg-[#111111] dark:text-slate-200"
                      />
                    </div>
                  </div>

                  {filteredAndSortedRows.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <Users className="w-8 h-8 mx-auto text-gray-200 dark:text-gray-700" />
                      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">No students found</p>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500">Try adjusting your search criteria.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm font-normal w-full" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                        <thead>
                          <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                            <SortHeader field="student">Student</SortHeader>
                            {hasMultipleOverallAralLevels ? (
                              <SortHeader field="aralLevel">ARAL Level</SortHeader>
                            ) : (
                              <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 select-none">ARAL Level</th>
                            )}
                            <SortHeader field="attendanceRate">Average Attendance Rate</SortHeader>
                            <SortHeader field="scoreAvg">Average Score</SortHeader>
                            <SortHeader field="compositeScore">COMPOSITE SCORE</SortHeader>
                            <SortHeader field="riskTier">Risk Level</SortHeader>
                            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">RISK LEVEL REMARKS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                          {filteredAndSortedRows.map((row) => (
                            <tr key={row.student.id} className="divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-white/5">
                              <td className="px-4 py-3 align-middle">
                                <div>
                                  <div className="font-semibold text-gray-900 dark:text-slate-100 text-xs">{row.student.full_name}</div>
                                  <div className="text-[11px] text-gray-400 dark:text-slate-500 font-mono">LRN: {row.student.lrn || 'N/A'}</div>
                                </div>
                              </td>
                              <td className="px-4 py-3 align-middle">{getAralBadge(row.student.aral_level)}</td>
                              <td className="px-4 py-3 align-middle">
                                <span className={`text-xs font-medium ${getAttendanceRateCls(row.attendanceRate)}`}>
                                  {smartPct(row.attendanceRate)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <span className={`text-xs font-medium ${getScoreAvgCls(row.scoreAvg)}`}>
                                  {smartPct(row.scoreAvg)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <span className={`text-xs font-medium ${getCompositeScoreCls(row.riskTier)}`}>
                                  {smartPct(row.compositeScore)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold border ${getTierCls(row.riskTier)}`}>
                                  {row.riskTier}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-middle">
                                {row.riskTier === 'High' ? (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {row.neededPresentAttendance > 0 && (
                                      <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-300">
                                        Need +{row.neededPresentAttendance} more Present records to improve risk level
                                      </span>
                                    )}
                                    {row.neededPassedScores > 0 && (
                                      <span className="inline-flex items-center rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
                                        Need +{row.neededPassedScores} more Passed records to improve risk level
                                      </span>
                                    )}
                                    {row.neededPresentAttendance === 0 && row.neededPassedScores === 0 && (
                                      <span className="inline-flex items-center rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
                                        Need +1 more Passed record to improve risk level
                                      </span>
                                    )}
                                  </div>
                                ) : row.riskTier === 'Medium' ? (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {row.neededPresentAttendance > 0 && (
                                      <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-300">
                                        Need +{row.neededPresentAttendance} more Present records to improve risk level
                                      </span>
                                    )}
                                    {row.neededPassedScores > 0 && (
                                      <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-300">
                                        Need +{row.neededPassedScores} more Passed records to improve risk level
                                      </span>
                                    )}
                                    {row.neededPresentAttendance === 0 && row.neededPassedScores === 0 && (
                                      <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-300">
                                        Moderate Standing (On Track)
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-300">
                                    On Track (Safe Standing)
                                  </span>
                                )}
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
              <div className="grid w-full gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-emerald-500 dark:border-emerald-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#0A0A0A]">
                  <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={3} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Present Today</p>
                    <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">{attendanceSummary.present}</p>
                    <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Students marked present today</p>
                  </div>
                </div>
                <div className="rounded-md border border-rose-500 dark:border-rose-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#0A0A0A]">
                  <X className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Absent Today</p>
                    <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-100 mt-0.5">{attendanceSummary.absent}</p>
                    <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Students marked absent today</p>
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-4 min-h-[100px] flex flex-col justify-center dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">Average Attendance</p>
                    <p className={`text-2xl font-extrabold mt-0.5 ${attendanceLogs.length === 0 ? 'text-gray-400 dark:text-slate-500' : avgAttendance >= 81 ? 'text-risk-low' : avgAttendance >= 75 ? 'text-risk-medium' : 'text-risk-high'}`}>
                      {attendanceLogs.length === 0 ? '—' : `${smartPct(avgAttendance)}%`}
                    </p>
                    <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Class average attendance rate</p>
                  </div>
                </div>
              </div>

              {/* Attendance Trend Chart */}
              <div className="w-full rounded-md border border-gray-200 bg-white p-5 dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
                  <div>
                    <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-slate-100">STUDENTS ATTENDANCE RATE TREND CHART</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#0052B7]" />Attendance Rate</span>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <StudentRiskFilter rows={rows} value={attendanceScope} onChange={setAttendanceScope} />
                    </label>
                    <div className="flex rounded-md bg-gray-100 p-0.5 dark:bg-[#111111]" aria-label="Attendance trend period">
                      {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                        <button key={filter} type="button" onClick={() => setAttendanceFilter(filter)} className={`rounded-sm px-3 py-1.5 text-[10px] font-bold uppercase transition-all ${attendanceFilter === filter ? 'bg-[var(--brand)] text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="relative mt-4 h-64 sm:h-72 w-full rounded-md border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
                  <TrendChart
                    data={attendanceTrend}
                    color="#0052B7"
                    emptyLabel={attendanceFilter === 'day' ? 'No recorded attendance today' : attendanceFilter === 'week' ? 'No recorded attendance this week' : 'No recorded attendance this month'}
                    valueLabel={selectedAttendanceStudent ? selectedAttendanceStudent.full_name : 'Class Average Attendance'}
                    trendFilter={attendanceFilter}
                  />
                </div>
              </div>

              {/* Student Attendance Details Table */}
              <div className="w-full overflow-hidden rounded-md border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                <div className="overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3.5 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
                    <div className="min-w-0 flex-1 truncate">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase truncate">STUDENT ATTENDANCE DETAILS</h3>
                      <p className="mt-0.5 text-[10px] sm:text-xs font-normal text-gray-500 dark:text-slate-400 truncate">{attendanceDetails.length} Students</p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
                      {/* Description Filter */}
                      <div className="flex bg-gray-100 dark:bg-[#111111] rounded-md p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
                        {([
                          ['all', 'All'],
                          ['Intervention Activity', 'Intervention'],
                          ['milestone', assignedMilestone],
                        ] as const).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setAttendanceDescFilter(val)}
                            className={`rounded-sm px-2 sm:px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                              attendanceDescFilter === val
                                ? 'bg-[var(--brand)] text-white'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="relative w-28 xs:w-36 sm:w-48 shrink-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input type="search" aria-label="Search attendance students" placeholder="Search student..." value={attendanceSearch} onChange={(event) => setAttendanceSearch(event.target.value)} className="h-7.5 sm:h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-2.5 text-[11px] sm:text-xs font-medium text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white focus:ring-1 focus:ring-[var(--brand)] dark:border-[#262626] dark:bg-[#111111] dark:text-slate-200" />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm font-normal" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                      <thead>
                        <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                          <SortHeader field="student" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>Student</SortHeader>
                          {hasMultipleAttendanceAralLevels ? (
                            <SortHeader field="aralLevel" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>ARAL Level</SortHeader>
                          ) : (
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 select-none text-left">ARAL Level</th>
                          )}
                          <SortHeader field="description" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>DESCRIPTION</SortHeader>
                          <SortHeader field="present" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>Total Present</SortHeader>
                          <SortHeader field="absent" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>Total Absent</SortHeader>
                          <SortHeader field="attendanceAverage" activeField={attendanceSortField} ascending={attendanceSortAsc} onSort={(field) => handleDetailSort(field as AttendanceDetailSortField, attendanceSortField, setAttendanceSortField, setAttendanceSortAsc, attendanceSortAsc)}>Average Attendance Rate</SortHeader>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">{attendanceDetails.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-gray-400">No students found</td></tr> : attendanceDetails.map((row, idx) => <tr key={`${row.student.id}-${row.description}-${idx}`} className="divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-white/5"><td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100 text-xs">{row.student.full_name}</td><td className="px-4 py-3">{getAralBadge(row.student.aral_level)}</td><td className="px-4 py-3 text-left"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${row.description !== 'Intervention Activity' ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{row.description}</span></td><td className="px-4 py-3 font-normal text-emerald-600 text-xs">{row.present}</td><td className="px-4 py-3 font-normal text-rose-600 text-xs">{row.absent}</td><td className="px-4 py-3 font-normal"><span className={`text-xs font-medium ${getAttendanceRateCls(row.attendanceAverage)}`}>{smartPct(row.attendanceAverage)}%</span></td></tr>)}</tbody>
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
              <div className="grid w-full gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-emerald-500 dark:border-emerald-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#0A0A0A]">
                  <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={3} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Passed Today</p>
                    <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">{scoreSummary.passed}</p>
                    <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Assessments scored ≥ 70% today</p>
                  </div>
                </div>
                <div className="rounded-md border border-rose-500 dark:border-rose-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#0A0A0A]">
                  <X className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Failed Today</p>
                    <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-100 mt-0.5">{scoreSummary.failed}</p>
                    <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Assessments scored ≤ 69% today</p>
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-4 min-h-[100px] flex flex-col justify-center dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">Average Score</p>
                    <p className={`text-2xl font-extrabold mt-0.5 ${grades.filter((g) => g.component_type !== 'attendance' && g.remarks !== 'Not Taken').length === 0 ? 'text-gray-400 dark:text-slate-500' : avgScore >= 81 ? 'text-risk-low' : avgScore >= 75 ? 'text-risk-medium' : 'text-risk-high'}`}>
                      {grades.filter((g) => g.component_type !== 'attendance' && g.remarks !== 'Not Taken').length === 0 ? '—' : `${smartPct(avgScore)}%`}
                    </p>
                    <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Class average score rate</p>
                  </div>
                </div>
              </div>

              {/* Score Trend Chart */}
              <div className="w-full rounded-md border border-gray-200 bg-white p-5 dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
                  <div>
                    <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-slate-100">STUDENTS AVERAGE SCORE TREND CHART</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#0052B7]" />Average Score</span>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <StudentRiskFilter rows={rows} value={scoreScope} onChange={setScoreScope} />
                    </label>
                    <div className="flex rounded-md bg-gray-100 p-0.5 dark:bg-[#111111]" aria-label="Score trend period">
                      {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                        <button key={filter} type="button" onClick={() => setScoreFilter(filter)} className={`rounded-sm px-3 py-1.5 text-[10px] font-bold uppercase transition-all ${scoreFilter === filter ? 'bg-[var(--brand)] text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="relative mt-4 h-64 sm:h-72 w-full rounded-md border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
                  <TrendChart
                    data={scoreTrend}
                    color="#0052B7"
                    emptyLabel={scoreFilter === 'day' ? 'No recorded score today' : scoreFilter === 'week' ? 'No recorded score this week' : 'No recorded score this month'}
                    valueLabel={selectedScoreStudent ? selectedScoreStudent.full_name : 'Class Average Score'}
                    trendFilter={scoreFilter}
                  />
                </div>
              </div>

              {/* Student Score Details Table */}
              <div className="w-full overflow-hidden rounded-md border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                <div className="overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3.5 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
                    <div className="min-w-0 flex-1 truncate">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase truncate">STUDENT SCORE DETAILS</h3>
                      <p className="mt-0.5 text-[10px] sm:text-xs font-normal text-gray-500 dark:text-slate-400 truncate">{scoreDetails.length} Students</p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
                      {/* Description Filter */}
                      <div className="flex bg-gray-100 dark:bg-[#111111] rounded-md p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
                        {([
                          ['all', 'All'],
                          ['Intervention Activity', 'Intervention'],
                          ['milestone', assignedMilestone],
                        ] as const).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setScoreDescFilter(val)}
                            className={`rounded-sm px-2 sm:px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                              scoreDescFilter === val
                                ? 'bg-[var(--brand)] text-white'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="relative w-28 xs:w-36 sm:w-48 shrink-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input type="search" aria-label="Search score students" placeholder="Search student..." value={scoreSearch} onChange={(event) => setScoreSearch(event.target.value)} className="h-7.5 sm:h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-2.5 text-[11px] sm:text-xs font-medium text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white focus:ring-1 focus:ring-[var(--brand)] dark:border-[#262626] dark:bg-[#111111] dark:text-slate-200" />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm font-normal" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                      <thead>
                        <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                          <SortHeader field="student" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>Student</SortHeader>
                          {hasMultipleScoreAralLevels ? (
                            <SortHeader field="aralLevel" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>ARAL Level</SortHeader>
                          ) : (
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 select-none text-left">ARAL Level</th>
                          )}
                          <SortHeader field="description" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>DESCRIPTION</SortHeader>
                          <SortHeader field="passed" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>Total Passed</SortHeader>
                          <SortHeader field="failed" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>Total Failed</SortHeader>
                          <SortHeader field="scoreAverage" activeField={scoreSortField} ascending={scoreSortAsc} onSort={(field) => handleDetailSort(field as ScoreDetailSortField, scoreSortField, setScoreSortField, setScoreSortAsc, scoreSortAsc)}>Average Score</SortHeader>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">{scoreDetails.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-gray-400">No students found</td></tr> : scoreDetails.map((row, idx) => <tr key={`${row.student.id}-${row.description}-${idx}`} className="divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-white/5"><td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100 text-xs">{row.student.full_name}</td><td className="px-4 py-3">{getAralBadge(row.student.aral_level)}</td><td className="px-4 py-3 text-left"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${row.description !== 'Intervention Activity' ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{row.description}</span></td><td className="px-4 py-3 font-normal text-emerald-600 text-xs">{row.passed}</td><td className="px-4 py-3 font-normal text-rose-600 text-xs">{row.failed}</td><td className="px-4 py-3 font-normal"><span className={`text-xs font-medium ${getScoreAvgCls(row.scoreAverage)}`}>{smartPct(row.scoreAverage)}%</span></td></tr>)}</tbody>
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
