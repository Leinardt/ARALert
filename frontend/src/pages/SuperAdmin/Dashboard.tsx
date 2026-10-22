import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userService } from '../../services/userService';
import api from '../../api/axios';
import type { User, UserStats } from '../../types';
import {
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { StatsGridSkeleton, CardSkeleton } from '../../components/SkeletonLoader';

interface AuditMiniEntry {
  id: string;
  timestamp: string;
  action: string;
  username: string;
  ip_address: string;
}

const getActionStatus = (action: string) => {
  if (action.includes('SUCCESS') || action.includes('CREATED') || action.includes('ACTIVATED') || action.includes('APPROVED')) {
    return {
      text: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-800/40',
      label: 'Success',
    };
  }
  if (action.includes('FAILED') || action.includes('DEACTIVATED') || action.includes('REJECTED')) {
    return {
      text: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      border: 'border-rose-200 dark:border-rose-800/40',
      label: 'Alert',
    };
  }
  if (action.includes('RATE_LIMITED') || action.includes('UNKNOWN') || action.includes('REQUESTED')) {
    return {
      text: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-800/40',
      label: 'Notice',
    };
  }
  return {
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-neutral-900',
    border: 'border-slate-200 dark:border-neutral-800',
    label: 'Info',
  };
};

const formatActionName = (action: string) => {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatRelativeTime = (isoString: string) => {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recent';
  }
};

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [recentAudit, setRecentAudit] = useState<AuditMiniEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, usersRes, auditRes] = await Promise.all([
        userService.getStats().catch((err) => {
          console.warn('Could not load user stats for SuperAdmin dashboard:', err);
          return null;
        }),
        userService.getUsers({ page: 1 }).catch(() => ({ results: [] })),
        api.get('/audit-logs/?page_size=5').catch(() => ({ data: { results: [] } })),
      ]);

      setStats(statsData);
      setRecentUsers(usersRes.results?.slice(0, 5) || []);
      setRecentAudit(auditRes.data?.results?.slice(0, 5) || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch platform metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const staffTotal = stats
    ? stats.admins + stats.principals + stats.faculty + stats.tutors
    : 0;

  const activeRate = stats && stats.total_users > 0
    ? Math.round((stats.active_users / stats.total_users) * 100)
    : 0;

  const rolesBreakdown = stats
    ? [
        { label: 'Super Admin', count: 1 },
        { label: 'Administrators', count: stats.admins },
        { label: 'Principals', count: stats.principals },
        { label: 'Faculty Members', count: stats.faculty },
        { label: 'Tutors', count: stats.tutors },
        { label: 'Students', count: stats.students },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4 data-loaded-content w-full min-w-0 max-w-full">
      {/* ── Loading Skeleton ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          <StatsGridSkeleton count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-4">
              <CardSkeleton rows={6} />
              <CardSkeleton rows={5} />
            </div>
            <div className="lg:col-span-5 space-y-4">
              <CardSkeleton rows={4} />
              <CardSkeleton rows={5} />
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-5 sm:p-6 text-rose-800 dark:text-rose-200">
          <p className="text-sm font-bold text-rose-900 dark:text-rose-200">Failed to load platform dashboard</p>
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">{error}</p>
          <button
            type="button"
            onClick={loadDashboardData}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-rose-900/40 text-rose-700 dark:text-rose-200 text-xs font-semibold hover:bg-rose-100/60 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : stats ? (
        <>
          {/* ── 1. Top Metrics KPI Strip (Clean, Icon-Free, Generous Whitespace) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Total Accounts */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
                Total Accounts
              </span>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
                {(stats.total_users + 1).toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {stats.active_users.toLocaleString()} active • {stats.inactive_users.toLocaleString()} inactive ({activeRate}%)
              </p>
            </div>

            {/* Metric 2: Academic Staff */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
                Academic Staff
              </span>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
                {staffTotal.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
                {stats.tutors} Tutors • {stats.faculty} Faculty • {stats.admins} Admins
              </p>
            </div>

            {/* Metric 3: Enrolled Students */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
                Enrolled Students
              </span>
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
                {stats.students.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                ARAL program participants with LRN SSO
              </p>
            </div>

            {/* Metric 4: System Status */}
            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
              <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
                System Health
              </span>
              <div className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2">
                Operational
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Real-time auditing & database connected
              </p>
            </div>
          </div>

          {/* ── 2. Streamlined Dashboard Layout (Clean Surfaces, Focused Hierarchy) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* ── Left Column (7 cols): Role Distribution & Recent Audit Logs ── */}
            <div className="lg:col-span-7 space-y-4">
              {/* Account Distribution Card */}
              <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-neutral-800">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                      Account Distribution
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Registered user breakdown across system roles
                    </p>
                  </div>
                  <Link
                    to="/superadmin/users"
                    className="text-xs font-semibold text-[#0052B7] dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>View Directory</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-neutral-800/80 mt-1">
                  {rolesBreakdown.map((role) => {
                    const totalAccounts = (stats.total_users || 0) + 1;
                    const percentage = totalAccounts > 0
                      ? Math.max(1, Math.round((role.count / totalAccounts) * 100))
                      : 0;

                    return (
                      <div
                        key={role.label}
                        className="py-3 flex items-center justify-between gap-4 text-sm hover:bg-slate-50/50 dark:hover:bg-white/[0.02] px-2 rounded-lg transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {role.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                            {percentage}%
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white min-w-[2.5rem] text-right">
                            {role.count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Security & Audit Activity Card */}
              <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-neutral-800">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                      Recent Audit Activity
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Security logs and administrative actions
                    </p>
                  </div>
                  <Link
                    to="/superadmin/audit-logs"
                    className="text-xs font-semibold text-[#0052B7] dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Full Log</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-neutral-800/80 mt-1">
                  {recentAudit.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                      No recent audit events recorded.
                    </div>
                  ) : (
                    recentAudit.map((entry) => {
                      const status = getActionStatus(entry.action);
                      return (
                        <div
                          key={entry.id}
                          className="py-3 px-2 flex items-center justify-between gap-4 text-xs hover:bg-slate-50/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {formatActionName(entry.action)}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${status.bg} ${status.border} ${status.text}`}>
                                {status.label}
                              </span>
                            </div>
                            <p className="text-slate-400 dark:text-slate-500 truncate mt-0.5 text-[11px]">
                              {entry.username || 'System User'} {entry.ip_address ? `• ${entry.ip_address}` : ''}
                            </p>
                          </div>
                          <span className="text-slate-400 dark:text-slate-500 text-[11px] shrink-0 font-medium">
                            {formatRelativeTime(entry.timestamp)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ── Right Column (5 cols): Core Administrative Controls & Recent Users ── */}
            <div className="lg:col-span-5 space-y-4">
              {/* Core Administrative Controls */}
              <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight pb-4 border-b border-slate-100 dark:border-neutral-800">
                  Administrative Actions
                </h2>
                <div className="grid grid-cols-2 gap-2.5 mt-4">
                  <Link
                    to="/superadmin/users/create"
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-[#0052B7] dark:hover:border-blue-400 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors no-underline group"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors">
                      New User
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                      Provision account
                    </span>
                  </Link>

                  <Link
                    to="/superadmin/users"
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-[#0052B7] dark:hover:border-blue-400 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors no-underline group"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors">
                      Directory
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                      Manage all users
                    </span>
                  </Link>

                  <Link
                    to="/superadmin/audit-logs"
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-[#0052B7] dark:hover:border-blue-400 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors no-underline group"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors">
                      Audit Trail
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                      Security event logs
                    </span>
                  </Link>

                  <Link
                    to="/superadmin/settings"
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-[#0052B7] dark:hover:border-blue-400 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors no-underline group"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors">
                      Settings
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                      Platform config
                    </span>
                  </Link>
                </div>
              </div>

              {/* Recently Added Users */}
              <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-neutral-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                    Recently Added Users
                  </h2>
                  <Link to="/superadmin/users" className="text-xs font-semibold text-[#0052B7] dark:text-blue-400 hover:underline">
                    View All
                  </Link>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-neutral-800/80 mt-1">
                  {recentUsers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                      No recently created accounts.
                    </div>
                  ) : (
                    recentUsers.map((u) => {
                      const roleLabel = u.is_superuser
                        ? 'Super Admin'
                        : u.role
                        ? u.role.charAt(0).toUpperCase() + u.role.slice(1)
                        : 'User';

                      return (
                        <div
                          key={u.id}
                          className="py-3 px-2 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                              {u.email || `@${u.username}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300">
                              {roleLabel}
                            </span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                              title={u.is_active ? 'Active' : 'Inactive'}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
