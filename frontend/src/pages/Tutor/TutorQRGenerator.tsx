import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import { timeService } from '../../services/timeService';
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
  User as UserIcon,
  Camera,
  CameraOff,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import type { Attendance, User, AttendanceSession } from '../../types';
import { ExportAttendanceModal } from '../../components/ExportAttendanceModal';
import { matchesSearch } from '../../utils/searchHelpers';
import { compareNamesByLastName } from '../../utils/studentFormatters';

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

const timeToMinutes = (timeStr: string | null | undefined): number | null => {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
};

const SESSION_TIMES_STORAGE_KEY = 'aralert_session_launch_times';
const getStoredSessionTimes = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(SESSION_TIMES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const storeSessionTime = (sessionId: string, timeStr: string) => {
  try {
    const current = getStoredSessionTimes();
    current[sessionId] = timeStr;
    localStorage.setItem(SESSION_TIMES_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore localStorage errors
  }
};

import { getStudentAvatarColor as avatarColor } from '../../utils/studentFormatters';

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
      className={`${className || 'absolute right-0 top-full mt-2'} z-[60] w-72 rounded-lg border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 shadow-xl font-sans select-none text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150`}
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif", ...style }}
    >
      {/* Month & Navigation in Poppins */}
      <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-[#1A1A1A]">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 transition cursor-pointer"
          aria-label="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 tracking-wide">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 transition cursor-pointer"
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
  formatDateString: (value: string | null) => string;
  formatTimeString: (value: string | null) => string;
  onUpdate: (id: number, data: Partial<Pick<Attendance, 'date' | 'status' | 'time_in' | 'time_out'>>) => Promise<Attendance>;
}> = ({ logs, statusBadge, avatarColor, formatDateString, formatTimeString, onUpdate }) => {
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
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });

  const sortedLogs = useMemo(() => {
    if (!sortConfig.key) return logs;
    const getSortValue = (log: Attendance) => {
      switch (sortConfig.key) {
        case 'student': return log.user_name || '';
        case 'date': return log.date || '';
        case 'time': return log.time_in || '';
        case 'status': return log.status_display || log.status || '';
        default: return '';
      }
    };

    return [...logs].sort((a, b) => {
      let result = 0;
      if (sortConfig.key === 'student') {
        result = compareNamesByLastName(a.user_name || '', b.user_name || '');
      } else {
        result = String(getSortValue(a)).localeCompare(String(getSortValue(b)), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }
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
    <div className="overflow-x-auto mobile-scroll-table -mx-2 px-2">
      <table className="min-w-[680px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm">
        <thead>
          <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#151515]">
            <th className="w-[35%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400"><SortableHeader label="STUDENT" sortKey="student" /></th>
            <th className="w-[25%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400"><SortableHeader label="DATE" sortKey="date" /></th>
            <th className="w-[20%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400"><SortableHeader label="TIME" sortKey="time" /></th>
            <th className="w-[12%] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400"><SortableHeader label="STATUS" sortKey="status" /></th>
            <th className="w-[8%] px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white dark:divide-[#1A1A1A] dark:bg-[#111111]">
          {sortedLogs.map((log) => (
            <tr key={log.id} className="group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#151515]">
              <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-slate-100 whitespace-nowrap">
                {log.user_name}
              </td>
              <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs">
                {editingId === log.id ? (
                  <div className="relative inline-block">
                    <button type="button" onClick={(event) => togglePicker('date', event)} className="h-8 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] px-2.5 text-xs font-semibold outline-none transition-all cursor-pointer hover:bg-gray-100 hover:text-gray-700" style={{ color: editDate ? '#1f2937' : '#9ca3af' }}>
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
              <td className="px-4 py-2.5 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs">
                {editingId === log.id ? (
                  <div className="relative inline-block">
                    <button type="button" onClick={(event) => togglePicker('time', event)} className="h-8 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] px-2.5 text-xs font-semibold outline-none transition-all cursor-pointer hover:bg-gray-100 hover:text-gray-700" style={{ color: editTimeIn ? '#1f2937' : '#9ca3af' }}>
                      {formatEditTime(editTimeIn)}
                    </button>
                    {openPicker === 'time' && createPortal(
                      <div className="absolute z-[60] w-64 rounded-lg border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 shadow-xl font-sans text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150" style={{ top: pickerPosition.top, left: pickerPosition.left, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Set time</p>
                        <div className="grid grid-cols-3 gap-2">
                          <select value={String(Number(editTimeIn ? editTimeIn.split(':')[0] : 0) % 12 || 12)} onChange={(event) => setEditTimeIn(updateEditTimePart(editTimeIn, 'hour', event.target.value))} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-slate-50 dark:bg-[#161616] px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-[var(--brand)]">
                            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                          </select>
                          <select value={String(Number(editTimeIn ? editTimeIn.split(':')[1] : 0)).padStart(2, '0')} onChange={(event) => setEditTimeIn(updateEditTimePart(editTimeIn, 'minute', event.target.value))} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-slate-50 dark:bg-[#161616] px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-[var(--brand)]">
                            {Array.from({ length: 60 }, (_, index) => <option key={index} value={String(index).padStart(2, '0')}>{String(index).padStart(2, '0')}</option>)}
                          </select>
                          <select value={editTimeIn && Number(editTimeIn.split(':')[0]) >= 12 ? 'PM' : 'AM'} onChange={(event) => setEditTimeIn(updateEditTimePart(editTimeIn, 'period', event.target.value))} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-slate-50 dark:bg-[#161616] px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-[var(--brand)]">
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                        <div className="mt-3 flex items-center justify-end border-t border-gray-100 dark:border-[#1A1A1A] pt-2 text-[11px] font-semibold">
                          <button type="button" onClick={() => setOpenPicker(null)} className="text-[var(--brand)] transition hover:underline">Done</button>
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                ) : formatTimeString(log.time_in)}
              </td>
              <td className="px-4 py-2.5">
                {editingId === log.id ? (
                  <select value={editStatus} onChange={(event) => setEditStatus(event.target.value as Attendance['status'])} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#161616] px-2 py-1 text-xs text-gray-700 dark:text-slate-200 outline-none focus:border-[var(--brand)]">
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                ) : (
                  statusBadge(log.status, log.status_display)
                )}
              </td>
              <td className="px-4 py-2.5 text-center">
                {editingId === log.id ? (
                  <div className="inline-flex items-center gap-1.5">
                    <button type="button" onClick={saveEditing} disabled={isSaving} className="rounded-md p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" aria-label="Save attendance changes" title="Save attendance changes">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={cancelEditing} disabled={isSaving} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50" aria-label="Cancel attendance changes" title="Cancel attendance changes">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => startEditing(log)} className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700" aria-label={`Edit attendance for ${log.user_name}`} title="Edit attendance">
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

const formatDateButtonLabel = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00`);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(d.getDate()).padStart(2, '0');
  return `${month} ${day}`;
};

const getWeekdaysForMonday = (mondayStr: string, extraDates: string[] = []): string[] => {
  const dates: string[] = [];
  const monday = new Date(`${mondayStr}T00:00:00`);
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toLocaleDateString('en-CA'));
  }
  extraDates.forEach((d) => {
    if (d && !dates.includes(d)) dates.push(d);
  });
  return dates.sort();
};

const computeWeekOfMonth = (dateObj: Date): number => {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const day = d.getDay();
  const wedDiff = day === 0 ? 3 : 3 - day;
  const wednesday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + wedDiff);
  const firstDay = new Date(wednesday.getFullYear(), wednesday.getMonth(), 1).getDay();
  return Math.ceil((wednesday.getDate() + (firstDay === 0 ? 6 : firstDay - 1)) / 7);
};

const getWeekTitle = (mondayStr: string) => {
  const d = new Date(`${mondayStr}T00:00:00`);
  const weekNum = computeWeekOfMonth(d);
  return `WEEK ${weekNum}`;
};

type AttendanceTableGroup = {
  key: string;
  title: string;
  weekMonday?: string;
  isMonthGroup?: boolean;
  records: Attendance[];
};

interface AttendanceHistoryGroupSectionProps {
  group: AttendanceTableGroup;
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  statusBadge: (status: string, display: string) => React.ReactNode;
  avatarColor: (name: string) => string;
  formatDateString: (value: string | null) => string;
  formatTimeString: (t?: string | null) => string;
  onUpdate: (id: number, data: Partial<Pick<Attendance, 'date' | 'status' | 'time_in' | 'time_out'>>) => Promise<Attendance>;
}

const AttendanceHistoryGroupSection: React.FC<AttendanceHistoryGroupSectionProps> = ({
  group,
  selectedDate,
  onSelectDate,
  statusBadge,
  avatarColor,
  formatDateString,
  formatTimeString,
  onUpdate,
}) => {
  const datesWithRecords = useMemo(() => {
    return new Set(group.records.map((r) => r.date?.slice(0, 10)));
  }, [group.records]);

  const groupDates = useMemo(() => {
    if (group.isMonthGroup) {
      return Array.from(datesWithRecords).sort();
    }
    const recordDates = Array.from(datesWithRecords);
    return getWeekdaysForMonday(group.weekMonday || group.key, recordDates);
  }, [group.isMonthGroup, group.weekMonday, group.key, datesWithRecords]);

  const isOpen = useMemo(() => {
    if (!selectedDate) return false;
    return groupDates.includes(selectedDate);
  }, [groupDates, selectedDate]);

  const displayRecords = useMemo(() => {
    if (!selectedDate || !isOpen) return group.records;
    return group.records.filter((r) => r.date?.slice(0, 10) === selectedDate);
  }, [group.records, selectedDate, isOpen]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-2.5 border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-slate-100 select-none">
              {group.title}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {groupDates.map((dateStr) => {
              const hasRecord = datesWithRecords.has(dateStr);
              const isSelected = selectedDate === dateStr;
              const label = formatDateButtonLabel(dateStr);
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={!hasRecord}
                  onClick={() => onSelectDate(dateStr)}
                  className={`h-7.5 whitespace-nowrap rounded-md px-3 text-[11px] font-bold uppercase transition-all ${
                    hasRecord
                      ? isSelected
                        ? 'bg-[var(--brand)] text-white shadow-xs font-bold border border-[var(--brand)] cursor-pointer'
                        : 'bg-blue-50/80 text-[var(--brand)] border border-blue-200/80 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 dark:hover:bg-blue-900/50 cursor-pointer font-semibold'
                      : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-[#222222] cursor-not-allowed opacity-50'
                  }`}
                  title={hasRecord ? (isSelected ? `Active: ${label}` : `View ${label}`) : `No records on ${label}`}
                  aria-label={label}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {isOpen && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400">
              {displayRecords.length} Record{displayRecords.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
      {isOpen && (
        <AttendanceTable
          logs={displayRecords}
          statusBadge={statusBadge}
          avatarColor={avatarColor}
          formatDateString={formatDateString}
          formatTimeString={formatTimeString}
          onUpdate={onUpdate}
        />
      )}
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
  type ViewMode = 'week' | 'month';
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [sessionLaunchTimes, setSessionLaunchTimes] = useState<Record<string, string>>(() => getStoredSessionTimes());

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
    onConfirm: () => { },
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const tutorScannerRef = useRef<Html5Qrcode | null>(null);

  // Tutor camera scanner state for scanning student permanent QR codes
  const [isTutorScanning, setIsTutorScanning] = useState<boolean>(false);
  const [tutorScanMessage, setTutorScanMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [tutorCameraError, setTutorCameraError] = useState<string | null>(null);
  const [isProcessingStudentScan, setIsProcessingStudentScan] = useState<boolean>(false);
  const [manualStudentInput, setManualStudentInput] = useState<string>('');

  // Restart tutor camera scanner
  const restartTutorScanner = async () => {
    await stopTutorScanner();
    setIsTutorScanning(false);
    setTimeout(() => {
      setIsTutorScanning(true);
    }, 100);
  };

  // Stop tutor camera scanner
  const stopTutorScanner = async () => {
    if (tutorScannerRef.current) {
      try {
        if (tutorScannerRef.current.isScanning) {
          await tutorScannerRef.current.stop();
        }
        tutorScannerRef.current.clear();
      } catch (err) {
        console.warn('Failed to clear tutor scanner:', err);
      }
      tutorScannerRef.current = null;
    }
  };

  // Handle scanned student QR code or manual 6-digit code / LRN
  const handleStudentScanResult = async (decodedText: string) => {
    if (isProcessingStudentScan) return;
    setIsProcessingStudentScan(true);
    setTutorScanMessage(null);
    try {
      let payload = decodedText.trim();
      if (payload.length === 6 && students.length > 0) {
        const norm = payload.toLowerCase();
        const match = students.find(
          (s) =>
            String(s.id).replace(/-/g, '').toLowerCase().startsWith(norm) ||
            (s.lrn && s.lrn.endsWith(norm))
        );
        if (match) {
          payload = `ARALERT:STUDENT:${match.id}`;
        }
      }
      const res = await academicService.scanQRCode(payload);
      setTutorScanMessage({
        type: 'success',
        message: res.message || 'Student attendance recorded successfully!',
      });
      // Refresh attendance logs & session scanned list
      void fetchAttendanceHistory();
      if (session?.id) {
        try {
          const freshSession = await academicService.getActiveAttendanceSession('student');
          if (freshSession && (freshSession as any).scanned_students) {
            setScannedStudents((freshSession as any).scanned_students || []);
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setTutorScanMessage({
        type: 'error',
        message: err.response?.data?.error || 'Failed to record student attendance. Verify student QR pass.',
      });
    } finally {
      setTimeout(() => {
        setIsProcessingStudentScan(false);
      }, 1500);
    }
  };

  // Tutor Camera scanner effect
  useEffect(() => {
    if (!isTutorScanning) {
      void stopTutorScanner();
      setTutorCameraError(null);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setTutorCameraError(null);
      await stopTutorScanner();
      if (!isMounted) return;

      try {
        const qrContainer = document.getElementById('tutor-qr-reader');
        if (!qrContainer) return;

        const html5QrCode = new Html5Qrcode('tutor-qr-reader');
        tutorScannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        };

        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        if (!isMounted) {
          await stopTutorScanner();
          return;
        }

        const preferredCamera =
          cameras.find((cam) => /back|rear|environment/i.test(cam.label)) ||
          cameras.find((cam) => /integrated|built-?in|webcam|front|user|face/i.test(cam.label)) ||
          cameras[0];

        const cameraChoice = preferredCamera?.id ? preferredCamera.id : { facingMode: 'environment' };

        try {
          await html5QrCode.start(
            cameraChoice,
            config,
            (decodedText) => {
              void handleStudentScanResult(decodedText);
            },
            () => {}
          );
        } catch (initialErr) {
          if (!isMounted) return;
          await html5QrCode.start(
            { facingMode: 'user' },
            config,
            (decodedText) => {
              void handleStudentScanResult(decodedText);
            },
            () => {}
          );
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Tutor camera init error:', err);
          if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
            setTutorCameraError('Camera permission was denied. Please allow camera access in browser settings.');
          } else if (err?.name === 'NotFoundError' || err?.message?.includes('No camera')) {
            setTutorCameraError('No camera was detected on this device.');
          } else {
            setTutorCameraError(err?.message || 'Unable to access camera.');
          }
        }
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      void stopTutorScanner();
    };
  }, [isTutorScanning]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      void stopTutorScanner();
    };
  }, []);

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



  // ── Polling & Timer helpers ────────────────────────────────────
  const calcRemainingSeconds = (targetSession: AttendanceSession, localExpiresAt?: number) => {
    const currentMs = timeService.nowMs();
    if (localExpiresAt && localExpiresAt > 0) {
      const diff = Math.floor((localExpiresAt - currentMs) / 1000);
      return Math.max(0, diff);
    }
    if (targetSession.expires_at) {
      const diff = Math.floor((new Date(targetSession.expires_at).getTime() - currentMs) / 1000);
      return Math.max(0, diff);
    }
    return Math.max(0, targetSession.time_left || 0);
  };

  const startPolling = useCallback((sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const todayStr = timeService.todayStr();
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
          void academicService.closeAttendanceSession(targetSession.id).catch(() => { });
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
            setIsTutorScanning(true);
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
            const localExpiresAt = timeService.nowMs() + remaining * 1000;
            setSession(activeSession);
            setTimeLeft(remaining);
            setIsTutorScanning(true);

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

      const payload: any = {
        session_type: 'student',
        expires_in_minutes: expiresIn,
        action: 'attendance',
      };

      const newSession = await academicService.createAttendanceSession(payload);
      setSession(newSession);
      setIsTutorScanning(true);
      const remaining = newSession.time_left || expiresIn * 60;
      setTimeLeft(remaining);
      setScannedStudents([]);

      const launchTime = formatTimeString(new Date().toTimeString().slice(0, 5));
      storeSessionTime(newSession.id, launchTime);
      setSessionLaunchTimes((prev) => ({ ...prev, [newSession.id]: launchTime }));

      const localExpiresAt = timeService.nowMs() + remaining * 1000;
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
    setIsTutorScanning(false);
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
        title: 'Start New Attendance Session',
        message: 'Starting a new attendance session will end the current active session. Are you sure you want to proceed?',
        confirmText: 'Start New',
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
    let list = sortedHistory.filter((log) =>
      matchesSearch(studentSearch, log.user_name, log.user_lrn)
    );
    if (jumpDate) {
      return list.filter((log) => log.date === jumpDate);
    }
    return list;
  }, [sortedHistory, studentSearch, jumpDate]);

  const activeHistoryRecords = filteredHistory;

  const mostRecentDateWithEntry = useMemo(() => {
    if (activeHistoryRecords.length === 0) return null;
    return activeHistoryRecords[0].date?.slice(0, 10) || null;
  }, [activeHistoryRecords]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (jumpDate) {
      setSelectedDate(jumpDate);
    } else if (mostRecentDateWithEntry) {
      setSelectedDate(mostRecentDateWithEntry);
    } else {
      setSelectedDate(null);
    }
  }, [jumpDate, mostRecentDateWithEntry, viewMode, studentSearch]);

  // Group by week key "YYYY-MM-DD" (Local Monday)
  const getWeekKey = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return mon.toLocaleDateString('en-CA');
  };

  const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);

  const getMonthTitle = (monthKey: string) => {
    const d = new Date(`${monthKey}-01T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  // Build grouped structure for weekly / monthly views
  const groupedHistory = useMemo((): AttendanceTableGroup[] => {
    if (jumpDate) {
      return [{
        key: jumpDate,
        title: viewMode === 'week' ? getWeekTitle(getWeekKey(jumpDate)) : getMonthTitle(getMonthKey(jumpDate)),
        weekMonday: getWeekKey(jumpDate),
        isMonthGroup: viewMode === 'month',
        records: activeHistoryRecords,
      }];
    }
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of activeHistoryRecords) {
      const dateKey = log.date?.slice(0, 10) || log.date;
      if (!dateKey) continue;
      const key = viewMode === 'week' ? getWeekKey(dateKey) : getMonthKey(dateKey);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    // Sort groups descending
    return Array.from(grouped.entries())
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, records]) => ({
        key,
        title: viewMode === 'week' ? getWeekTitle(key) : getMonthTitle(key),
        weekMonday: viewMode === 'week' ? key : undefined,
        isMonthGroup: viewMode === 'month',
        records,
      }));
  }, [activeHistoryRecords, jumpDate, viewMode]);


  const statusBadge = (status: string, display: string) => {
    const map: Record<string, string> = {
      present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      absent: 'bg-rose-50   text-rose-700   border-rose-200',
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
          <div className="h-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden">

            {/* Card Header */}
            <div className="h-[60px] shrink-0 flex items-center justify-between px-6 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 uppercase">ATTENDANCE SCANNER SETUP</h2>
              </div>
              {session && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border ${session.is_active
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
                <div className="order-2 rounded-md border border-gray-100 dark:border-[#1A1A1A] bg-gray-50/60 dark:bg-[#161616] p-4 space-y-4">
                  {/* Duration */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-3">
                      Duration
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 15, 30].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setExpiresIn(mins)}
                          className={`py-2 rounded-md text-xs font-bold border transition-all cursor-pointer ${expiresIn === mins
                            ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                            : 'bg-white dark:bg-[#111111] text-gray-600 dark:text-slate-300 border-gray-200 dark:border-[#1A1A1A] hover:border-[var(--brand)] hover:text-[var(--brand)]'
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
                  className="order-3 w-full flex items-center justify-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white py-2.5 rounded-md text-sm font-bold transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Starting session...
                    </>
                  ) : (
                    'Start Attendance Session'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleGenerateNewClick}
                  disabled={isLoading}
                  className="order-3 w-full flex items-center justify-center gap-2 border border-[var(--brand)] text-[var(--brand)] hover:bg-[var(--brand-light)] py-2.5 rounded-md text-sm font-bold transition-all cursor-pointer disabled:opacity-70"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Starting...' : 'Start New Session'}
                </button>
              )}

              {error && (
                <div className="order-4 flex items-start gap-2.5 w-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-xs rounded-md p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  {error}
                </div>
              )}

              {/* Session Display / Camera Scanner */}
              <div className="order-1 mx-auto w-full max-w-sm">
                {/* Live Tutor Scanner Feedback Banner */}
                {tutorScanMessage && (
                  <div
                    className={`mb-3 flex items-start justify-between gap-2.5 w-full rounded-md p-3 text-xs font-medium animate-fade-in ${
                      tutorScanMessage.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {tutorScanMessage.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{tutorScanMessage.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTutorScanMessage(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Viewport: Active Session Scanner OR Expired OR Awaiting Session */}
                {session?.is_active ? (
                  <div className="space-y-3">
                    <div className="relative flex min-h-[300px] flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-200 dark:border-[#1A1A1A] bg-gray-50/70 dark:bg-[#161616] p-4 overflow-hidden">
                      <span className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[var(--brand)] rounded-tl-xs z-10" />
                      <span className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[var(--brand)] rounded-tr-xs z-10" />
                      <span className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[var(--brand)] rounded-bl-xs z-10" />
                      <span className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[var(--brand)] rounded-br-xs z-10" />

                      <div className="w-full space-y-3">
                        {tutorCameraError && (
                          <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                            <span>{tutorCameraError}</span>
                          </div>
                        )}
                        <div
                          id="tutor-qr-reader"
                          className="w-full font-mono text-xs text-white overflow-hidden rounded-md"
                        />
                        <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400">
                          <span>Point camera at student permanent QR code</span>
                          <button
                            type="button"
                            onClick={restartTutorScanner}
                            className="inline-flex items-center gap-1 font-semibold text-[var(--brand)] hover:underline cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Reset Camera</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Manual Student Entry */}
                    <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#111111] p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-gray-900 dark:text-slate-100 uppercase">MANUAL STUDENT ENTRY</h3>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                            Enter student 6-digit code or LRN if camera cannot scan QR pass
                          </p>
                        </div>
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (manualStudentInput.trim()) {
                            void handleStudentScanResult(manualStudentInput.trim());
                            setManualStudentInput('');
                          }
                        }}
                        className="space-y-2"
                      >
                        <input
                          type="text"
                          placeholder="Enter 6-digit manual code or LRN (e.g. A3F82C or 109283746501)..."
                          value={manualStudentInput}
                          onChange={(e) => setManualStudentInput(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-[#262626] rounded-md text-xs bg-white dark:bg-[#0A0A0A] font-mono tracking-wider text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={!manualStudentInput.trim() || isProcessingStudentScan}
                          className="w-full flex items-center justify-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white py-2 rounded-md text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isProcessingStudentScan ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Recording Attendance...</span>
                            </>
                          ) : (
                            'Log Student Attendance'
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                ) : session && !session.is_active ? (
                  <div className="relative flex min-h-[300px] flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-200 dark:border-[#1A1A1A] bg-gray-50/70 dark:bg-[#161616] p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 flex items-center justify-center mb-3">
                      <Clock className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm">Attendance Session Expired</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xs">
                      The timer for this attendance session has elapsed. Start a new session to continue scanning.
                    </p>
                    <button
                      onClick={() => {
                        const storageKey = getStorageKey(user?.id);
                        if (storageKey) localStorage.removeItem(storageKey);
                        setSession(null);
                        setIsTutorScanning(false);
                        setScannedStudents([]);
                        void fetchAttendanceHistory();
                      }}
                      className="mt-4 px-4 py-1.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-md text-xs font-bold transition-all cursor-pointer"
                    >
                      Reset Session
                    </button>
                  </div>
                ) : (
                  <div className="relative flex min-h-[300px] flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-200 dark:border-[#1A1A1A] bg-gray-50/70 dark:bg-[#161616] p-6 text-center">
                    <div className="w-14 h-14 rounded-full border border-dashed border-gray-300 dark:border-white/10 bg-white dark:bg-[#111111] flex items-center justify-center mb-3">
                      <Camera className="w-7 h-7 text-gray-300 dark:text-slate-600 stroke-[1.5]" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200">
                      Ready to Scan Student Attendance
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 max-w-xs mt-1">
                      Select a session duration and start the session to activate the camera scanner.
                    </p>
                  </div>
                )}

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
                      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-[#222222] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--brand)] transition-all duration-1000"
                          style={{ width: `${100 - progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Session meta */}
                    <div className="flex items-center justify-between text-xs py-0.5 text-gray-500 dark:text-slate-400">
                      <span className="font-semibold text-[11px]">Session ID:</span>
                      <code className="text-[11px] font-mono font-medium text-gray-700 dark:text-slate-300 select-all truncate max-w-[180px] tracking-wide" title={session.id}>
                        {session.id}
                      </code>
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
          <div className="flex h-full min-h-[480px] flex-col rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden">

            {/* Feed header */}
            <div className="h-[60px] shrink-0 flex items-center justify-between px-6 border-b border-gray-100 dark:border-[#1A1A1A]">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base">RECENT STUDENT QR SCANS</h3>
              </div>
              <div>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 text-[10px] font-extrabold text-gray-700 dark:text-slate-300">
                  {scannedStudents.length}
                </span>
              </div>
            </div>

            {/* Feed list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {scannedStudents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3 min-h-[280px]">
                  <div className="w-14 h-14 rounded-md border border-dashed border-gray-200 dark:border-[#1A1A1A] flex items-center justify-center">
                    <UserCheck className="w-7 h-7 text-gray-300 dark:text-slate-600 stroke-[1.5]" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-slate-400 text-center whitespace-nowrap">Scanned students will appear here in real-time</p>
                  </div>
                  {!session && (
                    <p className="text-[11px] text-gray-300 dark:text-slate-600 font-medium">Start an attendance session to begin</p>
                  )}
                </div>
              ) : (
                scannedStudents.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3 p-3 bg-gray-50/60 dark:bg-[#161616] hover:bg-gray-100/60 dark:hover:bg-[#1a1a1a] rounded-md border border-gray-100 dark:border-[#1A1A1A] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-800 dark:text-slate-200 leading-tight truncate">{log.user_name}</p>
                      <p className="text-[11px] text-gray-400 truncate">LRN: {log.user_lrn || 'N/A'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800">
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
      <div className="mt-2.5 sm:mt-4 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] relative" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>

        {/* Section header */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-4 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
          <div className="min-w-0 flex-1 truncate">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-xs sm:text-base uppercase truncate">STUDENTS ATTENDANCE HISTORY</h3>
            <p className="mt-0.5 text-[10px] sm:text-xs font-normal text-gray-500 dark:text-slate-400 truncate">
              {activeHistoryRecords.length} Record{activeHistoryRecords.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* ── Controls ── */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
            <label className="relative flex w-28 xs:w-36 sm:w-52 items-center shrink-0">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="search"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Search student..."
                aria-label="Search attendance history by student"
                className="h-7.5 sm:h-8.5 w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] pl-8 pr-2.5 text-[11px] sm:text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#111111]"
              />
            </label>

            {/* View mode toggle styled like TutorHome trend filter */}
            <div className="flex bg-gray-100 dark:bg-[#1A1A1A] rounded-md p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
              {(['week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  id={`qr-view-${mode}`}
                  type="button"
                  onClick={() => { setViewMode(mode); setJumpDate(null); }}
                  className={`rounded-sm px-2 sm:px-3 py-1 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${viewMode === mode && !jumpDate
                    ? 'bg-[var(--brand)] text-white'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                    }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Custom Calendar Dropdown Button in Poppins */}
            <div className="relative inline-flex items-center shrink-0">
              <button
                type="button"
                id="qr-attendance-calendar-btn"
                onClick={() => setShowCalendarPopover((prev) => !prev)}
                className={`p-1.5 sm:p-2 rounded-md border transition-all flex items-center justify-center cursor-pointer ${jumpDate
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
              className="inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-md bg-[var(--brand)] px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-white transition-all hover:bg-[var(--brand-hover)] cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
              <span className="hidden xs:inline">Export Sheet</span>
              <span className="xs:hidden">Export</span>
            </button>
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
              className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline transition-colors"
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
                <div key={i} className="h-10 bg-gray-100 dark:bg-[#1A1A1A] rounded-md animate-pulse flex items-center px-4 gap-3">
                  <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-[#222222] shrink-0" />
                  <div className="h-3 bg-gray-200 dark:bg-[#222222] rounded w-1/3" />
                  <div className="h-3 bg-gray-200 dark:bg-[#222222] rounded w-1/5 ml-auto" />
                </div>
              ))}
            </div>
          ) : attendanceHistoryError ? (
            <div className="flex items-start gap-2.5 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md p-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              {attendanceHistoryError}
            </div>
          ) : activeHistoryRecords.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarDays className="w-10 h-10 text-gray-200 dark:text-gray-700" />
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">
                {studentSearch.trim()
                  ? 'No matching attendance records'
                  : jumpDate
                  ? 'No records for this date'
                  : 'No attendance records yet'}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                {studentSearch.trim()
                  ? 'Try a different student name or LRN'
                  : jumpDate
                  ? 'Try a different date or clear the filter'
                  : 'Records will appear once students start scanning'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedHistory.map((group) => (
                <AttendanceHistoryGroupSection
                  key={group.key}
                  group={group}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  statusBadge={statusBadge}
                  avatarColor={avatarColor}
                  formatDateString={formatDateString}
                  formatTimeString={formatTimeString}
                  onUpdate={handleUpdateAttendance}
                />
              ))}
            </div>
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
      {confirmAction.isOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
          style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmAction((prev) => ({ ...prev, isOpen: false })); }}
        >
          <div className="relative w-full max-w-sm rounded-lg bg-white dark:bg-[#111111] p-6 shadow-2xl border border-gray-200 dark:border-[#1A1A1A] space-y-4 animate-fade-in-scale">
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
                className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#161616] px-3.5 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-[#222222] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction.onConfirm}
                className={`rounded-md px-3.5 py-1.5 text-xs font-bold text-white transition cursor-pointer ${confirmAction.confirmStyle === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-[var(--brand)] hover:bg-[var(--brand-dark)]'
                  }`}
              >
                {confirmAction.confirmText}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TutorQRGenerator;
