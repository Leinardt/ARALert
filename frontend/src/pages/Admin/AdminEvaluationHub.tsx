import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Check, CheckCircle2, AlertCircle, AlertTriangle,
  Users, UserCheck, Shield, ChevronRight, History, RefreshCw,
  Search, X, ArrowRight
} from 'lucide-react';
import { academicService } from '../../services/academicService';
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
  ArchivedSchoolYearSnapshot,
  AssignmentQueueData,
  AssignmentQueueItem
} from '../../types';
import {
  getActiveSystemSemester,
  setActiveSystemSemester,
} from '../../utils/sessionDescriptionHelpers';

export const AdminEvaluationHub: React.FC = () => {
  const getInitialTab = (): 'mosy' | 'eosy' | 'summer' | 'archive' => {
    const sem = getActiveSystemSemester();
    if (sem === '2nd') return 'eosy';
    if (sem === 'summer') return 'summer';
    return 'mosy';
  };

  const [activeTab, setActiveTab] = useState<'mosy' | 'eosy' | 'summer' | 'archive'>(getInitialTab);
  const [currentSY, setCurrentSY] = useState<SchoolYear | null>(null);
  const [activeSystemSem, setActiveSystemSem] = useState(() => getActiveSystemSemester());
  const [isSettingSemester, setIsSettingSemester] = useState<boolean>(false);

  const isSchoolYearActive = activeTab !== 'archive' && currentSY?.is_active !== false && currentSY?.status !== 'ARCHIVED';
  const currentActiveSemester = (currentSY?.current_semester || activeSystemSem) as '1st' | '2nd' | 'summer';

  const getPhaseButtonClass = (sem: '1st' | '2nd' | 'summer') => {
    const isCurrent = currentActiveSemester === sem;
    if (!isSchoolYearActive) {
      return isCurrent
        ? 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold cursor-not-allowed pointer-events-none'
        : 'text-slate-400 dark:text-zinc-600 cursor-not-allowed pointer-events-none';
    }
    if (isCurrent) {
      return 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white font-bold cursor-default';
    }
    if (isSettingSemester) {
      return 'text-slate-400 dark:text-zinc-600 cursor-not-allowed';
    }
    return 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer';
  };

  // MOSY state
  const [mosyData, setMosyData] = useState<MosyMonitoringData | null>(null);
  const [mosyAssignments, setMosyAssignments] = useState<MosyAssignmentData | null>(null);
  const [isProcessingMosy, setIsProcessingMosy] = useState<boolean>(false);
  const [mosyProcessSuccess, setMosyProcessSuccess] = useState<string | null>(null);

  // EOSY state
  const [eosyData, setEosyData] = useState<EosyMonitoringData | null>(null);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState<boolean>(false);
  const [transitionSuccessMsg, setTransitionSuccessMsg] = useState<string | null>(null);

  // Summer state
  const [summerRecords, setSummerRecords] = useState<SummerRecord[]>([]);
  const [selectedSummerRecord, setSelectedSummerRecord] = useState<SummerRecord | null>(null);
  const [isSummerModalOpen, setIsSummerModalOpen] = useState<boolean>(false);

  // Archive state
  const [archivedYears, setArchivedYears] = useState<SchoolYear[]>([]);
  const [selectedArchiveYear, setSelectedArchiveYear] = useState<string>('');
  const [archiveSnapshot, setArchiveSnapshot] = useState<ArchivedSchoolYearSnapshot | null>(null);
  const [isLoadingArchiveDetail, setIsLoadingArchiveDetail] = useState<boolean>(false);

  // Unified Assignment Queue & Bulk Cohort State
  const [queueData, setQueueData] = useState<AssignmentQueueData | null>(null);
  const [selectedQueueIds, setSelectedQueueIds] = useState<string[]>([]);
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState<boolean>(false);
  const [queueFilter, setQueueFilter] = useState<'all' | 'plus' | 'basic'>('all');
  const [queueSearch, setQueueSearch] = useState<string>('');

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
      const [sy, mosy, mosyAssign, eosy, summer, archives, queue] = await Promise.all([
        academicService.getCurrentSchoolYear().catch(() => null),
        academicService.getMosyMonitoring().catch(() => null),
        academicService.getMosyAssignments().catch(() => null),
        academicService.getEosyMonitoring().catch(() => null),
        academicService.getSummerList().catch(() => []),
        academicService.getArchivedSchoolYears().catch(() => []),
        academicService.getAssignmentQueue().catch(() => null),
      ]);

      setCurrentSY(sy);
      if (sy?.current_semester) {
        setActiveSystemSemester(sy.current_semester as any);
        setActiveSystemSem(sy.current_semester as any);
      }
      if (sy?.status === 'ARCHIVED' || sy?.is_active === false) {
        setActiveTab('archive');
      } else if (sy?.current_semester === '2nd') {
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
      setArchivedYears(archives);
      setQueueData(queue);

      if (archives.length > 0 && !selectedArchiveYear) {
        setSelectedArchiveYear(archives[0].school_year);
        loadArchiveSnapshot(archives[0].school_year);
      }
    } catch (err: any) {
      console.error('Failed to load evaluation hub data:', err);
      setError('Unable to load evaluation records. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadInitialData();
  };

  const handleSetSemester = async (semester: '1st' | '2nd' | 'summer') => {
    if (!isSchoolYearActive) return;
    setIsSettingSemester(true);
    try {
      const res = await academicService.setActiveSemester(semester);
      setCurrentSY(res.school_year);
      setActiveSystemSemester(semester);
      setActiveSystemSem(semester);
      await loadInitialData();
    } catch (err: any) {
      console.error('Failed to update active semester:', err);
      alert(err.response?.data?.error || 'Failed to update active semester.');
    } finally {
      setIsSettingSemester(false);
    }
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
      const [m, ma, q] = await Promise.all([
        academicService.getMosyMonitoring(),
        academicService.getMosyAssignments(),
        academicService.getAssignmentQueue().catch(() => null),
      ]);
      setMosyData(m);
      setMosyAssignments(ma);
      setQueueData(q);
      setSelectedQueueIds([]);
    } catch (err: any) {
      console.error('Failed to process MOSY completion:', err);
      alert(err.response?.data?.error || 'Failed to finalize MOSY.');
    } finally {
      setIsProcessingMosy(false);
    }
  };

  const handleOpenAssignModal = (student: { id: string; full_name: string; lrn?: string | null; program: string }, period: 'MOSY' | 'EOSY' | 'FULL_YEAR' = 'MOSY') => {
    setAssignModalStudent(student);
    setAssignModalPeriod(period);
    setIsAssignModalOpen(true);
  };

  const handleOpenHistoryModal = (studentId: string) => {
    setHistoryStudentId(studentId);
    setIsHistoryModalOpen(true);
  };

  const handleStartSummer = async (recordId: number) => {
    try {
      await academicService.startSummerParticipation(recordId);
      const summer = await academicService.getSummerList();
      setSummerRecords(summer);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to start summer participation.');
    }
  };

  const loadArchiveSnapshot = async (year: string) => {
    setIsLoadingArchiveDetail(true);
    try {
      const snap = await academicService.getArchivedSchoolYearDetail(year);
      setArchiveSnapshot(snap);
    } catch (err: any) {
      console.error('Failed to load archive snapshot:', err);
    } finally {
      setIsLoadingArchiveDetail(false);
    }
  };

  // Flattened queue items
  const allQueueItems: AssignmentQueueItem[] = useMemo(() => {
    if (queueData) {
      return [...queueData.plus_queue, ...queueData.basic_queue];
    }
    const plusItems: AssignmentQueueItem[] = (mosyAssignments?.unassigned_plus_students || []).map(s => ({
      id: s.id,
      full_name: s.full_name,
      lrn: s.lrn,
      required_program: 'plus',
      mosy_result: 'Passed',
      eosy_result: 'Pending',
      mosy_score_pct: s.mosy_score_pct,
      previous_tutor: s.previous_tutor,
      status_reason: 'Leveled Up from Basic — Awaiting Plus Tutor',
      status_badge: s.status_badge,
      status_color: s.status_color,
    }));
    const basicItems: AssignmentQueueItem[] = (mosyAssignments?.unassigned_basic_students || mosyAssignments?.basic_students || []).map(s => ({
      id: s.id,
      full_name: s.full_name,
      lrn: s.lrn,
      required_program: 'basic',
      mosy_result: s.mosy_result || 'Failed',
      eosy_result: 'Pending',
      mosy_score_pct: s.mosy_score_pct,
      previous_tutor: s.previous_tutor,
      status_reason: 'Retained in Basic — Midyear Cohort Retake',
      status_badge: s.status_badge,
      status_color: s.status_color,
    }));
    return [...plusItems, ...basicItems];
  }, [queueData, mosyAssignments]);

  const filteredQueueItems = useMemo(() => {
    return allQueueItems.filter(item => {
      if (queueFilter === 'plus' && item.required_program !== 'plus') return false;
      if (queueFilter === 'basic' && item.required_program !== 'basic') return false;
      if (queueSearch.trim()) {
        const q = queueSearch.toLowerCase();
        const matchesName = item.full_name.toLowerCase().includes(q);
        const matchesLrn = item.lrn ? item.lrn.toLowerCase().includes(q) : false;
        const matchesTutor = item.previous_tutor ? item.previous_tutor.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesLrn && !matchesTutor) return false;
      }
      return true;
    });
  }, [allQueueItems, queueFilter, queueSearch]);

  const selectedStudentsForCohort = useMemo(() => {
    return allQueueItems.filter(item => selectedQueueIds.includes(item.id));
  }, [allQueueItems, selectedQueueIds]);

  // UX Check: Detect mixed levels to warn user early and prevent errors
  const selectedLevelCounts = useMemo(() => {
    const plus = selectedStudentsForCohort.filter(s => s.required_program === 'plus').length;
    const basic = selectedStudentsForCohort.filter(s => s.required_program === 'basic').length;
    return { plus, basic, isMixed: plus > 0 && basic > 0 };
  }, [selectedStudentsForCohort]);

  const toggleSelectStudent = (id: string) => {
    setSelectedQueueIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectFilteredAll = () => {
    const ids = filteredQueueItems.map(s => s.id);
    setSelectedQueueIds(ids);
  };

  const handleQuickSelectCount = (count: number) => {
    const ids = filteredQueueItems.slice(0, count).map(s => s.id);
    setSelectedQueueIds(ids);
  };

  const handleClearSelection = () => {
    setSelectedQueueIds([]);
  };

  const handleCohortDispatched = async () => {
    setIsBulkAssignModalOpen(false);
    setSelectedQueueIds([]);
    await handleRefresh();
  };

  // EOSY completion calculation
  const eosyEvaluatedPct = useMemo(() => {
    if (!eosyData || eosyData.total_assigned_students === 0) {
      return eosyData?.can_transition ? 100 : 0;
    }
    return Math.round((eosyData.total_students_evaluated / eosyData.total_assigned_students) * 100);
  }, [eosyData]);

  // Summer summary stats
  const summerStats = useMemo(() => {
    const required = summerRecords.filter(r => r.summer_status === 'summer_required').length;
    const inProgress = summerRecords.filter(r => r.summer_status === 'summer_active' || r.summer_status === 'evaluation_pending').length;
    const completed = summerRecords.filter(r => r.summer_status === 'summer_completed' || r.summer_status === 'summer_passed' || r.summer_status === 'summer_failed').length;
    return { required, inProgress, completed, total: summerRecords.length };
  }, [summerRecords]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* ── Minimalist Top Navigation & Active Phase Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
        {/* Navigation Tabs with Active Phase Badges */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('mosy')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'mosy'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>MOSY</span>
            {currentActiveSemester === '1st' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 leading-none">
                Active
              </span>
            )}
            {allQueueItems.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-zinc-700 text-[10px] text-slate-700 dark:text-zinc-300 font-bold">
                {allQueueItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('eosy')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'eosy'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>EOSY</span>
            {currentActiveSemester === '2nd' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 leading-none">
                Active
              </span>
            )}
            {eosyData && !eosyData.can_transition && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Evaluations pending" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summer')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'summer'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Summer</span>
            {currentActiveSemester === 'summer' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 leading-none">
                Active
              </span>
            )}
            {summerRecords.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-zinc-700 text-[10px] text-slate-700 dark:text-zinc-300 font-bold">
                {summerRecords.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('archive');
              if (archivedYears.length > 0 && !archiveSnapshot) {
                const year = selectedArchiveYear || archivedYears[0].school_year;
                setSelectedArchiveYear(year);
                loadArchiveSnapshot(year);
              }
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'archive'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Archive</span>
          </button>
        </div>

        {/* School Year, Operating Phase Switcher & Refresh */}
        <div className="flex items-center gap-2.5 text-xs">
          <span className="font-semibold text-slate-500 dark:text-zinc-400">
            SY {currentSY?.school_year || '2025–2026'}
          </span>

          <span className="text-slate-300 dark:text-zinc-700">&bull;</span>

          <div
            className={`flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800 transition ${
              !isSchoolYearActive ? 'opacity-40 select-none cursor-not-allowed' : ''
            }`}
            title={!isSchoolYearActive ? 'Phase setting is disabled for archived or inactive school years' : undefined}
          >
            <span className="text-[11px] text-slate-400 px-1.5 hidden sm:inline">Set Phase:</span>
            <button
              type="button"
              onClick={() => isSchoolYearActive && handleSetSemester('1st')}
              disabled={!isSchoolYearActive || isSettingSemester || currentActiveSemester === '1st'}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${getPhaseButtonClass('1st')}`}
              title={
                !isSchoolYearActive
                  ? 'Phase setting is disabled for archived or inactive school years'
                  : currentActiveSemester === '1st'
                  ? '1st Semester (MOSY) is currently active'
                  : 'Set active semester to 1st (MOSY)'
              }
            >
              1st (MOSY)
            </button>
            <button
              type="button"
              onClick={() => isSchoolYearActive && handleSetSemester('2nd')}
              disabled={!isSchoolYearActive || isSettingSemester || currentActiveSemester === '2nd'}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${getPhaseButtonClass('2nd')}`}
              title={
                !isSchoolYearActive
                  ? 'Phase setting is disabled for archived or inactive school years'
                  : currentActiveSemester === '2nd'
                  ? '2nd Semester (EOSY) is currently active'
                  : 'Set active semester to 2nd (EOSY)'
              }
            >
              2nd (EOSY)
            </button>
            <button
              type="button"
              onClick={() => isSchoolYearActive && handleSetSemester('summer')}
              disabled={!isSchoolYearActive || isSettingSemester || currentActiveSemester === 'summer'}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${getPhaseButtonClass('summer')}`}
              title={
                !isSchoolYearActive
                  ? 'Phase setting is disabled for archived or inactive school years'
                  : currentActiveSemester === 'summer'
                  ? 'Summer Remediation is currently active'
                  : 'Set active semester to Summer'
              }
            >
              Summer
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading || isSettingSemester}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isSettingSemester ? 'animate-spin' : ''}`} />
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

      {/* ── Loading Skeleton State ────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-5">
          <StatsGridSkeleton count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CardSkeleton rows={4} />
            <CardSkeleton rows={4} />
          </div>
          <TableSkeleton rows={6} cols={4} />
        </div>
      ) : (
        <>
          {/* ── TAB 1: MOSY ──────────────────────────────────────────────────────── */}
          {activeTab === 'mosy' && (
        <div className="space-y-6">
          {/* A. MOSY Evaluation Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tutor Evaluation Stats */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3">
                Tutor Evaluations
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{mosyData?.total_tutors ?? '—'}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Total Tutors</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{mosyData?.completed_tutors ?? '—'}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Completed</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {mosyData ? (mosyData.in_progress_tutors + mosyData.pending_tutors) : '—'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Pending</p>
                </div>
              </div>
            </div>

            {/* Student Evaluation Stats */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3">
                Student Evaluations
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{mosyData?.total_assigned_students ?? '—'}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Total Students</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{mosyData?.total_students_evaluated ?? '—'}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Evaluated</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{mosyData?.students_remaining ?? '—'}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Remaining</p>
                </div>
              </div>
            </div>
          </div>

          {/* MOSY Process Success Alert */}
          {mosyProcessSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{mosyProcessSuccess}</span>
              </div>
              <button type="button" onClick={() => setMosyProcessSuccess(null)} className="p-1 hover:opacity-75">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* B. Pending Evaluations */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-2">
              Pending Tutor Evaluations
            </h2>

            {mosyData && mosyData.incomplete_tutors.length > 0 ? (
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 text-[11px] border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Tutor</th>
                      <th className="py-2 px-4 font-semibold text-center">Evaluated</th>
                      <th className="py-2 px-4 font-semibold text-center">Remaining</th>
                      <th className="py-2 px-4 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {mosyData.incomplete_tutors.map((t) => (
                      <tr key={t.tutor_id}>
                        <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">{t.tutor_name}</td>
                        <td className="py-2.5 px-4 text-center text-slate-700 dark:text-zinc-300">{t.evaluated_count}</td>
                        <td className="py-2.5 px-4 text-center font-medium text-amber-600 dark:text-amber-400">{t.remaining_count}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-zinc-400 py-1 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>All tutor evaluations completed.</span>
              </p>
            )}

            {/* Finalize MOSY Action */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Finalize Mid-Year (MOSY) Evaluation</p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Promotes qualifying Basic students to Plus and releases tutor pairings for second-semester cohorts.
                </p>
              </div>
              <button
                type="button"
                onClick={handleProcessMosy}
                disabled={isProcessingMosy}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 disabled:opacity-50 transition cursor-pointer shrink-0"
              >
                {isProcessingMosy ? 'Processing...' : 'Finalize MOSY'}
              </button>
            </div>
          </div>

          {/* C. Reassignment Queue (Main Focus) */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            {/* Queue Header & Filters */}
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Reassignment Queue ({allQueueItems.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Select students to dispatch in cohorts (15–25) to available tutors.
                </p>
              </div>

              {/* Filter Tabs & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setQueueFilter('all')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      queueFilter === 'all'
                        ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    All ({allQueueItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueueFilter('plus')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      queueFilter === 'plus'
                        ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    Plus ({allQueueItems.filter(s => s.required_program === 'plus').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueueFilter('basic')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                      queueFilter === 'basic'
                        ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    Basic ({allQueueItems.filter(s => s.required_program === 'basic').length})
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    className="pl-8 pr-3 py-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Quick Selection Strip */}
            <div className="px-4 py-2 bg-slate-50/50 dark:bg-zinc-900/40 border-b border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                <span className="font-semibold text-[11px] uppercase tracking-wider">Quick Select:</span>
                <button
                  type="button"
                  onClick={() => handleQuickSelectCount(15)}
                  className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-medium hover:bg-slate-50 cursor-pointer"
                >
                  15
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelectCount(20)}
                  className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-medium hover:bg-slate-50 cursor-pointer"
                >
                  20
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelectCount(25)}
                  className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-medium hover:bg-slate-50 cursor-pointer"
                >
                  25
                </button>
                <button
                  type="button"
                  onClick={handleSelectFilteredAll}
                  className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-medium hover:bg-slate-50 cursor-pointer"
                >
                  All Filtered ({filteredQueueItems.length})
                </button>
              </div>

              {selectedQueueIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Compact Action Bar when students selected */}
            {selectedQueueIds.length > 0 && (
              <div className="px-4 py-2.5 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedQueueIds.length} students selected
                  </span>
                  {selectedLevelCounts.isMixed ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                      Mixed programs ({selectedLevelCounts.basic} Basic, {selectedLevelCounts.plus} Plus). Tutors only teach one level.
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-zinc-400">
                      {selectedLevelCounts.plus > 0 ? 'Plus Program' : 'Basic Program'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsBulkAssignModalOpen(true)}
                  disabled={selectedLevelCounts.isMixed}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  title={selectedLevelCounts.isMixed ? 'Select only Basic or only Plus students' : 'Dispatch cohort to tutor'}
                >
                  Dispatch Cohort
                </button>
              </div>
            )}

            {/* Table */}
            {filteredQueueItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400">
                No unassigned students in queue.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-zinc-900/60 text-slate-400 text-[11px] uppercase border-b border-slate-100 dark:border-zinc-800 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={filteredQueueItems.length > 0 && selectedQueueIds.length >= filteredQueueItems.length}
                          onChange={(e) => {
                            if (e.target.checked) handleSelectFilteredAll();
                            else handleClearSelection();
                          }}
                          className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 font-semibold">Student</th>
                      <th className="py-2.5 px-3 font-semibold">LRN</th>
                      <th className="py-2.5 px-3 font-semibold">Program</th>
                      <th className="py-2.5 px-3 font-semibold">Previous Tutor</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {filteredQueueItems.map((student) => {
                      const isSelected = selectedQueueIds.includes(student.id);

                      return (
                        <tr
                          key={student.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-zinc-900/40 transition ${
                            isSelected ? 'bg-slate-50 dark:bg-zinc-900/60' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectStudent(student.id)}
                              className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                            {student.full_name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-zinc-400">
                            {student.lrn || 'N/A'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              student.required_program === 'plus'
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-900'
                                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                            }`}>
                              {student.required_program}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400">
                            {student.previous_tutor || 'None'}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenHistoryModal(student.id)}
                              className="px-2 py-1 rounded border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                              History
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal({
                                id: student.id,
                                full_name: student.full_name,
                                lrn: student.lrn,
                                program: student.required_program,
                              }, 'MOSY')}
                              className="px-2 py-1 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-semibold hover:opacity-90 cursor-pointer"
                            >
                              Assign
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: EOSY ──────────────────────────────────────────────────────── */}
      {activeTab === 'eosy' && (
        <div className="space-y-6">
          {/* Step 1: Evaluation Completion Status */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  EOSY Evaluation Status
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  100% of student evaluations must be submitted by tutors before starting the new school year.
                </p>
              </div>

              {/* Completion Percentage Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-zinc-400">Progress:</span>
                <span className={`text-base font-bold ${eosyEvaluatedPct === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {eosyEvaluatedPct}% Complete
                </span>
              </div>
            </div>

            {/* Compact Metric Numbers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{eosyData?.total_tutors ?? '—'}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Total Tutors</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{eosyData?.completed_tutors ?? '—'}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Completed Tutors</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{eosyData?.total_students_evaluated ?? '—'}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Students Evaluated</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{eosyData?.students_remaining ?? '—'}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Students Remaining</p>
              </div>
            </div>

            {/* Gate Status Banner */}
            {eosyData && !eosyData.can_transition ? (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Transition Locked</span>
                </div>
                <p className="text-amber-800 dark:text-amber-300">
                  All tutor EOSY evaluations must be completed before starting the new school year.
                </p>

                {/* Incomplete Tutors List */}
                {eosyData.incomplete_tutors.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-900">
                    <p className="font-semibold mb-1.5">Tutors with pending evaluations ({eosyData.incomplete_tutors.length}):</p>
                    <div className="overflow-x-auto mt-2">
                      <table className="w-full text-left text-xs">
                        <thead className="text-amber-900/60 dark:text-amber-300/60 text-[11px] border-b border-amber-200/80 dark:border-amber-900/60">
                          <tr>
                            <th className="py-1.5 pr-4 font-semibold">Tutor</th>
                            <th className="py-1.5 px-4 font-semibold text-center">Evaluated</th>
                            <th className="py-1.5 px-4 font-semibold text-center">Remaining</th>
                            <th className="py-1.5 px-4 font-semibold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-200/40 dark:divide-amber-900/40">
                          {eosyData.incomplete_tutors.map((t) => (
                            <tr key={t.tutor_id}>
                              <td className="py-2 pr-4 font-medium text-amber-950 dark:text-amber-100">{t.tutor_name}</td>
                              <td className="py-2 px-4 text-center">{t.evaluated_count}</td>
                              <td className="py-2 px-4 text-center font-bold text-amber-700 dark:text-amber-300">{t.remaining_count}</td>
                              <td className="py-2 px-4 text-center">
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/80 dark:bg-zinc-900 border border-amber-300 dark:border-amber-800">
                                  {t.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Ready for Transition</span>
                </div>
                <p className="text-emerald-800 dark:text-emerald-300">
                  All EOSY evaluations are complete. The next school year can now be activated.
                </p>
              </div>
            )}
          </div>

          {/* Success Transition Alert */}
          {transitionSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{transitionSuccessMsg}</span>
              </div>
              <button type="button" onClick={() => setTransitionSuccessMsg(null)} className="p-1 hover:opacity-75">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Step 2: Primary Action — Start New School Year */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Start New School Year
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Advances the school year, archives current records, and transitions students based on evaluation results.
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsTransitionModalOpen(true)}
                disabled={!eosyData?.can_transition}
                className="px-5 py-2.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer shrink-0 shadow-xs border bg-[#0052B7] text-white border-[#0052B7] hover:bg-[#004194] dark:bg-white dark:text-slate-900 dark:border-white dark:hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-300 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 dark:disabled:border-zinc-700 disabled:shadow-none disabled:cursor-not-allowed"
              >
                Start New School Year ({eosyData?.next_school_year || 'Next Year'})
              </button>
              {!eosyData?.can_transition && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                  Evaluations must reach 100% completion first.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: SUMMER ────────────────────────────────────────────────────── */}
      {activeTab === 'summer' && (
        <div className="space-y-5">
          {/* Summary Stats */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3">
              Summer Remediation Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{summerStats.total}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Total Referred</p>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{summerStats.required}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Required</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{summerStats.inProgress}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">In Progress</p>
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{summerStats.completed}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Completed</p>
              </div>
            </div>
          </div>

          {/* Student Table */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            {summerRecords.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400">
                No students currently referred to summer remediation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-zinc-900/60 text-slate-400 text-[11px] uppercase border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Student</th>
                      <th className="py-2.5 px-3 font-semibold">LRN</th>
                      <th className="py-2.5 px-3 font-semibold">Reason</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Outcome</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {summerRecords.map((sr) => (
                      <tr key={sr.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/30">
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          {sr.student_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-zinc-400">
                          {sr.student_lrn}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                          {sr.reason_display}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="capitalize text-slate-700 dark:text-zinc-300">
                            {sr.status_display}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            sr.summer_result === 'passed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : sr.summer_result === 'failed'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {sr.summer_result || 'Pending'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryModal(sr.student)}
                            className="px-2 py-1 rounded border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            History
                          </button>
                          {sr.summer_status === 'summer_required' && (
                            <button
                              type="button"
                              onClick={() => handleStartSummer(sr.id)}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-[11px] font-semibold hover:bg-slate-200 cursor-pointer"
                            >
                              Start
                            </button>
                          )}
                          {sr.summer_status !== 'summer_completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSummerRecord(sr);
                                setIsSummerModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-semibold hover:opacity-90 cursor-pointer"
                            >
                              Record Evaluation
                            </button>
                          )}
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

      {/* ── TAB 4: ARCHIVE ───────────────────────────────────────────────────── */}
      {activeTab === 'archive' && (
        <div className="space-y-4">
          {/* Header & School Year Selector */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                School Year Archive
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Read-only records preserved from past school years.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">School Year:</label>
              <select
                value={selectedArchiveYear}
                onChange={(e) => {
                  setSelectedArchiveYear(e.target.value);
                  loadArchiveSnapshot(e.target.value);
                }}
                className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
              >
                {archivedYears.map((ay) => (
                  <option key={ay.id} value={ay.school_year}>
                    SY {ay.school_year} ({ay.is_active ? 'Active' : 'Archived'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            {isLoadingArchiveDetail ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400">
                Loading archived records...
              </div>
            ) : archiveSnapshot && archiveSnapshot.records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-zinc-900/60 text-slate-400 text-[11px] uppercase border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Student</th>
                      <th className="py-2.5 px-3 font-semibold">LRN</th>
                      <th className="py-2.5 px-3 font-semibold">Grade</th>
                      <th className="py-2.5 px-3 font-semibold">Program</th>
                      <th className="py-2.5 px-3 font-semibold">Tutor</th>
                      <th className="py-2.5 px-3 font-semibold">MOSY</th>
                      <th className="py-2.5 px-3 font-semibold">EOSY</th>
                      <th className="py-2.5 px-3 font-semibold">Outcome</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {archiveSnapshot.records.map((st) => (
                      <tr key={st.enrollment_id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/30">
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          {st.student_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-zinc-400">
                          {st.lrn || 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400">
                          {st.grade_level}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-slate-600 dark:text-zinc-400">
                          {st.program}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-zinc-300">
                          {st.assigned_tutor}
                        </td>
                        <td className="py-2.5 px-3 capitalize text-slate-600 dark:text-zinc-400">
                          {st.mosy_result}
                        </td>
                        <td className="py-2.5 px-3 capitalize text-slate-600 dark:text-zinc-400">
                          {st.eosy_result}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-zinc-300">
                          {st.final_result}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryModal(st.student_id)}
                            className="px-2 py-1 rounded border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            History
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400">
                No archived records found for SY {selectedArchiveYear}.
              </div>
            )}
          </div>
        </div>
      )}
        </>
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
        selectedStudents={selectedStudentsForCohort}
        period="MOSY"
        onDispatched={handleCohortDispatched}
      />
    </div>
  );
};
