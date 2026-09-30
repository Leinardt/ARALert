import React, { useState, useEffect } from 'react';
import { X, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
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

  const totalSummer = summary
    ? (summary.student_movement.basic_to_summer_required + summary.student_movement.plus_to_summer_required)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-950">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Start New School Year Transition
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Review projected outcomes before executing the transition.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transition Year Banner */}
        {summary && (
          <div className="px-5 py-3 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-center gap-3 text-xs font-semibold">
            <span className="text-slate-600 dark:text-zinc-400">
              Conclude: <strong className="text-slate-900 dark:text-white font-bold">SY {summary.current_school_year}</strong>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600 dark:text-zinc-400">
              Activate: <strong className="text-slate-900 dark:text-white font-bold">SY {summary.next_school_year}</strong>
            </span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-zinc-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-600" />
              <span>Calculating student projections...</span>
            </div>
          ) : summary ? (
            <>
              {/* Projected Outcomes Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                  Projected Student Outcomes
                </h3>
                <div className="rounded-lg border border-slate-200 dark:border-zinc-800 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-900/60 text-slate-400 text-[11px] uppercase border-b border-slate-200 dark:border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Outcome</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Students</th>
                        <th className="py-2.5 px-3 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          Basic &rarr; Plus
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {summary.student_movement.basic_to_plus}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400">
                          Promoted to Plus Program
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          Plus &rarr; Graduated
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {summary.student_movement.plus_to_graduated}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400">
                          Completed ARAL Program
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          Retained in Basic
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {summary.student_movement.basic_to_basic}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400">
                          Continues in Basic Program
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          Summer Remediation
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {totalSummer}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400">
                          Basic failed twice ({summary.student_movement.basic_to_summer_required}), Plus failed EOSY ({summary.student_movement.plus_to_summer_required})
                        </td>
                      </tr>
                      {summary.student_movement.dropped_inactive > 0 && (
                        <tr>
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                            Inactive / Dropped
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                            {summary.student_movement.dropped_inactive}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400">
                            Preserved in historical archive
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Compact Tutor Availability Summary */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                  Tutor Deployment Capacity
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                    <p className="font-bold text-slate-900 dark:text-white">Basic Program</p>
                    <p className="text-slate-500 dark:text-zinc-400 mt-1">
                      {summary.tutor_assignment.basic_tutors} Tutors &bull; {summary.tutor_assignment.basic_tutors_available_for_additional_students} Available
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                    <p className="font-bold text-slate-900 dark:text-white">Plus Program</p>
                    <p className="text-slate-500 dark:text-zinc-400 mt-1">
                      {summary.tutor_assignment.plus_tutors} Tutors &bull; {summary.tutor_assignment.plus_tutors_available_for_additional_students} Available
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
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
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteTransition}
            disabled={!confirmed || isExecuting || isLoading}
            className="px-4 py-2 rounded-lg text-xs font-bold transition duration-150 cursor-pointer shrink-0 shadow-xs border bg-[#0052B7] text-white border-[#0052B7] hover:bg-[#004194] dark:bg-white dark:text-slate-900 dark:border-white dark:hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-300 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 dark:disabled:border-zinc-700 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {isExecuting ? 'Executing Transition...' : 'Execute School Year Transition'}
          </button>
        </div>
      </div>
    </div>
  );
};
