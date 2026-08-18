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
  TrendingUp,
  AlertTriangle,
  QrCode,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  ChevronRight,
  ShieldAlert,
  BarChart2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface StudentStat extends StudentRiskRow { }

function computeStudentStats(
  students: User[],
  grades: Grade[],
  attendanceLogs: Attendance[]
): StudentStat[] {
  return computeStudentRiskRows(students, grades, attendanceLogs);
}

interface TrendPoint {
  label: string;
  attendanceRate: number;
  scoreAvg: number;
  compositeRating: number;
}

function computeTrendData(grades: Grade[], attendanceLogs: Attendance[]): TrendPoint[] {
  const dateMap = new Map<string, { attPresent: number; attTotal: number; scoreSum: number; scoreCount: number }>();

  attendanceLogs.forEach((a) => {
    const d = a.date;
    if (!d) return;
    const entry = dateMap.get(d) ?? { attPresent: 0, attTotal: 0, scoreSum: 0, scoreCount: 0 };
    entry.attTotal += 1;
    if (a.status === 'present' || a.status === 'late') entry.attPresent += 1;
    dateMap.set(d, entry);
  });

  grades.forEach((g) => {
    const d = g.date_logged;
    if (!d) return;
    const entry = dateMap.get(d) ?? { attPresent: 0, attTotal: 0, scoreSum: 0, scoreCount: 0 };
    const ts = Number(g.total_score || 100);
    const scoreVal = Number(g.score);
    if (ts > 0 && !isNaN(scoreVal)) {
      entry.scoreSum += (scoreVal / ts) * 100;
      entry.scoreCount += 1;
    }
    dateMap.set(d, entry);
  });

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([date, v]) => {
      const attendanceRate = v.attTotal > 0 ? Math.round((v.attPresent / v.attTotal) * 100 * 10) / 10 : 0;
      const scoreAvg = v.scoreCount > 0 ? Math.round((v.scoreSum / v.scoreCount) * 10) / 10 : 0;
      // Composite rating: 60% score + 40% attendance if both exist, or the non-zero metric
      const compositeRating = (attendanceRate > 0 && scoreAvg > 0)
        ? Math.round(((scoreAvg * 0.6) + (attendanceRate * 0.4)) * 10) / 10
        : Math.round((scoreAvg || attendanceRate) * 10) / 10;

      return {
        label: new Date(date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        attendanceRate,
        scoreAvg,
        compositeRating
      };
    });
}

// ─── Single-Line Composite SVG Chart ─────────────────────────────────────────

const TrendChart: React.FC<{ data: TrendPoint[] }> = ({ data }) => {
  const W = 600;
  const H = 200;
  const PAD = { top: 16, right: 24, bottom: 28, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allVals = data.map((d) => d.compositeRating);
  const maxVal = Math.max(...allVals, 100);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;
  const px = (i: number) => PAD.left + i * xStep;
  const py = (v: number) => PAD.top + chartH - ((v - minVal) / range) * chartH;

  const compositePts: [number, number][] = data.map((d, i) => [px(i), py(d.compositeRating)]);

  const linePath = compositePts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');

  const areaPath = () => {
    if (compositePts.length === 0) return '';
    const bottom = PAD.top + chartH;
    return (
      `M${compositePts[0][0]},${bottom} ` +
      compositePts.map(([x, y]) => `L${x},${y}`).join(' ') +
      ` L${compositePts[compositePts.length - 1][0]},${bottom} Z`
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id="composite-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((v) => {
        const y = py(v);
        if (y < PAD.top || y > PAD.top + chartH) return null;
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 4} fontSize="9" fill="#9ca3af" textAnchor="end">{v}%</text>
          </g>
        );
      })}

      {/* Single Composite Area */}
      {data.length > 1 && (
        <path d={areaPath()} fill="url(#composite-grad)" />
      )}

      {/* Single Composite Line */}
      {data.length > 1 && (
        <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Interactive Dots with Tooltips */}
      {compositePts.map(([x, y], i) => {
        const pt = data[i];
        return (
          <g key={`pt-${i}`} className="group cursor-pointer">
            <circle cx={x} cy={y} r="5" fill="#4f46e5" stroke="#ffffff" strokeWidth="2.5" className="transition-all group-hover:r-7" />
            <title>{`${pt.label}: ${pt.compositeRating}% Composite Rating (Score: ${pt.scoreAvg}%, Attendance: ${pt.attendanceRate}%)`}</title>
          </g>
        );
      })}

      {/* X-axis labels */}
      {data.map((d, i) => (
        <text key={i} x={px(i)} y={H - 4} fontSize="9" fill="#6b7280" textAnchor="middle">{d.label}</text>
      ))}
    </svg>
  );
};

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

  const trendData = useMemo(
    () => computeTrendData(grades, attendance),
    [grades, attendance]
  );

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
    <div className="space-y-6">
      {/* Welcome Greeting Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Tutor Portal</p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-gray-900">
            {greeting}, {user?.first_name || user?.full_name || 'Tutor'}!
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            You are managing <span className="font-bold text-gray-800">{totalStudents} assigned learners</span>. Here is your class overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowExportAttendanceModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export Attendance
          </button>
          <Link
            to="/tutor/scores"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--brand-dark)]"
          >
            <Award className="w-4 h-4" />
            Log Scores
          </Link>
        </div>
      </div>

      {/* 4 KPI Stat Cards Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* My Students */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">My Students</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-0.5">{totalStudents}</p>
            <p className="text-xs text-gray-400 mt-0.5">Assigned learners</p>
          </div>
        </div>

        {/* Average Attendance */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Avg Attendance</p>
            <p className={`text-3xl font-extrabold mt-0.5 ${avgAttendance >= 75 ? 'text-emerald-600' : avgAttendance >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
              {attendance.length === 0 ? '—' : `${avgAttendance}%`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Class attendance rate</p>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Avg Assessment</p>
            <p className={`text-3xl font-extrabold mt-0.5 ${avgScore >= 70 ? 'text-emerald-600' : avgScore >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
              {grades.length === 0 ? '—' : `${avgScore}%`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">From {grades.length} grade entries</p>
          </div>
        </div>

        {/* At-Risk Students */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">At-Risk Students</p>
            <p className="text-3xl font-extrabold text-rose-600 mt-0.5">{atRiskStudents.length}</p>
            <p className="text-xs text-rose-400 mt-0.5">Require intervention</p>
          </div>
        </div>
      </div>

      {/* Quick Launchpad Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/tutor/attendance/generate"
          className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-[var(--brand)] transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 group-hover:bg-[var(--brand)] group-hover:text-white transition-colors">
            <QrCode className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 group-hover:text-[var(--brand)] transition-colors">QR Attendance Generator</p>
            <p className="text-xs text-gray-400">Launch student check-in session</p>
          </div>
        </Link>

        <Link
          to="/tutor/scores"
          className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-[var(--brand)] transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <Award className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">Score Entry Portal</p>
            <p className="text-xs text-gray-400">Log daily reading or MOSY/EOSY</p>
          </div>
        </Link>

        <Link
          to="/tutor/analytics"
          className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-[var(--brand)] transition-all flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 shrink-0 group-hover:bg-violet-600 group-hover:text-white transition-colors">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 group-hover:text-violet-600 transition-colors">Data Analytics</p>
            <p className="text-xs text-gray-400">View risk matrix &amp; ARAL levels</p>
          </div>
        </Link>
      </div>

      {/* Chart + Risk Distribution Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Performance Trend Chart */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                COMPOSITE PERFORMANCE TREND
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Combined rating (60% Assessment Score + 40% Attendance)</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
              Composite Rating
            </div>
          </div>

          {trendData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center text-gray-400 space-y-2">
              <TrendingUp className="w-10 h-10 opacity-30" />
              <p className="text-sm font-semibold">No trend data yet</p>
              <p className="text-xs">Trend will appear once grades and attendance are logged.</p>
            </div>
          ) : (
            <div className="h-52 w-full">
              <TrendChart data={trendData} />
            </div>
          )}

          {/* Date summary row */}
          {trendData.length > 0 && (
            <div className="mt-4 grid gap-2 text-center" style={{ gridTemplateColumns: `repeat(${trendData.length}, 1fr)` }}>
              {trendData.map((pt, i) => (
                <div key={i} className="bg-gray-50 p-2 rounded-xl border border-gray-100 space-y-0.5">
                  <p className="text-[10px] text-gray-400 font-medium">{pt.label}</p>
                  <p className="text-xs font-extrabold text-indigo-600">{pt.compositeRating}%</p>
                  <p className="text-[9px] text-gray-400">Score: {pt.scoreAvg}%</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Class Risk Breakdown */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-900">CLASS RISK DISTRIBUTION</h3>

            {/* Risk Tier Bars */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-rose-600 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> High Risk
                  </span>
                  <span className="text-rose-600">{riskCounts.high} student{riskCounts.high !== 1 ? 's' : ''}</span>
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
                  <span className="text-amber-600">{riskCounts.medium} student{riskCounts.medium !== 1 ? 's' : ''}</span>
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
                  <span className="text-emerald-600">{riskCounts.low} student{riskCounts.low !== 1 ? 's' : ''}</span>
                </div>
                <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${totalStudents ? (riskCounts.low / totalStudents) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* At Risk Watch List */}
            {atRiskStudents.length > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs font-bold text-gray-800 uppercase tracking-wider">Top Learners Needing Support</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {atRiskStudents.slice(0, 4).map((s) => (
                    <div key={s.student.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded-xl">
                      <span className="font-semibold text-gray-800 truncate">{s.student.full_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.riskTier === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {s.compositeScore}% ({s.riskTier})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link
            to="/tutor/analytics"
            className="mt-4 w-full py-2.5 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold text-center block transition-all"
          >
            View Full Analytics Report &rarr;
          </Link>
        </div>
      </div>

      <ExportAttendanceModal
        isOpen={showExportAttendanceModal}
        onClose={() => setShowExportAttendanceModal(false)}
        currentUser={user}
        attendanceLogs={attendance}
      />
    </div>
  );
};

export default TutorHome;
