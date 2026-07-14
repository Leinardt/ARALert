import React, { useEffect, useState } from 'react';
import { userService } from '../../services/userService';
import type { UserStats } from '../../types';
import { Users, CheckCircle, XCircle, Shield, GraduationCap, School, BookOpen, UserCheck } from 'lucide-react';

export const Dashboard: React.FC = () => {
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
      title: 'Total Users',
      value: stats.total_users,
      icon: Users,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      title: 'Active Users',
      value: stats.active_users,
      icon: CheckCircle,
      color: 'bg-green-50 text-green-600 border-green-100',
    },
    {
      title: 'Inactive Users',
      value: stats.inactive_users,
      icon: XCircle,
      color: 'bg-red-50 text-red-600 border-red-100',
    },
    {
      title: 'School Admins',
      value: stats.admins,
      icon: Shield,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
    },
    {
      title: 'Principals',
      value: stats.principals,
      icon: School,
      color: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    },
    {
      title: 'Faculty members',
      value: stats.faculty,
      icon: UserCheck,
      color: 'bg-orange-50 text-orange-600 border-orange-100',
    },
    {
      title: 'Academic Tutors',
      value: stats.tutors,
      icon: BookOpen,
      color: 'bg-pink-50 text-pink-600 border-pink-100',
    },
    {
      title: 'Registered Students',
      value: stats.students,
      icon: GraduationCap,
      color: 'bg-teal-50 text-teal-600 border-teal-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Welcome to SuperAdmin Dashboard</h2>
        <p className="mt-1 text-sm text-gray-500">
          This system dashboard allows you to monitor user accounts, audit statistics, and create new users.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
