import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ChevronUp, ChevronDown, ChevronRight, ArrowUpDown, Users, AlertCircle, Edit, GraduationCap, CheckCircle2
} from 'lucide-react';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import { SchoolYear, User, Grade, Attendance } from '../../types';
import { TableSkeleton } from '../../components/SkeletonLoader';
import { AnimatedCounter } from '../../components/AnimatedCounter';
import { buildTutorClassSections } from '../../utils/tutorCohortHelpers';
import { useAuth } from '../../hooks/useAuth';
import { isAssessmentWindowOpen } from '../../utils/sessionDescriptionHelpers';
import { matchesSearch } from '../../utils/searchHelpers';

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

type ArchiveStudentSortField =
  | 'name'
  | 'lrn'
  | 'attendanceRate'
  | 'avgScore'
  | 'compositeScore'
  | 'assessmentScore'
  | 'status';

interface ArchiveClassSectionTableProps {
  cls: {
    key: string;
    label: string;
    students: StudentArchiveMetric[];
  };
  activeTab: 'mosy' | 'eosy' | 'summer';
  isSuperAdmin: boolean;
  isWindowOpen: boolean;
}

const ArchiveClassSectionTable: React.FC<ArchiveClassSectionTableProps> = ({
  cls,
  activeTab,
  isSuperAdmin,
  isWindowOpen,
}) => {
  const [sortField, setSortField] = useState<ArchiveStudentSortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: ArchiveStudentSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedStudents = useMemo(() => {
    const list = [...cls.students];
    list.sort((a, b) => {
      if (sortField === 'name') {
        const cmp = (a.name || '').localeCompare(b.name || '');
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'lrn') {
        const cmp = (a.lrn || '').localeCompare(b.lrn || '', undefined, { numeric: true });
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      if (sortField === 'attendanceRate') {
        const diff = (a.attendanceRate ?? 0) - (b.attendanceRate ?? 0);
        if (diff !== 0) return sortOrder === 'asc' ? diff : -diff;
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortField === 'avgScore') {
        const diff = (a.avgScore ?? 0) - (b.avgScore ?? 0);
        if (diff !== 0) return sortOrder === 'asc' ? diff : -diff;
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortField === 'compositeScore') {
        const diff = (a.compositeScore ?? 0) - (b.compositeScore ?? 0);
        if (diff !== 0) return sortOrder === 'asc' ? diff : -diff;
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortField === 'assessmentScore') {
        const parseScore = (str: string) => {
          if (!str || str === '—' || str.toLowerCase().includes('not') || str.toLowerCase().includes('pending')) {
            return -1;
          }
          if (str.toLowerCase() === 'passed') return 100;
          const num = parseFloat(str.replace('%', ''));
          return isNaN(num) ? -1 : num;
        };
        const scoreA = parseScore(a.assessmentScoreStr);
        const scoreB = parseScore(b.assessmentScoreStr);
        if (scoreA !== scoreB) {
          return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
        }
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortField === 'status') {
        const getStatusRank = (st: string) => {
          const s = (st || '').toUpperCase();
          if (s === 'GRADUATED') return 4;
          if (s === 'MOVED_UP') return 3;
          if (s === 'RETAINED') return 2;
          return 1;
        };
        const rankA = getStatusRank(a.status);
        const rankB = getStatusRank(b.status);
        if (rankA !== rankB) {
          return sortOrder === 'asc' ? rankA - rankB : rankB - rankA;
        }
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });
    return list;
  }, [cls.students, sortField, sortOrder]);

  const SortableSubHeader: React.FC<{
    label: string;
    field: ArchiveStudentSortField;
    align?: 'left' | 'center' | 'right';
  }> = ({ label, field, align = 'left' }) => {
    const isActive = sortField === field;

    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap ${
          align === 'center'
            ? 'justify-center text-center'
            : align === 'right'
            ? 'justify-end text-right'
            : 'justify-start text-left'
        } transition-colors hover:text-gray-700 dark:hover:text-slate-200 select-none text-[11px] font-bold uppercase tracking-wider ${
          isActive ? 'text-gray-700 dark:text-slate-200' : 'text-gray-400 dark:text-slate-400'
        } cursor-pointer`}
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        {isActive ? (
          sortOrder === 'asc' ? (
            <ChevronUp className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 shrink-0" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-2.5">
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
        <>
          {/* Mobile View (< 768px): Pinned Sticky Student Name Column */}
          <div className="md:hidden overflow-x-auto table-scroll-container mobile-scroll-table rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A]">
            <table className="min-w-[640px] w-full text-left text-xs border-separate border-spacing-0">
              <thead className="bg-gray-50 dark:bg-[#111111] font-bold text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-400">
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 dark:bg-[#111111] px-2.5 py-2 text-left whitespace-nowrap min-w-[130px] border-b border-r border-gray-200 dark:border-[#1A1A1A] shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                    <SortableSubHeader label="STUDENT NAME" field="name" align="left" />
                  </th>
                  <th className="px-2.5 py-2 text-left whitespace-nowrap min-w-[90px] border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader label="LRN" field="lrn" align="left" />
                  </th>
                  <th className="px-2 py-2 text-center whitespace-nowrap min-w-[70px] border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader label="ATTENDANCE" field="attendanceRate" align="center" />
                  </th>
                  <th className="px-2 py-2 text-center whitespace-nowrap min-w-[65px] border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader label="AVG SCORE" field="avgScore" align="center" />
                  </th>
                  <th className="px-2 py-2 text-center whitespace-nowrap min-w-[75px] border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader label="COMPOSITE" field="compositeScore" align="center" />
                  </th>
                  <th className="px-2 py-2 text-center whitespace-nowrap min-w-[85px] border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader
                      label={activeTab === 'mosy' ? 'MOSY' : activeTab === 'eosy' ? 'EOSY' : 'SUMMER'}
                      field="assessmentScore"
                      align="center"
                    />
                  </th>
                  <th className="px-2.5 py-2 text-center whitespace-nowrap min-w-[100px] border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader label="STATUS" field="status" align="center" />
                  </th>
                  <th className="px-2.5 py-2 text-center whitespace-nowrap min-w-[60px] border-b border-gray-100 dark:border-[#1A1A1A]">
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-[#0A0A0A]">
                {sortedStudents.map((st, idx) => (
                  <tr
                    key={st.id}
                    className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="sticky left-0 z-10 bg-white dark:bg-[#0A0A0A] px-2.5 py-2 font-semibold text-slate-900 dark:text-white whitespace-nowrap border-b border-r border-gray-200 dark:border-[#1A1A1A] shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-slate-400 font-mono w-4 shrink-0 text-center">{idx + 1}</span>
                        <span className="truncate max-w-[110px]">{st.name}</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-2 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                      {st.lrn}
                    </td>
                    <td className="px-2 py-2 text-center font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                      {st.attendanceRate.toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 text-center font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                      {st.avgScore.toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-slate-900 dark:text-white whitespace-nowrap border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                      {st.compositeScore.toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 text-center font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                      {st.assessmentScoreStr}
                    </td>
                    <td className="px-2.5 py-2 text-center whitespace-nowrap border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                      {st.status === 'GRADUATED' ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-[var(--brand-light)] text-[var(--brand)] border-[var(--brand-border)] dark:bg-[var(--brand)]/15 dark:text-blue-300 dark:border-[var(--brand)]/50">
                          <GraduationCap className="w-3 h-3" />
                          Graduated
                        </span>
                      ) : st.status === 'MOVED_UP' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60">
                          Moved Up
                        </span>
                      ) : st.status === 'RETAINED' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/60">
                          Retained
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                          {isWindowOpen ? 'Pending' : 'Closed'}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center whitespace-nowrap border-b border-gray-100 dark:border-[#1A1A1A]">
                      <Link
                        to={`${isSuperAdmin ? '/superadmin' : '/admin'}/students/edit/${st.id}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:text-[var(--brand)] hover:border-[var(--brand)] transition shadow-2xs"
                        title="Edit / Revert Level"
                      >
                        <Edit className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Desktop View (>= 768px): Original Full Table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A]">
            <table className="w-full text-left text-xs divide-y divide-gray-100 dark:divide-[#1A1A1A]">
              <thead className="bg-gray-50 dark:bg-[#111111] divide-x divide-gray-100 dark:divide-[#1A1A1A] font-bold text-[11px] uppercase tracking-wider text-gray-400 dark:text-slate-400">
                <tr>
                  <th className="w-10 px-3 py-2 text-center whitespace-nowrap">#</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">
                    <SortableSubHeader label="STUDENT NAME" field="name" align="left" />
                  </th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">
                    <SortableSubHeader label="LRN" field="lrn" align="left" />
                  </th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">
                    <SortableSubHeader label="FINAL AVG ATTENDANCE RATE" field="attendanceRate" align="center" />
                  </th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">
                    <SortableSubHeader label="FINAL AVG SCORE RATE" field="avgScore" align="center" />
                  </th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">
                    <SortableSubHeader label="FINAL AVG COMPOSITE RATING" field="compositeScore" align="center" />
                  </th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">
                    <SortableSubHeader
                      label={activeTab === 'mosy' ? 'MOSY ASSESSMENT' : activeTab === 'eosy' ? 'EOSY ASSESSMENT' : 'SUMMER ASSESSMENT'}
                      field="assessmentScore"
                      align="center"
                    />
                  </th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">
                    <SortableSubHeader label="STATUS" field="status" align="center" />
                  </th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                {sortedStudents.map((st, idx) => (
                  <tr
                    key={st.id}
                    className="divide-x divide-gray-100 dark:divide-[#1A1A1A] hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-3 py-2.5 text-center text-slate-400 font-medium whitespace-nowrap">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {st.name}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {st.lrn}
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {st.attendanceRate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {st.avgScore.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {st.compositeScore.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
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
                          {isWindowOpen ? 'Pending Evaluation' : 'Closed'}
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
        </>
      )}
    </div>
  );
};

interface SchoolYearOption {
  value: string;
  label: string;
}

const SchoolYearDropdown: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: SchoolYearOption[];
}> = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuAlign, setMenuAlign] = useState<'left' | 'right'>('left');

  const selectedOpt = options.find((o) => o.value === value) || options[0];

  const handleToggle = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const screenW = window.innerWidth || document.documentElement.clientWidth;
      if (rect.left + 220 > screenW - 16) {
        setMenuAlign('right');
      } else {
        setMenuAlign('left');
      }
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-flex items-center shrink-0 ${isOpen ? 'z-50' : 'z-20'}`}>
      <button
        type="button"
        aria-label="Select School Year"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="flex h-8 sm:h-9 items-center justify-between gap-1.5 sm:gap-2 rounded-xl border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#111111] px-2.5 sm:px-3 text-xs sm:text-sm font-bold text-gray-800 dark:text-slate-100 transition hover:border-gray-300 dark:hover:border-[#262626] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 cursor-pointer shadow-2xs"
      >
        <span>{selectedOpt?.label || `SY ${value}`}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-zinc-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            menuAlign === 'right' ? 'right-0' : 'left-0'
          } top-full z-50 mt-1 max-h-60 w-44 sm:w-48 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] p-1.5 shadow-xl`}
          role="listbox"
          aria-label="Select School Year"
        >
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`block w-full truncate rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase transition cursor-pointer ${
                  isSel
                    ? 'bg-[var(--brand)] text-white'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const AssessmentsArchive: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = Boolean(currentUser?.is_superuser);

  const [archivedYears, setArchivedYears] = useState<SchoolYear[]>([]);
  const [currentSchoolYear, setCurrentSchoolYear] = useState<SchoolYear | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2026-2027');
  const [activeTab, setActiveTab] = useState<'mosy' | 'eosy' | 'summer'>('mosy');

  const schoolYearOptions = useMemo<SchoolYearOption[]>(() => {
    if (archivedYears.length === 0) {
      return [{ value: '2026-2027', label: 'SY 2026–2027' }];
    }
    return archivedYears.map((ay) => ({
      value: ay.school_year,
      label: `SY ${ay.school_year}`,
    }));
  }, [archivedYears]);

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

  const [windowState, setWindowState] = useState<boolean>(() => isAssessmentWindowOpen());

  useEffect(() => {
    const handleWindowChange = (e: any) => {
      if (typeof e?.detail?.isOpen === 'boolean') {
        setWindowState(e.detail.isOpen);
      } else {
        setWindowState(isAssessmentWindowOpen());
      }
    };
    window.addEventListener('assessment_window_changed', handleWindowChange);
    return () => window.removeEventListener('assessment_window_changed', handleWindowChange);
  }, []);

  // Concluded tabs for selected school year: past years have all 3 tabs; active year only has concluded semesters
  type ArchiveTab = 'mosy' | 'eosy' | 'summer';

  const concludedTabsForSelectedYear = useMemo<ArchiveTab[]>(() => {
    const isSelectedYearActive =
      (selectedSchoolYear === currentSchoolYear?.school_year && Boolean(currentSchoolYear?.is_active)) ||
      Boolean(archivedYears.find((y) => y.school_year === selectedSchoolYear)?.is_active);

    if (!isSelectedYearActive) {
      if (!selectedSchoolYear) return [];
      return ['mosy', 'eosy', 'summer'];
    }

    const curSem = currentSchoolYear?.current_semester || '2nd';
    if (curSem === '2nd') {
      return ['mosy'];
    }
    if (curSem === 'summer') {
      return ['mosy', 'eosy'];
    }
    return [];
  }, [archivedYears, selectedSchoolYear, currentSchoolYear]);

  // Ensure active tab is always a concluded tab
  useEffect(() => {
    if (concludedTabsForSelectedYear.length > 0 && !concludedTabsForSelectedYear.includes(activeTab)) {
      setActiveTab(concludedTabsForSelectedYear[0]);
    }
  }, [concludedTabsForSelectedYear, activeTab]);

  const isWindowOpen = useMemo(() => {
    // Concluded historical archives: evaluation windows are closed
    return false;
  }, []);

  // 1. Initial Load of Available School Years with Concluded Semesters
  useEffect(() => {
    loadSchoolYears();
  }, []);

  const loadSchoolYears = async () => {
    try {
      const [years, curSY] = await Promise.all([
        academicService.getArchivedSchoolYears(),
        academicService.getCurrentSchoolYear().catch(() => null),
      ]);
      setCurrentSchoolYear(curSY);

      // Build available school years list: current active year plus any historical archived years
      const allYears: SchoolYear[] = [];
      if (curSY) {
        allYears.push(curSY);
      }
      (years || []).forEach((y) => {
        if (!allYears.some((ay) => ay.school_year === y.school_year)) {
          allYears.push(y);
        }
      });

      setArchivedYears(allYears);
      setSelectedSchoolYear(curSY?.school_year || allYears[0]?.school_year || '2026-2027');
    } catch (err: any) {
      console.error('Failed to load archived school years:', err);
      setSelectedSchoolYear('2026-2027');
    }
  };

  // 2. Auto-fetch data whenever selectedSchoolYear or activeTab changes
  useEffect(() => {
    if (!selectedSchoolYear || concludedTabsForSelectedYear.length === 0) {
      setTutors([]);
      setStudents([]);
      setGrades([]);
      setAttendance([]);
      setIsLoading(false);
      return;
    }
    fetchArchiveData();
  }, [selectedSchoolYear, activeTab, concludedTabsForSelectedYear.length]);

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

  const SortableHeader: React.FC<{
    label: string;
    shortLabel?: string;
    field: string;
    align?: 'left' | 'center' | 'right';
  }> = ({ label, shortLabel, field, align = 'left' }) => {
    const isActive = sortField === field;

    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${
          align === 'center' ? 'justify-center text-center' : align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
        } transition-colors hover:text-gray-700 dark:hover:text-slate-200 select-none text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
          isActive ? 'text-gray-700 dark:text-slate-200' : 'text-gray-400 dark:text-slate-400'
        } cursor-pointer`}
        aria-label={`Sort by ${label}`}
      >
        <span className="whitespace-nowrap">
          {shortLabel ? (
            <>
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </>
          ) : (
            label
          )}
        </span>
        {isActive ? (
          sortOrder === 'asc' ? (
            <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-40 shrink-0" />
        )}
      </button>
    );
  };

  // 5. Aggregate Tutors & Students metrics for selected period
  const tutorArchiveRows = useMemo<TutorArchiveRow[]>(() => {
    if (concludedTabsForSelectedYear.length === 0 || !concludedTabsForSelectedYear.includes(activeTab)) {
      return [];
    }
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

      const studentMetrics: StudentArchiveMetric[] = [];
      for (const st of tutorStudents) {
        // Filter student grades strictly to the selected concluded semester
        const sGrades = grades.filter((g) => {
          const sid = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
          if (String(sid) !== String(st.id)) return false;

          const subj = (g.subject || '').toUpperCase();
          const q = Number(g.quarter) || 0;

          if (activeTab === 'mosy') {
            return q === 1 || q === 2 || subj.includes('MOSY') || (!subj.includes('EOSY') && !subj.includes('SUMMER') && q <= 2);
          }
          if (activeTab === 'eosy') {
            return q === 3 || q === 4 || subj.includes('EOSY');
          }
          if (activeTab === 'summer') {
            return subj.includes('SUMMER');
          }
          return true;
        });

        // Filter student attendance strictly to the selected concluded semester
        const sAtt = attendance.filter((a) => {
          const uid = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
          if (String(uid) !== String(st.id)) return false;

          const dateStr = a.date || '';
          const month = parseInt(dateStr.slice(5, 7), 10);

          if (activeTab === 'mosy') {
            // DepEd 1st Semester: Aug to Dec/Jan
            return month >= 8 || month === 1;
          }
          if (activeTab === 'eosy') {
            // DepEd 2nd Semester: Jan to May
            return month >= 1 && month <= 5;
          }
          if (activeTab === 'summer') {
            // DepEd Summer: June to July
            return month >= 6 && month <= 7;
          }
          return true;
        });

        // Compute Attendance Rate
        let attendanceRate = 100.0;
        if (sAtt.length > 0) {
          const presentCount = sAtt.filter((a) => a.status === 'present').length;
          attendanceRate = Math.round((presentCount / sAtt.length) * 1000) / 10;
        }

        // Compute Average Score
        let avgScore = 100.0;
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
            // In MOSY (Q1 & Q2): Plus students who pass graduate!
            // Basic students who pass move up an ARAL level (Basic -> Plus).
            // Retained students remain in their ARAL level.
            if (isPassed || rawLevel === 'graduated') {
              status = isPlusCohort ? 'GRADUATED' : 'MOVED_UP';
            } else {
              status = 'RETAINED';
            }
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

        // Only archive students who actually have an evaluation grade or completed record in this concluded period
        const hasEvaluatedRecord = Boolean(evalGrade && evalGrade.remarks?.toLowerCase() !== 'not taken') ||
          (rawLevel === 'graduated' && (activeTab === 'eosy' || activeTab === 'summer'));

        if (!hasEvaluatedRecord) {
          continue;
        }

        if (status === 'GRADUATED') graduatedCount++;
        else if (status === 'MOVED_UP') movedUpCount++;
        else if (status === 'RETAINED') retainedCount++;
        else pendingCount++;

        studentMetrics.push({
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
        });
      }

      const tutorAralLevel = normalizeAralLevel(tutor.tutor_type || tutor.aral_level);
      const rawSubj = (tutor.subject || '').trim();
      const effectiveSubject = (rawSubj.toLowerCase() === 'reading' || !rawSubj)
        ? (tutorAralLevel === 'PLUS' ? 'English' : 'Filipino')
        : rawSubj;

      return {
        id: String(tutor.id),
        tutorName: tutor.full_name || `${tutor.first_name} ${tutor.last_name}`,
        gradeLevel: grade,
        section,
        subject: effectiveSubject,
        aralLevel: tutorAralLevel,
        totalStudents: studentMetrics.length,
        movedUpCount,
        graduatedCount,
        retainedCount,
        pendingCount,
        students: studentMetrics,
        tutorUser: tutor,
      };
    }).filter((r) => r.totalStudents > 0);
  }, [tutors, students, grades, attendance, activeTab]);

  // 6. Filter and Sort Rows
  const sortedAndFilteredRows = useMemo(() => {
    let list = [...tutorArchiveRows];
    if (search.trim()) {
      list = list.filter(
        (r) =>
          matchesSearch(
            search,
            r.tutorName,
            r.section,
            r.gradeLevel,
            r.subject,
            r.aralLevel
          ) ||
          r.students.some((st) =>
            matchesSearch(search, st.name, st.lrn, st.status)
          )
      );
    }

    list.sort((a, b) => {
      if (sortField === 'totalStudents' || sortField === 'assignedCount') {
        const countA = Number((a as any)[sortField]) || 0;
        const countB = Number((b as any)[sortField]) || 0;
        if (countA !== countB) {
          return sortOrder === 'asc' ? countA - countB : countB - countA;
        }
        return sortOrder === 'asc'
          ? a.tutorName.localeCompare(b.tutorName)
          : b.tutorName.localeCompare(a.tutorName);
      }
      if (sortField === 'tutorName') {
        const nameA = (a.tutorName || '').toUpperCase();
        const nameB = (b.tutorName || '').toUpperCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (sortField === 'outcomeSummary') {
        const getOutcomeRank = (r: TutorArchiveRow) => {
          if (r.totalStudents === 0) return -1;
          return (
            r.graduatedCount * 1_000_000 +
            r.movedUpCount * 10_000 +
            r.retainedCount * 100 +
            r.pendingCount * 1
          );
        };
        const rankA = getOutcomeRank(a);
        const rankB = getOutcomeRank(b);
        if (rankA !== rankB) {
          return sortOrder === 'asc' ? rankA - rankB : rankB - rankA;
        }
        return sortOrder === 'asc'
          ? a.tutorName.localeCompare(b.tutorName)
          : b.tutorName.localeCompare(a.tutorName);
      }
      let aVal = String((a as any)[sortField] ?? '').toLowerCase();
      let bVal = String((b as any)[sortField] ?? '').toLowerCase();

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
      {/* ── Top Bar: School Year & Period Switcher Tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-200 dark:border-zinc-800 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          {/* School Year Dropdown / Selector */}
          <div className="flex items-center gap-2">
            <SchoolYearDropdown
              value={selectedSchoolYear}
              onChange={(val) => setSelectedSchoolYear(val)}
              options={schoolYearOptions}
            />
            <span className="hidden sm:inline text-slate-300 dark:text-zinc-700 font-bold text-base select-none">&bull;</span>
          </div>

          {/* Phase Switcher Tabs — Full width on mobile, distributed flex-1 */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('mosy')}
              disabled={!concludedTabsForSelectedYear.includes('mosy')}
              className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-1 sm:flex-initial justify-center ${
                !concludedTabsForSelectedYear.includes('mosy')
                  ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-zinc-600'
                  : activeTab === 'mosy'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs cursor-pointer'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer'
              }`}
              title={!concludedTabsForSelectedYear.includes('mosy') ? '1st Semester not yet concluded' : 'Concluded 1st Semester'}
            >
              <span>MOSY<span className="hidden sm:inline"> (Q1 & Q2)</span></span>
              {currentSchoolYear?.current_semester === '1st' && (
                <span className="text-[9px] sm:text-[10px] font-normal text-slate-400 dark:text-zinc-500">
                  <span className="sm:hidden">(Active)</span>
                  <span className="hidden sm:inline">(In Progress)</span>
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('eosy')}
              disabled={!concludedTabsForSelectedYear.includes('eosy')}
              className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-1 sm:flex-initial justify-center ${
                !concludedTabsForSelectedYear.includes('eosy')
                  ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-zinc-600'
                  : activeTab === 'eosy'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs cursor-pointer'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer'
              }`}
              title={!concludedTabsForSelectedYear.includes('eosy') ? '2nd Semester not yet concluded' : 'Concluded 2nd Semester'}
            >
              <span>EOSY<span className="hidden sm:inline"> (Q3 & Q4)</span></span>
              {currentSchoolYear?.current_semester === '2nd' && (
                <span className="text-[9px] sm:text-[10px] font-normal text-slate-400 dark:text-zinc-500">
                  <span className="sm:hidden">(Active)</span>
                  <span className="hidden sm:inline">(In Progress)</span>
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('summer')}
              disabled={!concludedTabsForSelectedYear.includes('summer')}
              className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-1 sm:flex-initial justify-center ${
                !concludedTabsForSelectedYear.includes('summer')
                  ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-zinc-600'
                  : activeTab === 'summer'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs cursor-pointer'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer'
              }`}
              title={!concludedTabsForSelectedYear.includes('summer') ? 'Summer period not concluded' : 'Concluded Summer'}
            >
              <span>SUMMER<span className="hidden sm:inline"> (Midyear)</span></span>
              {currentSchoolYear?.current_semester === 'summer' && (
                <span className="text-[9px] sm:text-[10px] font-normal text-slate-400 dark:text-zinc-500">
                  <span className="sm:hidden">(Active)</span>
                  <span className="hidden sm:inline">(In Progress)</span>
                </span>
              )}
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
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm overflow-hidden">
          {/* Table Header / Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1">
              <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                <span className="hidden sm:inline">ARCHIVED TUTOR EVALUATION ROSTER</span>
                <span className="sm:hidden">ARCHIVED EVALUATIONS</span> ({sortedAndFilteredRows.length})
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                <span className="text-slate-500 dark:text-zinc-400 font-medium">
                  <AnimatedCounter value={cohortTotals.totalStudents} /> Total Students
                </span>
                {cohortTotals.graduatedCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--brand)]">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <AnimatedCounter value={cohortTotals.graduatedCount} /> Graduated
                  </span>
                )}
                {cohortTotals.movedUpCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <AnimatedCounter value={cohortTotals.movedUpCount} /> Moved Up ARAL Level
                  </span>
                )}
                {cohortTotals.retainedCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <AnimatedCounter value={cohortTotals.retainedCount} /> Retained ARAL Level
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
                disabled={concludedTabsForSelectedYear.length === 0}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[var(--brand)] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {concludedTabsForSelectedYear.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 sm:p-16 text-center bg-white dark:bg-[#0A0A0A]">
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                <span className="sm:hidden">No Concluded Semesters</span>
                <span className="hidden sm:inline">No Concluded Semester Records Found</span>
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400 max-w-md">
                School Year {selectedSchoolYear || '2026-2027'} has no concluded semesters. Evaluation records will be archived here once a semester concludes.
              </p>
            </div>
          ) : sortedAndFilteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 sm:p-16 text-center bg-white dark:bg-[#0A0A0A]">
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                <span className="sm:hidden">No Concluded Records Found</span>
                <span className="hidden sm:inline">No Concluded Evaluation Records Found</span>
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400 max-w-md">
                No evaluations were recorded or concluded for {activeTab === 'mosy' ? 'MOSY (Q1 & Q2)' : activeTab === 'eosy' ? 'EOSY (Q3 & Q4)' : 'Summer'} in School Year {selectedSchoolYear || '2026-2027'}. Concluded evaluation records will appear here once recorded.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full md:min-w-[760px] divide-y divide-gray-100 dark:divide-[#1A1A1A] text-left text-sm font-normal">
                <thead>
                  <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                    <th className="px-2.5 sm:px-4 py-2 sm:py-2.5 text-left w-[44%] sm:w-auto">
                      <SortableHeader label="TUTOR NAME" field="tutorName" />
                    </th>
                    <th className="px-1.5 sm:px-4 py-2 sm:py-2.5 text-center w-[26%] sm:w-auto">
                      <SortableHeader label="TOTAL STUDENTS" shortLabel="STUDENTS" field="totalStudents" align="center" />
                    </th>
                    <th className="px-1.5 sm:px-4 py-2 sm:py-2.5 text-center w-[30%] sm:w-auto">
                      <SortableHeader label="OUTCOME SUMMARY" shortLabel="OUTCOMES" field="outcomeSummary" align="center" />
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
                          <td className="px-2.5 sm:px-4 py-2 sm:py-3 font-semibold text-gray-900 dark:text-slate-100">
                            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--brand)] shrink-0 transition-transform" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 group-hover:text-gray-600 dark:text-zinc-500 shrink-0 transition-transform" />
                              )}
                              <span className="truncate text-xs sm:text-sm">{row.tutorName}</span>
                            </div>
                          </td>
                          <td className="px-1.5 sm:px-4 py-2 sm:py-3 text-center text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-medium">
                            {row.totalStudents} <span className="hidden sm:inline">Students</span>
                          </td>
                          <td className="px-1.5 sm:px-4 py-2 sm:py-3 text-center">
                            <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
                              {row.graduatedCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border bg-[var(--brand-light)] text-[var(--brand)] border-[var(--brand-border)] dark:bg-[var(--brand)]/15 dark:text-blue-300 dark:border-[var(--brand)]/50">
                                  <GraduationCap className="w-3 h-3" />
                                  {row.graduatedCount} <span className="hidden sm:inline">Graduated</span>
                                </span>
                              )}
                              {row.movedUpCount > 0 && (
                                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60">
                                  {row.movedUpCount} <span className="hidden sm:inline">Moved Up</span>
                                </span>
                              )}
                              {row.retainedCount > 0 && (
                                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/60">
                                  {row.retainedCount} <span className="hidden sm:inline">Retained</span>
                                </span>
                              )}
                              {row.pendingCount > 0 && row.graduatedCount === 0 && row.movedUpCount === 0 && row.retainedCount === 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                                  {isWindowOpen ? 'Pending' : 'Closed'}
                                </span>
                              )}
                              {row.pendingCount > 0 && (row.graduatedCount > 0 || row.movedUpCount > 0 || row.retainedCount > 0) && (
                                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                                  {row.pendingCount} {isWindowOpen ? 'Pending' : 'Closed'}
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
                            <td colSpan={3} className="p-0 max-w-0">
                              <div className="p-2.5 sm:p-5 border-y border-slate-200 dark:border-zinc-800 space-y-4 sm:space-y-5 w-full min-w-0 overflow-hidden">
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
                                        <ArchiveClassSectionTable
                                          key={cls.key}
                                          cls={cls}
                                          activeTab={activeTab}
                                          isSuperAdmin={isSuperAdmin}
                                          isWindowOpen={isWindowOpen}
                                        />
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
