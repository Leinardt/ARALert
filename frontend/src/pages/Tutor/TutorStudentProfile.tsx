import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import type { StudentAcademicProfile, Grade, Attendance } from '../../types';
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  BookOpen,
  AlertTriangle,
  Plus,
  Trash2,
  BarChart2
} from 'lucide-react';

export const TutorStudentProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'grades' | 'attendance' | 'aral' | 'risks'>('overview');

  // Modals state
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  // Form states
  const [gradeForm, setGradeForm] = useState({
    subject: '',
    quarter: 1,
    score: '',
    component_type: 'assessment' as 'assessment' | 'weekly_task' | 'attendance',
    remarks: ''
  });

  const [activityForm, setActivityForm] = useState({
    title: '',
    description: '',
    status: 'pending' as 'pending' | 'in_progress' | 'completed',
    remarks: ''
  });

  const [riskForm, setRiskForm] = useState({
    risk_level: 'low' as 'low' | 'medium' | 'high',
    details: ''
  });

  const [attendanceForm, setAttendanceForm] = useState({
    date: new Date().toLocaleDateString('en-CA'),
    status: 'present' as 'present' | 'late' | 'absent',
    aral_activity_id: ''
  });
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    lrn: '',
    aral_level: 'basic'
  });
  const [isEvaluatingLevel, setIsEvaluatingLevel] = useState(false);
  const [levelEvalMessage, setLevelEvalMessage] = useState<string | null>(null);
  const [studentEditError, setStudentEditError] = useState<string | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  const handleEvaluateLevelProgression = async () => {
    if (!id) return;
    setIsEvaluatingLevel(true);
    setLevelEvalMessage(null);
    try {
      const results = await academicService.evaluateAralLevelUp(id);
      if (results && results.length > 0) {
        setLevelEvalMessage(results[0].message);
      }
      await fetchProfile();
    } catch (err: any) {
      console.error(err);
      alert('Failed to evaluate ARAL level progression.');
    } finally {
      setIsEvaluatingLevel(false);
    }
  };

  const fetchProfile = async () => {
    if (!id) return;
    try {
      const data = await academicService.getStudentProfile(id);
      setProfile(data);
      setStudentForm({
        first_name: data.student.first_name,
        last_name: data.student.last_name,
        username: data.student.username,
        email: data.student.email,
        lrn: data.student.lrn || '',
        aral_level: data.student.aral_level || 'basic'
      });
    } catch (err) {
      console.error(err);
      setError('Failed to fetch student profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !gradeForm.subject || !gradeForm.score) return;
    try {
      await academicService.createGrade({
        student: id,
        subject: gradeForm.subject,
        quarter: Number(gradeForm.quarter),
        score: Number(gradeForm.score),
        component_type: gradeForm.component_type,
        remarks: gradeForm.remarks || null
      });
      setShowGradeModal(false);
      setGradeForm({ subject: '', quarter: 1, score: '', component_type: 'assessment', remarks: '' });
      fetchProfile();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add grade.');
    }
  };

  const handleDeleteGrade = async (gradeId: number) => {
    if (!window.confirm('Are you sure you want to delete this grade?')) return;
    try {
      await academicService.deleteGrade(gradeId);
      fetchProfile();
    } catch (err) {
      alert('Failed to delete grade.');
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !activityForm.title) return;
    try {
      await academicService.createAralActivity({
        student: id,
        title: activityForm.title,
        description: activityForm.description || null,
        status: activityForm.status,
        remarks: activityForm.remarks || null
      });
      setShowActivityModal(false);
      setActivityForm({ title: '', description: '', status: 'pending', remarks: '' });
      fetchProfile();
    } catch (err) {
      alert('Failed to create ARAL activity.');
    }
  };

  const handleUpdateActivityStatus = async (actId: number, status: 'pending' | 'in_progress' | 'completed') => {
    try {
      await academicService.updateAralActivity(actId, { status });
      fetchProfile();
    } catch (err) {
      alert('Failed to update activity.');
    }
  };

  const handleDeleteActivity = async (actId: number) => {
    if (!window.confirm('Delete this ARAL activity?')) return;
    try {
      await academicService.deleteAralActivity(actId);
      fetchProfile();
    } catch (err) {
      alert('Failed to delete activity.');
    }
  };

  const handleAddRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !riskForm.details) return;
    try {
      await academicService.createAcademicRisk({
        student: id,
        risk_level: riskForm.risk_level,
        details: riskForm.details,
        resolved: false
      });
      setShowRiskModal(false);
      setRiskForm({ risk_level: 'low', details: '' });
      fetchProfile();
    } catch (err) {
      alert('Failed to log risk alert.');
    }
  };

  const handleResolveRisk = async (riskId: number) => {
    try {
      await academicService.updateAcademicRisk(riskId, { resolved: true });
      fetchProfile();
    } catch (err) {
      alert('Failed to resolve risk alert.');
    }
  };

  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await academicService.logManualAttendance({
        student_id: id,
        date: attendanceForm.date,
        status: attendanceForm.status,
        aral_activity_id: attendanceForm.aral_activity_id ? Number(attendanceForm.aral_activity_id) : undefined
      });
      setShowAttendanceModal(false);
      setAttendanceForm({ date: new Date().toLocaleDateString('en-CA'), status: 'present', aral_activity_id: '' });
      fetchProfile();
    } catch (err) {
      alert('Failed to log attendance.');
    }
  };

  const handleSaveStudentDetails = async () => {
    if (!profile) return;
    setIsSavingStudent(true);
    setStudentEditError(null);

    try {
      await userService.updateUser(profile.student.id, {
        first_name: studentForm.first_name,
        last_name: studentForm.last_name,
        username: studentForm.username,
        email: studentForm.email,
        lrn: studentForm.lrn || null,
        aral_level: studentForm.aral_level
      });
      setIsEditingStudent(false);
      await fetchProfile();
    } catch (err: any) {
      setStudentEditError(err?.response?.data?.detail || 'Failed to save student details.');
    } finally {
      setIsSavingStudent(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !profile) {
    return <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl">{error || 'Profile not found.'}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Back button and profile summary */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Link to="/tutor" className="text-gray-500 hover:text-[var(--brand)] inline-flex items-center text-sm font-semibold transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Directory
            </Link>
            <button
              type="button"
              onClick={() => setIsEditingStudent((current) => !current)}
              className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-light)] px-3 py-1 text-xs font-bold text-[var(--brand-dark)] hover:bg-[var(--brand-lighter)] transition-all"
            >
              {isEditingStudent ? 'Cancel Edit' : 'Edit Student Details'}
            </button>
          </div>
          {levelEvalMessage && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 font-medium flex items-center justify-between">
              <span>{levelEvalMessage}</span>
              <button onClick={() => setLevelEvalMessage(null)} className="text-indigo-600 font-bold hover:underline ml-2">✕</button>
            </div>
          )}
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-[var(--brand)] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              {profile.student.name[0].toUpperCase()}
            </div>
            <div className="space-y-1 w-full">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
                {isEditingStudent ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 w-full">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700">First Name</label>
                      <input
                        value={studentForm.first_name}
                        onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700">Last Name</label>
                      <input
                        value={studentForm.last_name}
                        onChange={(e) => setStudentForm({ ...studentForm, last_name: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{profile.student.name}</h2>
                    <p className="text-xs text-gray-500 font-medium">LRN: {profile.student.lrn || 'N/A'} | {profile.student.email}</p>
                  </div>
                )}
                {isEditingStudent && (
                  <button
                    type="button"
                    onClick={handleSaveStudentDetails}
                    disabled={isSavingStudent}
                    className="min-w-[140px] rounded-full bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition-all disabled:cursor-not-allowed disabled:bg-[var(--brand-light)]"
                  >
                    {isSavingStudent ? 'Saving...' : 'Save Details'}
                  </button>
                )}
              </div>
              {isEditingStudent ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Username</label>
                    <input
                      value={studentForm.username}
                      onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Email</label>
                    <input
                      type="email"
                      value={studentForm.email}
                      onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700">LRN</label>
                    <input
                      value={studentForm.lrn}
                      onChange={(e) => setStudentForm({ ...studentForm, lrn: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700">ARAL Level</label>
                    <select
                      value={studentForm.aral_level}
                      onChange={(e) => setStudentForm({ ...studentForm, aral_level: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="basic">Basic</option>
                      <option value="plus">Plus</option>
                      <option value="summer">Summer</option>
                      <option value="graduated">Graduated 🎓</option>
                    </select>
                  </div>
                </div>
              ) : null}
              {studentEditError && <p className="text-xs text-red-600">{studentEditError}</p>}
            </div>
          </div>
        </div>

        {/* Weights overview */}
        {profile.assigned_tutor && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-600 space-y-1">
            <span className="font-bold text-gray-800">Your Grading Weights Applied:</span>
            <div className="flex space-x-3 font-medium">
              <span>Assessments: {profile.assigned_tutor.assessment_weight}%</span>
              <span>Tasks: {profile.assigned_tutor.weekly_tasks_weight}%</span>
              <span>Attendance: {profile.assigned_tutor.attendance_weight}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex space-x-6">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart2 },
          { key: 'grades', label: 'Grades', icon: GraduationCap },
          { key: 'attendance', label: 'Attendance Logs', icon: Calendar },
          { key: 'aral', label: 'ARAL Interventions', icon: BookOpen },
          { key: 'risks', label: 'Risk Notices', icon: AlertTriangle }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-4 text-sm font-bold flex items-center space-x-1.5 border-b-2 transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'border-[var(--brand)] text-[var(--brand)]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* GPA */}
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-6 rounded-xl border border-[var(--brand-border)] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[var(--brand)] uppercase tracking-wide">General GPA</span>
                  <p className="text-3xl font-extrabold text-[var(--brand-text)] mt-1">{profile.gpa !== null ? profile.gpa.toFixed(2) : 'N/A'}</p>
                </div>
                <GraduationCap className="w-10 h-10 text-[var(--brand)] stroke-[1.5]" />
              </div>

              {/* Attendance Rate */}
              <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 p-6 rounded-xl border border-teal-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-teal-600 uppercase tracking-wide">Attendance Rate</span>
                  <p className="text-3xl font-extrabold text-teal-900 mt-1">{profile.attendance.attendance_rate}%</p>
                </div>
                <Calendar className="w-10 h-10 text-teal-600 stroke-[1.5]" />
              </div>

              {/* Risk Status */}
              <div className={`p-6 rounded-xl border flex items-center justify-between ${
                (profile.computed_risk_level || 'low') === 'high'
                  ? 'bg-red-50 border-red-100 text-red-900'
                  : (profile.computed_risk_level || 'low') === 'medium'
                  ? 'bg-amber-50 border-amber-100 text-amber-900'
                  : 'bg-green-50 border-green-100 text-green-900'
              }`}>
                <div>
                  <span className={`text-xs font-bold uppercase tracking-wide ${
                    (profile.computed_risk_level || 'low') === 'high'
                      ? 'text-red-600'
                      : (profile.computed_risk_level || 'low') === 'medium'
                      ? 'text-amber-600'
                      : 'text-green-600'
                  }`}>
                    Risk Level
                  </span>
                  <p className="text-3xl font-extrabold mt-1 capitalize">
                    {profile.computed_risk_level || 'Low'}
                  </p>
                </div>
                <AlertTriangle className={`w-10 h-10 stroke-[1.5] ${
                  (profile.computed_risk_level || 'low') === 'high'
                    ? 'text-red-500'
                    : (profile.computed_risk_level || 'low') === 'medium'
                    ? 'text-amber-500'
                    : 'text-green-500'
                }`} />
              </div>
            </div>

            {/* GPA Breakdown table */}
            <div className="space-y-3">
              <h3 className="font-bold text-gray-800 text-base">Quarterly Subject Performance</h3>
              {profile.grade_details.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No academic performance calculations logged yet.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-150 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Subject</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Quarter</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Assessments</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Weekly Tasks</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Attendance</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Final Grade (Weighted)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 bg-white">
                      {profile.grade_details.map((detail, index) => (
                        <tr key={index} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-sm font-bold text-gray-800">{detail.subject}</td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">Q{detail.quarter}</td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">{detail.assessment_avg}%</td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">{detail.weekly_task_avg}%</td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">{detail.attendance_avg}%</td>
                          <td className="px-4 py-3 text-right text-sm font-extrabold text-[var(--brand-dark)]">{detail.final_grade}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GRADES TAB */}
        {activeTab === 'grades' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-base">Academic Component Logs</h3>
              <button
                onClick={() => setShowGradeModal(true)}
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log New Grade</span>
              </button>
            </div>

            {/* List all grades from profile.grade_details or need a grades call. Since getStudentProfile contains full logs list inside profile? Oh wait, we can just fetch grades for this student. Wait, does profile response contain student's raw grade records? Wait, let's look at getStudentProfile view in backend views.py (lines 463-582). 
            Ah! It does NOT contain a raw list of Grade objects! It only computes and returns 'grade_details' (subject, quarter, assessment_avg, task_avg, attendance_avg, final_grade).
            Wait! How can we view the raw logged records? 
            Ah, we can query raw logs using `academicService.getGrades({ student_id: id })`! 
            Let's fetch raw logs inside useEffect when the activeTab is 'grades'! This is a beautiful, dynamic design.
            Let's also do that for attendance logs and activities if needed. Wait, attendance logs lists are returned inside `attendance.logs` (limited to 15 items). Let's see: `academicService.getAttendanceHistory({ user_id: id })` can get all attendance logs! And `profile.aral_progress.activities` returns the list of all activities!
            So let's load raw grades specifically:
            */}
            <GradeTableList studentId={id!} reloadTrigger={profile} onDelete={handleDeleteGrade} />
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800 text-base">Daily Attendance History</h3>
                <p className="text-xs text-gray-500 font-medium">Rate: {profile.attendance.attendance_rate}% | Present: {profile.attendance.present} | Late: {profile.attendance.late} | Absent: {profile.attendance.absent}</p>
              </div>
              <button
                onClick={() => setShowAttendanceModal(true)}
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Manual Attendance</span>
              </button>
            </div>

            <AttendanceHistoryList studentId={id!} reloadTrigger={profile} />
          </div>
        )}

        {/* ARAL TAB */}
        {activeTab === 'aral' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-base">ARAL Intervention Activities</h3>
              <button
                onClick={() => setShowActivityModal(true)}
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Activity</span>
              </button>
            </div>

            {profile.aral_progress.activities.length === 0 ? (
              <p className="text-xs text-gray-500 italic p-4 text-center border border-dashed border-gray-200 rounded-xl">No intervention activities created yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile.aral_progress.activities.map((act) => (
                  <div key={act.id} className="p-4 rounded-xl border border-gray-150 bg-gray-50/30 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 text-sm">{act.title}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                          act.status === 'completed'
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : act.status === 'in_progress'
                            ? 'bg-[var(--brand-light)] text-[var(--brand-dark)] border-[var(--brand-border)]'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                        }`}>
                          {act.status_display}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-2 line-clamp-3">{act.description || 'No description provided.'}</p>
                      {act.remarks && (
                        <p className="text-xs text-gray-500 bg-gray-100 p-2 rounded mt-2 font-mono">
                          Remarks: {act.remarks}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-150/50">
                      <span className="text-[10px] text-gray-400 font-semibold">
                        Assigned: {new Date(act.date_assigned).toLocaleDateString()}
                      </span>
                      <div className="flex items-center space-x-2">
                        {act.status !== 'completed' && (
                          <button
                            onClick={() => handleUpdateActivityStatus(act.id, act.status === 'pending' ? 'in_progress' : 'completed')}
                            className="bg-[var(--brand-light)] hover:bg-[var(--brand)] text-[var(--brand-dark)] border border-[var(--brand-border)] px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer"
                          >
                            Mark {act.status === 'pending' ? 'In Progress' : 'Completed'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteActivity(act.id)}
                          className="text-red-500 hover:text-red-700 p-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RISKS TAB */}
        {activeTab === 'risks' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-base">Academic Risk Notice Board</h3>
              <button
                onClick={() => setShowRiskModal(true)}
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Flag New Risk</span>
              </button>
            </div>

            {profile.academic_risks.length === 0 ? (
              <p className="text-xs text-gray-500 italic p-4 text-center border border-dashed border-gray-200 rounded-xl">No active risk flags logged for this student.</p>
            ) : (
              <div className="space-y-3">
                {profile.academic_risks.map((risk) => (
                  <div key={risk.id} className="p-4 rounded-xl border border-red-100 bg-red-50/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                          risk.risk_level === 'high'
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : risk.risk_level === 'medium'
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-yellow-100 text-yellow-700 border-yellow-250'
                        }`}>
                          {risk.risk_level_display}
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold">{new Date(risk.date_created).toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-bold text-gray-900">{risk.details}</p>
                    </div>

                    {!risk.resolved && (
                      <button
                        onClick={() => handleResolveRisk(risk.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 w-fit cursor-pointer"
                      >
                        Resolve Alert
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* GRADE MODAL */}
      {showGradeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddGrade} className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-200 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-gray-900 text-lg">Log Academic Grade</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mathematics"
                  value={gradeForm.subject}
                  onChange={(e) => setGradeForm({ ...gradeForm, subject: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Quarter</label>
                <select
                  value={gradeForm.quarter}
                  onChange={(e) => setGradeForm({ ...gradeForm, quarter: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value={1}>1st Quarter</option>
                  <option value={2}>2nd Quarter</option>
                  <option value={3}>3rd Quarter</option>
                  <option value={4}>4th Quarter</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Score (0-100)</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  step={0.01}
                  value={gradeForm.score}
                  onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Component Type</label>
                <select
                  value={gradeForm.component_type}
                  onChange={(e) => setGradeForm({ ...gradeForm, component_type: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="assessment">Assessment</option>
                  <option value="weekly_task">Weekly Task</option>
                  <option value="attendance">Attendance</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Remarks (Optional)</label>
              <textarea
                value={gradeForm.remarks}
                onChange={(e) => setGradeForm({ ...gradeForm, remarks: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white h-20 resize-none"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2 border-t border-gray-150">
              <button
                type="button"
                onClick={() => setShowGradeModal(false)}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                Save Log
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ARAL ACTIVITY MODAL */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddActivity} className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-200 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-gray-900 text-lg">Create ARAL Activity</h3>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Remedial Reading Practice"
                value={activityForm.title}
                onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
              <textarea
                value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white h-20 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Initial Status</label>
                <select
                  value={activityForm.status}
                  onChange={(e) => setActivityForm({ ...activityForm, status: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Remarks (Optional)</label>
              <input
                type="text"
                value={activityForm.remarks}
                onChange={(e) => setActivityForm({ ...activityForm, remarks: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2 border-t border-gray-150">
              <button
                type="button"
                onClick={() => setShowActivityModal(false)}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RISK ALERTS MODAL */}
      {showRiskModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddRisk} className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-200 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-gray-900 text-lg">Log Academic Risk Warning</h3>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Risk Level</label>
              <select
                value={riskForm.risk_level}
                onChange={(e) => setRiskForm({ ...riskForm, risk_level: e.target.value as any })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Details / Reasons</label>
              <textarea
                required
                placeholder="Explain why this student is flagged (e.g. failing exam grades, consistent absenteeism)"
                value={riskForm.details}
                onChange={(e) => setRiskForm({ ...riskForm, details: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white h-24 resize-none"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2 border-t border-gray-150">
              <button
                type="button"
                onClick={() => setShowRiskModal(false)}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                Submit Flag
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ATTENDANCE MODAL */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddAttendance} className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-200 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-gray-900 text-lg">Log Manual Attendance</h3>

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
                {profile.aral_progress.activities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-2 border-t border-gray-150">
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
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

// Helper Component for Raw Grades Listing
interface GradeTableProps {
  studentId: string;
  reloadTrigger: any;
  onDelete: (id: number) => void;
}

const GradeTableList: React.FC<GradeTableProps> = ({ studentId, reloadTrigger, onDelete }) => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const data = await academicService.getGrades({ student_id: studentId });
        setGrades(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGrades();
  }, [studentId, reloadTrigger]);

  if (isLoading) return <div className="text-xs text-gray-500">Loading grade history...</div>;
  if (grades.length === 0) return <p className="text-xs text-gray-500 italic p-4 text-center border border-dashed border-gray-200 rounded-xl">No grades logged yet.</p>;

  return (
    <div className="overflow-x-auto border border-gray-150 rounded-xl">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase">Subject</th>
            <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Quarter</th>
            <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Component</th>
            <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Score</th>
            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase">Remarks</th>
            <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-150 bg-white">
          {grades.map((grade) => (
            <tr key={grade.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-2.5 text-sm font-bold text-gray-800">{grade.subject}</td>
              <td className="px-4 py-2.5 text-center text-sm text-gray-600">Q{grade.quarter}</td>
              <td className="px-4 py-2.5 text-center text-sm">
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                  {grade.component_type_display}
                </span>
              </td>
              <td className="px-4 py-2.5 text-center text-sm font-extrabold text-[var(--brand)]">{grade.score}</td>
              <td className="px-4 py-2.5 text-sm text-gray-500 font-medium max-w-[200px] truncate">{grade.remarks || '—'}</td>
              <td className="px-4 py-2.5 text-right text-sm">
                <button
                  onClick={() => onDelete(grade.id)}
                  className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Helper Component for Attendance Listing
interface AttendanceProps {
  studentId: string;
  reloadTrigger: any;
}

const AttendanceHistoryList: React.FC<AttendanceProps> = ({ studentId, reloadTrigger }) => {
  const [logs, setLogs] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await academicService.getAttendanceHistory({ user_id: studentId });
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, [studentId, reloadTrigger]);

  if (isLoading) return <div className="text-xs text-gray-500">Loading logs...</div>;
  if (logs.length === 0) return <p className="text-xs text-gray-500 italic p-4 text-center border border-dashed border-gray-200 rounded-xl">No attendance logs found.</p>;

  return (
    <div className="overflow-x-auto border border-gray-150 rounded-xl">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
            <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Time In</th>
            <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Time Out</th>
            <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
            <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase">Linked Activity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-150 bg-white">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-2.5 text-sm font-bold text-gray-800">{log.date}</td>
              <td className="px-4 py-2.5 text-center text-sm text-gray-600 font-mono">
                {log.time_in ? new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
              </td>
              <td className="px-4 py-2.5 text-center text-sm text-gray-600 font-mono">
                {log.time_out ? new Date(log.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
              </td>
              <td className="px-4 py-2.5 text-center text-sm">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                  log.status === 'present'
                    ? 'bg-green-50 text-green-700 border-green-100'
                    : log.status === 'late'
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                    : 'bg-red-50 text-red-700 border-red-100'
                }`}>
                  {log.status_display}
                </span>
              </td>
              <td className="px-4 py-2.5 text-sm text-gray-500 font-medium max-w-[200px] truncate">
                {log.aral_activity_title || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
