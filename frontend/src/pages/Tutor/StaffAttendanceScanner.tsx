import React, { useState, useEffect, useMemo, useRef } from 'react';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';
import {
  Camera,
  Keyboard,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Download
} from 'lucide-react';
import { Link } from 'react-router-dom';
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

        setAttendanceLogs(isPrincipalMonitor ? visibleLogs : visibleLogs.slice(0, 20));
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
          // 1. Ask for camera permission FIRST. Until permission is granted,
          // Chrome/Edge return device labels as empty strings, which breaks
          // the "which camera is the built-in one" matching below. Requesting
          // access up front also lets us tell "permission denied" apart from
          // "no camera exists" instead of lumping both into one vague error.
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
            // We only needed this to trigger the permission prompt / unlock labels.
            permissionStream?.getTracks().forEach((track) => track.stop());
          }

          if (cancelled) return;

          // 2. Now enumerate — labels will be populated since permission is granted.
          const cameras = await Html5Qrcode.getCameras();

          if (!cameras || cameras.length === 0) {
            throw new Error('No camera was detected on this device.');
          }

          const preferredCamera =
            cameras.find((cam) =>
              /integrated|built-?in|webcam|front|user|face/i.test(cam.label)
            ) || cameras[0];

          // "ideal" degrades gracefully if the exact device becomes unavailable
          // (e.g. re-enumeration, unplugged/replugged, OS handing it to another app)
          // instead of throwing OverconstrainedError like "exact" does.
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
            /* verbose= */ false
          );

          scannerRef.current = scanner;

          scanner.render(
            (decodedText) => {
              void handleScanSuccess(decodedText);
            },
            () => {
              // Ignore non-fatal per-frame scan errors (no QR in view yet).
            }
          );
        } catch (err: any) {
          if (!cancelled) {
            console.error(err);
            setCameraError(
              err?.message ||
                'Unable to access your laptop camera. Please allow camera permission and try again.'
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
          className="text-gray-500 hover:text-[var(--brand)] inline-flex items-center text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Workspace
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden p-8 flex flex-col items-center">
        <div className="text-center space-y-2 mb-6">
          <div className="p-3 bg-[var(--brand-light)] text-[var(--brand)] border border-[var(--brand-border)] rounded-full w-fit mx-auto">
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
            className={`flex-1 py-2.5 text-center font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              scanMode === 'text'
                ? 'bg-[var(--brand)] text-white'
                : 'bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Enter Session Code</span>
          </button>
        </div>

        {scanMode === 'camera' && (
          <div className="w-full space-y-4">
            {cameraError ? (
              <div className="max-w-sm mx-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {cameraError}
              </div>
            ) : null}
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
              className="w-full bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              {isSubmitting ? 'Confirming...' : 'Log Time Entry'}
            </button>
          </form>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{isPrincipalMonitor ? 'Tutor & Faculty DTR' : 'My Daily Time Record'}</h3>
            <p className="text-xs text-gray-500">
              {isPrincipalMonitor
                ? 'DTR view for recent tutor and faculty attendance.'
                : 'Your attendance punches in DTR format.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isPrincipalMonitor && (
              <button
                type="button"
                onClick={() => setShowDtrExportModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-bold text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" />
                Export DTR
              </button>
            )}
            <span className="text-xs text-slate-500">{dtrRows.length} day{dtrRows.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        {logsLoading ? (
          <div className="text-sm text-gray-500">Loading clock history...</div>
        ) : logsError ? (
          <div className="text-sm text-red-600">{logsError}</div>
        ) : attendanceLogs.length === 0 ? (
          <div className="text-sm text-gray-500">No clock history found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] divide-y divide-gray-200 text-center text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  {isPrincipalMonitor && <th className="px-3 py-2 font-medium text-left" rowSpan={2}>Staff Member</th>}
                  {isPrincipalMonitor && <th className="px-3 py-2 font-medium" rowSpan={2}>Role</th>}
                  <th className="px-3 py-2 font-medium" rowSpan={2}>Date</th>
                  <th className="px-3 py-2 font-medium border-x border-gray-200" colSpan={2}>AM</th>
                  <th className="px-3 py-2 font-medium border-r border-gray-200" colSpan={2}>PM</th>
                  <th className="px-3 py-2 font-medium" rowSpan={2}>Undertime</th>
                  <th className="px-3 py-2 font-medium" rowSpan={2}>Status</th>
                </tr>
                <tr>
                  <th className="px-3 py-2 font-medium border-l border-gray-200">Arrival</th>
                  <th className="px-3 py-2 font-medium border-r border-gray-200">Departure</th>
                  <th className="px-3 py-2 font-medium">Arrival</th>
                  <th className="px-3 py-2 font-medium border-r border-gray-200">Departure</th>
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

                  return <tr key={`${log.user}-${log.date}`}>
                    {isPrincipalMonitor && <td className="px-3 py-2 text-left text-slate-700">{log.user_name || 'Unknown staff'}</td>}
                    {isPrincipalMonitor && <td className="px-3 py-2 text-slate-700 capitalize">{log.role}</td>}
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{formatDateString(log.date)}</td>
                    <td className="px-3 py-2 text-slate-700 font-medium border-l border-gray-100 whitespace-nowrap">{formatDtrTime(arrivalAm)}</td>
                    <td className="px-3 py-2 text-slate-700 font-medium border-r border-gray-100 whitespace-nowrap">{formatDtrTime(departureAm)}</td>
                    <td className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap">{formatDtrTime(arrivalPm)}</td>
                    <td className="px-3 py-2 text-slate-700 font-medium border-r border-gray-100 whitespace-nowrap">{formatDtrTime(departurePm)}</td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{undertime}</td>
                    <td className="px-3 py-2 text-slate-700">{log.status_display}</td>
                  </tr>;
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
