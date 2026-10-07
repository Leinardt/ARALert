import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import type { Attendance, User } from '../../types';
import {
  RefreshCw, CheckCircle2, Clock, FileImage, FileText, X, ZoomIn, Lock,
  Calendar, CalendarDays, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  ArrowUpDown, Download, Search, Users, AlertCircle, UserCheck, ClipboardCheck
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import QRCode from 'qrcode';
import { exportStaffQrPrintFile, type ExportFormat } from '../../utils/staffQrPrintExport';
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

// Tutor standard schedule: Time In = 8:00 AM / 4:30 PM
const TUTOR_TIME_IN_MINS = 8 * 60 + 0;   // 8:00 AM standard
const TUTOR_TIME_OUT_MINS = 11 * 60 + 30; // 11:30 AM standard

const getTutorStatus = (timeInMins: number | null, timeOutMins: number | null): 'Completed' | 'Late' | 'Early Out' | 'Present' | '—' => {
  if (timeInMins === null && timeOutMins === null) return '—';
  if (timeInMins !== null && timeOutMins === null) return 'Present';
  if (timeInMins !== null && timeInMins > TUTOR_TIME_IN_MINS + 15) return 'Late';
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
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d}>{d}</span>)}
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
              className={`relative flex flex-col items-center justify-center h-7 w-7 mx-auto rounded-md text-xs font-semibold transition-all cursor-pointer ${
                isSelected
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

/* ─────────────────────────── Component ─────────────────────────── */

export const AdminAttendanceQR: React.FC = () => {
  const { user } = useAuth();

  // QR Session state
  const [session, setSession] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState<boolean>(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [isEnlarged, setIsEnlarged] = useState<boolean>(false);

  // DTR Logs state
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [tutors, setTutors] = useState<User[]>([]);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [showDtrExportModal, setShowDtrExportModal] = useState<boolean>(false);

  // Filters & Controls
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const todayStr = new Date().toLocaleDateString('en-CA');
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());

  // Live clock interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load or initialize Today's constant QR Session
  const initOrLoadQR = async () => {
    setIsGeneratingQR(true);
    setQrError(null);
    try {
      // 1. Check if an active staff QR session already exists
      const existing = await academicService.getActiveAttendanceSession('staff');
      if (existing) {
        setSession(existing);
        return;
      }
      // 2. If no active session exists for today, create one with 24 hours expiry (all-day terminal)
      const newSession = await academicService.createAttendanceSession({
        session_type: 'staff',
        expires_in_minutes: 1440,
      });
      setSession(newSession);
    } catch (err: any) {
      console.error(err);
      setQrError(err.response?.data?.error || 'Failed to initialize daily QR session.');
    } finally {
      setIsGeneratingQR(false);
    }
  };

  useEffect(() => {
    initOrLoadQR();
    fetchDtrData();
  }, []);

  // Fetch Attendance & Staff Users (Tutors & Faculty)
  const fetchDtrData = async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const [attData, tutorData, facultyData] = await Promise.all([
        academicService.getAttendanceHistory(),
        userService.getAllUsers({ role: 'tutor' }).catch(() => [] as User[]),
        userService.getAllUsers({ role: 'faculty' }).catch(() => [] as User[]),
      ]);
      setAttendanceLogs(attData);
      setTutors(tutorData);
      setFaculty(facultyData);
    } catch (err) {
      console.error('Failed to load DTR logs:', err);
      setLogsError('Failed to load DTR history records.');
    } finally {
      setLogsLoading(false);
    }
  };

  // Generate high-resolution QR Data URL whenever session changes
  useEffect(() => {
    if (session?.id) {
      QRCode.toDataURL(session.id, {
        width: 512,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then((url) => {
          setQrDataUrl(url);
        })
        .catch((err) => {
          console.error('QR toDataURL Error:', err);
        });
    } else {
      setQrDataUrl(null);
    }
  }, [session]);

  const exportPrintFile = async (format: ExportFormat) => {
    if (!session) return;
    setExportingFormat(format);
    try {
      await exportStaffQrPrintFile({
        sessionId: session.id,
        action: 'staff_day',
        expiresAt: session.expires_at,
        format,
      });
    } catch (exportError) {
      console.error('Staff QR print export failed:', exportError);
      setQrError('Unable to create the print-ready QR file.');
    } finally {
      setExportingFormat(null);
    }
  };

  // ── Unified Staff Map (Tutors + Faculty) ───────────────────────
  const allStaffUsers = useMemo(() => {
    const map = new Map<string, User>();
    tutors.forEach((t) => map.set(String(t.id), t));
    faculty.forEach((f) => map.set(String(f.id), f));
    return Array.from(map.values());
  }, [tutors, faculty]);

  const staffMap = useMemo(() => {
    const m = new Map<string, User>();
    allStaffUsers.forEach((u) => {
      m.set(String(u.id), u);
    });
    return m;
  }, [allStaffUsers]);

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

  // Unique logged dates for calendar dots
  const loggedDates = useMemo(() => {
    return new Set(attendanceLogs.map((l) => l.date));
  }, [attendanceLogs]);

  // Total unique staff scanned today
  const scannedStaffTodayCount = useMemo(() => {
    const scannedUserIds = new Set<string>();
    attendanceLogs.forEach((log) => {
      if (log.date === todayStr) {
        if (log.user) scannedUserIds.add(String(log.user));
        if (log.tutor) scannedUserIds.add(String(log.tutor));
      }
    });
    return scannedUserIds.size;
  }, [attendanceLogs, todayStr]);

  // Today's recent scans feed
  const recentScansToday = useMemo(() => {
    return dtrRows
      .filter((log) => log.date === todayStr)
      .sort((a, b) => {
        const timeA = a.time_out || a.time_in || '';
        const timeB = b.time_out || b.time_in || '';
        return timeB.localeCompare(timeA);
      });
  }, [dtrRows, todayStr]);

  // Filter by viewMode or jumpDate
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

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => {
        const staff = staffMap.get(String(r.user)) || staffMap.get(String(r.tutor));
        const name = (r.user_name || staff?.full_name || '').toLowerCase();
        const role = (staff?.role || '').toLowerCase();
        const subj = (staff?.subject || '').toLowerCase();
        const gr = (staff?.grade_level || '').toLowerCase();
        return name.includes(q) || role.includes(q) || subj.includes(q) || gr.includes(q);
      });
    }

    return [...rows].sort((a, b) => b.date.localeCompare(a.date));
  }, [dtrRows, jumpDate, todayStr, viewMode, search, staffMap]);

  // ── Sort state & DTR sorting ──────────────────────────────────
  type SortKey = 'staff' | 'date' | 'time_in' | 'time_out' | 'undertime' | 'status';
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
        case 'staff':
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
        className={`inline-flex items-center gap-1.5 transition-colors hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer ${
          align === 'center' ? 'justify-center w-full' : ''
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

  return (
    <div
      className="space-y-6 max-w-6xl mx-auto data-loaded-content"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Main Grid: Left QR Generator & Right Recent Scans ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── LEFT: QR Code Terminal & Export Card ── */}
        <div className="lg:col-span-7">
          <div className="h-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden flex flex-col justify-between">
            
            {/* Card Header */}
            <div className="h-[60px] shrink-0 flex items-center justify-between px-6 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 uppercase">
                  STAFF DTR TERMINAL QR
                </h2>
              </div>
              {session && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              )}
            </div>

            <div className="p-6 flex flex-col items-center gap-5 flex-1 justify-between">
              
              {/* QR Error message */}
              {qrError && (
                <div className="w-full flex items-start gap-3 p-3.5 rounded-md border text-left bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold">QR Session Error</p>
                    <p className="text-xs mt-0.5 opacity-80">{qrError}</p>
                  </div>
                </div>
              )}

              {/* QR Display Area */}
              <div className="w-full">
                <div className="relative flex min-h-[320px] sm:min-h-[350px] w-full items-center justify-center rounded-md border-2 border-dashed border-gray-200 dark:border-[#1A1A1A] bg-gray-50/70 dark:bg-[#161616] p-6 overflow-hidden">
                  {isGeneratingQR && !qrDataUrl ? (
                    <div className="flex flex-col items-center gap-3 py-10">
                      <RefreshCw className="w-8 h-8 animate-spin text-[var(--brand)]" />
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                        Loading Terminal QR Code...
                      </p>
                    </div>
                  ) : qrDataUrl ? (
                    <div
                      className="group relative cursor-zoom-in"
                      onClick={() => setIsEnlarged(true)}
                      title="Click to enlarge QR terminal"
                    >
                      <div className="rounded-xl border border-gray-200 dark:border-[#222222] bg-white p-3 shadow-md transition-transform duration-200 group-hover:scale-[1.02]">
                        <img
                          src={qrDataUrl}
                          alt="Staff DTR Terminal QR"
                          className="block rounded-lg w-[230px] h-[230px] object-contain select-none"
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition-all duration-200 group-hover:bg-black/10">
                        <div className="flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-black/90 px-3 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
                          <ZoomIn className="h-3.5 w-3.5" />
                          Enlarge
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-10">
                      <RefreshCw className="w-8 h-8 animate-spin text-[var(--brand)]" />
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                        Generating QR Code...
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Export DOCX, PDF, or JPG Toolbar (Neutral Monochrome Style) */}
              <div className="w-full">
                <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50/60 dark:bg-[#161616] p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                      Export Terminal Poster
                    </h3>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold">
                      Long Bond (8.5 × 13 in)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => exportPrintFile('docx')}
                      disabled={!session || exportingFormat !== null}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      DOCX
                    </button>
                    <button
                      type="button"
                      onClick={() => exportPrintFile('pdf')}
                      disabled={!session || exportingFormat !== null}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => exportPrintFile('jpg')}
                      disabled={!session || exportingFormat !== null}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
                    >
                      <FileImage className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      JPG
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── RIGHT: Recent Scans of Today Card ── */}
        <div className="lg:col-span-5">
          <div className="flex h-full min-h-[480px] flex-col rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden">
            
            {/* Feed Header */}
            <div className="h-[60px] shrink-0 flex items-center justify-between px-6 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base uppercase">
                  TODAY'S RECENT SCANS
                </h3>
              </div>
              <div>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1A1A1A] px-2 py-0.5 text-[10px] font-extrabold text-gray-700 dark:text-slate-300">
                  {recentScansToday.length}
                </span>
              </div>
            </div>

            {/* Feed List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {recentScansToday.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3 min-h-[280px]">
                  <div className="w-14 h-14 rounded-md border border-dashed border-gray-200 dark:border-[#1A1A1A] flex items-center justify-center">
                    <UserCheck className="w-7 h-7 text-gray-300 dark:text-slate-600 stroke-[1.5]" />
                  </div>
                  <p className="text-xs font-medium text-gray-400 dark:text-slate-400 text-center">
                    Staff QR scans of today will appear here
                  </p>
                </div>
              ) : (
                recentScansToday.map((log) => {
                  const staff = staffMap.get(String(log.user)) || staffMap.get(String(log.tutor));
                  const timeInMins = timeToMinutes(log.time_in);
                  const timeOutMins = timeToMinutes(log.time_out);
                  const st = getTutorStatus(timeInMins, timeOutMins);
                  const timeDisplay = log.time_out ? formatDtrTime(log.time_out) : log.time_in ? formatDtrTime(log.time_in) : 'Logged';
                  const roleLabel = staff?.role === 'faculty' ? 'Faculty' : staff?.role === 'tutor' ? 'Tutor' : 'Staff';

                  return (
                    <div
                      key={`${log.id}-${log.user}`}
                      className="flex items-center justify-between gap-3 p-3 bg-gray-50/60 dark:bg-[#161616] hover:bg-gray-100/60 dark:hover:bg-[#1a1a1a] rounded-md border border-gray-100 dark:border-[#1A1A1A] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-800 dark:text-slate-200 leading-tight truncate">
                          {log.user_name || staff?.full_name || 'Staff Member'}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5 truncate">
                          {roleLabel}{staff?.subject ? ` • ${staff.subject}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          st === 'Completed' ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800' :
                          st === 'Present' ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-800' :
                          st === 'Late' ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-800' :
                          st === 'Early Out' ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-800' :
                          'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800'
                        }`}>
                          <CheckCircle2 className="w-3 h-3" />
                          {timeDisplay}
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

      {/* ── Main Overall DTR History Table ── */}
      <div
        className="mt-2.5 sm:mt-4 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] relative"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base uppercase">
              DTR SCAN HISTORY
            </h3>
            <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">
              {filteredDtrRows.length} Record{filteredDtrRows.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-gray-100 dark:bg-[#1A1A1A] rounded-md p-0.5 gap-0.5">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setViewMode(mode); setJumpDate(null); }}
                  className={`rounded-sm px-3 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    viewMode === mode && !jumpDate
                      ? 'bg-[var(--brand)] text-white'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Jump to Date Calendar Popover (Icon Only) */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                id="dtr-calendar-btn"
                onClick={() => setShowCalendarPopover((prev) => !prev)}
                className={`p-2 rounded-md border transition-all flex items-center justify-center cursor-pointer ${
                  jumpDate
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
                  loggedDates={loggedDates}
                />
              )}
            </div>

            {/* Search Bar */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search staff, subject, grade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#1A1A1A] rounded-md text-xs text-gray-800 dark:text-slate-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] transition-colors"
              />
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

        {/* Table Content */}
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
          ) : sortedDtrRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarDays className="w-10 h-10 text-gray-200 dark:text-gray-700" />
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No DTR records found</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Records will appear after staff scan the QR code</p>
            </div>
          ) : (
            <div className="overflow-x-auto mobile-scroll-table -mx-2 px-2">
              <table className="min-w-[860px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#151515] text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-2.5 text-left">
                      <SortableHeader label="DATE" sortKey="date" />
                    </th>
                    <th className="px-4 py-2.5 text-left">
                      <SortableHeader label="NAME" sortKey="staff" />
                    </th>
                    <th className="px-4 py-2.5 text-left">ROLE / SUBJECT</th>
                    <th className="px-4 py-2.5 text-left">GRADE & SECTION</th>
                    <th className="px-4 py-2.5 text-center">
                      <SortableHeader label="TIME IN" sortKey="time_in" align="center" />
                    </th>
                    <th className="px-4 py-2.5 text-center">
                      <SortableHeader label="TIME OUT" sortKey="time_out" align="center" />
                    </th>
                    <th className="px-4 py-2.5 text-center">TOTAL HOURS</th>
                    <th className="px-4 py-2.5 text-center">
                      <SortableHeader label="UNDERTIME / LATE" sortKey="undertime" align="center" />
                    </th>
                    <th className="px-4 py-2.5 text-center">
                      <SortableHeader label="STATUS" sortKey="status" align="center" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#111111]">
                  {sortedDtrRows.map((log) => {
                    const staff = staffMap.get(String(log.user)) || staffMap.get(String(log.tutor));
                    const timeInMins = timeToMinutes(log.time_in);
                    const timeOutMins = timeToMinutes(log.time_out);
                    const status = getTutorStatus(timeInMins, timeOutMins);
                    const undertime = getUndertimeStr(timeOutMins);

                    // Calculate total hours
                    let totalHoursStr = '—';
                    if (timeInMins !== null && timeOutMins !== null && timeOutMins >= timeInMins) {
                      const diffMins = timeOutMins - timeInMins;
                      const hrs = (diffMins / 60).toFixed(1);
                      totalHoursStr = `${hrs} hrs`;
                    }

                    const roleText = staff?.role === 'faculty' ? 'Faculty' : staff?.role === 'tutor' ? 'Tutor' : 'Staff';
                    const subject = staff?.subject ? `${roleText} • ${staff.subject}` : roleText;
                    const grade_level = staff?.grade_level || 'Grade 7 - HYACINTH';

                    return (
                      <tr
                        key={`${log.user}-${log.date}-${log.id}`}
                        className="hover:bg-gray-50/80 dark:hover:bg-[#151515] transition-colors"
                      >
                        <td className="px-4 py-2.5 text-left text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs font-medium">
                          {formatDateString(log.date)}
                        </td>
                        <td className="px-4 py-2.5 text-left font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          {log.user_name || staff?.full_name || 'Staff Member'}
                        </td>
                        <td className="px-4 py-2.5 text-left text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                          {subject}
                        </td>
                        <td className="px-4 py-2.5 text-left text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                          {grade_level}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {formatDtrTime(log.time_in)}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {formatDtrTime(log.time_out)}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {totalHoursStr}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {undertime}
                        </td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          {status === 'Completed' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60">
                              Completed
                            </span>
                          ) : status === 'Present' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/60">
                              Present
                            </span>
                          ) : status === 'Late' || status === 'Early Out' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/60">
                              {status}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                              {status || '—'}
                            </span>
                          )}
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

      {/* ── Enlarged QR Code Modal ── */}
      {isEnlarged && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setIsEnlarged(false)}
        >
          <div
            className="relative rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl max-w-md w-full flex flex-col items-center gap-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsEnlarged(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase">
                Staff DTR Terminal QR
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Display this terminal code for staff and tutors to scan on arrival and departure.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white p-3 shadow-md">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Staff DTR Terminal QR"
                  className="block rounded-lg w-[280px] h-[280px] object-contain select-none"
                />
              ) : (
                <div className="w-[280px] h-[280px] flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-[var(--brand)]" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => exportPrintFile('docx')}
                disabled={!session || exportingFormat !== null}
                className="px-3.5 py-1.5 rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                DOCX
              </button>
              <button
                type="button"
                onClick={() => exportPrintFile('pdf')}
                disabled={!session || exportingFormat !== null}
                className="px-3.5 py-1.5 rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => exportPrintFile('jpg')}
                disabled={!session || exportingFormat !== null}
                className="px-3.5 py-1.5 rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <FileImage className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                JPG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export DTR Modal ── */}
      {showDtrExportModal && (
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

export default AdminAttendanceQR;
