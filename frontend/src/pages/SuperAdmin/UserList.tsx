import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { Search, Plus, Edit, ShieldAlert, ShieldCheck, Key, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const UserList: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter, Search, Sort & Pagination States
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ordering, setOrdering] = useState('-date_joined');
  const [page, setPage] = useState(1);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        ordering,
        page,
      });
      setUsers(data.results);
      setTotalCount(data.count);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch user directory.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter, ordering, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const toggleUserStatus = async (id: string, currentlyActive: boolean) => {
    try {
      if (currentlyActive) {
        await userService.deactivateUser(id);
      } else {
        await userService.activateUser(id);
      }
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Failed to update user account status.');
    }
  };

  const handleResetPassword = async (id: string, username: string) => {
    const newPassword = prompt(`Enter a new password for ${username} (min 8 characters):`);
    if (newPassword === null) return; // Cancelled
    if (newPassword.trim().length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }
    
    try {
      await userService.resetPassword(id, {
        new_password: newPassword,
        confirm_password: newPassword
      });
      alert('Password has been updated successfully!');
    } catch (err: any) {
      console.error(err);
      const errors = err.response?.data?.errors;
      alert(errors?.detail || 'Failed to reset password.');
    }
  };

  const handleSort = (field: string) => {
    if (ordering === field) {
      setOrdering(`-${field}`);
    } else {
      setOrdering(field);
    }
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / 10);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {currentUser?.is_superuser ? 'User Management System' : 'Student Directory'}
          </h2>
          <p className="text-sm text-gray-500">
            {currentUser?.is_superuser
              ? 'Query, register, edit, and adjust status flags for system users.'
              : 'Query, enroll, edit, and adjust status flags for student accounts.'}
          </p>
        </div>
        <Link
          to={currentUser?.is_superuser ? '/superadmin/users/create' : '/admin/students/create'}
          className="inline-flex items-center bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2" />
          {currentUser?.is_superuser ? 'Create User' : 'Enroll Student'}
        </Link>
      </div>

      {/* Query Bar */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search by full name, username, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
          <button
            type="submit"
            className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap gap-4 items-center">
          {currentUser?.is_superuser && (
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Role:</label>
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-[var(--brand)] focus:border-[var(--brand)] bg-white"
              >
                <option value="">All Roles</option>
                <option value="admin">School Admin</option>
                <option value="principal">Principal</option>
                <option value="faculty">Faculty</option>
                <option value="tutor">Tutor</option>
                <option value="student">Student</option>
              </select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-[var(--brand)] focus:border-[var(--brand)] bg-white"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600 font-medium">{error}</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm font-medium">No accounts found matching queries.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      UUID
                    </th>
                    <th
                      onClick={() => handleSort('first_name')}
                      className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center">
                        Full Name
                        <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-gray-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('username')}
                      className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center">
                        Username
                        <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-gray-400" />
                      </div>
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    {currentUser?.is_superuser ? (
                      <th
                        onClick={() => handleSort('role')}
                        className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center">
                          Role
                          <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-gray-400" />
                        </div>
                      </th>
                    ) : (
                      <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        LRN
                      </th>
                    )}
                    <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th
                      onClick={() => handleSort('date_joined')}
                      className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center">
                        Date Created
                        <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-gray-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('last_login')}
                      className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    >
                      <div className="flex items-center">
                        Last Login
                        <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-gray-400" />
                      </div>
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right pr-8">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {users.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-[10px] text-gray-400 truncate max-w-[100px]" title={item.id}>
                        {item.id}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {item.full_name}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {item.username || (item.password_setup_required ? 'Not Set' : '—')}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {item.email}
                      </td>
                      {currentUser?.is_superuser ? (
                        <td className="px-6 py-4 text-gray-600 capitalize">
                          <div>{item.role === 'admin' ? 'School Admin' : item.role}</div>
                          {item.role === 'student' && item.lrn && (
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5" title="Learner Reference Number">
                              LRN: {item.lrn}
                            </div>
                          )}
                        </td>
                      ) : (
                        <td className="px-6 py-4 text-gray-600 font-mono">
                          {item.lrn || 'N/A'}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            item.password_setup_required && !item.is_active
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : item.is_active
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {item.password_setup_required && !item.is_active ? 'Pending Verification' : item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {formatDateTime(item.date_joined)}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {formatDateTime(item.last_login)}
                      </td>
                      <td className="px-6 py-4 text-right pr-8 space-x-2 whitespace-nowrap">
                        <Link
                          to={currentUser?.is_superuser ? `/superadmin/users/edit/${item.id}` : `/admin/students/edit/${item.id}`}
                          className="inline-flex items-center text-gray-500 hover:text-[var(--brand)] p-1 border border-gray-200 rounded hover:border-[var(--brand-border)] bg-gray-50 hover:bg-[var(--brand-light)]/50 transition-all"
                          title={currentUser?.is_superuser ? 'Edit User' : 'Edit Student'}
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => toggleUserStatus(item.id, item.is_active)}
                          className={`inline-flex items-center p-1 border rounded transition-all cursor-pointer ${
                            item.is_active
                              ? 'text-gray-500 hover:text-red-600 border-gray-200 hover:border-red-100 bg-gray-50 hover:bg-red-50/50'
                              : 'text-gray-500 hover:text-green-600 border-gray-200 hover:border-green-100 bg-gray-50 hover:bg-green-50/50'
                          }`}
                          title={item.is_active ? 'Deactivate User' : 'Activate User'}
                        >
                          {item.is_active ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleResetPassword(item.id, item.username)}
                          className="inline-flex items-center text-gray-500 hover:text-yellow-600 p-1 border border-gray-200 rounded hover:border-yellow-100 bg-gray-50 hover:bg-yellow-50/50 transition-all cursor-pointer"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-white px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Showing page <span className="font-semibold text-gray-800">{page}</span> of{' '}
                  <span className="font-semibold text-gray-800">{totalPages}</span> ({totalCount} total {currentUser?.is_superuser ? 'users' : 'students'})
                </span>
                <div className="flex space-x-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="p-1.5 border border-gray-300 rounded-md text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className="p-1.5 border border-gray-300 rounded-md text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
