import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';
import {
  Filter,
  RefreshCw,
  Search,
  Users,
  CheckCircle,
  Clock,
  UserX
} from 'lucide-react';

export const PrincipalHome: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchAttendanceLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (filterRole) params.role = filterRole;
      if (filterStatus) params.status = filterStatus;
      if (filterDate) params.date = filterDate;

      const data = await academicService.getAttendanceHistory(params);
      setLogs(data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch attendance monitoring database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceLogs();
  }, [filterRole, filterStatus, filterDate]);

  // Client-side search filtering
  const filteredLogs = logs.filter(log => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.user_name.toLowerCase().includes(q) ||
      (log.user_lrn && log.user_lrn.includes(q)) ||
      (log.tutor_name && log.tutor_name.toLowerCase().includes(q))
    );
  });

  // Calculate statistics
  const totalCount = filteredLogs.length;
  const presentCount = filteredLogs.filter(l => l.status === 'present').length;
  const lateCount = filteredLogs.filter(l => l.status === 'late').length;
  const absentCount = filteredLogs.filter(l => l.status === 'absent').length;

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Welcome, Principal {user?.last_name}!</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium">
            Universal School-wide Attendance Monitoring Portal. Read-only records view.
          </p>
        </div>
        <button
          onClick={fetchAttendanceLogs}
          className="inline-flex items-center bg-indigo-650 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-xl text-sm font-semibold border border-indigo-100 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Database
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total Records</span>
            <p className="text-2xl font-extrabold text-gray-900">{totalCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 hidden sm:block">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Present</span>
            <p className="text-2xl font-extrabold text-green-700">{presentCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-green-50 text-green-600 border border-green-100 hidden sm:block">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Late</span>
            <p className="text-2xl font-extrabold text-yellow-700">{lateCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-yellow-50 text-yellow-600 border border-yellow-100 hidden sm:block">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Absent</span>
            <p className="text-2xl font-extrabold text-red-700">{absentCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-red-50 text-red-600 border border-red-100 hidden sm:block">
            <UserX className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main panel */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        {/* Filter controls */}
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
          <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-gray-500">
              <Filter className="w-4 h-4" />
              <span>Filters:</span>
            </div>

            {/* Role Filter */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="student">Students</option>
              <option value="tutor">Tutors</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admins</option>
              <option value="principal">Principals</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </select>

            {/* Date Filter */}
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white cursor-pointer"
            />
          </div>

          {/* Search bar */}
          <div className="relative w-full xl:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name, LRN or tutor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>
        </div>

        {/* Database records table */}
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl p-4">{error}</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-gray-500 border border-dashed border-gray-150 rounded-xl">
            <p className="text-sm font-bold">No attendance records match the criteria.</p>
            <p className="text-xs mt-1 text-gray-400">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-150 rounded-xl">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Time In</th>
                  <th className="px-6 py-3.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Time Out</th>
                  <th className="px-6 py-3.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Tutor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 bg-white">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3.5 text-sm font-bold text-gray-800 whitespace-nowrap">{log.date}</td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{log.user_name}</div>
                      {log.user_lrn && <div className="text-xs text-gray-400">LRN: {log.user_lrn}</div>}
                    </td>
                    <td className="px-6 py-3.5 text-center whitespace-nowrap">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border border-indigo-100">
                        {log.role}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center text-sm font-mono text-gray-600 whitespace-nowrap">
                      {log.time_in ? new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-center text-sm font-mono text-gray-600 whitespace-nowrap">
                      {log.time_out ? new Date(log.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-center whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase ${
                        log.status === 'present'
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : log.status === 'late'
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                          : 'bg-red-50 text-red-700 border-red-100'
                      }`}>
                        {log.status_display}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-650 whitespace-nowrap font-medium">{log.tutor_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
