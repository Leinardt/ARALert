import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Search, AlertTriangle, Download, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import api from '../../api/axios';
import { TablePagination } from '../../components/TablePagination';
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
      const targetName = d.target_name || d.student_name || d.user_name;
      if (targetName) {
        target = String(targetName);
      } else if (d.target_username && !String(d.target_username).includes('@')) {
        target = String(d.target_username);
      }
    }
  }
  if (!target || target === '—') return '—';

  // Remove [role] if present to save space (e.g. "JUAN DELA CRUZ [STUDENT]" -> "JUAN DELA CRUZ")
  target = target.replace(/\s*\[.*?\]$/, '').trim();

  // If target is an email address, do not put email in target column
  if (target.includes('@') || target.startsWith('student-')) return '—';

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
      className={`${className || 'absolute left-0 sm:right-0 sm:left-auto top-full mt-2'} z-[60] w-72 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-2xl select-none text-slate-800 dark:text-slate-100`}
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
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full" style={{ fontFamily: 'var(--font-body)' }}>

      {/* ── Filters Bar ── */}
      <form
        onSubmit={handleSearch}
        className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs flex flex-wrap items-end gap-3"
      >
        {/* Filter by Event */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Filter by Event
          </label>
          <div className="relative">
            <select
              value={eventFilter}
              onChange={(e) => {
                setEventFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by Event"
              className="w-full h-9 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#111111] px-3 text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none transition focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#0A0A0A] cursor-pointer"
            >
              <option value="">ALL EVENTS</option>
              
              <optgroup label="Authentication & Security">
                <option value="LOGIN_SUCCESS">Login Success</option>
                <option value="LOGOUT_SUCCESS">Logout Success</option>
                <option value="LOGIN_FAILED">Login Failed / Unauthorized</option>
                <option value="LOGIN_RATE_LIMITED">Login Rate Limited</option>
              </optgroup>

              <optgroup label="Academic Grades & Scores">
                <option value="GRADE_RECORDED">Academic Grade Recorded</option>
                <option value="GRADE_UPDATED">Academic Grade Updated</option>
                <option value="GRADE_DELETED">Academic Grade Deleted</option>
              </optgroup>

              <optgroup label="Attendance & DTR Operations">
                <option value="ATTENDANCE_QR_SCANNED">Student QR Attendance Scanned</option>
                <option value="ATTENDANCE_MANUAL_LOGGED">Manual Attendance Logged</option>
                <option value="ATTENDANCE_SESSION_CREATED">Attendance QR Session Generated</option>
                <option value="ATTENDANCE_SESSION_CLOSED">Attendance QR Session Closed</option>
                <option value="ATTENDANCE_STAFF_CLOCK_IN">Staff DTR Clock In Scanned</option>
                <option value="ATTENDANCE_STAFF_CLOCK_OUT">Staff DTR Clock Out Scanned</option>
              </optgroup>

              <optgroup label="Risk Assessment & Interventions">
                <option value="STUDENT_INTERVENTION_ACKNOWLEDGED">Student Acknowledged High Risk Alert</option>
              </optgroup>

              <optgroup label="Learner & Account Lifecycle">
                <option value="USER_CREATED">User Enrolled / Created</option>
                <option value="USER_UPDATED">User Profile Updated</option>
                <option value="USER_ACTIVATED_BY_SUPERADMIN">Account Activated by SuperAdmin</option>
                <option value="USER_ACTIVATED_BY_ADMIN">Account Activated by Admin</option>
                <option value="USER_DEACTIVATED_BY_SUPERADMIN">Account Deactivated by SuperAdmin</option>
                <option value="USER_DEACTIVATED_BY_ADMIN">Account Deactivated by Admin</option>
                <option value="TUTOR_ASSIGNED">Tutor Assigned to Student</option>
                <option value="BULK_TUTOR_ASSIGNED">Bulk Cohort Assigned to Tutor</option>
                <option value="STUDENT_EDIT_REQUEST_SUBMITTED">Student Record Correction Submitted</option>
                <option value="STUDENT_EDIT_REQUEST_APPROVED">Student Record Correction Approved</option>
                <option value="STUDENT_EDIT_REQUEST_REJECTED">Student Record Correction Rejected</option>
                <option value="ALLOWED_EMAIL_ADDED">Allowed Email Added</option>
                <option value="ALLOWED_EMAIL_REMOVED">Allowed Email Removed</option>
              </optgroup>

              <optgroup label="Evaluations & Transitions">
                <option value="MOSY_FINALIZED">MOSY Evaluation Finalized</option>
                <option value="SEMESTER_TRANSITION_SET">Semester Milestone Set</option>
                <option value="SCHOOL_YEAR_TRANSITION">School Year Transition Executed</option>
                <option value="SUMMER_REMEDIATION_STARTED">Summer Remediation Started</option>
                <option value="SUMMER_EVALUATION_RECORDED">Summer Evaluation Recorded</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Filter by Date */}
        <div className="flex flex-col gap-1.5 min-w-[170px]">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Filter by Date
          </label>
          <div className="relative">
            <button
              type="button"
              id="audit-log-calendar-btn"
              onClick={() => setShowCalendarPopover((prev) => !prev)}
              className={`w-full h-9 px-3 rounded-md border text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer ${
                dateFilter
                  ? 'bg-[var(--brand)] text-white border-[var(--brand)] font-bold'
                  : 'border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#111111] text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1a1a1a]'
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
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
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
              className="w-full h-9 pl-9 pr-3 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#111111] text-xs font-semibold text-gray-700 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-normal outline-none transition focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#0A0A0A]"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {(eventFilter || dateFilter || searchFilter || searchInput) && (
            <button
              type="button"
              onClick={handleClear}
              className="h-9 px-3.5 rounded-md text-xs font-bold text-slate-600 dark:text-zinc-400 bg-gray-100 hover:bg-gray-200 dark:bg-[#111111] dark:hover:bg-[#1a1a1a] border border-gray-200 dark:border-[#1A1A1A] transition cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            title="Export Audit Logs"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--brand)] px-3 sm:px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-[var(--brand-hover)] cursor-pointer shrink-0 whitespace-nowrap shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Export Audit Log</span>
          </button>
        </div>
      </form>

      {/* ── Log Table Container (30 records per page) ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
        
        {/* Active Filters (if any) */}
        {(eventFilter || dateFilter || searchFilter) && (
          <div className="px-5 py-2.5 border-b border-gray-100 dark:border-[#1A1A1A] flex flex-wrap items-center gap-2 bg-gray-50/50 dark:bg-[#111111]">
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
          <div className="overflow-x-auto">
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
                <strong className="font-semibold text-gray-800 dark:text-slate-200">{data.count}</strong> events (30 per page)
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
