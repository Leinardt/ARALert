import React, { useState } from 'react';
import {
  X, Check, AlertCircle, Award, Sun, CheckCircle2, Shield
} from 'lucide-react';
import { academicService } from '../services/academicService';
import type { SummerRecord } from '../types';

interface EvaluateSummerModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: SummerRecord | null;
  onEvaluated: () => void;
}

export const EvaluateSummerModal: React.FC<EvaluateSummerModalProps> = ({
  isOpen,
  onClose,
  record,
  onEvaluated,
}) => {
  const [result, setResult] = useState<'passed' | 'failed'>('passed');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !record) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await academicService.evaluateSummerStudent(record.id, {
        result,
        notes,
      });
      onEvaluated();
      onClose();
    } catch (err: any) {
      console.error('Failed to submit summer evaluation:', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to submit summer evaluation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Record Summer Evaluation
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Finalize remediation assessment outcome
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Info */}
        <div className="px-5 py-3.5 bg-slate-100/60 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800">
          <p className="text-xs text-slate-500 dark:text-zinc-400">Student</p>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            {record.student_name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
            <span>LRN: <span className="font-mono">{record.student_lrn}</span></span>
            <span>&bull;</span>
            <span>Referral: <strong className="text-amber-600 dark:text-amber-400">{record.reason_display}</strong></span>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
              Evaluation Outcome
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setResult('passed')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  result === 'passed'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Passed Remediation</span>
              </button>

              <button
                type="button"
                onClick={() => setResult('failed')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  result === 'failed'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900'
                }`}
              >
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>Failed Remediation</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {result === 'passed'
                ? 'Student will be marked as having completed summer remediation successfully and promoted to the next phase.'
                : 'Student will be retained in their current program phase for reinforcement.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
              Remediation Notes / Evaluation Remarks
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Student showed mastery of foundational phonics and arithmetic skills during 6-week summer module."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-900/60 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-[var(--brand)] hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Recording...</span>
              </>
            ) : (
              <>
                <Award className="w-4 h-4" />
                <span>Save Evaluation</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
