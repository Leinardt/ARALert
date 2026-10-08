import React, { useState, useEffect } from 'react';
import {
  X, History, Calendar, Award, User, Clock, CheckCircle2,
  AlertCircle, ShieldCheck, Sun, BookOpen, Layers
} from 'lucide-react';
import { academicService } from '../services/academicService';
import type { StudentCompleteHistory } from '../types';

interface StudentProfileHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  studentName?: string;
}

export const StudentProfileHistoryModal: React.FC<StudentProfileHistoryModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName,
}) => {
  const [history, setHistory] = useState<StudentCompleteHistory | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'enrollments' | 'tutors' | 'summer'>('enrollments');

  useEffect(() => {
    if (isOpen && studentId) {
      fetchHistory(studentId);
    }
  }, [isOpen, studentId]);

  const fetchHistory = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await academicService.getStudentCompleteHistory(id);
      setHistory(data);
    } catch (err: any) {
      console.error('Failed to load student history:', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to load student academic history.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !studentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Academic History & Audit Log
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Non-overwriting multi-year academic and tutor timeline
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Banner */}
        {history && (
          <div className="px-5 py-3.5 bg-slate-100/60 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {history.full_name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  LRN: <span className="font-mono">{history.lrn || 'N/A'}</span> &bull; Current Tutor: {history.current_tutor}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold uppercase">
                  {history.current_level}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold">
                  {history.enrollment_history.length} School Year{history.enrollment_history.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="px-5 py-2.5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('enrollments')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'enrollments'
                ? 'bg-[var(--brand)] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>School Year Enrollments ({history?.enrollment_history.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tutors')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'tutors'
                ? 'bg-[var(--brand)] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Tutor Assignments ({history?.tutor_history.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summer')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'summer'
                ? 'bg-[var(--brand)] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Summer Remediation ({history?.summer_history.length || 0})</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
              Loading student timeline and permanent academic records...
            </div>
          ) : history ? (
            <>
              {/* Tab 1: Enrollments */}
              {activeTab === 'enrollments' && (
                <div className="space-y-3">
                  {history.enrollment_history.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No historical enrollments found.
                    </div>
                  ) : (
                    history.enrollment_history.map((en, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                              SY {en.school_year}
                            </span>
                            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                              {en.grade_level}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase ${
                                en.program.toLowerCase() === 'plus'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              }`}
                            >
                              {en.program}
                            </span>
                          </div>

                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-semibold capitalize">
                            Status: {en.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-xs">
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block font-bold">Assigned Tutor</span>
                            <span className="font-semibold text-slate-800 dark:text-zinc-200">{en.tutor_name}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block font-bold">MOSY Result</span>
                            <span className={`font-semibold capitalize ${
                              en.mosy_result.toLowerCase() === 'passed' ? 'text-emerald-600' : en.mosy_result.toLowerCase() === 'failed' ? 'text-rose-600' : 'text-slate-600'
                            }`}>
                              {en.mosy_result}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block font-bold">EOSY Result</span>
                            <span className={`font-semibold capitalize ${
                              en.eosy_result.toLowerCase() === 'passed' ? 'text-emerald-600' : en.eosy_result.toLowerCase() === 'failed' ? 'text-rose-600' : 'text-slate-600'
                            }`}>
                              {en.eosy_result}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block font-bold">Progression</span>
                            <span className="font-semibold text-slate-800 dark:text-zinc-200 capitalize">
                              {en.graduation_status !== 'Not Eligible' ? en.graduation_status : en.summer_status !== 'None' ? en.summer_status : 'Standard'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 2: Tutor Assignments */}
              {activeTab === 'tutors' && (
                <div className="space-y-3">
                  {history.tutor_history.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No tutor assignment history recorded.
                    </div>
                  ) : (
                    history.tutor_history.map((ta, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {ta.tutor_name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold uppercase">
                              {ta.period}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ta.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-zinc-800'
                            }`}>
                              {ta.is_active ? 'Active' : 'Archived'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                            SY {ta.school_year} &bull; Program: <span className="uppercase font-semibold">{ta.program}</span> &bull; {ta.start_date} &rarr; {ta.end_date || 'Present'}
                          </p>
                          {ta.notes && (
                            <p className="text-[11px] text-slate-400 mt-1 italic">
                              "{ta.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: Summer Remediation */}
              {activeTab === 'summer' && (
                <div className="space-y-3">
                  {history.summer_history.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No summer remediation records for this student.
                    </div>
                  ) : (
                    history.summer_history.map((sr, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-amber-500 text-white">
                              SY {sr.school_year} Summer
                            </span>
                            <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                              {sr.reason}
                            </span>
                          </div>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold capitalize ${
                            sr.result.toLowerCase() === 'passed'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : sr.result.toLowerCase() === 'failed'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {sr.result ? `Evaluation: ${sr.result}` : `Status: ${sr.status}`}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400 flex flex-wrap items-center gap-3 pt-1">
                          <span>Evaluator: <strong>{sr.evaluator}</strong></span>
                          <span>&bull;</span>
                          <span>Timeline: {sr.start_date || 'N/A'} &rarr; {sr.completion_date || 'In Progress'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-zinc-900/60 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Permanent Academic Record: Past school years are strictly immutable.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-300 dark:hover:bg-zinc-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
