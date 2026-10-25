import React from 'react';
import { X, AlertCircle } from 'lucide-react';

interface SemesterTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  targetPeriod: string;
  currentPeriod: string;
  isProcessing?: boolean;
}

export const SemesterTransitionModal: React.FC<SemesterTransitionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  targetPeriod,
  currentPeriod,
  isProcessing = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#222222] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1E1E1E] flex items-center justify-between bg-white dark:bg-[#111111]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-slate-100">
                {title}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                Administrative Semester Milestone Action
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs text-gray-600 dark:text-slate-300">
          <p className="leading-relaxed">
            You are about to conclude the <strong className="text-gray-900 dark:text-slate-100 font-semibold">{currentPeriod}</strong> evaluation period and transition to <strong className="text-gray-900 dark:text-slate-100 font-semibold">{targetPeriod}</strong>.
          </p>

          <div className="rounded-lg bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#222222] p-3.5 space-y-2">
            <p className="font-bold text-[11px] uppercase tracking-wider text-gray-700 dark:text-slate-200">
              Transition Effects
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-[11px] text-gray-600 dark:text-slate-300">
              <li>
                <strong>Learner Progression:</strong> Basic students who passed move up to Plus; Plus students who passed move up to Graduated. Students who did not pass retain their current level.
              </li>
              <li>
                <strong>Tutor Pairings Reset:</strong> All currently assigned students will be unassigned to give tutors a clean slate for the new period.
              </li>
              <li>
                <strong>Permanent Archival:</strong> All score records and QR attendance punches are permanently preserved in the historical archive.
              </li>
            </ul>
          </div>

          <p className="text-[11px] text-amber-700 dark:text-amber-400/90 font-medium bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-md p-2.5">
            Please ensure all tutors have finished recording scores before confirming. Tutors will not be able to edit scores for this period after transitioning.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-[#1E1E1E] bg-gray-50/50 dark:bg-[#141414] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-3.5 py-2 rounded-md border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1F1F1F] text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-4 py-2 rounded-md bg-[var(--brand)] text-white hover:opacity-90 text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? 'Processing Transition...' : `Confirm & Move to ${targetPeriod}`}
          </button>
        </div>
      </div>
    </div>
  );
};
