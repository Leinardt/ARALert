import React, { useEffect, useState } from 'react';
import { userService } from '../../services/userService';
import type { UserStats } from '../../types';
import {
  Users,
  UserCheck,
  UserX,
  Briefcase,
  GraduationCap,
  Shield,
  BookOpen,
  Award,
  LinkIcon,
} from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  accentBg: string;
  accentBorder: string;
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  accentBg,
  accentBorder,
  delay = 0,
}) => (
  <div
    className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex items-center gap-4 animate-fade-in-up"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div
      className={`w-11 h-11 rounded-xl ${accentBg} border ${accentBorder} flex items-center justify-center shrink-0`}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await userService.getStats();
        setStats(data);
      } catch (err: unknown) {
        console.error('Failed to load dashboard stats', err);
        setError('Unable to load dashboard statistics.');
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const staffTotal = stats
    ? stats.admins + stats.principals + stats.faculty + stats.tutors
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3 animate-fade-in-up">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">System Overview</p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-gray-900">SuperAdmin Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">{today}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-3.5 py-2 text-sm font-semibold text-indigo-600 shrink-0">
          <Shield className="w-4 h-4" />
          System Administrator
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="w-10 h-10 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-600">Loading statistics…</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 shadow-sm">
          <p className="text-sm font-bold">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      ) : stats ? (
        <>
          {/* Primary Stats — Top row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Total Users"
              value={stats.total_users}
              subtitle={`Active: ${stats.active_users} · Inactive: ${stats.inactive_users}`}
              icon={<Users className="w-5 h-5 text-indigo-500" />}
              accentBg="bg-indigo-50"
              accentBorder="border-indigo-100"
              delay={50}
            />
            <StatCard
              label="Active Users"
              value={stats.active_users}
              subtitle="Currently active accounts"
              icon={<UserCheck className="w-5 h-5 text-emerald-500" />}
              accentBg="bg-emerald-50"
              accentBorder="border-emerald-100"
              delay={100}
            />
            <StatCard
              label="Total Staff"
              value={staffTotal}
              subtitle={`Admins ${stats.admins} · Principals ${stats.principals}`}
              icon={<Briefcase className="w-5 h-5 text-amber-600" />}
              accentBg="bg-amber-50"
              accentBorder="border-amber-100"
              delay={150}
            />
            <StatCard
              label="Students"
              value={stats.students}
              subtitle={`Assigned: ${stats.assigned_students} · Unassigned: ${stats.unassigned_students}`}
              icon={<GraduationCap className="w-5 h-5 text-indigo-500" />}
              accentBg="bg-indigo-50"
              accentBorder="border-indigo-100"
              delay={200}
            />
          </div>

          {/* Role Breakdown — Second row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Admins"
              value={stats.admins}
              icon={<Shield className="w-5 h-5 text-violet-600" />}
              accentBg="bg-violet-50"
              accentBorder="border-indigo-100"
              delay={250}
            />
            <StatCard
              label="Principals"
              value={stats.principals}
              icon={<Award className="w-5 h-5 text-amber-600" />}
              accentBg="bg-amber-50"
              accentBorder="border-amber-100"
              delay={300}
            />
            <StatCard
              label="Faculty"
              value={stats.faculty}
              icon={<BookOpen className="w-5 h-5 text-emerald-500" />}
              accentBg="bg-emerald-50"
              accentBorder="border-emerald-100"
              delay={350}
            />
            <StatCard
              label="Tutors"
              value={stats.tutors}
              icon={<Users className="w-5 h-5 text-indigo-500" />}
              accentBg="bg-indigo-50"
              accentBorder="border-indigo-100"
              delay={400}
            />
          </div>

          {/* Summary footer */}
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-3 text-sm text-gray-600 animate-fade-in-up"
            style={{ animationDelay: '450ms' }}
          >
            <LinkIcon className="w-4 h-4 text-[var(--brand)]" />
            <span>
              <span className="font-semibold text-gray-900">{stats.assigned_students}</span> students assigned to tutors
              <span className="mx-2 text-gray-300">·</span>
              <span className="font-semibold text-gray-900">{stats.unassigned_students}</span> unassigned
              <span className="mx-2 text-gray-300">·</span>
              <span className="font-semibold text-gray-900">{stats.inactive_users}</span> inactive accounts
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
};
