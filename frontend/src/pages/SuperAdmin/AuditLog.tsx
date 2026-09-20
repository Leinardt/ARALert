import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, Filter, Download, ChevronLeft, ChevronRight,
  AlertTriangle, LogIn, LogOut, KeyRound, UserCog, Eye,
  Shield, CheckCircle2, RefreshCw, Activity,
} from 'lucide-react';
import api from '../../api/axios';

// ── Types ──────────────────────────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  username: string;
  ip_address: string;
  user_agent: string;
  details: Record<string, unknown>;
}

interface AuditResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: AuditEntry[];
}

// ── Action badge styles ────────────────────────────────────────────────────────
const ACTION_META: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; category: string }> = {
  LOGIN_SUCCESS:                        { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <LogIn size={12} />,       category: 'auth' },
  GOOGLE_LOGIN_SUCCESS:                 { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <LogIn size={12} />,       category: 'auth' },
  STUDENT_LOGIN_SUCCESS:                { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <LogIn size={12} />,       category: 'auth' },
  LOGOUT_SUCCESS:                       { color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', icon: <LogOut size={12} />,      category: 'auth' },
  LOGIN_FAILED:                         { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: <AlertTriangle size={12}/>, category: 'security' },
  STUDENT_LOGIN_FAILED:                 { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: <AlertTriangle size={12}/>, category: 'security' },
  GOOGLE_LOGIN_INVALID_TOKEN:           { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: <AlertTriangle size={12}/>, category: 'security' },
  GOOGLE_LOGIN_UNREGISTERED_EMAIL:      { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A', icon: <AlertTriangle size={12}/>, category: 'security' },
  LOGIN_RATE_LIMITED:                   { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A', icon: <AlertTriangle size={12}/>, category: 'security' },
  STUDENT_LOGIN_RATE_LIMITED:           { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A', icon: <AlertTriangle size={12}/>, category: 'security' },
  GOOGLE_LOGIN_RATE_LIMITED:            { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A', icon: <AlertTriangle size={12}/>, category: 'security' },
  LOGIN_MFA_CHALLENGE_ISSUED:           { color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', icon: <Shield size={12} />,      category: 'auth' },
  MFA_OTP_SUCCESS:                      { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <Shield size={12} />,      category: 'auth' },
  MFA_OTP_FAILED:                       { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: <AlertTriangle size={12}/>, category: 'security' },
  MFA_OTP_RATE_LIMITED:                 { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A', icon: <AlertTriangle size={12}/>, category: 'security' },
  MFA_TOGGLED:                          { color: '#5B21B6', bg: '#F5F3FF', border: '#DDD6FE', icon: <Shield size={12} />,      category: 'settings' },
  MFA_OTP_INVALID_USER:                 { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: <AlertTriangle size={12}/>, category: 'security' },
  PASSWORD_RESET_REQUESTED:             { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A', icon: <KeyRound size={12} />,    category: 'auth' },
  PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL: { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A', icon: <KeyRound size={12} />, category: 'security' },
  PASSWORD_RESET_COMPLETED:             { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <KeyRound size={12} />,    category: 'auth' },
  PASSWORD_RESET_BY_ADMIN:              { color: '#5B21B6', bg: '#F5F3FF', border: '#DDD6FE', icon: <KeyRound size={12} />,    category: 'admin' },
  PROFILE_UPDATED:                      { color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', icon: <UserCog size={12} />,     category: 'admin' },
  ACCOUNT_ACTIVATED:                    { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <CheckCircle2 size={12}/>, category: 'admin' },
  USER_CREATED:                         { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <UserCog size={12} />,     category: 'admin' },
  USER_UPDATED:                         { color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', icon: <UserCog size={12} />,     category: 'admin' },
  USER_DEACTIVATED:                     { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: <UserCog size={12} />,     category: 'admin' },
  USER_ACTIVATED:                       { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <UserCog size={12} />,     category: 'admin' },
  BULK_TUTOR_ASSIGNED:                  { color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD', icon: <UserCog size={12} />,     category: 'admin' },
  STUDENT_EDIT_REQUEST_CREATED:         { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: <UserCog size={12} />,     category: 'admin' },
  STUDENT_EDIT_REQUEST_APPROVED:        { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: <CheckCircle2 size={12}/>, category: 'admin' },
  STUDENT_EDIT_REQUEST_REJECTED:        { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: <AlertTriangle size={12}/>, category: 'admin' },
  ALLOWED_EMAIL_ADDED:                  { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <CheckCircle2 size={12}/>, category: 'admin' },
  ALLOWED_EMAIL_REMOVED:                { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: <AlertTriangle size={12}/>, category: 'admin' },
};

const getMeta = (action: string) =>
  ACTION_META[action] ?? { color: '#334155', bg: '#F8FAFC', border: '#E2E8F0', icon: <Activity size={12} />, category: 'other' };

// ── Category summary pill ──────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  auth:     { bg: '#ECFDF5', color: '#065F46' },
  security: { bg: '#FEF2F2', color: '#991B1B' },
  admin:    { bg: '#EFF6FF', color: '#1E40AF' },
  settings: { bg: '#F5F3FF', color: '#5B21B6' },
  other:    { bg: '#F8FAFC', color: '#334155' },
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export const AuditLog: React.FC = () => {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionInput, setActionInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (actionFilter) params.set('action', actionFilter);
      if (usernameFilter) params.set('username', usernameFilter);
      const res = await api.get<AuditResponse>(`/users/audit-logs/?${params}`);
      setData(res.data);
    } catch {
      setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, usernameFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActionFilter(actionInput);
    setUsernameFilter(usernameInput);
    setPage(1);
  };

  const handleClear = () => {
    setActionInput('');
    setUsernameInput('');
    setActionFilter('');
    setUsernameFilter('');
    setPage(1);
  };

  const downloadCSV = () => {
    if (!data) return;
    const header = 'Timestamp,Action,Username,IP Address,Details\n';
    const rows = data.results
      .map((r) => `"${r.timestamp}","${r.action}","${r.username}","${r.ip_address}","${JSON.stringify(r.details).replace(/"/g, "'")}"`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aralert_audit_log_page${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={fetchLogs}
            title="Refresh"
            style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'var(--surface-muted)', border: '1px solid var(--slate-200)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)',
              transition: 'var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-light)'; e.currentTarget.style.color = 'var(--brand-dark)'; e.currentTarget.style.borderColor = 'var(--brand-border)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-muted)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--slate-200)'; }}
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            onClick={downloadCSV}
            disabled={!data}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <form onSubmit={handleSearch} style={{
        background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--slate-200)', padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-xs)',
        display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '1', minWidth: '200px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Filter by Action
          </label>
          <div style={{ position: 'relative' }}>
            <Filter size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              placeholder="LOGIN, FAILED, MFA, RESET…"
              style={{
                width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.1rem',
                border: '1.5px solid var(--slate-200)', borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'var(--font-body)', background: 'var(--surface-muted)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.1)'; e.currentTarget.style.background = 'var(--surface-card)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--slate-200)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'var(--surface-muted)'; }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '1', minWidth: '200px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Filter by Username
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="aralert_superadmin…"
              style={{
                width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.1rem',
                border: '1.5px solid var(--slate-200)', borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'var(--font-body)', background: 'var(--surface-muted)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.1)'; e.currentTarget.style.background = 'var(--surface-card)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--slate-200)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'var(--surface-muted)'; }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="submit"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
              border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
            }}
          >
            <Search size={15} /> Search
          </button>
          {(actionFilter || usernameFilter) && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)',
                background: 'transparent', border: '1.5px solid var(--slate-200)',
                color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontWeight: 600,
              }}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* ── Log Table ── */}
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>

        {/* Table header info bar */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-muted)' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {loading ? 'Loading events…' : data ? `Showing ${data.results.length} of ${data.count} events` : ''}
          </p>
          {(actionFilter || usernameFilter) && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {actionFilter && (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--brand-light)', color: 'var(--brand-dark)', padding: '2px 10px', borderRadius: '99px', border: '1px solid var(--brand-border)' }}>
                  action: {actionFilter}
                </span>
              )}
              {usernameFilter && (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--brand-light)', color: 'var(--brand-dark)', padding: '2px 10px', borderRadius: '99px', border: '1px solid var(--brand-border)' }}>
                  user: {usernameFilter}
                </span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '1.5rem' }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="skeleton" style={{ height: '54px', marginBottom: '8px', borderRadius: '10px', animationDelay: `${i * 0.07}s` }} />
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <AlertTriangle size={28} color="#EF4444" />
            </div>
            <p style={{ margin: 0, fontWeight: 700, color: '#991B1B' }}>{error}</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Make sure you are signed in as SuperAdmin.</p>
          </div>
        ) : !data || data.results.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Activity size={28} color="var(--text-muted)" />
            </div>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-secondary)' }}>No audit events match your filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '750px' }}>
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Event</th>
                  <th>Username</th>
                  <th>IP Address</th>
                  <th>Browser / Agent</th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((log, idx) => {
                  const meta = getMeta(log.action);
                  const isExpanded = expandedId === log.id;
                  const hasDetails = log.details && Object.keys(log.details).length > 0;
                  const shortAgent = log.user_agent
                    ? log.user_agent.replace(/\(.*?\)/g, '').replace(/AppleWebKit\/[\d.]+/, '').trim().slice(0, 40)
                    : '';

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        style={{ animationDelay: `${idx * 0.03}s` }}
                        className="animate-fade-in"
                      >
                        <td>
                          <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {log.timestamp}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px 3px 7px', borderRadius: '99px',
                            fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.02em',
                            background: meta.bg, color: meta.color,
                            border: `1px solid ${meta.border}`,
                            whiteSpace: 'nowrap',
                          }}>
                            {meta.icon}
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {log.username}
                          </span>
                        </td>
                        <td>
                          <code style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--surface-muted)', padding: '2px 7px', borderRadius: '6px' }}>
                            {log.ip_address}
                          </code>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={log.user_agent}>
                            {shortAgent || '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {hasDetails ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : log.id)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '3px 10px', borderRadius: '8px',
                                background: isExpanded ? 'var(--brand-light)' : 'var(--surface-muted)',
                                border: `1px solid ${isExpanded ? 'var(--brand-border)' : 'var(--slate-200)'}`,
                                color: isExpanded ? 'var(--brand-dark)' : 'var(--text-muted)',
                                fontSize: '0.75rem', fontWeight: 700,
                                cursor: 'pointer', fontFamily: 'var(--font-body)',
                                transition: 'all 0.15s',
                              }}
                            >
                              <Eye size={12} /> {isExpanded ? 'Hide' : 'View'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-disabled)' }}>—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable details row */}
                      {isExpanded && hasDetails && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0 1.25rem 1rem', background: 'var(--surface-muted)' }}>
                            <div style={{
                              background: '#0F172A',
                              borderRadius: '12px',
                              padding: '1rem 1.25rem',
                              fontFamily: 'monospace',
                              fontSize: '0.82rem',
                              lineHeight: 1.8,
                              color: '#94A3B8',
                              overflow: 'auto',
                            }}>
                              <div style={{ color: '#64748B', marginBottom: '0.5rem', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                                // {log.action} — {log.timestamp}
                              </div>
                              {Object.entries(log.details).map(([k, v]) => (
                                <div key={k}>
                                  <span style={{ color: '#7DD3FC' }}>{k}</span>
                                  <span style={{ color: '#94A3B8' }}>{': '}</span>
                                  <span style={{ color: '#6EE7B7' }}>{JSON.stringify(v)}</span>
                                </div>
                              ))}
                              {log.user_agent && (
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', color: '#64748B', fontSize: '0.72rem' }}>
                                  user_agent: {log.user_agent}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {data && data.total_pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Page <strong>{data.page}</strong> of <strong>{data.total_pages}</strong> — {data.count.toLocaleString()} total events
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: page <= 1 ? 0.4 : 1 }}
            >
              <ChevronLeft size={15} /> Previous
            </button>
            {/* Page number pills */}
            {Array.from({ length: Math.min(data.total_pages, 5) }, (_, i) => {
              const p = Math.max(1, Math.min(data.total_pages - 4, page - 2)) + i;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  style={{
                    width: '34px', height: '34px', borderRadius: '9px', border: 'none',
                    background: p === page ? 'linear-gradient(135deg, var(--brand), var(--brand-hover))' : 'var(--surface-muted)',
                    color: p === page ? '#fff' : 'var(--text-secondary)',
                    fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    boxShadow: p === page ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              type="button"
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: page >= data.total_pages ? 0.4 : 1 }}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Legend ── */}
    </div>
  );
};
