import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ChevronUp, ChevronDown, ChevronRight, ArrowUpDown, Users, AlertCircle, Edit, GraduationCap, CheckCircle2
} from 'lucide-react';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import { SchoolYear, User, Grade, Attendance } from '../../types';
import { TableSkeleton } from '../../components/SkeletonLoader';
import { buildTutorClassSections } from '../../utils/tutorCohortHelpers';
import { useAuth } from '../../hooks/useAuth';

/* ─── Helper: Normalize ARAL Level ─────────────────────────────────── */
const normalizeAralLevel = (val?: string | null): 'BASIC' | 'PLUS' | 'SUMMER' => {
  if (!val) return 'BASIC';
  const clean = val.trim().toLowerCase();
  if (clean.includes('summer')) return 'SUMMER';
  if (clean.includes('plus')) return 'PLUS';
  return 'BASIC';
};

/* ─── Helper: Extract Grade and Section ────────────────────────────── */
const getGradeAndSection = (gradeLevel?: string | null, fallbackSection?: string | null) => {
  if (!gradeLevel) return { grade: 'Grade 7', section: fallbackSection || 'HYACINTH' };
  if (gradeLevel.includes(' - ')) {
    const parts = gradeLevel.split(' - ');
    const g = parts[0].trim();
    const s = parts.slice(1).join(' - ').trim();
    return {
      grade: g.toLowerCase().startsWith('grade') ? g : `Grade ${g}`,
      section: s || fallbackSection || 'HYACINTH',
    };
  }
  const cleanG = gradeLevel.trim();
  return {
    grade: cleanG.toLowerCase().startsWith('grade') ? cleanG : `Grade ${cleanG}`,
    section: fallbackSection || 'HYACINTH',
  };
};

interface StudentArchiveMetric {
  id: string;
  name: string;
  lrn: string;
  aralLevel: 'BASIC' | 'PLUS' | 'SUMMER';
  attendanceRate: number;
  avgScore: number;
  assessmentScoreStr: string;
  compositeScore: number;
  status: 'MOVED_UP' | 'GRADUATED' | 'RETAINED' | 'PENDING';
  rawStudent?: User;
}

interface TutorArchiveRow {
  id: string;
  tutorName: string;
  gradeLevel: string;
  section: string;
  subject: string;
  aralLevel: 'BASIC' | 'PLUS' | 'SUMMER';
  totalStudents: number;
  movedUpCount: number;
  graduatedCount: number;
  retainedCount: number;
  pendingCount: number;
  students: StudentArchiveMetric[];
  tutorUser?: User;
}

export const AssessmentsArchive: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = Boolean(currentUser?.is_superuser);

  const [archivedYears, setArchivedYears] = useState<SchoolYear[]>([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2026-2027');
  const [activeTab, setActiveTab] = useState<'mosy' | 'eosy' | 'summer'>('mosy');

  const [tutors, setTutors] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  const [expandedTutorIds, setExpandedTutorIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState<string>('');
  const [sortField, setSortField] = useState<string>('tutorName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial Load of Available School Years
  useEffect(() => {
    loadSchoolYears();
  }, []);

  const loadSchoolYears = async () => {
    try {
      const years = await academicService.getArchivedSchoolYears();
      if (years && years.length > 0) {
        setArchivedYears(years);
        const activeYear = years.find((y) => y.is_active)?.school_year || years[0].school_year;
        setSelectedSchoolYear(activeYear);
      } else {
        setSelectedSchoolYear('2026-2027');
      }
    } catch (err: any) {
      console.error('Failed to load archived school years:', err);
      setSelectedSchoolYear('2026-2027');
    }
  };

  // 2. Auto-fetch data whenever selectedSchoolYear or activeTab changes
  useEffect(() => {
    if (selectedSchoolYear) {
      fetchArchiveData();
    }
  }, [selectedSchoolYear, activeTab]);

  const fetchArchiveData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tutorsList, studentsList, gradesList, attendanceList] = await Promise.all([
        userService.getAllUsers({ role: 'tutor' }).catch(() => [] as User[]),
        userService.getAllUsers({ role: 'student', include_graduated: true }).catch(() => [] as User[]),
        academicService.getGrades().catch(() => [] as Grade[]),
        academicService.getAttendanceHistory().catch(() => [] as Attendance[]),
      ]);

      setTutors(tutorsList);
      setStudents(studentsList);
      setGrades(gradesList);
      setAttendance(attendanceList);
    } catch (err: any) {
      console.error('Failed to load archive data:', err);
      setError('Failed to load assessment archive records.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Toggle Expanded Tutor
  const toggleTutorExpand = (tutorId: string) => {
    setExpandedTutorIds((prev) => {
      const next = new Set(prev);
      if (next.has(tutorId)) {
        next.delete(tutorId);
      } else {
        next.add(tutorId);
      }
      return next;
    });
  };

  // 4. Handle Column Sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortableHeader: React.FC<{ label: string; field: string; align?: 'left' | 'center' | 'right' }> = ({
    label,
    field,
    align = 'left',
  }) => {
    const isActive = sortField === field;

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
          sortOrder === 'asc' ? (
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

  // 5. Aggregate Tutors & Students metrics for selected period
  const tutorArchiveRows = useMemo<TutorArchiveRow[]>(() => {
    return tutors.map((tutor) => {
      const tutorStudents = students.filter((s) => {
        if (String(s.assigned_tutor) === String(tutor.id)) return true;
        // Fallback: Check if student has a logged grade matching this tutor
        return grades.some((g) => {
          const sid = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
          const tid = typeof g.tutor === 'object' && g.tutor !== null ? (g.tutor as any).id : (g as any).tutor_id || (g as any).tutor;
          return String(sid) === String(s.id) && String(tid) === String(tutor.id);
        });
      });
      const { grade, section } = getGradeAndSection(tutor.grade_level, tutor.section);

      let movedUpCount = 0;
      let graduatedCount = 0;
      let retainedCount = 0;
      let pendingCount = 0;

      const studentMetrics: StudentArchiveMetric[] = tutorStudents.map((st) => {
        // Filter student grades
        const sGrades = grades.filter((g) => {
          const sid = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
          return String(sid) === String(st.id);
        });

        // Filter student attendance
        const sAtt = attendance.filter((a) => {
          const uid = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
          return String(uid) === String(st.id);
        });

        // Compute Attendance Rate
        let attendanceRate = 100.0;
        if (sAtt.length > 0) {
          const presentCount = sAtt.filter((a) => a.status === 'present').length;
          attendanceRate = Math.round((presentCount / sAtt.length) * 1000) / 10;
        }

        // Compute Average Score
        let avgScore = 85.0;
        if (sGrades.length > 0) {
          const totalPct = sGrades.reduce((acc, g) => {
            const ts = Number(g.total_score) || 100;
            const sc = Number(g.score) || 0;
            return acc + (sc / ts) * 100;
          }, 0);
          avgScore = Math.round((totalPct / sGrades.length) * 10) / 10;
        }

        // Compute Composite Score (40% Attendance + 60% Academic Performance)
        const compositeScore = Math.round(((attendanceRate * 0.4) + (avgScore * 0.6)) * 10) / 10;

        // Determine Status & Assessment Score
        // Check if student has explicit evaluation record
        const evalGrade = sGrades.find((g) => {
          const subj = (g.subject || '').toUpperCase();
          const rem = (g.remarks || '').toUpperCase();
          if (activeTab === 'mosy') return subj.includes('MOSY') || rem.includes('MOSY');
          if (activeTab === 'eosy') return subj.includes('EOSY') || rem.includes('EOSY');
          return subj.includes('SUMMER') || rem.includes('SUMMER');
        });

        let assessmentScoreStr = '—';
        let status: 'MOVED_UP' | 'GRADUATED' | 'RETAINED' | 'PENDING' = 'PENDING';

        const rawLevel = (st.aral_level || '').toLowerCase();
        const tutorLevel = (tutor.tutor_type || tutor.aral_level || '').toLowerCase();
        const isPlusCohort = rawLevel === 'plus' || rawLevel === 'graduated' || tutorLevel === 'plus';

        if (evalGrade && evalGrade.remarks?.toLowerCase() !== 'not taken') {
          const ts = Number(evalGrade.total_score) || 40;
          const sc = Number(evalGrade.score) || 0;
          const pct = Math.round((sc / ts) * 1000) / 10;
          assessmentScoreStr = `${pct.toFixed(1)}%`;
          const isPassed = ts === 40 ? sc >= 28 : (sc / ts) >= 0.7;

          if (activeTab === 'mosy') {
            // In MOSY (Q1 & Q2): Passed students move up an ARAL level (Basic -> Plus).
            // Retained students remain in their ARAL level (they failed but we don't call it fail).
            status = isPassed ? 'MOVED_UP' : 'RETAINED';
          } else if (activeTab === 'eosy') {
            // In EOSY (Q3 & Q4): Plus students who pass graduate!
            // Basic students who pass move up an ARAL level (Basic -> Plus).
            // Retained students keep their ARAL level.
            if (isPassed || rawLevel === 'graduated') {
              status = isPlusCohort ? 'GRADUATED' : 'MOVED_UP';
            } else {
              status = 'RETAINED';
            }
          } else {
            // In SUMMER (Midyear):
            // Students who pass graduate!
            // Retained students keep their ARAL level.
            if (isPassed || rawLevel === 'graduated') {
              status = 'GRADUATED';
            } else {
              status = 'RETAINED';
            }
          }
        } else if (rawLevel === 'graduated' && (activeTab === 'eosy' || activeTab === 'summer')) {
          status = 'GRADUATED';
          assessmentScoreStr = 'Passed';
        }

        if (status === 'GRADUATED') graduatedCount++;
        else if (status === 'MOVED_UP') movedUpCount++;
        else if (status === 'RETAINED') retainedCount++;
        else pendingCount++;

        return {
          id: String(st.id),
          name: st.full_name || `${st.first_name} ${st.last_name}`,
          lrn: st.lrn || '—',
          aralLevel: normalizeAralLevel(st.aral_level),
          attendanceRate,
          avgScore,
          assessmentScoreStr,
          compositeScore,
          status,
          rawStudent: st,
        };
      });

      return {
        id: String(tutor.id),
        tutorName: tutor.full_name || `${tutor.first_name} ${tutor.last_name}`,
        gradeLevel: grade,
        section,
        subject: tutor.subject === 'Reading' ? 'Filipino' : (tutor.subject || 'Filipino'),
        aralLevel: normalizeAralLevel(tutor.tutor_type || tutor.aral_level),
        totalStudents: tutorStudents.length,
        movedUpCount,
        graduatedCount,
        retainedCount,
        pendingCount,
        students: studentMetrics,
        tutorUser: tutor,
      };
    });
  }, [tutors, students, grades, attendance, activeTab]);

  // 6. Filter and Sort Rows
  const sortedAndFilteredRows = useMemo(() => {
    let list = [...tutorArchiveRows];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.tutorName.toLowerCase().includes(q) ||
          r.section.toLowerCase().includes(q) ||
          r.gradeLevel.toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q) ||
          r.aralLevel.toLowerCase().includes(q) ||
          r.students.some(
            (st) =>
              st.name.toLowerCase().includes(q) ||
              st.lrn.toLowerCase().includes(q) ||
              st.status.toLowerCase().includes(q) ||
              (q === 'graduated' && st.status === 'GRADUATED') ||
              (q.includes('move') && st.status === 'MOVED_UP') ||
              (q.includes('retain') && st.status === 'RETAINED')
          )
      );
    }

    list.sort((a, b) => {
      let aVal = (a as any)[sortField] || '';
      let bVal = (b as any)[sortField] || '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [tutorArchiveRows, search, sortField, sortOrder]);

  // Cohort totals across all tutors for the current phase
  const cohortTotals = useMemo(() => {
    let totalStudents = 0;
    let movedUpCount = 0;
    let graduatedCount = 0;
    let retainedCount = 0;
    let pendingCount = 0;

    for (const r of sortedAndFilteredRows) {
      totalStudents += r.totalStudents;
      movedUpCount += r.movedUpCount;
      graduatedCount += r.graduatedCount;
      retainedCount += r.retainedCount;
      pendingCount += r.pendingCount;
    }

    return { totalStudents, movedUpCount, graduatedCount, retainedCount, pendingCount };
  }, [sortedAndFilteredRows]);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Top Bar: School Year & Period Switcher Tabs Only ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* School Year Dropdown / Selector */}
          <div className="flex items-center gap-2">
            <select
              value={selectedSchoolYear}
              onChange={(e) => setSelectedSchoolYear(e.target.value)}
              className="font-bold text-sm sm:text-base bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1 text-slate-900 dark:text-white shadow-2xs focus:outline-none cursor-pointer"
            >
              {archivedYears.length === 0 ? (
                <option value="2026-2027">SY 2026–2027</option>
              ) : (
                archivedYears.map((ay) => (
                  <option key={ay.id || ay.school_year} value={ay.school_year}>
                    SY {ay.school_year}
                  </option>
                ))
              )}
            </select>
          </div>

          <span className="text-slate-300 dark:text-zinc-700 font-bold text-base select-none">&bull;</span>

          {/* Phase Switcher Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('mosy')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'mosy'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>MOSY (Q1 & Q2)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('eosy')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'eosy'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>EOSY (Q3 & Q4)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('summer')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'summer'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>SUMMER (Midyear)</span>
            </button>

          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main Content / Loading ── */}
      {isLoading ? (
        <div className="space-y-4">
          <TableSkeleton rows={8} cols={7} />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
          {/* Table Header / Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                ARCHIVED TUTOR EVALUATION ROSTER ({sortedAndFilteredRows.length})
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                <span className="text-slate-500 dark:text-zinc-400 font-medium">
                  {cohortTotals.totalStudents} Total Students
                </span>
                {cohortTotals.graduatedCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--brand)]">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {cohortTotals.graduatedCount} Graduated
                  </span>
                )}
                {cohortTotals.movedUpCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {cohortTotals.movedUpCount} Moved Up ARAL Level
                  </span>
                )}
                {cohortTotals.retainedCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                    {cohortTotals.retainedCount} Retained ARAL Level
                  </span>
                )}
              </div>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search tutor, student, LRN, section..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[var(--brand)]"
              />
            </div>
          </div>

          {sortedAndFilteredRows.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 dark:text-zinc-400 bg-white dark:bg-[#0A0A0A]">
              {tutorArchiveRows.length === 0 ? 'No tutor records found for this period.' : 'No tutors matching search filter.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-left text-sm font-normal">
                <thead>
                  <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                    <th className="px-4 py-2.5 text-left">
                      <SortableHeader label="TUTOR NAME" field="tutorName" />
                    </th>
                    <th className="px-4 py-2.5 text-center">
                      <SortableHeader label="TOTAL STUDENTS" field="totalStudents" align="center" />
                    </th>
                    <th className="px-4 py-2.5 text-center">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                        OUTCOME SUMMARY
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                  {sortedAndFilteredRows.map((row) => {
                    const isExpanded = expandedTutorIds.has(row.id);

                    return (
                      <React.Fragment key={row.id}>
                        {/* Tutor Main Row */}
                        <tr
                          onClick={() => toggleTutorExpand(row.id)}
                          className={`group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors cursor-pointer select-none ${
                            isExpanded
                              ? 'bg-slate-50/80 dark:bg-white/[0.04]'
                              : 'hover:bg-gray-50/80 dark:hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[var(--brand)] shrink-0 transition-transform" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:text-zinc-500 shrink-0 transition-transform" />
                              )}
                              <span>{row.tutorName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-medium">
                            {row.totalStudents} Students
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {row.graduatedCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-[var(--brand-light)] text-[var(--brand)] border-[var(--brand-border)] dark:bg-[var(--brand)]/15 dark:text-blue-300 dark:border-[var(--brand)]/50">
                                  <GraduationCap className="w-3 h-3" />
                                  {row.graduatedCount} Graduated
                                </span>
                              )}
                              {row.movedUpCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60">
                                  {row.movedUpCount} Moved Up
                                </span>
                              )}
                              {row.retainedCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/60">
                                  {row.retainedCount} Retained
                                </span>
                              )}
                              {row.pendingCount > 0 && row.graduatedCount === 0 && row.movedUpCount === 0 && row.retainedCount === 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                                  Pending Evaluation
                                </span>
                              )}
                              {row.totalStudents === 0 && (
                                <span className="text-xs text-slate-400">No Students</span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Sub-Table: Classes and Students Handled by this Tutor */}
                        {isExpanded && (
                          <tr className="bg-slate-50/40 dark:bg-zinc-950/40">
                            <td colSpan={3} className="p-0">
                              <div className="p-4 sm:p-5 border-y border-slate-200 dark:border-zinc-800 space-y-5">
                                {row.students.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-500 dark:text-zinc-400 bg-white dark:bg-[#0A0A0A] rounded-xl border border-slate-200 dark:border-zinc-800">
                                    No students assigned to this tutor for this school year.
                                  </div>
                                ) : (
                                  (() => {
                                    const allSections = buildTutorClassSections(row.tutorUser, row.students);
                                    const activeSections = allSections.filter((cls) => cls.students.length > 0);
                                    const displaySections = activeSections.length > 0 ? activeSections : allSections;

                                    return displaySections.map((cls) => (
                                      <div key={cls.key} className="space-y-2.5">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wide">
                                            {cls.label} ({cls.students.length} Students)
                                          </span>
                                        </div>

                                        {cls.students.length === 0 ? (
                                          <div className="p-4 text-center text-xs text-slate-500 dark:text-zinc-400 bg-white dark:bg-[#0A0A0A] rounded-xl border border-slate-200 dark:border-zinc-800">
                                            No students assigned to this class for this semester.
                                          </div>
                                        ) : (
                                          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A]">
                                            <table className="w-full text-left text-xs divide-y divide-gray-100 dark:divide-[#1A1A1A]">
                                              <thead className="bg-gray-50 dark:bg-[#111111] divide-x divide-gray-100 dark:divide-[#1A1A1A] font-bold text-[11px] uppercase tracking-wider text-gray-400 dark:text-slate-400">
                                                <tr>
                                                  <th className="w-10 px-3 py-2 text-center">#</th>
                                                  <th className="px-3 py-2 text-left">STUDENT NAME</th>
                                                  <th className="px-3 py-2 text-left">LRN</th>
                                                  <th className="px-3 py-2 text-center">FINAL AVG ATTENDANCE RATE</th>
                                                  <th className="px-3 py-2 text-center">FINAL AVG SCORE</th>
                                                  <th className="px-3 py-2 text-center">FINAL AVG COMPOSITE</th>
                                                  <th className="px-3 py-2 text-center">
                                                    {activeTab === 'mosy' ? 'MOSY ASSESSMENT' : activeTab === 'eosy' ? 'EOSY ASSESSMENT' : 'SUMMER ASSESSMENT'}
                                                  </th>
                                                  <th className="px-3 py-2 text-center">STATUS</th>
                                                  <th className="px-3 py-2 text-center">ACTION</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                                                {cls.students.map((st, idx) => (
                                                  <tr
                                                    key={st.id}
                                                    className="divide-x divide-gray-100 dark:divide-[#1A1A1A] hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors"
                                                  >
                                                    <td className="px-3 py-2.5 text-center text-slate-400 font-medium">{idx + 1}</td>
                                                    <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                      {st.name}
                                                    </td>
                                                    <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                                                      {st.lrn}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center font-medium text-slate-800 dark:text-slate-200">
                                                      {st.attendanceRate.toFixed(1)}%
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center font-medium text-slate-800 dark:text-slate-200">
                                                      {st.avgScore.toFixed(1)}%
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center font-bold text-slate-900 dark:text-white">
                                                      {st.compositeScore.toFixed(1)}%
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center font-medium text-slate-800 dark:text-slate-200">
                                                      {st.assessmentScoreStr}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                      {st.status === 'GRADUATED' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-[var(--brand-light)] text-[var(--brand)] border-[var(--brand-border)] dark:bg-[var(--brand)]/15 dark:text-blue-300 dark:border-[var(--brand)]/50">
                                                          <GraduationCap className="w-3.5 h-3.5" />
                                                          Graduated
                                                        </span>
                                                      ) : st.status === 'MOVED_UP' ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60">
                                                          Moved Up ARAL Level
                                                        </span>
                                                      ) : st.status === 'RETAINED' ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/60">
                                                          Retained ARAL Level
                                                        </span>
                                                      ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                                                          Pending Evaluation
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                      <Link
                                                        to={`${isSuperAdmin ? '/superadmin' : '/admin'}/students/edit/${st.id}`}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:text-[var(--brand)] hover:border-[var(--brand)] transition shadow-2xs"
                                                        title="Edit / Revert Level"
                                                      >
                                                        <Edit className="w-3 h-3" />
                                                        <span>Edit</span>
                                                      </Link>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    ));
                                  })()
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default AssessmentsArchive;
