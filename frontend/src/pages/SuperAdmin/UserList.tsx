import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { userService, UserActivityItem } from '../../services/userService';
import type { User } from '../../types';
import {
  Search, Plus, Edit, ShieldAlert, ShieldCheck,
  ChevronLeft, ChevronRight, ArrowUpDown, UserCheck, Users,
  CheckSquare, Square, RefreshCw, History, LogIn, LogOut, Clock, X, Monitor,
  ChevronUp, ChevronDown, User as UserIcon, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { TablePagination } from '../../components/TablePagination';

/* ─── ARAL Badge Helper ────────────────────────────────────────────── */
const getAralBadge = (level?: string | null) => {
  if (!level) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 dark:bg-[#1A1A1A] dark:text-slate-300 dark:border-[#262626]">
        Basic
      </span>
    );
  }
  const parts = level.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p) => {
        const isPlus = p === 'plus';
        const isGrad = p === 'graduated';
        return (
          <span
            key={p}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              isPlus
                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60'
                : isGrad
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#1A1A1A] dark:text-slate-300 dark:border-[#262626]'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </span>
        );
      })}
    </div>
  );
};

/* ─── Subject Badge Helper ─────────────────────────────────────────── */
const getSubjectBadge = (subject?: string | null) => {
  if (!subject) return <span className="text-gray-400 dark:text-slate-500">—</span>;
  const parts = subject.split(',').map((s) => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((item) => {
        const s = item.toLowerCase();
        const displayLabel = s === 'reading' ? 'Filipino' : item;
        let badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60';
        if (s.includes('reading') || s.includes('filipino') || s.includes('english')) {
          badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60';
        } else if (s.includes('science')) {
          badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60';
        } else if (s.includes('math')) {
          badgeColor = 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60';
        }
        return (
          <span key={item} className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeColor}`}>
            {displayLabel}
          </span>
        );
      })}
    </div>
  );
};

type AccountTab = 'student' | 'tutor' | 'faculty' | 'principal' | 'admin' | 'superadmin';

export const UserList: React.FC = () => {
  const { user: currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isSuperUser = Boolean(currentUser?.is_superuser);

  // Determine active tab from URL pathname
  const initialTab = useMemo<AccountTab>(() => {
    if (location.pathname.includes('/superadmins') && isSuperUser) return 'superadmin';
    if (location.pathname.includes('/admins') && isSuperUser) return 'admin';
    if (location.pathname.includes('/principals')) return 'principal';
    if (location.pathname.includes('/faculty')) return 'faculty';
    if (location.pathname.includes('/tutors')) return 'tutor';
    return 'student';
  }, [location.pathname, isSuperUser]);

  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  const [users, setUsers] = useState<User[]>([]);
  const [tutors, setTutors] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter, Search, Sort & Pagination States
  const [search, setSearch] = useState('');
  const [assignedTutorFilter, setAssignedTutorFilter] = useState('');
  const [aralLevelFilter, setAralLevelFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [ordering, setOrdering] = useState('last_name');
  const [page, setPage] = useState(1);

  // Multi-select state for students (Bulk assign)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedTargetTutorId, setSelectedTargetTutorId] = useState<string>('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // User Activity History Modal State
  const [activityModalUser, setActivityModalUser] = useState<User | null>(null);
  const [userActivities, setUserActivities] = useState<UserActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  // Floating Toast Notification
  const [toastNotification, setToastNotification] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  useEffect(() => {
    if (!toastNotification.show) return;
    const timer = setTimeout(() => {
      setToastNotification((prev) => ({ ...prev, show: false }));
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastNotification.show]);

  // Sync tab with pathname on URL change
  useEffect(() => {
    if (location.pathname.includes('/superadmins')) {
      if (isSuperUser && activeTab !== 'superadmin') {
        setActiveTab('superadmin');
      } else if (!isSuperUser) {
        navigate('/admin/students', { replace: true });
      }
    } else if (location.pathname.includes('/admins')) {
      if (isSuperUser && activeTab !== 'admin') {
        setActiveTab('admin');
      } else if (!isSuperUser) {
        navigate('/admin/students', { replace: true });
      }
    } else if (location.pathname.includes('/principals') && activeTab !== 'principal') {
      setActiveTab('principal');
    } else if (location.pathname.includes('/faculty') && activeTab !== 'faculty') {
      setActiveTab('faculty');
    } else if (location.pathname.includes('/tutors') && activeTab !== 'tutor') {
      setActiveTab('tutor');
    } else if (location.pathname.includes('/students') && activeTab !== 'student') {
      setActiveTab('student');
    }
  }, [location.pathname, isSuperUser, activeTab, navigate]);

  const handleTabChange = (newTab: AccountTab) => {
    if (!isSuperUser && (newTab === 'admin' || newTab === 'superadmin')) return;
    setActiveTab(newTab);
    setPage(1);
    setSearch('');
    setAssignedTutorFilter('');
    setAralLevelFilter('');
    setSubjectFilter('');
    setSelectedIds([]);

    if (location.pathname.startsWith('/admin/')) {
      const targetPath =
        newTab === 'student' ? '/admin/students' :
        newTab === 'tutor' ? '/admin/tutors' :
        newTab === 'principal' ? '/admin/principals' :
        '/admin/faculty';
      navigate(targetPath, { replace: true });
    } else if (location.pathname.startsWith('/superadmin/')) {
      const targetPath =
        newTab === 'student' ? '/superadmin/students' :
        newTab === 'tutor' ? '/superadmin/tutors' :
        newTab === 'principal' ? '/superadmin/principals' :
        newTab === 'admin' ? '/superadmin/admins' :
        newTab === 'superadmin' ? '/superadmin/superadmins' :
        '/superadmin/faculty';
      navigate(targetPath, { replace: true });
    }
  };

  const availableTabs = useMemo<[AccountTab, string][]>(() => {
    const tabs: [AccountTab, string][] = [
      ['student', 'STUDENTS'],
      ['tutor', 'TUTORS'],
      ['faculty', 'FACULTY'],
      ['principal', 'PRINCIPALS'],
    ];
    if (isSuperUser) {
      tabs.push(['admin', 'ADMINS']);
      tabs.push(['superadmin', 'SUPER ADMINS']);
    }
    return tabs;
  }, [isSuperUser]);

  const fetchRequestId = useRef(0);

  const fetchUsers = async () => {
    const currentRequestId = ++fetchRequestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers({
        search: search || undefined,
        role: activeTab,
        assigned_tutor: activeTab === 'student' ? (assignedTutorFilter || undefined) : undefined,
        aral_level: activeTab === 'student' ? (aralLevelFilter || undefined) : undefined,
        subject: activeTab === 'tutor' ? (subjectFilter || undefined) : undefined,
        ordering,
        page,
      });
      if (currentRequestId === fetchRequestId.current) {
        setUsers(data.results);
        setTotalCount(data.count);
        setSelectedIds([]);
      }
    } catch (err) {
      if (currentRequestId === fetchRequestId.current) {
        console.error(err);
        setError('Failed to fetch user directory.');
      }
    } finally {
      if (currentRequestId === fetchRequestId.current) {
        setIsLoading(false);
      }
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
  }, [activeTab, assignedTutorFilter, aralLevelFilter, subjectFilter, ordering, page, search]);

  useEffect(() => {
    fetchTutorsList();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

const ROOT_SUPERADMIN_EMAIL = 'ro2023-4992-68567@bicol-u.edu.ph';

  const toggleUserStatus = async (id: string, currentlyActive: boolean) => {
    const targetUser = users.find((u) => u.id === id);
    if (targetUser?.email?.trim().toLowerCase() === ROOT_SUPERADMIN_EMAIL.toLowerCase()) {
      setToastNotification({
        show: true,
        type: 'error',
        title: 'Action Protected',
        message: `The Primary Root SuperAdmin account (${ROOT_SUPERADMIN_EMAIL}) is protected and cannot be deactivated.`,
      });
      return;
    }
    try {
      if (currentlyActive) {
        await userService.deactivateUser(id);
      } else {
        await userService.activateUser(id);
      }
      fetchUsers();
      setToastNotification({
        show: true,
        type: 'success',
        title: 'Status Updated',
        message: `User account successfully ${currentlyActive ? 'deactivated' : 'activated'}.`,
      });
    } catch (err: any) {
      console.error(err);
      const detailMsg = err?.response?.data?.detail || 'Failed to update user account status.';
      setToastNotification({
        show: true,
        type: 'error',
        title: 'Update Failed',
        message: detailMsg,
      });
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

  // Multi-select handlers for students
  const toggleSelectAll = () => {
    const studentUserIds = users.filter((u) => u.role === 'student').map((u) => u.id);
    if (selectedIds.length === studentUserIds.length && studentUserIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(studentUserIds);
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
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
      setIsBulkModalOpen(false);
      setSelectedIds([]);
      fetchUsers();
      setToastNotification({
        show: true,
        type: 'success',
        title: 'Tutor Assigned Successfully',
        message: res.detail || `Successfully assigned ${selectedIds.length} student(s).`,
      });
    } catch (err: any) {
      console.error(err);
      const detailMsg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to perform bulk tutor assignment.';
      setToastNotification({
        show: true,
        type: 'error',
        title: 'Assignment Failed',
        message: detailMsg,
      });
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

  const totalPages = Math.ceil(totalCount / 30);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const SortableHeader: React.FC<{ label: string; field: string; align?: 'left' | 'center' | 'right' }> = ({
    label,
    field,
    align = 'left',
  }) => {
    const isActive = ordering === field || ordering === `-${field}`;
    const isAscending = ordering === field;

    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-1.5 text-${align} transition-colors hover:text-gray-700 dark:hover:text-slate-200 select-none text-[11px] font-bold uppercase tracking-wider ${
          isActive ? 'text-gray-700 dark:text-slate-200' : 'text-gray-400 dark:text-slate-400'
        } cursor-pointer`}
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        {isActive ? (
          isAscending ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
        )}
      </button>
    );
  };

  const getCreateLink = () => {
    if (currentUser?.is_superuser) {
      return `/superadmin/users/create?role=${activeTab}`;
    }
    if (activeTab === 'student') return '/admin/students/create?role=student';
    if (activeTab === 'tutor') return '/admin/tutors/create?role=tutor';
    if (activeTab === 'principal') return '/admin/principals/create?role=principal';
    return '/admin/faculty/create?role=faculty';
  };

  const getCreateLabel = () => {
    if (activeTab === 'student') return 'Enroll Student';
    if (activeTab === 'tutor') return 'Add Tutor';
    if (activeTab === 'principal') return 'Add Principal';
    if (activeTab === 'admin') return 'Add Admin';
    if (activeTab === 'superadmin') return 'Add Super Admin';
    return 'Add Faculty';
  };

  const getSearchPlaceholder = () => {
    if (activeTab === 'student') return 'Search Student Name, LRN...';
    if (activeTab === 'tutor') return 'Search Tutor Name, Email...';
    if (activeTab === 'principal') return 'Search Principal Name, Email...';
    if (activeTab === 'admin') return 'Search Admin Name, Email...';
    if (activeTab === 'superadmin') return 'Search Super Admin Name, Email...';
    return 'Search Faculty Name, Email...';
  };

  const getGradeAndSection = (gradeLevel?: string | null, fallbackSection?: string | null) => {
    if (!gradeLevel) return { grade: '8', section: fallbackSection || 'Mango' };
    if (gradeLevel.includes(' - ')) {
      const parts = gradeLevel.split(' - ');
      const g = parts[0].trim().replace(/grade\s*/i, '');
      const s = parts.slice(1).join(' - ').trim();
      return { grade: g || '8', section: s || fallbackSection || 'Mango' };
    }
    return {
      grade: gradeLevel.replace(/grade\s*/i, '').trim() || '8',
      section: fallbackSection || 'Mango',
    };
  };

  const getTutorDisplayCohorts = (gradeLevel?: string | null, section?: string | null) => {
    if (!gradeLevel) return { grade: 'Grade 7', section: section || '—' };
    const gradeMatches = Array.from(new Set(Array.from(gradeLevel.matchAll(/GRADE\s*(\d+)/gi)).map((m) => `Grade ${m[1]}`)));
    const grade = gradeMatches.length > 0 ? gradeMatches.join(', ') : gradeLevel;
    const sec = section || '—';
    return { grade, section: sec };
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── Top Navigation Tabs (Pill Switcher) ────────────────────────── */}
      <div
        className="flex w-full rounded-md bg-gray-100 p-1 gap-1 dark:bg-[#111111] overflow-x-auto no-scrollbar"
        role="tablist"
        aria-label="User account management tabs"
      >
        {availableTabs.map(([tabRole, label]) => (
          <button
            key={tabRole}
            type="button"
            role="tab"
            aria-selected={activeTab === tabRole}
            onClick={() => handleTabChange(tabRole)}
            className={`flex-1 min-w-[70px] h-9 rounded-sm px-2.5 sm:px-4 flex items-center justify-center text-[11px] sm:text-xs font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${activeTab === tabRole
              ? 'bg-[var(--brand)] text-white'
              : 'text-gray-400 opacity-60 hover:bg-white/60 hover:text-gray-600 hover:opacity-100 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300'
              }`}
          >
            {label}
          </button>
        ))}
      </div>


      {/* ── Main Integrated Directory Table Card ──────────────────────── */}
      <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] relative overflow-hidden">
        {/* Table Toolbar (Section Title + Action Buttons & Filters) */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
          {/* Left: Title & Counter */}
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base uppercase tracking-wide">
              {activeTab === 'student'
                ? 'STUDENTS DIRECTORY'
                : activeTab === 'tutor'
                  ? 'TUTORS DIRECTORY'
                  : activeTab === 'faculty'
                    ? 'FACULTY DIRECTORY'
                    : activeTab === 'principal'
                      ? 'PRINCIPALS DIRECTORY'
                      : activeTab === 'admin'
                        ? 'ADMINS DIRECTORY'
                        : activeTab === 'superadmin'
                          ? 'SUPER ADMINS DIRECTORY'
                          : 'USER DIRECTORY'}
            </h3>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">
              {totalCount} Registered Account{totalCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Right: Actions & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full xl:w-auto">
            {/* Tutor Assignment Filter (Student Tab) */}
            {activeTab === 'student' && (
              <div className="relative inline-flex items-center">
                <select
                  value={assignedTutorFilter}
                  onChange={(e) => {
                    setAssignedTutorFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by Assigned Tutor"
                  className="h-9 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#111111] px-3 text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none transition focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#0A0A0A] cursor-pointer"
                >
                  <option value="">ALL TUTORS</option>
                  <option value="none">TBA (Unassigned)</option>
                  {tutors.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name || `${t.first_name} ${t.last_name}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ARAL Level Filter (Student Tab) */}
            {activeTab === 'student' && (
              <div className="relative inline-flex items-center">
                <select
                  value={aralLevelFilter}
                  onChange={(e) => {
                    setAralLevelFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by ARAL Level"
                  className="h-9 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#111111] px-3 text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none transition focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#0A0A0A] cursor-pointer"
                >
                  <option value="">All ARAL Levels</option>
                  <option value="basic">Basic</option>
                  <option value="plus">Plus</option>
                  <option value="graduated">Graduated</option>
                </select>
              </div>
            )}

            {/* Subject Filter (Tutor Tab) */}
            {activeTab === 'tutor' && (
              <div className="relative inline-flex items-center">
                <select
                  value={subjectFilter}
                  onChange={(e) => {
                    setSubjectFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by Subject"
                  className="h-9 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#111111] px-3 text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none transition focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#0A0A0A] cursor-pointer"
                >
                  <option value="">All Subjects</option>
                  <option value="Filipino">Filipino</option>
                  <option value="English">English</option>
                  <option value="Science">Science</option>
                  <option value="Math">Math</option>
                </select>
              </div>
            )}

            {/* Search Input Bar */}
            <form onSubmit={handleSearchSubmit} className="relative flex w-full sm:w-auto flex-1 sm:flex-initial min-w-0 sm:min-w-56 items-center">
              <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-gray-400" />
              <input
                type="search"
                placeholder={getSearchPlaceholder()}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search users"
                className="h-9 w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#111111] pl-9 pr-3 text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#0A0A0A] focus:ring-2 focus:ring-[var(--brand)]/10"
              />
            </form>

            {/* Dynamic Action Buttons: When students are selected, replace Enroll Student with Assign Student/s to a Tutor */}
            {activeTab === 'student' && selectedIds.length > 0 ? (
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="inline-flex items-center justify-center bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-3.5 py-2 rounded-md text-xs font-bold transition-all cursor-pointer shrink-0 w-full sm:w-auto shadow-2xs"
              >
                <Users className="w-3.5 h-3.5 mr-1.5" />
                Assign Student/s to a Tutor ({selectedIds.length})
              </button>
            ) : (
              <Link
                to={getCreateLink()}
                className="inline-flex items-center justify-center bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-3.5 py-2 rounded-md text-xs font-bold transition-all cursor-pointer shrink-0 w-full sm:w-auto"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                {getCreateLabel()}
              </Link>
            )}
          </div>
        </div>

        {/* ── Table Content ────────────────────────────────────────── */}
        <div className="overflow-x-auto mobile-scroll-table w-full">
          <table className="min-w-[760px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-left text-sm font-normal">
            <thead>
                <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                  {/* Select All Checkbox (Students) */}
                  {activeTab === 'student' && (
                    <th className="w-10 px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                        title="Select All Students"
                      >
                        {selectedIds.length === users.length && users.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-[var(--brand)]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                  )}

                  <th className="w-12 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                    #
                  </th>

                  <th className="px-4 py-2.5 text-left">
                    <SortableHeader
                      label={
                        activeTab === 'student' ? 'STUDENT' :
                        activeTab === 'tutor' ? 'TUTOR' :
                        activeTab === 'principal' ? 'PRINCIPAL' :
                        activeTab === 'admin' ? 'ADMIN' :
                        activeTab === 'superadmin' ? 'SUPER ADMIN' : 'FACULTY'
                      }
                      field="last_name"
                    />
                  </th>

                  {activeTab === 'student' ? (
                    <>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="LRN" field="lrn" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="ARAL LEVEL" field="aral_level" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="ASSIGNED TUTOR" field="assigned_tutor" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="SUBJECT" field="subject" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="GRADE LEVEL" field="grade_level" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="SECTION" field="section" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="PARENT / GUARDIAN" field="parent_guardian_name" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="CONTACT NO." field="contact_number" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="STATUS" field="status" />
                      </th>
                      <th className="w-20 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                        ACTION
                      </th>
                    </>
                  ) : activeTab === 'tutor' ? (
                    <>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="EMAIL" field="email" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="ARAL SUBJECT" field="subject" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="ARAL LEVEL" field="aral_level" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="GRADE LEVEL" field="grade_level" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="SECTION" field="section" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="STATUS" field="status" />
                      </th>
                      <th className="w-20 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                        ACTION
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="EMAIL" field="email" />
                      </th>
                      <th className="px-4 py-2.5 text-left">
                        <SortableHeader label="STATUS" field="status" />
                      </th>
                      <th className="w-20 px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                        ACTION
                      </th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse divide-x divide-gray-100 dark:divide-[#1A1A1A]">
                    {activeTab === 'student' && (
                      <td className="w-10 px-3 py-3 text-center">
                        <div className="w-4 h-4 mx-auto rounded bg-gray-200 dark:bg-gray-800" />
                      </td>
                    )}
                    <td className="w-12 px-3 py-3 text-center">
                      <div className="w-4 h-3 mx-auto rounded bg-gray-200 dark:bg-gray-800" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-3.5 w-36 rounded bg-gray-200 dark:bg-gray-800" />
                    </td>
                    {activeTab === 'student' ? (
                      <>
                        <td className="px-4 py-3"><div className="h-3.5 w-24 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-3.5 w-16 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-3.5 w-24 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-3.5 w-16 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-3.5 w-14 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-3.5 w-14 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-3.5 w-24 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-3.5 w-20 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-14 rounded-full bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="w-20 px-4 py-3 text-center"><div className="h-4 w-12 mx-auto rounded bg-gray-200 dark:bg-gray-800" /></td>
                      </>
                    ) : activeTab === 'tutor' ? (
                      <>
                        <td className="px-4 py-3"><div className="h-3.5 w-36 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-3.5 w-16 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-3.5 w-16 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-3.5 w-14 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-3.5 w-14 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-14 rounded-full bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="w-20 px-4 py-3 text-center"><div className="h-4 w-12 mx-auto rounded bg-gray-200 dark:bg-gray-800" /></td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3"><div className="h-3.5 w-44 rounded bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-14 rounded-full bg-gray-200 dark:bg-gray-800" /></td>
                        <td className="w-20 px-4 py-3 text-center"><div className="h-4 w-12 mx-auto rounded bg-gray-200 dark:bg-gray-800" /></td>
                      </>
                    )}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td
                    colSpan={activeTab === 'student' ? 13 : activeTab === 'tutor' ? 9 : 5}
                    className="p-10 text-center text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20"
                  >
                    <p className="text-sm font-semibold">{error}</p>
                    <button
                      type="button"
                      onClick={fetchUsers}
                      className="mt-3 px-4 py-1.5 bg-[var(--brand)] text-white rounded-md text-xs font-bold cursor-pointer hover:bg-[var(--brand-dark)] transition"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeTab === 'student' ? 13 : activeTab === 'tutor' ? 9 : 5}
                      className="py-16 text-center text-gray-400 dark:text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="w-10 h-10 text-gray-300 dark:text-gray-700 stroke-[1.5]" />
                        <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">
                          No {activeTab} accounts found
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 max-w-sm">
                          Try adjusting your search query, filters, or enroll a new account.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((u, index) => {
                    const isSelected = selectedIds.includes(u.id);
                    const isStudentRow = u.role === 'student';

                    return (
                      <tr
                        key={u.id}
                        className={`group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-white/[0.02] ${isSelected ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                          }`}
                      >
                        {/* Selection checkbox */}
                        {activeTab === 'student' && (
                          <td className="px-3 py-3 text-center">
                            {isStudentRow && (
                              <button
                                type="button"
                                onClick={() => toggleSelectRow(u.id)}
                                className="text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-[var(--brand)]" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </td>
                        )}

                        {/* Row number */}
                        <td className="px-3 py-3 text-center text-xs font-normal text-gray-400 dark:text-slate-500 whitespace-nowrap">
                          {(page - 1) * 10 + index + 1}
                        </td>

                        {/* Full Name */}
                        <td className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-100">
                          <div className="min-w-0">
                            <span className="truncate block font-semibold text-gray-900 dark:text-slate-100">
                              {u.full_name || `${u.first_name} ${u.last_name}`}
                            </span>
                          </div>
                        </td>

                        {/* Student Columns */}
                        {activeTab === 'student' && (
                          <>
                            <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs font-mono">
                              {u.lrn || 'N/A'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {getAralBadge(u.aral_level)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                              {u.assigned_tutor_name && u.assigned_tutor_name !== 'TBA' ? (
                                <span className="font-semibold text-gray-800 dark:text-slate-200">
                                  {u.assigned_tutor_name}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-slate-500 font-medium text-xs">
                                  - TBA -
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {getSubjectBadge(u.subject)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 dark:text-slate-300 font-medium">
                              {getGradeAndSection(u.grade_level).grade}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 dark:text-slate-300 font-medium uppercase">
                              {getGradeAndSection(u.grade_level, u.section).section}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 dark:text-slate-300 font-medium uppercase">
                              {u.parent_guardian_name || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 dark:text-slate-300 font-mono">
                              {u.contact_number || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${u.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/60'
                                }`}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap space-x-1.5">
                              <Link
                                to={
                                  currentUser?.is_superuser
                                    ? `/superadmin/users/edit/${u.id}`
                                    : `/admin/students/edit/${u.id}`
                                }
                                className="inline-flex items-center justify-center text-gray-400 hover:text-[var(--brand)] transition-colors p-1 cursor-pointer"
                                title="Edit User"
                                aria-label={`Edit ${u.full_name || u.first_name}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => toggleUserStatus(u.id, u.is_active)}
                                className={`inline-flex items-center justify-center p-1 cursor-pointer transition-colors ${u.is_active
                                  ? 'text-gray-400 hover:text-red-600'
                                  : 'text-gray-400 hover:text-emerald-600'
                                  }`}
                                title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                                aria-label={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                              >
                                {u.is_active ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                              </button>
                            </td>
                          </>
                        )}

                        {/* Tutor Columns */}
                        {activeTab === 'tutor' && (
                          <>
                            <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs font-medium">
                              {u.email}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {getSubjectBadge(u.subject)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {getAralBadge(u.aral_level)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 dark:text-slate-300 font-medium">
                              {getTutorDisplayCohorts(u.grade_level, u.section).grade}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 dark:text-slate-300 font-medium uppercase">
                              {getTutorDisplayCohorts(u.grade_level, u.section).section}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${u.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/60'
                                }`}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap space-x-1.5">
                              <Link
                                to={
                                  currentUser?.is_superuser
                                    ? `/superadmin/users/edit/${u.id}`
                                    : `/admin/tutors/edit/${u.id}`
                                }
                                className="inline-flex items-center justify-center text-gray-400 hover:text-[var(--brand)] transition-colors p-1 cursor-pointer"
                                title="Edit User"
                                aria-label={`Edit ${u.full_name || u.first_name}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => toggleUserStatus(u.id, u.is_active)}
                                className={`inline-flex items-center justify-center p-1 cursor-pointer transition-colors ${u.is_active
                                  ? 'text-gray-400 hover:text-red-600'
                                  : 'text-gray-400 hover:text-emerald-600'
                                  }`}
                                title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                                aria-label={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                              >
                                {u.is_active ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                              </button>
                            </td>
                          </>
                        )}

                        {/* Faculty, Principal, Admin & SuperAdmin Columns */}
                        {(activeTab === 'faculty' || activeTab === 'principal' || activeTab === 'admin' || activeTab === 'superadmin') && (
                          <>
                            <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs font-medium">
                              {u.email}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                }`}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap space-x-1.5">
                              <Link
                                to={
                                  currentUser?.is_superuser
                                    ? `/superadmin/users/edit/${u.id}`
                                    : activeTab === 'admin'
                                    ? `/admin/admins/edit/${u.id}`
                                    : activeTab === 'principal'
                                    ? `/admin/principals/edit/${u.id}`
                                    : `/admin/faculty/edit/${u.id}`
                                }
                                className="inline-flex items-center justify-center text-gray-400 hover:text-[var(--brand)] transition-colors p-1 cursor-pointer"
                                title="Edit User"
                                aria-label={`Edit ${u.full_name || u.first_name}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              {u.email?.trim().toLowerCase() === ROOT_SUPERADMIN_EMAIL.toLowerCase() ? (
                                <span
                                  className="inline-flex items-center justify-center p-1 text-emerald-600 dark:text-emerald-400 cursor-not-allowed opacity-90"
                                  title={`Primary Root SuperAdmin (${ROOT_SUPERADMIN_EMAIL}) - Immune from deactivation`}
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleUserStatus(u.id, u.is_active)}
                                  className={`inline-flex items-center justify-center p-1 cursor-pointer transition-colors ${u.is_active
                                    ? 'text-gray-400 hover:text-red-600'
                                    : 'text-gray-400 hover:text-emerald-600'
                                    }`}
                                  title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                                  aria-label={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                                >
                                  {u.is_active ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                </button>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        {/* ── Pagination Footer ───────────────────────────────────────── */}
        <TablePagination
          currentPage={page}
          totalItems={totalCount}
          pageSize={30}
          onPageChange={setPage}
          itemLabel="users"
        />
      </div>

      {/* ── Bulk Assign Tutor Modal ───────────────────────────────────── */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0A0A0A] rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-200 dark:border-[#1A1A1A] space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
              Bulk Assign Tutor to {selectedIds.length} Student(s)
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Select an active tutor to assign to the selected students, or choose TBA to clear their tutor assignment.
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-2">
                Select Tutor:
              </label>
              <select
                value={selectedTargetTutorId}
                onChange={(e) => setSelectedTargetTutorId(e.target.value)}
                className="w-full border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#111111] text-gray-800 dark:text-slate-100 rounded-md p-2.5 text-xs font-medium focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              >
                <option value="tba">-- TBA (Unassign Tutor) --</option>
                {tutors.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name || `${t.first_name} ${t.last_name}`} ({t.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-[#1A1A1A]">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingBulk}
                onClick={handleBulkAssignSubmit}
                className="px-5 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-md text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isSubmittingBulk ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── User Login & Logout History Timeline Modal ────────────────── */}
      {activityModalUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0A0A0A] rounded-lg p-6 max-w-xl w-full shadow-xl border border-gray-200 dark:border-[#1A1A1A] space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-[#1A1A1A] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[var(--brand)]" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                    Login & Logout History
                  </h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  User: <span className="font-semibold text-gray-900 dark:text-slate-100">{activityModalUser.full_name || `${activityModalUser.first_name} ${activityModalUser.last_name}`}</span> ({activityModalUser.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivityModalUser(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-md hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Timeline content body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {isLoadingActivities ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-[var(--brand)]" />
                  <span className="text-xs">Loading login activity history...</span>
                </div>
              ) : userActivities.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A]">
                  <Clock className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="font-semibold text-gray-700 dark:text-slate-300 text-sm">No login or logout activity recorded yet.</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Activity logs will appear here after the user logs in for the first time.</p>
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-gray-200 dark:border-[#1A1A1A] space-y-6">
                  {userActivities.map((act) => {
                    const isLogin = act.event_type === 'LOGIN';
                    const isLogout = act.event_type === 'LOGOUT';

                    return (
                      <div key={act.id} className="relative group">
                        {/* Dot badge */}
                        <div className={`absolute -left-[31px] top-0.5 p-1 rounded-full border-2 bg-white dark:bg-[#0A0A0A] ${isLogin ? 'border-emerald-500 text-emerald-600' :
                          isLogout ? 'border-rose-500 text-rose-600' :
                            'border-gray-400 text-gray-600'
                          }`}>
                          {isLogin ? <LogIn className="w-3.5 h-3.5" /> : isLogout ? <LogOut className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        </div>

                        {/* Event Content */}
                        <div className="bg-gray-50 dark:bg-[#111111] p-3.5 rounded-md border border-gray-200 dark:border-[#1A1A1A] space-y-1 hover:bg-gray-100/70 dark:hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${isLogin ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                              isLogout ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                                'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                              }`}>
                              {isLogin ? 'LOGGED IN' : isLogout ? 'LOGGED OUT' : act.action}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                              {act.formatted_time}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400 pt-1">
                            <span className="flex items-center gap-1">
                              <Monitor className="w-3.5 h-3.5 text-gray-400" />
                              IP: <span className="font-mono text-gray-700 dark:text-slate-300">{act.ip_address}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-[#1A1A1A] flex justify-end">
              <button
                type="button"
                onClick={() => setActivityModalUser(null)}
                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-md text-xs font-bold cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Notification Toast ─────────────────────── */}
      {toastNotification.show && (
        <aside
          aria-live="polite"
          className="fixed top-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div
            className={`flex items-start gap-3 rounded-lg border p-3.5 shadow-xl bg-white dark:bg-[#111111] ${
              toastNotification.type === 'error'
                ? 'border-rose-200 dark:border-rose-800/60'
                : 'border-emerald-200 dark:border-emerald-800/60'
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                toastNotification.type === 'error'
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
              }`}
            >
              {toastNotification.type === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-gray-900 dark:text-slate-100">
                  {toastNotification.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setToastNotification((prev) => ({ ...prev, show: false }))}
                  className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
                  aria-label="Close notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
                {toastNotification.message}
              </p>
            </div>
          </div>
        </aside>
      )}

    </div>
  );
};
