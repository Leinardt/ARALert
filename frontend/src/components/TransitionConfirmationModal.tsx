import React, { useState, useEffect } from 'react';
import {
  X, AlertTriangle, ArrowRight, ShieldCheck, CheckCircle2,
  Calendar, Users, Award, Sun, Sparkles, RefreshCw, AlertCircle
} from 'lucide-react';
import { academicService } from '../services/academicService';
import type { TransitionSummaryPreview } from '../types';

interface TransitionConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

export const TransitionConfirmationModal: React.FC<TransitionConfirmationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [summary, setSummary] = useState<TransitionSummaryPreview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmed(false);
      setError(null);
      fetchSummary();
    }
  }, [isOpen]);

  const fetchSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await academicService.getTransitionSummaryPreview();
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to fetch transition summary:', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to load transition preview.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteTransition = async () => {
    if (!confirmed) return;
    setIsExecuting(true);
    setError(null);
    try {
      const result = await academicService.startNewSchoolYear();
      onSuccess(result);
      onClose();
    } catch (err: any) {
      console.error('Failed to execute school year transition:', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to transition to new school year.');
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                School Year Transition Preview
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                11-Step Atomic Database Transition & Historical Archiving
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* School Year Transition Indicator */}
        {summary && (
          <div className="px-5 py-3.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-purple-50/80 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 border-b border-slate-200 dark:border-zinc-800 shrink-0">
            <div className="flex items-center justify-center gap-3 text-sm font-bold">
              <span className="px-3 py-1 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 shadow-xs">
                SY {summary.current_school_year} (Concluding)
              </span>
              <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white shadow-xs">
                SY {summary.next_school_year} (New Active Year)
              </span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[var(--brand)]" />
              <span>Analyzing student progress and computing 11-step transition projections...</span>
            </div>
          ) : summary ? (
            <>
              {/* Student Movement Grid */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Student Progression Projections</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
                    <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                      Basic &rarr; Plus (Promoted)
                    </p>
                    <p className="text-xl font-extrabold text-purple-950 dark:text-purple-200 mt-0.5">
                      {summary.student_movement.basic_to_plus}
                    </p>
                    <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-1">
                      Promoted to Plus for {summary.next_school_year}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                      Plus &rarr; Graduated
                    </p>
                    <p className="text-xl font-extrabold text-emerald-950 dark:text-emerald-200 mt-0.5">
                      {summary.student_movement.plus_to_graduated}
                    </p>
                    <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                      Completed ARAL Program
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40">
                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                      Basic &rarr; Basic (Retained)
                    </p>
                    <p className="text-xl font-extrabold text-blue-950 dark:text-blue-200 mt-0.5">
                      {summary.student_movement.basic_to_basic}
                    </p>
                    <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-1">
                      Continues in Basic (1st year failed)
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                      Basic &rarr; Summer Remediation
                    </p>
                    <p className="text-xl font-extrabold text-amber-950 dark:text-amber-200 mt-0.5">
                      {summary.student_movement.basic_to_summer_required}
                    </p>
                    <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1">
                      Failed Basic twice historically
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
                    <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                      Plus &rarr; Summer Remediation
                    </p>
                    <p className="text-xl font-extrabold text-rose-950 dark:text-rose-200 mt-0.5">
                      {summary.student_movement.plus_to_summer_required}
                    </p>
                    <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-1">
                      Failed EOSY evaluation in Plus
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      Dropped / Inactive
                    </p>
                    <p className="text-xl font-extrabold text-slate-800 dark:text-zinc-200 mt-0.5">
                      {summary.student_movement.dropped_inactive}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Inactive enrollments preserved
                    </p>
                  </div>
                </div>
              </div>

              {/* Zero-Capacity Tutor Deployment Projections */}
              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Tutor Availability Projections (Zero-Capacity System)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Basic Program Tutors</span>
                      <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                        {summary.tutor_assignment.basic_tutors} Certified Tutors
                      </span>
                    </div>
                    <div className="mt-2 text-xs space-y-1 text-slate-600 dark:text-zinc-400">
                      <div className="flex justify-between">
                        <span>Available for additional students:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {summary.tutor_assignment.basic_tutors_available_for_additional_students}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unassigned Basic Students:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {summary.tutor_assignment.unassigned_basic_students}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Plus Program Tutors</span>
                      <span className="text-xs font-extrabold text-purple-600 dark:text-purple-400">
                        {summary.tutor_assignment.plus_tutors} Certified Tutors
                      </span>
                    </div>
                    <div className="mt-2 text-xs space-y-1 text-slate-600 dark:text-zinc-400">
                      <div className="flex justify-between">
                        <span>Available for additional students:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {summary.tutor_assignment.plus_tutors_available_for_additional_students}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unassigned Plus Students:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {summary.tutor_assignment.unassigned_plus_students}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Atomic Safety Notice */}
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">Transaction Safety & Historical Integrity</p>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    Executing this transition runs all 11 atomic database operations within an isolated transaction.
                    Past enrollments and tutor assignments for SY {summary.current_school_year} will be permanently archived in read-only mode and NEVER overwritten.
                    If any step fails, all operations will automatically roll back.
                  </p>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[var(--brand)] focus:ring-[var(--brand)]"
                  />
                  <span className="text-xs text-slate-700 dark:text-zinc-300 font-medium">
                    I confirm that all EOSY evaluations are finalized. I authorize the immediate closure of School Year {summary.current_school_year} and activation of School Year {summary.next_school_year}.
                  </span>
                </label>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-900/60 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteTransition}
            disabled={!confirmed || isExecuting || isLoading}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {isExecuting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Executing 11-Step Transition...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Execute School Year Transition</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
