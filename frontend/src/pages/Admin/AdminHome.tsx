import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { Attendance, Grade, User, UserStats } from '../../types';
import {
  GraduationCap,
  Users,
  Briefcase,
  BarChart2,
  AlertCircle,
  Smile,
  Meh,
  Frown,
} from 'lucide-react';
import { computeStudentRiskRows } from '../../utils/analyticsHelpers';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';

// ─── Chart Types & Interactive Chart Component ─────────────────────────────────

interface AdminChartPoint {
  label: string;
  fullDateLabel?: string;
  dateRange: string;
  value: number;
  actualCount: number;
  attendanceCount?: number;
  assessmentLabels: string[];
}

const InteractiveAdminPerformanceChart: React.FC<{ data: AdminChartPoint[] }> = ({ data }) => {
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
  const paddingLeft = 28;
  const paddingRight = 14;
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
          <linearGradient id="adminChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
          <filter id="adminChartGlow" x="-20%" y="-30%" width="140%" height="160%">
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
              <text x={paddingLeft - 6} y={y + 3} className="fill-slate-400 font-semibold text-[8px]" textAnchor="end">
                {val}%
              </text>
            </g>
          );
        })}

        {/* Milestone guide lines */}
        {points.map((p, idx) => {
          if (p.assessmentLabels.length === 0) return null;
          return (
            <g key={`milestone-${idx}`}>
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

        {/* Brand Trend Line & Area */}
        {points.length > 0 && (
          <>
            <path d={areaD} fill="url(#adminChartFill)" />
            <path
              d={pathD}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.28"
              filter="url(#adminChartGlow)"
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
              <circle cx={p.x} cy={p.y} r="8.5" fill="#38BDF8" opacity="0.45" filter="url(#adminChartGlow)" />
              <circle cx={p.x} cy={p.y} r="4.5" fill="#0284C7" stroke="#BAE6FD" strokeWidth="2" />
            </g>
          ) : null
        )}

        {/* Vertical line and dots on hover */}
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
            />
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
            className="pointer-events-none absolute z-10 min-w-[170px] rounded-xl border border-slate-700/50 bg-slate-900/95 p-3 text-left text-[11px] font-medium leading-normal text-white shadow-xl"
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
              <span className="text-[9px] text-slate-400">Average Composite Rating</span>
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
                  ? `${p.actualCount} ${p.actualCount === 1 ? 'assessment' : 'assessments'} logged`
                  : 'No assessments logged'}
              </div>
              <div>
                {(p.attendanceCount ?? 0) > 0
                  ? `${p.attendanceCount} attendance record${p.attendanceCount === 1 ? '' : 's'}`
                  : 'No attendance records'}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── Main AdminHome Component ──────────────────────────────────────────────────

type TrendFilter = 'day' | 'week' | 'month';

export const AdminHome: React.FC = () => {
  const { user } = useAuth();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [tutors, setTutors] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trendFilter, setTrendFilter] = useState<TrendFilter>('week');
  const [selectedTutorId, setSelectedTutorId] = useState<string>('all');

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [statsData, tutorsData, studentsData, gradesData, attendanceData] = await Promise.all([
          userService.getStats(),
          userService.getAllUsers({ role: 'tutor' }),
          userService.getAllUsers({ role: 'student' }),
          academicService.getGrades().catch((err) => {
            console.warn('Could not load grades for admin dashboard:', err);
            return [] as Grade[];
          }),
          academicService.getAttendanceHistory().catch(() => [] as Attendance[]),
        ]);

        setStats(statsData);
        setTutors(Array.isArray(tutorsData) ? tutorsData : []);
        setStudents(Array.isArray(studentsData) ? studentsData : []);
        setGrades(Array.isArray(gradesData) ? gradesData : []);
        setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      } catch (err: any) {
        console.error('AdminHome fetch error:', err);
        setError(err?.response?.data?.detail || 'Failed to load school administration dashboard.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  // Filter students based on selected tutor
  const filteredStudents = useMemo(() => {
    if (selectedTutorId === 'all') return students;
    return students.filter((s) => String(s.assigned_tutor) === String(selectedTutorId));
  }, [students, selectedTutorId]);

  const selectedTutorObj = useMemo(() => {
    if (selectedTutorId === 'all') return null;
    return tutors.find((t) => String(t.id) === String(selectedTutorId)) || null;
  }, [tutors, selectedTutorId]);

  const tutorFirstName = useMemo(() => {
    if (!selectedTutorObj) return null;
    return (
      selectedTutorObj.first_name ||
      selectedTutorObj.full_name?.trim().split(' ')[0] ||
      'TUTOR'
    ).toUpperCase();
  }, [selectedTutorObj]);

  // Compute performance trend combining composite scores
  const chartTrendData = useMemo(() => {
    if (filteredStudents.length === 0 || grades.length === 0) return [];
    const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
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
          if (assessmentText.includes('MOSY')) {
            p.assessmentLabels.add('MOSY');
          } else if (assessmentText.includes('EOSY')) {
            p.assessmentLabels.add('EOSY');
          } else if (assessmentText.includes('ARAL SUMMER') || assessmentText.includes('SUMMER') || assessmentText.includes('BOSY')) {
            p.assessmentLabels.add('ARAL Summer Assessment');
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

    let lastValid = 75;
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
  }, [filteredStudents, grades, attendance, trendFilter]);

  const highestScore = useMemo(() => (chartTrendData.length === 0 ? 0 : Math.max(...chartTrendData.map((d) => d.value))), [chartTrendData]);
  const lowestScore = useMemo(() => (chartTrendData.length === 0 ? 0 : Math.min(...chartTrendData.map((d) => d.value))), [chartTrendData]);

  const trendDir = useMemo(() => {
    if (chartTrendData.length < 2) return 'stable';
    const first = chartTrendData[0].value;
    const last = chartTrendData[chartTrendData.length - 1].value;
    return last > first ? 'up' : last < first ? 'down' : 'stable';
  }, [chartTrendData]);

  const totalStudentsCount = stats?.students ?? students.length;
  const totalTutorsCount = stats?.tutors ?? tutors.length;
  const totalFacultyCount = stats?.faculty ?? 0;
  const totalPrincipalsCount = stats?.principals ?? 0;

  // ── Stakeholder-Validated Overall Metrics Calculations ───────────────────────
  const studentRiskRows = useMemo(() => {
    if (filteredStudents.length === 0) return [];
    return computeStudentRiskRows(filteredStudents, grades, attendance);
  }, [filteredStudents, grades, attendance]);

  const hasAttendanceData = useMemo(() => {
    const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
    const hasLogs = attendance.some((a) => {
      const aUser = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
      const aUserId = (a as any).user_id || (a as any).student_id;
      return studentIds.has(String(aUser)) || studentIds.has(String(aUserId));
    });
    if (hasLogs) return true;
    if (selectedTutorId === 'all' && (stats?.attendance_summary?.total_logs ?? 0) > 0) return true;
    if (selectedTutorId === 'all' && (stats?.academic_summary?.average_attendance_rate ?? 0) > 0) return true;
    return false;
  }, [filteredStudents, attendance, selectedTutorId, stats]);

  const hasScoreData = useMemo(() => {
    const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
    const hasScores = grades.some((g) => {
      const gStudent = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
      const gStudentId = (g as any).student_id;
      const isStudent = studentIds.has(String(gStudent)) || studentIds.has(String(gStudentId));
      return isStudent && g.component_type !== 'attendance' && g.remarks?.trim().toLowerCase() !== 'not taken';
    });
    if (hasScores) return true;
    if (selectedTutorId === 'all' && (stats?.academic_summary?.average_score ?? 0) > 0) return true;
    return false;
  }, [filteredStudents, grades, selectedTutorId, stats]);

  const overallAttendanceRate = useMemo(() => {
    if (studentRiskRows.length > 0 && attendance.length > 0) {
      const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
      const matchingAtt = attendance.filter((a) => {
        const aUser = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
        const aUserId = (a as any).user_id || (a as any).student_id;
        return studentIds.has(String(aUser)) || studentIds.has(String(aUserId));
      });
      if (matchingAtt.length > 0) {
        const presentCount = matchingAtt.filter((a) => a.status === 'present').length;
        return Math.round((presentCount / matchingAtt.length) * 1000) / 10;
      }
    }
    if (selectedTutorId === 'all' && stats?.academic_summary?.average_attendance_rate !== undefined && stats.academic_summary.average_attendance_rate > 0) {
      return stats.academic_summary.average_attendance_rate;
    }
    if (selectedTutorId === 'all' && stats?.attendance_summary && stats.attendance_summary.total_logs > 0) {
      return Math.round((stats.attendance_summary.present / stats.attendance_summary.total_logs) * 1000) / 10;
    }
    return 0;
  }, [studentRiskRows, attendance, filteredStudents, selectedTutorId, stats]);

  const overallAvgScore = useMemo(() => {
    if (studentRiskRows.length > 0 && hasScoreData) {
      const validScores = studentRiskRows.filter((r) => r.scoreAvg > 0);
      if (validScores.length > 0) {
        const total = validScores.reduce((sum, r) => sum + r.scoreAvg, 0);
        return Math.round((total / validScores.length) * 10) / 10;
      }
    }
    if (selectedTutorId === 'all' && stats?.academic_summary?.average_score !== undefined && stats.academic_summary.average_score > 0) {
      return stats.academic_summary.average_score;
    }
    return 0;
  }, [studentRiskRows, hasScoreData, selectedTutorId, stats]);

  const overallCompositeScore = useMemo(() => {
    if (overallAttendanceRate > 0 && overallAvgScore > 0) {
      return Math.round(((overallAttendanceRate * 0.4) + (overallAvgScore * 0.6)) * 10) / 10;
    }
    if (overallAttendanceRate > 0) return overallAttendanceRate;
    if (overallAvgScore > 0) return overallAvgScore;
    return 0;
  }, [overallAttendanceRate, overallAvgScore]);

  const getAverageMood = (value: number, hasData: boolean, thresholdHigh = 81, thresholdMed = 75) => {
    if (!hasData) {
      return {
        icon: Smile,
        iconBg: 'bg-gray-100 border-gray-200 dark:bg-gray-800/80 dark:border-gray-700/70',
        iconColor: 'text-gray-400 dark:text-slate-500',
        valueColor: 'text-gray-400 dark:text-slate-500',
      };
    }
    if (value >= thresholdHigh) return { icon: Smile, iconBg: 'risk-card-low', iconColor: 'text-risk-low', valueColor: 'text-risk-low' };
    if (value >= thresholdMed) return { icon: Meh, iconBg: 'risk-card-medium', iconColor: 'text-risk-medium', valueColor: 'text-risk-medium' };
    return { icon: Frown, iconBg: 'risk-card-high', iconColor: 'text-risk-high', valueColor: 'text-risk-high' };
  };

  const attendanceMood = getAverageMood(overallAttendanceRate, hasAttendanceData, 81, 75);
  const scoreMood = getAverageMood(overallAvgScore, hasScoreData, 81, 70);
  const compositeMood = getAverageMood(overallCompositeScore, hasAttendanceData || hasScoreData, 86, 70);

  // ─── Loading Skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col lg:h-[calc(100vh-8.5rem)] lg:min-h-[30rem] gap-3.5 skeleton-container">
        {/* KPI Cards skeleton - Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 shrink-0 skeleton-row-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 shadow-sm animate-pulse">
              <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0 border border-gray-100 dark:border-gray-800" />
              <div className="flex-1">
                <div className="h-2.5 w-28 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
                <div className="h-6 w-16 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>

        {/* KPI Cards skeleton - Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 shrink-0 skeleton-row-1">
          {[4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 shadow-sm animate-pulse">
              <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0 border border-gray-100 dark:border-gray-800" />
              <div className="flex-1">
                <div className="h-2.5 w-28 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
                <div className="h-6 w-16 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>

        {/* Chart card skeleton */}
        <div className="flex-1 min-h-0 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex flex-col animate-pulse">
          <div className="flex items-center justify-between gap-3 shrink-0 pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="h-4 w-48 sm:w-60 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-8 w-36 sm:w-44 rounded-xl bg-gray-100 dark:bg-gray-800" />
              <div className="h-8 w-24 sm:w-28 rounded-xl bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 gap-3 mt-3.5 sm:mt-4">
            <div className="relative flex-1 min-h-0 w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-2xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 shrink-0">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="bg-gray-50 dark:bg-[#111111] p-2 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] text-center">
                  <div className="h-2.5 w-14 rounded bg-gray-200 dark:bg-gray-800 mx-auto" />
                  <div className="h-5 w-16 rounded bg-gray-200 dark:bg-gray-800 mx-auto mt-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-2xl p-5 shadow-sm">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load admin dashboard</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:h-[calc(100vh-8.5rem)] lg:min-h-[30rem] gap-3.5 data-loaded-content">
      {/* ── Top Containers Row 1: Total Counts (Neutral Black / White Styling) ──────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 shrink-0">
        {/* Card 1: TOTAL CURRENT STUDENTS */}
        <Link
          to="/admin/students"
          className="group flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] dark:border-[#1A1A1A] dark:bg-[#0A0A0A] dark:hover:border-[var(--brand)] dark:hover:shadow-[0_4px_20px_-4px_var(--brand-glow)]"
        >
          <div className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 bg-slate-100 border-slate-200 text-slate-800 dark:bg-slate-800/80 dark:border-slate-700/70 dark:text-slate-100">
            <Users className="w-5 h-5 text-slate-800 dark:text-slate-100" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100 truncate">
              TOTAL CURRENT STUDENTS
            </p>
            <p className="text-2xl font-extrabold mt-0.5 text-gray-900 dark:text-slate-100">
              {totalStudentsCount}
            </p>
          </div>
        </Link>

        {/* Card 2: TOTAL CURRENT TUTORS */}
        <Link
          to="/admin/tutors"
          className="group flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] dark:border-[#1A1A1A] dark:bg-[#0A0A0A] dark:hover:border-[var(--brand)] dark:hover:shadow-[0_4px_20px_-4px_var(--brand-glow)]"
        >
          <div className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 bg-slate-100 border-slate-200 text-slate-800 dark:bg-slate-800/80 dark:border-slate-700/70 dark:text-slate-100">
            <Users className="w-5 h-5 text-slate-800 dark:text-slate-100" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100 truncate">
              TOTAL CURRENT TUTORS
            </p>
            <p className="text-2xl font-extrabold mt-0.5 text-gray-900 dark:text-slate-100">
              {totalTutorsCount}
            </p>
          </div>
        </Link>

        {/* Card 3: TOTAL CURRENT FACULTY MEMBERS */}
        <Link
          to="/admin/faculty"
          className="group flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] dark:border-[#1A1A1A] dark:bg-[#0A0A0A] dark:hover:border-[var(--brand)] dark:hover:shadow-[0_4px_20px_-4px_var(--brand-glow)]"
        >
          <div className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 bg-slate-100 border-slate-200 text-slate-800 dark:bg-slate-800/80 dark:border-slate-700/70 dark:text-slate-100">
            <Users className="w-5 h-5 text-slate-800 dark:text-slate-100" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100 truncate">
              TOTAL CURRENT FACULTY
            </p>
            <p className="text-2xl font-extrabold mt-0.5 text-gray-900 dark:text-slate-100">
              {totalFacultyCount}
            </p>
          </div>
        </Link>

        {/* Card 4: TOTAL CURRENT PRINCIPALS */}
        <Link
          to="/admin/principals"
          className="group flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] dark:border-[#1A1A1A] dark:bg-[#0A0A0A] dark:hover:border-[var(--brand)] dark:hover:shadow-[0_4px_20px_-4px_var(--brand-glow)]"
        >
          <div className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 bg-slate-100 border-slate-200 text-slate-800 dark:bg-slate-800/80 dark:border-slate-700/70 dark:text-slate-100">
            <Briefcase className="w-5 h-5 text-slate-800 dark:text-slate-100" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100 truncate">
              TOTAL CURRENT PRINCIPALS
            </p>
            <p className="text-2xl font-extrabold mt-0.5 text-gray-900 dark:text-slate-100">
              {totalPrincipalsCount}
            </p>
          </div>
        </Link>
      </div>


      {/* ── Top Containers Row 2: Overall Program Averages ────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 shrink-0">
        {/* Card 4: OVERALL ATTENDANCE RATE */}
        <div
          className="group flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md dark:border-[#1A1A1A] dark:bg-[#0A0A0A]"
        >
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${attendanceMood.iconBg}`}>
            <attendanceMood.icon className={`w-5 h-5 ${attendanceMood.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100 truncate" title={tutorFirstName ? `${tutorFirstName}'S CLASS OVERALL ATTENDANCE RATE` : 'OVERALL ATTENDANCE RATE'}>
              {tutorFirstName ? `${tutorFirstName}'S CLASS OVERALL ATTENDANCE RATE` : 'OVERALL ATTENDANCE RATE'}
            </p>
            <p className={`text-2xl font-extrabold mt-0.5 ${attendanceMood.valueColor}`}>
              {!hasAttendanceData ? '—' : `${overallAttendanceRate}%`}
            </p>
          </div>
        </div>

        {/* Card 5: OVERALL AVERAGE SCORE */}
        <div
          className="group flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md dark:border-[#1A1A1A] dark:bg-[#0A0A0A]"
        >
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${scoreMood.iconBg}`}>
            <scoreMood.icon className={`w-5 h-5 ${scoreMood.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100 truncate" title={tutorFirstName ? `${tutorFirstName}'S CLASS OVERALL AVERAGE SCORE` : 'OVERALL AVERAGE SCORE'}>
              {tutorFirstName ? `${tutorFirstName}'S CLASS OVERALL AVERAGE SCORE` : 'OVERALL AVERAGE SCORE'}
            </p>
            <p className={`text-2xl font-extrabold mt-0.5 ${scoreMood.valueColor}`}>
              {!hasScoreData ? '—' : `${overallAvgScore}%`}
            </p>
          </div>
        </div>

        {/* Card 6: OVERALL COMPOSITE SCORE */}
        <div
          className="group flex items-center gap-3.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md dark:border-[#1A1A1A] dark:bg-[#0A0A0A]"
        >
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${compositeMood.iconBg}`}>
            <compositeMood.icon className={`w-5 h-5 ${compositeMood.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100 truncate" title={tutorFirstName ? `${tutorFirstName}'S CLASS OVERALL COMPOSITE SCORE` : 'OVERALL COMPOSITE SCORE'}>
              {tutorFirstName ? `${tutorFirstName}'S CLASS OVERALL COMPOSITE SCORE` : 'OVERALL COMPOSITE SCORE'}
            </p>
            <p className={`text-2xl font-extrabold mt-0.5 ${compositeMood.valueColor}`}>
              {!hasAttendanceData && !hasScoreData ? '—' : `${overallCompositeScore}%`}
            </p>
          </div>
        </div>
      </div>

      {/* ── ARAL Program Performance Trend Chart ──────────────────── */}
      <div className="flex-1 min-h-0 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl shadow-sm px-4 py-4 sm:px-6 sm:py-5 flex flex-col">
        {/* Header Controls (Single Line) */}
        <div className="flex flex-nowrap items-center justify-between gap-3 shrink-0 pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
          <div className="min-w-0 flex-shrink">
            <h3 className="truncate text-xs sm:text-sm md:text-base font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight">
              {selectedTutorObj
                ? `${selectedTutorObj.full_name.toUpperCase()}'S CLASS PERFORMANCE TREND`
                : 'ARAL PROGRAM PERFORMANCE TREND CHART'}
            </h3>
          </div>

          <div className="flex flex-nowrap items-center gap-2 sm:gap-3 shrink-0">
            {/* Legend */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-[var(--brand)] inline-block shadow-xs" />
              <span>Total composite rating</span>
            </div>

            {/* Single Tutor Filter Dropdown */}
            <div className="relative flex items-center shrink-0">
              <select
                aria-label="Filter by Tutor Class"
                value={selectedTutorId}
                onChange={(e) => setSelectedTutorId(e.target.value)}
                style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
                className="h-8 px-3 pr-7 rounded-xl text-xs font-bold bg-gray-50 border border-gray-200 text-gray-800 cursor-pointer outline-none transition focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] dark:bg-[#111111] dark:border-[#222222] dark:text-slate-200 max-w-[190px] sm:max-w-[250px] md:max-w-[340px] truncate"
              >
                <option value="all" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  ALL TUTORS
                </option>
                {tutors.map((tutor) => {
                  const fullName = (tutor.full_name || `${tutor.first_name} ${tutor.last_name}`).trim().toUpperCase();
                  const gradeSection = (tutor as any).gradeSection || `${(tutor as any).grade || 'GRADE 8'} - ${(tutor as any).section || 'MANGO'}`.toUpperCase();
                  const subject = (tutor.subject || 'MATH').toUpperCase();
                  const rawLevel = (tutor.aral_level || 'BASIC').toUpperCase();
                  const levelOnly = rawLevel.replace(/^ARAL\s*/i, '').trim();
                  return (
                    <option
                      key={tutor.id}
                      value={tutor.id}
                      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
                    >
                      {`${fullName} | ${gradeSection} | ${subject} | ${levelOnly}`}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Granularity Filter (Day / Week / Month) */}
            <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-0.5 gap-0.5 shrink-0">
              {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTrendFilter(filter)}
                  className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${trendFilter === filter
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

        {/* Chart Canvas & Metric Cards */}
        <div className="flex-1 flex flex-col min-h-0 gap-3 mt-3.5 sm:mt-4">
          <div className="relative flex-1 min-h-0 w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-2xl px-4 py-2 sm:px-6 sm:py-2.5">
            {chartTrendData.length > 0 ? (
              <InteractiveAdminPerformanceChart data={chartTrendData} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
                <BarChart2 className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                  No student assessment records found for this selection
                </p>
                <p className="text-[11px] text-gray-300 dark:text-slate-600">
                  Data will appear once scores are logged by tutors for their classes
                </p>
              </div>
            )}
          </div>

          {/* Quick Metrics Bar below chart */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
              {/* Highest */}
              <div className="bg-gray-50 dark:bg-[#111111] p-2 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] text-center">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                  Highest
                </p>
                <p
                  className={`text-lg font-extrabold mt-0.5 ${chartTrendData.length === 0
                    ? 'text-gray-400 dark:text-slate-500'
                    : highestScore >= 81
                      ? 'text-risk-low'
                      : highestScore >= 75
                        ? 'text-risk-medium'
                        : 'text-risk-high'
                    }`}
                >
                  {chartTrendData.length === 0 ? '—' : `${highestScore}%`}
                </p>
              </div>

              {/* Lowest */}
              <div className="bg-gray-50 dark:bg-[#111111] p-2 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] text-center">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                  Lowest
                </p>
                <p
                  className={`text-lg font-extrabold mt-0.5 ${chartTrendData.length === 0
                    ? 'text-gray-400 dark:text-slate-500'
                    : lowestScore >= 81
                      ? 'text-risk-low'
                      : lowestScore >= 75
                        ? 'text-risk-medium'
                        : 'text-risk-high'
                    }`}
                >
                  {chartTrendData.length === 0 ? '—' : `${lowestScore}%`}
                </p>
              </div>

              {/* Trend Direction */}
              <div className="bg-gray-50 dark:bg-[#111111] p-2 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] text-center">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                  Trend
                </p>
                <div className="mt-0.5">
                  {chartTrendData.length === 0 ? (
                    <span className="text-lg font-extrabold text-gray-400 dark:text-slate-500">—</span>
                  ) : trendDir === 'up' ? (
                    <span className="text-lg font-extrabold text-risk-low">Improving</span>
                  ) : trendDir === 'down' ? (
                    <span className="text-lg font-extrabold text-risk-high">Declining</span>
                  ) : (
                    <span className="text-lg font-extrabold text-gray-500 dark:text-slate-400">Stable</span>
                  )}
                </div>
              </div>

              {/* Learners in Scope */}
              <div className="bg-gray-50 dark:bg-[#111111] p-2 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] text-center">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                  Learners in Scope
                </p>
                <p className="text-lg font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">
                  {filteredStudents.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
