import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Search, AlertTriangle, Download, Calendar, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import api from '../../api/axios';
import { TablePagination } from '../../components/TablePagination';
import { AnimatedCounter } from '../../components/AnimatedCounter';
import { useAuth } from '../../hooks/useAuth';
import { ExportAuditLogModal } from '../../components/ExportAuditLogModal';

// ── Types ──────────────────────────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  target?: string;
  name: string;
  role: string;
  email: string;
  lrn: string;
  username: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
}

const getTargetDisplay = (log: AuditEntry): string => {
  let target = log.target || '';
  if (!target || target === '—') {
    const d = log.details;
    if (d) {
      const targetName = d.target_name || d.student_name || d.user_name || d.name;
      if (targetName) {
        target = String(targetName);
      } else if (d.target_username) {
        target = String(d.target_username);
      } else if (d.target_lrn || d.lrn) {
        target = `STUDENT ${d.target_lrn || d.lrn}`;
      }
    }
  }
  if (!target || target === '—') return '—';

  // Remove [role] if present to save space (e.g. "JUAN DELA CRUZ [STUDENT]" -> "JUAN DELA CRUZ")
  target = target.replace(/\s*\[.*?\]$/, '').trim();

  // If target is an email address, display clean name portion rather than dropping to '—'
  if (target.includes('@')) {
    target = target.split('@')[0].replace(/[._]/g, ' ').trim().toUpperCase();
  }

  if (target.startsWith('student-')) return '—';

  return target || '—';
};

interface AuditResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: AuditEntry[];
}

// ── Date Helpers ───────────────────────────────────────────────────────────────
const formatDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// ── Custom Calendar Dropdown ──────────────────────────────────────────────────
const CustomCalendarDropdown: React.FC<{
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onClear: () => void;
  onClose: () => void;
  className?: string;
}> = ({ selectedDate, onSelectDate, onClear, onClose, className }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00');
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
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
      className={`${className || 'absolute left-0 sm:right-0 sm:left-auto top-full mt-2'} z-[60] w-[calc(100vw-48px)] max-w-[280px] sm:w-72 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-3.5 shadow-2xl select-none text-slate-800 dark:text-slate-100`}
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-slate-400 transition cursor-pointer"
          aria-label="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 tracking-wide">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-slate-400 transition cursor-pointer"
          aria-label="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400 py-2 text-[10px] uppercase tracking-wider">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((dayNum, idx) => {
          if (dayNum === null) return <div key={`empty-${idx}`} className="h-7 w-7" />;
          const cellDateKey = formatDateKey(year, month, dayNum);
          const isSelected = selectedDate === cellDateKey;
          const isToday = todayStr === cellDateKey;
          return (
            <button
              key={cellDateKey}
              type="button"
              onClick={() => {
                onSelectDate(cellDateKey);
                onClose();
              }}
              className={`relative flex flex-col items-center justify-center h-7 w-7 mx-auto rounded-md text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[var(--brand)] text-white font-bold shadow-xs'
                  : isToday
                  ? 'border border-[var(--brand)] text-[var(--brand)] font-bold hover:bg-[var(--brand-light)]'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span>{dayNum}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-zinc-800 text-[11px] font-semibold">
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
            className="text-slate-400 hover:text-rose-500 transition cursor-pointer"
          >
            Clear Date
          </button>
        )}
      </div>
    </div>
  );
};

// ── Event Categories & Custom Filter Dropdown ───────────────────────────────
interface EventFilterOption {
  value: string;
  label: string;
}

interface EventCategoryGroup {
  category: string;
  options: EventFilterOption[];
}

const EVENT_CATEGORIES: EventCategoryGroup[] = [
  {
    category: 'Authentication & Security',
    options: [
      { value: 'LOGIN_SUCCESS', label: 'Login Success' },
      { value: 'GOOGLE_LOGIN_SUCCESS', label: 'Google Login (Staff)' },
      { value: 'STUDENT_LOGIN_SUCCESS', label: 'Student Portal Login' },
      { value: 'LOGOUT_SUCCESS', label: 'Logout Success' },
      { value: 'LOGIN_FAILED', label: 'Login Failed / Unauthorized' },
      { value: 'LOGIN_RATE_LIMITED', label: 'Login Rate Limited' },
    ],
  },
  {
    category: 'Academic Grades & Scores',
    options: [
      { value: 'GRADE_RECORDED', label: 'Academic Grade Recorded' },
      { value: 'GRADE_UPDATED', label: 'Academic Grade Updated' },
      { value: 'GRADE_DELETED', label: 'Academic Grade Deleted' },
    ],
  },
  {
    category: 'Attendance & DTR Operations',
    options: [
      { value: 'ATTENDANCE_QR_SCANNED', label: 'Student QR Attendance Scanned' },
      { value: 'ATTENDANCE_MANUAL_LOGGED', label: 'Manual Attendance Logged' },
      { value: 'ATTENDANCE_SESSION_CREATED', label: 'Attendance QR Session Generated' },
      { value: 'ATTENDANCE_SESSION_CLOSED', label: 'Attendance QR Session Closed' },
      { value: 'ATTENDANCE_STAFF_CLOCK_IN', label: 'Staff DTR Clock In Scanned' },
      { value: 'ATTENDANCE_STAFF_CLOCK_OUT', label: 'Staff DTR Clock Out Scanned' },
    ],
  },
  {
    category: 'Risk Assessment & Interventions',
    options: [
      { value: 'STUDENT_INTERVENTION_ACKNOWLEDGED', label: 'Student Acknowledged High Risk Alert' },
    ],
  },
  {
    category: 'Learner & Account Lifecycle',
    options: [
      { value: 'USER_CREATED', label: 'User Enrolled / Created' },
      { value: 'USER_UPDATED', label: 'User Profile Updated' },
      { value: 'USER_ACTIVATED_BY_SUPERADMIN', label: 'Account Activated by SuperAdmin' },
      { value: 'USER_ACTIVATED_BY_ADMIN', label: 'Account Activated by Admin' },
      { value: 'USER_DEACTIVATED_BY_SUPERADMIN', label: 'Account Deactivated by SuperAdmin' },
      { value: 'USER_DEACTIVATED_BY_ADMIN', label: 'Account Deactivated by Admin' },
      { value: 'TUTOR_ASSIGNED', label: 'Tutor Assigned to Student' },
      { value: 'BULK_TUTOR_ASSIGNED', label: 'Bulk Cohort Assigned to Tutor' },
      { value: 'STUDENT_EDIT_REQUEST_SUBMITTED', label: 'Student Record Correction Submitted' },
      { value: 'STUDENT_EDIT_REQUEST_APPROVED', label: 'Student Record Correction Approved' },
      { value: 'STUDENT_EDIT_REQUEST_REJECTED', label: 'Student Record Correction Rejected' },
      { value: 'ALLOWED_EMAIL_ADDED', label: 'Allowed Email Added' },
      { value: 'ALLOWED_EMAIL_REMOVED', label: 'Allowed Email Removed' },
    ],
  },
  {
    category: 'Evaluations & Transitions',
    options: [
      { value: 'MOSY_FINALIZED', label: 'MOSY Evaluation Finalized' },
      { value: 'SEMESTER_TRANSITION_SET', label: 'Semester Milestone Set' },
      { value: 'SCHOOL_YEAR_TRANSITION', label: 'School Year Transition Executed' },
      { value: 'SUMMER_REMEDIATION_STARTED', label: 'Summer Remediation Started' },
      { value: 'SUMMER_EVALUATION_RECORDED', label: 'Summer Evaluation Recorded' },
    ],
  },
];

const getEventLabel = (val: string): string => {
  if (!val) return 'ALL EVENTS';
  for (const group of EVENT_CATEGORIES) {
    const found = group.options.find((o) => o.value === val);
    if (found) return found.label;
  }
  return val.replace(/_/g, ' ');
};

const EventFilterDropdown: React.FC<{
  value: string;
  onChange: (val: string) => void;
}> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuAlign, setMenuAlign] = useState<'left' | 'right'>('left');

  const handleToggle = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const screenW = window.innerWidth || document.documentElement.clientWidth;
      if (rect.left + 280 > screenW - 16) {
        setMenuAlign('right');
      } else {
        setMenuAlign('left');
      }
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isOpen]);

  const currentLabel = getEventLabel(value);

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-50' : 'z-20'}`}>
      <button
        type="button"
        aria-label="Filter by Event"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className={`w-full h-9 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer shadow-2xs ${
          value
            ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)] dark:bg-[var(--brand)]/15 dark:text-blue-300 dark:border-[var(--brand)]/50 font-bold'
            : 'border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-[#262626]'
        }`}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-zinc-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            menuAlign === 'right' ? 'right-0' : 'left-0'
          } top-full z-50 mt-1 max-h-72 w-full sm:w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] p-1.5 shadow-xl`}
          role="listbox"
          aria-label="Filter by Event"
        >
          {/* ALL EVENTS option */}
          <button
            type="button"
            role="option"
            aria-selected={value === ''}
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className={`block w-full truncate rounded-lg px-3 py-1.5 text-left text-xs font-bold transition cursor-pointer ${
              value === ''
                ? 'bg-[var(--brand)] text-white'
                : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
            }`}
          >
            ALL EVENTS
          </button>

          {/* Grouped Categories */}
          {EVENT_CATEGORIES.map((group) => (
            <div key={group.category} className="mt-2 pt-1 border-t border-gray-100 dark:border-[#1A1A1A]">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 select-none">
                {group.category}
              </div>
              <div className="space-y-0.5">
                {group.options.map((opt) => {
                  const isSel = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`block w-full truncate rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition cursor-pointer ${
                        isSel
                          ? 'bg-[var(--brand)] text-white'
                          : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export const AuditLog: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [eventFilter, setEventFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (eventFilter) params.set('action', eventFilter);
      if (dateFilter) params.set('date', dateFilter);
      if (searchFilter) params.set('search', searchFilter);
      const res = await api.get<AuditResponse>(`/users/audit-logs/?${params}`);
      setData(res.data);
    } catch {
      setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter, dateFilter, searchFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchFilter(searchInput);
    setPage(1);
  };

  const handleClear = () => {
    setEventFilter('');
    setDateFilter(null);
    setSearchInput('');
    setSearchFilter('');
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-3.5 sm:gap-5 p-3 sm:p-6 max-w-7xl mx-auto w-full" style={{ fontFamily: 'var(--font-body)' }}>

      {/* ── Filters Bar ── */}
      <form
        onSubmit={handleSearch}
        className="p-3 sm:p-5 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm flex flex-wrap items-end gap-2.5 sm:gap-3"
      >
        {/* Filter by Event */}
        <div className="flex flex-col gap-1.5 w-full sm:flex-1 sm:min-w-[200px]">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Filter by Event
          </label>
          <EventFilterDropdown
            value={eventFilter}
            onChange={(val) => {
              setEventFilter(val);
              setPage(1);
            }}
          />
        </div>

        {/* Filter by Date */}
        <div className="flex flex-col gap-1.5 w-full sm:w-auto sm:min-w-[170px]">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Filter by Date
          </label>
          <div className="relative">
            <button
              type="button"
              id="audit-log-calendar-btn"
              onClick={() => setShowCalendarPopover((prev) => !prev)}
              className={`w-full h-9 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer shadow-2xs ${
                dateFilter
                  ? 'bg-[var(--brand)] text-white border-[var(--brand)] font-bold'
                  : 'border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-[#262626]'
              }`}
              title="Filter audit logs by specific date"
            >
              <div className="flex items-center gap-2 truncate">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {dateFilter
                    ? new Date(dateFilter + 'T00:00:00').toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'All Dates'}
                </span>
              </div>
              {dateFilter && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDateFilter(null);
                    setPage(1);
                  }}
                  className="p-0.5 rounded-full hover:bg-white/20 transition cursor-pointer shrink-0"
                  title="Clear date"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>

            {showCalendarPopover && (
              <CustomCalendarDropdown
                selectedDate={dateFilter}
                onSelectDate={(d) => {
                  setDateFilter(d);
                  setPage(1);
                  setShowCalendarPopover(false);
                }}
                onClear={() => {
                  setDateFilter(null);
                  setPage(1);
                  setShowCalendarPopover(false);
                }}
                onClose={() => setShowCalendarPopover(false)}
              />
            )}
          </div>
        </div>

        {/* Filter by Name, Email, or LRN */}
        <div className="flex flex-col gap-1.5 w-full sm:flex-1 sm:min-w-[200px]">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Filter by Name, Email, or LRN
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email, or LRN…"
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] text-xs font-semibold text-gray-700 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-normal outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 shadow-2xs"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
          {(eventFilter || dateFilter || searchFilter || searchInput) && (
            <button
              type="button"
              onClick={handleClear}
              className="h-9 px-3.5 flex-1 sm:flex-initial rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 bg-gray-100 hover:bg-gray-200 dark:bg-[#111111] dark:hover:bg-[#1a1a1a] border border-gray-200 dark:border-[#1A1A1A] transition cursor-pointer shadow-2xs"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            title="Export Audit Logs"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-2.5 sm:px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-[var(--brand-hover)] cursor-pointer flex-1 sm:flex-initial shrink-0 whitespace-nowrap shadow-xs h-9"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Export<span className="hidden sm:inline"> Audit Log</span></span>
          </button>
        </div>
      </form>

      {/* ── Log Table Container (30 records per page) ── */}
      <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm overflow-hidden">
        
        {/* Active Filters (if any) */}
        {(eventFilter || dateFilter || searchFilter) && (
          <div className="px-3.5 sm:px-5 py-2 sm:py-2.5 border-b border-gray-100 dark:border-[#1A1A1A] flex flex-wrap items-center gap-1.5 sm:gap-2 bg-gray-50/50 dark:bg-[#111111]">
            <span className="text-[11px] font-semibold text-slate-400">Active Filters:</span>
            {eventFilter && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 flex items-center gap-1.5">
                Event: {eventFilter.replace(/_/g, ' ')}
                <button
                  type="button"
                  onClick={() => {
                    setEventFilter('');
                    setPage(1);
                  }}
                  className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  title="Remove event filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {dateFilter && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Date: {new Date(dateFilter + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter(null);
                    setPage(1);
                  }}
                  className="hover:text-emerald-900 dark:hover:text-white cursor-pointer"
                  title="Remove date filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchFilter && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 flex items-center gap-1.5">
                Query: {searchFilter}
                <button
                  type="button"
                  onClick={() => {
                    setSearchFilter('');
                    setSearchInput('');
                    setPage(1);
                  }}
                  className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  title="Remove query filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-10 bg-slate-100 dark:bg-zinc-900 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <p className="text-sm font-bold text-rose-800 dark:text-rose-200">{error}</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Make sure you are signed in as SuperAdmin or Admin.</p>
          </div>
        ) : !data || data.results.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-zinc-400 bg-white dark:bg-[#0A0A0A]">
            No audit events match your filters.
          </div>
        ) : (
          <>
            {/* ── Mobile View (< 768px): Sticky Event & Timestamp with Horizontal Scrolling Details ── */}
          <div className="md:hidden overflow-x-auto table-scroll-container mobile-scroll-table w-full">
            <table className="w-full text-left text-xs divide-y divide-gray-100 dark:divide-[#1A1A1A]">
              <thead className="bg-gray-50 dark:bg-[#111111] font-bold text-[11px] uppercase tracking-wider text-gray-400 dark:text-slate-400">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 dark:bg-[#111111] w-[135px] min-w-[135px] max-w-[135px] px-3 py-2 text-left whitespace-nowrap shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)] border-r border-gray-100 dark:border-[#1A1A1A]">
                    EVENT & TIME
                  </th>
                  <th className="px-3 py-2 text-left whitespace-nowrap min-w-[120px]">
                    TARGET
                  </th>
                  <th className="px-3 py-2 text-left whitespace-nowrap min-w-[120px]">
                    ACTOR
                  </th>
                  <th className="px-3 py-2 text-center whitespace-nowrap min-w-[80px]">
                    ROLE
                  </th>
                  <th className="px-3 py-2 text-left whitespace-nowrap min-w-[140px]">
                    EMAIL
                  </th>
                  <th className="px-3 py-2 text-center whitespace-nowrap min-w-[110px]">
                    LRN
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                {data.results.map((log) => {
                  return (
                    <tr
                      key={log.id}
                      className="group transition-colors hover:bg-gray-50/80 dark:hover:bg-white/[0.02]"
                    >
                      {/* Pinned Sticky Column: Event Name + Timestamp underneath */}
                      <td className="sticky left-0 z-10 bg-white dark:bg-[#0A0A0A] w-[135px] min-w-[135px] max-w-[135px] px-3 py-2.5 shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)] border-r border-gray-100 dark:border-[#1A1A1A]">
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-[11px] text-gray-900 dark:text-slate-100 truncate leading-snug" title={log.action.replace(/_/g, ' ')}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500 truncate mt-0.5">
                            {log.timestamp}
                          </span>
                        </div>
                      </td>

                      {/* TARGET */}
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap max-w-[140px] truncate" title={getTargetDisplay(log) !== '—' ? getTargetDisplay(log) : undefined}>
                        {(() => {
                          const target = getTargetDisplay(log);
                          if (target === '—') return <span className="text-gray-400 dark:text-slate-500">—</span>;
                          return (
                            <span className="font-semibold text-gray-900 dark:text-slate-100">
                              {target}
                            </span>
                          );
                        })()}
                      </td>

                      {/* ACTOR NAME */}
                      <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-slate-100 whitespace-nowrap text-xs">
                        {log.name || 'System'}
                      </td>

                      {/* ROLE */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap text-[11px] font-medium text-gray-700 dark:text-slate-300">
                        {log.role || '—'}
                      </td>

                      {/* EMAIL */}
                      <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">
                        {log.role?.toLowerCase() === 'student' || log.email?.includes('@aralert.local') || log.email?.startsWith('student-')
                          ? '—'
                          : (log.email || '—')}
                      </td>

                      {/* LRN */}
                      <td className="px-3 py-2.5 text-center text-xs font-mono text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {log.lrn || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Desktop View (>= 768px): Original Full-Width Table ── */}
          <div className="hidden md:block overflow-x-auto mobile-scroll-table">
            <table className="min-w-[760px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-left text-sm font-normal">
              <thead>
                <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    TIMESTAMP
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    EVENT
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap max-w-[150px]">
                    TARGET
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    NAME
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    ROLE
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    EMAIL
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    LRN
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                {data.results.map((log) => {
                  return (
                    <tr
                      key={log.id}
                      className="group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-white/[0.02]"
                    >
                      {/* TIMESTAMP */}
                      <td className="px-4 py-3 text-xs font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap">
                        {log.timestamp}
                      </td>

                      {/* EVENT */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-gray-900 dark:text-slate-100">
                        {log.action.replace(/_/g, ' ')}
                      </td>

                      {/* TARGET */}
                      <td className="px-3 py-3 whitespace-nowrap text-xs max-w-[150px] truncate" title={getTargetDisplay(log) !== '—' ? getTargetDisplay(log) : undefined}>
                        {(() => {
                          const target = getTargetDisplay(log);
                          if (target === '—') return <span className="text-gray-400 dark:text-slate-500">—</span>;
                          return (
                            <span className="font-semibold text-gray-900 dark:text-slate-100">
                              {target}
                            </span>
                          );
                        })()}
                      </td>

                      {/* NAME */}
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100 whitespace-nowrap">
                        {log.name || 'System'}
                      </td>

                      {/* ROLE */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-gray-700 dark:text-slate-300">
                        {log.role || '—'}
                      </td>

                      {/* EMAIL */}
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">
                        {log.role?.toLowerCase() === 'student' || log.email?.includes('@aralert.local') || log.email?.startsWith('student-')
                          ? '—'
                          : (log.email || '—')}
                      </td>

                      {/* LRN */}
                      <td className="px-4 py-3 text-xs font-mono text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {log.lrn || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* ── Pagination Footer ── */}
        {data && data.count > 0 && (
          <TablePagination
            currentPage={page}
            totalItems={data.count}
            totalPages={data.total_pages}
            pageSize={30}
            onPageChange={setPage}
            customShowingText={
              <span>
                Showing <strong className="font-semibold text-gray-800 dark:text-slate-200">{data.results.length}</strong> of{' '}
                <strong className="font-semibold text-gray-800 dark:text-slate-200"><AnimatedCounter value={data.count} /></strong> events (30 per page)
              </span>
            }
          />
        )}
      </div>

      {showExportModal && (
        <ExportAuditLogModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          currentUser={user}
          initialDateFrom={dateFilter}
          initialDateTo={dateFilter}
          initialAction={eventFilter}
          initialSearch={searchFilter || searchInput}
        />
      )}
    </div>
  );
};

export default AuditLog;
