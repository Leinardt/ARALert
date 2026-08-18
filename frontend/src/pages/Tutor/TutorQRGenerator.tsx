import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import { ArrowLeft, Clock, UserCheck, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import type { AralActivity, Attendance, User } from '../../types';
import { ExportAttendanceModal } from '../../components/ExportAttendanceModal';

export const TutorQRGenerator: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [activities, setActivities] = useState<AralActivity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<number | ''>('');
  const [expiresIn, setExpiresIn] = useState<number>(5);
  const [session, setSession] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [scannedStudents, setScannedStudents] = useState<Attendance[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([]);
  const [attendanceHistoryLoading, setAttendanceHistoryLoading] = useState<boolean>(true);
  const [attendanceHistoryError, setAttendanceHistoryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch tutor's assigned students for attendance export sheet
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        if (!user) return;
        const res = await userService.getUsers({ role: 'student' });
        setStudents(Array.isArray(res.results) ? res.results : Array.isArray(res as any) ? (res as any) : []);
      } catch (err) {
        console.error('Failed to load students for export', err);
      }
    };
    fetchStudents();
  }, [user]);

  // Fetch tutor's active activities to associate with the QR code if they want
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const data = await academicService.getAralActivities({ status: 'in_progress' });
        setActivities(data);
      } catch (err) {
        console.error('Failed to load activities', err);
      }
    };
    fetchActivities();
  }, []);

  useEffect(() => {
    const fetchAttendanceHistory = async () => {
      setAttendanceHistoryLoading(true);
      setAttendanceHistoryError(null);
      try {
        const logs = await academicService.getAttendanceHistory();
        setAttendanceHistory(logs.slice(0, 25));
      } catch (err: any) {
        console.error('Failed to load attendance history', err);
        setAttendanceHistoryError(err.response?.data?.error || 'Failed to load attendance history.');
      } finally {
        setAttendanceHistoryLoading(false);
      }
    };

    fetchAttendanceHistory();
  }, []);

  const generateStudentQR = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);

      const payload: any = {
        session_type: 'student',
        expires_in_minutes: expiresIn,
      };
      if (selectedActivity) {
        payload.aral_activity_id = selectedActivity;
      }

      const newSession = await academicService.createAttendanceSession(payload);
      setSession(newSession);
      setTimeLeft(newSession.time_left || (expiresIn * 60));
      setScannedStudents([]);

      // Start Countdown Timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            if (pollRef.current) clearInterval(pollRef.current);
            setSession((curr: any) => curr ? { ...curr, is_active: false } : null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start Polling for Scans
      startPolling(newSession.id);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to generate QR session.');
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = (sessionId: string) => {
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    pollRef.current = setInterval(async () => {
      try {
        const logs = await academicService.getAttendanceHistory({ date: todayStr });
        const sessionScans = logs.filter(log => log.session === sessionId);
        setScannedStudents(sessionScans);
      } catch (err) {
        console.error('Error polling attendance logs:', err);
      }
    }, 3000); // Poll every 3 seconds
  };

  const formatDateString = (value: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimeString = (value: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Render QR Code canvas
  useEffect(() => {
    if (session && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, session.id, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }, (err) => {
        if (err) console.error('QR Render Error:', err);
      });
    }
  }, [session]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <div className="h-full rounded-3xl border border-gray-200 bg-white p-4 shadow-lg sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Attendance Session</p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">GENERATE STUDENT QR CODE</h2>
              </div>
              {session && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    session.is_active
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {session.is_active ? 'Active' : 'Expired'}
                </span>
              )}
            </div>

            {!session && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-3.5">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                   Select Duration
                  </label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(Number(e.target.value))}
                    className="block w-full px-3 py-2.5 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-[var(--brand)] focus:border-[var(--brand)] sm:text-sm bg-white"
                  >
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                  </select>
                </div>

                <button
                  onClick={generateStudentQR}
                  disabled={isLoading}
                  className="w-full bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white py-2.5 rounded-2xl text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating session...' : 'Generate QR Code'}
                </button>
              </div>
            )}

            {session && (
              <div className="flex flex-col items-center py-2">
                {error && (
                  <div className="w-full mb-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl p-3">
                    {error}
                  </div>
                )}

                <div className="mx-auto w-full max-w-[420px]">
                  <div className="relative flex min-h-[360px] items-center justify-center">
                    <div className="flex h-[300px] w-[300px] items-center justify-center rounded-[28px] border border-[var(--brand-border)] bg-[var(--brand-light)]/60 p-3 shadow-inner sm:h-[330px] sm:w-[330px]">
                      <canvas ref={canvasRef} className="block h-full w-full rounded-[20px] bg-white p-2" />
                    </div>
                    {!session.is_active && (
                      <div className="absolute inset-0 bg-white/95 rounded-[28px] flex flex-col items-center justify-center p-6 border border-gray-200">
                        <Clock className="w-10 h-10 text-red-500 mb-2" />
                        <h3 className="font-bold text-gray-900 text-sm">Expired</h3>
                        <button
                          onClick={() => setSession(null)}
                          className="mt-4 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl text-xs font-semibold transition-all"
                        >
                          Reset Configuration
                        </button>
                      </div>
                    )}
                  </div>

                  {session.is_active && (
                    <div className="mt-6 space-y-4 w-full text-center">
                      <div className="flex items-center justify-center space-x-2 text-gray-600 font-semibold bg-gray-50 py-2.5 px-4 rounded-2xl border border-gray-100 w-fit mx-auto shadow-sm">
                        <Clock className="w-4 h-4 text-[var(--brand)]" />
                        <span className="text-xs">Remaining</span>
                        <span className="text-sm font-bold font-mono text-[var(--brand-dark)]">{formatTime(timeLeft)}</span>
                      </div>

                      <div className="bg-[var(--brand-light)]/60 border border-[var(--brand-border)] rounded-2xl p-4 text-xs text-[var(--brand-text)] text-left space-y-2 shadow-sm">
                        {session.aral_activity_title && (
                          <p className="flex items-center">
                            <BookOpen className="w-3.5 h-3.5 mr-1.5 text-[var(--brand)]" />
                            <span className="font-semibold">Linked Activity:</span>&nbsp;{session.aral_activity_title}
                          </p>
                        )}
                        <p className="break-all">
                          <span className="font-semibold">Session ID:</span>{' '}
                          <code className="bg-white/80 px-1.5 py-0.5 rounded select-all">{session.id}</code>
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          if (timerRef.current) clearInterval(timerRef.current);
                          if (pollRef.current) clearInterval(pollRef.current);
                          setSession(null);
                        }}
                        className="text-gray-500 hover:text-gray-800 text-xs font-bold transition-colors"
                      >
                        Cancel & Close Session
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="flex h-full min-h-[440px] flex-col rounded-3xl border border-gray-200 bg-white p-5 shadow-lg sm:p-6">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Live Status</p>
                <h3 className="font-bold text-gray-900 text-lg mt-1">CHECK-IN FEED</h3>
              </div>
              <span className="bg-[var(--brand-light)] text-[var(--brand-dark)] text-xs px-2.5 py-1 rounded-full font-bold border border-[var(--brand-border)]">
                {scannedStudents.length} Checked In
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {scannedStudents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                  <UserCheck className="w-12 h-12 text-gray-300 mb-2 stroke-[1.5]" />
                  <p className="text-sm font-medium text-gray-600">Waiting for scans...</p>
                  <p className="text-xs mt-1 max-w-xs">Students will appear here as soon as they scan the QR code.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scannedStudents.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-800">{log.user_name}</p>
                        <p className="text-xs text-gray-400">LRN: {log.user_lrn || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                          {log.time_in ? formatTimeString(log.time_in) : 'Logged'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Records</p>
            <h3 className="font-bold text-gray-900 text-lg mt-1">ATTENDANCE HISTORY</h3>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              📊 Export Attendance Sheet
            </button>
            <span className="text-xs text-slate-500">Showing {attendanceHistory.length} records</span>
          </div>
        </div>

        {attendanceHistoryLoading ? (
          <div className="text-sm text-gray-500">Loading attendance history...</div>
        ) : attendanceHistoryError ? (
          <div className="text-sm text-red-600">{attendanceHistoryError}</div>
        ) : attendanceHistory.length === 0 ? (
          <div className="text-sm text-gray-500">No attendance history found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Student</th>
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Time In</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {attendanceHistory.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2.5 text-sm text-slate-700 font-bold">{log.user_name}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-700">{formatDateString(log.date)}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-700 font-mono">{formatTimeString(log.time_in)}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-700">{log.status_display}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-700">{log.aral_activity_title || 'General'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExportAttendanceModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentUser={user}
        students={students}
        attendanceLogs={attendanceHistory}
      />
    </div>
  );
};
