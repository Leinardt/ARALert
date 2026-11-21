import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import type { User, StudentEditRequest } from '../../types';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import { authService, type LoginHistoryItem } from '../../services/authService';
import { TablePagination } from '../../components/TablePagination';
import { buildTutorClassSections, parseStudentGradeAndSection } from '../../utils/tutorCohortHelpers';
import {
  User as UserIcon,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Edit3,
  X,
  Save,
  Info,
  Clock,
  Send,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const formatHistoryDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const ProfileCalendarDropdown: React.FC<{
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onClear: () => void;
  onClose: () => void;
}> = ({ selectedDate, onSelectDate, onClear, onClose }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const d = new Date(`${selectedDate}T00:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const now = new Date();
  const todayStr = formatHistoryDateKey(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 z-[60] w-[calc(100vw-48px)] max-w-[280px] sm:w-72 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-3.5 shadow-2xl select-none text-slate-800 dark:text-slate-100"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-slate-400 transition cursor-pointer"
          aria-label="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 tracking-wide">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-slate-400 transition cursor-pointer"
          aria-label="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400 py-2 text-[10px] uppercase tracking-wider">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((dayNum, idx) => {
          if (dayNum === null) return <div key={`empty-${idx}`} className="h-7 w-7" />;
          const cellDateKey = formatHistoryDateKey(year, month, dayNum);
          const isSelected = selectedDate === cellDateKey;
          const isToday = todayStr === cellDateKey;
          return (
            <button
              key={cellDateKey}
              type="button"
              onClick={() => {
                onSelectDate(cellDateKey);
                onClose();
              }}
              className={`relative flex flex-col items-center justify-center h-7 w-7 mx-auto rounded-md text-xs font-semibold transition-all cursor-pointer ${isSelected
                ? 'bg-[var(--brand)] text-white font-bold shadow-xs'
                : isToday
                  ? 'border border-[var(--brand)] text-[var(--brand)] font-bold hover:bg-[var(--brand-light)]'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
            >
              <span>{dayNum}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-zinc-800 text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => {
            onSelectDate(todayStr);
            onClose();
          }}
          className="text-[var(--brand)] hover:underline cursor-pointer"
        >
          Today
        </button>
        {selectedDate && (
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="text-slate-400 hover:text-rose-500 transition cursor-pointer"
          >
            Clear Date
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Format ARAL level string (e.g. 'basic' -> 'Basic').
 */
const formatAralLevel = (level: string | null | undefined): string => {
  if (!level) return 'Basic';
  return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
};

/**
 * Format string to Title Case (normal typography with first letter of each word capitalized).
 */
const toTitleCase = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Format user full name for system display:
 * All UPPERCASE as LASTNAME, FIRSTNAME M.I (e.g. "DELA CRUZ, JUAN S.").
 */
const formatSystemDisplayName = (user: User | null): string => {
  if (!user) return '';
  const first = (user.first_name || '').trim().toUpperCase();
  const last = (user.last_name || '').trim().toUpperCase();
  let middleInitial = '';
  if (user.middle_name && user.middle_name.trim()) {
    middleInitial = `${user.middle_name.trim()[0].toUpperCase()}.`;
  }
  const given = [first, middleInitial].filter(Boolean).join(' ');
  if (last && given) {
    return `${last}, ${given}`;
  }
  return (last || given || user.full_name || user.username || '').toUpperCase();
};

const SecurityHelpButton: React.FC<{ label: string; description: string }> = ({ label, description }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-flex items-center gap-1.5 group">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={label}
        className="border-none bg-transparent p-0 text-[11px] font-bold tracking-wider text-[var(--text-muted)] hover:text-slate-900 dark:hover:text-white cursor-pointer uppercase transition-colors"
      >
        {label.toUpperCase()}
      </button>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={label}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border-none bg-transparent text-[var(--text-muted)] hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors"
      >
        <Info size={13} />
      </button>
      <span className={`absolute left-0 bottom-full z-30 mb-2 w-[calc(100vw-64px)] max-w-xs sm:w-72 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-800 dark:text-white shadow-xl ${isOpen ? 'block' : 'hidden group-hover:block group-focus-within:block'}`}>
        {description}
        <span className="absolute left-6 top-full -mt-1 border-4 border-transparent border-t-white dark:border-t-zinc-900" />
      </span>
    </div>
  );
};

export const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [localUser, setLocalUser] = useState<User | null>(user);
  const [resolvedTutorName, setResolvedTutorName] = useState<string | null>(null);

  const [assignedStudents, setAssignedStudents] = useState<User[]>([]);
  const [showSensitiveIdentity, setShowSensitiveIdentity] = useState<boolean>(false);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string>('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'login' | 'logout'>('all');
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('');
  const [showHistoryCalendar, setShowHistoryCalendar] = useState<boolean>(false);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const HISTORY_PAGE_SIZE = 5;

  const loadLoginHistory = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingHistory(true);
    setHistoryError('');
    try {
      const items = await authService.getLoginHistory();
      setLoginHistory(items);
    } catch {
      setHistoryError('Unable to load sign-in activity right now.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadLoginHistory();
  }, [loadLoginHistory]);

  const dateFilteredLoginHistory = useMemo(() => {
    if (!historyDateFilter) return loginHistory;
    return loginHistory.filter((item) => {
      const d = new Date(item.timestamp);
      const localKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return localKey === historyDateFilter;
    });
  }, [loginHistory, historyDateFilter]);

  const filteredLoginHistory = useMemo(() => {
    if (historyFilter === 'all') return dateFilteredLoginHistory;
    return dateFilteredLoginHistory.filter((item) => item.event_type === historyFilter);
  }, [dateFilteredLoginHistory, historyFilter]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredLoginHistory.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(Math.max(1, historyPage), historyTotalPages);

  const visibleLoginHistory = useMemo(() => {
    const start = (safeHistoryPage - 1) * HISTORY_PAGE_SIZE;
    return filteredLoginHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredLoginHistory, safeHistoryPage]);

  useEffect(() => {
    if (localUser?.role === 'tutor' && localUser.id) {
      userService
        .getAllUsers({ role: 'student', assigned_tutor: localUser.id })
        .then((res) => {
          if (Array.isArray(res)) setAssignedStudents(res);
        })
        .catch(() => { });
    } else if (localUser?.role === 'student' && localUser.id) {
      if (localUser.assigned_tutor_name && localUser.assigned_tutor_name !== 'TBA' && localUser.assigned_tutor_name !== 'Unassigned') {
        setResolvedTutorName(localUser.assigned_tutor_name);
      }

      // Fetch fresh academic profile to resolve latest assigned tutor or updated cohort
      academicService
        .getMyProfile()
        .then((prof) => {
          if (prof?.assigned_tutor?.name) {
            setResolvedTutorName(prof.assigned_tutor.name);
          }
          if (prof?.student) {
            setLocalUser((prev) => (prev ? { ...prev, ...prof.student } : prev));
          }
        })
        .catch(() => { });

      // Fallback check in complete student history
      academicService
        .getStudentCompleteHistory(String(localUser.id))
        .then((hist) => {
          if (hist?.current_tutor && hist.current_tutor !== 'Unassigned' && hist.current_tutor !== 'TBA') {
            setResolvedTutorName(hist.current_tutor);
          } else if (hist?.tutor_history && hist.tutor_history.length > 0) {
            const active = hist.tutor_history.find((t: any) => t.is_active || !t.end_date);
            if (active?.tutor_name) {
              setResolvedTutorName(active.tutor_name);
            }
          }
        })
        .catch(() => { });
    }
  }, [localUser?.id, localUser?.role, localUser?.assigned_tutor_name]);

  // Compute tutor assigned classes / role details handled
  const tutorAssignedClasses = useMemo(() => {
    if (localUser?.role !== 'tutor') return [];
    return buildTutorClassSections(localUser, assignedStudents);
  }, [localUser, assignedStudents]);

  // Compute student assigned class (matching Tutor ASSIGNED CLASSES card display)
  const studentAssignedClasses = useMemo(() => {
    if (localUser?.role !== 'student') return [];
    const fallbackTutor =
      resolvedTutorName && resolvedTutorName !== 'TBA' && resolvedTutorName !== 'Unassigned'
        ? resolvedTutorName
        : localUser.assigned_tutor_name &&
          localUser.assigned_tutor_name !== 'TBA' &&
          localUser.assigned_tutor_name !== 'Unassigned'
          ? localUser.assigned_tutor_name
          : 'TBA';

    const rawLevel = (localUser.aral_level || 'basic').split(',')[0].trim().toLowerCase();
    const aralLevelLabel = rawLevel ? rawLevel.toUpperCase() : 'BASIC';
    const isPlus = rawLevel === 'plus';
    const rawSub = (localUser.subject || '').split(',')[0].trim();
    const subjectLabel =
      !rawSub || rawSub.toLowerCase() === 'reading'
        ? isPlus
          ? 'English'
          : 'Filipino'
        : isPlus && rawSub.toLowerCase() === 'filipino'
          ? 'English'
          : rawSub;

    const { grade, section } = parseStudentGradeAndSection(localUser);
    const cohortLabel = grade && section ? `${grade} - ${section}` : grade || section || '—';

    return [
      {
        key: 'student-cls-1',
        aralLevel: aralLevelLabel,
        subject: subjectLabel,
        cohort: cohortLabel.toUpperCase(),
        tutorName: fallbackTutor,
      },
    ];
  }, [localUser, resolvedTutorName]);

  // Staff direct editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editMiddle, setEditMiddle] = useState('');
  const [editLast, setEditLast] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Profile Edit Request States
  const [pendingEditRequest, setPendingEditRequest] = useState<StudentEditRequest | null>(null);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [studentEditError, setStudentEditError] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    lrn: '',
    aral_level: 'basic' as 'basic' | 'plus' | 'summer' | 'graduated',
  });

  const fetchPendingRequest = useCallback(async () => {
    if (!user || user.is_superuser) return;
    try {
      const data = await userService.getStudentEditRequests({
        status: 'pending',
      });
      if (data.results && data.results.length > 0) {
        setPendingEditRequest(data.results[0]);
      } else {
        setPendingEditRequest(null);
      }
    } catch (err) {
      console.error('Failed to check pending profile edit requests', err);
    }
  }, [user]);

  useEffect(() => {
    setLocalUser(user);
    if (user && !user.is_superuser) {
      fetchPendingRequest();
    }
  }, [user, fetchPendingRequest]);

  // Edit handler: SuperAdmin edits directly; all other roles open the Profile Edit Request modal
  const handleEditOpen = () => {
    if (!localUser) return;
    if (localUser.is_superuser) {
      setEditFirst(toTitleCase(localUser.first_name));
      setEditMiddle(toTitleCase(localUser.middle_name));
      setEditLast(toTitleCase(localUser.last_name));
      setMessage(null);
      setError(null);
      setIsEditing(true);
      return;
    }

    if (pendingEditRequest) {
      setShowPendingModal(true);
      return;
    }
    setStudentForm({
      first_name: localUser.first_name || '',
      middle_name: localUser.middle_name || '',
      last_name: localUser.last_name || '',
      lrn: localUser.lrn || '',
      aral_level: (localUser.aral_level as any) || 'basic',
    });
    setStudentEditError(null);
    setIsEditingStudent(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  // Direct profile update (SuperAdmin only)
  const handleSave = async () => {
    if (!localUser) return;
    if (!editFirst.trim()) {
      setError('First name cannot be blank.');
      return;
    }
    if (!editLast.trim()) {
      setError('Last name cannot be blank.');
      return;
    }
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('first_name', editFirst.trim());
      formData.append('middle_name', editMiddle.trim());
      formData.append('last_name', editLast.trim());
      const updated = await updateProfile(formData);
      setLocalUser(updated);
      setMessage('Profile updated successfully.');
      setIsEditing(false);
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.first_name?.[0] ||
        err?.response?.data?.last_name?.[0] ||
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Unable to save profile.');
      setError(serverMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit profile edit request (School Admin, Tutor, Faculty, Principal, Student)
  const handleStudentFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStudentEditError(null);
    setShowConfirmModal(true);
  };

  // Confirm and create profile edit request
  const handleConfirmSubmitRequest = async () => {
    if (!localUser) return;
    setIsSavingStudent(true);
    setStudentEditError(null);

    const isStudentRole = localUser.role === 'student';
    const isSchoolAdmin = localUser.role === 'admin';

    try {
      await userService.createStudentEditRequest({
        student: isStudentRole ? localUser.id : null,
        request_type: isStudentRole ? 'student' : 'staff',
        required_reviewer_role: isSchoolAdmin ? 'superadmin' : 'admin',
        proposed_first_name: studentForm.first_name.trim().toUpperCase(),
        proposed_middle_name: studentForm.middle_name.trim().toUpperCase(),
        proposed_last_name: studentForm.last_name.trim().toUpperCase(),
        proposed_lrn: isStudentRole ? (studentForm.lrn.trim() || null) : null,
        proposed_aral_level: isStudentRole ? studentForm.aral_level : undefined,
      });

      setShowConfirmModal(false);
      setIsEditingStudent(false);
      const targetReviewer = isSchoolAdmin ? 'Super Admin' : 'School Admin';
      setMessage(`Your profile edit request has been submitted for ${targetReviewer} review.`);
      await fetchPendingRequest();
    } catch (err: any) {
      setShowConfirmModal(false);
      const errData = err?.response?.data;
      let msg = 'Failed to submit profile edit request.';
      if (typeof errData === 'string') {
        msg = errData;
      } else if (errData?.detail) {
        msg = errData.detail;
      } else if (errData && typeof errData === 'object') {
        const entries = Object.entries(errData);
        if (entries.length > 0) {
          const [field, errors] = entries[0];
          const errText = Array.isArray(errors) ? errors[0] : String(errors);
          const fieldLabel = field.replace(/_/g, ' ');
          msg = `${fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1)}: ${errText}`;
        }
      }
      setStudentEditError(msg);
    } finally {
      setIsSavingStudent(false);
    }
  };

  // Cancel / Withdraw pending edit request
  const handleExecuteCancelRequest = async () => {
    if (!pendingEditRequest) return;

    setIsCancelling(true);
    try {
      await userService.cancelStudentEditRequest(pendingEditRequest.id);
      setPendingEditRequest(null);
      setShowPendingModal(false);
      setShowCancelConfirmModal(false);
      setMessage('Your profile edit request has been successfully withdrawn.');
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      const errDetail = err?.response?.data?.detail || 'Failed to cancel profile edit request.';
      setError(errDetail);
      setTimeout(() => setError(null), 5000);
      setShowCancelConfirmModal(false);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!localUser) {
    return (
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading profile information...
      </div>
    );
  }

  const readonlyStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.55rem 0.85rem',
    borderRadius: '6px',
    border: '1px solid var(--slate-200)',
    background: 'var(--surface-muted)',
    backgroundColor: 'var(--surface-muted)',
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    cursor: 'default',
  };

  const editableStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.55rem 0.85rem',
    borderRadius: '6px',
    border: '1.5px solid var(--brand)',
    background: 'var(--surface-card)',
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  return (
    <div className="max-w-[900px] mx-auto flex flex-col gap-3.5 sm:gap-6 w-full min-w-0">

      {/* ── User Overview Header ── */}
      <div className="p-4 sm:p-6 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex flex-row items-center gap-3 sm:gap-5 text-left w-full sm:w-auto min-w-0">
            <div
              className="flex items-center justify-center shrink-0 overflow-hidden rounded-full bg-blue-50 text-[var(--brand)] border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px]"
            >
              {localUser.avatar ? (
                <img src={localUser.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <UserIcon className="w-6 h-6 sm:w-8 sm:h-8 md:w-[34px] md:h-[34px]" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              {/* Displayed in uppercase with middle initial only across the system */}
              <h1
                className="text-lg sm:text-2xl font-black leading-tight break-words text-gray-900 dark:text-slate-100 tracking-tight"
                style={{ margin: 0, fontFamily: 'var(--font-heading)' }}
              >
                {formatSystemDisplayName(localUser)}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 text-[10.5px] sm:text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider"
                >
                  {localUser.is_superuser ? 'SuperAdmin' : localUser.role?.toUpperCase() || 'USER'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pending Edit Request Notification Banner (All non-superadmin roles) ── */}
      {!localUser.is_superuser && pendingEditRequest && (
        <div className="bg-amber-50/80 dark:bg-amber-950/20 border-2 border-amber-500 dark:border-amber-500 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-3.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-400 leading-snug">
                PROFILE EDIT REQUEST PENDING REVIEW
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-200 mt-1 leading-relaxed">
                You have submitted profile changes on{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {new Date(pendingEditRequest.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                . Your request has been forwarded to the {localUser.role === 'admin' ? 'Super Admin' : 'School Admin'} for review and approval.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setShowCancelConfirmModal(true)}
              disabled={isCancelling}
              className="flex-1 sm:flex-initial justify-center whitespace-nowrap inline-flex items-center px-2.5 sm:px-4 py-2 rounded-xl bg-white dark:bg-rose-950/20 border border-rose-300 dark:border-rose-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-bold text-[11px] sm:text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isCancelling ? 'Cancelling...' : <><span className="sm:hidden">Cancel</span><span className="hidden sm:inline">Cancel Request</span></>}
            </button>

            <button
              type="button"
              onClick={() => setShowPendingModal(true)}
              className="flex-1 sm:flex-initial justify-center whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-400 dark:border-amber-500 hover:border-amber-500 text-amber-700 dark:text-amber-400 font-bold text-[11px] sm:text-xs shadow-xs transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span><span className="sm:hidden">View Details</span><span className="hidden sm:inline">View Request Details</span></span>
            </button>
          </div>
        </div>
      )}

      {/* ── Profile Details Section ── */}
      <div className="p-4 sm:p-6 md:p-8 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm">

        {/* Card header row */}
        <div className="flex items-center justify-between gap-2 mb-3.5 sm:mb-6">
          <h2 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-slate-100 uppercase tracking-wider truncate">
            PROFILE INFORMATION
          </h2>

          {!localUser.is_superuser ? (
            pendingEditRequest ? null : (
              <button
                type="button"
                onClick={handleEditOpen}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-dark)] rounded-md cursor-pointer whitespace-nowrap transition-colors shrink-0 shadow-xs"
              >
                <Edit3 size={13} className="shrink-0" />
                <span><span className="hidden xs:inline">Request </span>Update</span>
              </button>
            )
          ) : !isEditing ? (
            <button
              type="button"
              onClick={handleEditOpen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-dark)] rounded-md cursor-pointer whitespace-nowrap transition-colors shrink-0 shadow-xs"
            >
              <Edit3 size={13} className="shrink-0" />
              <span>Edit</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-md cursor-pointer transition-colors"
              >
                <X size={13} />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-dark)] rounded-md cursor-pointer transition-colors disabled:opacity-50"
              >
                <Save size={13} />
                <span>{isSaving ? 'Saving…' : 'Save'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}
        {message && (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} /> {message}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:gap-4">
          {/* First Name / Middle Name / Last Name (Normal Typography) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
            <div className="flex flex-col gap-1 sm:gap-1.5">
              <label className="text-[10px] sm:text-[10.5px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider">First Name</label>
              {isEditing && localUser.role !== 'student' ? (
                <input
                  value={editFirst}
                  onChange={(e) => setEditFirst(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                  placeholder="First name"
                  style={editableStyle}
                />
              ) : (
                <input value={toTitleCase(localUser.first_name)} readOnly disabled style={readonlyStyle} />
              )}
            </div>

            <div className="flex flex-col gap-1 sm:gap-1.5">
              <label className="text-[10px] sm:text-[10.5px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Middle Name</label>
              {isEditing && localUser.role !== 'student' ? (
                <input
                  value={editMiddle}
                  onChange={(e) => setEditMiddle(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                  placeholder="Middle name"
                  style={editableStyle}
                />
              ) : (
                <input value={toTitleCase(localUser.middle_name) || '—'} readOnly disabled style={readonlyStyle} />
              )}
            </div>

            <div className="flex flex-col gap-1 sm:gap-1.5">
              <label className="text-[10px] sm:text-[10.5px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Last Name</label>
              {isEditing && localUser.role !== 'student' ? (
                <input
                  value={editLast}
                  onChange={(e) => setEditLast(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                  placeholder="Last name"
                  style={editableStyle}
                />
              ) : (
                <input value={toTitleCase(localUser.last_name)} readOnly disabled style={readonlyStyle} />
              )}
            </div>
          </div>

          {/* Email (or LRN for students) / Member Since */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
            <div className="flex flex-col gap-1 sm:gap-1.5">
              <label className="text-[10px] sm:text-[10.5px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {localUser.role === 'student' ? 'Learner Reference Number (LRN)' : 'Email Address'}
              </label>
              <div
                className="relative group w-full"
                title={localUser.role !== 'student' ? 'Contact admin to change email' : undefined}
              >
                <input
                  name="profile_email_readonly"
                  autoComplete="off"
                  value={
                    localUser.role === 'student'
                      ? (localUser.lrn ? (showSensitiveIdentity ? localUser.lrn : '••••••••••••') : '—')
                      : (localUser.email ? (showSensitiveIdentity ? localUser.email : '••••••••••@••••••') : '—')
                  }
                  readOnly
                  disabled
                  tabIndex={-1}
                  style={{ ...readonlyStyle, paddingRight: '2.5rem' }}
                  className="w-full pointer-events-none select-none font-bold"
                />
                {((localUser.role === 'student' && localUser.lrn) ||
                  (localUser.role !== 'student' && localUser.email)) && (
                    <button
                      type="button"
                      onClick={() => setShowSensitiveIdentity((prev) => !prev)}
                      aria-label={
                        localUser.role === 'student'
                          ? (showSensitiveIdentity ? 'Hide LRN' : 'Show LRN')
                          : (showSensitiveIdentity ? 'Hide email address' : 'Show email address')
                      }
                      title={
                        localUser.role === 'student'
                          ? (showSensitiveIdentity ? 'Hide LRN' : 'Show LRN')
                          : (showSensitiveIdentity ? 'Hide email address' : 'Show email address')
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      {showSensitiveIdentity ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}

                {localUser.role !== 'student' && (
                  <div className="pointer-events-none absolute bottom-full left-3 mb-2 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 dark:bg-zinc-800 text-white text-xs font-semibold shadow-xl border border-slate-700/60 dark:border-zinc-700 whitespace-nowrap z-30 transition-all animate-in fade-in duration-150">
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Contact admin to change email</span>
                    <div className="absolute top-full left-6 -mt-1 border-4 border-transparent border-t-slate-900/95 dark:border-t-zinc-800" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 sm:gap-1.5">
              <label className="text-[10px] sm:text-[10.5px] font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Member Since
              </label>
              <input
                value={new Date(localUser.date_joined).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                readOnly
                disabled
                style={readonlyStyle}
              />
            </div>
          </div>

          {/* Tutor Role Details & Handled Classes */}
          {localUser.role === 'tutor' && (
            <div className="mt-2 pt-3.5 sm:pt-4 border-t border-gray-100 dark:border-[#1A1A1A] space-y-2.5 sm:space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-slate-100 uppercase tracking-wider">
                    ASSIGNED CLASSES {tutorAssignedClasses.length > 0 && `(${tutorAssignedClasses.length})`}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {tutorAssignedClasses.map((cls, idx) => {
                  return (
                    <div
                      key={cls.key || idx}
                      className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 sm:p-4 space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-[#1A1A1A]">
                        <span className="text-[11px] font-extrabold text-gray-800 dark:text-slate-200 uppercase tracking-wider">
                          Class #{idx + 1}
                        </span>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200">
                          {cls.aralLevel.toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[10px] font-extrabold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0 pt-0.5">
                            Subject
                          </span>
                          <span className="font-bold text-gray-900 dark:text-slate-100 text-right break-words text-xs sm:text-[13px]">
                            {cls.subject}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[10px] font-extrabold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0 pt-0.5">
                            Grade & Section
                          </span>
                          <span className="font-bold text-gray-900 dark:text-slate-100 text-right break-words text-xs sm:text-[13px]">
                            {cls.cohort}
                          </span>
                        </div>
                        {cls.students && cls.students.length > 0 && (
                          <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-gray-100 dark:border-[#1A1A1A] text-[11px]">
                            <span className="text-[10px] font-extrabold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
                              Assigned Students
                            </span>
                            <span className="font-mono font-bold text-gray-900 dark:text-slate-100 text-xs sm:text-[13px]">
                              {cls.students.length}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Student Enrolled Classes (Matching Tutor Assigned Classes Card Display) */}
          {localUser.role === 'student' && (
            <div className="mt-2 pt-3.5 sm:pt-4 border-t border-gray-100 dark:border-[#1A1A1A] space-y-2.5 sm:space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-slate-100 uppercase tracking-wider">
                    ASSIGNED CLASSES {studentAssignedClasses.length > 0 && `(${studentAssignedClasses.length})`}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {studentAssignedClasses.map((cls, idx) => (
                  <div
                    key={cls.key || idx}
                    className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 sm:p-4 space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-[#1A1A1A]">
                      <span className="text-[11px] font-extrabold text-gray-800 dark:text-slate-200 uppercase tracking-wider">
                        Class #{idx + 1}
                      </span>
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200">
                        {cls.aralLevel}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[10px] font-extrabold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0 pt-0.5">
                          Subject
                        </span>
                        <span className="font-bold text-gray-900 dark:text-slate-100 text-right break-words text-xs sm:text-[13px]">
                          {cls.subject}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[10px] font-extrabold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0 pt-0.5">
                          Grade & Section
                        </span>
                        <span className="font-bold text-gray-900 dark:text-slate-100 text-right break-words text-xs sm:text-[13px]">
                          {cls.cohort}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3 pt-1.5 border-t border-gray-100 dark:border-[#1A1A1A] text-[11px]">
                        <span className="text-[10px] font-extrabold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0 pt-0.5">
                          Assigned Tutor
                        </span>
                        <span
                          className="font-bold text-gray-900 dark:text-slate-100 text-right break-words text-xs sm:text-[13px]"
                        >
                          {cls.tutorName}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {localUser.role !== 'student' && (
        <section className="p-3.5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] shadow-sm">
          <h2 className="text-xs sm:text-sm md:text-base font-bold uppercase tracking-wider text-gray-900 dark:text-white mb-3 sm:mb-4">
            ACCOUNT SECURITY
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
            <div className="border border-slate-200 dark:border-zinc-800 rounded-lg sm:rounded-xl p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-900/30 flex flex-col justify-between">
              <div>
                <h3 className="text-xs sm:text-[0.85rem] font-extrabold text-gray-900 dark:text-slate-100 uppercase tracking-wide">CHANGE PASSWORD</h3>
                <p className="text-[11px] sm:text-[0.78rem] text-slate-500 dark:text-slate-400 mt-1 mb-3 leading-relaxed">Your sign-in password is managed through your Google Account.</p>
              </div>
              <SecurityHelpButton label="How to change password" description="Open your Google Account, select Security, then choose Password under “How you sign in to Google.”" />
            </div>
            <div className="border border-slate-200 dark:border-zinc-800 rounded-lg sm:rounded-xl p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-900/30 flex flex-col justify-between">
              <div>
                <h3 className="text-xs sm:text-[0.85rem] font-extrabold text-gray-900 dark:text-slate-100 uppercase tracking-wide">ENABLE 2-FACTOR AUTHENTICATION</h3>
                <p className="text-[11px] sm:text-[0.78rem] text-slate-500 dark:text-slate-400 mt-1 mb-3 leading-relaxed">Two-factor authentication is managed through your Google Account.</p>
              </div>
              <SecurityHelpButton label="How to enable 2-factor authentication" description="Open your Google Account, select Security, then choose 2-Step Verification and follow the setup steps." />
            </div>
          </div>
        </section>
      )}

      {/* ── SIGN-IN & SIGN-OUT HISTORY (ALL ROLES) ─────────────────── */}
      <section className="p-3.5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <h2 className="text-xs sm:text-sm md:text-base font-bold uppercase tracking-wider text-gray-900 dark:text-white m-0">
            SIGN-IN & SIGN-OUT HISTORY
          </h2>
          <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0 max-w-full">
            {(['all', 'login', 'logout'] as const).map((tab) => {
              const count =
                tab === 'all'
                  ? dateFilteredLoginHistory.length
                  : dateFilteredLoginHistory.filter((item) => item.event_type === tab).length;
              const label = tab === 'all' ? 'ALL' : tab === 'login' ? 'SIGN IN' : 'SIGN OUT';
              const isActive = historyFilter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setHistoryFilter(tab);
                    setHistoryPage(1);
                  }}
                  className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wide sm:tracking-wider whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--brand)] text-white'
                      : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}

            <div className="relative inline-flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setShowHistoryCalendar((prev) => !prev)}
                title={historyDateFilter ? `Filtered by ${historyDateFilter}` : 'Filter sign-in and sign-out history by date'}
                aria-label="Filter sign-in and sign-out history by date"
                className="h-6 sm:h-7 px-2 sm:px-2.5 rounded-xl border border-[var(--brand)] bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-[10px] sm:text-[11px] font-bold inline-flex items-center justify-center gap-1 sm:gap-1.5 transition cursor-pointer shadow-2xs shrink-0"
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                {historyDateFilter && (
                  <>
                    <span className="whitespace-nowrap">
                      {new Date(`${historyDateFilter}T00:00:00`).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistoryDateFilter('');
                        setHistoryPage(1);
                        setShowHistoryCalendar(false);
                      }}
                      className="p-0.5 rounded-full hover:bg-white/20 transition cursor-pointer shrink-0"
                      title="Clear date"
                      aria-label="Clear date filter"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </>
                )}
              </button>

              {showHistoryCalendar && (
                <ProfileCalendarDropdown
                  selectedDate={historyDateFilter}
                  onSelectDate={(d) => {
                    setHistoryDateFilter(d);
                    setHistoryPage(1);
                    setShowHistoryCalendar(false);
                  }}
                  onClear={() => {
                    setHistoryDateFilter('');
                    setHistoryPage(1);
                    setShowHistoryCalendar(false);
                  }}
                  onClose={() => setShowHistoryCalendar(false)}
                />
              )}
            </div>
          </div>
        </div>

        {isLoadingHistory ? (
          <div className="space-y-2.5 py-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 rounded-xl border border-slate-100 dark:border-zinc-900 bg-slate-50/70 dark:bg-zinc-900/40 skeleton"
              />
            ))}
          </div>
        ) : historyError ? (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 p-3.5 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300 m-0">{historyError}</p>
            <button
              type="button"
              onClick={loadLoginHistory}
              className="px-3 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        ) : visibleLoginHistory.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 p-5 text-center">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 m-0">
              No {historyFilter === 'all' ? 'sign-in or sign-out' : historyFilter === 'login' ? 'sign-in' : 'sign-out'} activity recorded yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleLoginHistory.map((entry) => {
              const isLogin = entry.event_type === 'login';
              const dt = new Date(entry.timestamp);
              const dateStr = dt.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const timeStr = dt.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${isLogin
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700'
                          }`}
                      >
                        {isLogin ? 'Sign In' : 'Sign Out'}
                      </span>
                      <span className="text-xs font-bold text-gray-900 dark:text-slate-100">
                        {entry.action_label}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="m-0 text-xs font-semibold text-gray-800 dark:text-slate-200 whitespace-nowrap">
                      {dateStr}
                    </p>
                    <p className="m-0 text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {timeStr}
                    </p>
                  </div>
                </div>
              );
            })}

            {filteredLoginHistory.length > HISTORY_PAGE_SIZE && (
              <TablePagination
                currentPage={safeHistoryPage}
                totalItems={filteredLoginHistory.length}
                totalPages={historyTotalPages}
                pageSize={HISTORY_PAGE_SIZE}
                onPageChange={setHistoryPage}
                itemLabel="records"
                className="!flex-row !items-center !justify-between !gap-2 !bg-transparent !border-0 !px-0 !pt-3 !pb-0 mt-1 !text-[11px] sm:!text-xs whitespace-nowrap"
              />
            )}
          </div>
        )}
      </section>

      {/* ── STUDENT EDIT REQUEST MODAL ─────────────────────────────── */}
      {isEditingStudent &&
        createPortal(
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <form onSubmit={handleStudentFormSubmit} className="bg-white dark:bg-[#0A0A0A] rounded-3xl p-4 sm:p-6 max-w-lg w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A] pb-3">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm sm:text-lg uppercase">
                    REQUEST PROFILE UPDATE
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingStudent(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {studentEditError && (
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{studentEditError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Proposed First Name *</label>
                  <input
                    type="text"
                    required
                    value={studentForm.first_name}
                    onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })}
                    placeholder="e.g. JUAN"
                    className="w-full px-3.5 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-xl text-sm bg-gray-50 dark:bg-[#111111] text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] uppercase font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Proposed Middle Name</label>
                  <input
                    type="text"
                    value={studentForm.middle_name}
                    onChange={(e) => setStudentForm({ ...studentForm, middle_name: e.target.value })}
                    placeholder="e.g. PROTACIO"
                    className="w-full px-3.5 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-xl text-sm bg-gray-50 dark:bg-[#111111] text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] uppercase font-semibold"
                  />
                </div>
              </div>

              <div className={`grid grid-cols-1 ${localUser.role === 'student' ? 'sm:grid-cols-2' : ''} gap-3.5`}>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Proposed Last Name *</label>
                  <input
                    type="text"
                    required
                    value={studentForm.last_name}
                    onChange={(e) => setStudentForm({ ...studentForm, last_name: e.target.value })}
                    placeholder="e.g. DELA CRUZ"
                    className="w-full px-3.5 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-xl text-sm bg-gray-50 dark:bg-[#111111] text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] uppercase font-semibold"
                  />
                </div>

                {localUser.role === 'student' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Proposed LRN (12 digits)</label>
                    <input
                      type="text"
                      maxLength={12}
                      value={studentForm.lrn}
                      onChange={(e) => setStudentForm({ ...studentForm, lrn: e.target.value.replace(/\D/g, '') })}
                      placeholder="12-digit number"
                      className="w-full px-3.5 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-xl text-sm bg-gray-50 dark:bg-[#111111] text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-2.5 pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
                <button
                  type="button"
                  onClick={() => setIsEditingStudent(false)}
                  className="w-full sm:w-auto bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-slate-300 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer whitespace-nowrap text-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-4 sm:px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-sm transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span><span className="sm:hidden">Submit Request</span><span className="hidden sm:inline">Submit Request for Approval</span></span>
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* ── CONFIRMATION MODAL BEFORE SUBMISSION ───────────────────── */}
      {showConfirmModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl p-4 sm:p-6 max-w-sm w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4 animate-fade-in-scale">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-slate-100">
                  Confirm Edit Request Submission
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-slate-400">
                  Are you sure you want to submit this profile change request? Your proposed details will be sent to the <span className="font-bold text-gray-700 dark:text-slate-300">School Admin</span> and <span className="font-bold text-gray-700 dark:text-slate-300">Super Admin</span> for confirmation and review.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 sm:gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSavingStudent}
                  onClick={() => setShowConfirmModal(false)}
                  className="rounded-xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-3.5 sm:px-4 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingStudent}
                  onClick={handleConfirmSubmitRequest}
                  className="rounded-xl bg-[var(--brand)] px-3.5 sm:px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--brand-dark)] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  {isSavingStudent ? 'Submitting...' : 'Yes, Submit Request'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── PENDING REQUEST DETAILS MODAL ──────────────────────────── */}
      {showPendingModal && pendingEditRequest &&
        createPortal(
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl p-4 sm:p-6 max-w-md w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm sm:text-base uppercase">EDIT REQUEST PENDING</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPendingModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 dark:bg-[#111111] p-3.5 rounded-2xl border border-slate-200 dark:border-[#1A1A1A] space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 dark:text-slate-400 font-medium shrink-0">Submitted On:</span>
                    <span className="font-semibold text-gray-800 dark:text-slate-200 text-right">
                      {new Date(pendingEditRequest.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 items-center">
                    <span className="text-gray-500 dark:text-slate-400 font-medium shrink-0">Status:</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      Pending Approval
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-gray-700 dark:text-slate-300 text-xs">Proposed Changes:</h4>
                  <div className="bg-gray-50 dark:bg-[#111111] p-3 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] space-y-1.5 font-mono text-[11px] break-words">
                    <p className="text-gray-700 dark:text-slate-200">
                      <span className="text-gray-400 dark:text-slate-400 font-sans">Name: </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100">{pendingEditRequest.proposed_last_name}, {pendingEditRequest.proposed_first_name} {pendingEditRequest.proposed_middle_name || ''}</span>
                    </p>
                    <p className="text-gray-700 dark:text-slate-200">
                      <span className="text-gray-400 dark:text-slate-400 font-sans">LRN: </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100">{pendingEditRequest.proposed_lrn || 'Unchanged'}</span>
                    </p>
                    <p className="text-gray-700 dark:text-slate-200">
                      <span className="text-gray-400 dark:text-slate-400 font-sans">ARAL Level: </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100">{pendingEditRequest.proposed_aral_level ? formatAralLevel(pendingEditRequest.proposed_aral_level) : 'Unchanged'}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-gray-100 dark:border-[#1A1A1A]">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirmModal(true)}
                  disabled={isCancelling}
                  className="inline-flex items-center px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800/80 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel Request'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── CONFIRMATION MODAL BEFORE WITHDRAWING EDIT REQUEST ── */}
      {showCancelConfirmModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl p-6 max-w-sm w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4 animate-fade-in-scale">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                    Withdraw Edit Request?
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-slate-300">
                    Are you sure you want to withdraw this profile edit request? This will cancel the pending review and allow you to make a new request whenever needed.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-[#1A1A1A]">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setShowCancelConfirmModal(false)}
                  className="rounded-xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-4 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer"
                >
                  No, Keep Request
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleExecuteCancelRequest}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isCancelling ? 'Withdrawing...' : 'Yes, Withdraw'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
