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
import { EvaluateSummerModal } from '../../components/EvaluateSummerModal';
import { StudentProfileHistoryModal } from '../../components/StudentProfileHistoryModal';
import { CardSkeleton, StatsGridSkeleton, TableSkeleton } from '../../components/SkeletonLoader';
import {
  MosyMonitoringData,
  MosyAssignmentData,
  EosyMonitoringData,
  SummerRecord,
  SchoolYear,
  AssignmentQueueData,
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

const TutorClassSectionTable: React.FC<TutorClassSectionTableProps> = ({
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
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A]">
          <table className="min-w-[850px] w-full text-left text-xs divide-y divide-gray-100 dark:divide-[#1A1A1A]">
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
                  <SortableSubHeader label="FINAL AVG SCORE" field="avgScore" align="center" />
                </th>
                <th className="px-3 py-2 text-center whitespace-nowrap">
                  <SortableSubHeader label="FINAL AVG COMPOSITE" field="compositeScore" align="center" />
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
      )}
    </div>
  );
};

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
  const [mosyAssignments, setMosyAssignments] = useState<MosyAssignmentData | null>(null);
  const [isProcessingMosy, setIsProcessingMosy] = useState<boolean>(false);
  const [mosyProcessSuccess, setMosyProcessSuccess] = useState<string | null>(null);

  // EOSY state
  const [eosyData, setEosyData] = useState<EosyMonitoringData | null>(null);
  const [isProcessingEosy, setIsProcessingEosy] = useState<boolean>(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState<boolean>(false);
  const [transitionSuccessMsg, setTransitionSuccessMsg] = useState<string | null>(null);

  // Summer state
  const [summerRecords, setSummerRecords] = useState<SummerRecord[]>([]);
  const [selectedSummerRecord, setSelectedSummerRecord] = useState<SummerRecord | null>(null);
  const [isSummerModalOpen, setIsSummerModalOpen] = useState<boolean>(false);

  // Unified Assignment Queue & Bulk Cohort State
  const [queueData, setQueueData] = useState<AssignmentQueueData | null>(null);
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

  const handleToggleAssessmentWindow = () => {
    const nextState = !isWindowOpen;
    setAssessmentWindowOpen(nextState, currentActiveSemester);
    setIsWindowOpen(nextState);
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
      const [sy, mosy, mosyAssign, eosy, summer, queue, tutorsList, studentsList, gradesList, attendanceList] = await Promise.all([
        academicService.getCurrentSchoolYear().catch(() => null),
        academicService.getMosyMonitoring().catch(() => null),
        academicService.getMosyAssignments().catch(() => null),
        academicService.getEosyMonitoring().catch(() => null),
        academicService.getSummerList().catch(() => []),
        academicService.getAssignmentQueue().catch(() => null),
        userService.getAllUsers({ role: 'tutor' }).catch(() => [] as User[]),
        userService.getAllUsers({ role: 'student' }).catch(() => [] as User[]),
        academicService.getGrades().catch(() => [] as Grade[]),
        academicService.getAttendanceHistory().catch(() => [] as Attendance[]),
      ]);

      setCurrentSY(sy);
      if (sy?.current_semester) {
        setActiveSystemSemester(sy.current_semester as any);
        setActiveSystemSem(sy.current_semester as any);
      }
      if (sy?.current_semester === '2nd') {
        setActiveTab('eosy');
      } else if (sy?.current_semester === 'summer') {
        setActiveTab('summer');
      } else if (sy?.current_semester === '1st') {
        setActiveTab('mosy');
      }

      setMosyData(mosy);
      setMosyAssignments(mosyAssign);
      setEosyData(eosy);
      setSummerRecords(summer);
      setQueueData(queue);
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
        className={`inline-flex items-center gap-1.5 whitespace-nowrap text-${align} transition-colors hover:text-gray-700 dark:hover:text-slate-200 select-none text-[11px] font-bold uppercase tracking-wider ${
          isActive ? 'text-gray-700 dark:text-slate-200' : 'text-gray-400 dark:text-slate-400'
        } cursor-pointer`}
        aria-label={`Sort by ${label}`}
      >
        <span className="whitespace-nowrap">{label}</span>
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

  const handleProcessMosy = async () => {
    if (!window.confirm('Finalize the MOSY evaluation period? This will promote qualifying students to the Plus program and release tutor assignments for second-semester cohorts.')) {
      return;
    }
    setIsProcessingMosy(true);
    setMosyProcessSuccess(null);
    try {
      const res = await academicService.processMosyCompletion();
      setMosyProcessSuccess(res.message);
      setActiveSystemSemester('2nd');
      setActiveSystemSem('2nd');
      setActiveTab('eosy');
      const [m, ma, q] = await Promise.all([
        academicService.getMosyMonitoring(),
        academicService.getMosyAssignments(),
        academicService.getAssignmentQueue().catch(() => null),
      ]);
      setMosyData(m);
      setMosyAssignments(ma);
      setQueueData(q);
    } catch (err: any) {
      console.error('Failed to process MOSY completion:', err);
      alert(err.response?.data?.error || 'Failed to finalize MOSY.');
    } finally {
      setIsProcessingMosy(false);
    }
  };

  const handleProcessEosy = async () => {
    if (!window.confirm(`Finalize EOSY evaluation period and start Summer Semester (${currentSchoolYearStr}, Summer)?`)) {
      return;
    }
    setIsProcessingEosy(true);
    try {
      setActiveSystemSemester('summer');
      setActiveSystemSem('summer');
      setActiveTab('summer');
      await handleRefresh();
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

  // ── Compute Tutors Evaluation Rows & Status ────────────────────────────────
  const tutorRows = useMemo<TutorEvaluationRow[]>(() => {
    return tutors.map((tutor) => {
      const tutorStudents = students.filter((s) => String(s.assigned_tutor) === String(tutor.id));
      const assignedCount = tutorStudents.length;

      let evaluatedCount = 0;
      let isCompleted = false;

      if (activeTab === 'mosy') {
        const p = mosyData?.tutors_progress?.find((tp) => tp.tutor_id === String(tutor.id));
        if (p) {
          evaluatedCount = p.evaluated_count;
          isCompleted = assignedCount > 0 && (p.status === 'Completed' || p.remaining_count === 0);
        } else if (assignedCount === 0) {
          isCompleted = false;
        } else {
          const evaluatedStudents = tutorStudents.filter((s) => {
            return grades.some((g) => {
              const sid = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
              return String(sid) === String(s.id) && (g.subject || '').toUpperCase().includes('MOSY') && g.remarks?.toLowerCase() !== 'not taken';
            });
          });
          evaluatedCount = evaluatedStudents.length;
          isCompleted = assignedCount > 0 && evaluatedCount >= assignedCount;
        }
      } else if (activeTab === 'eosy') {
        const p = eosyData?.tutors_progress?.find((tp) => tp.tutor_id === String(tutor.id));
        if (p) {
          evaluatedCount = p.evaluated_count;
          isCompleted = assignedCount > 0 && (p.status === 'Completed' || p.remaining_count === 0);
        } else if (assignedCount === 0) {
          isCompleted = false;
        } else {
          const evaluatedStudents = tutorStudents.filter((s) => {
            return grades.some((g) => {
              const sid = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
              return String(sid) === String(s.id) && (g.subject || '').toUpperCase().includes('EOSY') && g.remarks?.toLowerCase() !== 'not taken';
            });
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
          const tutorSummerRecords = summerRecords.filter((sr) => {
            const st = students.find((s) => s.id === sr.student || s.lrn === sr.student_lrn);
            return st && String(st.assigned_tutor) === String(tutor.id);
          });
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

        // Determine Status & Assessment Score: PASSED, RETAINED, or PENDING
        const evalGrade = sGrades.find((g) => {
          const subj = (g.subject || '').toUpperCase();
          if (activeTab === 'mosy') return subj.includes('MOSY');
          if (activeTab === 'eosy') return subj.includes('EOSY');
          return subj.includes('SUMMER');
        });

        let assessmentScoreStr = '—';
        let studentStatus: 'PASSED' | 'FAILED' | 'PENDING' = 'PENDING';

        if (activeTab === 'summer') {
          const sr = summerRecords.find((r) => String(r.student) === String(st.id) || r.student_lrn === st.lrn);
          if (sr?.summer_result) {
            assessmentScoreStr = sr.summer_result === 'passed' ? '100.0%' : '50.0%';
            studentStatus = sr.summer_result === 'passed' ? 'PASSED' : 'FAILED';
          } else if (evalGrade && evalGrade.remarks?.toLowerCase() !== 'not taken') {
            const ts = Number(evalGrade.total_score) || 40;
            const sc = Number(evalGrade.score) || 0;
            const pct = Math.round((sc / ts) * 1000) / 10;
            assessmentScoreStr = `${pct.toFixed(1)}%`;
            const passedEval = evalGrade.remarks?.toLowerCase() === 'passed' || (ts === 40 ? sc >= 28 : (sc / ts) >= 0.7);
            studentStatus = passedEval ? 'PASSED' : 'FAILED';
          }
        } else if (evalGrade && evalGrade.remarks?.toLowerCase() !== 'not taken') {
          const ts = Number(evalGrade.total_score) || 40;
          const sc = Number(evalGrade.score) || 0;
          const pct = Math.round((sc / ts) * 1000) / 10;
          assessmentScoreStr = `${pct.toFixed(1)}%`;
          const passedEval = evalGrade.remarks?.toLowerCase() === 'passed' || (ts === 40 ? sc >= 28 : (sc / ts) >= 0.7);
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

      return {
        id: String(tutor.id),
        tutorName: tutor.full_name || `${tutor.first_name} ${tutor.last_name}`,
        gradeLevel: grade,
        section: section,
        subject: tutor.subject === 'Reading' ? 'Filipino' : (tutor.subject || 'Filipino'),
        aralLevel: normalizeAralLevel(tutor.tutor_type || tutor.aral_level),
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
      const q = tutorSearch.toLowerCase();
      list = list.filter(
        (r) =>
          r.tutorName.toLowerCase().includes(q) ||
          r.section.toLowerCase().includes(q) ||
          r.gradeLevel.toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q) ||
          r.aralLevel.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.students.some(
            (st) =>
              st.name.toLowerCase().includes(q) ||
              st.lrn.toLowerCase().includes(q) ||
              st.status.toLowerCase().includes(q)
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
    return currentSY?.school_year || '2025–2026';
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
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Top Bar: School Year (no icon) • MOSY(Q1 & Q2), EOSY(Q3 & Q4), SUMMER(Midyear) | Assessment Window Button ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        {/* Left: School Year (No Icon) & Phase Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white whitespace-nowrap">
            {currentSchoolYearStr.startsWith('SY') ? currentSchoolYearStr : `SY ${currentSchoolYearStr}`}
          </span>

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
              {currentActiveSemester === '1st' && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60 leading-none inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              )}
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
              {currentActiveSemester === '2nd' && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60 leading-none inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              )}
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
              {currentActiveSemester === 'summer' && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60 leading-none inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right: Assessment Window Control with Active Clockwise Glowing Outline */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleAssessmentWindow}
            className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer border shadow-xs ${
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
        <div className="space-y-5">
          <StatsGridSkeleton count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CardSkeleton rows={4} />
            <CardSkeleton rows={4} />
          </div>
          <TableSkeleton rows={6} cols={6} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Assessment Status Card Container ──────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 sm:p-6 space-y-5 shadow-xs">
            {/* 1. Header Row: Bold Evaluation Status Label on Left with Active Badge & Transition Button on Top Right */}
            <div className="flex flex-wrap items-center justify-between gap-3">
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
                  onClick={handleProcessMosy}
                  disabled={!isAllTutorsComplete || isProcessingMosy}
                  className={`px-5 py-2 rounded-xl text-xs font-bold border transition duration-150 shrink-0 whitespace-nowrap ${
                    isAllTutorsComplete
                      ? 'bg-[#0052B7] text-white hover:bg-[#004194] border-[#0052B7] shadow-xs cursor-pointer'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
                  }`}
                  title={!isAllTutorsComplete ? 'All tutors must complete MOSY evaluation before starting the next semester' : 'Start New Semester'}
                >
                  {isProcessingMosy
                    ? 'Processing MOSY...'
                    : `Start New Semester (${currentSchoolYearStr}, Q3 & Q4)`}
                </button>
              )}

              {activeTab === 'eosy' && (
                <button
                  type="button"
                  onClick={handleProcessEosy}
                  disabled={!isAllTutorsComplete || isProcessingEosy}
                  className={`px-5 py-2 rounded-xl text-xs font-bold border transition duration-150 shrink-0 whitespace-nowrap ${
                    isAllTutorsComplete
                      ? 'bg-[#0052B7] text-white hover:bg-[#004194] border-[#0052B7] shadow-xs cursor-pointer'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
                  }`}
                  title={!isAllTutorsComplete ? 'All tutors must complete EOSY evaluation before starting summer semester' : 'Start Summer Semester'}
                >
                  {isProcessingEosy
                    ? 'Starting Summer...'
                    : `Start New Semester (${currentSchoolYearStr}, Summer)`}
                </button>
              )}

              {activeTab === 'summer' && (
                <button
                  type="button"
                  onClick={() => setIsTransitionModalOpen(true)}
                  disabled={!isAllTutorsComplete}
                  className={`px-5 py-2 rounded-xl text-xs font-bold border transition duration-150 shrink-0 whitespace-nowrap ${
                    isAllTutorsComplete
                      ? 'bg-[#0052B7] text-white hover:bg-[#004194] border-[#0052B7] shadow-xs cursor-pointer'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
                  }`}
                  title={!isAllTutorsComplete ? 'All tutors must complete summer evaluations before starting new school year' : 'Start New School Year'}
                >
                  Start New School Year ({nextSchoolYear})
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
                  {completedTutorsCount}/{totalTutorsCount} Tutor Evaluations
                </span>
              </div>
            </div>

            {/* 3. Table with Column Division Lines, Sortable Headers, and Strict ARAL Level */}
            <div className="overflow-x-auto mobile-scroll-table w-full rounded-md border border-gray-200 dark:border-[#1A1A1A]">
              {/* Table Search Toolbar */}
              <div className="p-3 border-b border-gray-200 dark:border-[#1A1A1A] flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-[#0A0A0A]">
                <div className="flex items-center">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Tutors List ({sortedAndFilteredTutorRows.length})
                  </span>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search tutor name, section, subject..."
                    value={tutorSearch}
                    onChange={(e) => setTutorSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[var(--brand)]"
                  />
                </div>
              </div>

              {sortedAndFilteredTutorRows.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 dark:text-zinc-400 bg-white dark:bg-[#0A0A0A]">
                  {tutors.length === 0 ? 'No tutors enrolled in ARAL Program' : 'No tutors matching search filter'}
                </div>
              ) : (
                <table className="min-w-[760px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-left text-sm font-normal">
                  <thead>
                    <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                      <th className="px-4 py-2.5 text-left whitespace-nowrap">
                        <SortableHeader label="TUTOR NAME" field="tutorName" />
                      </th>
                      <th className="px-4 py-2.5 text-center whitespace-nowrap">
                        <SortableHeader label="TOTAL STUDENTS" field="assignedCount" align="center" />
                      </th>
                      <th className="px-4 py-2.5 text-center whitespace-nowrap">
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
                              {row.assignedCount} Students
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
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
                              <td colSpan={3} className="p-0">
                                <div className="p-4 sm:p-5 border-y border-slate-200 dark:border-zinc-800 space-y-5">
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
    </div>
  );
};
