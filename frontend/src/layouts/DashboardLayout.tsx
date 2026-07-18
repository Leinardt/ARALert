import React, { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Users, User as UserIcon, Settings, LogOut, QrCode, Scan, Award, Bell } from 'lucide-react';
import { userService } from '../services/userService';
import { academicService } from '../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../utils/analyticsHelpers';
import type { AcademicRisk } from '../types';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleLabel = () => {
    if (!user) return '';
    if (user.is_superuser) return 'SuperAdmin';
    return user.role ? user.role.toUpperCase() : 'USER';
  };

  const [highRiskCount, setHighRiskCount] = useState(0);
  const [highRiskStudents, setHighRiskStudents] = useState<StudentRiskRow[]>([]);
  const [moderateRiskStudents, setModerateRiskStudents] = useState<StudentRiskRow[]>([]);
  const [showRiskList, setShowRiskList] = useState(false);
  const [acknowledgingStudent, setAcknowledgingStudent] = useState<StudentRiskRow | null>(null);
  const [acknowledgeNote, setAcknowledgeNote] = useState('');
  const [acknowledgedNotes, setAcknowledgedNotes] = useState<Record<string, string>>({});
  const [acknowledgedRiskIds, setAcknowledgedRiskIds] = useState<Record<string, number>>({});

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const fetchRiskStudents = async () => {
    if (!user || user.role !== 'tutor') return;

    try {
      const [studentRes, grades, attendanceLogs, riskRecords] = await Promise.all([
        userService.getUsers({ role: 'student', assigned_tutor: user.id }),
        academicService.getGrades(),
        academicService.getAttendanceHistory(),
        academicService.getAcademicRisks()
      ]);

      const rows = computeStudentRiskRows(studentRes.results, grades, attendanceLogs);
      const highRiskRows = rows.filter((row) => row.riskTier === 'High').sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5);
      const moderateRiskRows = rows.filter((row) => row.riskTier === 'Medium').sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5);

      const latestResolvedRiskByStudent = riskRecords
        .filter((risk) => risk.resolved)
        .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime())
        .reduce<Record<string, AcademicRisk>>((acc, risk) => {
          if (!acc[risk.student]) acc[risk.student] = risk;
          return acc;
        }, {});

      const notesByStudent = Object.fromEntries(
        Object.entries(latestResolvedRiskByStudent).map(([studentId, risk]) => [studentId, risk.details])
      );
      const riskIdsByStudent = Object.fromEntries(
        Object.entries(latestResolvedRiskByStudent).map(([studentId, risk]) => [studentId, risk.id])
      );

      setHighRiskStudents(highRiskRows);
      setModerateRiskStudents(moderateRiskRows);
      setHighRiskCount(highRiskRows.length + moderateRiskRows.length);
      setAcknowledgedNotes(notesByStudent);
      setAcknowledgedRiskIds(riskIdsByStudent);
    } catch (error) {
      console.error('Failed to load tutor alerts', error);
    }
  };

  const handleAcknowledgeInitiate = (row: StudentRiskRow) => {
    setAcknowledgingStudent(row);
    setAcknowledgeNote(acknowledgedNotes[row.student.id] ?? '');
  };

  const handleAcknowledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledgingStudent) return;

    const noteText = acknowledgeNote || `Acknowledged ${acknowledgingStudent.student.full_name}`;
    const existingRiskId = acknowledgedRiskIds[acknowledgingStudent.student.id];

    try {
      if (existingRiskId) {
        await academicService.updateAcademicRisk(existingRiskId, {
          details: noteText,
          resolved: true
        });
      } else {
        const newRisk = await academicService.createAcademicRisk({
          student: acknowledgingStudent.student.id,
          risk_level: 'high',
          details: noteText,
          resolved: true
        });
        setAcknowledgedRiskIds((prev) => ({
          ...prev,
          [acknowledgingStudent.student.id]: newRisk.id
        }));
      }

      setAcknowledgedNotes((prev) => ({
        ...prev,
        [acknowledgingStudent.student.id]: noteText
      }));
      setAcknowledgingStudent(null);
      setAcknowledgeNote('');
      await fetchRiskStudents();
      setShowRiskList(true);
    } catch (error) {
      console.error('Failed to acknowledge risk', error);
      alert('Failed to acknowledge the risk. Please try again.');
    }
  };

  const handleAcknowledgeCancel = () => {
    setAcknowledgingStudent(null);
    setAcknowledgeNote('');
  };

  useEffect(() => {
    fetchRiskStudents();
  }, [user]);

  useEffect(() => {
    if (!showRiskList) return;
    fetchRiskStudents();
  }, [showRiskList]);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 flex flex-col shrink-0 border-r border-gray-800">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-gray-800 space-x-2 shrink-0">
          <img src="/src/assets/ARALert_LOGO.png" alt="ARALert logo" className="w-8 h-8" />
          <span className="font-bold text-lg text-white tracking-wider">ARALert</span>
        </div>

        {/* Navigation Section */}
        <nav className="flex-grow py-6 px-4 space-y-1 overflow-y-auto">
          {user?.is_superuser ? (
            <>
              <Link
                to="/superadmin"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/superadmin')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Dashboard
              </Link>
              <Link
                to="/superadmin/users"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/superadmin/users') || isActive('/superadmin/users/create') || location.pathname.includes('/superadmin/users/edit')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Users className="w-5 h-5 mr-3" />
                Users
              </Link>
              <Link
                to="/superadmin/profile"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/superadmin/profile')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <UserIcon className="w-5 h-5 mr-3" />
                Profile
              </Link>
              <Link
                to="/superadmin/settings"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/superadmin/settings')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Settings className="w-5 h-5 mr-3" />
                Settings
              </Link>
            </>
          ) : user?.role === 'admin' ? (
            <>
              <Link
                to="/admin"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/admin')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Dashboard
              </Link>
              <Link
                to="/admin/students"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/admin/students') || isActive('/admin/students/create') || location.pathname.includes('/admin/students/edit')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Users className="w-5 h-5 mr-3" />
                Students
              </Link>
              <Link
                to="/admin/attendance"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/admin/attendance')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <QrCode className="w-5 h-5 mr-3" />
                Staff QR Code
              </Link>
              <Link
                to="/admin/profile"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/admin/profile')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <UserIcon className="w-5 h-5 mr-3" />
                Profile
              </Link>
              <Link
                to="/admin/settings"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/admin/settings')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Settings className="w-5 h-5 mr-3" />
                Settings
              </Link>
            </>
          ) : user?.role === 'tutor' ? (
            <>
              <Link
                to="/tutor"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/tutor')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Workspace Home
              </Link>
              <Link
                to="/tutor/attendance/generate"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/tutor/attendance/generate')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <QrCode className="w-5 h-5 mr-3" />
                Student QR Code
              </Link>
              <Link
                to="/tutor/scores"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/tutor/scores')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Award className="w-5 h-5 mr-3" />
                Score Entry
              </Link>
              <Link
                to="/tutor/analytics"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/tutor/analytics')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Data Analytics
              </Link>
              <Link
                to="/tutor/students"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/tutor/students')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Users className="w-5 h-5 mr-3" />
                Students
              </Link>
              <Link
                to="/staff/scan"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/staff/scan')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Scan className="w-5 h-5 mr-3" />
                Clock In / Out
              </Link>
            </>
          ) : user?.role === 'principal' ? (
            <>
              <Link
                to="/principal"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/principal')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Monitoring Dashboard
              </Link>
              <Link
                to="/staff/scan"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/staff/scan')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Scan className="w-5 h-5 mr-3" />
                Clock In / Out
              </Link>
            </>
          ) : user?.role === 'faculty' ? (
            <>
              <Link
                to="/faculty"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/faculty')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Faculty Home
              </Link>
              <Link
                to="/staff/scan"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/staff/scan')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Scan className="w-5 h-5 mr-3" />
                Clock In / Out
              </Link>
            </>
          ) : user?.role === 'student' ? (
            <>
              <Link
                to="/student"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/student')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Student Dashboard
              </Link>
              <Link
                to="/staff/scan"
                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive('/staff/scan')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Scan className="w-5 h-5 mr-3" />
                Scan QR Code
              </Link>
            </>
          ) : null}
        </nav>

        {/* Sidebar Footer / Logout */}
        <div className="p-4 border-t border-gray-800 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-950/30 hover:text-red-300 rounded-md transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex flex-col flex-grow overflow-hidden">
        {/* Header bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-xl font-bold text-gray-800">
            {location.pathname.startsWith('/superadmin/users')
              ? 'User Management'
              : location.pathname.startsWith('/admin/students')
              ? 'Student Directory'
              : location.pathname.includes('/profile')
              ? 'Profile'
              : location.pathname.includes('/settings')
              ? 'Settings'
              : 'Dashboard'}
          </h1>

          <div className="flex items-center space-x-4 relative">
            {user?.role === 'tutor' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRiskList((prev) => !prev)}
                  className="flex items-center justify-center text-black hover:text-gray-700 transition-all p-0"
                  aria-label="High risk alerts"
                >
                  <Bell className="w-6 h-6" />
                  {highRiskCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold">
                      {highRiskCount}
                    </span>
                  )}
                </button>

                {showRiskList && (
                  <div className="absolute right-0 mt-3 w-96 bg-white rounded-3xl border border-gray-200 shadow-xl z-50">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Academic Alerts</p>
                        <p className="text-xs text-gray-500">High and medium risk students tracked here.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRiskList(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        Close
                      </button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
                      <div className="rounded-3xl border border-rose-100 bg-rose-50 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-rose-900">High Risk</p>
                            <p className="text-xs text-rose-600">Needs action</p>
                          </div>
                          <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-100 rounded-full px-2 py-1">
                            {highRiskStudents.length}
                          </span>
                        </div>
                        {highRiskStudents.length === 0 ? (
                          <div className="text-sm text-rose-700">No high-risk students at the moment.</div>
                        ) : (
                          <div className="space-y-3">
                            {highRiskStudents.map((row) => (
                              <div key={`high-${row.student.id}`} className="rounded-3xl border border-rose-100 bg-white p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-bold text-gray-900">{row.student.full_name}</p>
                                    <p className="text-xs text-gray-500">Composite {row.compositeScore}% • Attendance {row.attendanceRate}%</p>
                                    {acknowledgedNotes[row.student.id] ? (
                                      <p className="mt-2 text-xs font-semibold text-black">Acknowledged - Note saved</p>
                                    ) : null}
                                    {acknowledgedNotes[row.student.id] && (
                                      <p className="mt-1 text-xs text-slate-500">“{acknowledgedNotes[row.student.id]}”</p>
                                    )}
                                  </div>
                                  <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-rose-700 bg-rose-100 rounded-full px-2 py-1">
                                    High
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAcknowledgeInitiate(row)}
                                  className="mt-3 w-full inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 text-gray-700 text-xs font-bold px-3 py-2 hover:bg-gray-100 transition-all"
                                >
                                  {acknowledgedNotes[row.student.id] ? 'Edit Note' : 'Acknowledge'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-amber-900">Medium Risk</p>
                            <p className="text-xs text-amber-600">Watchlist</p>
                          </div>
                          <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-100 rounded-full px-2 py-1">
                            {moderateRiskStudents.length}
                          </span>
                        </div>
                        {moderateRiskStudents.length === 0 ? (
                          <div className="text-sm text-amber-700">No medium-risk students at the moment.</div>
                        ) : (
                          <div className="space-y-3">
                            {moderateRiskStudents.map((row) => (
                              <div key={`moderate-${row.student.id}`} className="rounded-3xl border border-amber-100 bg-white p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-bold text-gray-900">{row.student.full_name}</p>
                                    <p className="text-xs text-gray-500">Composite {row.compositeScore}% • Attendance {row.attendanceRate}%</p>
                                    {acknowledgedNotes[row.student.id] ? (
                                      <p className="mt-2 text-xs font-semibold text-black">Acknowledged - Note saved</p>
                                    ) : null}
                                    {acknowledgedNotes[row.student.id] && (
                                      <p className="mt-1 text-xs text-slate-500">“{acknowledgedNotes[row.student.id]}”</p>
                                    )}
                                  </div>
                                  <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-1">
                                    Medium
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAcknowledgeInitiate(row)}
                                  className="mt-3 w-full inline-flex items-center justify-center rounded-2xl bg-white border border-gray-200 text-gray-700 text-xs font-bold px-3 py-2 hover:bg-gray-100 transition-all"
                                >
                                  {acknowledgedNotes[row.student.id] ? 'Edit Note' : 'Acknowledge'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {acknowledgingStudent && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <form
                      onSubmit={handleAcknowledgeSubmit}
                      className="w-full max-w-md rounded-3xl bg-white border border-gray-200 p-6 shadow-2xl"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Acknowledge {acknowledgingStudent.student.full_name}</h3>
                          <p className="text-xs text-gray-500">Add an optional note for the acknowledgment.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAcknowledgeCancel}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          Close
                        </button>
                      </div>
                      <div className="mt-4">
                        <label className="block text-xs font-bold text-gray-700 mb-2">Note</label>
                        <textarea
                          value={acknowledgeNote}
                          onChange={(e) => setAcknowledgeNote(e.target.value)}
                          className="w-full min-h-[120px] rounded-2xl border border-gray-200 p-3 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
                          placeholder="Optional note about the acknowledgment"
                        />
                      </div>
                      <div className="mt-5 flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={handleAcknowledgeCancel}
                          className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                        >
                          Acknowledge
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col text-right">
              <span className="text-sm font-semibold text-gray-800">
                {user?.full_name || user?.username}
              </span>
              <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">
                {getRoleLabel()}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              {user?.first_name ? user.first_name[0].toUpperCase() : 'U'}
            </div>
          </div>
        </header>

        {/* Content body */}
        <main className="flex-grow overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
