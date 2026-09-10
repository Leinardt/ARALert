import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { userService, UserActivityItem } from '../../services/userService';
import type { User } from '../../types';
import {
  Search, Plus, Edit, ShieldAlert, ShieldCheck,
  ChevronLeft, ChevronRight, ArrowUpDown, UserCheck, Users,
  CheckSquare, Square, RefreshCw, History, LogIn, LogOut, Clock, X, Monitor
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const UserList: React.FC = () => {
  const { user: currentUser } = useAuth();
  const location = useLocation();
  const isTutorsPath = location.pathname.includes('/tutors');
  const [users, setUsers] = useState<User[]>([]);
  const [tutors, setTutors] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter, Search, Sort & Pagination States
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedTutorFilter, setAssignedTutorFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [ordering, setOrdering] = useState('-date_joined');
  const [page, setPage] = useState(1);

  // Multi-select state for students
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedTargetTutorId, setSelectedTargetTutorId] = useState<string>('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // User Activity History Modal State
  const [activityModalUser, setActivityModalUser] = useState<User | null>(null);
  const [userActivities, setUserActivities] = useState<UserActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    const effectiveRole = isTutorsPath ? 'tutor' : (roleFilter || undefined);
    try {
      const data = await userService.getUsers({
        search: search || undefined,
        role: effectiveRole,
        status: statusFilter || undefined,
        assigned_tutor: assignedTutorFilter || undefined,
        subject: subjectFilter || undefined,
        ordering,
        page,
      });
      setUsers(data.results);
      setTotalCount(data.count);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch user directory.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTutorsList = async () => {
    try {
      const list = await userService.getTutors();
      setTutors(list);
    } catch (err) {
      console.error('Failed to fetch tutors list', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTutorsList();
  }, [roleFilter, statusFilter, assignedTutorFilter, subjectFilter, ordering, page, isTutorsPath]);

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

  const handleSort = (field: string) => {
    if (ordering === field) {
      setOrdering(`-${field}`);
    } else {
      setOrdering(field);
    }
    setPage(1);
  };

  // Multi-select handlers
  const toggleSelectAll = () => {
    const studentUserIds = users.filter(u => u.role === 'student').map(u => u.id);
    if (selectedIds.length === studentUserIds.length && studentUserIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(studentUserIds);
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkAssignSubmit = async () => {
    if (!selectedIds.length) return;
    setIsSubmittingBulk(true);
    try {
      const tutorIdToPass = selectedTargetTutorId === 'tba' ? null : (selectedTargetTutorId || null);
      const res = await userService.bulkAssignTutor(selectedIds, tutorIdToPass);
      alert(res.detail);
      setIsBulkModalOpen(false);
      setSelectedIds([]);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      alert('Failed to perform bulk tutor assignment.');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Activity History Modal
  const openActivityModal = async (targetUser: User) => {
    setActivityModalUser(targetUser);
    setIsLoadingActivities(true);
    try {
      const data = await userService.getUserActivity(targetUser.id);
      setUserActivities(data.activities);
    } catch (err) {
      console.error('Failed to load activity logs', err);
      setUserActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const totalPages = Math.ceil(totalCount / 10);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const isStudentList = (!currentUser?.is_superuser && !isTutorsPath) || roleFilter === 'student';
  const studentUsersOnPage = users.filter(u => u.role === 'student');
  const showTutorColumn = isStudentList || studentUsersOnPage.length > 0;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {currentUser?.is_superuser ? 'User Management System' : isTutorsPath ? 'Tutors Directory' : 'Student Directory'}
          </h2>
          <p className="text-sm text-gray-500">
            {currentUser?.is_superuser
              ? 'Pre-register staff accounts, assign roles, inspect full login/logout timelines, and manage student tutors.'
              : isTutorsPath
                ? 'View and manage tutors, assign academic subjects (Reading, Science, Math), and inspect tutor activity.'
                : 'Enroll student accounts, assign tutors, and inspect student activity timelines.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Users className="w-4 h-4 mr-2" />
              Assign Tutor ({selectedIds.length})
            </button>
          )}

          <Link
            to={currentUser?.is_superuser ? '/superadmin/users/create' : isTutorsPath ? '/admin/tutors/create' : '/admin/students/create'}
            className="inline-flex items-center bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" />
            {currentUser?.is_superuser ? 'Create User Account' : isTutorsPath ? 'Add Tutor' : 'Enroll Student'}
          </Link>
        </div>
      </div>

      {/* Query Bar */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search Student Name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
          <button
            type="submit"
            className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-xs"
          >
            Search
          </button>
        </form>

        {/* Role Filters for SuperAdmin */}
        {currentUser?.is_superuser && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            {[
              { id: '', label: 'All Roles' },
              { id: 'admin', label: 'School Admin' },
              { id: 'principal', label: 'Principal' },
              { id: 'tutor', label: 'Tutor' },
              { id: 'faculty', label: 'Faculty' },
              { id: 'student', label: 'Student' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setRoleFilter(tab.id); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  roleFilter === tab.id
                    ? 'bg-[var(--brand-light)] text-[var(--brand-text)] border border-[var(--brand)]'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Secondary Filter Dropdowns */}
        <div className="flex flex-wrap gap-4 items-center">
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

          {isStudentList && (
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Tutor Assignment:</label>
              <select
                value={assignedTutorFilter}
                onChange={(e) => { setAssignedTutorFilter(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-[var(--brand)] focus:border-[var(--brand)] bg-white"
              >
                <option value="">All Students</option>
                <option value="none">TBA (Unassigned)</option>
                {tutors.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name || `${t.first_name} ${t.last_name}`}</option>
                ))}
              </select>
            </div>
          )}

          {(isTutorsPath || roleFilter === 'tutor' || (currentUser?.is_superuser && roleFilter === '')) && (
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Subject:</label>
              <select
                value={subjectFilter}
                onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-[var(--brand)] focus:border-[var(--brand)] bg-white"
              >
                <option value="">All Subjects</option>
                <option value="Reading">Reading</option>
                <option value="Science">Science</option>
                <option value="Math">Math</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--brand)]" />
            <span>Loading user directory...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 bg-red-50">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No users found matching your query criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase font-semibold text-xs border-b border-gray-200">
                <tr>
                  {studentUsersOnPage.length > 0 && (
                    <th className="py-3 px-4 w-10">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-gray-500 hover:text-gray-800"
                        title="Select All Students"
                      >
                        {selectedIds.length === studentUsersOnPage.length && studentUsersOnPage.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort('first_name')}>
                    <div className="flex items-center">Full Name <ArrowUpDown className="w-3.5 h-3.5 ml-1" /></div>
                  </th>
                  <th className="py-3 px-4">Email / Details</th>
                  <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort('role')}>
                    <div className="flex items-center">Role <ArrowUpDown className="w-3.5 h-3.5 ml-1" /></div>
                  </th>
                  {showTutorColumn && <th className="py-3 px-4">Assigned Tutor</th>}
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Login Activity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((u) => {
                  const isSelected = selectedIds.includes(u.id);
                  const isStudentRow = u.role === 'student';

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                    >
                      {studentUsersOnPage.length > 0 && (
                        <td className="py-3 px-4">
                          {isStudentRow ? (
                            <button
                              type="button"
                              onClick={() => toggleSelectRow(u.id)}
                              className="text-gray-500 hover:text-gray-800"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          ) : null}
                        </td>
                      )}

                      <td className="py-3 px-4 font-medium text-gray-900">
                        <div>{u.full_name || `${u.first_name} ${u.last_name}`}</div>
                        {u.lrn && <div className="text-xs text-gray-400 font-normal">LRN: {u.lrn}</div>}
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-gray-900">{u.email}</div>
                        {u.aral_level && <div className="text-xs text-[var(--brand)] font-medium">ARAL: {u.aral_level.toUpperCase()}</div>}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'principal' ? 'bg-blue-100 text-blue-800' :
                            u.role === 'faculty' ? 'bg-violet-100 text-violet-800' :
                            u.role === 'tutor' ? 'bg-indigo-100 text-indigo-800' :
                            u.role === 'student' ? 'bg-sky-100 text-sky-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {u.role ? u.role.toUpperCase() : 'SUPERADMIN'}
                          </span>
                          {u.role === 'tutor' && u.subject && (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              u.subject === 'Reading' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              u.subject === 'Science' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              'bg-cyan-50 text-cyan-700 border-cyan-200'
                            }`}>
                              {u.subject}
                            </span>
                          )}
                        </div>
                      </td>

                      {showTutorColumn && (
                        <td className="py-3 px-4">
                          {u.role === 'student' ? (
                            u.assigned_tutor_name && u.assigned_tutor_name !== 'TBA' ? (
                              <span className="font-medium text-gray-800">{u.assigned_tutor_name}</span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                TBA
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      )}

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Interactive Login Activity Cell */}
                      <td className="py-3 px-4 text-xs">
                        <button
                          type="button"
                          onClick={() => openActivityModal(u)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/60 transition-all text-left group cursor-pointer"
                          title="Click to view full login and logout timeline"
                        >
                          {u.has_logged_in ? (
                            <span className="flex items-center gap-1 text-emerald-700 font-medium">
                              <UserCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                              <span>Active ({formatDateTime(u.last_login)})</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 font-normal">Not signed in yet</span>
                          )}
                          <History className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600 shrink-0 ml-1" />
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right space-x-2">
                        <Link
                          to={currentUser?.is_superuser ? `/superadmin/users/edit/${u.id}` : isTutorsPath ? `/admin/tutors/edit/${u.id}` : `/admin/students/edit/${u.id}`}
                          className="text-gray-600 hover:text-gray-900 inline-block p-1"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => toggleUserStatus(u.id, u.is_active)}
                          className={`${u.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'} inline-block p-1 cursor-pointer`}
                          title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                        >
                          {u.is_active ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Showing page {page} of {totalPages} ({totalCount} total entries)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 bg-white border border-gray-300 rounded text-xs disabled:opacity-50 flex items-center cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 bg-white border border-gray-300 rounded text-xs disabled:opacity-50 flex items-center cursor-pointer"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Assign Tutor Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              Bulk Assign Tutor to {selectedIds.length} Student(s)
            </h3>
            <p className="text-sm text-gray-500">
              Select an active tutor to assign to the selected students, or choose TBA to clear their current tutor assignment.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">
                Select Tutor:
              </label>
              <select
                value={selectedTargetTutorId}
                onChange={(e) => setSelectedTargetTutorId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              >
                <option value="tba">-- TBA (Unassign Tutor) --</option>
                {tutors.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name || `${t.first_name} ${t.last_name}`} ({t.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingBulk}
                onClick={handleBulkAssignSubmit}
                className="px-5 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingBulk ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Login & Logout History Timeline Modal */}
      {activityModalUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[var(--brand)]" />
                  <h3 className="text-lg font-bold text-gray-900">
                    Login & Logout History
                  </h3>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  User: <span className="font-semibold text-gray-900">{activityModalUser.full_name || `${activityModalUser.first_name} ${activityModalUser.last_name}`}</span> ({activityModalUser.email})
                </p>
              </div>
              <button
                onClick={() => setActivityModalUser(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Timeline content body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {isLoadingActivities ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-[var(--brand)]" />
                  <span>Loading login activity history...</span>
                </div>
              ) : userActivities.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                  <Clock className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="font-medium text-gray-700">No login or logout activity recorded yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Activity logs will appear here after the user logs in for the first time.</p>
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-gray-200 space-y-6">
                  {userActivities.map((act) => {
                    const isLogin = act.event_type === 'LOGIN';
                    const isLogout = act.event_type === 'LOGOUT';

                    return (
                      <div key={act.id} className="relative group">
                        {/* Dot badge */}
                        <div className={`absolute -left-[31px] top-0.5 p-1 rounded-full border-2 bg-white ${
                          isLogin ? 'border-emerald-500 text-emerald-600' :
                          isLogout ? 'border-rose-500 text-rose-600' :
                          'border-gray-400 text-gray-600'
                        }`}>
                          {isLogin ? <LogIn className="w-3.5 h-3.5" /> : isLogout ? <LogOut className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        </div>

                        {/* Event Content */}
                        <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-1 hover:bg-gray-100/70 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              isLogin ? 'bg-emerald-100 text-emerald-800' :
                              isLogout ? 'bg-rose-100 text-rose-800' :
                              'bg-gray-200 text-gray-800'
                            }`}>
                              {isLogin ? 'LOGGED IN' : isLogout ? 'LOGGED OUT' : act.action}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                              {act.formatted_time}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
                            <span className="flex items-center gap-1">
                              <Monitor className="w-3.5 h-3.5 text-gray-400" />
                              IP: <span className="font-mono text-gray-700">{act.ip_address}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setActivityModalUser(null)}
                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-semibold cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
