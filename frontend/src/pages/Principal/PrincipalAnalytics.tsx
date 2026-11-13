import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';
import { isNotTakenGrade, PASSING_SCORE_RATIO } from '../../config/academicConfig';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Users,
  Info,
  X,
} from 'lucide-react';
import type { Attendance, Grade, User } from '../../types';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';
import { buildTutorClassSections, isStudentInCohort } from '../../utils/tutorCohortHelpers';
import { AnimatedCounter } from '../../components/AnimatedCounter';

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
  moderate: number;
  medium?: number;
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
  recordedDates: Date[] = [],
  pageOffset: number = 0
): { start: Date; end: Date; label: string; dateKey: string }[] => {
  const startOfAnchor = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate(), 0, 0, 0, 0);
  const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (filter === 'day') {
    const count = 10 * (pageOffset + 1);
    const allSchoolDays = getRecentSchoolWeekdays(count, startOfAnchor);
    const schoolDays = allSchoolDays.slice(0, 10);
    const basePeriods = schoolDays.map((d) => {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
      return { start, end, label: formatDate(start), dateKey: toLocalDateKey(start) };
    });
    if (pageOffset > 0 || recordedDates.length === 0) return basePeriods;

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
    const totalOffset = (periodCount - 1 - index) + pageOffset * periodCount;
    let start: Date;
    let end: Date;
    let label: string;
    if (filter === 'month') {
      start = new Date(startOfAnchor.getFullYear(), startOfAnchor.getMonth() - totalOffset, 1, 0, 0, 0, 0);
      end = new Date(startOfAnchor.getFullYear(), startOfAnchor.getMonth() - totalOffset + 1, 1, 0, 0, 0, 0);
      label = start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    } else {
      const dayOfWeek = startOfAnchor.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const currentWeekMon = new Date(startOfAnchor.getFullYear(), startOfAnchor.getMonth(), startOfAnchor.getDate() + diffToMon, 0, 0, 0, 0);
      start = new Date(currentWeekMon.getFullYear(), currentWeekMon.getMonth(), currentWeekMon.getDate() - totalOffset * 7, 0, 0, 0, 0);
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
  filter: TrendFilter,
  pageOffset: number = 0
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
        !isNotTakenGrade(grade) &&
        Number(grade.total_score) > 0 &&
        getRecordDate(grade) !== null
      ))
    : [];

  if (metric === 'attendance' && relevantAttendance.length === 0 && pageOffset === 0) return [];
  if (metric === 'score' && relevantGrades.length === 0 && pageOffset === 0) return [];

  const recordedDates = (metric === 'attendance' ? relevantAttendance : relevantGrades)
    .map((rec) => getRecordDate(rec))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const now = new Date();
  let periods = buildTrendPeriods(filter, now, recordedDates, pageOffset);

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

  if (pageOffset === 0 && points.every(({ point }) => point === null) && recordedDates.length > 0) {
    const latestRecordedDate = recordedDates[recordedDates.length - 1];
    periods = buildTrendPeriods(filter, latestRecordedDate, recordedDates, 0);
    points = evaluatePeriods(periods);
  }

  if (points.every(({ point }) => point === null)) {
    return periods.map((p) => ({
      dateKey: p.dateKey,
      label: p.label,
      value: 0,
    }));
  }

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
  filter: TrendFilter,
  pageOffset: number = 0
): RiskTrendPoint[] => {
  const studentIds = buildStudentIdSet(students);
  if (studentIds.size === 0) return [];

  const relevantGrades = grades.filter((grade) => (
    studentIds.has(getGradeStudentId(grade)) &&
    grade.component_type !== 'attendance' &&
    !isNotTakenGrade(grade) &&
    getRecordDate(grade) !== null
  ));
  const relevantAttendance = attendanceLogs.filter((log) => (
    studentIds.has(getLogUserId(log)) &&
    getRecordDate(log) !== null
  ));

  if (relevantGrades.length === 0 && relevantAttendance.length === 0 && pageOffset === 0) return [];

  const recordedDates = [
    ...relevantGrades.map((g) => getRecordDate(g)),
    ...relevantAttendance.map((a) => getRecordDate(a)),
  ]
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const now = new Date();
  let periods = buildTrendPeriods(filter, now, recordedDates, pageOffset);

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
          moderate: snapshot.filter((row) => row.riskTier === 'Moderate' || row.riskTier === 'Medium').length,
          medium: snapshot.filter((row) => row.riskTier === 'Moderate' || row.riskTier === 'Medium').length,
          low: snapshot.filter((row) => row.riskTier === 'Low').length,
        },
      };
    });

  let points = evaluateRiskPeriods(periods);

  if (pageOffset === 0 && points.every(({ point }) => point === null) && recordedDates.length > 0) {
    const latestRecordedDate = recordedDates[recordedDates.length - 1];
    periods = buildTrendPeriods(filter, latestRecordedDate, recordedDates, 0);
    points = evaluateRiskPeriods(periods);
  }

  if (points.every(({ point }) => point === null)) {
    return periods.map((p) => ({
      dateKey: p.dateKey,
      label: p.label,
      high: 0,
      moderate: 0,
      medium: 0,
      low: 0,
    }));
  }

  const firstRecordedPoint = points.find(({ point }) => point !== null)?.point;
  if (!firstRecordedPoint) {
    return periods.map((p) => ({
      dateKey: p.dateKey,
      label: p.label,
      high: 0,
      moderate: 0,
      medium: 0,
      low: 0,
    }));
  }
  let lastPoint = firstRecordedPoint;
  return points.map(({ period, point }) => {
    if (point) {
      lastPoint = point;
      return point;
    }
    return { dateKey: period.dateKey, label: period.label, high: lastPoint.high, moderate: lastPoint.moderate ?? lastPoint.medium ?? 0, medium: lastPoint.medium ?? lastPoint.moderate ?? 0, low: lastPoint.low };
  });
};

const formatShortDateRange = (label?: string | null): string => {
  if (!label || typeof label !== 'string') return '';
  const match = label.match(/^([A-Za-z]+)\s+(\d+)\s*[–—\-]\s*([A-Za-z]+)\s+(\d+)$/);
  if (match) {
    const [, m1, d1, m2, d2] = match;
    const shortM1 = m1.slice(0, 3);
    const shortM2 = m2.slice(0, 3);
    if (shortM1.toLowerCase() === shortM2.toLowerCase()) {
      return `${shortM1} ${d1}–${d2}`;
    }
    return `${shortM1} ${d1}–${shortM2} ${d2}`;
  }
  return label;
};

const TrendChart: React.FC<{
  data: TrendPoint[];
  color?: string;
  emptyLabel: string;
  valueLabel?: string;
  trendFilter?: TrendFilter;
}> = ({ data, color = '#0052B7', emptyLabel, valueLabel = 'Class Average', trendFilter = 'week' }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 260 });

  useEffect(() => {
    setHoveredIdx(null);
  }, [data, trendFilter]);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        const minH = rect.width < 520 ? 196 : 220;
        setDimensions({
          width: Math.round(rect.width),
          height: Math.max(minH, Math.round(rect.height)),
        });
      }
    };

    updateSize();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0) {
          const minH = width < 520 ? 196 : 220;
          setDimensions({
            width: Math.round(width),
            height: Math.max(minH, Math.round(height)),
          });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [data.length]);

  const { width, height } = dimensions;
  const isMobile = width < 520;
  const paddingLeft = isMobile ? 38 : 50;
  const paddingRight = isMobile ? 24 : 44;
  const paddingTop = isMobile ? 16 : 20;
  const paddingBottom = isMobile ? (trendFilter === 'month' ? 24 : 34) : 24;

  const chartW = Math.max(10, width - paddingLeft - paddingRight);
  const chartH = Math.max(10, height - paddingTop - paddingBottom);

  const points = data.map((d, idx) => {
    const val = typeof d.value === 'number' && !isNaN(d.value) ? d.value : 0;
    const x = paddingLeft + (idx * chartW) / (data.length - 1 || 1);
    const y = paddingTop + chartH - (val / 100) * chartH;
    return { x, y, ...d, value: val };
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

  const getMobileLabelLines = (label: string): [string, string?] => {
    if (trendFilter === 'week') {
      const parts = label.split(/\s*[–—\-]\s*/);
      if (parts.length === 2) {
        return [parts[0].trim(), `–${parts[1].trim()}`];
      }
      return [label];
    }
    if (trendFilter === 'day') {
      const parts = label.trim().split(/\s+/);
      if (parts.length >= 2) {
        return [parts[0], parts.slice(1).join(' ')];
      }
      return [label];
    }
    if (trendFilter === 'month') {
      return [label.split(' ')[0] || label];
    }
    return [label];
  };

  if (data.length === 0) {
    return (
      <div ref={containerRef} className="flex h-full w-full items-center justify-center text-xs font-medium text-gray-400 dark:text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  const colorId = color.replace(/[^a-zA-Z0-9]/g, '') || 'brand';
  const gradientId = `trendChartFill_${colorId}`;
  const filterId = `trendChartGlow_${colorId}`;
  const chartAnimationKey = `${colorId}_${data.length}_${trendFilter}_${points.map((p) => p.value).join('-')}`;

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full min-h-[196px] sm:min-h-[220px] select-none min-w-0 overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full min-h-[196px] sm:min-h-[220px] block"
        role="img"
        aria-label="Trend chart"
      >
        <defs>
          <style>{`
            @keyframes traceLine {
              0% {
                stroke-dashoffset: 1000;
              }
              100% {
                stroke-dashoffset: 0;
              }
            }
            @keyframes revealArea {
              0% {
                opacity: 0;
              }
              30% {
                opacity: 0;
              }
              100% {
                opacity: 1;
              }
            }
            @keyframes popMarker {
              0% {
                opacity: 0;
                transform: scale(0);
              }
              70% {
                opacity: 0.95;
                transform: scale(1.3);
              }
              100% {
                opacity: 1;
                transform: scale(1);
              }
            }
            .chart-line-trace {
              stroke-dasharray: 1000;
              stroke-dashoffset: 1000;
              animation: traceLine 1.5s cubic-bezier(0.22, 1, 0.36, 1) both;
            }
            .chart-area-reveal {
              opacity: 0;
              animation: revealArea 1.7s ease-out both;
            }
            .chart-marker-pop {
              transform-box: fill-box;
              transform-origin: center;
              opacity: 0;
              animation: popMarker 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
            }
            @media (prefers-reduced-motion: reduce) {
              .chart-line-trace,
              .chart-area-reveal,
              .chart-marker-pop {
                animation: none !important;
                stroke-dashoffset: 0 !important;
                opacity: 1 !important;
                transform: none !important;
              }
            }
          `}</style>
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
                y={y + 3.5}
                textAnchor="end"
                className="fill-slate-400 font-bold text-[9px] xs:text-[10px]"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* X-axis date labels */}
        {points.map((p, idx) => {
          const rawFormatted = formatShortDateRange(p.label);
          if (isMobile) {
            const [line1, line2] = getMobileLabelLines(rawFormatted);
            if (line2) {
              return (
                <text
                  key={`label-${idx}`}
                  x={p.x}
                  y={paddingTop + chartH + 13}
                  className="fill-slate-500 dark:fill-slate-400 font-semibold text-[8.5px] select-none"
                  textAnchor="middle"
                >
                  <tspan x={p.x} dy="0">{line1}</tspan>
                  <tspan x={p.x} dy="10">{line2}</tspan>
                </text>
              );
            }
            return (
              <text
                key={`label-${idx}`}
                x={p.x}
                y={height - 6}
                className="fill-slate-500 dark:fill-slate-400 font-semibold text-[9px] select-none"
                textAnchor="middle"
                style={{ whiteSpace: 'nowrap' }}
              >
                {line1}
              </text>
            );
          }

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
              y={height - 5}
              className="fill-slate-500 dark:fill-slate-400 font-semibold text-[10px] select-none"
              textAnchor={textAnchor}
              style={{ whiteSpace: 'nowrap' }}
            >
              {rawFormatted}
            </text>
          );
        })}

        {/* Animated Trend Line & Area */}
        <g key={chartAnimationKey}>
          {points.length > 0 && (
            <>
              <path d={areaD} fill={`url(#${gradientId})`} className="chart-area-reveal" />
              <path
                pathLength={1000}
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.28"
                filter={`url(#${filterId})`}
                className="chart-line-trace"
              />
              <path
                pathLength={1000}
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="chart-line-trace"
              />
            </>
          )}

          {/* Animated data point markers with staggered pop delays */}
          {points.map((p, idx) => (
            <circle
              key={`data-dot-${idx}`}
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill={color}
              stroke="#FFFFFF"
              strokeWidth="1.5"
              className="chart-marker-pop"
              style={{ animationDelay: `${Math.min(1.2, 0.4 + idx * 0.08)}s` }}
            />
          ))}
        </g>

        {/* Hover vertical guide line & dots */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line x1={points[hoveredIdx].x} y1={paddingTop} x2={points[hoveredIdx].x} y2={paddingTop + chartH} stroke={color} strokeWidth="1.5" opacity="0.7" />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="4.5" fill={color} />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="8" fill={color} opacity="0.25" />
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
              height={chartH + paddingBottom}
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
            className="pointer-events-none absolute z-20 w-max rounded-xl border border-slate-200 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-900/95 p-3 text-left text-[11px] leading-normal text-slate-800 dark:text-white shadow-xl shadow-slate-900/10 dark:shadow-black/60 overflow-hidden backdrop-blur-md"
            style={tooltipStyle}
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    setHoveredIdx(null);
  }, [data]);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0) setContainerWidth(Math.round(rect.width));
      }
    };
    updateSize();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.round(entry.contentRect.width));
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [data.length]);

  const width = Math.max(300, containerWidth);
  const height = 216;
  const paddingLeft = 48;
  const paddingRight = 48;
  const paddingTop = 16;
  const paddingBottom = 32;
  const chartWidth = Math.max(10, width - paddingLeft - paddingRight);
  const chartHeight = Math.max(10, height - paddingTop - paddingBottom);
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
    { key: 'moderate' as const, color: '#F59E0B', label: 'Moderate Risk' },
    { key: 'low' as const, color: '#22C55E', label: 'Low Risk' },
  ];
  const barWidth = Math.max(14, Math.min(34, (chartWidth / (data.length || 1)) * 0.35));
  const getBarX = (index: number) => {
    if (data.length <= 1) {
      return paddingLeft + chartWidth / 2;
    }
    return paddingLeft + barWidth / 2 + (index * (chartWidth - barWidth)) / (data.length - 1);
  };

  const desktopAnimationKey = `principal_desktop_bars_${data.length}_${isSingleStudent}_${studentName || 'all'}_${data.map((d) => `${d.high}-${d.moderate ?? d.medium ?? 0}-${d.low}`).join('_')}`;

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[216px] w-full overflow-visible select-none"
        role="img"
        aria-label="Risk level trend chart"
      >
        <defs>
          <style>{`
            @keyframes growBar {
              0% {
                transform: scaleY(0);
                opacity: 0;
              }
              100% {
                transform: scaleY(1);
                opacity: 1;
              }
            }
            .chart-bar-grow {
              transform-box: view-box;
              transform: scaleY(0);
              opacity: 0;
              animation: growBar 0.65s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            @media (prefers-reduced-motion: reduce) {
              .chart-bar-grow {
                animation: none !important;
                transform: none !important;
                opacity: 1 !important;
              }
            }
          `}</style>
        </defs>
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
                y={y + 3.5}
                textAnchor="end"
                className="fill-slate-400 font-semibold text-[10px]"
              >
                {value}
              </text>
            </g>
          );
        })}
        <g key={desktopAnimationKey}>
          {data.map((point, index) => {
            const x = getBarX(index);
            let currentBottom = paddingTop + chartHeight;
            const bars = [...series].reverse().map((item) => {
              const barHeight = (point[item.key] / maxValue) * chartHeight;
              if (barHeight <= 0) return null;
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
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-slate-500 font-semibold text-[10px]"
                >
                  {point.label}
                </text>
                <g
                  className="chart-bar-grow"
                  style={{
                    transformOrigin: `${x}px ${paddingTop + chartHeight}px`,
                    animationDelay: `${(index * 0.06).toFixed(2)}s`,
                  }}
                >
                  {bars}
                </g>
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
        </g>
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
  trendFilter: TrendFilter;
}> = ({ data, total, isSingleStudent, studentName, trendFilter }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(320);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0) setContainerWidth(Math.round(rect.width));
      }
    };
    updateSize();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.round(entry.contentRect.width));
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const width = containerWidth;
  const height = 196;
  const paddingLeft = isSingleStudent ? 24 : 32;
  const paddingRight = 16;
  const paddingTop = 14;
  const paddingBottom = trendFilter === 'month' ? 24 : 34;

  const chartWidth = Math.max(10, width - paddingLeft - paddingRight);
  const chartHeight = Math.max(10, height - paddingTop - paddingBottom);

  const { maxValue, axisSteps } = useMemo(() => {
    if (isSingleStudent) {
      return { maxValue: 1, axisSteps: [0, 1] };
    }
    const safeTotal = Math.max(1, total);
    let step = 5;
    if (safeTotal <= 10) {
      step = 2;
    } else if (safeTotal <= 35) {
      step = 5;
    } else if (safeTotal <= 70) {
      step = 10;
    } else if (safeTotal <= 120) {
      step = 20;
    } else if (safeTotal <= 250) {
      step = 50;
    } else {
      step = 100;
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
    { key: 'moderate' as const, color: '#F59E0B', label: 'Moderate Risk' },
    { key: 'low' as const, color: '#22C55E', label: 'Low Risk' },
  ];

  const barWidth = Math.max(10, Math.min(18, (chartWidth / (data.length || 1)) * 0.42));
  const getBarX = (index: number) =>
    paddingLeft + barWidth / 2 + (index * (chartWidth - barWidth)) / (data.length - 1 || 1);

  const getLabelLines = (label: string): [string, string?] => {
    if (trendFilter === 'week') {
      const parts = label.split(/\s*[–—\-]\s*/);
      if (parts.length === 2) {
        return [parts[0].trim(), `–${parts[1].trim()}`];
      }
      return [label];
    }
    if (trendFilter === 'day') {
      const parts = label.trim().split(/\s+/);
      if (parts.length >= 2) {
        return [parts[0], parts.slice(1).join(' ')];
      }
      return [label];
    }
    if (trendFilter === 'month') {
      return [label.split(' ')[0] || label];
    }
    return [label];
  };

  const mobileAnimationKey = `principal_mobile_bars_${data.length}_${isSingleStudent}_${studentName || 'all'}_${data.map((d) => `${d.high}-${d.moderate ?? d.medium ?? 0}-${d.low}`).join('_')}`;

  return (
    <div ref={containerRef} className="relative select-none w-full max-w-full min-w-0 h-[196px] overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full block"
        role="img"
        aria-label="Risk level trend chart"
      >
        <defs>
          <style>{`
            @keyframes growBar {
              0% {
                transform: scaleY(0);
                opacity: 0;
              }
              100% {
                transform: scaleY(1);
                opacity: 1;
              }
            }
            .chart-bar-grow {
              transform-box: view-box;
              transform: scaleY(0);
              opacity: 0;
              animation: growBar 0.65s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            @media (prefers-reduced-motion: reduce) {
              .chart-bar-grow {
                animation: none !important;
                transform: none !important;
                opacity: 1 !important;
              }
            }
          `}</style>
        </defs>
        {/* Horizontal Grid lines and Y-axis labels */}
        {axisSteps.map((value) => {
          const y = paddingTop + chartHeight - (value / maxValue) * chartHeight;
          return (
            <g key={value}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--slate-200, #E2E8F0)"
                strokeWidth="0.75"
                strokeDasharray="3 3"
                className="opacity-70 dark:opacity-20"
              />
              <text
                x={paddingLeft - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 dark:fill-slate-400 font-semibold text-[9px]"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* Bars and X-axis Labels */}
        <g key={mobileAnimationKey}>
          {data.map((point, index) => {
            const x = getBarX(index);
            const [line1, line2] = getLabelLines(point.label);

            const highCount = point.high || 0;
            const medCount = point.moderate ?? point.medium ?? 0;
            const lowCount = point.low || 0;
            const pointTotal = isSingleStudent ? 1 : (highCount + medCount + lowCount);

            const lowH = (lowCount / maxValue) * chartHeight;
            const medH = (medCount / maxValue) * chartHeight;
            const highH = (highCount / maxValue) * chartHeight;
            const totalBarH = lowH + medH + highH;

            const segments = [
              { key: 'low', color: '#22C55E', height: lowH, count: lowCount },
              { key: 'moderate', color: '#F59E0B', height: medH, count: medCount },
              { key: 'high', color: '#EF4444', height: highH, count: highCount },
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
                {/* Stacked Bar segments */}
                <g
                  className="chart-bar-grow"
                  style={{
                    transformOrigin: `${x}px ${paddingTop + chartHeight}px`,
                    animationDelay: `${(index * 0.06).toFixed(2)}s`,
                  }}
                >
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
                        rx={seg.key === 'high' || ((seg.key === 'moderate' || seg.key === 'medium') && highH === 0) || (seg.key === 'low' && highH === 0 && medH === 0) ? 3 : 0}
                      />
                    );
                  })}
                </g>

                {/* Hover outline ring */}
                {isHovered && totalBarH > 0 && (
                  <rect
                    x={x - barWidth / 2 - 2}
                    y={paddingTop + chartHeight - totalBarH - 2}
                    width={barWidth + 4}
                    height={totalBarH + 4}
                    fill="none"
                    stroke="#0052B7"
                    strokeWidth="1.75"
                    rx={4}
                    className="pointer-events-none"
                  />
                )}

                {/* Complete X-Axis Date Labels Under Every Bar */}
                {line2 ? (
                  <text
                    x={x}
                    y={paddingTop + chartHeight + 13}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 select-none font-semibold text-[8.5px]"
                  >
                    <tspan x={x} dy="0">{line1}</tspan>
                    <tspan x={x} dy="10">{line2}</tspan>
                  </text>
                ) : (
                  <text
                    x={x}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 select-none font-semibold text-[9px]"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {line1}
                  </text>
                )}

                {/* Touch hit region */}
                <rect
                  x={x - Math.max(barWidth, chartWidth / (data.length || 1)) / 2}
                  y={paddingTop}
                  width={Math.max(barWidth, chartWidth / (data.length || 1))}
                  height={chartHeight + paddingBottom}
                  fill="transparent"
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Mobile Tooltip matching StudentAnalytics */}
      {hoveredIdx !== null && data[hoveredIdx] && (() => {
        const p = data[hoveredIdx];
        const barX = getBarX(hoveredIdx);
        const maxTooltipWidth = Math.min(210, Math.max(150, width - 20));
        const leftPos = Math.max(8, Math.min(width - maxTooltipWidth - 8, barX - maxTooltipWidth / 2));

        const highCount = p.high || 0;
        const medCount = p.moderate ?? p.medium ?? 0;
        const lowCount = p.low || 0;
        const pointTotal = isSingleStudent ? 1 : (highCount + medCount + lowCount);

        return (
          <div
            className="pointer-events-none absolute z-20 w-max rounded-xl border border-slate-200 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-900/95 p-2.5 text-left text-[11px] leading-normal text-slate-800 dark:text-white shadow-xl dark:shadow-2xl shadow-slate-900/10 dark:shadow-black/60 backdrop-blur-sm"
            style={{
              left: `${leftPos}px`,
              top: '8px',
              maxWidth: `${maxTooltipWidth}px`,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-700/80 pb-1 mb-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-700 dark:text-zinc-200">{p.label}</span>
              {isSingleStudent && studentName && (
                <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 truncate max-w-[100px]" title={studentName}>
                  {studentName}
                </span>
              )}
            </div>

            <div className="space-y-1">
              {series.map((item) => {
                const count = p[item.key] || 0;
                const pct = pointTotal > 0 ? Math.round((count / pointTotal) * 100) : 0;
                return (
                  <div key={item.key} className="flex items-center justify-between gap-4 text-[11px] font-medium">
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
              <div className="mt-1.5 pt-1 border-t border-slate-100 dark:border-zinc-700/80 flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 font-semibold">
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
  trendFilter?: TrendFilter;
}> = ({ data, total, isSingleStudent, studentName, emptyLabel = 'No recorded performance data', trendFilter = 'week' }) => {
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
          trendFilter={trendFilter}
        />
      </div>
    </>
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
      Risk level is calculated from the composite rating of a student. Composite Rating = 40% (Attendance Rate) + 60% (Average Score Rate)
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
  const [menuAlign, setMenuAlign] = useState<'left' | 'right'>('left');
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

  const handleToggle = () => {
    if (!isOpen && filterRef.current) {
      const rect = filterRef.current.getBoundingClientRect();
      const screenW = window.innerWidth || document.documentElement.clientWidth;
      if (rect.left + 210 > screenW - 16) {
        setMenuAlign('right');
      } else {
        setMenuAlign('left');
      }
    }
    setIsOpen((open) => !open);
  };

  useEffect(() => {
    const closeMenu = (event: MouseEvent | TouchEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('touchstart', closeMenu);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('touchstart', closeMenu);
    };
  }, []);

  return (
    <div ref={filterRef} className="relative z-30">
      <button
        type="button"
        aria-label="Filter chart by student"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="flex h-8 sm:h-9 min-w-[130px] max-w-[180px] sm:min-w-40 items-center justify-between gap-1.5 sm:gap-3 rounded-xl border border-gray-200 bg-gray-50 dark:border-[#1A1A1A] dark:bg-[#111111] px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold tracking-normal text-gray-700 dark:text-slate-200 transition hover:border-gray-300 dark:hover:border-[#262626] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 cursor-pointer shrink-0"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className={`absolute ${menuAlign === 'right' ? 'right-0' : 'left-0'} top-full z-50 mt-2 max-h-60 min-w-[200px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] p-1.5 shadow-xl`} role="listbox">
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
  const [tutorMenuAlign, setTutorMenuAlign] = useState<'left' | 'right'>('left');
  const tutorDropdownRef = useRef<HTMLDivElement>(null);

  // Class Filter state (select which class of tutor to see)
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return new URLSearchParams(window.location.search).get('class') || 'all';
  });
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classMenuAlign, setClassMenuAlign] = useState<'left' | 'right'>('left');
  const classDropdownRef = useRef<HTMLDivElement>(null);

  const handleToggleTutorDropdown = () => {
    if (!isTutorDropdownOpen && tutorDropdownRef.current) {
      const rect = tutorDropdownRef.current.getBoundingClientRect();
      const screenW = window.innerWidth || document.documentElement.clientWidth;
      if (rect.left + 260 > screenW - 16) {
        setTutorMenuAlign('right');
      } else {
        setTutorMenuAlign('left');
      }
    }
    setIsTutorDropdownOpen((prev) => !prev);
    setIsClassDropdownOpen(false);
  };

  const handleToggleClassDropdown = () => {
    if (!isClassDropdownOpen && classDropdownRef.current) {
      const rect = classDropdownRef.current.getBoundingClientRect();
      const screenW = window.innerWidth || document.documentElement.clientWidth;
      if (rect.left + 260 > screenW - 16) {
        setClassMenuAlign('right');
      } else {
        setClassMenuAlign('left');
      }
    }
    setIsClassDropdownOpen((prev) => !prev);
    setIsTutorDropdownOpen(false);
  };

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
  const [riskTrendPage, setRiskTrendPage] = useState<number>(0);
  const [attendanceTrendPage, setAttendanceTrendPage] = useState<number>(0);
  const [scoreTrendPage, setScoreTrendPage] = useState<number>(0);

  const [riskScope, setRiskScope] = useState<RiskScope>('all');
  const [attendanceScope, setAttendanceScope] = useState<RiskScope>('all');
  const [scoreScope, setScoreScope] = useState<RiskScope>('all');

  // Close dropdowns when clicked outside
  useEffect(() => {
    const closeDropdown = (e: MouseEvent | TouchEvent) => {
      if (tutorDropdownRef.current && !tutorDropdownRef.current.contains(e.target as Node)) {
        setIsTutorDropdownOpen(false);
      }
      if (classDropdownRef.current && !classDropdownRef.current.contains(e.target as Node)) {
        setIsClassDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', closeDropdown);
    document.addEventListener('touchstart', closeDropdown);
    return () => {
      document.removeEventListener('mousedown', closeDropdown);
      document.removeEventListener('touchstart', closeDropdown);
    };
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
    setRiskTrendPage(0);
    setAttendanceTrendPage(0);
    setScoreTrendPage(0);
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
    setRiskTrendPage(0);
    setAttendanceTrendPage(0);
    setScoreTrendPage(0);
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

      parsedTutors.sort((a, b) => a.name.localeCompare(b.name));
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
        else if (row.riskTier === 'Moderate' || row.riskTier === 'Medium') acc.moderate += 1;
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
        moderate: (studentRow.riskTier === 'Moderate' || studentRow.riskTier === 'Medium') ? 1 : 0,
        low: studentRow.riskTier === 'Low' ? 1 : 0,
      };
    }
    return riskCounts;
  }, [riskScope, rows, riskCounts]);

  const riskTrend = useMemo(() => {
    const studentsForTrend = riskScope === 'all'
      ? activeStudents
      : activeStudents.filter((student) => String(student.id) === riskScope);
    return buildRiskTrend(studentsForTrend, activeGrades, activeAttendanceLogs, riskTrendFilter, riskTrendPage);
  }, [activeStudents, activeGrades, activeAttendanceLogs, riskScope, riskTrendFilter, riskTrendPage]);

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
    return buildTrendPoints(studentsForTrend, activeGrades, activeAttendanceLogs, 'attendance', attendanceFilter, attendanceTrendPage);
  }, [activeStudents, activeGrades, activeAttendanceLogs, attendanceScope, attendanceFilter, attendanceTrendPage]);

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
      if (grade.component_type === 'attendance' || isNotTakenGrade(grade)) return false;
      const d = getRecordDate(grade);
      return d ? d >= start && d <= end : false;
    });

    const passed = scoreRecords.filter(
      (grade) => Number(grade.total_score) > 0 && (Number(grade.score) / Number(grade.total_score)) >= PASSING_SCORE_RATIO
    ).length;
    const failed = scoreRecords.filter(
      (grade) => Number(grade.total_score) > 0 && (Number(grade.score) / Number(grade.total_score)) < PASSING_SCORE_RATIO
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
    return buildTrendPoints(studentsForTrend, activeGrades, activeAttendanceLogs, 'score', scoreFilter, scoreTrendPage);
  }, [activeStudents, activeGrades, activeAttendanceLogs, scoreScope, scoreFilter, scoreTrendPage]);

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
      return 'STUDENTS AVERAGE SCORE RATE TREND CHART';
    }
    return `${classViewLabel}'S AVERAGE SCORE RATE TREND CHART`;
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
              className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-4 min-h-[100px] flex items-center gap-3.5 animate-pulse shadow-sm"
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
        <div className="w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-5 animate-pulse shadow-sm">
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
      <div className={`relative flex flex-wrap items-center justify-between gap-2.5 min-w-0 ${isTutorDropdownOpen || isClassDropdownOpen ? 'z-30' : 'z-10'}`}>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Tutor Filter */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 shrink-0">
              TUTOR:
            </span>
            <div className={`relative shrink-0 ${isTutorDropdownOpen ? 'z-50' : 'z-20'}`} ref={tutorDropdownRef}>
              <button
                type="button"
                aria-label="Filter by Tutor"
                aria-haspopup="listbox"
                aria-expanded={isTutorDropdownOpen}
                onClick={handleToggleTutorDropdown}
                className="flex h-8 sm:h-9 min-w-36 xs:min-w-44 sm:min-w-48 items-center justify-between gap-2 sm:gap-3 rounded-md border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold tracking-normal text-gray-900 dark:text-slate-100 transition hover:border-gray-300 dark:hover:border-[#262626] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 cursor-pointer shadow-2xs"
              >
                <span className="truncate">{selectedTutorLabel}</span>
                <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-gray-400 transition-transform ${isTutorDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isTutorDropdownOpen && (
                <div
                  className={`absolute ${tutorMenuAlign === 'right' ? 'right-0' : 'left-0'} top-full z-50 mt-1 max-h-64 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] p-1 shadow-2xl`}
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
                  {[...tutors]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((t) => {
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
            <div className={`relative shrink-0 ${isClassDropdownOpen ? 'z-50' : 'z-20'}`} ref={classDropdownRef}>
              <button
                type="button"
                aria-label="Filter by Class"
                aria-haspopup="listbox"
                aria-expanded={isClassDropdownOpen}
                onClick={handleToggleClassDropdown}
                className="flex h-8 sm:h-9 min-w-36 xs:min-w-44 sm:min-w-48 items-center justify-between gap-2 sm:gap-3 rounded-md border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold tracking-normal text-gray-900 dark:text-slate-100 transition hover:border-gray-300 dark:hover:border-[#262626] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 cursor-pointer shadow-2xs"
              >
                <span className="truncate">{selectedClassLabel}</span>
                <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-gray-400 transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isClassDropdownOpen && (
                <div
                  className={`absolute ${classMenuAlign === 'right' ? 'right-0' : 'left-0'} top-full z-50 mt-1 max-h-64 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] p-1 shadow-2xl`}
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
            <div className="relative rounded-md border border-rose-500 dark:border-rose-500 bg-white dark:bg-[#111111] hover:border-rose-600 dark:hover:border-rose-400 transition-colors p-4 min-h-[100px] flex flex-col justify-center shadow-sm">
              <div className="absolute right-3 top-3">
                <RiskRangeInfo range="Composite rating is 69% and below" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-risk-high">
                  <p className="text-[10px] font-bold uppercase tracking-wider">High Risk</p>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-risk-high mt-0.5 tracking-tight">
                  <AnimatedCounter value={displayedRiskCounts.high} />
                </p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Students needing immediate intervention</p>
              </div>
            </div>

            <div className="relative rounded-md border border-amber-500 dark:border-amber-500 bg-white dark:bg-[#111111] hover:border-amber-600 dark:hover:border-amber-400 transition-colors p-4 min-h-[100px] flex flex-col justify-center shadow-sm">
              <div className="absolute right-3 top-3">
                <RiskRangeInfo range="Composite rating is between 70% to 85%" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-risk-moderate">
                  <p className="text-[10px] font-bold uppercase tracking-wider">Moderate Risk</p>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-risk-moderate mt-0.5 tracking-tight">
                  <AnimatedCounter value={displayedRiskCounts.moderate} />
                </p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Students requiring monitoring</p>
              </div>
            </div>

            <div className="relative rounded-md border border-emerald-500 dark:border-emerald-500 bg-white dark:bg-[#111111] hover:border-emerald-600 dark:hover:border-emerald-400 transition-colors p-4 min-h-[100px] flex flex-col justify-center shadow-sm">
              <div className="absolute right-3 top-3">
                <RiskRangeInfo range="Composite rating is between 86% to 100%" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-risk-low">
                  <p className="text-[10px] font-bold uppercase tracking-wider">Low Risk</p>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-risk-low mt-0.5 tracking-tight">
                  <AnimatedCounter value={displayedRiskCounts.low} />
                </p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">Students performing well</p>
              </div>
            </div>
          </div>

          {/* ── Risk Level Trend Chart ── */}
          <section className="rounded-md border border-gray-200 bg-white p-3.5 sm:p-5 dark:border-[#1A1A1A] dark:bg-[#111111] shadow-sm" aria-labelledby="risk-overview-heading">
            <div className="flex flex-col gap-2.5 sm:gap-3 border-b border-gray-100 pb-3 sm:pb-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
              <div>
                <h3 id="risk-overview-heading" className="text-xs sm:text-sm font-bold uppercase text-gray-900 dark:text-slate-100">
                  {riskLevelTrendTitle}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#EF4444' }} />High Risk</span>
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} />Moderate Risk</span>
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#22C55E' }} />Low Risk</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0 relative">
                  <StudentRiskFilter
                    rows={rows}
                    value={riskScope}
                    onChange={(val) => {
                      setRiskScope(val);
                      setRiskTrendPage(0);
                    }}
                  />
                </div>
                <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#111111] shrink-0 whitespace-nowrap" role="group" aria-label="Filter risk chart by time period">
                  {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setRiskTrendFilter(filter);
                        setRiskTrendPage(0);
                      }}
                      className={`cursor-pointer rounded-sm px-2.5 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all whitespace-nowrap ${
                        riskTrendFilter === filter
                          ? 'bg-[var(--brand)] text-white shadow-xs'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                {/* Period navigation arrows to scroll between previous and present records */}
                <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#111111]" role="group" aria-label="Scroll between previous and present risk records">
                  <button
                    type="button"
                    onClick={() => setRiskTrendPage((p) => p + 1)}
                    disabled={riskTrendPage >= 10}
                    aria-label="Previous records"
                    title={riskTrendPage >= 10 ? 'Earliest historical records reached' : 'Scroll to previous records'}
                    className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E1E1E] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                  >
                    <ChevronLeft size={14} className="stroke-[2.5]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskTrendPage((p) => Math.max(0, p - 1))}
                    disabled={riskTrendPage === 0}
                    aria-label="Next records"
                    title={riskTrendPage === 0 ? 'Viewing present records' : 'Scroll towards present records'}
                    className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E1E1E] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                  >
                    <ChevronRight size={14} className="stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="relative rounded-md border border-gray-100 bg-gray-50/60 p-2 sm:p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
                <RiskTrendChart
                  data={riskTrend}
                  total={riskScopedRows.length}
                  isSingleStudent={riskScope !== 'all'}
                  studentName={selectedRiskStudent?.full_name}
                  trendFilter={riskTrendFilter}
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
            <div className="rounded-md border border-emerald-500 dark:border-emerald-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#111111] shadow-sm">
              <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={3} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Present {attendanceSummary.periodLabel}
                </p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100 mt-0.5 tracking-tight">
                  <AnimatedCounter value={attendanceSummary.present} />
                </p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  {attendanceScope === 'all'
                    ? `Records marked present ${attendanceSummary.periodLabel.toLowerCase()}`
                    : `Days marked present ${attendanceSummary.periodLabel.toLowerCase()}`}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-rose-500 dark:border-rose-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#111111] shadow-sm">
              <X className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Absent {attendanceSummary.periodLabel}
                </p>
                <p className="text-2xl sm:text-3xl font-black text-rose-900 dark:text-rose-100 mt-0.5 tracking-tight">
                  <AnimatedCounter value={attendanceSummary.absent} />
                </p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  {attendanceScope === 'all'
                    ? `Records marked absent ${attendanceSummary.periodLabel.toLowerCase()}`
                    : `Days marked absent ${attendanceSummary.periodLabel.toLowerCase()}`}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-4 min-h-[100px] flex flex-col justify-center dark:border-[#1A1A1A] dark:bg-[#111111] shadow-sm">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                  Average Attendance Rate {attendanceSummary.periodLabel !== 'Today' ? `(${attendanceSummary.periodLabel})` : ''}
                </p>
                <p className={`text-2xl sm:text-3xl font-black mt-0.5 tracking-tight ${attendanceSummary.total === 0 && activeAttendanceLogs.length === 0 ? 'text-gray-400 dark:text-slate-500' : avgAttendance >= 81 ? 'text-risk-low' : avgAttendance >= 75 ? 'text-risk-moderate' : 'text-risk-high'}`}>
                  {attendanceSummary.total === 0 && activeAttendanceLogs.length === 0 ? '—' : <AnimatedCounter value={avgAttendance} decimals={avgAttendance % 1 !== 0 ? 1 : 0} suffix="%" />}
                </p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  {attendanceScope !== 'all'
                    ? 'Student average attendance rate'
                    : selectedTutorId === 'all' && selectedClassId === 'all'
                    ? 'School-wide average attendance rate'
                    : `${selectedClassLabel !== 'ALL CLASSES' ? selectedClassLabel : selectedTutorLabel} average attendance rate`}
                </p>
              </div>
            </div>
          </div>

          {/* Attendance Trend Chart */}
          <div className="w-full rounded-md border border-gray-200 bg-white p-3.5 sm:p-5 dark:border-[#1A1A1A] dark:bg-[#111111] shadow-sm">
            <div className="flex flex-col gap-2.5 sm:gap-3 border-b border-gray-100 pb-3 sm:pb-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
              <div>
                <h3 className="text-xs sm:text-sm font-bold uppercase text-gray-900 dark:text-slate-100">
                  {attendanceTrendTitle}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-slate-300 shrink-0">
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#0052B7]" />Attendance Rate</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0 relative">
                  <StudentRiskFilter
                    rows={rows}
                    value={attendanceScope}
                    onChange={(val) => {
                      setAttendanceScope(val);
                      setAttendanceTrendPage(0);
                    }}
                  />
                </div>
                <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#111111] shrink-0 whitespace-nowrap" aria-label="Attendance trend period">
                  {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setAttendanceFilter(filter);
                        setAttendanceTrendPage(0);
                      }}
                      className={`rounded-sm px-2.5 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                        attendanceFilter === filter
                          ? 'bg-[var(--brand)] text-white shadow-xs'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                {/* Period navigation arrows */}
                <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#111111]" role="group" aria-label="Scroll between previous and present attendance records">
                  <button
                    type="button"
                    onClick={() => setAttendanceTrendPage((p) => p + 1)}
                    disabled={attendanceTrendPage >= 10}
                    aria-label="Previous records"
                    title={attendanceTrendPage >= 10 ? 'Earliest historical records reached' : 'Scroll to previous records'}
                    className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E1E1E] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                  >
                    <ChevronLeft size={14} className="stroke-[2.5]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceTrendPage((p) => Math.max(0, p - 1))}
                    disabled={attendanceTrendPage === 0}
                    aria-label="Next records"
                    title={attendanceTrendPage === 0 ? 'Viewing present records' : 'Scroll towards present records'}
                    className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E1E1E] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                  >
                    <ChevronRight size={14} className="stroke-[2.5]" />
                  </button>
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
                    ? `${selectedClassLabel} Average Attendance Rate`
                    : selectedTutorId === 'all'
                    ? 'School Average Attendance Rate'
                    : `${selectedTutorLabel}'s Average Attendance Rate`
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
            <div className="rounded-md border border-emerald-500 dark:border-emerald-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#111111] shadow-sm">
              <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={3} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Passed {scoreSummary.periodLabel}
                </p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100 mt-0.5 tracking-tight">
                  <AnimatedCounter value={scoreSummary.passed} />
                </p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  Assessments scored ≥ 70% {scoreSummary.periodLabel.toLowerCase()}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-rose-500 dark:border-rose-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#111111] shadow-sm">
              <X className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Failed {scoreSummary.periodLabel}
                </p>
                <p className="text-2xl sm:text-3xl font-black text-rose-900 dark:text-rose-100 mt-0.5 tracking-tight">
                  <AnimatedCounter value={scoreSummary.failed} />
                </p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  Assessments scored ≤ 69% {scoreSummary.periodLabel.toLowerCase()}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-4 min-h-[100px] flex flex-col justify-center dark:border-[#1A1A1A] dark:bg-[#111111] shadow-sm">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                  Average Score Rate {scoreSummary.periodLabel !== 'Today' ? `(${scoreSummary.periodLabel})` : ''}
                </p>
                <p className={`text-2xl sm:text-3xl font-black mt-0.5 tracking-tight ${scoreSummary.total === 0 && activeGrades.filter((g) => g.component_type !== 'attendance' && !isNotTakenGrade(g)).length === 0 ? 'text-gray-400 dark:text-slate-500' : avgScore >= 81 ? 'text-risk-low' : avgScore >= 75 ? 'text-risk-moderate' : 'text-risk-high'}`}>
                  {scoreSummary.total === 0 && activeGrades.filter((g) => g.component_type !== 'attendance' && !isNotTakenGrade(g)).length === 0 ? '—' : <AnimatedCounter value={avgScore} decimals={avgScore % 1 !== 0 ? 1 : 0} suffix="%" />}
                </p>
                <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-slate-400">
                  {scoreScope !== 'all'
                    ? 'Student average score rate'
                    : selectedTutorId === 'all' && selectedClassId === 'all'
                    ? 'School-wide average score rate'
                    : `${selectedClassLabel !== 'ALL CLASSES' ? selectedClassLabel : selectedTutorLabel} average score rate`}
                </p>
              </div>
            </div>
          </div>

          {/* Score Trend Chart */}
          <div className="w-full rounded-md border border-gray-200 bg-white p-3.5 sm:p-5 dark:border-[#1A1A1A] dark:bg-[#111111] shadow-sm">
            <div className="flex flex-col gap-2.5 sm:gap-3 border-b border-gray-100 pb-3 sm:pb-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
              <div>
                <h3 className="text-xs sm:text-sm font-bold uppercase text-gray-900 dark:text-slate-100">
                  {scoreTrendTitle}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-slate-300 shrink-0">
                  <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#0052B7]" />Average Score Rate</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0 relative">
                  <StudentRiskFilter
                    rows={rows}
                    value={scoreScope}
                    onChange={(val) => {
                      setScoreScope(val);
                      setScoreTrendPage(0);
                    }}
                  />
                </div>
                <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#111111] shrink-0 whitespace-nowrap" aria-label="Score trend period">
                  {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setScoreFilter(filter);
                        setScoreTrendPage(0);
                      }}
                      className={`rounded-sm px-2.5 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                        scoreFilter === filter
                          ? 'bg-[var(--brand)] text-white shadow-xs'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                {/* Period navigation arrows */}
                <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#111111]" role="group" aria-label="Scroll between previous and present score records">
                  <button
                    type="button"
                    onClick={() => setScoreTrendPage((p) => p + 1)}
                    disabled={scoreTrendPage >= 10}
                    aria-label="Previous records"
                    title={scoreTrendPage >= 10 ? 'Earliest historical records reached' : 'Scroll to previous records'}
                    className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E1E1E] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                  >
                    <ChevronLeft size={14} className="stroke-[2.5]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setScoreTrendPage((p) => Math.max(0, p - 1))}
                    disabled={scoreTrendPage === 0}
                    aria-label="Next records"
                    title={scoreTrendPage === 0 ? 'Viewing present records' : 'Scroll towards present records'}
                    className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E1E1E] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                  >
                    <ChevronRight size={14} className="stroke-[2.5]" />
                  </button>
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
                    ? `${selectedClassLabel} Average Score Rate`
                    : selectedTutorId === 'all'
                    ? 'School Average Score Rate'
                    : `${selectedTutorLabel}'s Average Score Rate`
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
