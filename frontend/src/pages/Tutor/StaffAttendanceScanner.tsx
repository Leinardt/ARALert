import React, { useEffect, useRef, useState } from 'react';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';
import { ArrowLeft, Briefcase, Camera, Keyboard, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../../hooks/useAuth';
import { downloadPdf } from '../../utils/pdfExport';

export const StaffAttendanceScanner: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [selectedExportKey, setSelectedExportKey] = useState('');
  const [scanMode, setScanMode] = useState<'none' | 'camera' | 'text'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isPrincipalMonitor = user?.role === 'principal' || Boolean(user?.is_superuser);
  const isAttendanceReportView = location.pathname === '/staff/attendance';

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

        setAttendanceLogs(visibleLogs.sort((a, b) => {
          const dateA = getDateValue(a.date)?.getTime() ?? 0;
          const dateB = getDateValue(b.date)?.getTime() ?? 0;
          return dateB - dateA;
        }));
      } catch (err: any) {
        console.error(err);
        setLogsError('Failed to load attendance history.');
      } finally {
        setLogsLoading(false);
      }
    };

    fetchAttendanceLogs();
  }, [user, isPrincipalMonitor]);

  useEffect(() => {
    if (isAttendanceReportView || scanMode !== 'camera') {
      return;
    }

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
            false
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
  }, [isAttendanceReportView, scanMode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    submitScan(manualCode.trim());
    setManualCode('');
    setScanMode('none');
  };

  const getDateValue = (value: string | null | undefined) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
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

  const formatDuration = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) {
      return '—';
    }
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h ${remaining}m`;
  };

  const getDurationMinutes = (start?: string | null, end?: string | null) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
    const diff = (endDate.getTime() - startDate.getTime()) / 60000;
    return Math.max(0, Math.round(diff));
  };

  const getUndertimeMinutes = (log: Attendance) => {
    const expectedMinutes = log.role === 'tutor' ? 30 : 420;
    const morningMinutes = getDurationMinutes(log.morning_time_in, log.morning_time_out);
    const afternoonMinutes = getDurationMinutes(log.afternoon_time_in, log.afternoon_time_out);
    const totalMinutes = morningMinutes + afternoonMinutes;
    return Math.max(expectedMinutes - totalMinutes, 0);
  };

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekStart = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.getFullYear(), date.getMonth(), diff);
  };

  const dailyRows = attendanceLogs.reduce((acc, entry) => {
    const date = getDateValue(entry.date);
    if (!date) return acc;
    const key = formatDateKey(date);
    const current = acc.get(key) ?? [];
    current.push(entry);
    acc.set(key, current);
    return acc;
  }, new Map<string, Attendance[]>());

  const dailyExportRows = Array.from(dailyRows.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, entries]) => ({
      key,
      label: new Date(`${key}T00:00:00`).toLocaleDateString(),
      entries
    }));

  const weeklyRows = attendanceLogs.reduce((acc, entry) => {
    const date = getDateValue(entry.date);
    if (!date) return acc;
    const weekStart = getWeekStart(date);
    const key = formatDateKey(weekStart);
    const current = acc.get(key) ?? [];
    current.push(entry);
    acc.set(key, current);
    return acc;
  }, new Map<string, Attendance[]>());

  const weeklyExportRows = Array.from(weeklyRows.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, entries]) => {
      const startDate = new Date(`${key}T00:00:00`);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      return {
        key,
        label: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        entries
      };
    });

  useEffect(() => {
    if (viewMode === 'daily') {
      if (dailyExportRows.length > 0 && !dailyExportRows.some((row) => row.key === selectedExportKey)) {
        setSelectedExportKey(dailyExportRows[0].key);
      }
    } else if (weeklyExportRows.length > 0 && !weeklyExportRows.some((row) => row.key === selectedExportKey)) {
      setSelectedExportKey(weeklyExportRows[0].key);
    }
  }, [dailyExportRows, weeklyExportRows, selectedExportKey, viewMode]);

  const selectedRows = viewMode === 'daily'
    ? dailyExportRows.find((row) => row.key === selectedExportKey)?.entries ?? []
    : weeklyExportRows.find((row) => row.key === selectedExportKey)?.entries ?? [];

  const handleExportDtr = async () => {
    const rowsToExport = viewMode === 'daily'
      ? dailyExportRows.find((row) => row.key === selectedExportKey)
      : weeklyExportRows.find((row) => row.key === selectedExportKey);

    const exportRows = (rowsToExport?.entries ?? attendanceLogs).map((log) => ({
      'Staff Member': log.user_name || 'Unknown staff',
      Role: log.role || '—',
      Date: formatDateString(log.date),
      'AM Arrival': formatTimeString(log.morning_time_in ?? null),
      'AM Departure': formatTimeString(log.morning_time_out ?? null),
      'PM Arrival': formatTimeString(log.afternoon_time_in ?? null),
      'PM Departure': formatTimeString(log.afternoon_time_out ?? null),
      Undertime: formatDuration(getUndertimeMinutes(log)),
      Status: log.status_display || log.status,
      Signature: ''
    }));

    try {
      const XLSXModule = await import('xlsx');
      const XLSX = (XLSXModule as any).default ?? XLSXModule;
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Staff Attendance');
      const workbookOut = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([workbookOut], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `${viewMode === 'daily' ? 'staff-attendance-daily' : 'staff-attendance-weekly'}${rowsToExport ? `-${rowsToExport.key}` : ''}.xlsx`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export DTR attendance.', error);
      alert('Unable to export Excel file right now.');
    }
  };

  const handleExportDtrPdf = async () => {
    const rowsToExport = viewMode === 'daily'
      ? dailyExportRows.find((row) => row.key === selectedExportKey)
      : weeklyExportRows.find((row) => row.key === selectedExportKey);

    const rows = (rowsToExport?.entries ?? attendanceLogs).map((log) => [
      log.user_name || 'Unknown staff',
      log.role || '—',
      formatDateString(log.date),
      formatTimeString(log.morning_time_in ?? null),
      formatTimeString(log.morning_time_out ?? null),
      formatTimeString(log.afternoon_time_in ?? null),
      formatTimeString(log.afternoon_time_out ?? null),
      formatDuration(getUndertimeMinutes(log)),
      log.status_display || log.status
    ]);

    try {
      await downloadPdf(
        `${viewMode === 'daily' ? 'staff-attendance-daily' : 'staff-attendance-weekly'}${rowsToExport ? `-${rowsToExport.key}` : ''}.pdf`,
        `Staff Attendance ${viewMode === 'daily' ? 'Daily' : 'Weekly'}`,
        ['Staff Member', 'Role', 'Date', 'AM Arrival', 'AM Departure', 'PM Arrival', 'PM Departure', 'Undertime', 'Status'],
        rows
      );
    } catch (error) {
      console.error('Failed to export DTR PDF.', error);
      alert('Unable to export PDF file right now.');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center space-x-2">
        <Link
          to={`/${user?.role || 'tutor'}`}
          className="text-gray-500 hover:text-indigo-600 inline-flex items-center text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Workspace
        </Link>
      </div>

      {isAttendanceReportView ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-full">
              <Briefcase className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Staff Attendance Report</h2>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Review tutor and faculty clock-in and clock-out records, then export a DTR file for the selected day or week.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Standard shift schedule: Faculty AM 8:00–11:30, Faculty PM 1:00–4:30, Tutor PM 4:30–5:00.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${viewMode === 'daily' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500'}`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${viewMode === 'weekly' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500'}`}
              >
                Weekly
              </button>
            </div>
            <select
              value={selectedExportKey}
              onChange={(event) => setSelectedExportKey(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none"
            >
              {viewMode === 'daily' ? (
                dailyExportRows.map((row) => (
                  <option key={row.key} value={row.key}>{row.label}</option>
                ))
              ) : (
                weeklyExportRows.map((row) => (
                  <option key={row.key} value={row.key}>{row.label}</option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={handleExportDtr}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              Export DTR Excel
            </button>
            <button
              type="button"
              onClick={handleExportDtrPdf}
              className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Export DTR PDF
            </button>
          </div>

          {logsLoading ? (
            <div className="text-sm text-gray-500">Loading attendance records...</div>
          ) : logsError ? (
            <div className="text-sm text-red-600">{logsError}</div>
          ) : attendanceLogs.length === 0 ? (
            <div className="text-sm text-gray-500">No attendance records found yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 font-medium">Staff Member</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">AM Arrival</th>
                    <th className="px-3 py-2 font-medium">AM Departure</th>
                    <th className="px-3 py-2 font-medium">PM Arrival</th>
                    <th className="px-3 py-2 font-medium">PM Departure</th>
                    <th className="px-3 py-2 font-medium">Undertime</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {selectedRows.map((log) => (
                    <tr key={log.id}>
                      <td className="px-3 py-2 text-sm text-slate-700">{log.user_name || 'Unknown staff'}</td>
                      <td className="px-3 py-2 text-sm text-slate-700 capitalize">{log.role}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatDateString(log.date)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700 font-mono">{formatTimeString(log.morning_time_in ?? null)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700 font-mono">{formatTimeString(log.morning_time_out ?? null)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700 font-mono">{formatTimeString(log.afternoon_time_in ?? null)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700 font-mono">{formatTimeString(log.afternoon_time_out ?? null)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatDuration(getUndertimeMinutes(log))}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{log.status_display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
};
