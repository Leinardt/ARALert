import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';
import {
  Check,
  ChevronDown,
  AlertCircle,
  Users,
  Info,
  X,
  Filter,
} from 'lucide-react';
import type { Attendance, Grade, User } from '../../types';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';
import { buildTutorClassSections, isStudentInCohort } from '../../utils/tutorCohortHelpers';

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
interface TutorOption {
  id: string;
  name: string;
  user?: User;
}

interface RiskTrendPoint {
  dateKey: string;
  label: string;
  high: number;
  medium: number;
  low: number;
}

const toLocalDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getPeriodDateRange = (filter: TrendFilter): { start: Date; end: Date; label: string } => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (filter === 'day') {
    return { start: startOfToday, end: endOfToday, label: 'Today' };
  } else if (filter === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start: startOfMonth, end: endOfMonth, label: 'This Month' };
  } else {
    // Week: Monday of current week to Sunday end
    const dayOfWeek = now.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const currentWeekMon = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() + diffToMon, 0, 0, 0, 0);
    const currentWeekSun = new Date(currentWeekMon.getFullYear(), currentWeekMon.getMonth(), currentWeekMon.getDate() + 6, 23, 59, 59, 999);
    return { start: currentWeekMon, end: currentWeekSun, label: 'This Week' };
  }
};

const isStudentOfTutor = (s: any, tutorId: string, tutorName?: string): boolean => {
  const assignedId = typeof s.assigned_tutor === 'object' && s.assigned_tutor !== null
    ? String(s.assigned_tutor.id ?? s.assigned_tutor.pk ?? '')
    : String(s.assigned_tutor ?? s.tutor_id ?? (typeof s.tutor === 'object' ? s.tutor?.id : s.tutor) ?? '');
  if (assignedId && assignedId === tutorId) return true;
  if (tutorName && s.assigned_tutor_name && s.assigned_tutor_name.toLowerCase() === tutorName.toLowerCase()) {
    return true;
  }
  return false;
};

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

const buildStudentIdSet = (students: User[]): Set<string> => {
  const ids = new Set<string>();
  students.forEach((student) => {
    if (student.id) ids.add(String(student.id));
    if (student.lrn) ids.add(String(student.lrn));
    if ((student as any).user_id) ids.add(String((student as any).user_id));
    if ((student as any).student_id) ids.add(String((student as any).student_id));
  });
  return ids;
};

const buildTrendPeriods = (
  filter: TrendFilter,
  anchorDate: Date,
  recordedDates: Date[] = []
): { start: Date; end: Date; label: string; dateKey: string }[] => {
  const startOfAnchor = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate(), 0, 0, 0, 0);
  const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (filter === 'day') {
    const schoolDays = getRecentSchoolWeekdays(10, startOfAnchor);
    const basePeriods = schoolDays.map((d) => {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
      return { start, end, label: formatDate(start), dateKey: toLocalDateKey(start) };
    });
    if (recordedDates.length === 0) return basePeriods;

    const minStart = basePeriods.length > 0 ? basePeriods[0].start : startOfAnchor;
    const maxEnd = basePeriods.length > 0 ? basePeriods[basePeriods.length - 1].end : new Date(startOfAnchor.getFullYear(), startOfAnchor.getMonth(), startOfAnchor.getDate() + 1, 0, 0, 0, 0);
    const existingKeys = new Set(basePeriods.map((p) => p.dateKey));
    const extraPeriods: { start: Date; end: Date; label: string; dateKey: string }[] = [];

    recordedDates.forEach((rd) => {
      if (rd >= minStart && rd < maxEnd) {
        const start = new Date(rd.getFullYear(), rd.getMonth(), rd.getDate(), 0, 0, 0, 0);
        const dateKey = toLocalDateKey(start);
        if (!existingKeys.has(dateKey)) {
          existingKeys.add(dateKey);
          const end = new Date(rd.getFullYear(), rd.getMonth(), rd.getDate() + 1, 0, 0, 0, 0);
          extraPeriods.push({ start, end, label: formatDate(start), dateKey });
        }
      }
    });

    if (extraPeriods.length > 0) {
      return [...basePeriods, ...extraPeriods].sort((a, b) => a.start.getTime() - b.start.getTime()).slice(-10);
    }
    return basePeriods;
  }

  const periodCount = 6;
  return Array.from({ length: periodCount }, (_, index) => {
    const offset = periodCount - 1 - index;
    let start: Date;
    let end: Date;
    let label: string;
    if (filter === 'month') {
      start = new Date(startOfAnchor.getFullYear(), startOfAnchor.getMonth() - offset, 1, 0, 0, 0, 0);
      end = new Date(startOfAnchor.getFullYear(), startOfAnchor.getMonth() - offset + 1, 1, 0, 0, 0, 0);
      label = start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    } else {
      const dayOfWeek = startOfAnchor.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const currentWeekMon = new Date(startOfAnchor.getFullYear(), startOfAnchor.getMonth(), startOfAnchor.getDate() + diffToMon, 0, 0, 0, 0);
      start = new Date(currentWeekMon.getFullYear(), currentWeekMon.getMonth(), currentWeekMon.getDate() - offset * 7, 0, 0, 0, 0);
      const fri = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 4, 0, 0, 0, 0);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, 0, 0, 0, 0);
      label = `${formatDate(start)} – ${formatDate(fri)}`;
    }
    return { start, end, label, dateKey: toLocalDateKey(start) };
  });
};

const buildTrendPoints = (
  students: User[],
  grades: Grade[],
  attendanceLogs: Attendance[],
  metric: 'attendance' | 'score',
  filter: TrendFilter
): TrendPoint[] => {
  const studentIds = buildStudentIdSet(students);
  if (studentIds.size === 0) return [];

  const relevantAttendance = metric === 'attendance'
    ? attendanceLogs.filter((log) => studentIds.has(getLogUserId(log)) && getRecordDate(log) !== null)
    : [];
  const relevantGrades = metric === 'score'
    ? grades.filter((grade) => (
        studentIds.has(getGradeStudentId(grade)) &&
        grade.component_type !== 'attendance' &&
        grade.remarks !== 'Not Taken' &&
        Number(grade.total_score) > 0 &&
        getRecordDate(grade) !== null
      ))
    : [];

  if (metric === 'attendance' && relevantAttendance.length === 0) return [];
  if (metric === 'score' && relevantGrades.length === 0) return [];

  const recordedDates = (metric === 'attendance' ? relevantAttendance : relevantGrades)
    .map((rec) => getRecordDate(rec))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const now = new Date();
  let periods = buildTrendPeriods(filter, now, recordedDates);

  const evaluatePeriods = (periodList: { start: Date; end: Date; label: string; dateKey: string }[]) =>
    periodList.map((period) => {
      if (metric === 'attendance') {
        const records = relevantAttendance.filter((log) => {
          const d = getRecordDate(log);
          return d ? d >= period.start && d < period.end : false;
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

      const scoreRecords = relevantGrades.filter((grade) => {
        const d = getRecordDate(grade);
        return d ? d >= period.start && d < period.end : false;
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

  let points = evaluatePeriods(periods);

  if (points.every(({ point }) => point === null) && recordedDates.length > 0) {
    const latestRecordedDate = recordedDates[recordedDates.length - 1];
    periods = buildTrendPeriods(filter, latestRecordedDate, recordedDates);
    points = evaluatePeriods(periods);
  }

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

const buildRiskTrend = (
  students: User[],
  grades: Grade[],
  attendanceLogs: Attendance[],
  filter: TrendFilter
): RiskTrendPoint[] => {
  const studentIds = buildStudentIdSet(students);
  if (studentIds.size === 0) return [];

  const relevantGrades = grades.filter((grade) => (
    studentIds.has(getGradeStudentId(grade)) &&
    grade.component_type !== 'attendance' &&
    grade.remarks !== 'Not Taken' &&
    getRecordDate(grade) !== null
  ));
  const relevantAttendance = attendanceLogs.filter((log) => (
    studentIds.has(getLogUserId(log)) &&
    getRecordDate(log) !== null
  ));

  if (relevantGrades.length === 0 && relevantAttendance.length === 0) return [];

  const recordedDates = [
    ...relevantGrades.map((g) => getRecordDate(g)),
    ...relevantAttendance.map((a) => getRecordDate(a)),
  ]
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const now = new Date();
  let periods = buildTrendPeriods(filter, now, recordedDates);

  const evaluateRiskPeriods = (periodList: { start: Date; end: Date; label: string; dateKey: string }[]) =>
    periodList.map((period) => {
      const periodGrades = relevantGrades.filter((grade) => {
        const d = getRecordDate(grade);
        return d ? d < period.end : false;
      });
      const periodAttendance = relevantAttendance.filter((log) => {
        const d = getRecordDate(log);
        return d ? d < period.end : false;
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

  let points = evaluateRiskPeriods(periods);

  if (points.every(({ point }) => point === null) && recordedDates.length > 0) {
    const latestRecordedDate = recordedDates[recordedDates.length - 1];
    periods = buildTrendPeriods(filter, latestRecordedDate, recordedDates);
    points = evaluateRiskPeriods(periods);
  }

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

const RiskTrendChart: React.FC<{
  data: RiskTrendPoint[];
  total: number;
  isSingleStudent: boolean;
  studentName?: string;
  emptyLabel: string;
}> = ({ data, total, isSingleStudent, studentName, emptyLabel }) => {
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
  const getBarX = (index: number) => paddingLeft + barWidth / 2 + (index * (chartWidth - barWidth)) / (data.length - 1 || 1);

  if (total === 0 || data.length === 0) {
    return (
      <div className="flex h-52 w-full flex-col items-center justify-center gap-1.5 text-center">
        <Users className="h-6 w-6 text-gray-300 dark:text-zinc-600" />
        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-52 w-full overflow-visible">
        {axisSteps.map((value) => {
          const y = paddingTop + chartHeight - (value / maxValue) * chartHeight;
          return (
            <g key={value}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="var(--slate-200)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6" />
              <text x={paddingLeft - 12} y={y + 3} textAnchor="end" className="fill-slate-400 font-semibold text-[8px]">{value}</text>
            </g>
          );
        })}
        {data.map((point, index) => {
          const x = getBarX(index);
          let currentY = paddingTop + chartHeight;
          return (
            <g key={point.dateKey} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(index)} onMouseLeave={() => setHoveredIdx(null)}>
              {series.map((item) => {
                const count = point[item.key];
                if (count <= 0) return null;
                const segmentHeight = (count / maxValue) * chartHeight;
                currentY -= segmentHeight;
                return (
                  <rect
                    key={item.key}
                    x={x - barWidth / 2}
                    y={currentY}
                    width={barWidth}
                    height={segmentHeight}
                    fill={item.color}
                    rx="1.5"
                    className="transition-opacity hover:opacity-85"
                  />
                );
              })}
              <text x={x} y={height - 8} textAnchor="middle" className="fill-slate-400 font-semibold text-[8px]">{point.label}</text>
            </g>
          );
        })}
      </svg>
      {hoveredIdx !== null && data[hoveredIdx] && (() => {
        const point = data[hoveredIdx];
        const barX = getBarX(hoveredIdx);
        const percentX = (barX / width) * 100;
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
            <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-zinc-400">{point.label}</div>
            {isSingleStudent && studentName && (
              <div className="mt-0.5 text-xs font-bold text-slate-700 dark:text-zinc-200">{studentName}</div>
            )}
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400">
                <span className="flex items-center gap-1.5 text-[10px]"><span className="h-2 w-2 rounded-full bg-rose-500" />High Risk:</span>
                <span className="font-mono font-bold text-[11px]">{point.high}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-amber-600 dark:text-amber-400">
                <span className="flex items-center gap-1.5 text-[10px]"><span className="h-2 w-2 rounded-full bg-amber-500" />Medium Risk:</span>
                <span className="font-mono font-bold text-[11px]">{point.medium}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1.5 text-[10px]"><span className="h-2 w-2 rounded-full bg-emerald-500" />Low Risk:</span>
                <span className="font-mono font-bold text-[11px]">{point.low}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};



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
  <span className="group relative inline-flex items-center gap-2 rounded-full transition hover:bg-gray-100 dark:hover:bg-zinc-800/60 hover:text-gray-700 dark:hover:text-gray-300">
    <button
      type="button"
      aria-label="Show how risk is calculated"
      className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 outline-none"
    >
      HOW RISK LEVEL IS CALCULATED
    </button>
    <button
      type="button"
      aria-label="Show how risk is calculated"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 dark:text-zinc-400 opacity-70 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
    >
      <Info className="h-3.5 w-3.5" />
    </button>
    <span className="pointer-events-none absolute left-0 top-full mt-2 sm:left-full sm:top-1/2 sm:mt-0 sm:ml-2 z-20 hidden w-72 sm:w-80 max-w-[calc(100vw-2rem)] sm:-translate-y-1/2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5 sm:px-3 sm:py-2 text-left text-xs font-semibold leading-relaxed text-slate-800 dark:text-white shadow-lg group-hover:block group-focus-within:block">
      Risk level is calculated from the composite score of a student. Composite Score = 40% (Attendance Rate) + 60% (Average Score)
    </span>
  </span>
);

const getStudentDisplayName = (student?: User | null): string => {
  if (!student) return 'Student';
  const composed = `${student.first_name || ''} ${student.last_name || ''}`.trim();
  return student.full_name || composed || student.username || 'Student';
};

const StudentRiskFilter: React.FC<{ rows: ExtendedRiskRow[]; value: RiskScope; onChange: (value: RiskScope) => void }> = ({ rows, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const selectedRow = rows.find((row) => String(row.student.id) === value);
  const selectedLabel = value === 'all' ? 'ALL STUDENTS' : (selectedRow ? getStudentDisplayName(selectedRow.student) : 'ALL STUDENTS');

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const nameA = getStudentDisplayName(a.student).toLowerCase();
      const nameB = getStudentDisplayName(b.student).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [rows]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  return (
    <div ref={filterRef} className="relative z-30">
      <button
        type="button"
        aria-label="Filter chart by student"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-8 sm:h-9 w-28 xs:w-36 sm:min-w-40 items-center justify-between gap-1.5 sm:gap-3 rounded-xl border border-gray-200 bg-gray-50 dark:border-[#1A1A1A] dark:bg-[#111111] px-2 sm:px-3 text-[11px] sm:text-xs font-semibold tracking-normal text-gray-700 dark:text-slate-200 transition hover:border-gray-300 dark:hover:border-[#262626] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 cursor-pointer shrink-0"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute right-0 sm:left-0 top-full z-50 mt-2 max-h-60 min-w-[200px] sm:min-w-full overflow-y-auto rounded-xl border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] p-1.5 shadow-xl" role="listbox">
          <button
            type="button"
            role="option"
            aria-selected={value === 'all'}
            onClick={() => { onChange('all'); setIsOpen(false); }}
            className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${value === 'all' ? 'bg-[var(--brand)] text-white' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'}`}
          >
            ALL STUDENTS
          </button>
          {sortedRows.map((row) => {
            const studentValue = String(row.student.id);
            const isSelected = value === studentValue;
            const displayName = getStudentDisplayName(row.student);
            return (
              <button
                key={studentValue}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(studentValue); setIsOpen(false); }}
                className={`block w-full truncate rounded-lg px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${isSelected ? 'bg-[var(--brand)] text-white' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'}`}
              >
                {displayName}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};



export const PrincipalAnalytics: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Tutor Filter state
  const [allTutorUsers, setAllTutorUsers] = useState<User[]>([]);
  const [tutors, setTutors] = useState<TutorOption[]>([]);
  const [selectedTutorId, setSelectedTutorId] = useState<'all' | string>(() => {
    const requestedTutor = new URLSearchParams(window.location.search).get('tutorId');
    return requestedTutor || 'all';
  });
  const [isTutorDropdownOpen, setIsTutorDropdownOpen] = useState(false);
  const tutorDropdownRef = useRef<HTMLDivElement>(null);

  // Class Filter state (select which class of tutor to see)
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return new URLSearchParams(window.location.search).get('class') || 'all';
  });
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const classDropdownRef = useRef<HTMLDivElement>(null);

  // Raw data from API
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [allGrades, setAllGrades] = useState<Grade[]>([]);
  const [allAttendanceLogs, setAllAttendanceLogs] = useState<Attendance[]>([]);

  // Computed rows and metrics for currently selected tutor (or all)
  const [rows, setRows] = useState<ExtendedRiskRow[]>([]);
  const [riskCounts, setRiskCounts] = useState({ high: 0, moderate: 0, low: 0 });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<AnalyticsTab>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    return requestedTab === 'overall' || requestedTab === 'attendance' || requestedTab === 'score' ? requestedTab : 'overall';
  });

  const [attendanceFilter, setAttendanceFilter] = useState<TrendFilter>('week');
  const [scoreFilter, setScoreFilter] = useState<TrendFilter>('week');
  const [riskTrendFilter, setRiskTrendFilter] = useState<TrendFilter>('week');

  const [riskScope, setRiskScope] = useState<RiskScope>('all');
  const [attendanceScope, setAttendanceScope] = useState<RiskScope>('all');
  const [scoreScope, setScoreScope] = useState<RiskScope>('all');

  // Close dropdowns when clicked outside
  useEffect(() => {
    const closeDropdown = (e: MouseEvent) => {
      if (tutorDropdownRef.current && !tutorDropdownRef.current.contains(e.target as Node)) {
        setIsTutorDropdownOpen(false);
      }
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target as Node)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', closeDropdown);
    return () => document.removeEventListener('mousedown', closeDropdown);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTutor = params.get('tutorId');
    if (requestedTutor) {
      setSelectedTutorId(requestedTutor);
    } else if (params.has('tutorId') && !requestedTutor) {
      setSelectedTutorId('all');
    }
    const requestedClass = params.get('class');
    if (requestedClass) {
      setSelectedClassId(requestedClass);
    } else if (params.has('class') && !requestedClass) {
      setSelectedClassId('all');
    }
    const requestedTab = params.get('tab');
    if (requestedTab === 'overall' || requestedTab === 'attendance' || requestedTab === 'score') {
      setActiveAnalyticsTab(requestedTab);
    }
  }, [location.search]);

  const handleSelectTutor = (tutorId: 'all' | string) => {
    setSelectedTutorId(tutorId);
    setSelectedClassId('all');
    setIsTutorDropdownOpen(false);
    setIsClassDropdownOpen(false);
    const url = new URL(window.location.href);
    if (tutorId === 'all') {
      url.searchParams.delete('tutorId');
    } else {
      url.searchParams.set('tutorId', tutorId);
    }
    url.searchParams.delete('class');
    window.history.replaceState(null, '', url.pathname + url.search);
  };

  const handleSelectClass = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassDropdownOpen(false);
    const url = new URL(window.location.href);
    if (classId === 'all') {
      url.searchParams.delete('class');
    } else {
      url.searchParams.set('class', classId);
    }
    window.history.replaceState(null, '', url.pathname + url.search);
  };

  // Fetch initial analytics data (tutors, students, grades, attendance)
  const fetchAnalytics = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const [tutorsData, studentsData, gradesData, attendanceData, dashboardData] = await Promise.all([
        userService.getTutors().catch(() => [] as User[]),
        userService.getAllUsers({ role: 'student' }).catch(() => [] as User[]),
        academicService.getGrades().catch(() => [] as Grade[]),
        academicService.getAttendanceHistory().catch(() => [] as Attendance[]),
        academicService.getPrincipalDashboard({ days: 30 }).catch(() => null),
      ]);

      const tutorUserList = Array.isArray(tutorsData) ? tutorsData : [];
      setAllTutorUsers(tutorUserList);

      // Populate Tutors list
      let parsedTutors: TutorOption[] = [];
      if (tutorUserList.length > 0) {
        parsedTutors = tutorUserList.map((t) => ({
          id: String(t.id),
          name: t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.username,
          user: t,
        }));
      } else if (dashboardData?.per_tutor_performance?.length) {
        parsedTutors = dashboardData.per_tutor_performance.map((t) => ({
          id: String(t.tutor_id),
          name: t.tutor_name,
        }));
      } else {
        const tutorMap = new Map<string, string>();
        (gradesData || []).forEach((g: any) => {
          if (g.tutor && g.tutor_name) {
            tutorMap.set(String(g.tutor), g.tutor_name);
          }
        });
        parsedTutors = Array.from(tutorMap.entries()).map(([id, name]) => ({ id, name }));
      }

      setTutors(parsedTutors);
      setAllStudents(Array.isArray(studentsData) ? studentsData : []);
      setAllGrades(Array.isArray(gradesData) ? gradesData : []);
      setAllAttendanceLogs(Array.isArray(attendanceData) ? attendanceData : []);
    } catch (err: any) {
      console.error('Failed to load principal analytics data:', err);
      setError(err?.response?.data?.detail || 'Failed to load school analytics data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [user]);

  // Selected tutor user details
  const selectedTutorUser = useMemo(() => {
    if (selectedTutorId === 'all') return null;
    return allTutorUsers.find((t) => String(t.id) === selectedTutorId) || null;
  }, [allTutorUsers, selectedTutorId]);

  // All students belonging to the currently selected tutor (or school)
  const tutorStudents = useMemo(() => {
    if (selectedTutorId === 'all') return allStudents;
    const tObj = tutors.find((t) => t.id === selectedTutorId);
    return allStudents.filter((s) => isStudentOfTutor(s, selectedTutorId, tObj?.name));
  }, [allStudents, selectedTutorId, tutors]);

  // Available classes for selected tutor (or distinct school cohorts if ALL TUTORS)
  const availableClasses = useMemo<{
    id: string;
    label: string;
    count: number;
    subject?: string;
    aralLevel?: string;
    cohort?: string;
    matchFn: (s: User) => boolean;
  }[]>(() => {
    if (selectedTutorId !== 'all' && selectedTutorUser) {
      const sections = buildTutorClassSections(selectedTutorUser, tutorStudents);
      if (sections.length > 0) {
        return sections.map((sec) => {
          const secStudentIds = new Set(sec.students.map((st) => String(st.id)));
          return {
            id: sec.key,
            label: sec.label,
            count: sec.students.length,
            subject: sec.subject,
            aralLevel: sec.aralLevel,
            cohort: sec.cohort,
            matchFn: (s: User) => secStudentIds.has(String(s.id)) || isStudentInCohort(s, {
              aral_level: sec.aralLevel,
              subject: sec.subject,
              cohort: sec.cohort,
            }),
          };
        });
      }
    }

    // Cohorts from students
    const sourceStudents = selectedTutorId === 'all' ? allStudents : tutorStudents;
    const cohortMap = new Map<string, { count: number; students: User[] }>();
    sourceStudents.forEach((s: any) => {
      const gl = (s.grade_level || '').toUpperCase().trim() || 'UNASSIGNED CLASS';
      const existing = cohortMap.get(gl) || { count: 0, students: [] };
      existing.count += 1;
      existing.students.push(s);
      cohortMap.set(gl, existing);
    });

    return Array.from(cohortMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cohort, info]) => ({
        id: cohort,
        label: cohort,
        count: info.count,
        subject: undefined as string | undefined,
        aralLevel: undefined as string | undefined,
        cohort,
        matchFn: (s: User) => ((s as any).grade_level || '').toUpperCase().trim() === cohort,
      }));
  }, [selectedTutorId, selectedTutorUser, tutorStudents, allStudents]);

  const selectedClassObj = useMemo(() => {
    if (selectedClassId === 'all') return null;
    return availableClasses.find((c) => c.id === selectedClassId) || null;
  }, [selectedClassId, availableClasses]);

  const selectedClassSubject = selectedClassObj?.subject;

  const selectedClassLabel = useMemo(() => {
    if (selectedClassId === 'all') return 'ALL CLASSES';
    return selectedClassObj ? selectedClassObj.label : 'ALL CLASSES';
  }, [selectedClassId, selectedClassObj]);

  // Filter students based on BOTH tutor and class
  const activeStudents = useMemo(() => {
    let list = allStudents;
    if (selectedTutorId !== 'all') {
      const tObj = tutors.find((t) => t.id === selectedTutorId);
      list = list.filter((s) => isStudentOfTutor(s, selectedTutorId, tObj?.name));
    }
    if (selectedClassId !== 'all') {
      const classOpt = availableClasses.find((c) => c.id === selectedClassId);
      if (classOpt) {
        list = list.filter(classOpt.matchFn);
      }
    }
    return list;
  }, [allStudents, selectedTutorId, selectedClassId, tutors, availableClasses]);

  const activeStudentIds = useMemo(() => {
    const ids = new Set<string>();
    activeStudents.forEach((s) => {
      if (s.id) ids.add(String(s.id));
      if (s.lrn) ids.add(String(s.lrn));
      if ((s as any).user_id) ids.add(String((s as any).user_id));
      if ((s as any).student_id) ids.add(String((s as any).student_id));
    });
    return ids;
  }, [activeStudents]);

  const activeGrades = useMemo(() => {
    return allGrades.filter((g: any) => {
      const sid = getGradeStudentId(g);
      if (!activeStudentIds.has(sid)) return false;
      if (selectedClassSubject && selectedClassSubject.toLowerCase() !== 'all') {
        const gradeSub = (g.subject || '').toLowerCase().trim();
        const selSub = selectedClassSubject.toLowerCase().trim();
        if (gradeSub) {
          const isMathSel = selSub.includes('math') || selSub.includes('numeracy');
          const isEnglishSel = selSub.includes('english') || selSub.includes('reading') || selSub.includes('literacy');
          const isFilipinoSel = selSub.includes('filipino') || selSub.includes('tagalog');
          const isScienceSel = selSub.includes('science');

          const isMathGrade = gradeSub.includes('math') || gradeSub.includes('numeracy');
          const isEnglishGrade = gradeSub.includes('english') || gradeSub.includes('reading') || gradeSub.includes('literacy');
          const isFilipinoGrade = gradeSub.includes('filipino') || gradeSub.includes('tagalog');
          const isScienceGrade = gradeSub.includes('science');

          if (isMathSel && (isEnglishGrade || isFilipinoGrade || isScienceGrade) && !isMathGrade) return false;
          if (isEnglishSel && (isMathGrade || isFilipinoGrade || isScienceGrade) && !isEnglishGrade) return false;
          if (isFilipinoSel && (isMathGrade || isEnglishGrade || isScienceGrade) && !isFilipinoGrade) return false;
          if (isScienceSel && (isMathGrade || isEnglishGrade || isFilipinoGrade) && !isScienceGrade) return false;
        }
      }
      return true;
    });
  }, [allGrades, activeStudentIds, selectedClassSubject]);

  const activeAttendanceLogs = useMemo(() => {
    return allAttendanceLogs.filter((a: any) => {
      const uid = getLogUserId(a);
      return activeStudentIds.has(uid);
    });
  }, [allAttendanceLogs, activeStudentIds]);

  // Re-compute rows whenever activeStudents, activeGrades, or activeAttendanceLogs change
  useEffect(() => {
    const baseRows = computeStudentRiskRows(activeStudents, activeGrades, activeAttendanceLogs);
    const extendedRows: ExtendedRiskRow[] = baseRows.map((row) => {
      const studentAtt = activeAttendanceLogs.filter((a: Attendance) => getLogUserId(a) === String(row.student.id));
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
    // Reset student scopes when tutor or class changes
    setRiskScope('all');
    setAttendanceScope('all');
    setScoreScope('all');
  }, [activeStudents, activeGrades, activeAttendanceLogs]);

  // Overall Tab Risk trend points
  const selectedRiskStudent = useMemo(() => {
    if (riskScope === 'all') return undefined;
    return activeStudents.find((student) => String(student.id) === riskScope);
  }, [activeStudents, riskScope]);

  const riskScopedRows = useMemo(() => {
    if (riskScope === 'all') return rows;
    return rows.filter((r) => String(r.student.id) === riskScope);
  }, [rows, riskScope]);

  const displayedRiskCounts = useMemo(() => {
    if (riskScope !== 'all') {
      const studentRow = rows.find((r) => String(r.student.id) === riskScope);
      if (!studentRow) return { high: 0, moderate: 0, low: 0 };
      return {
        high: studentRow.riskTier === 'High' ? 1 : 0,
        moderate: studentRow.riskTier === 'Medium' ? 1 : 0,
        low: studentRow.riskTier === 'Low' ? 1 : 0,
      };
    }
    return riskCounts;
  }, [riskScope, rows, riskCounts]);

  const riskTrend = useMemo(() => {
    const studentsForTrend = riskScope === 'all'
      ? activeStudents
      : activeStudents.filter((student) => String(student.id) === riskScope);
    return buildRiskTrend(studentsForTrend, activeGrades, activeAttendanceLogs, riskTrendFilter);
  }, [activeStudents, activeGrades, activeAttendanceLogs, riskScope, riskTrendFilter]);

  // Attendance Tab Calculations (reactive to attendanceScope and attendanceFilter)
  const scopedAttendanceLogs = useMemo(() => {
    if (attendanceScope === 'all') return activeAttendanceLogs;
    const targetStudent = activeStudents.find((s) => String(s.id) === attendanceScope);
    const targetIds = new Set<string>([attendanceScope]);
    if (targetStudent) {
      if (targetStudent.id) targetIds.add(String(targetStudent.id));
      if (targetStudent.lrn) targetIds.add(String(targetStudent.lrn));
      if ((targetStudent as any).user_id) targetIds.add(String((targetStudent as any).user_id));
      if ((targetStudent as any).student_id) targetIds.add(String((targetStudent as any).student_id));
    }
    return activeAttendanceLogs.filter((a) => {
      const uid = getLogUserId(a);
      return targetIds.has(uid);
    });
  }, [activeAttendanceLogs, attendanceScope, activeStudents]);

  const attendanceSummary = useMemo(() => {
    const { start, end, label } = getPeriodDateRange(attendanceFilter);
    const periodLogs = scopedAttendanceLogs.filter((log) => {
      const d = getRecordDate(log);
      return d ? d >= start && d <= end : false;
    });

    const present = periodLogs.filter((log) => isAttendedStatus(log.status)).length;
    const absent = periodLogs.filter((log) => isAbsentStatus(log.status)).length;
    const total = present + absent;
    const periodRate = total > 0 ? Math.round((present / total) * 10000) / 100 : null;

    return {
      present,
      absent,
      total,
      periodRate,
      periodLabel: label,
    };
  }, [scopedAttendanceLogs, attendanceFilter]);

  const avgAttendance = useMemo(() => {
    if (attendanceSummary.periodRate !== null) {
      return attendanceSummary.periodRate;
    }
    if (attendanceScope !== 'all') {
      const studentRow = rows.find((r) => String(r.student.id) === attendanceScope);
      return studentRow ? studentRow.attendanceRate : 0;
    }
    if (rows.length === 0) return 0;
    return Math.round((rows.reduce((acc, r) => acc + r.attendanceRate, 0) / rows.length) * 100) / 100;
  }, [attendanceSummary, attendanceScope, rows]);

  const selectedAttendanceStudent = useMemo(() => {
    if (attendanceScope === 'all') return undefined;
    return activeStudents.find((student) => String(student.id) === attendanceScope);
  }, [activeStudents, attendanceScope]);

  const attendanceTrend = useMemo(() => {
    const studentsForTrend = attendanceScope === 'all'
      ? activeStudents
      : activeStudents.filter((student) => String(student.id) === attendanceScope);
    return buildTrendPoints(studentsForTrend, activeGrades, activeAttendanceLogs, 'attendance', attendanceFilter);
  }, [activeStudents, activeGrades, activeAttendanceLogs, attendanceScope, attendanceFilter]);

  // Score Tab Calculations (reactive to scoreScope and scoreFilter)
  const scopedGrades = useMemo(() => {
    if (scoreScope === 'all') return activeGrades;
    const targetStudent = activeStudents.find((s) => String(s.id) === scoreScope);
    const targetIds = new Set<string>([scoreScope]);
    if (targetStudent) {
      if (targetStudent.id) targetIds.add(String(targetStudent.id));
      if (targetStudent.lrn) targetIds.add(String(targetStudent.lrn));
      if ((targetStudent as any).user_id) targetIds.add(String((targetStudent as any).user_id));
      if ((targetStudent as any).student_id) targetIds.add(String((targetStudent as any).student_id));
    }
    return activeGrades.filter((g) => {
      const sid = getGradeStudentId(g);
      return targetIds.has(sid);
    });
  }, [activeGrades, scoreScope, activeStudents]);

  const scoreSummary = useMemo(() => {
    const { start, end, label } = getPeriodDateRange(scoreFilter);
    const scoreRecords = scopedGrades.filter((grade) => {
      if (grade.component_type === 'attendance' || grade.remarks === 'Not Taken') return false;
      const d = getRecordDate(grade);
      return d ? d >= start && d <= end : false;
    });

    const passed = scoreRecords.filter(
      (grade) => Number(grade.total_score) > 0 && (Number(grade.score) / Number(grade.total_score)) >= 0.7
    ).length;
    const failed = scoreRecords.filter(
      (grade) => Number(grade.total_score) > 0 && (Number(grade.score) / Number(grade.total_score)) < 0.7
    ).length;
    const total = passed + failed;

    const validScores = scoreRecords
      .filter((grade) => Number(grade.total_score) > 0)
      .map((grade) => (Number(grade.score) / Number(grade.total_score)) * 100);
    const periodAvg = validScores.length > 0 ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 100) / 100 : null;

    return {
      passed,
      failed,
      total,
      periodAvg,
      periodLabel: label,
    };
  }, [scopedGrades, scoreFilter]);

  const avgScore = useMemo(() => {
    if (scoreSummary.periodAvg !== null) {
      return scoreSummary.periodAvg;
    }
    if (scoreScope !== 'all') {
      const studentRow = rows.find((r) => String(r.student.id) === scoreScope);
      return studentRow ? studentRow.scoreAvg : 0;
    }
    if (rows.length === 0) return 0;
    return Math.round((rows.reduce((acc, r) => acc + r.scoreAvg, 0) / rows.length) * 100) / 100;
  }, [scoreSummary, scoreScope, rows]);

  const selectedScoreStudent = useMemo(() => {
    if (scoreScope === 'all') return undefined;
    return activeStudents.find((student) => String(student.id) === scoreScope);
  }, [activeStudents, scoreScope]);

  const scoreTrend = useMemo(() => {
    const studentsForTrend = scoreScope === 'all'
      ? activeStudents
      : activeStudents.filter((student) => String(student.id) === scoreScope);
    return buildTrendPoints(studentsForTrend, activeGrades, activeAttendanceLogs, 'score', scoreFilter);
  }, [activeStudents, activeGrades, activeAttendanceLogs, scoreScope, scoreFilter]);

  const selectedTutorLabel = useMemo(() => {
    if (selectedTutorId === 'all') return 'ALL TUTORS';
    const found = tutors.find((t) => t.id === selectedTutorId);
    return found ? found.name : 'ALL TUTORS';
  }, [tutors, selectedTutorId]);

  const classViewLabel = useMemo(() => {
    if (selectedClassId !== 'all') {
      return selectedClassLabel;
    }
    if (selectedTutorId !== 'all') {
      return selectedTutorLabel;
    }
    return null;
  }, [selectedClassId, selectedClassLabel, selectedTutorId, selectedTutorLabel]);

  const riskLevelTrendTitle = useMemo(() => {
    if (!classViewLabel) {
      return 'RISK LEVEL TREND CHART';
    }
    return `${classViewLabel}'S RISK LEVEL TREND CHART`;
  }, [classViewLabel]);

  const attendanceTrendTitle = useMemo(() => {
    if (!classViewLabel) {
      return 'STUDENTS ATTENDANCE RATE TREND CHART';
    }
    return `${classViewLabel}'S ATTENDANCE RATE TREND CHART`;
  }, [classViewLabel]);

  const scoreTrendTitle = useMemo(() => {
    if (!classViewLabel) {
      return 'STUDENTS AVERAGE SCORE TREND CHART';
    }
    return `${classViewLabel}'S AVERAGE SCORE TREND CHART`;
  }, [classViewLabel]);

  if (isLoading) {
    return (
      <div className="space-y-4 skeleton-container" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* Filters skeleton */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-9 w-52 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="h-9 w-44 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>

        {/* View Tab Switcher Skeleton */}
        <div className="flex w-full rounded-md bg-gray-100 dark:bg-[#111111] p-0.5 gap-0.5 animate-pulse">
          <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
        </div>

        {/* 3 Summary KPI Cards Skeleton */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 min-h-[100px] flex items-center gap-3.5 animate-pulse"
            >
              <div className="w-10 h-10 rounded-md bg-gray-200 dark:bg-gray-800 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
                <div className="h-7 w-14 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-2 w-44 rounded bg-gray-100 dark:bg-gray-800/60 mt-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Chart Card Skeleton */}
        <div className="w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 animate-pulse">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1.5">
              <div className="h-4 w-52 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-40 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-24 rounded-md bg-gray-100 dark:bg-gray-800" />
              <div className="h-7 w-28 rounded-md bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
          <div className="mt-4">
            <div className="h-[228px] w-full rounded-md bg-gray-50/60 dark:bg-[#111111]" />
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
    <div className="space-y-4 data-loaded-content w-full min-w-0 max-w-full" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── Filter Dropdowns (Tutor & Class) ── */}
      <div className="relative z-40 flex flex-wrap items-center justify-between gap-2.5 min-w-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Tutor Filter */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 opacity-70" />
              <span className="hidden xs:inline">FILTER BY TUTOR:</span>
              <span className="xs:hidden">TUTOR:</span>
            </span>
            <div className="relative z-50 shrink-0" ref={tutorDropdownRef}>
              <button
                type="button"
                aria-label="Filter by Tutor"
                aria-haspopup="listbox"
                aria-expanded={isTutorDropdownOpen}
                onClick={() => {
                  setIsTutorDropdownOpen((prev) => !prev);
                  setIsClassDropdownOpen(false);
                }}
                className="flex h-8 sm:h-9 min-w-36 xs:min-w-44 sm:min-w-48 items-center justify-between gap-2 sm:gap-3 rounded-md border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold tracking-normal text-gray-900 dark:text-slate-100 transition hover:border-gray-300 dark:hover:border-[#262626] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 cursor-pointer shadow-2xs"
              >
                <span className="truncate">{selectedTutorLabel}</span>
                <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-gray-400 transition-transform ${isTutorDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isTutorDropdownOpen && (
                <div
                  className="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] p-1 shadow-2xl"
                  role="listbox"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedTutorId === 'all'}
                    onClick={() => handleSelectTutor('all')}
                    className={`block w-full rounded px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                      selectedTutorId === 'all'
                        ? 'bg-[var(--brand)] text-white'
                        : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                    }`}
                  >
                    ALL TUTORS
                  </button>
                  {tutors.map((t) => {
                    const isSel = selectedTutorId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="option"
                        aria-selected={isSel}
                        onClick={() => handleSelectTutor(t.id)}
                        className={`block w-full truncate rounded px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                          isSel
                            ? 'bg-[var(--brand)] text-white'
                            : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Class Filter (Immediately to the right of Tutor filter) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 shrink-0">
              CLASS:
            </span>
            <div className="relative z-50 shrink-0" ref={classDropdownRef}>
              <button
                type="button"
                aria-label="Filter by Class"
                aria-haspopup="listbox"
                aria-expanded={isClassDropdownOpen}
                onClick={() => {
                  setIsClassDropdownOpen((prev) => !prev);
                  setIsTutorDropdownOpen(false);
                }}
                className="flex h-8 sm:h-9 min-w-36 xs:min-w-44 sm:min-w-48 items-center justify-between gap-2 sm:gap-3 rounded-md border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold tracking-normal text-gray-900 dark:text-slate-100 transition hover:border-gray-300 dark:hover:border-[#262626] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 cursor-pointer shadow-2xs"
              >
                <span className="truncate">{selectedClassLabel}</span>
                <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-gray-400 transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isClassDropdownOpen && (
                <div
                  className="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] p-1 shadow-2xl"
                  role="listbox"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedClassId === 'all'}
                    onClick={() => handleSelectClass('all')}
                    className={`flex items-center justify-between w-full rounded px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                      selectedClassId === 'all'
                        ? 'bg-[var(--brand)] text-white'
                        : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                    }`}
                  >
                    <span>ALL CLASSES</span>
                    <span className={`text-[10px] font-medium ${selectedClassId === 'all' ? 'text-white/80' : 'text-gray-400 dark:text-slate-500'}`}>
                      ({tutorStudents.length})
                    </span>
                  </button>
                  {availableClasses.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400 italic">No classes available</div>
                  ) : (
                    availableClasses.map((c) => {
                      const isSel = selectedClassId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          aria-selected={isSel}
                          onClick={() => handleSelectClass(c.id)}
                          className={`flex items-center justify-between w-full truncate rounded px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                            isSel
                              ? 'bg-[var(--brand)] text-white'
                              : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                          }`}
                        >
                          <span className="truncate mr-2">{c.label}</span>
                          <span className={`shrink-0 text-[10px] font-medium ${isSel ? 'text-white/80' : 'text-gray-400 dark:text-slate-500'}`}>
                            ({c.count})
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subtitle / Counter */}
        <div className="text-[10px] sm:text-[11px] font-medium text-gray-400 dark:text-slate-500 shrink-0 truncate">
          <span className="hidden sm:inline">
            Showing {selectedTutorLabel} {selectedClassId !== 'all' ? `• ${selectedClassLabel}` : ''}{' '}
          </span>
          ({activeStudents.length} {activeStudents.length === 1 ? 'Student' : 'Students'})
        </div>
      </div>

      {/* ── Main Tab Switcher ── */}
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
            className={`flex-1 h-8 rounded-sm px-4 flex items-center justify-center text-xs font-bold uppercase transition-all cursor-pointer ${
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
                <p className="text-2xl font-extrabold text-risk-high mt-0.5">{displayedRiskCounts.high}</p>
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
                <p className="text-2xl font-extrabold text-risk-medium mt-0.5">{displayedRiskCounts.moderate}</p>
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
                <p className="text-2xl font-extrabold text-risk-low mt-0.5">{displayedRiskCounts.low}</p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Students performing well</p>
              </div>
            </div>
          </div>

          {/* ── Risk Level Trend Chart ── */}
          <section className="rounded-md border border-gray-200 bg-white p-5 dark:border-[#1A1A1A] dark:bg-[#0A0A0A]" aria-labelledby="risk-overview-heading">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5 sm:pb-3.5 dark:border-[#1A1A1A] min-w-0">
              <div className="min-w-0 flex-1 truncate">
                <h3 id="risk-overview-heading" className="text-xs sm:text-sm font-bold uppercase text-gray-900 dark:text-slate-100 truncate">{riskLevelTrendTitle}</h3>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 flex-nowrap overflow-visible relative">
                <div className="hidden xs:flex items-center gap-2 sm:gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300 shrink-0 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#EF4444' }} />High Risk</span>
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} />Medium Risk</span>
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#22C55E' }} />Low Risk</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0 relative">
                  <StudentRiskFilter rows={rows} value={riskScope} onChange={setRiskScope} />
                </div>
                <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#111111] shrink-0 whitespace-nowrap" role="group" aria-label="Filter risk chart by time period">
                  {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setRiskTrendFilter(filter)}
                      className={`cursor-pointer rounded-sm px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                        riskTrendFilter === filter
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
            <div className="mt-4">
              <div className="relative rounded-md border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
                <RiskTrendChart
                  data={riskTrend}
                  total={riskScopedRows.length}
                  isSingleStudent={riskScope !== 'all'}
                  studentName={selectedRiskStudent?.full_name}
                  emptyLabel={
                    riskTrendFilter === 'day'
                      ? 'No recorded performance data today'
                      : riskTrendFilter === 'week'
                      ? 'No recorded performance data this week'
                      : 'No recorded performance data this month'
                  }
                />
              </div>
            </div>
          </section>

          {/* ── How Risk Level is Calculated Hoverable Part (STUDENT PERFORMANCE DETAILS table omitted as requested) ── */}
          <div className="flex items-center gap-2 px-1 text-xs text-gray-500 py-1" style={{ fontFamily: 'var(--font-body)' }}>
            <RiskCalculationInfo />
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
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Present {attendanceSummary.periodLabel}
                </p>
                <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">{attendanceSummary.present}</p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  {attendanceScope === 'all'
                    ? `Records marked present ${attendanceSummary.periodLabel.toLowerCase()}`
                    : `Days marked present ${attendanceSummary.periodLabel.toLowerCase()}`}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-rose-500 dark:border-rose-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#0A0A0A]">
              <X className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Absent {attendanceSummary.periodLabel}
                </p>
                <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-100 mt-0.5">{attendanceSummary.absent}</p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  {attendanceScope === 'all'
                    ? `Records marked absent ${attendanceSummary.periodLabel.toLowerCase()}`
                    : `Days marked absent ${attendanceSummary.periodLabel.toLowerCase()}`}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-4 min-h-[100px] flex flex-col justify-center dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                  Average Attendance {attendanceSummary.periodLabel !== 'Today' ? `(${attendanceSummary.periodLabel})` : ''}
                </p>
                <p className={`text-2xl font-extrabold mt-0.5 ${attendanceSummary.total === 0 && activeAttendanceLogs.length === 0 ? 'text-gray-400 dark:text-slate-500' : avgAttendance >= 81 ? 'text-risk-low' : avgAttendance >= 75 ? 'text-risk-medium' : 'text-risk-high'}`}>
                  {attendanceSummary.total === 0 && activeAttendanceLogs.length === 0 ? '—' : `${smartPct(avgAttendance)}%`}
                </p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  {attendanceScope !== 'all'
                    ? 'Student average attendance rate'
                    : selectedTutorId === 'all' && selectedClassId === 'all'
                    ? 'School-wide average attendance rate'
                    : `${selectedClassLabel !== 'ALL CLASSES' ? selectedClassLabel : selectedTutorLabel} average attendance`}
                </p>
              </div>
            </div>
          </div>

          {/* Attendance Trend Chart */}
          <div className="w-full rounded-md border border-gray-200 bg-white p-5 dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5 sm:pb-3.5 dark:border-[#1A1A1A] min-w-0">
              <div className="min-w-0 flex-1 truncate">
                <h3 className="text-xs sm:text-sm font-bold uppercase text-gray-900 dark:text-slate-100 truncate">{attendanceTrendTitle}</h3>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 flex-nowrap overflow-visible relative">
                <div className="hidden xs:flex items-center gap-2 sm:gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300 shrink-0 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#0052B7]" />Attendance Rate</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0 relative">
                  <StudentRiskFilter rows={rows} value={attendanceScope} onChange={setAttendanceScope} />
                </div>
                <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#111111] shrink-0 whitespace-nowrap" aria-label="Attendance trend period">
                  {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setAttendanceFilter(filter)}
                      className={`rounded-sm px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                        attendanceFilter === filter
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
            <div className="relative mt-4 h-64 sm:h-72 w-full rounded-md border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
              <TrendChart
                data={attendanceTrend}
                color="#0052B7"
                emptyLabel={
                  attendanceFilter === 'day'
                    ? 'No recorded attendance today'
                    : attendanceFilter === 'week'
                    ? 'No recorded attendance this week'
                    : 'No recorded attendance this month'
                }
                valueLabel={
                  selectedAttendanceStudent
                    ? selectedAttendanceStudent.full_name
                    : selectedClassId !== 'all'
                    ? `${selectedClassLabel} Average Attendance`
                    : selectedTutorId === 'all'
                    ? 'School Average Attendance'
                    : `${selectedTutorLabel}'s Average Attendance`
                }
                trendFilter={attendanceFilter}
              />
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
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Passed {scoreSummary.periodLabel}
                </p>
                <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">{scoreSummary.passed}</p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  Assessments scored ≥ 70% {scoreSummary.periodLabel.toLowerCase()}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-rose-500 dark:border-rose-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#0A0A0A]">
              <X className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Failed {scoreSummary.periodLabel}
                </p>
                <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-100 mt-0.5">{scoreSummary.failed}</p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  Assessments scored ≤ 69% {scoreSummary.periodLabel.toLowerCase()}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-4 min-h-[100px] flex flex-col justify-center dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                  Average Score {scoreSummary.periodLabel !== 'Today' ? `(${scoreSummary.periodLabel})` : ''}
                </p>
                <p className={`text-2xl font-extrabold mt-0.5 ${scoreSummary.total === 0 && activeGrades.filter((g) => g.component_type !== 'attendance' && g.remarks !== 'Not Taken').length === 0 ? 'text-gray-400 dark:text-slate-500' : avgScore >= 81 ? 'text-risk-low' : avgScore >= 75 ? 'text-risk-medium' : 'text-risk-high'}`}>
                  {scoreSummary.total === 0 && activeGrades.filter((g) => g.component_type !== 'attendance' && g.remarks !== 'Not Taken').length === 0 ? '—' : `${smartPct(avgScore)}%`}
                </p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  {scoreScope !== 'all'
                    ? 'Student average score rate'
                    : selectedTutorId === 'all' && selectedClassId === 'all'
                    ? 'School-wide average score rate'
                    : `${selectedClassLabel !== 'ALL CLASSES' ? selectedClassLabel : selectedTutorLabel} average score`}
                </p>
              </div>
            </div>
          </div>

          {/* Score Trend Chart */}
          <div className="w-full rounded-md border border-gray-200 bg-white p-5 dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5 sm:pb-3.5 dark:border-[#1A1A1A] min-w-0">
              <div className="min-w-0 flex-1 truncate">
                <h3 className="text-xs sm:text-sm font-bold uppercase text-gray-900 dark:text-slate-100 truncate">{scoreTrendTitle}</h3>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 flex-nowrap overflow-visible relative">
                <div className="hidden xs:flex items-center gap-2 sm:gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300 shrink-0 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#0052B7]" />Average Score</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0 relative">
                  <StudentRiskFilter rows={rows} value={scoreScope} onChange={setScoreScope} />
                </div>
                <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#111111] shrink-0 whitespace-nowrap" aria-label="Score trend period">
                  {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setScoreFilter(filter)}
                      className={`rounded-sm px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                        scoreFilter === filter
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
            <div className="relative mt-4 h-64 sm:h-72 w-full rounded-md border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
              <TrendChart
                data={scoreTrend}
                color="#0052B7"
                emptyLabel={
                  scoreFilter === 'day'
                    ? 'No recorded score today'
                    : scoreFilter === 'week'
                    ? 'No recorded score this week'
                    : 'No recorded score this month'
                }
                valueLabel={
                  selectedScoreStudent
                    ? selectedScoreStudent.full_name
                    : selectedClassId !== 'all'
                    ? `${selectedClassLabel} Average Score`
                    : selectedTutorId === 'all'
                    ? 'School Average Score'
                    : `${selectedTutorLabel}'s Average Score`
                }
                trendFilter={scoreFilter}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PrincipalAnalytics;
