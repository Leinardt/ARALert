import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, X, Lock, Unlock, AlertCircle,
  ChevronUp, ChevronDown, ChevronRight, ArrowUpDown
} from 'lucide-react';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import { AssignTutorModal } from '../../components/AssignTutorModal';
import { BulkAssignCohortModal } from '../../components/BulkAssignCohortModal';
import { TransitionConfirmationModal } from '../../components/TransitionConfirmationModal';
import { SemesterTransitionModal } from '../../components/SemesterTransitionModal';
import { EvaluateSummerModal } from '../../components/EvaluateSummerModal';
import { StudentProfileHistoryModal } from '../../components/StudentProfileHistoryModal';
import { TableSkeleton } from '../../components/SkeletonLoader';
import { AnimatedCounter } from '../../components/AnimatedCounter';
import { matchesSearch } from '../../utils/searchHelpers';
import {
  COMPOSITE_WEIGHTS,
  PASSING_SCORE_RATIO,
  isNotTakenGrade,
} from '../../config/academicConfig';
import {
  MosyMonitoringData,
  EosyMonitoringData,
  SummerRecord,
  SchoolYear,
  User,
  Grade,
  Attendance
} from '../../types';
import {
  getActiveSystemSemester,
  setActiveSystemSemester,
  isAssessmentWindowOpen,
  setAssessmentWindowOpen,
} from '../../utils/sessionDescriptionHelpers';
import { buildTutorClassSections } from '../../utils/tutorCohortHelpers';

/* ─── Normalize ARAL Level to strictly BASIC / PLUS / SUMMER ──────── */
const normalizeAralLevel = (val?: string | null): 'BASIC' | 'PLUS' | 'SUMMER' => {
  if (!val) return 'BASIC';
  const clean = val.trim().toLowerCase();
  if (clean.includes('summer')) return 'SUMMER';
  if (clean.includes('plus')) return 'PLUS';
  return 'BASIC';
};

/* ─── Interfaces ─────────────────────────────────────────────────── */
interface StudentMetric {
  id: string;
  name: string;
  lrn: string;
  aralLevel: 'BASIC' | 'PLUS' | 'SUMMER';
  attendanceRate: number;
  avgScore: number;
  assessmentScoreStr: string;
  compositeScore: number;
  status: 'PASSED' | 'FAILED' | 'RETAINED' | 'PENDING';
  rawStudent?: User;
}

interface TutorEvaluationRow {
  id: string;
  tutorName: string;
  gradeLevel: string;
  section: string;
  subject: string;
  aralLevel: 'BASIC' | 'PLUS' | 'SUMMER';
  assignedCount: number;
  evaluatedCount: number;
  status: 'Pending' | 'Completed' | 'Closed' | 'No Students';
  students: StudentMetric[];
  tutorUser?: User;
}

type StudentSortField =
  | 'name'
  | 'lrn'
  | 'attendanceRate'
  | 'avgScore'
  | 'compositeScore'
  | 'assessmentScore'
  | 'status';

interface TutorClassSectionTableProps {
  cls: {
    key: string;
    label: string;
    students: StudentMetric[];
  };
  activeTab: 'mosy' | 'eosy' | 'summer';
  isWindowOpen: boolean;
}

const TutorClassSectionTable = React.memo<TutorClassSectionTableProps>(({
  cls,
  activeTab,
  isWindowOpen,
}) => {
  const [sortField, setSortField] = useState<StudentSortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: StudentSortField) => {
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
          if (s === 'PASSED' || s === 'GRADUATED' || s === 'MOVED_UP') return 3;
          if (s === 'FAILED') return 2;
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
    field: StudentSortField;
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
    <div className="space-y-2.5 w-full min-w-0">
      <div className="flex items-center justify-between gap-2">
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
              <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-[#111111]">
                <tr className="bg-gray-50 dark:bg-[#111111]">
                  <th className="sticky left-0 top-0 z-30 bg-gray-50 dark:bg-[#111111] min-w-[140px] max-w-[155px] px-2.5 py-2 text-left text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 border-b border-r border-gray-200 dark:border-[#222222] shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                    <SortableSubHeader label="STUDENT NAME" field="name" align="left" />
                  </th>
                  <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#111111] min-w-[90px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader label="LRN" field="lrn" align="center" />
                  </th>
                  <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#111111] min-w-[85px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader label="ATTENDANCE" field="attendanceRate" align="center" />
                  </th>
                  <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#111111] min-w-[80px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader label="SCORE" field="avgScore" align="center" />
                  </th>
                  <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#111111] min-w-[85px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader label="COMPOSITE" field="compositeScore" align="center" />
                  </th>
                  <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#111111] min-w-[95px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader
                      label={activeTab === 'mosy' ? 'MOSY' : activeTab === 'eosy' ? 'EOSY' : 'SUMMER'}
                      field="assessmentScore"
                      align="center"
                    />
                  </th>
                  <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#111111] min-w-[85px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 border-b border-gray-100 dark:border-[#1A1A1A]">
                    <SortableSubHeader label="STATUS" field="status" align="center" />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-[#0A0A0A]">
                {sortedStudents.map((st, idx) => (
                  <tr
                    key={`mob-sub-${st.id}`}
                    className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 dark:bg-[#0A0A0A] dark:group-hover:bg-[#111111] px-2.5 py-2 font-semibold text-slate-900 dark:text-white whitespace-nowrap border-b border-r border-gray-200 dark:border-[#222222] shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-slate-400 font-mono shrink-0 w-3 text-right">
                          {idx + 1}.
                        </span>
                        <span className="truncate max-w-[110px] text-xs font-semibold" title={st.name}>
                          {st.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                      {st.lrn}
                    </td>
                    <td className="px-2 py-2 text-center font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap text-xs border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                      {st.attendanceRate.toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 text-center font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap text-xs border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                      {st.avgScore.toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-slate-900 dark:text-white whitespace-nowrap text-xs border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                      {st.compositeScore.toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 text-center font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap text-xs border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                      {st.assessmentScoreStr}
                    </td>
                    <td className="px-2 py-2 text-center whitespace-nowrap border-b border-gray-100 dark:border-[#1A1A1A]">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          st.status === 'PASSED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60'
                            : st.status === 'FAILED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/60'
                            : st.status === 'RETAINED'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/60'
                            : !isWindowOpen
                            ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                            : 'bg-amber-50/70 text-amber-700 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/40'
                        }`}
                      >
                        {!isWindowOpen && st.status === 'PENDING' ? 'CLOSED' : st.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Desktop View (>= 768px): Original Full Sub-Table */}
          <div className="hidden md:block table-scroll-container rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A]">
            <table className="min-w-[1050px] w-full text-left text-xs divide-y divide-gray-100 dark:divide-[#1A1A1A]">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] divide-x divide-gray-100 dark:divide-[#1A1A1A] font-bold text-[11px] uppercase tracking-wider text-gray-400 dark:text-slate-400 shadow-xs">
                <tr>
                  <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#222222] w-10 px-3 py-2 text-center whitespace-nowrap">#</th>
                  <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#222222] px-3 py-2 text-left whitespace-nowrap">
                    <SortableSubHeader label="STUDENT NAME" field="name" align="left" />
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#222222] px-3 py-2 text-left whitespace-nowrap">
                    <SortableSubHeader label="LRN" field="lrn" align="left" />
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#222222] px-3 py-2 text-center whitespace-nowrap">
                    <SortableSubHeader label="FINAL AVG ATTENDANCE RATE" field="attendanceRate" align="center" />
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#222222] px-3 py-2 text-center whitespace-nowrap">
                    <SortableSubHeader label="FINAL AVG SCORE RATE" field="avgScore" align="center" />
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#222222] px-3 py-2 text-center whitespace-nowrap">
                    <SortableSubHeader label="FINAL AVG COMPOSITE RATING" field="compositeScore" align="center" />
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#222222] px-3 py-2 text-center whitespace-nowrap">
                    <SortableSubHeader
                      label={activeTab === 'mosy' ? 'MOSY ASSESSMENT' : activeTab === 'eosy' ? 'EOSY ASSESSMENT' : 'SUMMER ASSESSMENT'}
                      field="assessmentScore"
                      align="center"
                    />
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#222222] px-3 py-2 text-center whitespace-nowrap">
                    <SortableSubHeader label="STATUS" field="status" align="center" />
                  </th>
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
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          st.status === 'PASSED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60'
                            : st.status === 'FAILED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/60'
                            : st.status === 'RETAINED'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/60'
                            : !isWindowOpen
                            ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                            : 'bg-amber-50/70 text-amber-700 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/40'
                        }`}
                      >
                        {!isWindowOpen && st.status === 'PENDING' ? 'CLOSED' : st.status}
                      </span>
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
});

export const AdminEvaluationHub: React.FC = () => {
  const getInitialTab = (): 'mosy' | 'eosy' | 'summer' => {
    const sem = getActiveSystemSemester();
    if (sem === '2nd') return 'eosy';
    if (sem === 'summer') return 'summer';
    return 'mosy';
  };

  const [activeTab, setActiveTab] = useState<'mosy' | 'eosy' | 'summer'>(getInitialTab);
  const [currentSY, setCurrentSY] = useState<SchoolYear | null>(null);
  const [activeSystemSem, setActiveSystemSem] = useState(() => getActiveSystemSemester());
  const [isSettingSemester, setIsSettingSemester] = useState<boolean>(false);
  const [isWindowOpen, setIsWindowOpen] = useState<boolean>(() => isAssessmentWindowOpen(getActiveSystemSemester()));
  const [isAssessmentWindowConfirmOpen, setIsAssessmentWindowConfirmOpen] = useState<boolean>(false);
  const [isTogglingWindow, setIsTogglingWindow] = useState<boolean>(false);

  // Tutors and Students Directory
  const [tutors, setTutors] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [expandedTutorIds, setExpandedTutorIds] = useState<Set<string>>(new Set());
  const [tutorSearch, setTutorSearch] = useState<string>('');

  // Table Sorting State
  const [sortField, setSortField] = useState<string>('tutorName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // MOSY state
  const [mosyData, setMosyData] = useState<MosyMonitoringData | null>(null);
  const [isProcessingMosy, setIsProcessingMosy] = useState<boolean>(false);
  const [mosyProcessSuccess, setMosyProcessSuccess] = useState<string | null>(null);

  // EOSY state
  const [eosyData, setEosyData] = useState<EosyMonitoringData | null>(null);
  const [isProcessingEosy, setIsProcessingEosy] = useState<boolean>(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState<boolean>(false);
  const [transitionSuccessMsg, setTransitionSuccessMsg] = useState<string | null>(null);

  // Semester Milestone Transition Modal State (MOSY / EOSY)
  const [semesterTransitionModal, setSemesterTransitionModal] = useState<{
    isOpen: boolean;
    type: 'mosy' | 'eosy';
    title: string;
    currentPeriod: string;
    targetPeriod: string;
  }>({
    isOpen: false,
    type: 'mosy',
    title: '',
    currentPeriod: '',
    targetPeriod: '',
  });

  // Summer state
  const [summerRecords, setSummerRecords] = useState<SummerRecord[]>([]);
  const [selectedSummerRecord, setSelectedSummerRecord] = useState<SummerRecord | null>(null);
  const [isSummerModalOpen, setIsSummerModalOpen] = useState<boolean>(false);

  // Unified Assignment Queue & Bulk Cohort State
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState<boolean>(false);

  // Modals state
  const [assignModalStudent, setAssignModalStudent] = useState<{
    id: string;
    full_name: string;
    lrn?: string | null;
    program: string;
  } | null>(null);
  const [assignModalPeriod, setAssignModalPeriod] = useState<'MOSY' | 'EOSY' | 'FULL_YEAR'>('MOSY');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);

  // History modal
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // General loading/error
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const currentActiveSemester = (currentSY?.current_semester || activeSystemSem) as '1st' | '2nd' | 'summer';

  useEffect(() => {
    const handleWindowChange = (e: any) => {
      if (typeof e?.detail?.isOpen === 'boolean') {
        setIsWindowOpen(e.detail.isOpen);
      } else {
        setIsWindowOpen(isAssessmentWindowOpen(currentActiveSemester));
      }
    };
    window.addEventListener('assessment_window_changed', handleWindowChange);
    return () => window.removeEventListener('assessment_window_changed', handleWindowChange);
  }, [currentActiveSemester]);

  const handleConfirmToggleAssessmentWindow = async () => {
    const nextState = !isWindowOpen;
    setIsTogglingWindow(true);
    setAssessmentWindowOpen(nextState, currentActiveSemester);
    setIsWindowOpen(nextState);
    try {
      await academicService.toggleAssessmentWindow(nextState, currentActiveSemester);
    } catch (err) {
      console.warn('Failed to sync assessment window toggle to server:', err);
    } finally {
      setIsTogglingWindow(false);
      setIsAssessmentWindowConfirmOpen(false);
    }
  };

  useEffect(() => {
    loadInitialData();

    const handleSemChange = (e: any) => {
      const newSem = e?.detail?.semester || getActiveSystemSemester();
      setActiveSystemSem(newSem);
    };

    window.addEventListener('system_semester_changed', handleSemChange);
    return () => window.removeEventListener('system_semester_changed', handleSemChange);
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sy, mosy, eosy, summer, tutorsList, studentsList, gradesList, attendanceList] = await Promise.all([
        academicService.getCurrentSchoolYear().catch(() => null),
        academicService.getMosyMonitoring().catch(() => null),
        academicService.getEosyMonitoring().catch(() => null),
        academicService.getSummerList().catch(() => []),
        userService.getTutors().catch(() => [] as User[]),
        userService.getAllUsers({ role: 'student' }).catch(() => [] as User[]),
        academicService.getGrades().catch(() => [] as Grade[]),
        academicService.getAttendanceHistory({ role: 'student' }).catch(() => [] as Attendance[]),
      ]);

      setCurrentSY(sy);
      if (sy?.current_semester) {
        setActiveSystemSemester(sy.current_semester as any);
        setActiveSystemSem(sy.current_semester as any);
      }
      if (typeof sy?.is_assessment_window_open === 'boolean') {
        setAssessmentWindowOpen(sy.is_assessment_window_open, sy.current_semester as any);
        setIsWindowOpen(sy.is_assessment_window_open);
      }
      if (sy?.current_semester === '2nd') {
        setActiveTab('eosy');
      } else if (sy?.current_semester === 'summer') {
        setActiveTab('summer');
      } else if (sy?.current_semester === '1st') {
        setActiveTab('mosy');
      }

      setMosyData(mosy);
      setEosyData(eosy);
      setSummerRecords(summer);
      setTutors(Array.isArray(tutorsList) ? tutorsList : []);
      setStudents(Array.isArray(studentsList) ? studentsList : []);
      setGrades(Array.isArray(gradesList) ? gradesList : []);
      setAttendance(Array.isArray(attendanceList) ? attendanceList : []);
    } catch (err: any) {
      console.error('Failed to load assessment management data:', err);
      setError('Unable to load assessment records. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleRefresh = async () => {
    await loadInitialData();
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
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
        className={`inline-flex items-center gap-1 sm:gap-1.5 whitespace-nowrap text-${align} transition-colors hover:text-gray-700 dark:hover:text-slate-200 select-none text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
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

  const handleProcessMosy = async () => {
    setIsProcessingMosy(true);
    setMosyProcessSuccess(null);
    try {
      const res = await academicService.processMosyCompletion();
      setMosyProcessSuccess(res.message);
      setActiveSystemSemester('2nd');
      setActiveSystemSem('2nd');
      setActiveTab('eosy');
      setSemesterTransitionModal((prev) => ({ ...prev, isOpen: false }));

      try {
        const [m, e] = await Promise.all([
          academicService.getMosyMonitoring().catch(() => null),
          academicService.getEosyMonitoring().catch(() => null),
        ]);
        if (m) setMosyData(m);
        if (e) setEosyData(e);
      } catch (refreshErr) {
        console.warn('Post-transition data refresh warning:', refreshErr);
      }
    } catch (err: any) {
      console.error('Failed to process MOSY completion:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to finalize MOSY.';
      alert(errorMsg);
    } finally {
      setIsProcessingMosy(false);
    }
  };

  const handleProcessEosy = async () => {
    setIsProcessingEosy(true);
    try {
      setActiveSystemSemester('summer');
      setActiveSystemSem('summer');
      setActiveTab('summer');
      await handleRefresh();
      setSemesterTransitionModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      console.error('Failed to start summer semester:', err);
    } finally {
      setIsProcessingEosy(false);
    }
  };

  // Helper to parse Grade and Section cleanly
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

  // ── Compute Tutors Evaluation Rows & Status (O(1) Map-Optimized) ──────────────
  const tutorRows = useMemo<TutorEvaluationRow[]>(() => {
    // 1. Pre-index active students by assigned tutor id
    const studentsByTutor = new Map<string, User[]>();
    for (let i = 0; i < students.length; i++) {
      const st = students[i];
      if (st.assigned_tutor) {
        const tid = String(st.assigned_tutor);
        let list = studentsByTutor.get(tid);
        if (!list) {
          list = [];
          studentsByTutor.set(tid, list);
        }
        list.push(st);
      }
    }

    // 2. Pre-index student grades by student id
    const gradesByStudent = new Map<string, Grade[]>();
    for (let i = 0; i < grades.length; i++) {
      const g = grades[i];
      const sid = String(typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student);
      let list = gradesByStudent.get(sid);
      if (!list) {
        list = [];
        gradesByStudent.set(sid, list);
      }
      list.push(g);
    }

    // 3. Pre-index attendance records by student/user id
    const attendanceByStudent = new Map<string, Attendance[]>();
    for (let i = 0; i < attendance.length; i++) {
      const a = attendance[i];
      const uid = String(typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user);
      let list = attendanceByStudent.get(uid);
      if (!list) {
        list = [];
        attendanceByStudent.set(uid, list);
      }
      list.push(a);
    }

    // 4. Pre-index summer records by student id and lrn
    const summerRecordsByStudent = new Map<string, SummerRecord>();
    for (let i = 0; i < summerRecords.length; i++) {
      const sr = summerRecords[i];
      if (sr.student) summerRecordsByStudent.set(String(sr.student), sr);
      if (sr.student_lrn) summerRecordsByStudent.set(sr.student_lrn, sr);
    }

    // 5. Pre-index tutor progress from MOSY and EOSY monitoring data
    const mosyProgressByTutor = new Map<string, any>();
    if (mosyData?.tutors_progress) {
      for (let i = 0; i < mosyData.tutors_progress.length; i++) {
        const tp = mosyData.tutors_progress[i];
        mosyProgressByTutor.set(tp.tutor_id, tp);
      }
    }

    const eosyProgressByTutor = new Map<string, any>();
    if (eosyData?.tutors_progress) {
      for (let i = 0; i < eosyData.tutors_progress.length; i++) {
        const tp = eosyData.tutors_progress[i];
        eosyProgressByTutor.set(tp.tutor_id, tp);
      }
    }

    return tutors.map((tutor) => {
      const tutorStudents = studentsByTutor.get(String(tutor.id)) || [];
      const assignedCount = tutorStudents.length;

      let evaluatedCount = 0;
      let isCompleted = false;

      if (activeTab === 'mosy') {
        const p = mosyProgressByTutor.get(String(tutor.id));
        if (p) {
          evaluatedCount = p.evaluated_count;
          isCompleted = assignedCount > 0 && (p.status === 'Completed' || p.remaining_count === 0);
        } else if (assignedCount === 0) {
          isCompleted = false;
        } else {
          const evaluatedStudents = tutorStudents.filter((s) => {
            const sGrades = gradesByStudent.get(String(s.id)) || [];
            return sGrades.some((g) => (g.subject || '').toUpperCase().includes('MOSY') && g.remarks?.toLowerCase() !== 'not taken');
          });
          evaluatedCount = evaluatedStudents.length;
          isCompleted = assignedCount > 0 && evaluatedCount >= assignedCount;
        }
      } else if (activeTab === 'eosy') {
        const p = eosyProgressByTutor.get(String(tutor.id));
        if (p) {
          evaluatedCount = p.evaluated_count;
          isCompleted = assignedCount > 0 && (p.status === 'Completed' || p.remaining_count === 0);
        } else if (assignedCount === 0) {
          isCompleted = false;
        } else {
          const evaluatedStudents = tutorStudents.filter((s) => {
            const sGrades = gradesByStudent.get(String(s.id)) || [];
            return sGrades.some((g) => (g.subject || '').toUpperCase().includes('EOSY') && g.remarks?.toLowerCase() !== 'not taken');
          });
          evaluatedCount = evaluatedStudents.length;
          isCompleted = assignedCount > 0 && evaluatedCount >= assignedCount;
        }
      } else {
        // Summer
        if (currentActiveSemester !== 'summer') {
          evaluatedCount = 0;
          isCompleted = false;
        } else {
          const tutorSummerRecords = tutorStudents
            .map((s) => summerRecordsByStudent.get(String(s.id)) || (s.lrn ? summerRecordsByStudent.get(s.lrn) : undefined))
            .filter((sr): sr is SummerRecord => Boolean(sr));

          if (tutorSummerRecords.length === 0) {
            isCompleted = false;
          } else {
            const comp = tutorSummerRecords.filter((sr) => sr.summer_status === 'summer_completed' || sr.summer_result).length;
            evaluatedCount = comp;
            isCompleted = tutorSummerRecords.length > 0 && comp >= tutorSummerRecords.length;
          }
        }
      }

      let status: 'Pending' | 'Completed' | 'Closed' | 'No Students';
      if (isCompleted) {
        status = 'Completed';
      } else if (assignedCount === 0) {
        status = 'No Students';
      } else if (!isWindowOpen) {
        status = 'Closed';
      } else {
        status = 'Pending';
      }

      const studentMetrics: StudentMetric[] = tutorStudents.map((st) => {
        const sGrades = gradesByStudent.get(String(st.id)) || [];
        const sAtt = attendanceByStudent.get(String(st.id)) || [];

        // Compute Attendance Rate
        let attendanceRate = 100.0;
        if (sAtt.length > 0) {
          const presentCount = sAtt.filter((a) => a.status === 'present').length;
          attendanceRate = Math.round((presentCount / sAtt.length) * 1000) / 10;
        }

        // Compute Average Score (exclude Not Taken records)
        const scoredGrades = sGrades.filter((g) => !isNotTakenGrade(g));
        let avgScore = 100.0;
        if (scoredGrades.length > 0) {
          const totalPct = scoredGrades.reduce((acc, g) => {
            const ts = Number(g.total_score) || 100;
            const sc = Number(g.score) || 0;
            return acc + (sc / ts) * 100;
          }, 0);
          avgScore = Math.round((totalPct / scoredGrades.length) * 10) / 10;
        }

        // Compute Composite Score (40% Attendance + 60% Academic Performance)
        const compositeScore = Math.round(((attendanceRate * COMPOSITE_WEIGHTS.attendance) + (avgScore * COMPOSITE_WEIGHTS.score)) * 10) / 10;

        // Determine Status & Assessment Score: PASSED, FAILED, or PENDING
        const matchingEvalGrades = sGrades.filter((g) => {
          const subj = (g.subject || '').toUpperCase();
          if (activeTab === 'mosy') return subj.includes('MOSY');
          if (activeTab === 'eosy') return subj.includes('EOSY');
          return subj.includes('SUMMER');
        });
        const evalGrade = matchingEvalGrades.find((g) => !isNotTakenGrade(g)) ?? matchingEvalGrades[0];

        let assessmentScoreStr = '—';
        let studentStatus: 'PASSED' | 'FAILED' | 'PENDING' = 'PENDING';

        if (activeTab === 'summer') {
          const sr = summerRecordsByStudent.get(String(st.id)) || (st.lrn ? summerRecordsByStudent.get(st.lrn) : undefined);
          if (sr?.summer_result) {
            assessmentScoreStr = sr.summer_result === 'passed' ? '100.0%' : '50.0%';
            studentStatus = sr.summer_result === 'passed' ? 'PASSED' : 'FAILED';
          } else if (evalGrade && isNotTakenGrade(evalGrade)) {
            assessmentScoreStr = 'Not Taken';
          } else if (evalGrade) {
            const ts = Number(evalGrade.total_score) || 40;
            const sc = Number(evalGrade.score) || 0;
            const pct = Math.round((sc / ts) * 1000) / 10;
            assessmentScoreStr = `${pct.toFixed(1)}%`;
            const passedEval = evalGrade.remarks?.toLowerCase() === 'passed' || (sc / ts) >= PASSING_SCORE_RATIO;
            studentStatus = passedEval ? 'PASSED' : 'FAILED';
          }
        } else if (evalGrade && isNotTakenGrade(evalGrade)) {
          assessmentScoreStr = 'Not Taken';
        } else if (evalGrade) {
          const ts = Number(evalGrade.total_score) || 40;
          const sc = Number(evalGrade.score) || 0;
          const pct = Math.round((sc / ts) * 1000) / 10;
          assessmentScoreStr = `${pct.toFixed(1)}%`;
          const passedEval = evalGrade.remarks?.toLowerCase() === 'passed' || (sc / ts) >= PASSING_SCORE_RATIO;
          studentStatus = passedEval ? 'PASSED' : 'FAILED';
        }

        return {
          id: String(st.id),
          name: st.full_name || `${st.first_name} ${st.last_name}`,
          lrn: st.lrn || '—',
          aralLevel: normalizeAralLevel(st.aral_level),
          attendanceRate,
          avgScore,
          assessmentScoreStr,
          compositeScore,
          status: studentStatus,
          rawStudent: st,
        };
      });

      const { grade, section } = getGradeAndSection(tutor.grade_level, tutor.section);

      const tutorAralLevel = normalizeAralLevel(tutor.tutor_type || tutor.aral_level);
      const rawSubj = (tutor.subject || '').trim();
      const effectiveSubject = (rawSubj.toLowerCase() === 'reading' || !rawSubj)
        ? (tutorAralLevel === 'PLUS' ? 'English' : 'Filipino')
        : rawSubj;

      return {
        id: String(tutor.id),
        tutorName: tutor.full_name || `${tutor.first_name} ${tutor.last_name}`,
        gradeLevel: grade,
        section: section,
        subject: effectiveSubject,
        aralLevel: tutorAralLevel,
        assignedCount,
        evaluatedCount,
        status,
        students: studentMetrics,
        tutorUser: tutor,
      };
    });
  }, [tutors, students, grades, attendance, mosyData, eosyData, summerRecords, activeTab, currentActiveSemester, isWindowOpen]);

  const totalTutorsCount = tutorRows.length;
  const completedTutorsCount = tutorRows.filter((r) => r.status === 'Completed').length;
  const pendingTutorsCount = tutorRows.filter((r) => r.status === 'Pending').length;
  const isAllTutorsComplete = totalTutorsCount > 0 && tutorRows.filter((r) => r.assignedCount > 0).length > 0 && tutorRows.filter((r) => r.assignedCount > 0).every((r) => r.status === 'Completed');

  const sortedAndFilteredTutorRows = useMemo(() => {
    let list = [...tutorRows];
    if (tutorSearch.trim()) {
      list = list.filter(
        (r) =>
          matchesSearch(
            tutorSearch,
            r.tutorName,
            r.section,
            r.gradeLevel,
            r.subject,
            r.aralLevel,
            r.status
          ) ||
          r.students.some((st) =>
            matchesSearch(tutorSearch, st.name, st.lrn, st.status)
          )
      );
    }

    list.sort((a, b) => {
      if (sortField === 'assignedCount') {
        const countA = Number(a.assignedCount) || 0;
        const countB = Number(b.assignedCount) || 0;
        return sortOrder === 'asc' ? countA - countB : countB - countA;
      }
      if (sortField === 'tutorName') {
        const nameA = (a.tutorName || '').toUpperCase();
        const nameB = (b.tutorName || '').toUpperCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      let aVal = String((a as any)[sortField] ?? '').toLowerCase();
      let bVal = String((b as any)[sortField] ?? '').toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [tutorRows, tutorSearch, sortField, sortOrder]);

  const currentSchoolYearStr = useMemo(() => {
    return currentSY?.school_year || '2026–2027';
  }, [currentSY]);

  const nextSchoolYear = useMemo(() => {
    if (eosyData?.next_school_year) return eosyData.next_school_year;
    const sy = currentSchoolYearStr;
    const match = sy.match(/(\d{4})\s*[-–]\s*(\d{4})/);
    if (match) {
      const y1 = parseInt(match[1], 10) + 1;
      const y2 = parseInt(match[2], 10) + 1;
      return `${y1}–${y2}`;
    }
    return '2026–2027';
  }, [currentSchoolYearStr, eosyData]);

  const activePhaseLabel = activeTab.toUpperCase();

  return (
    <div className="flex flex-col gap-4 sm:gap-5 p-3.5 sm:p-6 max-w-7xl mx-auto w-full" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Top Bar: School Year (no icon) • MOSY(Q1 & Q2), EOSY(Q3 & Q4), SUMMER(Midyear) | Assessment Window Button ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        {/* Left: School Year (No Icon) & Phase Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white whitespace-nowrap">
              {currentSchoolYearStr.startsWith('SY') ? currentSchoolYearStr : `SY ${currentSchoolYearStr}`}
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-zinc-700 font-bold text-base select-none">&bull;</span>
          </div>

          {/* Phase Switcher Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('mosy')}
              className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center gap-1 sm:gap-2 cursor-pointer whitespace-nowrap flex-1 sm:flex-initial justify-center ${
                activeTab === 'mosy'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>MOSY<span className="hidden sm:inline"> (Q1 & Q2)</span></span>
              {currentActiveSemester === '1st' && (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60 leading-none inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('eosy')}
              className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center gap-1 sm:gap-2 cursor-pointer whitespace-nowrap flex-1 sm:flex-initial justify-center ${
                activeTab === 'eosy'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>EOSY<span className="hidden sm:inline"> (Q3 & Q4)</span></span>
              {currentActiveSemester === '2nd' && (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60 leading-none inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('summer')}
              className={`px-2 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center gap-1 sm:gap-2 cursor-pointer whitespace-nowrap flex-1 sm:flex-initial justify-center ${
                activeTab === 'summer'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>SUMMER<span className="hidden sm:inline"> (Midyear)</span></span>
              {currentActiveSemester === 'summer' && (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60 leading-none inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right: Assessment Window Control with Active Clockwise Glowing Outline */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsAssessmentWindowConfirmOpen(true)}
            className={`relative inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer border shadow-xs w-full sm:w-auto ${
              isWindowOpen
                ? 'border-emerald-400/80 dark:border-emerald-600/80 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/60 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60'
            }`}
            title={isWindowOpen ? `Assessment window is OPEN. Click to close.` : `Assessment window is CLOSED. Click to open.`}
          >
            {isWindowOpen && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none rounded-xl overflow-visible"
                style={{ filter: 'drop-shadow(0 0 5px rgba(16, 185, 129, 0.95))' }}
              >
                <rect
                  x="0.75"
                  y="0.75"
                  width="calc(100% - 1.5px)"
                  height="calc(100% - 1.5px)"
                  rx="11"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  pathLength="100"
                  strokeDasharray="10 40 10 40"
                  className="animate-glow-border-clockwise"
                />
              </svg>
            )}

            {isWindowOpen ? (
              <>
                <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{activePhaseLabel} ASSESSMENT: OPENED</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>{activePhaseLabel} ASSESSMENT: CLOSED</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Success Alerts */}
      {mosyProcessSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{mosyProcessSuccess}</span>
          </div>
          <button type="button" onClick={() => setMosyProcessSuccess(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {transitionSuccessMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{transitionSuccessMsg}</span>
          </div>
          <button type="button" onClick={() => setTransitionSuccessMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Main Loading Skeleton State ────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-4 sm:p-6 space-y-5 shadow-sm animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="h-6 w-52 bg-slate-200 dark:bg-zinc-800 rounded-md" />
            <div className="h-9 w-48 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 bg-slate-200 dark:bg-zinc-800 rounded-full" />
            <div className="h-4 w-32 bg-slate-200 dark:bg-zinc-800 rounded-md" />
          </div>
          <TableSkeleton rows={8} cols={3} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Assessment Status Card Container ──────────────────────────────────── */}
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-sm">
            {/* 1. Header Row: Bold Evaluation Status Label on Left with Active Badge & Transition Button on Top Right */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {activePhaseLabel} Evaluation Status
                </h2>
                {((activeTab === 'mosy' && currentActiveSemester === '1st') ||
                  (activeTab === 'eosy' && currentActiveSemester === '2nd') ||
                  (activeTab === 'summer' && currentActiveSemester === 'summer')) && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-500/60 leading-none inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                )}
              </div>

              {/* Start New Semester / Start New School Year Action Button */}
              {activeTab === 'mosy' && (
                <button
                  type="button"
                  onClick={() => {
                    setSemesterTransitionModal({
                      isOpen: true,
                      type: 'mosy',
                      title: 'Start Second Semester (Q3 & Q4)',
                      currentPeriod: `${currentSchoolYearStr} - MOSY (1st Semester)`,
                      targetPeriod: `${currentSchoolYearStr} - 2nd Semester`,
                    });
                  }}
                  disabled={!isAllTutorsComplete || isProcessingMosy}
                  className={`w-full sm:w-auto text-center justify-center px-4 sm:px-5 py-2 rounded-xl text-xs font-bold border transition duration-150 shrink-0 ${
                    isAllTutorsComplete
                      ? 'bg-[#0052B7] text-white hover:bg-[#004194] border-[#0052B7] shadow-xs cursor-pointer'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
                  }`}
                  title={!isAllTutorsComplete ? 'All tutors must complete MOSY evaluation before starting the next semester' : 'Start New Semester'}
                >
                  {isProcessingMosy ? (
                    'Processing MOSY...'
                  ) : (
                    <>
                      <span className="sm:hidden">Start New Semester (Q3 & Q4)</span>
                      <span className="hidden sm:inline">Start New Semester ({currentSchoolYearStr}, Q3 & Q4)</span>
                    </>
                  )}
                </button>
              )}

              {activeTab === 'eosy' && (
                <button
                  type="button"
                  onClick={() => {
                    setSemesterTransitionModal({
                      isOpen: true,
                      type: 'eosy',
                      title: 'Start Summer Semester',
                      currentPeriod: `${currentSchoolYearStr} - EOSY (2nd Semester)`,
                      targetPeriod: `${currentSchoolYearStr} - Summer Remediation`,
                    });
                  }}
                  disabled={!isAllTutorsComplete || isProcessingEosy}
                  className={`w-full sm:w-auto text-center justify-center px-4 sm:px-5 py-2 rounded-xl text-xs font-bold border transition duration-150 shrink-0 ${
                    isAllTutorsComplete
                      ? 'bg-[#0052B7] text-white hover:bg-[#004194] border-[#0052B7] shadow-xs cursor-pointer'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
                  }`}
                  title={!isAllTutorsComplete ? 'All tutors must complete EOSY evaluation before starting summer semester' : 'Start Summer Semester'}
                >
                  {isProcessingEosy ? (
                    'Starting Summer...'
                  ) : (
                    <>
                      <span className="sm:hidden">Start New Semester (Summer)</span>
                      <span className="hidden sm:inline">Start New Semester ({currentSchoolYearStr}, Summer)</span>
                    </>
                  )}
                </button>
              )}

              {activeTab === 'summer' && (
                <button
                  type="button"
                  onClick={() => setIsTransitionModalOpen(true)}
                  disabled={!isAllTutorsComplete}
                  className={`w-full sm:w-auto text-center justify-center px-4 sm:px-5 py-2 rounded-xl text-xs font-bold border transition duration-150 shrink-0 ${
                    isAllTutorsComplete
                      ? 'bg-[#0052B7] text-white hover:bg-[#004194] border-[#0052B7] shadow-xs cursor-pointer'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
                  }`}
                  title={!isAllTutorsComplete ? 'All tutors must complete summer evaluations before starting new school year' : 'Start New School Year'}
                >
                  <span className="sm:hidden">Start New School Year</span>
                  <span className="hidden sm:inline">Start New School Year ({nextSchoolYear})</span>
                </button>
              )}
            </div>

            {/* 2. Progression Bar (Connected Unified Bar with Divider Lines + tutors completed info) */}
            <div className="w-full flex flex-wrap sm:flex-nowrap items-center gap-3 pt-1">
              {/* Connected Bar */}
              <div className="flex-1 min-w-[140px] w-full sm:w-auto h-4 rounded-full overflow-hidden flex border border-slate-300 dark:border-zinc-700 bg-slate-200 dark:bg-zinc-700 divide-x-2 divide-white dark:divide-[#0A0A0A] shadow-inner">
                {totalTutorsCount === 0 ? (
                  <div className="w-full h-full bg-slate-200 dark:bg-zinc-700" />
                ) : (
                  tutorRows.map((t, idx) => (
                    <div
                      key={t.id || idx}
                      className={`flex-1 h-full transition-all duration-300 ${
                        idx < completedTutorsCount
                          ? 'bg-emerald-500 dark:bg-emerald-500'
                          : 'bg-slate-200 dark:bg-zinc-700'
                      }`}
                      title={`${t.tutorName}: ${t.status}`}
                    />
                  ))
                )}
              </div>

              {/* Numerical completion info */}
              <div className="flex items-center shrink-0 whitespace-nowrap">
                <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                  <AnimatedCounter value={completedTutorsCount} />/{totalTutorsCount} Tutor Evaluations
                </span>
              </div>
            </div>

            {/* 3. Table with Column Division Lines, Sortable Headers, and Strict ARAL Level */}
            <div className="overflow-x-auto mobile-scroll-table w-full rounded-md border border-gray-200 dark:border-[#1A1A1A]">
              {/* Table Search Toolbar */}
              <div className="p-3 border-b border-gray-200 dark:border-[#1A1A1A] flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-[#111111]">
                <div className="flex items-center">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Tutors List ({sortedAndFilteredTutorRows.length})
                  </span>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search tutor, section, subject..."
                    value={tutorSearch}
                    onChange={(e) => setTutorSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[var(--brand)]"
                  />
                </div>
              </div>

              {sortedAndFilteredTutorRows.length === 0 ? (
                <div className="p-12 text-center text-xs font-semibold text-slate-500 dark:text-zinc-400 bg-white dark:bg-[#0A0A0A]">
                  {tutors.length === 0 ? 'No tutors enrolled in ARAL Program' : 'No tutors matching search filter'}
                </div>
              ) : (
                <table className="w-full md:min-w-[760px] divide-y divide-gray-100 dark:divide-[#1A1A1A] text-left text-sm font-normal">
                  <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] shadow-xs">
                    <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                      <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#222222] px-2 sm:px-4 py-2 sm:py-2.5 text-left w-[46%] sm:w-auto">
                        <SortableHeader label="TUTOR NAME" field="tutorName" />
                      </th>
                      <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#222222] px-1.5 sm:px-4 py-2 sm:py-2.5 text-center w-[27%] sm:w-auto">
                        <SortableHeader label="TOTAL STUDENTS" shortLabel="STUDENTS" field="assignedCount" align="center" />
                      </th>
                      <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#111111] border-b border-gray-200 dark:border-[#222222] px-1.5 sm:px-4 py-2 sm:py-2.5 text-center w-[27%] sm:w-auto">
                        <SortableHeader label="STATUS" field="status" align="center" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                    {sortedAndFilteredTutorRows.map((row) => {
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
                            <td className="px-2 sm:px-4 py-2 sm:py-3 font-semibold text-gray-900 dark:text-slate-100">
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
                              {row.assignedCount} <span className="hidden sm:inline">Students</span>
                            </td>
                            <td className="px-1.5 sm:px-4 py-2 sm:py-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border ${
                                  row.status === 'Completed'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60'
                                    : row.status === 'Pending'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/60'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                          </tr>

                          {/* Expandable Sub-Table: Classes and Students Handled by this Tutor */}
                          {isExpanded && (
                            <tr className="bg-slate-50/40 dark:bg-zinc-950/40">
                              <td colSpan={3} className="p-0 max-w-0">
                                <div className="p-2.5 sm:p-5 border-y border-slate-200 dark:border-zinc-800 space-y-4 sm:space-y-5 w-full min-w-0 overflow-hidden">
                                  {row.students.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-500 dark:text-zinc-400 bg-white dark:bg-[#0A0A0A] rounded-xl border border-slate-200 dark:border-zinc-800">
                                      No students assigned to this tutor for this semester.
                                    </div>
                                  ) : (
                                    (() => {
                                      const allSections = buildTutorClassSections(row.tutorUser, row.students);
                                      const activeSections = allSections.filter((cls) => cls.students.length > 0);
                                      const displaySections = activeSections.length > 0 ? activeSections : allSections;

                                      return displaySections.map((cls) => (
                                        <TutorClassSectionTable
                                          key={cls.key}
                                          cls={cls}
                                          activeTab={activeTab}
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-Modals ───────────────────────────────────────────────────────── */}
      <AssignTutorModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        student={assignModalStudent}
        period={assignModalPeriod}
        onAssigned={handleRefresh}
      />

      <SemesterTransitionModal
        isOpen={semesterTransitionModal.isOpen}
        onClose={() => setSemesterTransitionModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={semesterTransitionModal.type === 'mosy' ? handleProcessMosy : handleProcessEosy}
        title={semesterTransitionModal.title}
        currentPeriod={semesterTransitionModal.currentPeriod}
        targetPeriod={semesterTransitionModal.targetPeriod}
        isProcessing={semesterTransitionModal.type === 'mosy' ? isProcessingMosy : isProcessingEosy}
      />

      <TransitionConfirmationModal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        onSuccess={(result) => {
          setTransitionSuccessMsg(result.message || 'Transition completed successfully.');
          setActiveSystemSemester('1st');
          setActiveSystemSem('1st');
          handleRefresh();
        }}
      />

      <EvaluateSummerModal
        isOpen={isSummerModalOpen}
        onClose={() => setIsSummerModalOpen(false)}
        record={selectedSummerRecord}
        onEvaluated={async () => {
          const summer = await academicService.getSummerList();
          setSummerRecords(summer);
        }}
      />

      <StudentProfileHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        studentId={historyStudentId}
      />

      <BulkAssignCohortModal
        isOpen={isBulkAssignModalOpen}
        onClose={() => setIsBulkAssignModalOpen(false)}
        selectedStudents={[]}
        period="MOSY"
        onDispatched={async () => {
          setIsBulkAssignModalOpen(false);
          await handleRefresh();
        }}
      />

      {isAssessmentWindowConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assessment-window-confirm-title"
          onClick={() => !isTogglingWindow && setIsAssessmentWindowConfirmOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#222222] rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
            style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1E1E1E] flex items-center justify-between bg-white dark:bg-[#111111]">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                    isWindowOpen
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {isWindowOpen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </div>
                <div>
                  <h2
                    id="assessment-window-confirm-title"
                    className="text-sm sm:text-base font-bold text-gray-900 dark:text-slate-100"
                  >
                    {isWindowOpen ? `Close ${activePhaseLabel} Assessment` : `Open ${activePhaseLabel} Assessment`}
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Assessment Window Confirmation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssessmentWindowConfirmOpen(false)}
                disabled={isTogglingWindow}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition cursor-pointer"
                aria-label="Close confirmation dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3 text-xs text-gray-600 dark:text-slate-300">
              <p className="leading-relaxed">
                Are you sure you want to{' '}
                <strong className="text-gray-900 dark:text-slate-100 font-semibold">
                  {isWindowOpen ? 'close' : 'open'}
                </strong>{' '}
                the <strong className="text-gray-900 dark:text-slate-100 font-semibold">{activePhaseLabel} Assessment</strong>?
              </p>
              <p
                className={`text-[11px] font-medium rounded-md p-3 border ${
                  isWindowOpen
                    ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-900/40'
                    : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40'
                }`}
              >
                {isWindowOpen
                  ? `Closing the ${activePhaseLabel} Assessment will lock score entry and prevent tutors from submitting or modifying ${activePhaseLabel} assessment scores.`
                  : `Opening the ${activePhaseLabel} Assessment will allow tutors to record and submit ${activePhaseLabel} assessment scores for their assigned students.`}
              </p>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-gray-100 dark:border-[#1E1E1E] bg-gray-50/50 dark:bg-[#141414] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAssessmentWindowConfirmOpen(false)}
                disabled={isTogglingWindow}
                className="px-3.5 py-2 rounded-md border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1F1F1F] text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleAssessmentWindow}
                disabled={isTogglingWindow}
                className={`px-4 py-2 rounded-md text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 ${
                  isWindowOpen
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isTogglingWindow
                  ? isWindowOpen
                    ? 'Closing...'
                    : 'Opening...'
                  : isWindowOpen
                    ? 'Yes, Close Assessment'
                    : 'Yes, Open Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
