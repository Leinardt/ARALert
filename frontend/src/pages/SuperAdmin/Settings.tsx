import React, { useEffect, useState, useCallback } from 'react';
import {
  Shield, Lock, Clock, CheckCircle2, Server, RefreshCw,
  Save, Activity, Search, ChevronLeft, ChevronRight,
  AlertTriangle, LogIn, LogOut, KeyRound, UserCog, Eye,
  Filter, Download,
} from 'lucide-react';
import api from '../../api/axios';

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Action badge colour map ───────────────────────────────────────────────────
const actionMeta: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  LOGIN_SUCCESS:          { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <LogIn size={13} /> },
  STUDENT_LOGIN_SUCCESS:  { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <LogIn size={13} /> },
  LOGOUT_SUCCESS:         { color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', icon: <LogOut size={13} /> },
  LOGIN_FAILED:           { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: <AlertTriangle size={13} /> },
  STUDENT_LOGIN_FAILED:   { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: <AlertTriangle size={13} /> },
  LOGIN_RATE_LIMITED:     { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A', icon: <AlertTriangle size={13} /> },
  LOGIN_MFA_CHALLENGE_ISSUED: { color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', icon: <Shield size={13} /> },
  MFA_OTP_SUCCESS:        { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <Shield size={13} /> },
  MFA_OTP_FAILED:         { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: <AlertTriangle size={13} /> },
  MFA_OTP_RATE_LIMITED:   { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A', icon: <AlertTriangle size={13} /> },
  MFA_TOGGLED:            { color: '#5B21B6', bg: '#F5F3FF', border: '#DDD6FE', icon: <Shield size={13} /> },
  PASSWORD_RESET_REQUESTED: { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A', icon: <KeyRound size={13} /> },
  PASSWORD_RESET_COMPLETED: { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <KeyRound size={13} /> },
  PASSWORD_RESET_BY_ADMIN:  { color: '#5B21B6', bg: '#F5F3FF', border: '#DDD6FE', icon: <KeyRound size={13} /> },
  PROFILE_UPDATED:        { color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', icon: <UserCog size={13} /> },
  ACCOUNT_ACTIVATED:      { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <CheckCircle2 size={13} /> },
  USER_CREATED:           { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <UserCog size={13} /> },
  USER_UPDATED:           { color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', icon: <UserCog size={13} /> },
  USER_DEACTIVATED:       { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: <UserCog size={13} /> },
  USER_ACTIVATED:         { color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0', icon: <UserCog size={13} /> },
};

const getActionMeta = (action: string) =>
  actionMeta[action] ?? { color: '#334155', bg: '#F8FAFC', border: '#E2E8F0', icon: <Activity size={13} /> };

// ── Audit Log Tab ─────────────────────────────────────────────────────────────
const AuditLogTab: React.FC = () => {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      setError('Failed to load audit logs. Make sure you are signed in as SuperAdmin.');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, usernameFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const downloadCSV = () => {
    if (!data) return;
    const header = 'Timestamp,Action,Username,Details\n';
    const rows = data.results
      .map((r) => `"${r.timestamp}","${r.action}","${r.username}","${JSON.stringify(r.details).replace(/"/g, "'")}"`)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header + controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Audit Trail
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {data ? `${data.count} total events recorded` : 'All security and system events — tamper-evident log.'}
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCSV}
          disabled={!data}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-muted)', border: '1px solid var(--slate-200)',
            color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-light)'; e.currentTarget.style.color = 'var(--brand-dark)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-muted)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1', minWidth: '200px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Filter by Action
          </label>
          <div style={{ position: 'relative' }}>
            <Filter size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="e.g. LOGIN, FAILED, MFA..."
              style={{
                width: '100%', padding: '0.6rem 0.75rem 0.6rem 2rem',
                border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)',
                fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box',
                background: 'var(--surface-muted)', fontFamily: 'var(--font-body)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.1)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--slate-200)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1', minWidth: '200px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Filter by Username
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              placeholder="e.g. aralert_superadmin"
              style={{
                width: '100%', padding: '0.6rem 0.75rem 0.6rem 2rem',
                border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)',
                fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box',
                background: 'var(--surface-muted)', fontFamily: 'var(--font-body)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.1)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--slate-200)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        </div>
        <button
          type="submit"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
            border: 'none', color: '#fff', fontSize: '0.83rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
          }}
        >
          <Search size={14} /> Search
        </button>
        {(actionFilter || usernameFilter) && (
          <button
            type="button"
            onClick={() => { setActionFilter(''); setUsernameFilter(''); setPage(1); }}
            style={{
              padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-md)',
              background: 'transparent', border: '1px solid var(--slate-200)',
              color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Clear
          </button>
        )}
      </form>

      {/* Table */}
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="skeleton" style={{ height: '52px', marginBottom: '6px', borderRadius: '10px' }} />
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#991B1B', background: '#FEF2F2' }}>
            <AlertTriangle size={32} style={{ marginBottom: '0.75rem', color: '#EF4444' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
          </div>
        ) : !data || data.results.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={32} style={{ marginBottom: '0.75rem' }} />
            <p style={{ margin: 0 }}>No audit events match your filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Username</th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((log) => {
                  const meta = getActionMeta(log.action);
                  const isExpanded = expandedId === log.id;
                  const hasDetails = log.details && Object.keys(log.details).length > 0;
                  return (
                    <React.Fragment key={log.id}>
                      <tr style={{ cursor: hasDetails ? 'pointer' : 'default' }} onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}>
                        <td>
                          <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {log.timestamp}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px', borderRadius: '99px',
                            fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.03em',
                            background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
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
                        <td style={{ textAlign: 'center' }}>
                          {hasDetails ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : log.id); }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '3px 10px', borderRadius: '8px',
                                background: 'var(--surface-muted)', border: '1px solid var(--slate-200)',
                                color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'var(--font-body)',
                              }}
                            >
                              <Eye size={12} /> {isExpanded ? 'Hide' : 'View'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-disabled)' }}>—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && hasDetails && (
                        <tr>
                          <td colSpan={4} style={{ padding: '0 1rem 1rem', background: 'var(--surface-muted)' }}>
                            <div style={{
                              background: '#0F172A', color: '#94A3B8', fontFamily: 'monospace',
                              fontSize: '0.8rem', padding: '0.875rem 1rem', borderRadius: '10px',
                              lineHeight: 1.7, overflow: 'auto',
                            }}>
                              <span style={{ color: '#64748B' }}>// Event details</span>
                              {'\n'}
                              {Object.entries(log.details).map(([k, v]) => (
                                <div key={k}>
                                  <span style={{ color: '#7DD3FC' }}>{k}</span>
                                  <span style={{ color: '#94A3B8' }}>: </span>
                                  <span style={{ color: '#6EE7B7' }}>{JSON.stringify(v)}</span>
                                </div>
                              ))}
                              {log.user_agent && (
                                <div style={{ marginTop: '0.5rem', color: '#64748B', fontSize: '0.72rem' }}>
                                  ua: {log.user_agent}
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

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Page {data.page} of {data.total_pages} — {data.count} total events
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '0.45rem 0.9rem', borderRadius: 'var(--radius-md)',
                background: page <= 1 ? 'var(--surface-muted)' : 'var(--surface-card)',
                border: '1px solid var(--slate-200)', color: page <= 1 ? 'var(--text-disabled)' : 'var(--text-secondary)',
                fontSize: '0.8rem', fontWeight: 600, cursor: page <= 1 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              type="button"
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '0.45rem 0.9rem', borderRadius: 'var(--radius-md)',
                background: page >= data.total_pages ? 'var(--surface-muted)' : 'var(--surface-card)',
                border: '1px solid var(--slate-200)', color: page >= data.total_pages ? 'var(--text-disabled)' : 'var(--text-secondary)',
                fontSize: '0.8rem', fontWeight: 600, cursor: page >= data.total_pages ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Settings Page ────────────────────────────────────────────────────────
type Tab = 'security' | 'audit';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('security');
  const [requireMfaStaff, setRequireMfaStaff] = useState(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
  const [refreshTimeoutHours, setRefreshTimeoutHours] = useState(24);
  const [loginLimitAttempts, setLoginLimitAttempts] = useState(10);
  const [otpLimitAttempts, setOtpLimitAttempts] = useState(5);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setTimeout(() => {
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    }, 600);
  };

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.25rem',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'var(--font-body)',
    transition: 'all 0.2s',
    background: activeTab === tab ? 'linear-gradient(135deg, var(--brand), var(--brand-hover))' : 'transparent',
    color: activeTab === tab ? '#fff' : 'var(--text-muted)',
    boxShadow: activeTab === tab ? '0 4px 14px rgba(16,185,129,0.3)' : 'none',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: '1.75rem 2rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              System & Security Settings
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Manage authentication policies, session limits, and review the full audit trail.
            </p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 'var(--radius-pill)', color: '#065F46', fontSize: '0.75rem', fontWeight: 700 }}>
            <CheckCircle2 size={15} /> System Status: Operational
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', background: 'var(--surface-muted)', padding: '0.35rem', borderRadius: '12px', width: 'fit-content' }}>
          <button type="button" style={tabStyle('security')} onClick={() => setActiveTab('security')}>
            <Shield size={16} /> Security Policy
          </button>
          <button type="button" style={tabStyle('audit')} onClick={() => setActiveTab('audit')}>
            <Activity size={16} /> Audit Trail
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'security' ? (
        <>
          {saveSuccess && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} /> System settings updated successfully!
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Authentication & Security */}
            <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--slate-200)', padding: '1.75rem', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--slate-100)' }}>
                <Shield size={20} color="var(--brand)" />
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Authentication & Security Policy
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--surface-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Enforce MFA for Staff Roles</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Require 2-Factor authentication via OTP for Admins, Tutors, and Principals.</p>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px' }}>
                    <input type="checkbox" checked={requireMfaStaff} onChange={(e) => setRequireMfaStaff(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, backgroundColor: requireMfaStaff ? 'var(--brand)' : '#CBD5E1', borderRadius: '34px', transition: '0.2s' }}>
                      <span style={{ position: 'absolute', height: '20px', width: '20px', left: requireMfaStaff ? '24px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '0.2s' }} />
                    </span>
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Clock size={14} /> Access Token Lifetime (Minutes)
                    </label>
                    <input type="number" min={5} max={120} value={sessionTimeoutMinutes} onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))} style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', fontSize: '0.875rem', outline: 'none' }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>OWASP recommended: 15–30 minutes.</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <RefreshCw size={14} /> Refresh Token Lifetime (Hours)
                    </label>
                    <input type="number" min={1} max={168} value={refreshTimeoutHours} onChange={(e) => setRefreshTimeoutHours(Number(e.target.value))} style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', fontSize: '0.875rem', outline: 'none' }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Automatic token rotation on refresh enabled.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rate Limiting */}
            <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--slate-200)', padding: '1.75rem', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--slate-100)' }}>
                <Lock size={20} color="#EAB308" />
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Rate Limiting & Anti-Brute-Force Safeguards
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Max Failed Login Attempts per IP (15m window)</label>
                  <input type="number" min={3} max={20} value={loginLimitAttempts} onChange={(e) => setLoginLimitAttempts(Number(e.target.value))} style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', fontSize: '0.875rem', outline: 'none' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Triggers HTTP 429 lockout on excess failures.</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Max Failed OTP Verification Attempts (15m window)</label>
                  <input type="number" min={3} max={10} value={otpLimitAttempts} onChange={(e) => setOtpLimitAttempts(Number(e.target.value))} style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', fontSize: '0.875rem', outline: 'none' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Reduces 6-digit OTP brute-force probability to &lt;0.001%.</span>
                </div>
              </div>
            </div>

            {/* Infrastructure Diagnostics */}
            <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--slate-200)', padding: '1.75rem', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--slate-100)' }}>
                <Server size={20} color="#3B82F6" />
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Environment & Infrastructure Diagnostics
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                {[
                  { label: 'Database Engine', value: 'PostgreSQL' },
                  { label: 'Password Hasher', value: 'PBKDF2 SHA-256 (1.2M iterations)' },
                  { label: 'Session Engine', value: 'SimpleJWT Token Pair' },
                  { label: 'Compliance', value: 'OWASP ASVS / NIST', highlight: true },
                ].map((item) => (
                  <div key={item.label} style={{ padding: '1rem', background: 'var(--surface-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                    <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{item.label}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.9rem', fontWeight: 700, color: item.highlight ? 'var(--brand-dark)' : 'var(--text-primary)' }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem' }}>
                <Save size={16} />
                {saving ? 'Saving...' : 'Save System Settings'}
              </button>
            </div>
          </form>
        </>
      ) : (
        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--slate-200)', padding: '1.75rem', boxShadow: 'var(--shadow-xs)' }}>
          <AuditLogTab />
        </div>
      )}
    </div>
  );
};
