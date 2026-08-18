import React, { useState, useEffect, useMemo, useRef } from 'react';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';
import {
  Camera,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Download,
  Clock,
  ClipboardCheck,
  Calendar
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../../hooks/useAuth';
import { ExportDtrModal } from '../../components/ExportDtrModal';

const formatDtrTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const match = value.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? 'PM' : 'AM'}`;
};

const timeToMinutes = (value: string | null | undefined) => {
  const match = value?.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export const StaffAttendanceScanner: React.FC = () => {
  const { user } = useAuth();
  const [scanMode, setScanMode] = useState<'none' | 'camera' | 'text'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDtrExportModal, setShowDtrExportModal] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isPrincipalMonitor = user?.role === 'principal' || Boolean(user?.is_superuser);

  const todayStr = new Date().toLocaleDateString('en-CA');

  const dtrRows = useMemo(() => {
    const rows = new Map<string, Attendance>();
    attendanceLogs.forEach((log) => {
      const key = `${log.user}-${log.date}`;
      const existing = rows.get(key);
      if (!existing) {
        rows.set(key, { ...log });
        return;
      }
      (['arrival_am', 'departure_am', 'arrival_pm', 'departure_pm'] as const).forEach((field) => {
        if (!existing[field] && log[field]) existing[field] = log[field];
      });
    });
    return Array.from(rows.values());
  }, [attendanceLogs]);

  // Today's punch logic
  const todayLog = useMemo(() => {
    return attendanceLogs.find((l) => l.date === todayStr && String(l.user) === String(user?.id));
  }, [attendanceLogs, todayStr, user]);

  // Monthly stats calculation
  const monthStats = useMemo(() => {
    const currentMonth = todayStr.slice(0, 7); // YYYY-MM
    const myLogs = dtrRows.filter((l) => l.date.startsWith(currentMonth) && (!user || String(l.user) === String(user.id)));
    const daysPresent = myLogs.filter((l) => l.status === 'present' || l.status === 'late').length;

    let totalUndertimeMins = 0;
    myLogs.forEach((l) => {
      const legacyOut = timeToMinutes(l.time_out);
      const departurePm = l.departure_pm || (legacyOut !== null && legacyOut >= 720 ? l.time_out : null);
      const mins = timeToMinutes(departurePm);
      if (mins !== null && mins < 1020) { // before 5:00 PM
        totalUndertimeMins += (1020 - mins);
      }
    });

    const undertimeHours = Math.floor(totalUndertimeMins / 60);
    const undertimeMins = totalUndertimeMins % 60;
    const undertimeStr = totalUndertimeMins > 0 ? `${undertimeHours}h ${undertimeMins}m` : '0m';

    return { daysPresent, undertimeStr, totalDays: myLogs.length };
  }, [dtrRows, todayStr, user]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch (err) {
        console.error(err);
      }
      scannerRef.current = null;
    }
  };

  const handleScanSuccess = async (sessionId: string) => {
    await stopScanner();
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
        const logs = isPrincipalMonitor
          ? await academicService.getAttendanceHistory()
          : await academicService.getAttendanceHistory({ user_id: user.id });
        setAttendanceLogs(logs);
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

        setAttendanceLogs(isPrincipalMonitor ? visibleLogs : visibleLogs);
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
    if (scanMode !== 'camera') {
      setCameraError(null);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      const initScanner = async () => {
        setCameraError(null);
        await stopScanner();

        try {
          let permissionStream: MediaStream | null = null;
          try {
            permissionStream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (permErr: any) {
            if (permErr?.name === 'NotAllowedError' || permErr?.name === 'PermissionDeniedError') {
              throw new Error('Camera permission was denied. Please allow camera access in your browser settings and try again.');
            }
            if (permErr?.name === 'NotFoundError') {
              throw new Error('No camera was detected on this device.');
            }
            throw permErr;
          } finally {
            permissionStream?.getTracks().forEach((track) => track.stop());
          }

          if (cancelled) return;

          const cameras = await Html5Qrcode.getCameras();

          if (!cameras || cameras.length === 0) {
            throw new Error('No camera was detected on this device.');
          }

          const preferredCamera =
            cameras.find((cam) =>
              /integrated|built-?in|webcam|front|user|face/i.test(cam.label)
            ) || cameras[0];

          const videoConstraints: any = {
            deviceId: { ideal: preferredCamera.id },
            facingMode: 'user'
          };

          const scanner = new Html5QrcodeScanner(
            'staff-qr-reader',
            {
              fps: 10,
              qrbox: { width: 240, height: 240 },
              aspectRatio: 1.0,
              disableFlip: true,
              showTorchButtonIfSupported: true,
              videoConstraints
            },
            false
          );

          scannerRef.current = scanner;

          scanner.render(
            (decodedText) => {
              void handleScanSuccess(decodedText);
            },
            () => {}
          );
        } catch (err: any) {
          if (!cancelled) {
            console.error(err);
            setCameraError(
              err?.message ||
              'Unable to access your camera. Please allow camera permission and try again.'
            );
          }
        }
      };

      void initScanner();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void stopScanner();
    };
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

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setManualCode(text.trim());
    } catch (err) {
      console.error('Clipboard paste failed:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Today's Clock-in Banner */}
      {!isPrincipalMonitor && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm ${
          todayLog ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              todayLog ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
            }`}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider font-bold opacity-75">Today's Clock Status</p>
              <p className="text-sm font-bold">
                {todayLog
                  ? `Clocked In today at ${formatDtrTime(todayLog.time_in)}`
                  : 'Not clocked in yet today'}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold opacity-75">{new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      )}

      {/* Summary Stats Strip */}
      {!isPrincipalMonitor && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Days Present This Month</p>
              <p className="text-xl font-extrabold text-gray-900">{monthStats.daysPresent} <span className="text-xs font-normal text-gray-400">/ {monthStats.totalDays} logged</span></p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Total Undertime This Month</p>
              <p className="text-xl font-extrabold text-gray-900">{monthStats.undertimeStr}</p>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Box */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden p-6 flex flex-col items-center">
        <div className="text-center space-y-1 mb-5">
          <div className="p-3 bg-[var(--brand-light)] text-[var(--brand)] border border-[var(--brand-border)] rounded-full w-fit mx-auto mb-2">
            <Briefcase className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">STAFF CLOCK-IN / CLOCK-OUT SCANNER</h2>
          <p className="text-xs text-gray-400">Scan admin QR code or enter session token to register punch</p>
        </div>

        {/* Scan Results Banner */}
        {scanResult && (
          <div className={`w-full mb-5 p-4 rounded-xl border flex items-start space-x-3 text-left ${scanResult.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
            {scanResult.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-bold">{scanResult.type === 'success' ? 'Clock Successful' : 'Error Clocking In/Out'}</p>
              <p className="text-xs mt-0.5">{scanResult.message}</p>
            </div>
          </div>
        )}

        {/* Navigation toggles */}
        <div className="flex border border-gray-200 rounded-xl overflow-hidden w-full max-w-sm mb-5">
          <button
            onClick={() => {
              setScanResult(null);
              setScanMode('camera');
            }}
            className={`flex-1 py-2.5 text-center font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${scanMode === 'camera'
              ? 'bg-[var(--brand)] text-white'
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
            className={`flex-1 py-2.5 text-center font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${scanMode === 'text'
              ? 'bg-[var(--brand)] text-white'
              : 'bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Enter Session Code</span>
          </button>
        </div>

        {scanMode === 'camera' && (
          <div className="w-full space-y-4 max-w-sm">
            {cameraError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                {cameraError}
              </div>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-950">
              <div id="staff-qr-reader" className="w-full font-mono text-xs text-white" />
            </div>
          </div>
        )}

        {scanMode === 'text' && (
          <form onSubmit={handleManualSubmit} className="w-full space-y-4 max-w-sm">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700">
                  Admin Session Code Token
                </label>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-[11px] font-semibold text-[var(--brand)] hover:underline flex items-center gap-1"
                >
                  📋 Paste Code
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="Enter session UUID (e.g. 550e8400-e29b...)"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm bg-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
              />
              <p className="text-[10px] text-gray-400 mt-1">Expected 36-character session token from Admin QR</p>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-70"
            >
              {isSubmitting ? 'Confirming...' : 'Log Time Entry'}
            </button>
          </form>
        )}
      </div>

      {/* DTR Records Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{isPrincipalMonitor ? 'Tutor & Faculty DTR' : 'My Daily Time Record (DTR)'}</h3>
            <p className="text-xs text-gray-500">
              {isPrincipalMonitor
                ? 'DTR view for recent tutor and faculty attendance.'
                : 'Your official daily attendance punches.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isPrincipalMonitor && (
              <button
                type="button"
                onClick={() => setShowDtrExportModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand)] px-3 py-2 text-xs font-bold text-white transition hover:bg-[var(--brand-dark)] shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                Export DTR
              </button>
            )}
            <span className="text-xs text-slate-500">{dtrRows.length} day{dtrRows.length === 1 ? '' : 's'} recorded</span>
          </div>
        </div>

        {logsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : logsError ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">{logsError}</div>
        ) : attendanceLogs.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">No clock history found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] divide-y divide-gray-200 text-center text-sm border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  {isPrincipalMonitor && <th className="px-3 py-2.5 font-semibold text-left" rowSpan={2}>Staff Member</th>}
                  {isPrincipalMonitor && <th className="px-3 py-2.5 font-semibold" rowSpan={2}>Role</th>}
                  <th className="px-3 py-2.5 font-semibold" rowSpan={2}>Date</th>
                  <th className="px-3 py-2 font-semibold bg-indigo-50/70 border-x border-indigo-100 text-indigo-900" colSpan={2}>MORNING (AM)</th>
                  <th className="px-3 py-2 font-semibold bg-violet-50/70 border-r border-violet-100 text-violet-900" colSpan={2}>AFTERNOON (PM)</th>
                  <th className="px-3 py-2.5 font-semibold" rowSpan={2}>Undertime</th>
                  <th className="px-3 py-2.5 font-semibold" rowSpan={2}>Status</th>
                </tr>
                <tr>
                  <th className="px-3 py-2 font-medium bg-indigo-50/40 border-l border-indigo-100">Arrival</th>
                  <th className="px-3 py-2 font-medium bg-indigo-50/40 border-r border-indigo-100">Departure</th>
                  <th className="px-3 py-2 font-medium bg-violet-50/40">Arrival</th>
                  <th className="px-3 py-2 font-medium bg-violet-50/40 border-r border-violet-100">Departure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {dtrRows.map((log) => {
                  const legacyIn = timeToMinutes(log.time_in);
                  const legacyOut = timeToMinutes(log.time_out);
                  const arrivalAm = log.arrival_am || (legacyIn !== null && legacyIn < 720 ? log.time_in : null);
                  const departureAm = log.departure_am || (legacyOut !== null && legacyOut < 720 ? log.time_out : null);
                  const arrivalPm = log.arrival_pm || (legacyIn !== null && legacyIn >= 720 ? log.time_in : null);
                  const departurePm = log.departure_pm || (legacyOut !== null && legacyOut >= 720 ? log.time_out : null);
                  const departureMinutes = timeToMinutes(departurePm);
                  const undertime = departureMinutes !== null && departureMinutes < 1020
                    ? `${Math.floor((1020 - departureMinutes) / 60)}h ${(1020 - departureMinutes) % 60}m`
                    : '—';

                  const statusBadge = (s: string, display: string) => {
                    if (s === 'present') return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">Present</span>;
                    if (s === 'late') return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">Late</span>;
                    return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">{display}</span>;
                  };

                  return (
                    <tr key={`${log.user}-${log.date}`} className="hover:bg-slate-50/80 transition-colors">
                      {isPrincipalMonitor && <td className="px-3 py-2.5 text-left text-slate-800 font-semibold">{log.user_name || 'Unknown staff'}</td>}
                      {isPrincipalMonitor && <td className="px-3 py-2.5 text-slate-600 capitalize text-xs">{log.role}</td>}
                      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap text-xs">{formatDateString(log.date)}</td>
                      <td className="px-3 py-2.5 text-slate-800 font-mono text-xs bg-indigo-50/20 border-l border-indigo-50 whitespace-nowrap">{formatDtrTime(arrivalAm)}</td>
                      <td className="px-3 py-2.5 text-slate-800 font-mono text-xs bg-indigo-50/20 border-r border-indigo-50 whitespace-nowrap">{formatDtrTime(departureAm)}</td>
                      <td className="px-3 py-2.5 text-slate-800 font-mono text-xs bg-violet-50/20 whitespace-nowrap">{formatDtrTime(arrivalPm)}</td>
                      <td className="px-3 py-2.5 text-slate-800 font-mono text-xs bg-violet-50/20 border-r border-violet-50 whitespace-nowrap">{formatDtrTime(departurePm)}</td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap text-xs">{undertime}</td>
                      <td className="px-3 py-2.5">{statusBadge(log.status, log.status_display)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {isPrincipalMonitor && <ExportDtrModal isOpen={showDtrExportModal} onClose={() => setShowDtrExportModal(false)} currentUser={user} attendanceLogs={attendanceLogs} />}
    </div>
  );
};
