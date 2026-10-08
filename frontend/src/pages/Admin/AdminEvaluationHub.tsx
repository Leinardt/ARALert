import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckCircle2, Clock, AlertTriangle, AlertCircle,
  Users, UserCheck, Shield, ChevronRight, Award, Sun, History,
  RefreshCw, ArrowRight, Sparkles, Filter, Search, Eye, X
} from 'lucide-react';
import { academicService } from '../../services/academicService';
import { AssignTutorModal } from '../../components/AssignTutorModal';
import { TransitionConfirmationModal } from '../../components/TransitionConfirmationModal';
import { EvaluateSummerModal } from '../../components/EvaluateSummerModal';
import { StudentProfileHistoryModal } from '../../components/StudentProfileHistoryModal';
import type {
  MosyMonitoringData,
  MosyAssignmentData,
  EosyMonitoringData,
  SummerRecord,
  SchoolYear,
  ArchivedSchoolYearSnapshot
} from '../../types';

export const AdminEvaluationHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mosy' | 'eosy' | 'summer' | 'archive'>('mosy');
  const [currentSY, setCurrentSY] = useState<SchoolYear | null>(null);

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
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sy, mosy, mosyAssign, eosy, summer, archives] = await Promise.all([
        academicService.getCurrentSchoolYear().catch(() => null),
        academicService.getMosyMonitoring().catch(() => null),
        academicService.getMosyAssignments().catch(() => null),
        academicService.getEosyMonitoring().catch(() => null),
        academicService.getSummerList().catch(() => []),
        academicService.getArchivedSchoolYears().catch(() => []),
      ]);

      setCurrentSY(sy);
      setMosyData(mosy);
      setMosyAssignments(mosyAssign);
      setEosyData(eosy);
      setSummerRecords(summer);
      setArchivedYears(archives);

      if (archives.length > 0 && !selectedArchiveYear) {
        setSelectedArchiveYear(archives[0].school_year);
        loadArchiveSnapshot(archives[0].school_year);
      }
    } catch (err: any) {
      console.error('Failed to load evaluation hub data:', err);
      setError('Failed to load school year and evaluation monitoring records.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadInitialData();
  };

  const handleProcessMosy = async () => {
    if (!window.confirm('Are you sure you want to finalize the MOSY period? This will promote qualifying students to the Plus program and mark Plus students as unassigned for strict tutor matching.')) {
      return;
    }
    setIsProcessingMosy(true);
    setMosyProcessSuccess(null);
    try {
      const res = await academicService.processMosyCompletion();
      setMosyProcessSuccess(res.message);
      // Refresh MOSY data
      const [m, ma] = await Promise.all([
        academicService.getMosyMonitoring(),
        academicService.getMosyAssignments(),
      ]);
      setMosyData(m);
      setMosyAssignments(ma);
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

  return (
    <div className="flex flex-col gap-4 p-2 sm:p-4 max-w-7xl mx-auto w-full animate-fade-in">
      {/* ── Top Header & Current Year Banner ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              Evaluation & Transition Hub
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Active: SY {currentSY?.school_year || '2025-2026'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            MOSY Reassignment &bull; EOSY Gate & 11-Step Transition &bull; Summer Remediation &bull; Zero Capacity Management
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('mosy')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'mosy'
              ? 'bg-[var(--brand)] text-white shadow-xs'
              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>MOSY Evaluation & Reassignments</span>
          {mosyAssignments && mosyAssignments.unassigned_plus_students.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-extrabold">
              {mosyAssignments.unassigned_plus_students.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('eosy')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'eosy'
              ? 'bg-[var(--brand)] text-white shadow-xs'
              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>EOSY & School Year Transition</span>
          {eosyData && !eosyData.can_transition && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('summer')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'summer'
              ? 'bg-[var(--brand)] text-white shadow-xs'
              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
          }`}
        >
          <Sun className="w-4 h-4" />
          <span>Summer Remediation</span>
          {summerRecords.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
              {summerRecords.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'archive'
              ? 'bg-[var(--brand)] text-white shadow-xs'
              : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>School Year Archive</span>
        </button>
      </div>

      {/* ── Tab 1: MOSY Evaluation & Reassignment ── */}
      {activeTab === 'mosy' && (
        <div className="space-y-4">
          {/* MOSY Stats Cards */}
          {mosyData && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A]">
                <p className="text-[10px] font-bold uppercase text-slate-400">Total Tutors</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{mosyData.total_tutors}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20">
                <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Tutors Completed</p>
                <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">{mosyData.completed_tutors}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20">
                <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">In Progress</p>
                <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">{mosyData.in_progress_tutors}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A]">
                <p className="text-[10px] font-bold uppercase text-slate-400">Total Students</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{mosyData.total_assigned_students}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20">
                <p className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Evaluated</p>
                <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">{mosyData.total_students_evaluated}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20">
                <p className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Remaining</p>
                <p className="text-xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">{mosyData.students_remaining}</p>
              </div>
            </div>
          )}

          {/* Action Alerts */}
          {mosyProcessSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">{mosyProcessSuccess}</span>
              </div>
              <button type="button" onClick={() => setMosyProcessSuccess(null)} className="p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Incomplete Tutors Warning Banner */}
          {mosyData && mosyData.incomplete_tutors.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Tutors with Pending MOSY Evaluations ({mosyData.incomplete_tutors.length})
                  </h3>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5">
                    The following tutors have not completed MOSY score evaluations for all their assigned students:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mosyData.incomplete_tutors.map((t) => (
                      <span
                        key={t.tutor_id}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-800/60 text-xs text-slate-800 dark:text-zinc-200 font-medium flex items-center gap-1.5"
                      >
                        <strong>{t.tutor_name}</strong>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                          ({t.evaluated_count}/{t.assigned_students_count} evaluated)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Finalize MOSY Period Action Banner */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Finalize Mid-Year (MOSY) Evaluation Period
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Evaluates student scores: Promotes qualifying Basic students to Plus, marks Plus students as unassigned awaiting Plus tutors, and retains Basic students with compatible Basic tutors.
              </p>
            </div>
            <button
              type="button"
              onClick={handleProcessMosy}
              disabled={isProcessingMosy}
              className="px-4 py-2 rounded-xl bg-[var(--brand)] hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              {isProcessingMosy ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing MOSY...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Finalize MOSY Period</span>
                </>
              )}
            </button>
          </div>

          {/* ── Table 1: Unassigned Plus Students (Action Required) ── */}
          <div className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-[#0A0A0A] overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-purple-50/60 dark:bg-purple-950/20 border-b border-purple-100 dark:border-purple-900/40 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-purple-900 dark:text-purple-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                  <span>Unassigned Plus Students &mdash; Strict Tutor Matching Required</span>
                </h3>
                <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 mt-0.5">
                  Students promoted or enrolled in Plus program must be assigned strictly to Plus or Basic & Plus certified tutors.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                {mosyAssignments?.unassigned_plus_students.length || 0} Awaiting Tutor
              </span>
            </div>

            {mosyAssignments && mosyAssignments.unassigned_plus_students.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-slate-700 dark:text-zinc-300">All Plus students currently have assigned tutors!</p>
                <p className="text-[11px] mt-0.5">No unassigned Plus students pending assignment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-900/40 text-slate-400 text-[10px] uppercase border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Student Name</th>
                      <th className="py-2.5 px-4 font-bold">LRN</th>
                      <th className="py-2.5 px-4 font-bold">Program</th>
                      <th className="py-2.5 px-4 font-bold">MOSY Score</th>
                      <th className="py-2.5 px-4 font-bold">Previous Tutor</th>
                      <th className="py-2.5 px-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {mosyAssignments?.unassigned_plus_students.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/30">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {student.full_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400">
                          {student.lrn || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                            {student.program}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-emerald-600">
                            {student.mosy_score_pct != null ? `${student.mosy_score_pct}%` : 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                          {student.previous_tutor || 'None'}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryModal(student.id)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          >
                            History
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(student, 'MOSY')}
                            className="px-3 py-1 rounded-lg bg-[var(--brand)] hover:opacity-90 text-white text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Assign Plus Tutor</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Table 2: Basic Students (Assigned) ── */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                  Basic Program Students ({mosyAssignments?.basic_students.length || 0})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Basic students retain their compatible Basic or Basic & Plus certified tutors across the mid-year period.
                </p>
              </div>
            </div>

            {mosyAssignments && mosyAssignments.basic_students.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No active Basic students found for current school year.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-900/40 text-slate-400 text-[10px] uppercase sticky top-0 border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Student Name</th>
                      <th className="py-2.5 px-4 font-bold">LRN</th>
                      <th className="py-2.5 px-4 font-bold">Assigned Tutor</th>
                      <th className="py-2.5 px-4 font-bold">MOSY Status</th>
                      <th className="py-2.5 px-4 font-bold">MOSY Result</th>
                      <th className="py-2.5 px-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {mosyAssignments?.basic_students.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/30">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {student.full_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400">
                          {student.lrn || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-slate-800 dark:text-zinc-200 font-medium">
                          {student.current_tutor}
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize text-slate-600 dark:text-zinc-400">
                            {student.mosy_status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            student.mosy_result === 'passed'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : student.mosy_result === 'failed'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {student.mosy_result}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryModal(student.id)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          >
                            History
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(student, 'MOSY')}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          >
                            Reassign
                          </button>
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

      {/* ── Tab 2: EOSY Evaluation & Progression Transition ── */}
      {activeTab === 'eosy' && (
        <div className="space-y-4">
          {/* EOSY Stats Cards */}
          {eosyData && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A]">
                <p className="text-[10px] font-bold uppercase text-slate-400">Total Tutors</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{eosyData.total_tutors}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20">
                <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Tutors Completed</p>
                <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">{eosyData.completed_tutors}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20">
                <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">In Progress</p>
                <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">{eosyData.in_progress_tutors}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A]">
                <p className="text-[10px] font-bold uppercase text-slate-400">Total Students</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{eosyData.total_assigned_students}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20">
                <p className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Evaluated</p>
                <p className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">{eosyData.total_students_evaluated}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20">
                <p className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Remaining</p>
                <p className="text-xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">{eosyData.students_remaining}</p>
              </div>
            </div>
          )}

          {/* Success Transition Alert */}
          {transitionSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-sm">School Year Transition Successful!</p>
                  <p className="mt-0.5">{transitionSuccessMsg}</p>
                </div>
              </div>
              <button type="button" onClick={() => setTransitionSuccessMsg(null)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── EOSY GATE ENFORCEMENT BANNER ── */}
          {eosyData && !eosyData.can_transition ? (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 p-5 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-amber-950 dark:text-amber-200 uppercase tracking-wide flex items-center gap-2">
                      <span>EOSY Gate Enforced &mdash; Transition Locked</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                        100% Completion Required
                      </span>
                    </h3>
                  </div>
                  <p className="text-xs text-amber-900/90 dark:text-amber-200/90 mt-1 leading-relaxed">
                    {eosyData.warning_message || 'The next school year cannot be started until 100% of required EOSY student evaluations have been finalized by tutors. Both frontend controls and database transactions strictly reject premature transition.'}
                  </p>

                  {/* List of incomplete tutors */}
                  {eosyData.incomplete_tutors.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-amber-200/80 dark:border-amber-900/60">
                      <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                        Tutors with Incomplete Evaluations ({eosyData.incomplete_tutors.length}):
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {eosyData.incomplete_tutors.map((t) => (
                          <div
                            key={t.tutor_id}
                            className="px-3 py-1.5 rounded-xl bg-white/90 dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 text-xs text-slate-800 dark:text-zinc-200 flex items-center gap-2"
                          >
                            <span className="font-bold">{t.tutor_name}</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold">
                              {t.evaluated_count}/{t.assigned_students_count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 flex items-start gap-3.5 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-emerald-950 dark:text-emerald-200 uppercase tracking-wide">
                  EOSY Gate Satisfied &mdash; 100% Completed
                </h3>
                <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90 mt-1">
                  All assigned students have been evaluated by their respective tutors. The system is ready to safely execute the 11-step atomic database transition to SY {eosyData?.next_school_year}.
                </p>
              </div>
            </div>
          )}

          {/* Transition Execution Control Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Start New School Year & Advance Academic Cohort
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 max-w-2xl">
                Executes the 11-step atomic transition: archives SY {eosyData?.current_school_year}, graduates eligible Plus students, transitions continuing students, assigns summer remediation, and establishes new baseline rosters.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsTransitionModalOpen(true)}
              disabled={!eosyData?.can_transition}
              title={!eosyData?.can_transition ? 'Disabled: 100% of EOSY evaluations required' : 'Proceed to transition preview'}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start New School Year ({eosyData?.next_school_year || 'Next Year'})</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Tab 3: Summer Remediation Program ── */}
      {activeTab === 'summer' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2">
                <Sun className="w-5 h-5 text-amber-500" />
                <span>Summer Remediation Program Roster</span>
              </h2>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Eligibility: Basic students failed twice historically &bull; Plus students failed EOSY evaluation &bull; Interventions track separately from standard school year
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
              {summerRecords.length} Student{summerRecords.length === 1 ? '' : 's'} Referred
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] overflow-hidden shadow-xs">
            {summerRecords.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <Sun className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-60" />
                <p className="font-bold text-slate-700 dark:text-zinc-300">No students currently in summer remediation</p>
                <p className="text-[11px] mt-0.5">Students who fail EOSY or fail Basic twice will be automatically referred here during transition.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-900/40 text-slate-400 text-[10px] uppercase border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Student Name</th>
                      <th className="py-2.5 px-4 font-bold">LRN</th>
                      <th className="py-2.5 px-4 font-bold">Referral Reason</th>
                      <th className="py-2.5 px-4 font-bold">Status</th>
                      <th className="py-2.5 px-4 font-bold">Evaluation</th>
                      <th className="py-2.5 px-4 font-bold">Evaluator</th>
                      <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {summerRecords.map((sr) => (
                      <tr key={sr.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/30">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {sr.student_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400">
                          {sr.student_lrn}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            {sr.reason_display}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize text-slate-700 dark:text-zinc-300 font-medium">
                            {sr.status_display}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            sr.summer_result === 'passed'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : sr.summer_result === 'failed'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {sr.summer_result || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                          {sr.evaluator_name || 'Unassigned'}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryModal(sr.student)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          >
                            History
                          </button>
                          {sr.summer_status === 'summer_required' && (
                            <button
                              type="button"
                              onClick={() => handleStartSummer(sr.id)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold transition cursor-pointer shadow-xs"
                            >
                              Start Remediation
                            </button>
                          )}
                          {sr.summer_status !== 'summer_completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSummerRecord(sr);
                                setIsSummerModalOpen(true);
                              }}
                              className="px-3 py-1 rounded-lg bg-[var(--brand)] hover:opacity-90 text-white text-[11px] font-bold transition cursor-pointer shadow-xs"
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

      {/* ── Tab 4: School Year Archive ── */}
      {activeTab === 'archive' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                <span>Read-Only School Year Historical Archive</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Permanent snapshots preserving exact historical tutor assignments, enrollments, and evaluation results.
              </p>
            </div>

            {/* School Year Dropdown Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Select School Year:</span>
              <select
                value={selectedArchiveYear}
                onChange={(e) => {
                  setSelectedArchiveYear(e.target.value);
                  loadArchiveSnapshot(e.target.value);
                }}
                className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              >
                {archivedYears.map((ay) => (
                  <option key={ay.id} value={ay.school_year}>
                    SY {ay.school_year} ({ay.is_active ? 'Active' : 'Archived'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Archive Snapshot View */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-900/40 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Snapshot for SY {selectedArchiveYear}
                </span>
                <span className="text-xs text-slate-400 ml-2">
                  ({archiveSnapshot?.total_students || 0} student records archived)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                <span>Read-Only Historical Record</span>
              </span>
            </div>

            {isLoadingArchiveDetail ? (
              <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
                Loading archived snapshot for SY {selectedArchiveYear}...
              </div>
            ) : archiveSnapshot && archiveSnapshot.records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-900/40 text-slate-400 text-[10px] uppercase border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-4 font-bold">Student Name</th>
                      <th className="py-2.5 px-4 font-bold">LRN</th>
                      <th className="py-2.5 px-4 font-bold">Grade</th>
                      <th className="py-2.5 px-4 font-bold">Program</th>
                      <th className="py-2.5 px-4 font-bold">Archived Tutor</th>
                      <th className="py-2.5 px-4 font-bold">MOSY</th>
                      <th className="py-2.5 px-4 font-bold">EOSY</th>
                      <th className="py-2.5 px-4 font-bold">Outcome</th>
                      <th className="py-2.5 px-4 font-bold text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {archiveSnapshot.records.map((st) => (
                      <tr key={st.enrollment_id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/30">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {st.student_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400">
                          {st.lrn || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                          {st.grade_level}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            st.program.toLowerCase() === 'plus'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}>
                            {st.program}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-zinc-200">
                          {st.assigned_tutor}
                        </td>
                        <td className="py-3 px-4 capitalize text-slate-600 dark:text-zinc-400">
                          {st.mosy_result}
                        </td>
                        <td className="py-3 px-4 capitalize text-slate-600 dark:text-zinc-400">
                          {st.eosy_result}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                            {st.final_result}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryModal(st.student_id)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          >
                            Full History
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No archived student enrollments found for SY {selectedArchiveYear}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sub-Modals ── */}
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
    </div>
  );
};
