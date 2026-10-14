import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  X,
  Play,
  Users,
  UserCheck,
  Check,
  QrCode,
  Download,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ExportStudentQrModal } from '../../components/ExportStudentQrModal';
import {
  exportStudentQrToJpeg,
  exportStudentQrToPdf,
  exportStudentQrToDocx,
  generateStudentQrDataUrl,
  getStudentManualCode,
} from '../../utils/studentQrExportService';
import { formatStudentName, extractLastNameAndFirstName } from '../../utils/studentFormatters';

/* ─── Helpers ─────────────────────────────────────────────────── */

const smartPct = (n: number): string => parseFloat(n.toFixed(2)).toString();

const formatDateString = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year} | ${weekday}`;
};

const formatTimeString = (value: string | null | undefined): string => {
  if (!value) return '—';

  // Handle standard "HH:MM:SS" or "HH:MM" time strings
  const timeParts = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeParts) {
    let hours = parseInt(timeParts[1], 10);
    const minutes = timeParts[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  // Handle full ISO / datetime strings
  const date = new Date(value.includes('T') || value.includes(' ') ? value : `1970-01-01T${value}`);
  if (!Number.isNaN(date.getTime())) {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  return value;
};

const formatDateKey = (year: number, month: number, day: number) => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

const getWeekKey = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return mon.toISOString().slice(0, 10);
};

const weekLabel = (mondayStr: string) => {
  const mon = new Date(mondayStr + 'T00:00:00');
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(mon)} – ${fmt(fri)}, ${fri.getFullYear()}`;
};

const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);

const monthLabel = (key: string) => {
  const d = new Date(key + '-01T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

/* ─── Custom Calendar Dropdown (Exact Match to TutorQRGenerator) ── */

const CustomCalendarDropdown: React.FC<{
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onClear: () => void;
  onClose: () => void;
  loggedDates: Set<string>;
  className?: string;
  style?: React.CSSProperties;
}> = ({ selectedDate, onSelectDate, onClear, onClose, loggedDates, className, style }) => {
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

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div
      ref={dropdownRef}
      className={`${className || 'absolute right-0 top-full mt-2'} z-[60] w-72 rounded-2xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 shadow-2xl font-sans select-none text-gray-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-150`}
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif", ...style }}
    >
      {/* Month & Navigation */}
      <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-[#1A1A1A]">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] text-gray-600 dark:text-slate-300 transition cursor-pointer"
          aria-label="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-xs text-gray-900 dark:text-slate-100 tracking-wide">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] text-gray-600 dark:text-slate-300 transition cursor-pointer"
          aria-label="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-gray-400 dark:text-slate-500 py-2 text-[10px] uppercase tracking-wider">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      {/* Day Numbers */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((dayNum, idx) => {
          if (dayNum === null) {
            return <div key={`empty-${idx}`} className="h-7 w-7" />;
          }

          const cellDateKey = formatDateKey(year, month, dayNum);
          const isSelected = selectedDate === cellDateKey;
          const isToday = todayStr === cellDateKey;
          const hasLogs = loggedDates.has(cellDateKey);

          return (
            <button
              key={cellDateKey}
              type="button"
              onClick={() => {
                onSelectDate(cellDateKey);
                onClose();
              }}
              className={`relative flex flex-col items-center justify-center h-7 w-7 mx-auto rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[var(--brand)] text-white font-bold shadow-sm'
                  : isToday
                  ? 'border border-[var(--brand)] text-[var(--brand)] font-bold hover:bg-[var(--brand-light)]'
                  : hasLogs
                  ? 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-800 dark:text-slate-200 font-semibold hover:bg-gray-200 dark:hover:bg-[#222222]'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
              }`}
            >
              <span>{dayNum}</span>
              {hasLogs && !isSelected && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--brand)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer shortcut buttons */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-[#1A1A1A] text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => {
            onSelectDate(todayStr);
            onClose();
          }}
          className="text-[var(--brand)] dark:text-sky-400 hover:underline cursor-pointer"
        >
          Today
        </button>
        {selectedDate && (
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="text-gray-400 dark:text-slate-500 hover:text-red-500 transition cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

/* ─── Main StudentQRAttendance Component ──────────────────────── */

export const StudentQRAttendance: React.FC = () => {
  const { user } = useAuth();
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);

  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  const [studentQrUrl, setStudentQrUrl] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Load permanent QR code data url
  useEffect(() => {
    let isMounted = true;
    if (user?.id) {
      generateStudentQrDataUrl(user.id, 280)
        .then((url) => {
          if (isMounted) setStudentQrUrl(url);
        })
        .catch((err) => console.error('Failed to generate student QR:', err));
    }
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sort state
  type SortKey = 'student' | 'date' | 'time' | 'status';
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  });

  // Recent scans feed
  const recentScans = useMemo(
    () =>
      [...attendanceLogs]
        .sort((a, b) => `${b.date}${b.time_out || b.time_in || ''}`.localeCompare(`${a.date}${a.time_in || ''}`))
        .slice(0, 10),
    [attendanceLogs]
  );

  // ── Stat Containers Metrics ──────────────────────────────────
  const { totalPresent, totalAbsent, attendanceRate, hasAttendanceData } = useMemo(() => {
    const presentCount = attendanceLogs.filter((l) => l.status === 'present').length;
    const absentCount = attendanceLogs.filter((l) => l.status === 'absent').length;
    const total = attendanceLogs.length;
    const hasData = total > 0;
    const rate = hasData ? Number(((presentCount / total) * 100).toFixed(2)) : 100;
    return {
      totalPresent: presentCount,
      totalAbsent: absentCount,
      attendanceRate: rate,
      hasAttendanceData: hasData,
    };
  }, [attendanceLogs]);



  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [jumpDate, viewMode]);

  // Attendance history helpers
  const sortedHistory = useMemo(() => {
    return [...attendanceLogs].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }, [attendanceLogs]);

  const jumpFiltered = useMemo(
    () => (jumpDate ? sortedHistory.filter((l) => l.date === jumpDate) : null),
    [sortedHistory, jumpDate]
  );

  const activeRecords = useMemo(
    () => (jumpFiltered !== null ? jumpFiltered : sortedHistory),
    [jumpFiltered, sortedHistory]
  );

  const paginatedLogs = useMemo(
    () => activeRecords.slice((currentPage - 1) * 30, currentPage * 30),
    [activeRecords, currentPage]
  );

  type Group = { key: string; label: string; records: Attendance[] };
  const groupedHistory = useMemo((): Group[] => {
    if (jumpFiltered !== null) return [];
    const grouped = new Map<string, Attendance[]>();
    for (const log of paginatedLogs) {
      const key = viewMode === 'week' ? getWeekKey(log.date) : getMonthKey(log.date);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, records]) => ({
        key,
        label: viewMode === 'week' ? weekLabel(key) : monthLabel(key),
        records,
      }));
  }, [paginatedLogs, viewMode, jumpFiltered]);

  const timeGroupedHistory = useMemo((): Group[] => {
    const source = paginatedLogs;
    const grouped = new Map<string, Attendance[]>();
    for (const log of source) {
      const timeStr = log.time_in ? formatTimeString(log.time_in) : '—';
      const key = `${log.date}|${timeStr}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    return Array.from(grouped.entries()).map(([key, records]) => {
      const [date, time] = key.split('|');
      return {
        key,
        label: time !== '—' ? `${formatDateString(date)} | ${time}` : formatDateString(date),
        records,
      };
    });
  }, [paginatedLogs]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortRecords = (list: Attendance[]) => {
    if (viewMode === 'day') return list;
    return [...list].sort((a, b) => {
      let aVal = '';
      let bVal = '';
      if (sortConfig.key === 'student') {
        aVal = user?.full_name || '';
        bVal = user?.full_name || '';
      } else if (sortConfig.key === 'date') {
        aVal = a.date;
        bVal = b.date;
      } else if (sortConfig.key === 'time') {
        aVal = a.time_in || '';
        bVal = b.time_in || '';
      } else if (sortConfig.key === 'status') {
        aVal = a.status_display || a.status;
        bVal = b.status_display || b.status;
      }
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  };

  const SortableHeader: React.FC<{ label: string; sortKey: SortKey }> = ({ label, sortKey }) => {
    if (viewMode === 'day') {
      return <span>{label}</span>;
    }
    const isActive = sortConfig.key === sortKey;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer"
        aria-label={`Sort by ${label}`}
      >
        {label}
        {isActive ? (
          sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
        )}
      </button>
    );
  };

  const renderTable = (records: Attendance[]) => (
    <div className="overflow-x-auto mobile-scroll-table -mx-2 px-2">
      <table className="min-w-[680px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm">
        <thead>
          <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
            <th className="w-[35%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
              <SortableHeader label="STUDENT" sortKey="student" />
            </th>
            <th className="w-[25%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
              <SortableHeader label="DATE" sortKey="date" />
            </th>
            <th className="w-[20%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
              <SortableHeader label="TIME" sortKey="time" />
            </th>
            <th className="w-[20%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
              <SortableHeader label="STATUS" sortKey="status" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
          {records.map((log) => {
            const isPresent = log.status === 'present';
            return (
              <tr
                key={log.id}
                className="group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#111111]/80"
              >
                <td className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-100 whitespace-nowrap">
                  {user?.full_name || studentFirstName}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs">
                  {formatDateString(log.date)}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs">
                  {log.time_in ? formatTimeString(log.time_in) : '—'}
                </td>
                <td className="px-4 py-3 text-left whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize whitespace-nowrap ${
                      isPresent
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    {log.status_display || (isPresent ? 'Present' : 'Absent')}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const currentRecordsCount = jumpFiltered !== null ? jumpFiltered.length : sortedHistory.length;

  const loggedDates = useMemo(() => {
    const set = new Set<string>();
    attendanceLogs.forEach((l) => {
      if (l.date) set.add(l.date);
    });
    return set;
  }, [attendanceLogs]);

  // Fetch student's attendance records
  const fetchAttendanceLogs = useCallback(async () => {
    if (!user) return;
    setLogsLoading(true);
    setLogsError(null);
    try {
      const logs = await academicService.getAttendanceHistory({ user_id: user.id });
      // Strict student isolation
      const myLogs = logs.filter((l) => String(l.user) === String(user.id));
      setAttendanceLogs(myLogs);
    } catch (err: any) {
      console.error(err);
      setLogsError('Failed to load attendance history.');
    } finally {
      setLogsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAttendanceLogs();
  }, [fetchAttendanceLogs]);



  const studentFirstName = (() => {
    if (user?.first_name?.trim()) return user.first_name.trim();
    const candidate = user?.full_name || (user as any)?.name;
    if (candidate) {
      const { firstName } = extractLastNameAndFirstName(candidate);
      if (firstName?.trim()) return firstName.trim();
    }
    return 'STUDENT';
  })();
  const studentFormattedName = formatStudentName(user) || (user?.full_name ? user.full_name.toUpperCase() : studentFirstName.toUpperCase());

  return (
    <div
      className="space-y-4 max-w-6xl mx-auto data-loaded-content"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Main Grid ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── LEFT: Student Permanent QR Code Card ── */}
        <div className="lg:col-span-7">
          <div className="h-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden flex flex-col justify-between">
            {/* Card Header */}
            <div className="h-[52px] shrink-0 flex items-center justify-between px-5 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase">
                  {studentFirstName.toUpperCase()}'S ATTENDANCE QR CODE
                </h2>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-5 flex flex-col items-center gap-5 flex-1 justify-between">
              {/* Permanent Student QR Badge View */}
              <div className="w-full flex flex-col items-center gap-5 my-auto">
                <div className="w-full max-w-sm flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-slate-100/70 dark:from-[#111111] dark:to-[#161616] rounded-xl border border-dashed border-gray-300 dark:border-white/10 relative">
                  <span className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[var(--brand)] rounded-tl-sm" />
                  <span className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[var(--brand)] rounded-tr-sm" />
                  <span className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[var(--brand)] rounded-bl-sm" />
                  <span className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[var(--brand)] rounded-br-sm" />

                  {/* 1. QR CODE */}
                  <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-200 dark:border-gray-300">
                    {studentQrUrl ? (
                      <img
                        src={studentQrUrl}
                        alt={`${studentFormattedName}'s QR Code`}
                        className="w-48 h-48 sm:w-56 sm:h-56 rounded object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400">
                        Generating permanent QR code...
                      </div>
                    )}
                  </div>

                  {/* 2. LASTNAME, FIRSTNAME M.I. */}
                  <div className="mt-3 text-center">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                      {studentFormattedName}
                    </h3>
                  </div>

                  {/* [small gap] */}
                  {/* 3. MANUAL ATTENDANCE CODE: + [MANUAL ATTENDANCE CODE] + Use this 6-digit code if there are problems scanning the QR code. */}
                  <div className="mt-2.5 flex flex-col items-center">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300">
                      MANUAL ATTENDANCE CODE:
                    </span>
                    <span className="mt-1 text-base sm:text-lg font-extrabold font-mono tracking-widest text-[var(--brand)] dark:text-blue-400 bg-white dark:bg-[#1A1A1A] px-3.5 py-1 rounded-md border border-gray-200 dark:border-[#2A2A2A] shadow-xs select-all">
                      {user?.id ? getStudentManualCode(String(user.id)) : '------'}
                    </span>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center mt-1.5 max-w-[280px] leading-tight">
                      Use this 6-digit code if there are problems scanning the QR code.
                    </p>
                  </div>
                </div>

                {/* Export QR Code Action Button */}
                <div className="flex flex-row items-center justify-center gap-2 w-full max-w-full flex-nowrap overflow-x-auto py-1">
                  <button
                    type="button"
                    disabled={!user}
                    onClick={() => setShowExportModal(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--brand)] px-3.5 sm:px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer whitespace-nowrap"
                    title="Export Student Attendance QR Code"
                  >
                    <Download className="w-3.5 h-3.5 text-white" />
                    <span>Export QR Code</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Student Attendance Feed ── */}
        <div className="lg:col-span-5">
          <div className="flex h-full min-h-[480px] flex-col rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden">
            {/* Feed Header */}
            <div className="h-[52px] shrink-0 flex items-center justify-between px-5 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm uppercase">
                  {studentFirstName}'S RECENT SCANS
                </h3>
              </div>
              <div>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 text-[10px] font-extrabold text-gray-700 dark:text-slate-300">
                  {recentScans.length}
                </span>
              </div>
            </div>

            {/* Feed List */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
              {logsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-12 bg-gray-50 dark:bg-[#111111] rounded-md animate-pulse flex items-center px-3.5 gap-3"
                    >
                      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
                      <div className="h-4 w-20 rounded-full bg-gray-200 dark:bg-gray-800 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : recentScans.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-5 gap-2.5 min-h-[260px]">
                  <div className="w-12 h-12 rounded-md border border-dashed border-gray-200 dark:border-[#1A1A1A] flex items-center justify-center">
                    <UserCheck className="w-6 h-6 text-gray-300 dark:text-slate-600 stroke-[1.5]" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-slate-400 text-center whitespace-nowrap">
                      Your QR check-in records will appear here
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-300 dark:text-slate-500 font-medium">
                    Present your QR pass to your tutor to record attendance
                  </p>
                </div>
              ) : (
                recentScans.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 dark:bg-[#111111] hover:bg-gray-100/60 dark:hover:bg-[#161616] rounded-md border border-gray-100 dark:border-[#1A1A1A] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-800 dark:text-slate-100 leading-tight truncate">
                        {user?.full_name || studentFirstName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800/40">
                        <CheckCircle2 className="w-3 h-3" />
                        {log.date ? `${formatDateString(log.date)} | ` : ''}{log.time_in ? formatTimeString(log.time_in) : 'Logged'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Attendance Stat Containers ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* TOTAL PRESENT */}
        <div className="rounded-md border border-emerald-500 dark:border-emerald-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#0A0A0A]">
          <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={3} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">TOTAL PRESENT</p>
            <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">{totalPresent}</p>
            <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s total present records</p>
          </div>
        </div>

        {/* TOTAL ABSENT */}
        <div className="rounded-md border border-rose-500 dark:border-rose-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#0A0A0A]">
          <X className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">TOTAL ABSENT</p>
            <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-100 mt-0.5">{totalAbsent}</p>
            <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s total absent records</p>
          </div>
        </div>

        {/* AVERAGE ATTENDANCE RATE */}
        <div className="rounded-md border border-gray-200 bg-white p-4 min-h-[100px] flex flex-col justify-center dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">AVERAGE ATTENDANCE RATE</p>
            <p
              className={`text-2xl font-extrabold mt-0.5 ${
                !hasAttendanceData
                  ? 'text-gray-900 dark:text-slate-100'
                  : attendanceRate >= 81
                  ? 'text-risk-low text-emerald-600 dark:text-emerald-400'
                  : attendanceRate >= 75
                  ? 'text-risk-medium text-amber-600 dark:text-amber-400'
                  : 'text-risk-high text-rose-600 dark:text-rose-400'
              }`}
            >
              {hasAttendanceData ? `${smartPct(attendanceRate)}%` : '—'}
            </p>
            <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s average attendance rate</p>
          </div>
        </div>
      </div>

      {/* ── Attendance History ──── */}
      <div className="mt-2.5 sm:mt-4 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] relative">
        {/* Section Header with Pills and Calendar */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3.5 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
          <div className="min-w-0 flex-1 truncate">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-xs sm:text-sm uppercase truncate">
              {studentFirstName}'S ATTENDANCE HISTORY
            </h3>
            <p className="mt-0.5 text-[10px] sm:text-xs font-medium text-gray-500 dark:text-slate-400 truncate">
              {currentRecordsCount} Record{currentRecordsCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 dark:bg-[#111111] rounded-md p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  id={`student-att-view-${mode}`}
                  type="button"
                  onClick={() => {
                    setViewMode(mode);
                    setJumpDate(null);
                  }}
                  className={`h-7.5 sm:h-7 whitespace-nowrap rounded-sm px-2 sm:px-3 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    viewMode === mode && !jumpDate
                      ? 'bg-[var(--brand)] text-white'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Custom Calendar Dropdown Button */}
            <div className="relative inline-flex items-center shrink-0">
              <button
                type="button"
                id="student-attendance-calendar-btn"
                onClick={() => setShowCalendarPopover((prev) => !prev)}
                className={`flex h-7.5 w-7.5 sm:h-8 sm:w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border p-0 transition-all ${
                  jumpDate
                    ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                    : 'border-[var(--brand-border)] bg-[var(--brand-light)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)]'
                }`}
                title="Select a specific date from calendar"
                aria-label="Open Calendar"
              >
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {showCalendarPopover && (
                <CustomCalendarDropdown
                  selectedDate={jumpDate}
                  onSelectDate={(d) => {
                    setJumpDate(d);
                    setShowCalendarPopover(false);
                  }}
                  onClear={() => {
                    setJumpDate(null);
                    setShowCalendarPopover(false);
                  }}
                  onClose={() => setShowCalendarPopover(false)}
                  loggedDates={loggedDates}
                />
              )}
            </div>
          </div>
        </div>

        {/* Jump-to-date Active Chip */}
        {jumpDate && (
          <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-50 dark:border-[#1A1A1A] bg-emerald-50/60 dark:bg-emerald-950/20">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {new Date(jumpDate + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <button
              onClick={() => setJumpDate(null)}
              className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="p-4 sm:p-5">
          {logsLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-3 w-48 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="flex-1 h-px bg-gray-100 dark:bg-[#1A1A1A]" />
                <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
              <div className="h-12 rounded-md bg-gray-100 dark:bg-gray-800/60" />
              <div className="flex items-center gap-3 mb-2 mt-4">
                <div className="h-3 w-48 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="flex-1 h-px bg-gray-100 dark:bg-[#1A1A1A]" />
                <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
              <div className="h-12 rounded-md bg-gray-100 dark:bg-gray-800/60" />
            </div>
          ) : logsError ? (
            <div className="py-12 flex flex-col items-center justify-center text-rose-500 text-xs font-semibold gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{logsError}</span>
            </div>
          ) : jumpFiltered !== null ? (
            jumpFiltered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <CalendarDays className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                  No records for this date
                </p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">
                  Try a different date or clear the filter
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {timeGroupedHistory.map((group) => (
                  <div key={group.key}>
                    <div className="mb-2.5 flex items-center gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                        {group.label}
                      </span>
                      <div className="h-px flex-1 bg-gray-100 dark:bg-[#1A1A1A]" />
                      <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
                        {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {renderTable(sortRecords(group.records))}
                  </div>
                ))}
              </div>
            )
          ) : viewMode === 'day' ? (
            sortedHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <CalendarDays className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                  No attendance records yet
                </p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">
                  Records will appear once attendance is logged for you
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {timeGroupedHistory.map((group) => (
                  <div key={group.key}>
                    <div className="mb-2.5 flex items-center gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                        {group.label}
                      </span>
                      <div className="h-px flex-1 bg-gray-100 dark:bg-[#1A1A1A]" />
                      <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
                        {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {renderTable(sortRecords(group.records))}
                  </div>
                ))}
              </div>
            )
          ) : groupedHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarDays className="w-8 h-8 text-gray-200 dark:text-gray-700" />
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                No records to display
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedHistory.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-[#1A1A1A]" />
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
                      {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {renderTable(sortRecords(group.records))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Export Student QR Code Modal */}
      <ExportStudentQrModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        student={
          user
            ? {
                id: String(user.id),
                name: studentFormattedName,
                first_name: user.first_name,
                last_name: user.last_name,
                middle_name: user.middle_name,
                lrn: user.lrn,
              }
            : null
        }
      />
    </div>
  );
};

export default StudentQRAttendance;
