import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { User, Grade, Attendance } from '../../types';
import { Users, TrendingUp, Award, AlertTriangle, Calendar, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ExportAttendanceModal } from '../../components/ExportAttendanceModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StudentStats {
  student: User;
  attendanceRate: number;
  scoreAvg: number;
  composite: number;
  riskTier: 'High' | 'Medium' | 'Low';
}

interface TrendPoint {
  label: string;
  attendanceRate: number;
  scoreAvg: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStudentStats(
  students: User[],
  grades: Grade[],
  attendance: Attendance[]
): StudentStats[] {
  const safeGrades = Array.isArray(grades) ? grades : [];
  const safeAtt = Array.isArray(attendance) ? attendance : [];

  return students.map((student) => {
    const sid = String(student.id);

    // Attendance rate
    const logs = safeAtt.filter((a) => String(a.user) === sid);
    const present = logs.filter((a) => a.status === 'present' || a.status === 'late').length;
    const attendanceRate = logs.length > 0 ? Math.round((present / logs.length) * 100 * 10) / 10 : 0;

    // Score average
    const gradeEntries = safeGrades.filter((g) => String(g.student) === sid);
    let scoreAvg = 0;
    if (gradeEntries.length > 0) {
      const total = gradeEntries.reduce((sum, g) => {
        const ts = Number(g.total_score) || 100;
        return sum + (Number(g.score) / ts) * 100;
      }, 0);
      scoreAvg = Math.round((total / gradeEntries.length) * 10) / 10;
    }

    // Composite (60% score, 40% attendance)
    const composite = Math.round((scoreAvg * 0.6 + attendanceRate * 0.4) * 10) / 10;

    // Risk tier
    let riskTier: 'High' | 'Medium' | 'Low' = 'Low';
    if (composite < 60 || attendanceRate < 60) riskTier = 'High';
    else if (composite < 75 || attendanceRate < 75) riskTier = 'Medium';

    return { student, attendanceRate, scoreAvg, composite, riskTier };
  });
}

function buildTrend(grades: Grade[], attendance: Attendance[]): TrendPoint[] {
  const safeGrades = Array.isArray(grades) ? grades : [];
  const safeAtt = Array.isArray(attendance) ? attendance : [];

  // Group by date (last 6 unique dates)
  const dateMap = new Map<string, { scoreSum: number; scoreCount: number; attPresent: number; attTotal: number }>();

  for (const g of safeGrades) {
    const d = g.date_logged;
    if (!dateMap.has(d)) dateMap.set(d, { scoreSum: 0, scoreCount: 0, attPresent: 0, attTotal: 0 });
    const entry = dateMap.get(d)!;
    const ts = Number(g.total_score) || 100;
    entry.scoreSum += (Number(g.score) / ts) * 100;
    entry.scoreCount += 1;
  }
  for (const a of safeAtt) {
    const d = a.date;
    if (!dateMap.has(d)) dateMap.set(d, { scoreSum: 0, scoreCount: 0, attPresent: 0, attTotal: 0 });
    const entry = dateMap.get(d)!;
    entry.attTotal += 1;
    if (a.status === 'present' || a.status === 'late') entry.attPresent += 1;
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([date, v]) => ({
      label: new Date(date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      attendanceRate: v.attTotal > 0 ? Math.round((v.attPresent / v.attTotal) * 100 * 10) / 10 : 0,
      scoreAvg: v.scoreCount > 0 ? Math.round((v.scoreSum / v.scoreCount) * 10) / 10 : 0,
    }));
}

// ─── Dual-line SVG Chart ──────────────────────────────────────────────────────

const TrendChart: React.FC<{ data: TrendPoint[] }> = ({ data }) => {
  const W = 600;
  const H = 200;
  const PAD = { top: 16, right: 24, bottom: 28, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allVals = data.flatMap((d) => [d.attendanceRate, d.scoreAvg]);
  const maxVal = Math.max(...allVals, 100);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;
  const px = (i: number) => PAD.left + i * xStep;
  const py = (v: number) => PAD.top + chartH - ((v - minVal) / range) * chartH;

  const line = (pts: [number, number][]) =>
    pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');

  const attPts: [number, number][] = data.map((d, i) => [px(i), py(d.attendanceRate)]);
  const scorePts: [number, number][] = data.map((d, i) => [px(i), py(d.scoreAvg)]);

  const area = (pts: [number, number][]) => {
    if (pts.length === 0) return '';
    const bottom = PAD.top + chartH;
    return (
      `M${pts[0][0]},${bottom} ` +
      pts.map(([x, y]) => `L${x},${y}`).join(' ') +
      ` L${pts[pts.length - 1][0]},${bottom} Z`
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id="att-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="score-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((v) => {
        const y = py(v);
        if (y < PAD.top || y > PAD.top + chartH) return null;
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 4} fontSize="9" fill="#9ca3af" textAnchor="end">{v}</text>
          </g>
        );
      })}

      {/* Areas */}
      {data.length > 1 && (
        <>
          <path d={area(attPts)} fill="url(#att-grad)" />
          <path d={area(scorePts)} fill="url(#score-grad)" />
        </>
      )}

      {/* Lines */}
      {data.length > 1 && (
        <>
          <path d={line(attPts)} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={line(scorePts)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" />
        </>
      )}

      {/* Dots + tooltips */}
      {attPts.map(([x, y], i) => (
        <circle key={`att-${i}`} cx={x} cy={y} r="4" fill="#6366f1" stroke="#fff" strokeWidth="2" />
      ))}
      {scorePts.map(([x, y], i) => (
        <circle key={`score-${i}`} cx={x} cy={y} r="4" fill="#10b981" stroke="#fff" strokeWidth="2" />
      ))}

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
        // Fetch all students assigned to this tutor (no pagination issue — tutor queryset auto-scopes)
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

  const trendData = useMemo(() => buildTrend(grades, attendance), [grades, attendance]);

  const topRisk = useMemo(
    () =>
      [...studentStats]
        .sort((a, b) => {
          const tierOrder = { High: 3, Medium: 2, Low: 1 };
          const diff = tierOrder[b.riskTier] - tierOrder[a.riskTier];
          return diff !== 0 ? diff : a.composite - b.composite;
        })
        .slice(0, 5),
    [studentStats]
  );

  // ── Render helpers ──────────────────────────────────────────────────────────
  const tierColor = (tier: string) => {
    if (tier === 'High') return { badge: 'bg-rose-100 text-rose-700', card: 'border-rose-100 bg-rose-50', dot: 'bg-rose-500' };
    if (tier === 'Medium') return { badge: 'bg-amber-100 text-amber-700', card: 'border-amber-100 bg-amber-50', dot: 'bg-amber-500' };
    return { badge: 'bg-emerald-100 text-emerald-700', card: 'border-emerald-100 bg-emerald-50', dot: 'bg-emerald-500' };
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-gray-100 rounded-2xl" />
        <div className="grid grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-72 bg-gray-100 rounded-2xl" />
          <div className="lg:col-span-2 h-72 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-rose-500" />
        </div>
        <p className="text-base font-semibold text-gray-800">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-[var(--brand)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--brand-dark)] transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Stat Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Total Students */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">My Students</p>
            <p className="text-3xl font-extrabold text-gray-900 mt-0.5">{totalStudents}</p>
            <p className="text-xs text-gray-400 mt-0.5">Currently assigned</p>
          </div>
        </div>

        {/* Average Attendance */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Average Attendance</p>
            <p className={`text-3xl font-extrabold mt-0.5 ${avgAttendance >= 75 ? 'text-emerald-600' : avgAttendance >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
              {attendance.length === 0 ? '—' : `${avgAttendance}%`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Across all students</p>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Average Score</p>
            <p className={`text-3xl font-extrabold mt-0.5 ${avgScore >= 75 ? 'text-emerald-600' : avgScore >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
              {grades.length === 0 ? '—' : `${avgScore}%`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">From {grades.length} grade entries</p>
          </div>
        </div>
      </div>

      {/* ── Chart + Risk Panel ────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Performance Trend Chart */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                PERFORMANCE TREND
              </h3>
              <p className="text-sm text-gray-400 mt-0.5">Combined attendance rate &amp; average score</p>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-indigo-500 inline-block rounded" />
                Attendance
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded border-dashed" style={{ borderTop: '2px dashed #10b981', background: 'none' }} />
                Score
              </span>
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
                <div key={i} className="space-y-0.5">
                  <p className="text-[10px] text-gray-400">{pt.label}</p>
                  <p className="text-xs font-semibold text-indigo-600">{pt.attendanceRate}%</p>
                  <p className="text-xs font-semibold text-emerald-600">{pt.scoreAvg}%</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Risk Students */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                TOP RISK STUDENTS
              </h3>
              <p className="text-sm text-gray-400 mt-0.5">{topRisk.length} Student{topRisk.length !== 1 ? 's' : ''} shown</p>
            </div>
            <Link
              to="/tutor/analytics"
              className="text-xs font-semibold text-[var(--brand)] hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {topRisk.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-gray-400 space-y-2">
              <AlertTriangle className="w-10 h-10 opacity-30" />
              <p className="text-sm font-semibold">No risk data yet</p>
              <p className="text-xs">Log grades and attendance to see student risk rankings.</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {topRisk.map((row, idx) => {
                const colors = tierColor(row.riskTier);
                return (
                  <div
                    key={String(row.student.id)}
                    className={`rounded-xl p-3.5 border ${colors.card} flex items-center gap-3`}
                  >
                    {/* Rank */}
                    <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{row.student.full_name}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                        <span>Att: <strong className="text-gray-700">{row.attendanceRate}%</strong></span>
                        <span>Score: <strong className="text-gray-700">{row.scoreAvg}%</strong></span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${colors.badge}`}>
                      {row.riskTier}
                    </span>
                  </div>
                );
              })}
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
