import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import {
  Clock,
  UserCheck,
  QrCode,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Wifi,
  Users,
  CalendarDays,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Check,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  X,
  Search,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { Attendance, User, AttendanceSession } from '../../types';
import { ExportAttendanceModal } from '../../components/ExportAttendanceModal';

interface StoredSessionData {
  session: AttendanceSession;
  durationMinutes: number;
  localExpiresAt: number;
}

const getStorageKey = (userId?: string | number) =>
  userId ? `aralert_tutor_qr_session_${userId}` : null;

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

import { getStudentInitials as getInitials } from '../../utils/studentFormatters';

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
];

const avatarColor = (name: string) =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

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
      className={`${className || 'absolute right-0 top-full mt-2'} z-[60] w-72 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl font-sans select-none text-slate-800 animate-in fade-in zoom-in-95 duration-150`}
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif", ...style }}
    >
      {/* Month & Navigation in Poppins */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          aria-label="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-xs text-slate-900 tracking-wide">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          aria-label="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekdays in Poppins */}
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400 py-2 text-[10px] uppercase tracking-wider">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      {/* Day Numbers in Poppins */}
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
                  ? 'bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200'
                  : 'text-slate-600 hover:bg-slate-100'
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
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => {
            onSelectDate(todayStr);
            onClose();
          }}
          className="text-[var(--brand)] hover:underline cursor-pointer"
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
            className="text-slate-400 hover:text-red-500 transition cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

const formatEditTime = (value: string) => {
  if (!value) return 'Set time';
  const [hours, minutes] = value.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`;
};

const updateEditTimePart = (currentTime: string, part: 'hour' | 'minute' | 'period', partValue: string) => {
  const [rawHours, rawMinutes] = currentTime ? currentTime.split(':').map(Number) : [0, 0];
  const currentPeriod = rawHours >= 12 ? 'PM' : 'AM';
  const currentHour = rawHours % 12 || 12;
  const hour = part === 'hour' ? Number(partValue) : currentHour;
  const minute = part === 'minute' ? Number(partValue) : rawMinutes;
  const period = part === 'period' ? partValue : currentPeriod;
  let hours24 = hour % 12;
  if (period === 'PM') hours24 += 12;
  return `${String(hours24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const AttendanceTable: React.FC<{
  logs: Attendance[];
  statusBadge: (status: string, display: string) => React.ReactNode;
  avatarColor: (name: string) => string;
  getInitials: (name: string) => string;
  formatDateString: (value: string | null) => string;
  formatTimeString: (value: string | null) => string;
  onUpdate: (id: number, data: Partial<Pick<Attendance, 'date' | 'status' | 'time_in' | 'time_out'>>) => Promise<Attendance>;
}> = ({ logs, statusBadge, avatarColor, getInitials, formatDateString, formatTimeString, onUpdate }) => {
  type SortKey = 'student' | 'date' | 'time' | 'status';
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStatus, setEditStatus] = useState<Attendance['status']>('present');
  const [editTimeIn, setEditTimeIn] = useState('');
  const [editTimeOut, setEditTimeOut] = useState('');
  const [openPicker, setOpenPicker] = useState<'date' | 'time' | null>(null);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const pickerAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  });

  const sortedLogs = useMemo(() => {
    const getSortValue = (log: Attendance) => {
      switch (sortConfig.key) {
        case 'student': return log.user_name || '';
        case 'date': return log.date || '';
        case 'time': return log.time_in || '';
        case 'status': return log.status_display || log.status || '';
      }
    };

    return [...logs].sort((a, b) => {
      const result = String(getSortValue(a)).localeCompare(String(getSortValue(b)), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [logs, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const startEditing = (log: Attendance) => {
    setEditingId(log.id);
    setEditDate(log.date);
    setEditStatus(log.status);
    setEditTimeIn(log.time_in?.slice(0, 5) || '');
    setEditTimeOut(log.time_out?.slice(0, 5) || '');
    setOpenPicker(null);
  };

  const cancelEditing = () => setEditingId(null);

  const togglePicker = (picker: 'date' | 'time', event: React.MouseEvent<HTMLButtonElement>) => {
    if (openPicker === picker) {
      setOpenPicker(null);
      return;
    }
    pickerAnchorRef.current = event.currentTarget;
    const bounds = event.currentTarget.getBoundingClientRect();
    const width = picker === 'date' ? 288 : 160;
    setPickerPosition({
      top: bounds.bottom + 8,
      left: Math.max(8, bounds.right - width),
    });
    setOpenPicker(picker);
  };

  useEffect(() => {
    if (!openPicker) return;
    const updatePickerPosition = () => {
      const anchor = pickerAnchorRef.current;
      if (!anchor) return;
      const bounds = anchor.getBoundingClientRect();
      const width = openPicker === 'date' ? 288 : 160;
      setPickerPosition({ top: bounds.bottom + 8, left: Math.max(8, bounds.right - width) });
    };
    window.addEventListener('scroll', updatePickerPosition, true);
    window.addEventListener('resize', updatePickerPosition);
    return () => {
      window.removeEventListener('scroll', updatePickerPosition, true);
      window.removeEventListener('resize', updatePickerPosition);
    };
  }, [openPicker]);

  const saveEditing = async () => {
    if (editingId === null || !editDate) return;
    setIsSaving(true);
    try {
      await onUpdate(editingId, {
        date: editDate,
        status: editStatus,
        time_in: editTimeIn ? `${editTimeIn}:00` : null,
        time_out: editTimeOut ? `${editTimeOut}:00` : null,
      });
      setEditingId(null);
    } catch (error: any) {
      alert(error?.response?.data?.detail || error?.response?.data?.error || 'Failed to update attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  const SortableHeader: React.FC<{ label: string; sortKey: SortKey }> = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-gray-700"
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

  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="min-w-[680px] w-full divide-y divide-gray-100 dark:divide-slate-700 text-sm">
        <thead>
        <tr className="divide-x divide-gray-100 dark:divide-slate-700 bg-gray-50 dark:bg-slate-900">
            <th className="w-[32%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400"><SortableHeader label="STUDENT" sortKey="student" /></th>
            <th className="w-[25%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400"><SortableHeader label="DATE" sortKey="date" /></th>
            <th className="w-[18%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400"><SortableHeader label="TIME" sortKey="time" /></th>
            <th className="w-[15%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400"><SortableHeader label="STATUS" sortKey="status" /></th>
            <th className="w-[10%] px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white dark:divide-slate-700 dark:bg-slate-900">
          {sortedLogs.map((log) => (
            <tr key={log.id} className="group divide-x divide-gray-100 dark:divide-slate-700 transition-colors hover:bg-gray-50/80 dark:hover:bg-slate-800">
              <td className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarColor(log.user_name || '')}`}>
                    {getInitials(log.user_name || '?')}
                  </div>
                  {log.user_name}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs">
                {editingId === log.id ? (
                  <div className="relative inline-block">
                    <button type="button" onClick={(event) => togglePicker('date', event)} className="h-9 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold outline-none transition-all cursor-pointer hover:bg-gray-100 hover:text-gray-700" style={{ color: editDate ? '#1f2937' : '#9ca3af' }}>
                      {editDate || 'Select date'}
                    </button>
                    {openPicker === 'date' && createPortal(
                        <CustomCalendarDropdown
                          selectedDate={editDate}
                          onSelectDate={setEditDate}
                          onClear={() => setEditDate('')}
                          onClose={() => setOpenPicker(null)}
                          loggedDates={new Set(logs.map((attendance) => attendance.date))}
                          className="fixed"
                          style={{ position: 'fixed', top: pickerPosition.top, left: pickerPosition.left, marginTop: 0 }}
                        />,
                        document.body
                    )}
                  </div>
                ) : formatDateString(log.date)}
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs">
                {editingId === log.id ? (
                  <div className="relative inline-block">
                    <button type="button" onClick={(event) => togglePicker('time', event)} className="h-9 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold outline-none transition-all cursor-pointer hover:bg-gray-100 hover:text-gray-700" style={{ color: editTimeIn ? '#1f2937' : '#9ca3af' }}>
                      {formatEditTime(editTimeIn)}
                    </button>
                    {openPicker === 'time' && createPortal(
                      <div className="absolute z-[60] w-64 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl font-sans text-slate-800 animate-in fade-in zoom-in-95 duration-150" style={{ top: pickerPosition.top, left: pickerPosition.left, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Set time</p>
                        <div className="grid grid-cols-3 gap-2">
                          <select value={String(Number(editTimeIn ? editTimeIn.split(':')[0] : 0) % 12 || 12)} onChange={(event) => setEditTimeIn(updateEditTimePart(editTimeIn, 'hour', event.target.value))} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[var(--brand)]">
                            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                          </select>
                          <select value={String(Number(editTimeIn ? editTimeIn.split(':')[1] : 0)).padStart(2, '0')} onChange={(event) => setEditTimeIn(updateEditTimePart(editTimeIn, 'minute', event.target.value))} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[var(--brand)]">
                            {Array.from({ length: 60 }, (_, index) => <option key={index} value={String(index).padStart(2, '0')}>{String(index).padStart(2, '0')}</option>)}
                          </select>
                          <select value={editTimeIn && Number(editTimeIn.split(':')[0]) >= 12 ? 'PM' : 'AM'} onChange={(event) => setEditTimeIn(updateEditTimePart(editTimeIn, 'period', event.target.value))} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[var(--brand)]">
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                        <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-2.5 text-[11px] font-semibold">
                          <button type="button" onClick={() => setOpenPicker(null)} className="text-[var(--brand)] transition hover:underline">Done</button>
                        </div>
                      </div>,
                      document.body
                      )}
                  </div>
                ) : formatTimeString(log.time_in)}
              </td>
              <td className="px-4 py-3">
                {editingId === log.id ? (
                  <select value={editStatus} onChange={(event) => setEditStatus(event.target.value as Attendance['status'])} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-[var(--brand)]">
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="absent">Absent</option>
                  </select>
                ) : (
                  statusBadge(log.status, log.status_display)
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {editingId === log.id ? (
                  <div className="inline-flex items-center gap-1.5">
                    <button type="button" onClick={saveEditing} disabled={isSaving} className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" aria-label="Save attendance changes" title="Save attendance changes">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={cancelEditing} disabled={isSaving} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50" aria-label="Cancel attendance changes" title="Cancel attendance changes">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => startEditing(log)} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700" aria-label={`Edit attendance for ${log.user_name}`} title="Edit attendance">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ─────────────────────────── component ─────────────────────────── */
export const TutorQRGenerator: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [expiresIn, setExpiresIn] = useState<number>(5);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [scannedStudents, setScannedStudents] = useState<Attendance[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([]);
  const [attendanceHistoryLoading, setAttendanceHistoryLoading] = useState<boolean>(true);
  const [attendanceHistoryError, setAttendanceHistoryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // ── Attendance history view state ─────────────────────────────────
  // viewMode: how records are displayed / grouped
  // jumpDate: when set, filters the view to exactly that date
  type ViewMode = 'day' | 'week' | 'month';
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Confirmation alert modal state
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmStyle: 'brand' | 'danger';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    confirmStyle: 'brand',
    onConfirm: () => {},
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Data fetching ──────────────────────────────────────────────
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

  const fetchAttendanceHistory = useCallback(async () => {
    setAttendanceHistoryLoading(true);
    setAttendanceHistoryError(null);
    try {
      const logs = await academicService.getAttendanceHistory();
      setAttendanceHistory(logs);
    } catch (err: any) {
      console.error('Failed to load attendance history', err);
      setAttendanceHistoryError(err.response?.data?.error || 'Failed to load attendance history.');
    } finally {
      setAttendanceHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendanceHistory();
  }, [fetchAttendanceHistory]);

  const handleUpdateAttendance = async (id: number, data: Partial<Pick<Attendance, 'date' | 'status' | 'time_in' | 'time_out'>>) => {
    const updatedAttendance = await academicService.updateAttendance(id, data);
    setAttendanceHistory((current) => current.map((log) => log.id === id ? updatedAttendance : log));
    setScannedStudents((current) => current.map((log) => log.id === id ? updatedAttendance : log));
    return updatedAttendance;
  };

  // ── Cleanup on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── QR canvas render ───────────────────────────────────────────
  useEffect(() => {
    if (session?.id && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        session.id,
        {
          width: 256,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        },
        (err) => {
          if (err) console.error('QR Render Error:', err);
        }
      );
    }
  }, [session?.id, session?.is_active]);

  // ── Polling & Timer helpers ────────────────────────────────────
  const calcRemainingSeconds = (targetSession: AttendanceSession, localExpiresAt?: number) => {
    if (localExpiresAt && localExpiresAt > 0) {
      const diff = Math.floor((localExpiresAt - Date.now()) / 1000);
      return Math.max(0, diff);
    }
    if (targetSession.expires_at) {
      const diff = Math.floor((new Date(targetSession.expires_at).getTime() - Date.now()) / 1000);
      return Math.max(0, diff);
    }
    return Math.max(0, targetSession.time_left || 0);
  };

  const startPolling = useCallback((sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const todayStr = new Date().toLocaleDateString('en-CA');
    const fetchLogs = async () => {
      try {
        const logs = await academicService.getAttendanceHistory({ date: todayStr });
        setScannedStudents(logs.filter((log) => log.session === sessionId));
      } catch (err) {
        console.error('Error polling attendance logs:', err);
      }
    };
    void fetchLogs();
    pollRef.current = setInterval(fetchLogs, 3000);
  }, []);

  const startTimer = useCallback((targetSession: AttendanceSession, localExpiresAt?: number) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const initialRemaining = calcRemainingSeconds(targetSession, localExpiresAt);
    setTimeLeft(initialRemaining);

    timerRef.current = setInterval(() => {
      const remaining = calcRemainingSeconds(targetSession, localExpiresAt);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (pollRef.current) clearInterval(pollRef.current);

        const storageKey = getStorageKey(user?.id);
        if (storageKey) {
          localStorage.removeItem(storageKey);
        }

        if (targetSession.id) {
          void academicService.closeAttendanceSession(targetSession.id).catch(() => {});
        }

        setSession((curr) => (curr ? { ...curr, is_active: false, time_left: 0 } : null));
        void fetchAttendanceHistory();
      }
    }, 1000);
  }, [user?.id, fetchAttendanceHistory]);

  // ── Restore active QR session across page switch, browser reload, or re-login ──
  useEffect(() => {
    if (!user) return;
    const storageKey = getStorageKey(user.id);
    let isMounted = true;

    // 1. Instant optimistic restore from localStorage if exists and not expired
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed: StoredSessionData = JSON.parse(raw);
          const remaining = calcRemainingSeconds(parsed.session, parsed.localExpiresAt);
          if (parsed.session && parsed.session.is_active && remaining > 0) {
            setSession(parsed.session);
            setTimeLeft(remaining);
            if (parsed.durationMinutes) {
              setExpiresIn(parsed.durationMinutes);
            }
            startTimer(parsed.session, parsed.localExpiresAt);
            startPolling(parsed.session.id);
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }

    // 2. Query backend for authoritative active session
    academicService.getActiveAttendanceSession('student')
      .then((activeSession) => {
        if (!isMounted) return;

        if (activeSession && activeSession.is_active) {
          const remaining = typeof activeSession.time_left === 'number'
            ? activeSession.time_left
            : calcRemainingSeconds(activeSession);

          if (remaining > 0) {
            const localExpiresAt = Date.now() + remaining * 1000;
            setSession(activeSession);
            setTimeLeft(remaining);

            const durationMinutes = expiresIn || Math.max(5, Math.ceil(remaining / 60));
            if (storageKey) {
              localStorage.setItem(
                storageKey,
                JSON.stringify({
                  session: activeSession,
                  durationMinutes,
                  localExpiresAt,
                })
              );
            }

            startTimer(activeSession, localExpiresAt);
            startPolling(activeSession.id);
          } else {
            if (storageKey) localStorage.removeItem(storageKey);
            setSession((curr) => (curr ? { ...curr, is_active: false, time_left: 0 } : null));
            if (timerRef.current) clearInterval(timerRef.current);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } else {
          if (storageKey) localStorage.removeItem(storageKey);
          setSession(null);
          if (timerRef.current) clearInterval(timerRef.current);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      })
      .catch((err) => {
        console.error('Failed to sync active attendance session:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [user, startTimer, startPolling]);

  // ── Actions ────────────────────────────────────────────────────
  const generateStudentQR = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);

      const payload: any = { session_type: 'student', expires_in_minutes: expiresIn };

      const newSession = await academicService.createAttendanceSession(payload);
      setSession(newSession);
      const remaining = newSession.time_left || expiresIn * 60;
      setTimeLeft(remaining);
      setScannedStudents([]);

      const localExpiresAt = Date.now() + remaining * 1000;
      const storageKey = getStorageKey(user?.id);
      if (storageKey) {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            session: newSession,
            durationMinutes: expiresIn,
            localExpiresAt,
          })
        );
      }

      startTimer(newSession, localExpiresAt);
      startPolling(newSession.id);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to generate QR session.');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSession = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);

    const storageKey = getStorageKey(user?.id);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }

    if (session?.id) {
      try {
        await academicService.closeAttendanceSession(session.id);
      } catch (err) {
        console.error('Failed to close session:', err);
      }
    }
    setSession(null);
    setScannedStudents([]);
    void fetchAttendanceHistory();
  };

  const handleGenerateNewClick = () => {
    if (session && session.is_active) {
      setConfirmAction({
        isOpen: true,
        title: 'Generate New QR Code',
        message: 'Generating a new QR code will end the current active session. Are you sure you want to proceed?',
        confirmText: 'Generate New',
        confirmStyle: 'brand',
        onConfirm: () => {
          setConfirmAction((prev) => ({ ...prev, isOpen: false }));
          generateStudentQR();
        },
      });
    } else {
      generateStudentQR();
    }
  };

  const handleCancelSessionClick = () => {
    setConfirmAction({
      isOpen: true,
      title: 'Cancel Attendance Session',
      message: 'Are you sure you want to close this attendance session? Students will no longer be able to scan this QR code.',
      confirmText: 'Yes, Close Session',
      confirmStyle: 'danger',
      onConfirm: () => {
        setConfirmAction((prev) => ({ ...prev, isOpen: false }));
        cancelSession();
      },
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = Math.max(expiresIn * 60, timeLeft);
  const progressPct = session?.is_active && totalDuration > 0
    ? Math.min(100, Math.max(0, Math.round(((totalDuration - timeLeft) / totalDuration) * 100)))
    : 100;

  // ── Attendance history helpers ───────────────────────────────────

  // Sort all records newest-first
  const sortedHistory = useMemo(
    () => [...attendanceHistory].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)),
    [attendanceHistory]
  );

  const filteredHistory = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return sortedHistory;
    return sortedHistory.filter((log) =>
      [log.user_name, log.user_lrn].some((value) => value?.toLowerCase().includes(query))
    );
  }, [sortedHistory, studentSearch]);

  // When jumpDate is active, we always show a flat filtered list
  const jumpFiltered = useMemo(
    () => jumpDate ? filteredHistory.filter(l => l.date === jumpDate) : null,
    [filteredHistory, jumpDate]
  );

  // Group by week key "YYYY-Www" (ISO Mon-Sun)
  const getWeekKey = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return mon.toISOString().slice(0, 10); // Monday of that week
  };

  const weekLabel = (mondayStr: string) => {
    const mon = new Date(mondayStr + 'T00:00:00');
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(mon)} – ${fmt(sun)}, ${sun.getFullYear()}`;
  };

  // Group by month key "YYYY-MM"
  const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);
  const monthLabel = (key: string) => {
    const d = new Date(key + '-01T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  // Build grouped structure for weekly / monthly views
  type Group = { key: string; label: string; records: typeof sortedHistory };
  const groupedHistory = useMemo((): Group[] => {
    if (jumpFiltered !== null) return []; // not used when jumping
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of filteredHistory) {
      const key = viewMode === 'week' ? getWeekKey(log.date) : getMonthKey(log.date);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    // Sort groups descending
    return Array.from(grouped.entries())
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, records]) => ({
        key,
        label: viewMode === 'week' ? weekLabel(key) : monthLabel(key),
        records,
      }));
  }, [filteredHistory, viewMode, jumpFiltered]);

  const timeGroupedHistory = useMemo((): Group[] => {
    const source = jumpFiltered ?? filteredHistory;
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of source) {
      const key = `${log.date}|${formatTimeString(log.time_in)}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    return Array.from(grouped.entries()).map(([key, records]) => {
      const [date, time] = key.split('|');
      return {
        key,
        label: `${formatDateString(date)} | ${time}`,
        records,
      };
    });
  }, [filteredHistory, jumpFiltered]);

  const statusBadge = (status: string, display: string) => {
    const map: Record<string, string> = {
      present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      late:    'bg-amber-50  text-amber-700  border-amber-200',
      absent:  'bg-rose-50   text-rose-700   border-rose-200',
    };
    const cls = map[status] ?? 'bg-gray-50 text-gray-600 border-gray-200';
      return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${cls}`}>
        {display || status}
      </span>
    );
  };

  /* ─────────────────────────── render ─────────────────────────── */
  return (
    <div className="space-y-6 max-w-6xl mx-auto data-loaded-content">

      {/* ── Main Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── LEFT: QR Generator ─────────────────────────────────── */}
        <div className="lg:col-span-7">
          <div className="h-full rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">

            {/* Card Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900 mt-0.5">SESSION SETUP</h2>
                <p className="mt-0.5 text-xs font-medium text-gray-500">Generate attendance QR code</p>
              </div>
              {session && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border ${
                  session.is_active
                    ? 'bg-[var(--brand-light)] text-[var(--brand)] border-[var(--brand-border)]'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${session.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
                  {session.is_active ? 'Active' : 'Expired'}
                </span>
              )}
            </div>

            <div className="p-6 flex flex-col gap-5">

              {!session && (
                <div className="order-2 rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-4">
                  {/* Duration */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-3">
                      <Clock className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                      Session Duration
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 15, 30].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setExpiresIn(mins)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            expiresIn === mins
                              ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-sm'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-[var(--brand)] hover:text-[var(--brand)]'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {!session ? (
                <button
                  onClick={generateStudentQR}
                  disabled={isLoading}
                  className="order-3 w-full flex items-center justify-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white py-3 rounded-2xl text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating session...
                    </>
                  ) : (
                    'Generate QR Code'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleGenerateNewClick}
                  disabled={isLoading}
                  className="order-3 w-full flex items-center justify-center gap-2 border border-[var(--brand)] text-[var(--brand)] hover:bg-[var(--brand-light)] py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer disabled:opacity-70"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Creating...' : 'Generate New QR Code'}
                </button>
              )}

              {error && (
                <div className="order-4 flex items-start gap-2.5 w-full bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  {error}
                </div>
              )}

              {/* QR Display */}
              <div className="order-1 mx-auto w-full max-w-sm">
                <div className="relative flex min-h-[300px] items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/60 p-4 overflow-hidden">

                  {/* Corner scan-frame decorations */}
                  {session && session.is_active && (
                    <>
                      <span className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[var(--brand)] rounded-tl-md" />
                      <span className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[var(--brand)] rounded-tr-md" />
                      <span className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[var(--brand)] rounded-bl-md" />
                      <span className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[var(--brand)] rounded-br-md" />
                    </>
                  )}

                  {session ? (
                    <>
                      <div className="flex h-[264px] w-[264px] items-center justify-center rounded-2xl border border-gray-200 dark:border-slate-600 bg-white p-3 shadow-md">
                        <canvas ref={canvasRef} className="block h-full w-full rounded-xl" />
                      </div>

                      {/* Expired overlay */}
                      {!session.is_active && (
                        <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 gap-3">
                          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 flex items-center justify-center">
                            <Clock className="w-7 h-7 text-red-500" />
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">Session Expired</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Generate a new QR code to continue</p>
                          </div>
                          <button
                            onClick={() => {
                              const storageKey = getStorageKey(user?.id);
                              if (storageKey) localStorage.removeItem(storageKey);
                              setSession(null);
                              setScannedStudents([]);
                              void fetchAttendanceHistory();
                            }}
                            className="mt-1 px-5 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center">
                        <QrCode className="w-8 h-8 text-gray-300 dark:text-slate-600" />
                      </div>
                      <p className="text-xs font-medium text-gray-400 dark:text-slate-400 text-center max-w-[180px]">
                        Your QR code appears here
                      </p>
                    </div>
                  )}
                </div>

                {/* Countdown + session info */}
                {session?.is_active && (
                  <div className="mt-4 space-y-3">
                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-slate-100">
                          <Clock className="w-3.5 h-3.5 text-gray-900 dark:text-slate-100" />
                          Time Remaining
                        </div>
                        <span className="text-sm font-bold font-mono text-gray-900 dark:text-slate-100">{formatTime(timeLeft)}</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-black dark:bg-white transition-all duration-1000"
                          style={{ width: `${100 - progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Session meta */}
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="font-semibold text-gray-500 dark:text-slate-400">Session ID:</span>
                      <code className="text-xs font-mono font-bold text-gray-900 dark:text-slate-100 select-all truncate tracking-wider">{session.id}</code>
                    </div>

                    <button
                      onClick={handleCancelSessionClick}
                      className="w-full text-center text-xs text-gray-400 hover:text-red-500 font-semibold transition-colors py-1 cursor-pointer"
                    >
                      Cancel &amp; Close Session
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Live Check-in Feed ──────────────────────────── */}
        <div className="lg:col-span-5">
          <div className="flex h-full min-h-[480px] flex-col rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">

            {/* Feed header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-base">STUDENT ATTENDANCE FEED</h3>
                <p className="mt-0.5 text-xs font-medium text-gray-500">QR code scans</p>
              </div>
              {session && (
                <div className="flex items-center gap-1.5 bg-[var(--brand-light)] border border-[var(--brand-border)] rounded-full px-3 py-1.5">
                  <Users className="w-3.5 h-3.5 text-[var(--brand)]" />
                  <span className="text-xs font-bold text-[var(--brand)]">{scannedStudents.length} Checked In</span>
                </div>
              )}
            </div>

            {/* Feed list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {scannedStudents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3 min-h-[280px]">
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                    <UserCheck className="w-8 h-8 text-gray-300 stroke-[1.5]" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-slate-400 text-center whitespace-nowrap">Students that scan the QR code appears here</p>
                  </div>
                  {!session && (
                    <p className="text-[11px] text-gray-300 font-medium">Generate a QR session to begin</p>
                  )}
                </div>
              ) : (
                scannedStudents.map((log, idx) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3 p-3 bg-gray-50 hover:bg-gray-100/60 rounded-2xl border border-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(log.user_name || '')}`}>
                        {getInitials(log.user_name || '?')}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800 leading-tight">{log.user_name}</p>
                        <p className="text-[11px] text-gray-400">LRN: {log.user_lrn || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3" />
                        {log.time_in ? formatTimeString(log.time_in) : 'Logged'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Attendance History ───────────────────────────────────── */}
      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm relative" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>

        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">STUDENTS ATTENDANCE HISTORY</h3>
            <p className="mt-0.5 text-xs font-medium text-gray-500">
              {jumpFiltered !== null ? jumpFiltered.length : filteredHistory.length} Record{(jumpFiltered !== null ? jumpFiltered.length : filteredHistory.length) !== 1 ? 's' : ''}
            </p>
          </div>

          {/* ── Controls ── */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex min-w-52 items-center">
              <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-gray-400" />
              <input
                type="search"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Search Student Name"
                aria-label="Search attendance history by student"
                className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs font-semibold text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white focus:ring-2 focus:ring-[var(--brand)]/10"
              />
            </label>

            {/* View mode toggle styled like TutorHome trend filter */}
            <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-0.5 gap-0.5">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  id={`qr-view-${mode}`}
                  type="button"
                  onClick={() => { setViewMode(mode); setJumpDate(null); }}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    viewMode === mode && !jumpDate
                      ? 'bg-[var(--brand)] text-white shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Custom Calendar Dropdown Button in Poppins */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                id="qr-attendance-calendar-btn"
                onClick={() => setShowCalendarPopover((prev) => !prev)}
                className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                  jumpDate
                    ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-sm'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
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
                  loggedDates={new Set(attendanceHistory.map((l) => l.date))}
                />
              )}
            </div>

            {/* Export Attendance Sheet button */}
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              Export Attendance Sheet
            </button>
          </div>
        </div>

        {/* Jump-to-date active chip */}
        {jumpDate && (
          <div className="flex items-center gap-2 px-6 py-2 border-b border-gray-50 bg-emerald-50/60">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">
              {new Date(jumpDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <button
              onClick={() => setJumpDate(null)}
              className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6">
          {attendanceHistoryLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-11 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse flex items-center px-4 gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                  <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/5 ml-auto" />
                </div>
              ))}
            </div>
          ) : attendanceHistoryError ? (
            <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              {attendanceHistoryError}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarDays className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-semibold text-gray-500">
                {studentSearch.trim() ? 'No matching attendance records' : 'No attendance records yet'}
              </p>
              <p className="text-xs text-gray-400">
                {studentSearch.trim() ? 'Try a different student name or LRN' : 'Records will appear once students start scanning'}
              </p>
            </div>

          ) : jumpFiltered !== null ? (
            /* ── Jump-to-date: flat list for that specific day ── */
            jumpFiltered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <CalendarDays className="w-10 h-10 text-gray-200" />
                <p className="text-sm font-semibold text-gray-500">No records for this date</p>
                <p className="text-xs text-gray-400">Try a different date or clear the filter</p>
              </div>
            ) : (
              <div className="space-y-6">
                {timeGroupedHistory.map((group) => (
                  <div key={group.key}>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{group.label}</span>
                      <div className="h-px flex-1 bg-gray-100" />
                      <span className="text-[11px] font-semibold text-gray-400">{group.records.length} Record{group.records.length !== 1 ? 's' : ''}</span>
                    </div>
                    <AttendanceTable logs={group.records} statusBadge={statusBadge} avatarColor={avatarColor} getInitials={getInitials} formatDateString={formatDateString} formatTimeString={formatTimeString} onUpdate={handleUpdateAttendance} />
                  </div>
                ))}
              </div>
            )

          ) : viewMode === 'day' ? (
            /* ── Day: grouped by date and time ── */
            <div className="space-y-6">
              {timeGroupedHistory.map((group) => (
                <div key={group.key}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{group.label}</span>
                    <div className="h-px flex-1 bg-gray-100" />
                    <span className="text-[11px] font-semibold text-gray-400">{group.records.length} Record{group.records.length !== 1 ? 's' : ''}</span>
                  </div>
                  <AttendanceTable logs={group.records} statusBadge={statusBadge} avatarColor={avatarColor} getInitials={getInitials} formatDateString={formatDateString} formatTimeString={formatTimeString} onUpdate={handleUpdateAttendance} />
                </div>
              ))}
            </div>

          ) : (
            /* ── Weekly / Monthly: grouped ── */
            groupedHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <CalendarDays className="w-10 h-10 text-gray-200" />
                <p className="text-sm font-semibold text-gray-500">No records to display</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedHistory.map((group) => (
                  <div key={group.key}>
                    {/* Group divider header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{group.label}</span>
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-[11px] font-semibold text-gray-400">{group.records.length} Record{group.records.length !== 1 ? 's' : ''}</span>
                    </div>
                    <AttendanceTable logs={group.records} statusBadge={statusBadge} avatarColor={avatarColor} getInitials={getInitials} formatDateString={formatDateString} formatTimeString={formatTimeString} onUpdate={handleUpdateAttendance} />
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <ExportAttendanceModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentUser={user}
        students={students}
        attendanceLogs={attendanceHistory}
      />

      {/* ── Confirmation Alert Modal ── */}
      {confirmAction.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
        >
          <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                {confirmAction.title}
              </h3>
              <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400 leading-relaxed">
                {confirmAction.message}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction((prev) => ({ ...prev, isOpen: false }))}
                className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction.onConfirm}
                className={`rounded-xl px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer ${
                  confirmAction.confirmStyle === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[var(--brand)] hover:bg-[var(--brand-dark)]'
                }`}
              >
                {confirmAction.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorQRGenerator;
