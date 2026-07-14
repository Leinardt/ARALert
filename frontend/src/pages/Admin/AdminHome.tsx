import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userService } from '../../services/userService';
import type { UserStats } from '../../types';
import { GraduationCap, CheckCircle, XCircle, Plus, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const AdminHome: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await userService.getStats();
        setStats(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load dashboard statistics.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
        {error || 'Could not load statistics.'}
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Enrolled Students',
      value: stats.students,
      icon: GraduationCap,
      color: 'bg-teal-50 text-teal-600 border-teal-100',
    },
    {
      title: 'Active Students',
      value: stats.active_users,
      icon: CheckCircle,
      color: 'bg-green-50 text-green-600 border-green-100',
    },
    {
      title: 'Inactive Students',
      value: stats.inactive_users,
      icon: XCircle,
      color: 'bg-red-50 text-red-600 border-red-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Welcome back, {user?.full_name || user?.username}!</h2>
          <p className="mt-1 text-sm text-gray-500">
            School Administrator Dashboard. Track student enrollment, status, and register new students.
          </p>
        </div>
        <div className="flex space-x-3 shrink-0">
          <Link
            to="/admin/students"
            className="inline-flex items-center bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
          >
            <Users className="w-4 h-4 mr-2" />
            Student Directory
          </Link>
          <Link
            to="/admin/students/create"
            className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Enroll Student
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between"
            >
              <div className="space-y-1">
                <span className="text-sm font-medium text-gray-500">{card.title}</span>
                <p className="text-3xl font-extrabold text-gray-900">{card.value}</p>
              </div>
              <div className={`p-3 rounded-lg border ${card.color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
