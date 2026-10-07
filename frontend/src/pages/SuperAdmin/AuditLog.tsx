import React, { useEffect, useState, useCallback } from 'react';
import { Search, AlertTriangle, Download } from 'lucide-react';
import api from '../../api/axios';
import { TablePagination } from '../../components/TablePagination';

// ── Types ──────────────────────────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  name: string;
  role: string;
  email: string;
  lrn: string;
  username: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
}

interface AuditResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: AuditEntry[];
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export const AuditLog: React.FC = () => {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [eventFilter, setEventFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (eventFilter) params.set('action', eventFilter);
      if (searchFilter) params.set('search', searchFilter);
      const res = await api.get<AuditResponse>(`/users/audit-logs/?${params}`);
      setData(res.data);
    } catch {
      setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter, searchFilter]);

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
    setSearchInput('');
    setSearchFilter('');
    setPage(1);
  };

  const handleExportCsv = () => {
    if (!data || !data.results || data.results.length === 0) return;
    const headers = ['Timestamp (PHT)', 'Action', 'Actor Name', 'Role', 'Email', 'LRN'];
    const rows = data.results.map((r) => [
      `"${r.timestamp}"`,
      `"${r.action}"`,
      `"${(r.name || 'System').replace(/"/g, '""')}"`,
      `"${r.role || '—'}"`,
      `"${r.email || '—'}"`,
      `"${r.lrn || '—'}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ARALert_Audit_Log_Page_${page}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full" style={{ fontFamily: 'var(--font-body)' }}>

      {/* ── Filters Bar ── */}
      <form
        onSubmit={handleSearch}
        className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs flex flex-wrap items-end gap-3"
      >
        {/* Filter by Event */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[240px]">
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

        {/* Filter by Name, Email, or LRN */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
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
          <button
            type="submit"
            className="h-9 px-4 rounded-md text-xs font-bold text-white bg-[#0052B7] hover:bg-[#004194] border border-[#0052B7] transition shadow-none cursor-pointer flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" /> Search
          </button>
          {(eventFilter || searchFilter || searchInput) && (
            <button
              type="button"
              onClick={handleClear}
              className="h-9 px-3.5 rounded-md text-xs font-bold text-slate-600 dark:text-zinc-400 bg-gray-100 hover:bg-gray-200 dark:bg-[#111111] dark:hover:bg-[#1a1a1a] border border-gray-200 dark:border-[#1A1A1A] transition cursor-pointer"
            >
              Clear
            </button>
          )}
          {data && data.results && data.results.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              title="Export Current Page to CSV"
              className="h-9 px-3.5 rounded-md text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-800 transition cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> CSV Export
            </button>
          )}
        </div>
      </form>

      {/* ── Log Table Container (30 records per page) ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
        
        {/* Active Filters (if any) */}
        {(eventFilter || searchFilter) && (
          <div className="px-5 py-2.5 border-b border-gray-100 dark:border-[#1A1A1A] flex flex-wrap items-center gap-2 bg-gray-50/50 dark:bg-[#111111]">
            <span className="text-[11px] font-semibold text-slate-400">Active Filters:</span>
            {eventFilter && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                Event: {eventFilter.replace(/_/g, ' ')}
              </span>
            )}
            {searchFilter && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                Query: {searchFilter}
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
                        {log.email || '—'}
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
    </div>
  );
};

export default AuditLog;

