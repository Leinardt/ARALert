import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';
import {
  Camera,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  Download,
  Clock,
  ClipboardCheck,
  Calendar,
  CalendarDays,
  ScanLine,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  X,
  UserCheck,
  Play,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../../hooks/useAuth';
import { ExportDtrModal } from '../../components/ExportDtrModal';
import { compareNamesByLastName } from '../../utils/studentFormatters';

/* ─────────────────────────── helpers ─────────────────────────── */

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

const formatDateString = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year} | ${weekday}`;
};

// Tutor schedule: Time In = 4:30 PM (16:30), Time Out = 5:00 PM (17:00)
const TUTOR_TIME_IN_MINS = 16 * 60 + 30;  // 4:30 PM
const TUTOR_TIME_OUT_MINS = 17 * 60 + 0;  // 5:00 PM

const getTutorStatus = (timeInMins: number | null, timeOutMins: number | null): 'Completed' | 'Late' | 'Early Out' | '—' => {
  if (timeInMins === null && timeOutMins === null) return '—';
  if (timeInMins !== null && timeInMins > TUTOR_TIME_IN_MINS) return 'Late';
  if (timeOutMins !== null && timeOutMins < TUTOR_TIME_OUT_MINS) return 'Early Out';
  if (timeInMins !== null || timeOutMins !== null) return 'Completed';
  return '—';
};

const getUndertimeStr = (timeOutMins: number | null): string => {
  if (timeOutMins === null || timeOutMins >= TUTOR_TIME_OUT_MINS) return '—';
  const diff = TUTOR_TIME_OUT_MINS - timeOutMins;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/* ─── Custom Calendar Dropdown ────────────────────────────────── */
const formatDateKey = (year: number, month: number, day: number) => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

const CustomCalendarDropdown: React.FC<{
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onClear: () => void;
  onClose: () => void;
  loggedDates: Set<string>;
  className?: string;
}> = ({ selectedDate, onSelectDate, onClear, onClose, loggedDates, className }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00');
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div
      ref={dropdownRef}
      className={`${className || 'absolute right-0 top-full mt-2'} z-[60] w-72 rounded-lg border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 shadow-xl select-none text-slate-800 dark:text-slate-100`}
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-[#1A1A1A]">
        <button type="button" onClick={prevMonth} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 transition cursor-pointer" aria-label="Previous Month">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 tracking-wide">{monthName}</span>
        <button type="button" onClick={nextMonth} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 transition cursor-pointer" aria-label="Next Month">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400 py-2 text-[10px] uppercase tracking-wider">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((dayNum, idx) => {
          if (dayNum === null) return <div key={`empty-${idx}`} className="h-7 w-7" />;
          const cellDateKey = formatDateKey(year, month, dayNum);
          const isSelected = selectedDate === cellDateKey;
          const isToday = todayStr === cellDateKey;
          const hasLogs = loggedDates.has(cellDateKey);
          return (
            <button
              key={cellDateKey}
              type="button"
              onClick={() => { onSelectDate(cellDateKey); onClose(); }}
              className={`relative flex flex-col items-center justify-center h-7 w-7 mx-auto rounded-md text-xs font-semibold transition-all cursor-pointer ${isSelected
                ? 'bg-[var(--brand)] text-white font-bold'
                : isToday
                  ? 'border border-[var(--brand)] text-[var(--brand)] font-bold hover:bg-[var(--brand-light)]'
                  : hasLogs
                    ? 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-200 dark:hover:bg-[#222222]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1A1A]'
                }`}
            >
              <span>{dayNum}</span>
              {hasLogs && !isSelected && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--brand)]" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-[#1A1A1A] text-[11px] font-semibold">
        <button type="button" onClick={() => { onSelectDate(todayStr); onClose(); }} className="text-[var(--brand)] hover:underline cursor-pointer">Today</button>
        {selectedDate && (
          <button type="button" onClick={() => { onClear(); onClose(); }} className="text-slate-400 hover:text-red-500 transition cursor-pointer">Clear</button>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────── component ─────────────────────────── */
export const StaffAttendanceScanner: React.FC = () => {
  const { user } = useAuth();
  const tutorFirstName = user?.first_name || user?.full_name?.trim().split(' ')[0] || 'TUTOR';
  const [scanMode, setScanMode] = useState<'none' | 'camera' | 'text'>('none');
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDtrExportModal, setShowDtrExportModal] = useState(false);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isPrincipalMonitor = user?.role === 'principal' || Boolean(user?.is_superuser);
  const todayStr = new Date().toLocaleDateString('en-CA');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Derived DTR rows ────────────────────────────────────────────
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

  // Recent scans for the right panel feed
  const recentScans = useMemo(
    () => [...attendanceLogs]
      .sort((a, b) => `${b.date}${b.time_out || b.time_in || ''}`.localeCompare(`${a.date}${a.time_out || a.time_in || ''}`))
      .slice(0, 10),
    [attendanceLogs]
  );

  // Today's log
  const todayLog = useMemo(
    () => attendanceLogs.find((l) => l.date === todayStr && String(l.user) === String(user?.id)),
    [attendanceLogs, todayStr, user]
  );


  // ── Filtered DTR rows ──────────────────────────────────────────
  const filteredDtrRows = useMemo(() => {
    let rows = jumpDate ? dtrRows.filter((log) => log.date === jumpDate) : dtrRows;

    if (!jumpDate) {
      const now = new Date();
      rows = dtrRows.filter((log) => {
        const logDate = new Date(`${log.date}T00:00:00`);
        if (viewMode === 'month') {
          return logDate.getFullYear() === now.getFullYear() && logDate.getMonth() === now.getMonth();
        }
        if (viewMode === 'week') {
          const weekStart = new Date(now);
          weekStart.setHours(0, 0, 0, 0);
          weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 7);
          return logDate >= weekStart && logDate < weekEnd;
        }
        return log.date === todayStr;
      });
    }
    return [...rows].sort((a, b) => b.date.localeCompare(a.date));
  }, [dtrRows, jumpDate, todayStr, viewMode]);

  // ── Sort state & DTR sorting ──────────────────────────────────
  type SortKey = 'tutor' | 'date' | 'time_in' | 'time_out' | 'undertime' | 'status';
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  });

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedDtrRows = useMemo(() => {
    if (!sortConfig.key) return filteredDtrRows;

    return [...filteredDtrRows].sort((a, b) => {
      let result = 0;
      switch (sortConfig.key) {
        case 'tutor':
          result = compareNamesByLastName(a.user_name || '', b.user_name || '');
          break;
        case 'date':
          result = (a.date || '').localeCompare(b.date || '');
          break;
        case 'time_in':
          result = (a.time_in || '').localeCompare(b.time_in || '');
          break;
        case 'time_out':
          result = (a.time_out || '').localeCompare(b.time_out || '');
          break;
        case 'undertime': {
          const aMins = timeToMinutes(a.time_out);
          const bMins = timeToMinutes(b.time_out);
          const aDiff = aMins !== null && aMins < TUTOR_TIME_OUT_MINS ? TUTOR_TIME_OUT_MINS - aMins : 0;
          const bDiff = bMins !== null && bMins < TUTOR_TIME_OUT_MINS ? TUTOR_TIME_OUT_MINS - bMins : 0;
          result = aDiff - bDiff;
          break;
        }
        case 'status': {
          const stA = getTutorStatus(timeToMinutes(a.time_in), timeToMinutes(a.time_out));
          const stB = getTutorStatus(timeToMinutes(b.time_in), timeToMinutes(b.time_out));
          result = stA.localeCompare(stB);
          break;
        }
        default:
          result = 0;
      }
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [filteredDtrRows, sortConfig]);

  const paginatedDtrRows = sortedDtrRows;

  const SortableHeader: React.FC<{ label: string; sortKey: SortKey; align?: 'left' | 'center' }> = ({
    label,
    sortKey,
    align = 'left',
  }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className={`inline-flex items-center gap-1.5 transition-colors hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer ${align === 'center' ? 'justify-center w-full' : ''
          }`}
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        {isActive ? (
          sortConfig.direction === 'asc' ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
        )}
      </button>
    );
  };

  // ── Scanner helpers ────────────────────────────────────────────
  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.clear(); } catch (err) { console.error(err); }
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
        message: err.response?.data?.error || 'Clock check-in failed. Please verify the QR session validity.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Data fetching ──────────────────────────────────────────────
  const fetchAttendanceLogs = useCallback(async () => {
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
      setAttendanceLogs(visibleLogs);
    } catch (err: any) {
      console.error(err);
      setLogsError('Failed to load DTR history.');
    } finally {
      setLogsLoading(false);
    }
  }, [user, isPrincipalMonitor]);

  useEffect(() => {
    fetchAttendanceLogs();
  }, [fetchAttendanceLogs]);

  // ── Camera initialization ──────────────────────────────────────
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
          if (!cameras || cameras.length === 0) throw new Error('No camera was detected on this device.');
          const preferredCamera =
            cameras.find((cam) => /integrated|built-?in|webcam|front|user|face/i.test(cam.label)) || cameras[0];
          const videoConstraints: any = { deviceId: { ideal: preferredCamera.id }, facingMode: 'user' };
          const scanner = new Html5QrcodeScanner(
            'staff-qr-reader',
            { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0, disableFlip: true, showTorchButtonIfSupported: true, videoConstraints },
            false
          );
          scannerRef.current = scanner;
          scanner.render(
            (decodedText) => { void handleScanSuccess(decodedText); },
            () => { }
          );
        } catch (err: any) {
          if (!cancelled) {
            console.error(err);
            setCameraError(err?.message || 'Unable to access your camera. Please allow camera permission and try again.');
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

  // ── Manual submission ──────────────────────────────────────────
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    submitScan(manualCode.trim());
    setManualCode('');
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setManualCode(text.trim());
    } catch (err) {
      console.error('Clipboard paste failed:', err);
    }
  };

  // ── Status badge helper ─────────────────────────────────────────
  const statusBadge = (status: 'Completed' | 'Late' | 'Early Out' | '—') => {
    if (status === 'Completed') return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">Completed</span>;
    if (status === 'Late') return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">Late</span>;
    if (status === 'Early Out') return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border bg-rose-50 text-rose-700 border-rose-200">Early Out</span>;
    return <span className="text-gray-300">—</span>;
  };

  /* ─────────────────────────── render ─────────────────────────── */
  if (logsLoading && attendanceLogs.length === 0) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Status Strip Skeleton */}
        {!isPrincipalMonitor && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-700 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Scanner Card Skeleton */}
          <div className="lg:col-span-7">
            <div className="h-full rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-6 space-y-6 animate-pulse">
              <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-48" />
                </div>
              </div>
              <div className="min-h-[340px] sm:min-h-[380px] rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-56" />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Feed / Recent Scans Skeleton */}
          <div className="lg:col-span-5">
            <div className="h-full rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-6 space-y-4 animate-pulse">
              <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-36" />
                </div>
              </div>
              <div className="space-y-2.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                      <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-1/4" />
                    </div>
                    <div className="w-16 h-6 rounded-full bg-gray-100 dark:bg-gray-800" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* DTR Table Skeleton */}
        <div className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-6 space-y-4 animate-pulse">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-36" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-20" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded-xl" />
              <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded-xl" />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (logsError && attendanceLogs.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center mx-auto mb-4 text-rose-500">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Failed to Load DTR</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">{logsError}</p>
        <button
          onClick={fetchAttendanceLogs}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand)] text-white text-xs font-semibold hover:bg-[var(--brand-dark)] transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto data-loaded-content" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>

      {/* ── Export button (principal only) ───────────────────────── */}
      {isPrincipalMonitor && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowDtrExportModal(true)}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--brand-dark)] shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export DTR
          </button>
        </div>
      )}

      {/* ── Status & Info Strip ────────────────────────────────────── */}
      {!isPrincipalMonitor && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Date */}
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#222222] flex items-center justify-center shrink-0 text-slate-800 dark:text-slate-100">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-slate-400 mb-0.5">
                Current Date
              </p>
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                {`${currentDateTime.toLocaleDateString('en-US', { month: 'long' })} ${currentDateTime.getDate()}, ${currentDateTime.getFullYear()} | ${currentDateTime.toLocaleDateString('en-US', { weekday: 'long' })}`}
              </p>
            </div>
          </div>

          {/* Current Time */}
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#222222] flex items-center justify-center shrink-0 text-slate-800 dark:text-slate-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-slate-400 mb-0.5">
                Current Time
              </p>
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100 font-mono">
                {currentDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
              </p>
            </div>
          </div>

          {/* Today's DTR Status */}
          <div className="flex items-center gap-3.5 p-4 rounded-md border border-gray-200 bg-white dark:bg-[#111111] dark:border-[#1A1A1A]">
            <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-[#1A1A1A] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-slate-500 mb-0.5">
                Today's DTR Status
              </p>
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                {todayLog
                  ? `DTR logged at ${formatDtrTime(todayLog.time_in)}`
                  : 'No DTR log yet today'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── LEFT: Scanner Card ────────────────────────────────── */}
        <div className="lg:col-span-7">
          <div className="h-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden">

            {/* Card Header */}
            <div className="h-[60px] shrink-0 flex items-center justify-between px-6 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">SCAN QR CODE</h2>
              </div>
              {scanResult && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border ${scanResult.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${scanResult.type === 'success' ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                  {scanResult.type === 'success' ? 'Logged' : 'Error'}
                </span>
              )}
            </div>

            <div className="p-6 flex flex-col items-center gap-5">

              {/* Scan result banner */}
              {scanResult && (
                <div className={`w-full flex items-start gap-3 p-3.5 rounded-md border text-left ${scanResult.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
                  }`}>
                  {scanResult.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-bold">
                      {scanResult.type === 'success' ? 'DTR Logged' : 'DTR Log Error'}
                    </p>
                    <p className="text-xs mt-0.5 opacity-80">{scanResult.message}</p>
                  </div>
                </div>
              )}

              {/* QR Display / Scanner box */}
              <div className="w-full">
                <div className="relative flex min-h-[340px] sm:min-h-[380px] w-full items-center justify-center rounded-md border-2 border-dashed border-gray-200 dark:border-[#1A1A1A] bg-gray-50/70 dark:bg-[#161616] p-6 overflow-hidden">

                  {/* Scan frame corners (when camera active) */}
                  {scanMode === 'camera' && (
                    <>
                      <span className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[var(--brand)] rounded-tl-xs z-10" />
                      <span className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[var(--brand)] rounded-tr-xs z-10" />
                      <span className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[var(--brand)] rounded-bl-xs z-10" />
                      <span className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[var(--brand)] rounded-br-xs z-10" />
                    </>
                  )}

                  {scanMode === 'camera' ? (
                    <div className="w-full max-w-md mx-auto space-y-3">
                      {cameraError ? (
                        <div className="flex items-start gap-2.5 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                          {cameraError}
                        </div>
                      ) : null}
                      <div id="staff-qr-reader" className="w-full font-mono text-xs text-white overflow-hidden rounded-md" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-10">
                      <div className="w-16 h-16 rounded-md border border-dashed border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] flex items-center justify-center">
                        <Camera className="w-8 h-8 text-gray-300 dark:text-slate-600 stroke-[1.5]" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-xs font-medium text-gray-400 dark:text-slate-400 max-w-[240px]">
                          Press "Start Camera" to scan QR code here
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Start Scanner / Stop button */}
                {scanMode !== 'camera' ? (
                  <button
                    type="button"
                    onClick={() => { setScanResult(null); setScanMode('camera'); }}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white py-3 rounded-md text-sm font-bold transition-all cursor-pointer"
                  >
                    Start Camera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { void stopScanner(); setScanMode('none'); }}
                    className="mt-4 w-full flex items-center justify-center gap-2 border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#161616] hover:bg-gray-50 dark:hover:bg-[#222222] text-gray-700 dark:text-slate-200 py-3 rounded-md text-sm font-bold transition-all cursor-pointer"
                  >
                    Stop Scanner
                  </button>
                )}
              </div>

              {/* Manual Session ID Entry */}
              <div className="w-full">
                <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50/60 dark:bg-[#161616] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">MANUAL ENTRY</h3>
                    </div>
                  </div>
                  <form onSubmit={handleManualSubmit} className="space-y-2">
                    <input
                      type="text"
                      placeholder="Enter 6-char code (e.g. 550E84)..."
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      maxLength={36}
                      className="w-full px-3.5 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-xs bg-white dark:bg-[#111111] text-gray-800 dark:text-slate-200 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] transition-colors uppercase"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting || !manualCode.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white py-2 rounded-md text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Confirming...
                        </>
                      ) : (
                        'Submit Session Code'
                      )}
                    </button>
                  </form>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── RIGHT: Recent Scan Log ────────────────────────────── */}
        <div className="lg:col-span-5">
          <div className="flex h-full min-h-[480px] flex-col rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden">

            {/* Feed header */}
            <div className="h-[60px] shrink-0 flex items-center justify-between px-6 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base uppercase">{tutorFirstName}'S RECENT SCANS</h3>
              </div>
              <div>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 text-[10px] font-extrabold text-gray-700 dark:text-slate-300">
                  {recentScans.length}
                </span>
              </div>
            </div>

            {/* Feed list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {recentScans.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3 min-h-[280px]">
                  <div className="w-14 h-14 rounded-md border border-dashed border-gray-200 dark:border-[#1A1A1A] flex items-center justify-center">
                    <UserCheck className="w-7 h-7 text-gray-300 dark:text-slate-600 stroke-[1.5]" />
                  </div>
                  <p className="text-xs font-medium text-gray-400 dark:text-slate-400 text-center whitespace-nowrap">
                    Your recent QR scans will appear here
                  </p>
                </div>
              ) : (
                recentScans.map((log) => {
                  const timeInMins = timeToMinutes(log.time_in);
                  const timeOutMins = timeToMinutes(log.time_out);
                  const st = getTutorStatus(timeInMins, timeOutMins);
                  const timeDisplay = log.time_out ? formatDtrTime(log.time_out) : log.time_in ? formatDtrTime(log.time_in) : 'Logged';
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-3 p-3 bg-gray-50/60 dark:bg-[#161616] hover:bg-gray-100/60 dark:hover:bg-[#1a1a1a] rounded-md border border-gray-100 dark:border-[#1A1A1A] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-800 dark:text-slate-200 leading-tight truncate">
                          {log.user_name || user?.full_name || tutorFirstName}
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${st === 'Completed' ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800' :
                          st === 'Late' ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-800' :
                            st === 'Early Out' ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-800' :
                              'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800'
                          }`}>
                          <CheckCircle2 className="w-3 h-3" />
                          {log.date ? `${formatDateString(log.date)} | ` : ''}{timeDisplay}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── TUTOR DTR HISTORY Table ──────────────────────────────── */}
      <div className="mt-2.5 sm:mt-4 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] relative" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>

        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div>
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base uppercase">{tutorFirstName}'S DTR HISTORY</h3>
                <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">
                  {filteredDtrRows.length} Record{filteredDtrRows.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-gray-100 dark:bg-[#1A1A1A] rounded-md p-0.5 gap-0.5">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  id={`dtr-view-${mode}`}
                  type="button"
                  onClick={() => { setViewMode(mode); setJumpDate(null); }}
                  className={`rounded-sm px-3 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer ${viewMode === mode && !jumpDate
                    ? 'bg-[var(--brand)] text-white'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                    }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Calendar picker */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                id="dtr-calendar-btn"
                onClick={() => setShowCalendarPopover((prev) => !prev)}
                className={`p-2 rounded-md border transition-all flex items-center justify-center cursor-pointer ${jumpDate
                  ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                  : 'border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-[#222222]'
                  }`}
                title="Select a specific date from calendar"
                aria-label="Open Calendar"
              >
                <Calendar className="w-4 h-4" />
              </button>
              {showCalendarPopover && (
                <CustomCalendarDropdown
                  selectedDate={jumpDate}
                  onSelectDate={(d) => setJumpDate(d)}
                  onClear={() => setJumpDate(null)}
                  onClose={() => setShowCalendarPopover(false)}
                  loggedDates={new Set(dtrRows.map((l) => l.date))}
                />
              )}
            </div>
          </div>
        </div>

        {/* Jump-to-date active chip */}
        {jumpDate && (
          <div className="flex items-center gap-2 px-6 py-2 border-b border-gray-100 dark:border-[#1A1A1A] bg-emerald-50/60 dark:bg-emerald-950/20">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {new Date(jumpDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <button
              onClick={() => setJumpDate(null)}
              className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}

        {/* Table content */}
        <div className="p-4 sm:p-6">
          {logsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-gray-100 dark:bg-[#1A1A1A] rounded-md animate-pulse" />
              ))}
            </div>
          ) : logsError ? (
            <div className="flex items-start gap-2.5 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md p-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              {logsError}
            </div>
          ) : filteredDtrRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarDays className="w-10 h-10 text-gray-200 dark:text-gray-700" />
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No DTR records found</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Records will appear after scanning QR codes</p>
            </div>
          ) : (
            <div className="overflow-x-auto mobile-scroll-table -mx-2 px-2">
              <table className="min-w-[600px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#151515]">
                    {isPrincipalMonitor && (
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <SortableHeader label="TUTOR" sortKey="tutor" />
                      </th>
                    )}
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <SortableHeader label="DATE" sortKey="date" />
                    </th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <SortableHeader label="TIME IN" sortKey="time_in" align="center" />
                    </th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <SortableHeader label="TIME OUT" sortKey="time_out" align="center" />
                    </th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <SortableHeader label="UNDERTIME" sortKey="undertime" align="center" />
                    </th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <SortableHeader label="STATUS" sortKey="status" align="center" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#111111]">
                  {paginatedDtrRows.map((log) => {
                    // Derive effective time in / out for tutors
                    // Use time_in / time_out directly (tutor DTR uses these fields)
                    const legacyIn = timeToMinutes(log.time_in);
                    const legacyOut = timeToMinutes(log.time_out);
                    // Prefer PM punch (4:30–5:00 window); fall back to any logged time
                    const effectiveIn = log.time_in;
                    const effectiveOut = log.time_out;
                    const timeInMins = timeToMinutes(effectiveIn);
                    const timeOutMins = timeToMinutes(effectiveOut);
                    const st = getTutorStatus(timeInMins, timeOutMins);
                    const undertime = getUndertimeStr(timeOutMins);
                    void legacyIn; void legacyOut;

                    return (
                      <tr key={`${log.user}-${log.date}`} className="hover:bg-gray-50/80 dark:hover:bg-[#151515] transition-colors">
                        {isPrincipalMonitor && (
                          <td className="px-4 py-2.5 text-left font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {log.user_name || 'Unknown Tutor'}
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-left text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs font-medium">
                          {formatDateString(log.date)}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {formatDtrTime(effectiveIn)}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {formatDtrTime(effectiveOut)}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {undertime}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {statusBadge(st)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Export DTR Modal */}
      {isPrincipalMonitor && (
        <ExportDtrModal
          isOpen={showDtrExportModal}
          onClose={() => setShowDtrExportModal(false)}
          currentUser={user}
          attendanceLogs={attendanceLogs}
        />
      )}
    </div>
  );
};

export default StaffAttendanceScanner;
