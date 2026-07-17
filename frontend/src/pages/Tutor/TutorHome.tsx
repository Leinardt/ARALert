import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';
import type { User, AralActivity } from '../../types';
import {
  Users,
  BookOpen,
  Calendar,
  ChevronRight,
  Award
} from 'lucide-react';
import { Link } from 'react-router-dom';

const getRiskTier = (score: number) => {
  if (score >= 85) return 'Low';
  if (score >= 70) return 'Moderate';
  return 'High';
};

const applyAttendanceEscalation = (tier: string, attendanceRate: number) => {
  if (attendanceRate >= 90) return tier;
  if (attendanceRate >= 80) {
    return tier === 'Low' ? 'Moderate' : tier;
  }
  if (tier === 'Low') return 'Moderate';
  return 'High';
};

const riskPriority = (tier: string) => {
  if (tier === 'High') return 2;
  if (tier === 'Moderate') return 1;
  return 0;
};

export const TutorHome: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [activities, setActivities] = useState<AralActivity[]>([]);
  const [topRiskStudents, setTopRiskStudents] = useState<StudentRiskRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual attendance modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
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
  }, []);

  const handleOpenAttendanceModal = (student: User) => {
    setSelectedStudent(student);
    setShowModal(true);
  };

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
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
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
            className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all"
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
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Top Risk Students</span>
            <p className="text-3xl font-extrabold text-gray-900">{topRiskStudents.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Grading Weight Profile</span>
            <div className="text-sm font-bold text-gray-800 mt-1 flex space-x-2">
              <span>A: {user?.assessment_weight}%</span>
              <span>T: {user?.weekly_tasks_weight}%</span>
              <span>At: {user?.attendance_weight}%</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 text-base mb-4">Top Risk Students</h3>
          {topRiskStudents.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <p className="text-sm font-semibold">No current risk data available.</p>
              <p className="text-xs mt-1">Add weekly task or attendance entries to populate risk rankings.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topRiskStudents.map((row, index) => (
                <div key={row.student.id} className="rounded-3xl border border-gray-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">#{index + 1} Risk Student</p>
                      <h4 className="mt-2 text-sm font-bold text-slate-900">{row.student.full_name}</h4>
                      <p className="text-xs text-slate-500">{row.student.username}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      row.riskTier === 'High' ? 'bg-rose-100 text-rose-700' : 
                      row.riskTier === 'Moderate' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assigned Student Directory */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-900 text-base flex items-center">
              <Users className="w-5 h-5 mr-2 text-indigo-600" />
              Assigned Students
            </h3>
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-100">
              {students.length} Students
            </span>
          </div>

          {students.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <p className="text-sm font-bold">No students assigned yet.</p>
              <p className="text-xs mt-1 text-gray-400">Ask the administrator to assign student accounts to you.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50/30 px-2 rounded-xl transition-all"
                >
                  <div className="space-y-1">
                    <h4 className="font-bold text-gray-800 text-sm">{student.full_name}</h4>
                    <p className="text-xs text-gray-400">LRN: {student.lrn || 'N/A'} | {student.email}</p>
                  </div>
                  <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleOpenAttendanceModal(student)}
                      className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Log Attendance
                    </button>
                    <Link
                      to={`/tutor/students/${student.id}`}
                      className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors"
                    >
                      <span>View Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Activities & Interventions */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-gray-900 text-base flex items-center border-b border-gray-100 pb-3">
            <BookOpen className="w-5 h-5 mr-2 text-teal-600" />
            Active Interventions
          </h3>

          {activities.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-sm font-semibold">No active activities.</p>
              <p className="text-xs mt-1">Interventions you tag as "In Progress" will show here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2"
                >
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-gray-800 text-xs line-clamp-1">{act.title}</h4>
                    <span className="bg-teal-50 text-teal-700 border border-teal-100 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0">
                      In Progress
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{act.description}</p>
                  <div className="flex justify-between items-center text-[10px] text-gray-400 font-semibold pt-1 border-t border-gray-150/40">
                    <span>Student: {act.student_name}</span>
                    <Link to={`/tutor/students/${act.student}`} className="text-indigo-600 font-bold hover:underline">
                      Manage
                    </Link>
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
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
