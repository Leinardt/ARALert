import React, { useState, useEffect, useRef } from 'react';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';
import {
  Camera,
  Keyboard,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Briefcase
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../../hooks/useAuth';

export const StaffAttendanceScanner: React.FC = () => {
  const { user } = useAuth();
  const [scanMode, setScanMode] = useState<'none' | 'camera' | 'text'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isPrincipalMonitor = user?.role === 'principal' || Boolean(user?.is_superuser);

  const handleScanSuccess = async (sessionId: string) => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch (err) {
        console.error(err);
      }
    }
    setScanMode('none');
    submitScan(sessionId);
  };

  const submitScan = async (sessionId: string) => {
    setIsSubmitting(true);
    setScanResult(null);
    try {
      const res = await academicService.scanQRCode(sessionId);
      setScanResult({ type: 'success', message: res.message });
      if (user) {
        const logs = await academicService.getAttendanceHistory({ user_id: user.id });
        setAttendanceLogs(logs.slice(0, 10));
      }
    } catch (err: any) {
      console.error(err);
      setScanResult({
        type: 'error',
        message: err.response?.data?.error || 'Clock check-in failed. Please verify the QR session validity.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchAttendanceLogs = async () => {
      if (!user) return;
      setLogsLoading(true);
      setLogsError(null);

      try {
        const logs = isPrincipalMonitor
          ? await academicService.getAttendanceHistory()
          : await academicService.getAttendanceHistory({ user_id: user.id });

        const visibleLogs = isPrincipalMonitor
          ? logs.filter((log) => ['tutor', 'faculty'].includes(log.role))
          : logs;

        setAttendanceLogs(visibleLogs.slice(0, 20));
      } catch (err: any) {
        console.error(err);
        setLogsError('Failed to load clock history.');
      } finally {
        setLogsLoading(false);
      }
    };

    fetchAttendanceLogs();
  }, [user, isPrincipalMonitor]);

  useEffect(() => {
    if (scanMode === 'camera') {
      const timer = setTimeout(() => {
        const initScanner = async () => {
          try {
            const cameras = await Html5Qrcode.getCameras();
            let videoConstraints: any = { facingMode: 'environment' };

            if (cameras && cameras.length > 0) {
              const preferredCamera = cameras.find((cam) =>
                /integrated|webcam|camera|front|back/i.test(cam.label)
              );
              const selectedCameraId = preferredCamera?.id || cameras[0].id;
              videoConstraints = { deviceId: { exact: selectedCameraId } };
            }

            const scanner = new Html5QrcodeScanner(
              'staff-qr-reader',
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                videoConstraints
              },
              /* verbose= */ false
            );
            scannerRef.current = scanner;

            scanner.render(
              (decodedText) => {
                handleScanSuccess(decodedText);
              },
              () => {
                // Ignore scan errors
              }
            );
          } catch (err) {
            console.error(err);
          }
        };

        initScanner();
      }, 100);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.clear().catch((err) => console.error(err));
          scannerRef.current = null;
        }
      };
    }
  }, [scanMode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    submitScan(manualCode.trim());
    setManualCode('');
    setScanMode('none');
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

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center space-x-2">
        <Link
          to={`/${user?.role || 'tutor'}`}
          className="text-gray-500 hover:text-indigo-600 inline-flex items-center text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Workspace
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden p-8 flex flex-col items-center">
        <div className="text-center space-y-2 mb-6">
          <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full w-fit mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Staff Clock-In / Clock-Out Scanner</h2>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Scan the QR code generated by the administrator to log your Time In or Time Out for today.
          </p>
        </div>

        {/* Scan Results Banner */}
        {scanResult && (
          <div className={`w-full mb-6 p-4 rounded-xl border flex items-start space-x-3 text-left ${
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
              <p className="text-sm font-bold">{scanResult.type === 'success' ? 'Clock Successful' : 'Error Clocking In/Out'}</p>
              <p className="text-xs mt-0.5">{scanResult.message}</p>
            </div>
          </div>
        )}

        {/* Navigation toggles */}
        <div className="flex border border-gray-200 rounded-xl overflow-hidden w-full mb-6">
          <button
            onClick={() => {
              setScanResult(null);
              setScanMode('camera');
            }}
            className={`flex-1 py-2.5 text-center font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              scanMode === 'camera'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Use Camera</span>
          </button>
          <button
            onClick={() => {
              setScanResult(null);
              setScanMode('text');
            }}
            className={`flex-1 py-2.5 text-center font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              scanMode === 'text'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Enter Session Code</span>
          </button>
        </div>

        {scanMode === 'camera' && (
          <div className="w-full space-y-4">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-950 max-w-sm mx-auto">
              <div id="staff-qr-reader" className="w-full font-mono text-xs text-white" />
            </div>
          </div>
        )}

        {scanMode === 'text' && (
          <form onSubmit={handleManualSubmit} className="w-full space-y-4 max-w-sm">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Admin Session Code Token
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
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              {isSubmitting ? 'Confirming...' : 'Log Time Entry'}
            </button>
          </form>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{isPrincipalMonitor ? 'Tutor & Faculty Attendance History' : 'Clock History'}</h3>
            <p className="text-xs text-gray-500">
              {isPrincipalMonitor
                ? 'Monitor recent tutor and faculty clock-in and clock-out activity.'
                : 'Recent staff clock-in and clock-out scan records.'}
            </p>
          </div>
          <span className="text-xs text-slate-500">{attendanceLogs.length} entries</span>
        </div>

        {logsLoading ? (
          <div className="text-sm text-gray-500">Loading clock history...</div>
        ) : logsError ? (
          <div className="text-sm text-red-600">{logsError}</div>
        ) : attendanceLogs.length === 0 ? (
          <div className="text-sm text-gray-500">No clock history found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Staff Member</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Time In</th>
                  <th className="px-3 py-2 font-medium">Time Out</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {attendanceLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2 text-sm text-slate-700">{log.user_name || 'Unknown staff'}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 capitalize">{log.role}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{formatDateString(log.date)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 font-mono">{formatTimeString(log.time_in)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700 font-mono">{formatTimeString(log.time_out)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{log.status_display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
