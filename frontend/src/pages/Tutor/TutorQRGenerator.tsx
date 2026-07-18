import React, { useState, useEffect, useRef } from 'react';
import { academicService } from '../../services/academicService';
import { ArrowLeft, Clock, UserCheck, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import type { AralActivity, Attendance } from '../../types';

export const TutorQRGenerator: React.FC = () => {
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

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
          dark: '#312e81', // Indigo 900
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-2">
        <Link
          to="/tutor"
          className="text-gray-500 hover:text-indigo-600 inline-flex items-center text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Panel: Configuration & QR Display */}
        <div className="md:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Generate Student Attendance Session</h2>

            {!session && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Associate ARAL Activity (Optional)
                  </label>
                  <select
                    value={selectedActivity}
                    onChange={(e) => setSelectedActivity(e.target.value ? Number(e.target.value) : '')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                  >
                    <option value="">No linked activity (General attendance)</option>
                    {activities.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.student_name} - {act.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Expiration Duration
                  </label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(Number(e.target.value))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                  >
                    <option value={3}>3 Minutes</option>
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                  </select>
                </div>

                <button
                  onClick={generateStudentQR}
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
                >
                  {isLoading ? 'Creating session...' : 'Generate QR Code'}
                </button>
              </div>
            )}

            {session && (
              <div className="flex flex-col items-center py-4">
                {error && (
                  <div className="w-full mb-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg p-3">
                    {error}
                  </div>
                )}

                <div className="relative">
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <canvas ref={canvasRef} className="rounded-lg" />
                  </div>
                  {!session.is_active && (
                    <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center p-6 border border-gray-200">
                      <Clock className="w-10 h-10 text-red-500 mb-2" />
                      <h3 className="font-bold text-gray-900 text-sm">Expired</h3>
                      <button
                        onClick={() => setSession(null)}
                        className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all"
                      >
                        Reset Configuration
                      </button>
                    </div>
                  )}
                </div>

                {session.is_active && (
                  <div className="mt-6 space-y-4 w-full text-center">
                    <div className="flex items-center justify-center space-x-2 text-gray-600 font-semibold bg-gray-50 py-2 px-4 rounded-xl border border-gray-100 w-fit mx-auto">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs">Remaining:</span>
                      <span className="text-sm font-bold font-mono text-indigo-700">{formatTime(timeLeft)}</span>
                    </div>

                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800 text-left space-y-1">
                      {session.aral_activity_title && (
                        <p className="flex items-center">
                          <BookOpen className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                          <span className="font-semibold">Linked Activity:</span>&nbsp;{session.aral_activity_title}
                        </p>
                      )}
                      <p>
                        <span className="font-semibold">Session ID:</span> <code className="bg-indigo-100 px-1 rounded select-all">{session.id}</code>
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
            )}
          </div>
        </div>

        {/* Right Panel: Real-time scan list */}
        <div className="md:col-span-5">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 h-full flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-base">Check-in Feed</h3>
              <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold border border-indigo-100">
                {scannedStudents.length} Checked In
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {scannedStudents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                  <UserCheck className="w-12 h-12 text-gray-300 mb-2 stroke-[1.5]" />
                  <p className="text-sm font-medium">Waiting for scans...</p>
                  <p className="text-xs mt-1">Students will appear here instantly when they scan the QR code.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scannedStudents.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 animate-fadeIn"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-800">{log.user_name}</p>
                        <p className="text-xs text-gray-400">LRN: {log.user_lrn || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                          {log.time_in ? formatTimeString(log.time_in) : 'Logged'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Attendance History</h3>
                <p className="text-xs text-gray-500">Latest attendance records for all students.</p>
              </div>
              <span className="text-xs text-slate-500">Showing {attendanceHistory.length} records</span>
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
                      <th className="px-3 py-2 font-medium">Student</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Time In</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {attendanceHistory.map((log) => (
                      <tr key={log.id}>
                        <td className="px-3 py-2 text-sm text-slate-700 font-bold">{log.user_name}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatDateString(log.date)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700 font-mono">{formatTimeString(log.time_in)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{log.status_display}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{log.aral_activity_title || 'General'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
