import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { User, Grade, Attendance, TutorCohortHistoryData } from '../../types';
import { computeStudentRiskRows } from '../../utils/analyticsHelpers';
import { User as UserIcon, Search, ArrowUpDown, Users, ChevronUp, ChevronDown, AlertCircle, Plus, Check, X } from 'lucide-react';
import { TutorCohortFilter } from '../../components/TutorCohortFilter';
import {
  useTutorCohortFilter,
  isStudentInCohort,
  getCachedTutorStudents,
  setCachedTutorStudents,
  buildTutorClassSections,
} from '../../utils/tutorCohortHelpers';
import { getActiveSystemSemester } from '../../utils/sessionDescriptionHelpers';
import { AnimatedCounter } from '../../components/AnimatedCounter';
import { useAnimatedPresence } from '../../hooks/useAnimatedPresence';

const NAME_REGEX = /^[a-zA-Z\s.\-ñÑ']+$/;
const PHONE_REGEX = /^\d{11}$/;
const LRN_REGEX = /^\d{12}$/;
const DANGEROUS_INJECTION_PATTERN = /(--|;|\/\*|\*\/|@@|<script|<\/script>)/i;

/* ─── Badge helpers (Clean typography without pill container) ─── */
const getAralBadge = (level?: string | null) => {
  const formatted = level ? level.toUpperCase() : 'BASIC';
  return (
    <span className="text-[11px] font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wide">
      {formatted}
    </span>
  );
};

import { compareNamesByLastName } from '../../utils/studentFormatters';
import { matchesSearch } from '../../utils/searchHelpers';

function getDepEdSchoolYear(date: Date = new Date()) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  let syStart = year;
  let syEnd = year + 1;
  let currentPeriod: '1st' | '2nd' | 'summer' = '1st';

  if (month < 7) {
    syStart = year - 1;
    syEnd = year;
    currentPeriod = month === 6 ? 'summer' : '2nd';
  } else {
    currentPeriod = '1st';
  }

  return {
    syStart,
    syEnd,
    currentPeriod,
    currentKey: `${syStart}-${syEnd}`,
    displayLabel: `SY ${syStart}–${syEnd}`,
  };
}

export const getSchoolYearFromDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '2026-2027';
  const clean = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
  const d = new Date(clean);
  if (isNaN(d.getTime())) return '2026-2027';
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 7) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
};

export const getSemesterFromDate = (dateStr: string | null | undefined): '1st' | '2nd' | 'summer' => {
  if (!dateStr) return '1st';
  const clean = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
  const d = new Date(clean);
  if (isNaN(d.getTime())) return '1st';
  const month = d.getMonth() + 1;
  if (month >= 7 && month <= 12) return '1st';
  if (month >= 1 && month <= 5) return '2nd';
  if (month === 6) return 'summer';
  return '1st';
};

export const getSemesterFromGrade = (grade: Grade): '1st' | '2nd' | 'summer' => {
  const subj = (grade.subject || '').toLowerCase();
  const rem = (grade.remarks || '').toLowerCase();
  if (subj.includes('summer') || rem.includes('summer')) return 'summer';
  if (subj.includes('eosy') || rem.includes('eosy')) return '2nd';
  if (subj.includes('mosy') || rem.includes('mosy')) return '1st';
  if (grade.quarter === 1) return '1st';
  if (grade.quarter === 2 || grade.quarter === 4) return '2nd';
  if (grade.quarter === 3) return 'summer';
  return getSemesterFromDate(grade.date_logged || grade.created_at);
};

/* ─── Component ────────────────────────────────────────────────── */
export const TutorStudentDirectory: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>(() => getCachedTutorStudents(user?.id));
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(() => getCachedTutorStudents(user?.id).length === 0);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Cohort top filter state (ARAL Level, Subject, Grade - Section) synced across tutor dashboard
  const {
    selectedAralLevel,
    setSelectedAralLevel,
    selectedSubject,
    setSelectedSubject,
    selectedCohort,
    setSelectedCohort,
    setSelectedCohortFilter,
  } = useTutorCohortFilter(user);

  // Cohort View Mode: 'active' | 'past'
  const [cohortViewMode, setCohortViewMode] = useState<'active' | 'past'>('active');
  const [cohortHistory, setCohortHistory] = useState<TutorCohortHistoryData | null>(null);
  const [selectedPastPeriodFilter, setSelectedPastPeriodFilter] = useState<string>('all');
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Enroll Student Modal state
  const handledClasses = useMemo(() => buildTutorClassSections(user, students), [user, students]);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const { shouldRender: shouldRenderEnrollModal, isClosing: isEnrollModalClosing } =
    useAnimatedPresence(isEnrollModalOpen, 170);
  const [enrollClassKey, setEnrollClassKey] = useState('');
  const [isEnrollClassDropdownOpen, setIsEnrollClassDropdownOpen] = useState(false);
  const enrollClassDropdownRef = useRef<HTMLDivElement>(null);
  const [enrollFirstName, setEnrollFirstName] = useState('');
  const [enrollMiddleName, setEnrollMiddleName] = useState('');
  const [enrollLastName, setEnrollLastName] = useState('');
  const [enrollLrn, setEnrollLrn] = useState('');
  const [enrollParentGuardian, setEnrollParentGuardian] = useState('');
  const [enrollContactNumber, setEnrollContactNumber] = useState('');
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollToast, setEnrollToast] = useState<string | null>(null);

  useEffect(() => {
    if (!enrollToast) return;
    const timer = setTimeout(() => setEnrollToast(null), 4000);
    return () => clearTimeout(timer);
  }, [enrollToast]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (enrollClassDropdownRef.current && !enrollClassDropdownRef.current.contains(e.target as Node)) {
        setIsEnrollClassDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEnrollClassDropdownOpen(false);
    };

    if (isEnrollClassDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnrollClassDropdownOpen]);

  const activeEnrollClassLabel = useMemo(() => {
    const match = handledClasses.find((c) => c.key === enrollClassKey);
    return match?.label || handledClasses[0]?.label || 'Select class';
  }, [handledClasses, enrollClassKey]);

  const handleOpenEnrollModal = () => {
    const matchingClass = handledClasses.find((c) => {
      const matchesLevel = selectedAralLevel === 'all' || c.aralLevel === selectedAralLevel;
      const matchesSub =
        selectedSubject === 'all' ||
        !selectedSubject ||
        c.subject.toLowerCase() === selectedSubject.toLowerCase();
      const matchesCohort =
        selectedCohort === 'all' ||
        !selectedCohort ||
        c.cohort.toUpperCase() === selectedCohort.toUpperCase();
      return matchesLevel && matchesSub && matchesCohort;
    });
    setEnrollClassKey(matchingClass?.key || handledClasses[0]?.key || '');
    setIsEnrollClassDropdownOpen(false);
    setEnrollFirstName('');
    setEnrollMiddleName('');
    setEnrollLastName('');
    setEnrollLrn('');
    setEnrollParentGuardian('');
    setEnrollContactNumber('');
    setEnrollError(null);
    setIsEnrollModalOpen(true);
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setEnrollError(null);

    const fName = enrollFirstName.trim();
    const mName = enrollMiddleName.trim();
    const lName = enrollLastName.trim();
    const lrnClean = enrollLrn.trim();
    const parentClean = enrollParentGuardian.trim();
    const contactClean = enrollContactNumber.trim();

    if (!fName) {
      setEnrollError('First Name is required.');
      return;
    }
    if (!NAME_REGEX.test(fName) || DANGEROUS_INJECTION_PATTERN.test(fName)) {
      setEnrollError('First Name can only contain letters, spaces, hyphens, and periods.');
      return;
    }
    if (mName && (!NAME_REGEX.test(mName) || DANGEROUS_INJECTION_PATTERN.test(mName))) {
      setEnrollError('Middle Name can only contain letters, spaces, hyphens, and periods.');
      return;
    }
    if (!lName) {
      setEnrollError('Last Name is required.');
      return;
    }
    if (!NAME_REGEX.test(lName) || DANGEROUS_INJECTION_PATTERN.test(lName)) {
      setEnrollError('Last Name can only contain letters, spaces, hyphens, and periods.');
      return;
    }
    if (!LRN_REGEX.test(lrnClean)) {
      setEnrollError('LRN must be exactly 12 digits (numbers only).');
      return;
    }
    if (parentClean && (!NAME_REGEX.test(parentClean) || DANGEROUS_INJECTION_PATTERN.test(parentClean))) {
      setEnrollError('Parent / Guardian Name can only contain letters, spaces, hyphens, and periods.');
      return;
    }
    if (contactClean && !PHONE_REGEX.test(contactClean)) {
      setEnrollError('Contact Number must be exactly 11 digits (e.g. 09123456789).');
      return;
    }

    const targetClass = handledClasses.find((c) => c.key === enrollClassKey) || handledClasses[0];
    const resolvedAralLevel = targetClass?.aralLevel || (selectedAralLevel !== 'all' ? selectedAralLevel : 'basic');
    const resolvedSubject = targetClass?.subject || (selectedSubject !== 'all' && selectedSubject ? selectedSubject : 'Filipino');
    const resolvedGradeLevel =
      targetClass?.cohort ||
      (selectedCohort !== 'all' && selectedCohort ? selectedCohort : user.grade_level?.split(',')[0]?.trim() || 'GRADE 7 - HYACINTH');

    setIsEnrolling(true);
    try {
      const createdStudent = await userService.createUser({
        role: 'student',
        first_name: fName.toUpperCase(),
        middle_name: mName ? mName.toUpperCase() : '',
        last_name: lName.toUpperCase(),
        lrn: lrnClean,
        parent_guardian_name: parentClean ? parentClean.toUpperCase() : '',
        contact_number: contactClean,
        assigned_tutor: String(user.id),
        aral_level: resolvedAralLevel,
        subject: resolvedSubject,
        grade_level: resolvedGradeLevel,
      } as any);

      setStudents((prev) => {
        const next = [...prev, createdStudent];
        if (user.id) {
          setCachedTutorStudents(user.id, next);
        }
        return next;
      });
      setIsEnrollModalOpen(false);
      setEnrollToast(`${createdStudent.full_name || `${lName.toUpperCase()}, ${fName.toUpperCase()}`} enrolled into ${resolvedGradeLevel}.`);
      fetchData();
    } catch (err: any) {
      const errData = err?.response?.data;
      if (typeof errData?.detail === 'string') {
        setEnrollError(errData.detail);
      } else if (errData && typeof errData === 'object') {
        const firstFieldErr = Object.values(errData).flat()[0];
        setEnrollError(typeof firstFieldErr === 'string' ? firstFieldErr : 'Failed to enroll student.');
      } else {
        setEnrollError('Failed to enroll student. Please check the fields and try again.');
      }
    } finally {
      setIsEnrolling(false);
    }
  };

  const currentSchoolYear = useMemo(() => getDepEdSchoolYear(), []);
  const [activeSystemSy, setActiveSystemSy] = useState<string>(
    () => `${currentSchoolYear.syStart}-${currentSchoolYear.syEnd}`
  );
  const [activeSystemSem, setActiveSystemSem] = useState<'1st' | '2nd' | 'summer'>(
    () => (getActiveSystemSemester() || currentSchoolYear.currentPeriod) as '1st' | '2nd' | 'summer'
  );
  const activePeriodKey = useMemo(() => `${activeSystemSy}|${activeSystemSem}`, [activeSystemSy, activeSystemSem]);

  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(
    () => `${currentSchoolYear.syStart}-${currentSchoolYear.syEnd}|${currentSchoolYear.currentPeriod}`
  );

  const schoolYearOptions = useMemo(() => {
    const activeKey = `${activeSystemSy}|${activeSystemSem}`;
    const recordedPeriods = new Set<string>();

    // 1. From grades
    for (const g of grades) {
      const gDate = g.date_logged || g.created_at;
      const sy = getSchoolYearFromDate(gDate);
      const sem = getSemesterFromGrade(g);
      if (sy && sem) {
        recordedPeriods.add(`${sy}|${sem}`);
      }
    }

    // 2. From attendance
    for (const a of attendance) {
      const aDate = a.date;
      const sy = getSchoolYearFromDate(aDate);
      const sem = getSemesterFromDate(aDate);
      if (sy && sem) {
        recordedPeriods.add(`${sy}|${sem}`);
      }
    }

    // Always include current active period
    recordedPeriods.add(activeKey);

    // Convert to list of { sy, sem }
    const periodsList = Array.from(recordedPeriods).map((key) => {
      const [sy, sem] = key.split('|');
      return { key, sy, sem: sem as '1st' | '2nd' | 'summer' };
    });

    const semRank: Record<string, number> = { '1st': 1, '2nd': 2, 'summer': 3 };
    periodsList.sort((a, b) => {
      // Put active period first so it is default in both display and DOM order
      if (a.key === activeKey) return -1;
      if (b.key === activeKey) return 1;
      const yearA = parseInt(a.sy.split('-')[0], 10) || 0;
      const yearB = parseInt(b.sy.split('-')[0], 10) || 0;
      if (yearA !== yearB) {
        return yearB - yearA;
      }
      return (semRank[a.sem] || 0) - (semRank[b.sem] || 0);
    });

    const options: { key: string; label: string }[] = [];

    periodsList.forEach(({ key, sy, sem }) => {
      const isCurrent = key === activeKey;
      const tag = isCurrent ? ' (Active)' : '';
      const syDisplay = `SY ${sy.replace('-', '–')}`;
      const semDisplay = sem === '1st' ? '1st Semester (Q1 & Q2)' : sem === '2nd' ? '2nd Semester (Q3 & Q4)' : 'Summer (Midyear)';

      options.push({
        key,
        label: `${syDisplay} - ${semDisplay}${tag}`,
      });
    });

    return options;
  }, [activeSystemSy, activeSystemSem, grades, attendance]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const [studentData, gradeData, attData, currentSyData, cohortHistData] = await Promise.allSettled([
        userService.getAllUsers({ role: 'student', assigned_tutor: user.id }),
        academicService.getGrades(),
        academicService.getAttendanceHistory(),
        academicService.getCurrentSchoolYear(),
        academicService.getTutorCohortHistory(),
      ]);
      if (cohortHistData.status === 'fulfilled') {
        setCohortHistory(cohortHistData.value);
      }
      if (studentData.status === 'fulfilled') {
        setStudents(Array.isArray(studentData.value) ? studentData.value : []);
      }
      if (gradeData.status === 'fulfilled') {
        setGrades(Array.isArray(gradeData.value) ? gradeData.value : []);
      }
      if (attData.status === 'fulfilled') {
        setAttendance(Array.isArray(attData.value) ? attData.value : []);
      }
      if (currentSyData.status === 'fulfilled' && currentSyData.value?.school_year) {
        const activeSy = currentSyData.value.school_year;
        const activeSem = (currentSyData.value.current_semester || currentSyData.value.current_period || getActiveSystemSemester() || '1st') as '1st' | '2nd' | 'summer';
        setActiveSystemSy(activeSy);
        setActiveSystemSem(activeSem);
        const resolvedActiveKey = `${activeSy}|${activeSem}`;
        setSelectedSchoolYear((prev) => {
          if (!prev || prev === `${currentSchoolYear.syStart}-${currentSchoolYear.syEnd}|${currentSchoolYear.currentPeriod}` || prev === activePeriodKey) {
            return resolvedActiveKey;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load assigned students and performance data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const filteredGrades = grades;
  const filteredAttendance = attendance;

  // Filter students matching the currently selected cohort
  const cohortStudents = useMemo(() => {
    return students.filter((s) =>
      isStudentInCohort(s, {
        aral_level: selectedAralLevel,
        subject: selectedSubject,
        cohort: selectedCohort,
      })
    );
  }, [students, selectedAralLevel, selectedSubject, selectedCohort]);

  const studentRows = useMemo(() => {
    return computeStudentRiskRows(cohortStudents, filteredGrades, filteredAttendance).map((r) => ({ ...r, email: r.student.email }));
  }, [cohortStudents, filteredGrades, filteredAttendance]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filteredPastRecords = useMemo(() => {
    if (!cohortHistory?.past_records) return [];
    return cohortHistory.past_records.filter((rec) => {
      if (selectedPastPeriodFilter !== 'all') {
        if (rec.period !== selectedPastPeriodFilter && `${rec.school_year}|${rec.period}` !== selectedPastPeriodFilter) {
          return false;
        }
      }
      if (search.trim()) {
        if (!matchesSearch(search, rec.student_name, rec.lrn)) return false;
      }
      return true;
    });
  }, [cohortHistory, selectedPastPeriodFilter, search]);

  const pastPeriodOptions = useMemo(() => {
    if (!cohortHistory?.past_records) return [];
    const periods = new Set<string>();
    cohortHistory.past_records.forEach((r) => {
      periods.add(`${r.school_year} (${r.period})`);
    });
    return Array.from(periods);
  }, [cohortHistory]);

  const handleOpenStudentHistory = (studentId: string) => {
    setHistoryStudentId(studentId);
    setIsHistoryModalOpen(true);
  };

  const aralLevelRank: Record<string, number> = {
    basic: 1,
    plus: 2,
    summer: 3,
    'aral summer': 3,
    intervention: 1,
    enrichment: 2,
    advanced: 3,
  };

  const hasMultipleAralLevels = useMemo(() => {
    const distinct = new Set(studentRows.map((r) => (r.student.aral_level || '').trim().toLowerCase()).filter(Boolean));
    return distinct.size > 1;
  }, [studentRows]);

  const filteredAndSorted = useMemo(() => {
    return studentRows
      .filter((r) => {
        return matchesSearch(search, r.student.full_name, r.student.first_name, r.student.last_name, r.student.middle_name, r.student.lrn, r.student.parent_guardian_name, r.student.contact_number);
      })
      .sort((a, b) => {
        if (sortField === 'name' || !sortField) {
          const cmp = compareNamesByLastName(a.student, b.student);
          return sortAsc ? cmp : -cmp;
        }
        if (sortField === 'lrn') {
          const valA = a.student.lrn || '';
          const valB = b.student.lrn || '';
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (sortField === 'parent_guardian') {
          const valA = a.student.parent_guardian_name || '';
          const valB = b.student.parent_guardian_name || '';
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (sortField === 'contact') {
          const valA = a.student.contact_number || '';
          const valB = b.student.contact_number || '';
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (sortField === 'level') {
          const valA = (a.student.aral_level || '').toLowerCase();
          const valB = (b.student.aral_level || '').toLowerCase();
          const rankA = aralLevelRank[valA] ?? 0;
          const rankB = aralLevelRank[valB] ?? 0;
          if (rankA !== rankB) return sortAsc ? rankA - rankB : rankB - rankA;
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        const valA: any = (a.student as any)[sortField] || '';
        const valB: any = (b.student as any)[sortField] || '';
        if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [studentRows, search, sortField, sortAsc]);

  const SortableHeader: React.FC<{ label: string; field: string; className?: string }> = ({ label, field, className = '' }) => {
    const isActive = sortField === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap text-left transition-colors hover:text-gray-900 dark:hover:text-slate-100 select-none cursor-pointer ${className}`}
        aria-label={`Sort by ${label}`}
      >
        <span className={`whitespace-nowrap ${isActive ? 'text-[var(--brand)] font-extrabold' : ''}`}>{label}</span>
        {isActive ? (
          sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-75 shrink-0" />
        )}
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6 skeleton-container" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* Cohort Filter Skeleton (1:1 with TutorCohortFilter) */}
        <div className="w-full rounded-xl border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#0E0E0E] p-3 sm:px-4 sm:py-3.5 shadow-sm space-y-2 animate-pulse">
          <div className="h-3 w-36 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="w-full min-h-[44px] rounded-lg border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#141414] px-3.5 py-2.5 flex items-center justify-between">
            <div className="h-3.5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-3 w-4 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>

        {/* Directory Table Card skeleton */}
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] animate-pulse skeleton-row-2 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3.5 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1.5">
              <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="h-8 sm:h-8.5 w-full sm:w-52 rounded-md bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>

          <div className="p-3.5 sm:p-6 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 dark:border-gray-900/50">
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-36 rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-2.5 w-24 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-800 hidden md:block" />
                <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-800" />
                <div className="h-6 w-6 rounded-md bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-md p-5">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load student directory</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-3 px-3.5 py-1.5 bg-rose-600 text-white rounded-md text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 data-loaded-content" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>

      {/* ── Tutor Multi-Cohort Filter (ARAL Level, Subject, Grade - Section) ── */}
      <TutorCohortFilter
        user={user}
        students={students}
        isLoading={isLoading}
        selectedAralLevel={selectedAralLevel}
        onSelectAralLevel={setSelectedAralLevel}
        selectedSubject={selectedSubject}
        onSelectSubject={setSelectedSubject}
        selectedCohort={selectedCohort}
        onSelectCohort={setSelectedCohort}
        onSelectClass={(level, subject, cohort) =>
          setSelectedCohortFilter({ aral_level: level, subject, cohort })
        }
        allowAll={true}
        title="CURRENT CLASS FOR VIEW"
      />

      {/* ── States ────────────────────────────────────────────────── */}
      {students.length === 0 ? (
        <div className="bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-6 sm:p-10 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-md bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#1A1A1A] flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-gray-300 dark:text-slate-600" />
          </div>
          <p className="text-base font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">No students assigned yet</p>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 max-w-sm mx-auto">Enroll a student into your handled class or ask your administrator to assign student accounts.</p>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleOpenEnrollModal}
              className="h-8.5 px-4 rounded-md bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Enroll Student</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm relative">
          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="min-w-0">
              <h3 className="font-extrabold text-gray-900 dark:text-slate-100 text-xs sm:text-sm uppercase tracking-wider">ASSIGNED STUDENTS DETAILS</h3>
              <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                <AnimatedCounter value={filteredAndSorted.length} /> Student{filteredAndSorted.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="relative flex-1 sm:flex-initial sm:w-56 md:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search student or LRN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search assigned students"
                  className="h-8 sm:h-8.5 w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] pl-8 pr-2.5 text-xs font-semibold text-gray-900 dark:text-slate-100 outline-none transition placeholder:text-gray-400 placeholder:font-normal focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#111111]"
                />
              </label>
              <button
                type="button"
                onClick={handleOpenEnrollModal}
                className="h-8 sm:h-8.5 px-3 rounded-md bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Enroll Student</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-3 sm:p-6">
            {filteredAndSorted.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 sm:py-12 text-center">
                <Users className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                <p className="text-sm font-bold text-gray-800 dark:text-slate-200 tracking-tight">No matching students found</p>
                <p className="text-xs font-medium text-gray-400 dark:text-slate-500">
                  {search.trim() ? 'Try a different student name or LRN' : 'No students found in this cohort'}
                </p>
              </div>
            ) : (
              <>
                {/* ── Mobile View (< 768px): Mobile-optimized table with sealed sticky student column ── */}
                <div className="md:hidden overflow-x-auto mobile-scroll-table -mx-3 px-0 border border-gray-200 dark:border-[#1A1A1A] rounded-md bg-white dark:bg-[#111111]">
                  <table className="min-w-[620px] w-full border-separate border-spacing-0 text-xs" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                    <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515]">
                      <tr className="bg-gray-50 dark:bg-[#151515]">
                        <th className="sticky left-0 top-0 z-30 bg-gray-50 dark:bg-[#151515] w-[34%] min-w-[145px] px-2.5 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-200 dark:border-[#222222] shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                          <SortableHeader label="STUDENT" field="name" />
                        </th>
                        <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[95px] px-2 py-2 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                          <SortableHeader label="LRN" field="lrn" className="justify-center" />
                        </th>
                        <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[85px] px-2 py-2 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                          <SortableHeader label="ARAL LEVEL" field="level" className="justify-center" />
                        </th>
                        <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[130px] px-2 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                          <SortableHeader label="PARENT / GUARDIAN" field="parent_guardian" />
                        </th>
                        <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[105px] px-2 py-2 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                          <SortableHeader label="CONTACT NO." field="contact" className="justify-center" />
                        </th>
                        <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] w-14 min-w-[55px] px-2 py-2 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-gray-100 dark:border-[#1A1A1A]">
                          ACTION
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-[#111111]">
                      {filteredAndSorted.map((row, index) => (
                        <tr key={`mobile-assigned-${row.student.id}`} className="group transition-colors hover:bg-gray-50/80 dark:hover:bg-[#151515]">
                          <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 dark:bg-[#111111] dark:group-hover:bg-[#151515] px-2.5 py-2 font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap border-b border-r border-gray-200 dark:border-[#222222] shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono font-bold shrink-0 w-4 text-right">
                                {index + 1}.
                              </span>
                              <span
                                className="block truncate max-w-[115px] text-xs font-bold text-gray-900 dark:text-slate-100 tracking-tight"
                                title={row.student.full_name}
                              >
                                {row.student.full_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-mono font-bold border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                            {row.student.lrn || 'N/A'}
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                            {getAralBadge(row.student.aral_level)}
                          </td>
                          <td className="px-2 py-2 text-left text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-medium uppercase border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                            <span className="block truncate max-w-[125px]" title={row.student.parent_guardian_name || '—'}>
                              {row.student.parent_guardian_name || '—'}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-mono font-bold border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                            {row.student.contact_number || '—'}
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap border-b border-gray-100 dark:border-[#1A1A1A]">
                            <Link
                              to={`/tutor/students/${row.student.id}`}
                              className="inline-flex items-center justify-center text-gray-400 hover:text-[var(--brand)] hover:bg-gray-100 dark:hover:bg-[#1e1e1e] rounded-md transition-colors cursor-pointer p-1.5 touch-manipulation"
                              title="View Profile"
                              aria-label={`View profile for ${row.student.full_name}`}
                            >
                              <UserIcon className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Desktop View (>= 768px): Original full table ── */}
                <div className="hidden md:block overflow-x-auto mobile-scroll-table -mx-3 sm:mx-0 px-3 sm:px-0">
                  <table className="min-w-[720px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm font-normal" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] shadow-xs">
                      <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#151515]">
                        <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] w-12 px-2.5 sm:px-3 py-2 sm:py-2.5 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 whitespace-nowrap">
                          #
                        </th>
                        <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-3 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 whitespace-nowrap">
                          <SortableHeader label="STUDENT" field="name" />
                        </th>
                        <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-3 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 whitespace-nowrap">
                          <SortableHeader label="LRN" field="lrn" />
                        </th>
                        <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-3 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 whitespace-nowrap">
                          <SortableHeader label="PARENT / GUARDIAN" field="parent_guardian" />
                        </th>
                        <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-3 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 whitespace-nowrap">
                          <SortableHeader label="CONTACT NO." field="contact" />
                        </th>
                        <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-3 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 whitespace-nowrap">
                          <SortableHeader label="ARAL LEVEL" field="level" />
                        </th>
                        <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] w-16 px-3 sm:px-4 py-2 sm:py-2.5 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 whitespace-nowrap">
                          ACTION
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#111111]">
                      {filteredAndSorted.map((row, index) => (
                        <tr key={row.student.id} className="group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#151515]">
                          <td className="px-2.5 sm:px-3 py-2 sm:py-2.5 text-center text-xs font-mono font-bold text-gray-400 dark:text-slate-500 whitespace-nowrap">
                            {index + 1}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                            <span
                              className="block truncate font-bold text-gray-900 dark:text-slate-100 text-xs sm:text-[13px] tracking-tight"
                              title={row.student.full_name}
                            >
                              {row.student.full_name}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-mono font-bold">
                            {row.student.lrn || 'N/A'}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-medium uppercase">
                            {row.student.parent_guardian_name || '—'}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-mono font-bold">
                            {row.student.contact_number || '—'}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-2.5 whitespace-nowrap">
                            {getAralBadge(row.student.aral_level)}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-center whitespace-nowrap">
                            <Link
                              to={`/tutor/students/${row.student.id}`}
                              className="inline-flex items-center justify-center text-gray-400 hover:text-[var(--brand)] hover:bg-gray-100 dark:hover:bg-[#1e1e1e] rounded-md transition-colors cursor-pointer p-2 sm:p-1.5 touch-manipulation"
                              title="View Profile"
                              aria-label={`View profile for ${row.student.full_name}`}
                            >
                              <UserIcon className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Enroll Student Modal ───────────────────────────────────── */}
      {shouldRenderEnrollModal &&
        createPortal(
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/50 backdrop-blur-[2px] ${isEnrollModalClosing ? 'modal-backdrop-out' : 'modal-backdrop-in'
              }`}
            style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isEnrolling && !isEnrollModalClosing) {
                setIsEnrollClassDropdownOpen(false);
                setIsEnrollModalOpen(false);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tutor-enroll-student-title"
              className={`w-full max-w-lg rounded-xl border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] shadow-2xl my-auto ${isEnrollModalClosing ? 'modal-pop-out' : 'modal-pop-in'
                }`}
            >
              <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-[#1E1E1E]">
                <h2
                  id="tutor-enroll-student-title"
                  className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-slate-100 tracking-tight"
                >
                  Enroll a student for current selected class
                </h2>
                <button
                  type="button"
                  disabled={isEnrolling}
                  onClick={() => {
                    setIsEnrollClassDropdownOpen(false);
                    setIsEnrollModalOpen(false);
                  }}
                  aria-label="Close modal"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1C1C1C] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEnrollSubmit} className="p-4 sm:p-5 space-y-3.5">
                {enrollError && (
                  <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                    {enrollError}
                  </div>
                )}

                {handledClasses.length > 0 && (
                  <div className={`space-y-1 relative ${isEnrollClassDropdownOpen ? 'z-30' : 'z-10'}`}>
                    <label
                      htmlFor="enroll-class-select"
                      className="block text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300"
                    >
                      Handled Class *
                    </label>
                    <div ref={enrollClassDropdownRef} className="relative w-full max-w-full">
                      <button
                        type="button"
                        id="enroll-class-select"
                        disabled={isEnrolling}
                        onClick={() => setIsEnrollClassDropdownOpen((prev) => !prev)}
                        aria-haspopup="listbox"
                        aria-expanded={isEnrollClassDropdownOpen}
                        aria-label="Select handled class to enroll student into"
                        className="w-full min-h-[40px] flex items-center justify-between rounded-lg border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#141414] px-3.5 py-2 text-xs font-bold text-gray-800 dark:text-slate-100 shadow-2xs focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 focus:outline-none transition-all cursor-pointer text-left disabled:opacity-50"
                      >
                        <span className="truncate pr-2">{activeEnrollClassLabel}</span>
                        <ChevronDown
                          className={`shrink-0 w-4 h-4 text-gray-400 dark:text-slate-500 transition-transform duration-150 ${isEnrollClassDropdownOpen ? 'rotate-180' : ''
                            }`}
                        />
                      </button>

                      {isEnrollClassDropdownOpen && (
                        <div
                          className="absolute left-0 right-0 top-full mt-1.5 z-40 w-full max-w-full rounded-xl border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                        >
                          <div
                            role="listbox"
                            aria-label="Handled Classes"
                            className="max-h-56 overflow-y-auto dropdown-scroll p-1.5 flex flex-col gap-0.5"
                          >
                            {handledClasses.map((cls) => {
                              const isSelected = enrollClassKey === cls.key;
                              return (
                                <button
                                  key={cls.key}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  onClick={() => {
                                    setEnrollClassKey(cls.key);
                                    setIsEnrollClassDropdownOpen(false);
                                  }}
                                  className={`w-full max-w-full flex items-center justify-between text-left rounded-lg px-3 py-2.5 text-xs font-bold transition-colors cursor-pointer ${isSelected
                                    ? 'bg-[var(--brand-light)] text-[var(--brand-dark)] dark:bg-blue-950/60 dark:text-blue-300'
                                    : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                                    }`}
                                  title={cls.label}
                                >
                                  <span className="truncate">{cls.label}</span>
                                  {isSelected && (
                                    <Check className="w-4 h-4 shrink-0 text-[var(--brand)] dark:text-blue-400 ml-2" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label
                      htmlFor="enroll-first-name"
                      className="block text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300"
                    >
                      First Name *
                    </label>
                    <input
                      id="enroll-first-name"
                      type="text"
                      required
                      disabled={isEnrolling}
                      value={enrollFirstName}
                      onChange={(e) => setEnrollFirstName(e.target.value)}
                      placeholder="e.g. JUAN"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#161616] px-3 text-xs font-semibold uppercase text-gray-900 dark:text-slate-100 placeholder:normal-case placeholder:font-normal placeholder:text-gray-400 outline-none focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#111111]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="enroll-middle-name"
                      className="block text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300"
                    >
                      Middle Name{' '}
                      <span className="font-normal normal-case tracking-normal text-gray-400 dark:text-slate-500">
                        (optional)
                      </span>
                    </label>
                    <input
                      id="enroll-middle-name"
                      type="text"
                      disabled={isEnrolling}
                      value={enrollMiddleName}
                      onChange={(e) => setEnrollMiddleName(e.target.value)}
                      placeholder="e.g. SANTOS"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#161616] px-3 text-xs font-semibold uppercase text-gray-900 dark:text-slate-100 placeholder:normal-case placeholder:font-normal placeholder:text-gray-400 outline-none focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#111111]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="enroll-last-name"
                      className="block text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300"
                    >
                      Last Name *
                    </label>
                    <input
                      id="enroll-last-name"
                      type="text"
                      required
                      disabled={isEnrolling}
                      value={enrollLastName}
                      onChange={(e) => setEnrollLastName(e.target.value)}
                      placeholder="e.g. DELA CRUZ"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#161616] px-3 text-xs font-semibold uppercase text-gray-900 dark:text-slate-100 placeholder:normal-case placeholder:font-normal placeholder:text-gray-400 outline-none focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#111111]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="enroll-lrn"
                    className="block text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300"
                  >
                    12-Digit LRN *
                  </label>
                  <input
                    id="enroll-lrn"
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    required
                    disabled={isEnrolling}
                    value={enrollLrn}
                    onChange={(e) => setEnrollLrn(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="Enter 12-digit Learner Reference Number"
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#161616] px-3 text-xs font-mono font-bold text-gray-900 dark:text-slate-100 placeholder:font-sans placeholder:font-normal placeholder:text-gray-400 outline-none focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#111111]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label
                      htmlFor="enroll-guardian"
                      className="block text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300"
                    >
                      Parent / Guardian{' '}
                      <span className="font-normal normal-case tracking-normal text-gray-400 dark:text-slate-500">
                        (optional)
                      </span>
                    </label>
                    <input
                      id="enroll-guardian"
                      type="text"
                      disabled={isEnrolling}
                      value={enrollParentGuardian}
                      onChange={(e) => setEnrollParentGuardian(e.target.value)}
                      placeholder="e.g. MARIA DELA CRUZ"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#161616] px-3 text-xs font-semibold uppercase text-gray-900 dark:text-slate-100 placeholder:normal-case placeholder:font-normal placeholder:text-gray-400 outline-none focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#111111]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="enroll-contact"
                      className="block text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300"
                    >
                      Contact No.{' '}
                      <span className="font-normal normal-case tracking-normal text-gray-400 dark:text-slate-500">
                        (optional)
                      </span>
                    </label>
                    <input
                      id="enroll-contact"
                      type="text"
                      inputMode="numeric"
                      maxLength={11}
                      disabled={isEnrolling}
                      value={enrollContactNumber}
                      onChange={(e) => setEnrollContactNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="e.g. 09123456789"
                      className="w-full h-9 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#161616] px-3 text-xs font-mono font-bold text-gray-900 dark:text-slate-100 placeholder:font-sans placeholder:font-normal placeholder:text-gray-400 outline-none focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#111111]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#1E1E1E]">
                  <button
                    type="button"
                    disabled={isEnrolling}
                    onClick={() => {
                      setIsEnrollClassDropdownOpen(false);
                      setIsEnrollModalOpen(false);
                    }}
                    className="h-9 px-3.5 rounded-lg border border-gray-200 dark:border-[#262626] text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1C1C1C] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isEnrolling}
                    className="h-9 px-4 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isEnrolling ? 'Enrolling...' : 'Enroll Student'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ── Enrollment Toast ───────────────────────────────────────── */}
      {enrollToast &&
        createPortal(
          <aside
            aria-live="polite"
            className="fixed top-5 right-5 z-[9999] max-w-sm w-[calc(100vw-2.5rem)] rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-white dark:bg-[#111111] p-3.5 shadow-xl animate-in fade-in slide-in-from-top-3 duration-200"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Student Enrolled
              </h3>
              <button
                type="button"
                onClick={() => setEnrollToast(null)}
                aria-label="Close notification"
                className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              {enrollToast}
            </p>
          </aside>,
          document.body
        )}
    </div>
  );
};
