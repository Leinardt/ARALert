import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance, Grade, StudentAcademicProfile } from '../../types';
import {
  AlertCircle,
  BarChart2,
} from 'lucide-react';
import { computeStudentRiskRows } from '../../utils/analyticsHelpers';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';
import {
  getCurrentSemesterMilestone,
  getActiveSystemMilestone,
  getActiveSystemSemester,
  setActiveSystemSemester,
} from '../../utils/sessionDescriptionHelpers';

// ─── Chart Types & Interactive Bézier Chart ──────────────────────────────────

interface StudentChartPoint {
  label: string;
  fullDateLabel?: string;
  dateRange: string;
  value: number;
  actualCount: number;
  attendanceCount?: number;
  assessmentLabels: string[];
}

type TrendFilter = 'day' | 'week' | 'month';

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

const InteractiveStudentChart: React.FC<{ data: StudentChartPoint[]; trendFilter: TrendFilter }> = ({ data, trendFilter }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 260 });

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
  }, []);

  const { width, height } = dimensions;
  const isMobile = width < 520;
  const paddingLeft = isMobile ? 38 : 50;
  const paddingRight = isMobile ? 18 : 14;
  const paddingTop = isMobile ? 16 : 20;
  const paddingBottom = isMobile ? (trendFilter === 'month' ? 24 : 34) : 24;

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

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full min-h-[196px] sm:min-h-[220px] select-none min-w-0 overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full min-h-[196px] sm:min-h-[220px] block" role="img" aria-label="Student Performance Trend Chart">
        <defs>
          <linearGradient id="studentHomeChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
          <filter id="studentHomeChartGlow" x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal grid lines */}
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

        {/* Milestone guide lines */}
        {points.map((p, idx) => {
          if (p.assessmentLabels.length === 0) return null;
          return (
            <g key={`milestone-guide-${idx}`}>
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

        {/* X-axis date labels (complete dates for every point) */}
        {points.map((p, idx) => {
          if (isMobile) {
            const [line1, line2] = getMobileLabelLines(p.label);
            if (line2) {
              return (
                <text
                  key={`label-${idx}`}
                  x={p.x}
                  y={paddingTop + chartH + 13}
                  className="fill-slate-500 dark:fill-slate-400 font-semibold text-[8.5px]"
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
                className="fill-slate-500 dark:fill-slate-400 font-semibold text-[9px]"
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
              className="fill-slate-500 dark:fill-slate-400 font-semibold text-[10px]"
              textAnchor={textAnchor}
              style={{ whiteSpace: 'nowrap' }}
            >
              {p.label}
            </text>
          );
        })}

        {/* Brand Royal Blue Trend Line & Shaded Area */}
        {points.length > 0 && (
          <>
            <path d={areaD} fill="url(#studentHomeChartFill)" />
            <path
              d={pathD}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.28"
              filter="url(#studentHomeChartGlow)"
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
              <circle cx={p.x} cy={p.y} r="8.5" fill="#38BDF8" opacity="0.45" filter="url(#studentHomeChartGlow)" />
              <circle cx={p.x} cy={p.y} r="4.5" fill="#0284C7" stroke="#BAE6FD" strokeWidth="2" />
            </g>
          ) : null
        )}

        {/* Hover vertical line and dots */}
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

        {/* Hover hit regions */}
        {points.map((p, idx) => {
          const barW = chartW / (data.length - 1 || 1);
          const xStart = idx === 0 ? paddingLeft : p.x - barW / 2;
          const xEnd = idx === data.length - 1 ? width - paddingRight : p.x + barW / 2;
          return (
            <rect
              key={`hit-${idx}`}
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
                  color: p.value >= 81 ? '#22C55E' : p.value >= 75 ? '#F59E0B' : '#EF4444',
                }}
              >
                {p.value}%
              </span>
              <span className="text-[9px] text-slate-500 dark:text-zinc-400">Total Composite Rating</span>
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDateString = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${weekday}, ${month} ${day}, ${year}`;
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
        setGrades(Array.isArray(gradesData) ? gradesData : []);
        setAttendanceLogs(Array.isArray(attendanceData) ? attendanceData : []);
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

  const compositeRating = useMemo(() => {
    return studentStat ? studentStat.compositeScore : 100;
  }, [studentStat]);

  const hasScoreData = useMemo(() => {
    return currentStudentGrades.some((g) => g.remarks?.trim().toLowerCase() !== 'not taken');
  }, [currentStudentGrades]);

  const hasCompositeData = useMemo(() => {
    return currentStudentAttendance.length > 0 || hasScoreData;
  }, [currentStudentAttendance, hasScoreData]);

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

  // Student Milestone
  const studentMilestone = useMemo(() => {
    return getActiveSystemMilestone();
  }, [activeSystemSem]);

  // Student Risk Tier
  const studentRiskTier = studentStat?.riskTier || (profile?.computed_risk_level === 'high' ? 'High' : profile?.computed_risk_level === 'medium' ? 'Medium' : 'Low');

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
          if (assessmentText.includes(studentMilestone.toUpperCase())) {
            p.assessmentLabels.add(studentMilestone);
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

    currentStudentAttendance.forEach((att) => {
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
  }, [currentStudentGrades, currentStudentAttendance, trendFilter, studentMilestone]);

  const highestScore = useMemo(() => (last4WeeksData.length === 0 ? 0 : Math.max(...last4WeeksData.map((d) => d.value))), [last4WeeksData]);
  const lowestScore = useMemo(() => (last4WeeksData.length === 0 ? 0 : Math.min(...last4WeeksData.map((d) => d.value))), [last4WeeksData]);

  const studentTrendDir = useMemo(() => {
    if (last4WeeksData.length < 2) return 'stable';
    const first = last4WeeksData[0].value;
    const last = last4WeeksData[last4WeeksData.length - 1].value;
    return last > first ? 'up' : last < first ? 'down' : 'stable';
  }, [last4WeeksData]);

  const studentFirstName = user?.first_name || user?.full_name?.trim().split(' ')[0] || 'Student';

  // ── Render Loading Skeleton ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col lg:h-[calc(100vh-8.5rem)] lg:min-h-[30rem] gap-3 skeleton-container">
        {/* KPI Cards skeleton — hero + stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3 shrink-0 skeleton-row-1">
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 animate-pulse">
            <div className="h-2.5 w-28 rounded bg-gray-200 dark:bg-gray-800 mb-3" />
            <div className="h-12 w-24 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden animate-pulse divide-y divide-gray-100 dark:divide-[#1A1A1A]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-5 w-10 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Content row skeleton (Chart fills space) */}
        <div className="flex-1 flex flex-col min-h-0 skeleton-row-2">
          {/* Chart card skeleton */}
          <div className="w-full bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md px-4 py-4 sm:px-5 flex flex-col h-full min-h-0 animate-pulse">
            <div className="flex items-center justify-between gap-2 shrink-0 pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-nowrap">
                <div className="h-4 w-28 rounded-full bg-gray-100 dark:bg-gray-800 hidden sm:block" />
                <div className="h-4 w-20 rounded-full bg-gray-100 dark:bg-gray-800 hidden sm:block" />
                <div className="h-7 w-24 rounded-md bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 gap-3 mt-3.5 sm:mt-4">
              <div className="relative flex-1 min-h-0 w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-md" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 skeleton-row-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div
                      key={j}
                      className="bg-gray-50 dark:bg-[#111111] p-2 rounded-md border border-gray-100 dark:border-[#1A1A1A] text-center"
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
      </div>
    );
  }

  // ── Render Error View ───────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-md p-4">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load dashboard</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-md text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:h-[calc(100vh-8.5rem)] lg:min-h-[30rem] gap-3 data-loaded-content w-full min-w-0 max-w-full">
      {/* ── KPI Cards — hero left, 3 secondaries stacked right ──────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3 shrink-0 w-full min-w-0 max-w-full">
        {/* Hero: Composite Rating */}
        <Link
          to="/student/analytics"
          className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] flex flex-col justify-between w-full min-w-0 max-w-full"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">
              Composite Rating
            </p>
            <p
              className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold mt-1.5 sm:mt-2 tracking-tight ${
                !hasCompositeData
                  ? 'text-gray-400 dark:text-slate-500'
                  : compositeRating >= 81
                  ? 'text-risk-low'
                  : compositeRating >= 70
                  ? 'text-risk-medium'
                  : 'text-risk-high'
              }`}
            >
              {!hasCompositeData ? '—' : `${compositeRating.toFixed(1)}%`}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 dark:text-slate-500">
            Overall performance standing
          </p>
        </Link>

        {/* 3 Secondary metrics stacked */}
        <div className="flex flex-col divide-y divide-gray-100 dark:divide-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden w-full min-w-0 max-w-full">
          <Link
            to="/student/attendance"
            className="flex items-center justify-between px-3.5 sm:px-4 py-3 min-h-[44px] hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              Average Attendance
            </p>
            <p
              className={`text-base sm:text-xl font-extrabold shrink-0 ${
                currentStudentAttendance.length === 0
                  ? 'text-gray-400 dark:text-slate-500'
                  : avgAttendance >= 81
                  ? 'text-risk-low'
                  : avgAttendance >= 75
                  ? 'text-risk-medium'
                  : 'text-risk-high'
              }`}
            >
              {currentStudentAttendance.length === 0 ? '—' : `${avgAttendance}%`}
            </p>
          </Link>

          <Link
            to="/student/scores"
            className="flex items-center justify-between px-3.5 sm:px-4 py-3 min-h-[44px] hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              Average Scores
            </p>
            <p
              className={`text-base sm:text-xl font-extrabold shrink-0 ${
                !hasScoreData
                  ? 'text-gray-400 dark:text-slate-500'
                  : avgScore >= 81
                  ? 'text-risk-low'
                  : avgScore >= 75
                  ? 'text-risk-medium'
                  : 'text-risk-high'
              }`}
            >
              {!hasScoreData ? '—' : `${avgScore}%`}
            </p>
          </Link>

          <Link
            to="/student/analytics"
            className="flex items-center justify-between px-3.5 sm:px-4 py-3 min-h-[44px] hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              Risk Level
            </p>
            <p
              className={`text-sm sm:text-lg font-extrabold shrink-0 ${
                studentRiskTier === 'High'
                  ? 'text-risk-high'
                  : studentRiskTier === 'Medium'
                  ? 'text-risk-medium'
                  : 'text-risk-low'
              }`}
            >
              {studentRiskTier ? `${studentRiskTier.toUpperCase()} RISK` : 'LOW RISK'}
            </p>
          </Link>
        </div>
      </div>

      {/* ── Main Performance Trend (Full Width) ── */}
      <div className="flex-1 flex flex-col min-h-0 w-full min-w-0 max-w-full">
        <div className="w-full max-w-full min-w-0 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md px-3 py-3.5 sm:px-5 flex flex-col h-full min-h-0">
          {/* Chart Header */}
          <div className="flex flex-col gap-1.5 shrink-0 pb-2.5 sm:pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
            <div className="flex items-center justify-between gap-1.5 sm:gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-[10px] sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight whitespace-nowrap truncate">
                  {studentFirstName}'s Performance Trend
                </h3>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 flex-nowrap">
                <div className="hidden sm:flex items-center gap-3 shrink-0 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full bg-[var(--brand)] inline-block shrink-0" />
                    <span className="whitespace-nowrap">Composite rating</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full bg-[#38BDF8] inline-block shrink-0" />
                    <span className="whitespace-nowrap">{studentMilestone}</span>
                  </div>
                </div>
                <div className="flex bg-gray-100 dark:bg-[#111111] rounded-md p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
                  {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setTrendFilter(filter)}
                      className={`rounded-sm px-1.5 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
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
            {/* Mobile Legend Row (< 640px) */}
            <div className="flex sm:hidden items-center gap-3 flex-wrap text-[11px] font-semibold">
              <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300 whitespace-nowrap">
                <span className="h-2 w-2 rounded-full bg-[var(--brand)] inline-block shrink-0" />
                <span>Composite rating</span>
              </div>
              <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 whitespace-nowrap">
                <span className="h-2 w-2 rounded-full bg-[#38BDF8] inline-block shrink-0" />
                <span>{studentMilestone}</span>
              </div>
            </div>
          </div>

          {/* Chart Canvas & Bottom Stats */}
          <div className="flex-1 flex flex-col min-h-0 gap-3 mt-3 sm:mt-4">
            <div className="relative flex-1 flex flex-col min-h-[216px] sm:min-h-[240px] w-full min-w-0 max-w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-lg px-2 py-2.5 sm:px-5 sm:py-2.5 overflow-hidden">
              {last4WeeksData.length > 0 ? (
                <InteractiveStudentChart data={last4WeeksData} trendFilter={trendFilter} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center select-none">
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

            {/* Bottom 4 KPI Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0 pt-1">
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
                <div
                  key={stat.label}
                  className="bg-gray-50/80 dark:bg-[#111111] p-2.5 rounded-lg border border-gray-100 dark:border-[#1A1A1A] text-center flex flex-col justify-center"
                >
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <p className={`text-base sm:text-lg font-extrabold mt-0.5 ${stat.color}`}>{stat.value}</p>
                </div>
              ))}

              <div className="bg-gray-50/80 dark:bg-[#111111] p-2.5 rounded-lg border border-gray-100 dark:border-[#1A1A1A] text-center flex flex-col justify-center">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                  Trend
                </p>
                <div className="mt-0.5">
                  {last4WeeksData.length === 0 ? (
                    <span className="text-base sm:text-lg font-extrabold text-gray-400 dark:text-slate-500">—</span>
                  ) : studentTrendDir === 'up' ? (
                    <span className="text-base sm:text-lg font-extrabold text-risk-low">Improving</span>
                  ) : studentTrendDir === 'down' ? (
                    <span className="text-base sm:text-lg font-extrabold text-risk-high">Declining</span>
                  ) : (
                    <span className="text-base sm:text-lg font-extrabold text-gray-500 dark:text-slate-400">Stable</span>
                  )}
                </div>
              </div>

              <Link
                to="/student/analytics"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-light)]/70 px-4 py-2.5 text-xs font-semibold text-[var(--brand)] dark:text-sky-400 transition hover:border-[var(--brand)] hover:bg-[var(--brand-light)] hover:text-[var(--brand-hover)] dark:hover:text-sky-300 cursor-pointer"
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

