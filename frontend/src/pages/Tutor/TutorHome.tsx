import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { Attendance, Grade, User } from '../../types';
import { ExportAttendanceModal } from '../../components/ExportAttendanceModal';
import {
  Users,
  Calendar,
  Award,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  FileSpreadsheet,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';

interface TutorChartPoint {
  label: string;
  dateRange: string;
  value: number;
  actualCount: number;
}

const InteractiveTutorChart: React.FC<{ data: TutorChartPoint[] }> = ({ data }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 500;
  const height = 150;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 20;

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
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
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
                className="fill-slate-400 dark:fill-slate-500 font-semibold text-[8px]" 
                textAnchor="end"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {points.map((p, idx) => (
          <text
            key={idx}
            x={p.x}
            y={height - 4}
            className="fill-slate-400 dark:fill-slate-500 font-semibold text-[8px]"
            textAnchor="middle"
          >
            {p.label}
          </text>
        ))}

        {/* Line & Area */}
        {points.length > 0 && (
          <>
            <path d={areaD} fill="url(#tutorChartFill)" />
            <path 
              d={pathD} 
              fill="none" 
              stroke="var(--brand)" 
              strokeWidth="2.5" 
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
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
              strokeDasharray="2 2"
              opacity="0.7"
            />
            <circle
              cx={points[hoveredIdx].x}
              cy={points[hoveredIdx].y}
              r="4.5"
              fill="var(--brand)"
            />
            <circle
              cx={points[hoveredIdx].x}
              cy={points[hoveredIdx].y}
              r="8"
              fill="var(--brand)"
              opacity="0.25"
            />
          </g>
        )}

        {/* Hover hit test regions (invisible vertical bars) */}
        {points.map((p, idx) => {
          const barW = chartW / (data.length - 1 || 1);
          const xStart = idx === 0 
            ? paddingLeft 
            : p.x - barW / 2;
          const xEnd = idx === data.length - 1 
            ? width - paddingRight 
            : p.x + barW / 2;
          
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

      {/* Floating Tooltip Div */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div 
          className="absolute z-10 bg-slate-900/95 dark:bg-slate-950/95 text-white p-3 rounded-lg shadow-xl text-left pointer-events-none transition-all duration-100 ease-out border border-slate-700/50 text-[11px] leading-normal font-medium"
          style={{
            left: `${(points[hoveredIdx].x / width) * 100}%`,
            top: `${(points[hoveredIdx].y / height) * 100 - 55}%`,
            transform: 'translateX(-50%)',
            minWidth: '150px',
          }}
        >
          <div className="font-extrabold text-[10px] uppercase text-sky-400">{points[hoveredIdx].label}</div>
          <div className="text-[9px] text-slate-350">{points[hoveredIdx].dateRange}</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-extrabold">{points[hoveredIdx].value}%</span>
            <span className="text-[9px] text-slate-400">Class Average</span>
          </div>
          <div className="text-[9px] text-slate-400 mt-1 italic border-t border-slate-800 pt-1 font-medium">
            {points[hoveredIdx].actualCount > 0 
              ? `${points[hoveredIdx].actualCount} assessments logged`
              : 'No assessments logged'}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface StudentStat extends StudentRiskRow { }

function computeStudentStats(
  students: User[],
  grades: Grade[],
  attendanceLogs: Attendance[]
): StudentStat[] {
  return computeStudentRiskRows(students, grades, attendanceLogs);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const TutorHome: React.FC = () => {
  const { user } = useAuth();

  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportAttendanceModal, setShowExportAttendanceModal] = useState(false);

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

  // ── Computed stats ──────────────────────────────────────────────────────────
  const studentStats = useMemo(
    () => computeStudentStats(students, grades, attendance),
    [students, grades, attendance]
  );

  const totalStudents = students.length;

  const avgAttendance = useMemo(() => {
    if (studentStats.length === 0) return 0;
    const sum = studentStats.reduce((acc, s) => acc + s.attendanceRate, 0);
    return Math.round((sum / studentStats.length) * 10) / 10;
  }, [studentStats]);

  const avgScore = useMemo(() => {
    const withScores = studentStats.filter((s) => s.scoreAvg > 0);
    if (withScores.length === 0) return 0;
    const sum = withScores.reduce((acc, s) => acc + s.scoreAvg, 0);
    return Math.round((sum / withScores.length) * 10) / 10;
  }, [studentStats]);

  const atRiskStudents = useMemo(
    () => studentStats.filter((s) => s.riskTier === 'High' || s.riskTier === 'Medium'),
    [studentStats]
  );

  const riskCounts = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    studentStats.forEach((s) => {
      if (s.riskTier === 'High') counts.high += 1;
      else if (s.riskTier === 'Medium') counts.medium += 1;
      else counts.low += 1;
    });
    return counts;
  }, [studentStats]);

  // ── Tutor Performance Trend calculations ──
  const last4WeeksData = useMemo(() => {
    if (students.length === 0 || grades.length === 0) return [];

    const studentIds = new Set(students.map((s) => String(s.id)));
    const assessmentGrades = grades.filter(
      (g) => studentIds.has(String(g.student)) && g.component_type === 'assessment'
    );

    if (assessmentGrades.length === 0) return [];

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    const periods = Array.from({ length: 4 }).map((_, idx) => {
      const endDaysAgo = idx * 7;
      const startDaysAgo = (idx + 1) * 7;
      const start = new Date(now.getTime() - startDaysAgo * oneDay);
      const end = new Date(now.getTime() - endDaysAgo * oneDay);
      
      const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      return {
        label: `Week ${4 - idx}`,
        dateRange: `${startStr} - ${endStr}`,
        start,
        end,
        scores: [] as number[],
      };
    }).reverse();

    assessmentGrades.forEach((g) => {
      const gDate = new Date(g.date_logged);
      if (isNaN(gDate.getTime())) return;

      for (const p of periods) {
        if (gDate >= p.start && gDate < p.end) {
          const scorePercent = g.total_score > 0 ? (g.score / g.total_score) * 100 : g.score;
          p.scores.push(scorePercent);
          break;
        }
      }
    });

    const points = periods.map((p) => {
      const avg = p.scores.length > 0
        ? Math.round(p.scores.reduce((a, b) => a + b, 0) / p.scores.length)
        : null;
      return {
        label: p.label,
        dateRange: p.dateRange,
        value: avg,
        count: p.scores.length,
      };
    });

    if (points.every((p) => p.value === null)) {
      return [];
    }

    let lastValid = 70;
    return points.map((p) => {
      if (p.value !== null) {
        lastValid = p.value;
      }
      return {
        label: p.label,
        dateRange: p.dateRange,
        value: p.value !== null ? p.value : lastValid,
        actualCount: p.count,
      };
    });
  }, [students, grades]);

  const avgScoreThisMonth = useMemo(() => {
    if (last4WeeksData.length === 0) return 0;
    const sum = last4WeeksData.reduce((acc, d) => acc + d.value, 0);
    return Math.round(sum / last4WeeksData.length);
  }, [last4WeeksData]);

  const highestScore = useMemo(() => {
    if (last4WeeksData.length === 0) return 0;
    return Math.max(...last4WeeksData.map((d) => d.value));
  }, [last4WeeksData]);

  const lowestScore = useMemo(() => {
    if (last4WeeksData.length === 0) return 0;
    return Math.min(...last4WeeksData.map((d) => d.value));
  }, [last4WeeksData]);

  const tutorTrendDir = useMemo(() => {
    if (last4WeeksData.length < 2) return 'stable';
    const first = last4WeeksData[0].value;
    const last = last4WeeksData[last4WeeksData.length - 1].value;
    if (last > first) return 'up';
    if (last < first) return 'down';
    return 'stable';
  }, [last4WeeksData]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-gray-400 space-y-3">
        <div className="w-10 h-10 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-gray-600">Loading Tutor Dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-6 text-center shadow-sm space-y-3">
        <p className="text-sm font-bold">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Welcome Header — compact with export action in toolbar area */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Tutor Portal</p>
          <h1 className="mt-0.5 text-xl font-extrabold text-gray-900">
            {greeting}, {user?.first_name || user?.full_name || 'Tutor'}!
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Managing <span className="font-bold text-gray-800">{totalStudents} assigned learners</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowExportAttendanceModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Export Attendance
        </button>
      </div>

      {/* 4 KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* My Students */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">My Students</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{totalStudents}</p>
            <p className="text-xs text-gray-400 mt-0.5">Assigned learners</p>
          </div>
        </div>

        {/* Average Attendance */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Avg Attendance</p>
            <p className={`text-2xl font-extrabold mt-0.5 ${avgAttendance >= 75 ? 'text-emerald-600' : avgAttendance >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
              {attendance.length === 0 ? '—' : `${avgAttendance}%`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Class attendance rate</p>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Avg Assessment</p>
            <p className={`text-2xl font-extrabold mt-0.5 ${avgScore >= 70 ? 'text-emerald-600' : avgScore >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
              {grades.length === 0 ? '—' : `${avgScore}%`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">From {grades.length} entries</p>
          </div>
        </div>

        {/* At-Risk Students */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">At-Risk</p>
            <p className="text-2xl font-extrabold text-rose-600 mt-0.5">{atRiskStudents.length}</p>
            <p className="text-xs text-rose-400 mt-0.5">Need intervention</p>
          </div>
        </div>
      </div>

      {/* ── Tutor Performance Trend Section ── */}
      <div 
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-wider">Student Performance Overview</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Last 4 weeks assessment performance trend</p>
          </div>
          {last4WeeksData.length > 0 && (
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-gray-650 dark:text-slate-350">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--brand)' }} />
                <span>Class Average</span>
              </div>
            </div>
          )}
        </div>

        {last4WeeksData.length === 0 ? (
          <div className="h-44 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-4">
            <TrendingUp className="w-8 h-8 text-gray-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No performance data yet</p>
            <p className="text-xs text-gray-405 dark:text-slate-500 mt-0.5">Assessments logged for your students will display here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative h-44 w-full bg-slate-50/50 dark:bg-slate-950/20 border border-gray-150 dark:border-slate-800/60 rounded-xl p-4">
              <InteractiveTutorChart data={last4WeeksData} />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-gray-100 dark:border-slate-850">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 max-w-3xl">
                <div className="bg-gray-50 dark:bg-slate-850 p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 text-center">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Avg Score</p>
                  <p className="text-lg font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">{avgScoreThisMonth}%</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-850 p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 text-center">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Highest</p>
                  <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-450 mt-0.5">{highestScore}%</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-850 p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 text-center">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Lowest</p>
                  <p className="text-lg font-extrabold text-rose-600 dark:text-rose-450 mt-0.5">{lowestScore}%</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-850 p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 text-center flex flex-col justify-center items-center">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Trend</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {tutorTrendDir === 'up' ? (
                      <span className="text-xs font-extrabold text-emerald-650 dark:text-emerald-400 flex items-center gap-0.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Improving</span>
                    ) : tutorTrendDir === 'down' ? (
                      <span className="text-xs font-extrabold text-rose-650 dark:text-rose-450 flex items-center gap-0.5"><TrendingDown className="w-3.5 h-3.5 text-rose-500" /> Declining</span>
                    ) : (
                      <span className="text-xs font-extrabold text-gray-550 dark:text-slate-400 flex items-center gap-0.5"><Activity className="w-3.5 h-3.5 text-gray-400" /> Stable</span>
                    )}
                  </div>
                </div>
              </div>

              <Link
                to="/tutor/analytics"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] px-5 py-3 text-xs font-bold shadow-sm transition shrink-0"
              >
                <span>View Detailed Report</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Risk Distribution + Students Needing Attention — side by side */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Class Risk Distribution */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Class Risk Distribution</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-rose-600 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> High Risk
                </span>
                <span className="text-rose-600">{riskCounts.high}</span>
              </div>
              <div className="w-full h-2 bg-rose-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalStudents ? (riskCounts.high / totalStudents) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Medium Risk
                </span>
                <span className="text-amber-600">{riskCounts.medium}</span>
              </div>
              <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalStudents ? (riskCounts.medium / totalStudents) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Low Risk
                </span>
                <span className="text-emerald-600">{riskCounts.low}</span>
              </div>
              <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalStudents ? (riskCounts.low / totalStudents) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Students Needing Attention */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Students Needing Attention</h3>
            {atRiskStudents.length > 5 && (
              <Link
                to="/tutor/analytics"
                className="text-xs font-semibold text-[var(--brand)] hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {atRiskStudents.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center py-6 text-gray-400">
              <div>
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold">All students are on track</p>
                <p className="text-xs mt-0.5">No high or medium risk students at this time.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-44">
              {atRiskStudents.slice(0, 5).map((s) => (
                <Link
                  key={s.student.id}
                  to={`/tutor/students/${s.student.id}`}
                  className="flex items-center justify-between text-xs bg-gray-50 hover:bg-gray-100 p-3 rounded-xl transition-colors group"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-gray-800 truncate block">{s.student.full_name}</span>
                    <span className="text-gray-400 text-[10px]">
                      Attendance: {Math.round(s.attendanceRate)}% · Score: {Math.round(s.scoreAvg)}%
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                      s.riskTier === 'High'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {s.riskTier}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <ExportAttendanceModal
        isOpen={showExportAttendanceModal}
        onClose={() => setShowExportAttendanceModal(false)}
        currentUser={user}
        students={students}
        attendanceLogs={attendance}
      />
    </div>
  );
};

export default TutorHome;
