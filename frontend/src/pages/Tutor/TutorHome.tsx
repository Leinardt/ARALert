import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';
import { buildPerformanceTrend, type PerformanceTrendPoint } from '../../utils/performanceTrendHelpers';
import type { User, AralActivity, Grade, Attendance } from '../../types';
import {
  Users,
  Calendar,
  Maximize2
} from 'lucide-react';
import { Link } from 'react-router-dom';

const riskPriority = (tier: string) => {
  if (tier === 'High') return 2;
  if (tier === 'Medium') return 1;
  return 0;
};

const calculateAverages = (
  students: User[],
  grades: Grade[],
  attendanceLogs: Attendance[]
) => {
  const studentIds = new Set(students.map((student) => String(student.id)));

  const scoreTotals = grades
    .filter((grade) => studentIds.has(String(grade.student)))
    .reduce((acc, grade) => {
      const studentId = String(grade.student);
      const existing = acc.get(studentId) ?? { totalPercent: 0, count: 0 };
      const scoreValue = Number(grade.score);
      const totalValue = Number(grade.total_score || 100);
      const percent = totalValue > 0 ? (scoreValue / totalValue) * 100 : 0;
      existing.totalPercent += percent;
      existing.count += 1;
      acc.set(studentId, existing);
      return acc;
    }, new Map<string, { totalPercent: number; count: number }>());

  const attendanceByStudent = attendanceLogs.reduce((acc, attendance) => {
    const userId = String(attendance.user);
    if (!studentIds.has(userId)) return acc;
    const list = acc.get(userId) ?? [];
    list.push(attendance);
    acc.set(userId, list);
    return acc;
  }, new Map<string, Attendance[]>());

  let attendanceSum = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  students.forEach((student) => {
    const attendanceRecords = attendanceByStudent.get(String(student.id)) ?? [];
    let attendanceRate = 100;

    if (attendanceRecords.length > 0) {
      const totalDays = attendanceRecords.length;
      const presentDays = attendanceRecords.filter((record) => record.status === 'present').length;
      const lateDays = attendanceRecords.filter((record) => record.status === 'late').length;
      attendanceRate = Number(((presentDays + lateDays) / totalDays * 100).toFixed(1));
    }

    attendanceSum += attendanceRate;

    const scoreData = scoreTotals.get(String(student.id));
    if (scoreData?.count) {
      scoreSum += Number((scoreData.totalPercent / scoreData.count).toFixed(1));
      scoreCount += 1;
    }
  });

  return {
    averageAttendance: students.length > 0 ? Number((attendanceSum / students.length).toFixed(1)) : 0,
    averageScoreAvg: scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(1)) : 0,
  };
};

export const TutorHome: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [activities, setActivities] = useState<AralActivity[]>([]);
  const [topRiskStudents, setTopRiskStudents] = useState<StudentRiskRow[]>([]);
  const [averageAttendance, setAverageAttendance] = useState(0);
  const [averageScoreAvg, setAverageScoreAvg] = useState(0);
  const [performanceTrend, setPerformanceTrend] = useState<PerformanceTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual attendance modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent] = useState<User | null>(null);
  const [attendanceForm, setAttendanceForm] = useState({
    date: new Date().toLocaleDateString('en-CA'),
    status: 'present' as 'present' | 'late' | 'absent',
    aral_activity_id: ''
  });

  const fetchData = async () => {
    try {
      if (!user) return;

      const [studentRes, grades, attendanceLogs, activitiesRes] = await Promise.all([
        userService.getUsers({ role: 'student', assigned_tutor: user.id }),
        academicService.getGrades(),
        academicService.getAttendanceHistory(),
        academicService.getAralActivities({ status: 'in_progress' })
      ]);

      const students = studentRes.results;
      setStudents(students);
      setActivities(activitiesRes);

      const averages = calculateAverages(students, grades, attendanceLogs);
      setAverageAttendance(averages.averageAttendance);
      setAverageScoreAvg(averages.averageScoreAvg);
      setPerformanceTrend(buildPerformanceTrend(students.map((student) => student.id), grades, attendanceLogs));

      const riskRows = computeStudentRiskRows(students, grades, attendanceLogs);
      const sortedRiskRows = riskRows.sort((a, b) => {
        const priorityDiff = riskPriority(b.riskTier) - riskPriority(a.riskTier);
        if (priorityDiff !== 0) return priorityDiff;
        return a.compositeScore - b.compositeScore;
      });

      setTopRiskStudents(sortedRiskRows.slice(0, 3));
    } catch (err) {
      console.error(err);
      setError('Failed to fetch tutor workspace data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleManualAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    try {
      await academicService.logManualAttendance({
        student_id: selectedStudent.id,
        date: attendanceForm.date,
        status: attendanceForm.status,
        aral_activity_id: attendanceForm.aral_activity_id ? Number(attendanceForm.aral_activity_id) : undefined
      });
      setShowModal(false);
      setAttendanceForm({ date: new Date().toLocaleDateString('en-CA'), status: 'present', aral_activity_id: '' });
      alert(`Manual attendance logged for ${selectedStudent.full_name}.`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to log attendance.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome & Action Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Welcome, Teacher {user?.first_name}!</h2>
          <p className="mt-1 text-sm text-gray-500">
            Tutor workspace. Track your assigned students' performance, take attendance, and log intervention activities.
          </p>
        </div>
        <div className="flex flex-col space-y-3 shrink-0">
          <Link
            to="/tutor/attendance/generate"
            className="inline-flex items-center bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Generate Student QR Code
          </Link>

        </div>
      </div>

      {/* Grid: Workspace statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Assigned Students</span>
            <p className="text-3xl font-extrabold text-gray-900">{students.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-[var(--brand-light)] text-[var(--brand)] border border-[var(--brand-border)]">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Avg Attendance</span>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{averageAttendance}%</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Avg Score</span>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{averageScoreAvg}%</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Performance Trend</h3>
              <p className="text-sm text-gray-500">Recent combined attendance and score performance</p>
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Last 6 dates</p>
          </div>
          {performanceTrend.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <p className="text-sm font-semibold">No grade history available yet.</p>
              <p className="text-xs mt-1">Trend will appear once students have grades logged.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-52 w-full rounded-3xl bg-slate-50 p-4 border border-gray-100">
                <svg viewBox="0 0 600 220" className="w-full h-full">
                  <defs>
                    <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const max = Math.max(...performanceTrend.map((point) => point.value), 100);
                    const min = Math.min(...performanceTrend.map((point) => point.value), 0);
                    const range = max - min || 1;
                    const points = performanceTrend.map((point, idx) => {
                      const x = 50 + (idx * 100);
                      const y = 200 - ((point.value - min) / range) * 160;
                      return `${x},${y}`;
                    }).join(' ');
                    const areaPoints = `${performanceTrend.map((point, idx) => {
                      const x = 50 + (idx * 100);
                      const y = 200 - ((point.value - min) / range) * 160;
                      return `${x},${y}`;
                    }).join(' ')} 550,200 50,200`;
                    return (
                      <>
                        <polyline points={points} fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                        <polygon points={areaPoints} fill="url(#trend-gradient)" />
                        {performanceTrend.map((point, idx) => {
                          const x = 50 + (idx * 100);
                          const y = 200 - ((point.value - min) / range) * 160;
                          return <circle key={point.label} cx={x} cy={y} r="5" fill="var(--brand)" />;
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
                {performanceTrend.map((point) => (
                  <div key={point.label} className="space-y-1">
                    <p className="font-semibold text-slate-900">{point.value}%</p>
                    <p>{point.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Top Risk Students</h3>
              <p className="text-sm text-gray-500">
                Showing <span className="text-slate-900">{topRiskStudents.length}</span> student{topRiskStudents.length === 1 ? '' : 's'}
              </p>
            </div>
            <Link
              to="/tutor/analytics"
              className="inline-flex items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-light)] p-2 text-[var(--brand-dark)] hover:bg-[var(--brand-lighter)] transition"
            >
              <Maximize2 className="w-4 h-4" />
            </Link>
          </div>

          {topRiskStudents.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <p className="text-sm font-semibold">No current risk data available.</p>
              <p className="text-xs mt-1">Add weekly task or attendance entries to populate risk rankings.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topRiskStudents.map((row, index) => (
                <div
                  key={row.student.id}
                  className={`rounded-3xl p-4 ${
                    row.riskTier === 'High'
                      ? 'border border-rose-100 bg-rose-50'
                      : row.riskTier === 'Medium'
                      ? 'border border-amber-100 bg-amber-50'
                      : 'border border-emerald-100 bg-emerald-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">#{index + 1} Risk Student</p>
                      <h4 className="mt-2 text-sm font-bold text-slate-900">{row.student.full_name}</h4>
                      <p className="text-xs text-slate-500">{row.student.username}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      row.riskTier === 'High' ? 'bg-rose-100 text-rose-700' : 
                      row.riskTier === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {row.riskTier}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs text-slate-600">
                    <div className="rounded-2xl bg-white p-3 border border-gray-100">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Attendance</p>
                      <p className="mt-2 font-semibold text-slate-900">{row.attendanceRate}%</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 border border-gray-100">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Score Avg</p>
                      <p className="mt-2 font-semibold text-slate-900">{row.scoreAvg}%</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 border border-gray-100">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Composite</p>
                      <p className="mt-2 font-semibold text-slate-900">{row.compositeScore}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* QUICK ATTENDANCE MODAL */}
      {showModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleManualAttendanceSubmit} className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-200 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-gray-900 text-lg">Log Attendance for {selectedStudent.full_name}</h3>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={attendanceForm.date}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
              <select
                value={attendanceForm.status}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value as any })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Linked Intervention Activity (Optional)</label>
              <select
                value={attendanceForm.aral_activity_id}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, aral_activity_id: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">None</option>
                {activities
                  .filter((act) => act.student === selectedStudent.id)
                  .map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.title}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-2 border-t border-gray-150">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                Log Entry
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
