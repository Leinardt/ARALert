import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { User, Grade, Attendance } from '../../types';
import { computeStudentRiskRows } from '../../utils/analyticsHelpers';
import { User as UserIcon, Search, ArrowUpDown, Users, ChevronUp, ChevronDown, AlertCircle, History, Calendar, CheckCircle2, Award, Clock } from 'lucide-react';
import { StudentProfileHistoryModal } from '../../components/StudentProfileHistoryModal';
import { TutorCohortFilter } from '../../components/TutorCohortFilter';
import {
  useTutorCohortFilter,
  isStudentInCohort,
} from '../../utils/tutorCohortHelpers';
import type { TutorCohortHistoryData, TutorHistoricalCohortRecord } from '../../types';
import { getActiveSystemSemester } from '../../utils/sessionDescriptionHelpers';

/* ─── Badge helpers (Clean typography without pill container) ─── */
const getAralBadge = (level?: string | null) => {
  const formatted = level ? level.toUpperCase() : 'BASIC';
  return (
    <span className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase">
      {formatted}
    </span>
  );
};

import { buildAvatarColorMap, compareNamesByLastName } from '../../utils/studentFormatters';
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
  if (grade.quarter === 1 || grade.quarter === 2) return '1st';
  if (grade.quarter === 3 || grade.quarter === 4) return '2nd';
  return getSemesterFromDate(grade.date_logged || grade.created_at);
};

/* ─── Component ────────────────────────────────────────────────── */
export const TutorStudentDirectory: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  } = useTutorCohortFilter(user);

  // Cohort View Mode: 'active' | 'past'
  const [cohortViewMode, setCohortViewMode] = useState<'active' | 'past'>('active');
  const [cohortHistory, setCohortHistory] = useState<TutorCohortHistoryData | null>(null);
  const [selectedPastPeriodFilter, setSelectedPastPeriodFilter] = useState<string>('all');
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

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
      const semDisplay = sem === '1st' ? '1st Semester' : sem === '2nd' ? '2nd Semester' : 'Summer';

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

  const effectiveSelectedSchoolYear = useMemo(() => {
    if (schoolYearOptions.some((opt) => opt.key === selectedSchoolYear)) {
      return selectedSchoolYear;
    }
    return activePeriodKey;
  }, [selectedSchoolYear, schoolYearOptions, activePeriodKey]);

  const [filterSy, filterSem] = useMemo(() => {
    if (!effectiveSelectedSchoolYear.includes('|')) {
      return ['', ''];
    }
    return effectiveSelectedSchoolYear.split('|');
  }, [effectiveSelectedSchoolYear]);

  const filteredGrades = useMemo(() => {
    return grades.filter((g) => {
      const gDate = g.date_logged || g.created_at;
      const gSy = getSchoolYearFromDate(gDate);
      if (filterSy && gSy !== filterSy) return false;
      if (filterSem) {
        const gSem = getSemesterFromGrade(g);
        if (gSem !== filterSem) return false;
      }
      return true;
    });
  }, [grades, filterSy, filterSem]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      const aDate = a.date;
      const aSy = getSchoolYearFromDate(aDate);
      if (filterSy && aSy !== filterSy) return false;
      if (filterSem) {
        const aSem = getSemesterFromDate(aDate);
        if (aSem !== filterSem) return false;
      }
      return true;
    });
  }, [attendance, filterSy, filterSem]);

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

  const avatarColor = useMemo(
    () => buildAvatarColorMap(cohortStudents.length > 0 ? cohortStudents : studentRows.map((r) => r.student)),
    [cohortStudents, studentRows]
  );

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
        const q = search.toLowerCase();
        const matchesName = rec.student_name.toLowerCase().includes(q);
        const matchesLrn = rec.lrn ? rec.lrn.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesLrn) return false;
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
        return matchesSearch(search, r.student.full_name, r.student.first_name, r.student.last_name, r.student.lrn, r.student.parent_guardian_name, r.student.contact_number);
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

  const SortableHeader: React.FC<{ label: string; field: string }> = ({ label, field }) => {
    const isActive = sortField === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-gray-700 dark:hover:text-slate-200 select-none cursor-pointer"
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        {isActive ? (
          sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[var(--brand)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--brand)]" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-75" />
        )}
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 skeleton-container" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* Cohort Filter Skeleton */}
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="h-9 w-full rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-9 w-full rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-9 w-full rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-9 w-full rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>

        {/* Directory Table Card skeleton */}
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] animate-pulse skeleton-row-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1.5">
              <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8.5 w-52 rounded-md bg-gray-100 dark:bg-gray-800" />
              <div className="h-8.5 w-28 rounded-md bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>

          <div className="p-6 space-y-3">
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
    <div className="space-y-6 data-loaded-content" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>

      {/* ── Tutor Multi-Cohort Filter (ARAL Level, Subject, Grade - Section) ── */}
      <TutorCohortFilter
        user={user}
        students={students}
        selectedAralLevel={selectedAralLevel}
        onSelectAralLevel={setSelectedAralLevel}
        selectedSubject={selectedSubject}
        onSelectSubject={setSelectedSubject}
        selectedCohort={selectedCohort}
        onSelectCohort={setSelectedCohort}
        allowAll={true}
        title="CURRENT CLASS FOR VIEW"
      />

      {/* ── States ────────────────────────────────────────────────── */}
      {students.length === 0 ? (
        <div className="bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-md bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#1A1A1A] flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-gray-300 dark:text-slate-600" />
          </div>
          <p className="text-base font-bold text-gray-800 dark:text-slate-200">No students assigned yet</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 max-w-sm mx-auto">Ask your administrator to assign student accounts so you can track performance and attendance.</p>
        </div>
      ) : (
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] relative">
          {/* Section header */}
          <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-4 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
            <div className="min-w-0 flex-1 truncate">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-xs sm:text-base uppercase truncate">ASSIGNED STUDENTS DETAILS</h3>
              <p className="mt-0.5 text-[10px] sm:text-xs font-normal text-gray-500 dark:text-slate-400 truncate">
                {filteredAndSorted.length} Student{filteredAndSorted.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
              {/* Auto-updating School Year Dropdown */}
              <div className="relative inline-flex items-center shrink-0">
                <select
                  value={effectiveSelectedSchoolYear}
                  onChange={(e) => setSelectedSchoolYear(e.target.value)}
                  aria-label="Filter by School Year"
                  className="h-7.5 sm:h-8.5 appearance-none rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] pl-2.5 pr-7 sm:pl-3 sm:pr-8 text-[11px] sm:text-xs font-bold text-[var(--brand)] outline-none transition hover:bg-gray-100 dark:hover:bg-[#222222] focus:border-[var(--brand)] cursor-pointer"
                >
                  {schoolYearOptions.map((opt) => (
                    <option key={opt.key} value={opt.key} className="bg-white dark:bg-[#111111] text-gray-800 dark:text-slate-200 font-medium">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 sm:right-2.5 h-3 sm:h-3.5 w-3 sm:w-3.5 text-[var(--brand)] opacity-75" />
              </div>

              <label className="relative flex w-28 xs:w-36 sm:w-52 items-center shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search student..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search assigned students"
                  className="h-7.5 sm:h-8.5 w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] pl-8 pr-2.5 text-[11px] sm:text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#111111]"
                />
              </label>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6">
            {filteredAndSorted.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Users className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No matching students found</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {search.trim() ? 'Try a different student name or LRN' : 'No students found in this cohort'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto mobile-scroll-table -mx-2 px-2">
                <table className="min-w-[680px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm font-normal" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  <thead>
                    <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#151515]">
                      <th className="w-12 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        #
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <SortableHeader label="STUDENT" field="name" />
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <SortableHeader label="LRN" field="lrn" />
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <SortableHeader label="PARENT / GUARDIAN" field="parent_guardian" />
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <SortableHeader label="CONTACT NO." field="contact" />
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <SortableHeader label="ARAL LEVEL" field="level" />
                      </th>
                      <th className="w-16 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        ACTION
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#111111]">
                    {filteredAndSorted.map((row, index) => (
                      <tr key={row.student.id} className="group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#151515]">
                        <td className="px-3 py-2.5 text-center text-xs font-normal text-gray-400 whitespace-nowrap">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${avatarColor(row.student.full_name || '')}`}>
                              <UserIcon className="w-3 h-3" />
                            </div>
                            <span className="truncate font-semibold text-gray-800 dark:text-slate-100">{row.student.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs font-normal font-mono">
                          {row.student.lrn || 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-normal uppercase">
                          {row.student.parent_guardian_name || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-mono">
                          {row.student.contact_number || '—'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {getAralBadge(row.student.aral_level)}
                        </td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          <Link
                            to={`/tutor/students/${row.student.id}`}
                            className="inline-flex items-center justify-center text-gray-400 hover:text-[var(--brand)] transition-colors cursor-pointer p-1"
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
            )}
          </div>
        </div>
      )}
    </div>
  );
};
