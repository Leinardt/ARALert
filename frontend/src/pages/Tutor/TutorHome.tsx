import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { Attendance, Grade, User } from '../../types';
import {
  CheckCircle,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Users,
  Smile,
  Meh,
  Frown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';
import dashboardDarkActive from '../../assets/icons/dashboard_dark_active.png';
import clockDark from '../../assets/icons/dtrlog_dark.png';
import clockLight from '../../assets/icons/dtrlog_light.png';

interface TutorChartPoint {
  label: string;
  dateRange: string;
  value: number;
  actualCount: number;
  assessmentLabels: string[];
}

const InteractiveTutorChart: React.FC<{ data: TutorChartPoint[] }> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 800;
  const height = 160;
  const paddingLeft = 22;
  const paddingRight = 6;
  const paddingTop = 15;
  const paddingBottom = 28;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

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
    <div className="relative w-full h-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="tutorChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0.01" />
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
              <text x={paddingLeft - 6} y={y + 3} className="fill-slate-400 font-semibold text-[8px]" textAnchor="end">{val}%</text>
            </g>
          );
        })}

        {/* Milestone guide lines (Lighter Green) */}
        {points.map((p, idx) => {
          if (p.assessmentLabels.length === 0) return null;

          return (
            <g key={`milestone-${idx}`}>
              <title>{p.assessmentLabels.join(', ')}</title>
              {/* Subtle vertical reference line in lighter green */}
              <line
                x1={p.x}
                y1={paddingTop}
                x2={p.x}
                y2={height - paddingBottom}
                stroke="#54D947"
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
            y={height - 4}
            className="fill-slate-500 font-semibold text-[8px]"
            textAnchor="middle"
            style={{ whiteSpace: 'nowrap' }}
          >
            {p.label}
          </text>
        ))}

        {/* Medium-Green Trend Line & Area */}
        {points.length > 0 && (
          <>
            <path d={areaD} fill="url(#tutorChartFill)" />
            <path d={pathD} fill="none" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" filter="url(#tutorChartGlow)" />
            <path d={pathD} fill="none" stroke="#16A34A" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {/* Data point markers */}
        {points.map((p, idx) => (
          <circle key={`data-dot-${idx}`} cx={p.x} cy={p.y} r="3.5" fill="#16A34A" stroke="#DCFCE7" strokeWidth="1.5" />
        ))}

        {/* BOSY/MOSY/EOSY milestone dots (Lighter Green than line) */}
        {points.map((p, idx) => (
          p.assessmentLabels.length > 0 && (
            <g key={`milestone-dot-${idx}`}>
              <circle cx={p.x} cy={p.y} r="8.5" fill="#54D947" opacity="0.45" filter="url(#tutorChartGlow)" />
              <circle cx={p.x} cy={p.y} r="4.5" fill="#54D947" stroke="#DCFCE7" strokeWidth="2" />
            </g>
          )
        ))}

        {/* Vertical line and dots on hover */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line x1={points[hoveredIdx].x} y1={paddingTop} x2={points[hoveredIdx].x} y2={paddingTop + chartH} stroke="#16A34A" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.7" />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="4.5" fill="#16A34A" />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="8" fill="#16A34A" opacity="0.25" />
          </g>
        )}

        {/* Hover hit test regions */}
        {points.map((p, idx) => {
          const barW = chartW / (data.length - 1 || 1);
          const xStart = idx === 0 ? paddingLeft : p.x - barW / 2;
          const xEnd = idx === data.length - 1 ? width - paddingRight : p.x + barW / 2;
          return (
            <rect key={idx} x={xStart} y={paddingTop} width={xEnd - xStart} height={chartH} fill="transparent" className="cursor-pointer" onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)} />
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className={`absolute z-10 min-w-[160px] bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-left pointer-events-none border border-slate-700/50 text-[11px] leading-normal font-medium ${hoveredIdx === 0 ? 'left-2' : hoveredIdx === points.length - 1 ? 'right-2' : '-translate-x-1/2'}`}
          style={{ left: hoveredIdx === 0 || hoveredIdx === points.length - 1 ? undefined : `${(points[hoveredIdx].x / width) * 100}%`, top: `${Math.max(2, (points[hoveredIdx].y / height) * 100 - 55)}%` }}
        >
          <div className="font-extrabold text-[10px] uppercase text-[#16A34A]">{points[hoveredIdx].label}</div>
          <div className="whitespace-nowrap text-[9px] text-slate-300">{points[hoveredIdx].dateRange}</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-extrabold text-[#16A34A]">{points[hoveredIdx].value}%</span>
            <span className="text-[9px] text-slate-400">Class Average</span>
          </div>
          {points[hoveredIdx].assessmentLabels.length > 0 && (
            <div className="mt-1.5 bg-[#54D947]/20 border border-[#54D947]/40 text-[#54D947] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-[0_0_8px_rgba(84,217,71,0.25)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#54D947] shadow-[0_0_6px_rgba(84,217,71,0.8)] inline-block" />
              <span className="uppercase tracking-wider">{points[hoveredIdx].assessmentLabels.join(', ')}</span>
            </div>
          )}
          <div className="text-[9px] text-slate-400 mt-1 border-t border-slate-800 pt-1">
            {points[hoveredIdx].actualCount > 0 ? `${points[hoveredIdx].actualCount} scores logged` : 'No scores logged'}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Types & Helpers ────────────────────────────────────────────────────────────
interface StudentStat extends StudentRiskRow { }
type TrendFilter = 'day' | 'week' | 'month';

function computeStudentStats(students: User[], grades: Grade[], attendanceLogs: Attendance[]): StudentStat[] {
  return computeStudentRiskRows(students, grades, attendanceLogs);
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name: string) => {
  const p = name.trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

// ─── Main Component ─────────────────────────────────────────────────────────────
export const TutorHome: React.FC = () => {
  const { user } = useAuth();

  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('week');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [studentRes, gradesRes, attRes] = await Promise.all([
          userService.getUsers({ role: 'student' }),
          academicService.getGrades(),
          academicService.getAttendanceHistory(),
        ]);
        setStudents(Array.isArray(studentRes.results) ? studentRes.results : Array.isArray(studentRes as any) ? (studentRes as any) : []);
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

  const studentStats = useMemo(() => computeStudentStats(students, grades, attendance), [students, grades, attendance]);
  const totalStudents = students.length;

  const avgAttendance = useMemo(() => {
    if (studentStats.length === 0) return 0;
    return Math.round((studentStats.reduce((acc, s) => acc + s.attendanceRate, 0) / studentStats.length) * 10) / 10;
  }, [studentStats]);

  const avgScore = useMemo(() => {
    const withScores = studentStats.filter((s) => s.scoreAvg > 0);
    if (withScores.length === 0) return 0;
    return Math.round((withScores.reduce((acc, s) => acc + s.scoreAvg, 0) / withScores.length) * 10) / 10;
  }, [studentStats]);

  const getAverageMood = (value: number, hasData: boolean) => {
    if (!hasData) return { icon: Meh, iconBg: 'bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-800/60', iconColor: 'text-amber-500' };
    if (value >= 81) return { icon: Smile, iconBg: 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800/60', iconColor: 'text-emerald-500' };
    if (value >= 75) return { icon: Meh, iconBg: 'bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-800/60', iconColor: 'text-amber-500' };
    return { icon: Frown, iconBg: 'bg-rose-50 border-rose-100 dark:bg-rose-950/40 dark:border-rose-800/60', iconColor: 'text-rose-500' };
  };

  const hasScoreData = grades.some((grade) => grade.remarks?.trim().toLowerCase() !== 'not taken');
  const attendanceMood = getAverageMood(avgAttendance, attendance.length > 0);
  const scoreMood = getAverageMood(avgScore, hasScoreData);

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

  const tutorMilestone = useMemo(() => {
    const level = (user?.aral_level || 'basic').toLowerCase();
    if (level === 'plus') return 'EOSY';
    if (level === 'summer') return 'BOSY';
    return 'MOSY'; // for basic
  }, [user?.aral_level]);

  const last4WeeksData = useMemo(() => {
    if (students.length === 0 || grades.length === 0) return [];
    const studentIds = new Set(students.map((s) => String(s.id)));
    const assessmentGrades = grades.filter((g) => studentIds.has(String(g.student)) && g.component_type === 'assessment');
    if (assessmentGrades.length === 0) return [];

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const periodCount = trendFilter === 'day' ? 7 : 6;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const formatMonth = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

    const periods = Array.from({ length: periodCount }).map((_, index) => {
      let start: Date, end: Date, label: string;
      if (trendFilter === 'month') {
        const offset = periodCount - 1 - index;
        start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
        label = formatMonth(start);
      } else {
        const periodLength = trendFilter === 'day' ? 1 : 7;
        const periodOffset = periodCount - 1 - index;
        const daysAgo = trendFilter === 'day' ? periodOffset : periodOffset * 7 + 6;
        start = new Date(startOfToday.getTime() - daysAgo * oneDay);
        end = new Date(start.getTime() + periodLength * oneDay);
        label = trendFilter === 'day'
          ? formatDate(start)
          : `${formatDate(start)} - ${formatDate(new Date(end.getTime() - oneDay))}`;
      }
      return {
        label,
        dateRange: trendFilter === 'day'
          ? formatDate(start)
          : `${formatDate(start)} - ${formatDate(new Date(end.getTime() - oneDay))}`,
        start,
        end,
        scores: [] as number[],
        assessmentLabels: new Set<string>(),
      };
    });

    assessmentGrades.forEach((g) => {
      const gDate = new Date(g.date_logged);
      if (isNaN(gDate.getTime())) return;
      for (const p of periods) {
        if (gDate >= p.start && gDate < p.end) {
          const scorePercent = g.total_score > 0 ? (g.score / g.total_score) * 100 : g.score;
          p.scores.push(scorePercent);
          const assessmentText = `${g.subject} ${g.remarks ?? ''}`.toUpperCase();
          if (assessmentText.includes(tutorMilestone)) {
            p.assessmentLabels.add(tutorMilestone);
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
      return { label: p.label, dateRange: p.dateRange, value: p.value !== null ? p.value : lastValid, actualCount: p.count, assessmentLabels: p.assessmentLabels };
    });
  }, [students, grades, trendFilter]);

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
      <div className="space-y-5">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#0A0A0A] rounded-3xl border border-gray-200 dark:border-[#1A1A1A] shadow-sm p-5 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-gray-700 shrink-0" />
            <div className="space-y-2">
              <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-48 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
          <div className="h-10 w-36 rounded-2xl bg-gray-200 dark:bg-gray-700" />
        </div>
        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 shadow-sm animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 shrink-0" />
                <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-2.5 w-28 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
        {/* Content rows skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] shadow-sm p-6 animate-pulse space-y-4">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-gray-700 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2.5 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-2xl p-5 shadow-sm">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load dashboard</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#0A0A0A] rounded-3xl border border-gray-200 dark:border-[#1A1A1A] shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand)] flex items-center justify-center shadow-md shrink-0">
            <img src={dashboardDarkActive} alt="" className="h-6 w-6 object-contain" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Tutor Portal</p>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">
              {greeting}, {user?.first_name || user?.full_name || 'Tutor'}!
            </h1>
          </div>
        </div>
        <Link
          to="/staff/scan"
          className="group relative flex items-center justify-between gap-3.5 rounded-2xl border border-[var(--brand-border)]/50 bg-[var(--brand-light)]/40 hover:bg-[var(--brand-light)]/70 hover:border-[var(--brand-border)] px-4.5 py-2.5 shadow-xs transition-all duration-200 hover:shadow-sm dark:hover:shadow-[0_2px_14px_-2px_var(--brand-glow)] shrink-0"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center shrink-0">
              <img src={clockLight} alt="" className="h-5.5 w-5.5 object-contain dark:hidden" />
              <img src={clockDark} alt="" className="hidden h-5.5 w-5.5 object-contain dark:block" />
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100 group-hover:text-[var(--brand-dark)] dark:group-hover:text-[var(--brand)] transition-colors">
              DTR Log
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-900 transition-all duration-200 group-hover:text-black group-hover:translate-x-0.5 shrink-0" />
        </Link>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'My Students',
            to: '/tutor/students',
            value: totalStudents,
            suffix: '',
            sub: 'Assigned students',
            iconBg: 'bg-slate-100 border-slate-200 dark:bg-slate-800/80 dark:border-slate-700/70',
            icon: Users,
            iconColor: 'text-slate-800 dark:text-slate-100',
            valueColor: 'text-gray-900 dark:text-slate-100',
          },
          {
            label: 'Average Attendance',
            to: '/tutor/analytics?tab=attendance',
            value: attendance.length === 0 ? '—' : `${avgAttendance}%`,
            suffix: '',
            sub: 'Students average attendance',
            icon: attendanceMood.icon,
            iconBg: attendanceMood.iconBg,
            iconColor: attendanceMood.iconColor,
            valueColor: attendance.length === 0 ? 'text-amber-500' : avgAttendance >= 81 ? 'text-emerald-600' : avgAttendance >= 75 ? 'text-amber-500' : 'text-rose-500',
          },
          {
            label: 'Average Scores',
            to: '/tutor/analytics?tab=score',
            value: grades.length === 0 ? '—' : `${avgScore}%`,
            suffix: '',
            sub: `Students average score`,
            icon: scoreMood.icon,
            iconBg: scoreMood.iconBg,
            iconColor: scoreMood.iconColor,
            valueColor: !hasScoreData ? 'text-amber-500' : avgScore >= 81 ? 'text-emerald-600' : avgScore >= 75 ? 'text-amber-500' : 'text-rose-500',
          },
          {
            label: 'High Risk Students',
            to: '/tutor/analytics',
            value: highRiskStudents.length,
            suffix: '',
            sub: 'Students needing intervention',
            icon: ShieldAlert,
            iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-100 dark:border-rose-900',
            iconColor: 'text-rose-500',
            valueColor: 'text-rose-600',
          },
        ].map((card) => {
          const Icon = card.icon;
          const iconImage = 'iconImage' in card ? card.iconImage as string | undefined : undefined;
          const iconImageLight = 'iconImageLight' in card ? card.iconImageLight as string | undefined : undefined;
          return (
            <Link
              key={card.label}
              to={card.to}
              className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] dark:border-[#1A1A1A] dark:bg-[#0A0A0A] dark:hover:border-[var(--brand)] dark:hover:shadow-[0_4px_20px_-4px_rgba(7,187,71,0.25)]"
            >
              <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${card.iconBg}`}>
                {iconImage ? (
                  iconImageLight ? (
                    <>
                      <img src={iconImageLight} alt="" className="w-5 h-5 object-contain dark:hidden" />
                      <img src={iconImage} alt="" className="hidden w-5 h-5 object-contain dark:block" />
                    </>
                  ) : (
                    <img src={iconImage} alt="" className="w-5 h-5 object-contain" />
                  )
                ) : Icon ? (
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                ) : null}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-900 dark:text-slate-100">{card.label}</p>
                <p className={`text-2xl font-extrabold mt-0.5 ${card.valueColor}`}>{card.value}</p>
                <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">{card.sub}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Performance Trend + Risk ───────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-4 items-start">

        {/* Chart */}
        <div className="lg:col-span-3 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl shadow-sm px-4 py-6 sm:px-5 space-y-6 h-[28rem]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="whitespace-nowrap text-sm font-bold text-gray-900 dark:text-slate-100 mt-0.5">STUDENTS PERFORMANCE TREND CHART</h3>
              <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">
                {trendFilter === 'day' ? 'Daily' : trendFilter === 'month' ? 'Monthly' : 'Weekly'} performance trend
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {last4WeeksData.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A] inline-block shadow-xs" />
                  <span>Class Attendance + Score Average</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-full bg-[#54D947] inline-block ring-2 ring-[#54D947]/30 shadow-xs" />
                <span>{tutorMilestone}</span>
              </div>
              <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-0.5 gap-0.5 sm:ml-1">
                {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTrendFilter(filter)}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${trendFilter === filter ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {last4WeeksData.length === 0 ? (
            <div className="h-44 border border-dashed border-gray-200 dark:border-[#2A2A2A] rounded-2xl flex flex-col items-center justify-center text-center p-4 gap-2">
              <TrendingUp className="w-8 h-8 text-gray-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-300">No performance data yet</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Assessments logged for your students will display here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative h-56 sm:h-62 w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-2xl px-4 py-1.5 sm:px-6 sm:py-2.5">
                <InteractiveTutorChart data={last4WeeksData} />
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                  {[
                    { label: 'Highest', value: `${highestScore}%`, color: 'text-emerald-600' },
                    { label: 'Lowest', value: `${lowestScore}%`, color: 'text-rose-600' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-gray-50 dark:bg-[#111111] p-2 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] text-center">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{stat.label}</p>
                      <p className={`text-lg font-extrabold mt-0.5 ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                  <div className="bg-gray-50 dark:bg-[#111111] p-2 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] text-center">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Trend</p>
                    <div className="mt-0.5">
                      {tutorTrendDir === 'up' ? (
                        <span className="text-lg font-extrabold text-emerald-600">Improving</span>
                      ) : tutorTrendDir === 'down' ? (
                        <span className="text-lg font-extrabold text-rose-600">Declining</span>
                      ) : (
                        <span className="text-lg font-extrabold text-gray-500 dark:text-slate-400">Stable</span>
                      )}
                    </div>
                  </div>
                  <Link
                    to="/tutor/analytics"
                    className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-light)]/70 px-4 py-2.5 text-sm font-bold text-[var(--brand-dark)] transition hover:border-[var(--brand)] hover:bg-[var(--brand-light)]"
                  >
                    <span className="text-sm font-bold">See More</span>
                    <span className="text-sm font-bold" aria-hidden="true">&gt;</span>
                  </Link>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* At-Risk panel */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-3xl shadow-sm overflow-hidden h-[28rem] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mt-0.5 flex items-center gap-2">
                  TOP STUDENTS AT-RISK
                </h3>
                <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">
                  High and medium risk students
                </p>
              </div>
              <div>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 text-[10px] font-extrabold text-gray-700 dark:text-slate-300">
                  {atRiskStudents.length}
                </span>
              </div>
            </div>

            <div className="p-3 space-y-2 flex-1 min-h-0 overflow-y-auto">
              {atRiskStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-8 px-4 gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">All students on track</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">No high or medium risk students.</p>
                </div>
              ) : (
                atRiskStudents.slice(0, 15).map((s) => (
                  <Link
                    key={s.student.id}
                    to={`/tutor/students/${s.student.id}`}
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition-colors group ${s.riskTier === 'High'
                        ? 'border-rose-100 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100/70 dark:hover:bg-rose-950/70'
                        : 'border-amber-100 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-950/70'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(s.student.full_name || '')}`}>
                        {getInitials(s.student.full_name || '?')}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-gray-800 dark:text-slate-200 truncate block">{s.student.full_name}</span>
                        <span className="text-gray-400 dark:text-slate-500 text-[10px] block">Att: {s.attendanceRate.toFixed(2)}% · Score: {s.scoreAvg.toFixed(2)}%</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border ${s.riskTier === 'High' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      }`}>
                      {s.riskTier.toUpperCase()}
                    </span>
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
