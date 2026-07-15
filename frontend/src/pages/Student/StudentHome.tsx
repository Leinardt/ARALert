import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { StudentAcademicProfile } from '../../types';
import {
  GraduationCap,
  Calendar,
  BookOpen,
  AlertTriangle,
  Keyboard,
  Camera,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export const StudentHome: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scanner states
  const [scanMode, setScanMode] = useState<'none' | 'camera' | 'text'>('none');
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const fetchProfile = async () => {
    try {
      const data = await academicService.getMyProfile();
      setProfile(data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch academic details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Handle Scanning QR Code Success
  const handleScanSuccess = async (sessionId: string) => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch (err) {
        console.error(err);
      }
    }
    setScanMode('none');
    submitQRCode(sessionId);
  };

  // Submit scan to backend
  const submitQRCode = async (sessionId: string) => {
    setIsSubmittingCode(true);
    setScanResult(null);
    try {
      const res = await academicService.scanQRCode(sessionId);
      setScanResult({ type: 'success', message: res.message });
      fetchProfile();
    } catch (err: any) {
      console.error(err);
      setScanResult({
        type: 'error',
        message: err.response?.data?.error || 'Failed to record attendance. The QR code may be invalid or expired.'
      });
    } finally {
      setIsSubmittingCode(false);
    }
  };

  // Setup / teardown QR code camera scanner
  useEffect(() => {
    if (scanMode === 'camera') {
      // Give a tiny timeout to ensure the element #qr-reader is in the DOM
      const timer = setTimeout(() => {
        try {
          const scanner = new Html5QrcodeScanner(
            'qr-reader',
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
            },
            /* verbose= */ false
          );

          scannerRef.current = scanner;

          scanner.render(
            (decodedText) => {
              handleScanSuccess(decodedText);
            },
            () => {
              // Ignore scan errors as it scans continuously
            }
          );
        } catch (err) {
          console.error('Html5QrcodeScanner initialization failed', err);
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.clear().catch((err) => console.error('Failed to clear scanner', err));
          scannerRef.current = null;
        }
      };
    }
  }, [scanMode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    submitQRCode(manualCode.trim());
    setManualCode('');
    setScanMode('none');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
        {error || 'Profile could not be loaded.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Student Greeting card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Hello, {user?.first_name}!</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium">
            Student Academic & Attendance Dashboard. View your grades, verify logs, and check in.
          </p>
        </div>

        {/* Scan / Check-in triggers */}
        <div className="flex space-x-3 shrink-0">
          <button
            onClick={() => {
              setScanResult(null);
              setScanMode(scanMode === 'camera' ? 'none' : 'camera');
            }}
            className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4 mr-2" />
            Scan QR Code
          </button>
          <button
            onClick={() => {
              setScanResult(null);
              setScanMode(scanMode === 'text' ? 'none' : 'text');
            }}
            className="inline-flex items-center bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Keyboard className="w-4 h-4 mr-2" />
            Enter Code
          </button>
        </div>
      </div>

      {/* QR scanner interface */}
      {scanMode !== 'none' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 max-w-md mx-auto animate-slideDown">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 text-base">
              {scanMode === 'camera' ? 'Scan Attendance QR Code' : 'Enter Attendance Session Code'}
            </h3>
            <button
              onClick={() => setScanMode('none')}
              className="text-xs text-gray-400 hover:text-gray-600 font-bold"
            >
              Cancel
            </button>
          </div>

          {scanMode === 'camera' && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-950">
                <div id="qr-reader" className="w-full font-mono text-xs text-white" />
              </div>
              <p className="text-xs text-gray-400 text-center">
                Point your camera at the QR code generated by your tutor.
              </p>
            </div>
          )}

          {scanMode === 'text' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Session Token Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter session UUID"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-mono uppercase"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingCode}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                {isSubmittingCode ? 'Submitting...' : 'Record Attendance'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Scan Results Banner */}
      {scanResult && (
        <div className={`max-w-md mx-auto p-4 rounded-xl border flex items-start space-x-3 ${
          scanResult.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {scanResult.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-bold">{scanResult.type === 'success' ? 'Attendance Recorded' : 'Scan Failed'}</p>
            <p className="text-xs mt-0.5">{scanResult.message}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* GPA */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">General GPA</span>
            <p className="text-3xl font-extrabold text-gray-900">{profile.gpa !== null ? profile.gpa.toFixed(2) : 'N/A'}</p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Attendance Rate</span>
            <p className="text-3xl font-extrabold text-gray-900">{profile.attendance.attendance_rate}%</p>
          </div>
          <div className="p-3 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Active Intervention Activities */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Pending Interventions</span>
            <p className="text-3xl font-extrabold text-gray-900">
              {profile.aral_progress.activities.filter(a => a.status !== 'completed').length} Pending
            </p>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: GPA Subject Performance and Attendance list */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Quarterly Academic Grades</h3>
            {profile.grade_details.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No academic grades logged by your tutor yet.</p>
            ) : (
              <div className="overflow-x-auto border border-gray-150 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase">Subject</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Quarter</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Assessments</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Weekly Tasks</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-500 uppercase">Attendance</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500 uppercase">Final Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 bg-white">
                    {profile.grade_details.map((detail, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-sm font-bold text-gray-800">{detail.subject}</td>
                        <td className="px-4 py-2.5 text-center text-sm text-gray-600">Q{detail.quarter}</td>
                        <td className="px-4 py-2.5 text-center text-sm text-gray-600">{detail.assessment_avg}%</td>
                        <td className="px-4 py-2.5 text-center text-sm text-gray-600">{detail.weekly_task_avg}%</td>
                        <td className="px-4 py-2.5 text-center text-sm text-gray-600">{detail.attendance_avg}%</td>
                        <td className="px-4 py-2.5 text-right text-sm font-extrabold text-indigo-600">{detail.final_grade}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Attendance logs list */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Recent Attendance History</h3>
            {profile.attendance.logs.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No attendance scans recorded yet.</p>
            ) : (
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
                    {profile.attendance.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-sm font-bold text-gray-800">{log.date}</td>
                        <td className="px-4 py-2.5 text-center text-sm text-gray-600 font-mono">
                          {log.time_in ? new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center text-sm text-gray-600 font-mono">
                          {log.time_out ? new Date(log.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
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
            )}
          </div>
        </div>

        {/* Right column: Risk alerts list & ARAL Progress list */}
        <div className="space-y-6">
          {/* Risk Alerts */}
          {profile.academic_risks.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 space-y-3">
              <h3 className="font-extrabold text-red-800 text-sm flex items-center">
                <AlertTriangle className="w-5 h-5 mr-1.5 text-red-650" />
                Active Academic Risk Notices
              </h3>
              <div className="space-y-3">
                {profile.academic_risks.map((risk) => (
                  <div key={risk.id} className="p-3 bg-white/80 rounded-xl border border-red-100 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-red-700 uppercase">{risk.risk_level_display}</span>
                      <span className="text-[10px] text-gray-400 font-semibold">{new Date(risk.date_created).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-700 font-medium">{risk.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ARAL activities progress */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-base flex items-center border-b border-gray-100 pb-3">
              <BookOpen className="w-5 h-5 mr-2 text-indigo-600" />
              Intervention Activities
            </h3>

            {profile.aral_progress.activities.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No assigned activities.</p>
            ) : (
              <div className="space-y-3">
                {profile.aral_progress.activities.map((act) => (
                  <div key={act.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-gray-800 text-xs line-clamp-1">{act.title}</h4>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                        act.status === 'completed'
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : act.status === 'in_progress'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                      }`}>
                        {act.status_display}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{act.description}</p>
                    {act.remarks && (
                      <p className="text-[10px] text-gray-500 italic bg-white p-1 rounded font-mono">
                        Notes: {act.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
