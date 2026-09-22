import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userService } from '../../services/userService';
import type { UserStats } from '../../types';
import {
  ArrowUpRight,
  ShieldAlert,
  Shield,
  Award,
  BookOpen,
  Users,
  GraduationCap,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch platform metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const staffTotal = stats
    ? stats.admins + stats.principals + stats.faculty + stats.tutors
    : 0;

  const activeRate = stats && stats.total_users > 0
    ? Math.round((stats.active_users / stats.total_users) * 100)
    : 0;

  const rolesBreakdown = stats
    ? [
        { label: 'Super Admin', count: 1, icon: ShieldAlert, color: 'text-rose-600 dark:text-rose-400' },
        { label: 'Administrators', count: stats.admins, icon: Shield, color: 'text-violet-600 dark:text-violet-400' },
        { label: 'Principals', count: stats.principals, icon: Award, color: 'text-amber-600 dark:text-amber-400' },
        { label: 'Faculty Members', count: stats.faculty, icon: BookOpen, color: 'text-blue-600 dark:text-blue-400' },
        { label: 'Tutors', count: stats.tutors, icon: Users, color: 'text-indigo-600 dark:text-indigo-400' },
        { label: 'Students', count: stats.students, icon: GraduationCap, color: 'text-emerald-600 dark:text-emerald-400' },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* ── Loading State ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c111c] p-12 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
            <div className="w-7 h-7 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading platform overview…</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-md border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 flex items-start gap-3 text-rose-800 dark:text-rose-200">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">Failed to load statistics</p>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{error}</p>
            <button
              type="button"
              onClick={loadStats}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-rose-300 dark:border-rose-800 bg-white dark:bg-rose-900/40 text-rose-700 dark:text-rose-200 text-xs font-medium hover:bg-rose-100/60 dark:hover:bg-rose-900/60 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        </div>
      ) : stats ? (
        <>
          {/* ── 1 + 3 Tile Layout (Compact & Balanced) ────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* ── Primary Tile — System Overview (Compact, 42% width) ──────── */}
            <div className="lg:col-span-5 rounded-md border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0c111c] p-4 flex flex-col justify-between transition-colors">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    System Overview
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>

                <div className="my-2.5">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Total Registered Users
                  </p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {stats.total_users.toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ({activeRate}% active)
                    </span>
                  </div>
                  {/* Micro active indicator bar */}
                  <div className="mt-2 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                    <div className="bg-[var(--brand)]" style={{ width: `${activeRate}%` }} />
                    <div className="bg-slate-300 dark:bg-slate-700" style={{ width: `${100 - activeRate}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{stats.active_users.toLocaleString()} active</span>
                    <span>{stats.inactive_users.toLocaleString()} inactive</span>
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  Staff: <strong className="font-semibold text-slate-800 dark:text-slate-200">{staffTotal}</strong>
                  <span className="mx-1.5 text-slate-300 dark:text-slate-700">•</span>
                  Students: <strong className="font-semibold text-slate-800 dark:text-slate-200">{stats.students}</strong>
                </span>
                <Link
                  to="/superadmin/users"
                  className="inline-flex items-center gap-0.5 font-semibold text-[var(--brand)] hover:underline"
                >
                  <span>Directory</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* ── Account Distribution Section (Replaces the 3 cards) ────────── */}
            <div className="lg:col-span-7 rounded-md border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0c111c] p-4 flex flex-col justify-between transition-colors">
              <div>
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Account Distribution
                    </span>
                    <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      Distribution by Role
                    </h2>
                  </div>
                  <Link
                    to="/superadmin/users"
                    className="text-xs font-medium text-[var(--brand)] hover:underline inline-flex items-center gap-1"
                  >
                    <span>View Directory</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/70 mt-1">
                  {rolesBreakdown.map((role) => {
                    const totalAccounts = (stats.total_users || 0) + 1;
                    const percentage = totalAccounts > 0
                      ? Math.max(1, Math.round((role.count / totalAccounts) * 100))
                      : 0;
                    const IconComponent = role.icon;

                    return (
                      <div
                        key={role.label}
                        className="py-2 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-1 rounded transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <IconComponent className={`w-3.5 h-3.5 shrink-0 ${role.color}`} />
                          <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                            {role.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-20 hidden sm:block">
                            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-[var(--brand)]/70 dark:bg-[var(--brand)] rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 w-9 text-right font-mono">
                            {percentage}%
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-white min-w-[2.2rem] text-right">
                            {role.count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Active Rate: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activeRate}%</span></span>
                <span>Total Accounts: <strong className="font-semibold text-slate-800 dark:text-slate-200">{(stats.total_users + 1).toLocaleString()}</strong></span>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
