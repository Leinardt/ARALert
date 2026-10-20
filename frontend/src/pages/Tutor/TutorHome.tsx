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
  X,
  BarChart2,
} from 'lucide-react';
import { computeStudentRiskRows, type StudentRiskRow, getRiskAvatarClass } from '../../utils/analyticsHelpers';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';
import {
  getCurrentSemesterMilestone,
  getActiveSystemMilestone,
  getActiveSystemSemester,
  setActiveSystemSemester,
} from '../../utils/sessionDescriptionHelpers';
import { TutorCohortFilter } from '../../components/TutorCohortFilter';
import { useTutorCohortFilter, isStudentInCohort, getTutorClassViewLabel, getCachedTutorStudents } from '../../utils/tutorCohortHelpers';

interface TutorChartPoint {
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

const InteractiveTutorChart: React.FC<{ data: TutorChartPoint[]; trendFilter: TrendFilter }> = ({ data, trendFilter }) => {
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
  const paddingLeft = isMobile ? 44 : 50;
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

  const getFormattedLabel = (p: TutorChartPoint) => {
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
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full block" role="img" aria-label="Students Performance Trend Chart">
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
              <text x={paddingLeft - 8} y={y + 3} className="fill-slate-400 font-semibold text-[9px] xs:text-[10px]" textAnchor="end">{val}%</text>
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

  const [students, setStudents] = useState<User[]>(() => getCachedTutorStudents(user?.id));
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(() => getCachedTutorStudents(user?.id).length === 0);
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

  const {
    selectedAralLevel,
    setSelectedAralLevel,
    selectedSubject,
    setSelectedSubject,
    selectedCohort,
    setSelectedCohort,
    setSelectedCohortFilter,
  } = useTutorCohortFilter(user, { allowAll: true, defaultToAll: true });

  const filteredStudents = useMemo(() => {
    return students.filter((s) =>
      isStudentInCohort(s, {
        aral_level: selectedAralLevel,
        subject: selectedSubject,
        cohort: selectedCohort,
      })
    );
  }, [students, selectedAralLevel, selectedSubject, selectedCohort]);

  const studentStats = useMemo(
    () => computeStudentStats(filteredStudents, grades, attendance),
    [filteredStudents, grades, attendance]
  );
  const totalStudents = filteredStudents.length;

  const avgAttendance = useMemo(() => {
    if (studentStats.length === 0) return 0;
    return Math.round((studentStats.reduce((acc, s) => acc + s.attendanceRate, 0) / studentStats.length) * 10) / 10;
  }, [studentStats]);

  const avgScore = useMemo(() => {
    const withScores = studentStats.filter((s) => s.scoreAvg > 0);
    if (withScores.length === 0) return 0;
    return Math.round((withScores.reduce((acc, s) => acc + s.scoreAvg, 0) / withScores.length) * 10) / 10;
  }, [studentStats]);

  const filteredStudentIds = useMemo(() => new Set(filteredStudents.map((s) => String(s.id))), [filteredStudents]);

  const hasScoreData = useMemo(() => {
    return grades.some(
      (grade) =>
        filteredStudentIds.has(String(grade.student)) &&
        grade.remarks?.trim().toLowerCase() !== 'not taken'
    );
  }, [grades, filteredStudentIds]);

  const hasAttendanceData = useMemo(() => {
    return attendance.some((att) => {
      const uid = String((att as any).user?.id || (att as any).user || (att as any).student?.id || (att as any).student || '');
      return filteredStudentIds.has(uid);
    });
  }, [attendance, filteredStudentIds]);

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
  const mediumRiskStudents = useMemo(
    () => studentStats.filter((s) => s.riskTier === 'Medium'),
    [studentStats]
  );
  const lowRiskStudents = useMemo(
    () => studentStats.filter((s) => s.riskTier === 'Low'),
    [studentStats]
  );

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

  const tutorMilestone = useMemo(() => {
    return getActiveSystemMilestone();
  }, [activeSystemSem]);

  const classViewLabel = useMemo(() => {
    return getTutorClassViewLabel({
      user,
      selectedAralLevel,
      selectedSubject,
      selectedCohort,
    });
  }, [user, selectedAralLevel, selectedSubject, selectedCohort]);

  const performanceTrendTitle = useMemo(() => {
    if (!classViewLabel) {
      return 'STUDENTS PERFORMANCE TREND';
    }
    return `${classViewLabel}'S PERFORMANCE TREND`;
  }, [classViewLabel]);

  const topAtRiskTitle = useMemo(() => {
    if (!classViewLabel) {
      return 'ALL TOP AT-RISK STUDENTS';
    }
    return `${classViewLabel}'S TOP AT-RISK`;
  }, [classViewLabel]);

  const last4WeeksData = useMemo(() => {
    if (filteredStudents.length === 0 || grades.length === 0) return [];
    const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
    const assessmentGrades = grades.filter((g) => {
      if (!studentIds.has(String(g.student)) || g.component_type !== 'assessment') return false;
      if (selectedSubject && selectedSubject.toLowerCase() !== 'all') {
        const gradeSub = (g.subject || '').toLowerCase();
        const selSub = selectedSubject.toLowerCase();
        if (selSub === 'filipino' && !(gradeSub.includes('filipino') || gradeSub.includes('reading'))) return false;
        if (selSub === 'english' && !gradeSub.includes('english')) return false;
        if (selSub === 'science' && !gradeSub.includes('science')) return false;
        if (selSub === 'math' && !gradeSub.includes('math')) return false;
      }
      return true;
    });
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:h-[calc(100vh-8.5rem)] lg:min-h-[32rem] skeleton-container w-full min-w-0 max-w-full">
        {/* Left Section skeleton: 3 top cards + Chart below */}
        <div className="lg:col-span-3 flex flex-col gap-3 h-full min-h-0 w-full min-w-0 max-w-full">
          {/* 3 KPI Cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 skeleton-row-1">
            <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-3.5 h-[116px] sm:h-[120px] animate-pulse flex flex-col justify-between">
              <div>
                <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
                <div className="h-7 w-14 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
              <div className="h-2.5 w-24 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] animate-pulse divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between">
              {[1, 2].map((i) => (
                <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-2">
                  <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-800" />
                </div>
              ))}
            </div>
            <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] animate-pulse divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-1.5">
                  <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-3.5 w-8 rounded bg-gray-200 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          </div>

          {/* Chart card skeleton */}
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md px-4 py-4 sm:px-5 flex flex-col flex-1 min-h-0 animate-pulse">
            <div className="flex items-center justify-between gap-2 shrink-0 pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
              <div className="min-w-0 flex-1">
                <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-nowrap">
                <div className="h-4 w-28 rounded bg-gray-100 dark:bg-gray-800 hidden sm:block" />
                <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-800 hidden sm:block" />
                <div className="h-7 w-24 rounded-md bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 gap-3 mt-3.5 sm:mt-4">
              <div className="relative flex-1 min-h-0 w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-sm" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 skeleton-row-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="bg-gray-50 dark:bg-[#111111] p-2 rounded-sm border border-gray-100 dark:border-[#1A1A1A] text-center">
                      <div className="h-2.5 w-12 rounded bg-gray-200 dark:bg-gray-800 mx-auto" />
                      <div className="h-5 w-14 rounded bg-gray-200 dark:bg-gray-800 mx-auto mt-1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* At-Risk panel skeleton (spans from top to bottom) */}
        <div className="lg:col-span-1 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md flex flex-col h-full min-h-0 overflow-hidden animate-pulse">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between shrink-0">
            <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-5 w-7 rounded-full bg-rose-100 dark:bg-rose-950/40" />
          </div>
          <div className="p-2 space-y-1 flex-1 min-h-0 overflow-y-auto skeleton-row-3">
            {[1, 2, 3, 4, 5, 6, 7].map((j) => (
              <div key={j} className="px-3 py-2 rounded-sm border border-gray-100 dark:border-[#1A1A1A] bg-gray-50/50 dark:bg-[#111111] flex flex-col justify-between">
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
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-md p-4">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load dashboard</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-md text-xs font-bold hover:bg-rose-700 transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full min-w-0 max-w-full data-loaded-content">
      {/* ── Tutor Multi-Cohort Filter (ARAL Level, Subject, Grade - Section) ── */}
      <TutorCohortFilter
        user={user}
        students={students}
        isLoading={isLoading}
        selectedAralLevel={selectedAralLevel}
        onSelectAralLevel={setSelectedAralLevel}
        selectedSubject={selectedSubject}
        onSelectSubject={setSelectedSubject}
        selectedCohort={selectedCohort}
        onSelectCohort={setSelectedCohort}
        onSelectClass={(level, subject, cohort) =>
          setSelectedCohortFilter({ aral_level: level, subject, cohort })
        }
        allowAll={true}
        title="CURRENT CLASS FOR VIEW"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:min-h-[30rem] w-full min-w-0 max-w-full">
      {/* ── Left 3-Column Section: 3 Top Summary Cards + Chart Below ──── */}
      <div className="lg:col-span-3 flex flex-col gap-3 h-full min-h-0 w-full min-w-0 max-w-full">
        {/* Row 1: My Students | Avg Attendance & Scores | High/Medium/Low Risk */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 w-full min-w-0 max-w-full">
          {/* 1. My Students */}
          <Link
            to="/tutor/students"
            className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-3 sm:p-3.5 transition-colors hover:bg-gray-50/60 dark:hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] flex flex-col justify-between h-[116px] sm:h-[120px] w-full min-w-0 shadow-2xs"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">My Students</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mt-0.5 sm:mt-1 tracking-tight text-gray-900 dark:text-slate-100">{totalStudents}</p>
            </div>
            <p className="text-[11px] font-normal text-gray-400 dark:text-slate-500">Enrolled learners</p>
          </Link>

          {/* 2. Average Attendance & Average Scores */}
          <div className="flex flex-col justify-between divide-y divide-gray-100 dark:divide-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] w-full min-w-0 shadow-2xs">
            <Link
              to="/tutor/analytics?tab=attendance"
              className="flex-1 flex items-center justify-between px-3.5 py-2 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">AVERAGE ATTENDANCE</p>
              <p className={`text-base sm:text-lg font-extrabold shrink-0 ${!hasAttendanceData ? 'text-gray-400 dark:text-slate-500' : avgAttendance >= 81 ? 'text-risk-low' : avgAttendance >= 75 ? 'text-risk-medium' : 'text-risk-high'}`}>
                {!hasAttendanceData ? '—' : `${avgAttendance}%`}
              </p>
            </Link>
            <Link
              to="/tutor/analytics?tab=score"
              className="flex-1 flex items-center justify-between px-3.5 py-2 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">AVERAGE SCORES</p>
              <p className={`text-base sm:text-lg font-extrabold shrink-0 ${!hasScoreData ? 'text-gray-400 dark:text-slate-500' : avgScore >= 81 ? 'text-risk-low' : avgScore >= 75 ? 'text-risk-medium' : 'text-risk-high'}`}>
                {!hasScoreData ? '—' : `${avgScore}%`}
              </p>
            </Link>
          </div>

          {/* 3. High / Medium / Low Risk Breakdown */}
          <div className="flex flex-col justify-between divide-y divide-gray-100 dark:divide-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] w-full min-w-0 shadow-2xs">
            <Link
              to="/tutor/analytics"
              className="flex-1 flex items-center justify-between px-3.5 py-1.5 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">High Risk</p>
              <p className="text-xs sm:text-sm font-extrabold text-risk-high shrink-0">{highRiskStudents.length}</p>
            </Link>
            <Link
              to="/tutor/analytics"
              className="flex-1 flex items-center justify-between px-3.5 py-1.5 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">Medium Risk</p>
              <p className="text-xs sm:text-sm font-extrabold text-risk-medium shrink-0">{mediumRiskStudents.length}</p>
            </Link>
            <Link
              to="/tutor/analytics"
              className="flex-1 flex items-center justify-between px-3.5 py-1.5 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">Low Risk</p>
              <p className="text-xs sm:text-sm font-extrabold text-risk-low shrink-0">{lowRiskStudents.length}</p>
            </Link>
          </div>
        </div>

        {/* Row 2: Performance Trend Chart */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md px-3.5 py-3.5 sm:px-5 flex flex-col flex-1 min-h-0 w-full min-w-0 max-w-full">
          <div className="flex items-center justify-between gap-2 shrink-0 pb-2.5 sm:pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight truncate">{performanceTrendTitle}</h3>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
              <div className="hidden xs:flex items-center gap-2 sm:gap-3 shrink-0 whitespace-nowrap">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 whitespace-nowrap">
                  <span className="h-2 w-2 rounded-full bg-[var(--brand)] inline-block shrink-0" />
                  <span className="hidden sm:inline whitespace-nowrap">Composite rating</span>
                  <span className="sm:hidden whitespace-nowrap">Composite</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                  <span className="h-2 w-2 rounded-full bg-[#38BDF8] inline-block shrink-0" />
                  <span className="truncate max-w-[100px] sm:max-w-none whitespace-nowrap">{tutorMilestone}</span>
                </div>
              </div>
              <div className="flex bg-gray-100 dark:bg-[#111111] rounded-md p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
                {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTrendFilter(filter)}
                    className={`rounded-sm px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${trendFilter === filter ? 'bg-[var(--brand)] text-white shadow-xs' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 gap-3 mt-3 sm:mt-4">
            <div className="relative flex-1 min-h-[180px] xs:min-h-[200px] sm:min-h-[220px] w-full min-w-0 max-w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-lg px-2 py-2 sm:px-5 sm:py-2.5 overflow-hidden">
              {last4WeeksData.length > 0 ? (
                <InteractiveTutorChart data={last4WeeksData} trendFilter={trendFilter} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
                  <BarChart2 className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                    {trendFilter === 'day' ? 'No recorded score today' : trendFilter === 'week' ? 'No recorded score this week' : 'No recorded score this month'}
                  </p>
                  <p className="text-[11px] text-gray-300 dark:text-slate-600">
                    Data will appear once scores and attendance are logged for your students
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0 pt-1">
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
                <div key={stat.label} className="bg-gray-50/80 dark:bg-[#111111] p-2.5 rounded-lg border border-gray-100 dark:border-[#1A1A1A] text-center flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{stat.label}</p>
                  <p className={`text-base sm:text-lg font-extrabold mt-0.5 ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
              <div className="bg-gray-50/80 dark:bg-[#111111] p-2.5 rounded-lg border border-gray-100 dark:border-[#1A1A1A] text-center flex flex-col justify-center">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Trend</p>
                <div className="mt-0.5">
                  {last4WeeksData.length === 0 ? (
                    <span className="text-base sm:text-lg font-extrabold text-gray-400 dark:text-slate-500">—</span>
                  ) : tutorTrendDir === 'up' ? (
                    <span className="text-base sm:text-lg font-extrabold text-risk-low">Improving</span>
                  ) : tutorTrendDir === 'down' ? (
                    <span className="text-base sm:text-lg font-extrabold text-risk-high">Declining</span>
                  ) : (
                    <span className="text-base sm:text-lg font-extrabold text-gray-500 dark:text-slate-400">Stable</span>
                  )}
                </div>
              </div>
              <Link
                to="/tutor/analytics"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-light)]/70 px-4 py-2.5 text-xs font-semibold text-[var(--brand)] dark:text-sky-400 transition hover:border-[var(--brand)] hover:bg-[var(--brand-light)] hover:text-[var(--brand-hover)] dark:hover:text-sky-300"
              >
                <span>See More</span>
                <span className="font-bold" aria-hidden="true">&gt;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right 1-Column Section: Top At-Risk Panel Spanning Full Height ──── */}
      <div className="lg:col-span-1 h-full min-h-0">
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md overflow-hidden h-full flex flex-col max-h-[420px] lg:max-h-none shadow-2xs">
          <div className="flex items-center justify-between gap-1.5 px-3 sm:px-3.5 py-3 border-b border-gray-100 dark:border-[#1A1A1A] shrink-0">
            <h3
              className="text-[9.5px] sm:text-[10px] xl:text-[9.5px] 2xl:text-[11px] font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight whitespace-nowrap truncate min-w-0"
              title={topAtRiskTitle}
            >
              {topAtRiskTitle}
            </h3>
            <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 text-[10px] font-extrabold text-gray-700 dark:text-slate-300">
              {atRiskStudents.length}
            </span>
          </div>

          <div className="p-2 space-y-1 flex-1 min-h-0 overflow-y-auto">
            {atRiskStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4 gap-2">
                <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">All students on track</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">No high or medium risk students.</p>
              </div>
            ) : (
              atRiskStudents.slice(0, 20).map((s) => (
                <Link
                  key={s.student.id}
                  to={`/tutor/students/${s.student.id}`}
                  state={{ from: 'dashboard' }}
                  className={`block rounded-sm border px-3 py-2 min-h-[44px] flex flex-col justify-center transition-colors hover:opacity-90 ${s.riskTier === 'High'
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
                        Composite:
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
