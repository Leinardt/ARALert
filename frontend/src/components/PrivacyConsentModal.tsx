import React, { useState } from 'react';

interface PrivacyConsentModalProps {
  isOpen: boolean;
  userName?: string;
  userRole?: string;
  onAccept: () => void;
  onDecline: () => void;
  isLoading?: boolean;
  isSubmitting?: boolean;
}

export const PrivacyConsentModal: React.FC<PrivacyConsentModalProps> = ({
  isOpen,
  userName = 'User',
  userRole = 'Member',
  onAccept,
  onDecline,
  isLoading = false,
  isSubmitting = false,
}) => {
  const loading = isLoading || isSubmitting;
  const [hasAgreed, setHasAgreed] = useState(false);

  if (!isOpen) return null;

  const formattedRole = userRole.charAt(0).toUpperCase() + userRole.slice(1).toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-[#0F0F0F] rounded-lg border border-slate-300 dark:border-neutral-800 shadow-xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[92vh] flex flex-col justify-between"
        style={{ fontFamily: "'Poppins', sans-serif" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-consent-title"
      >
        {/* Document Header */}
        <header className="border-b border-slate-300 dark:border-neutral-800 pb-4 space-y-2 shrink-0">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 space-y-0.5 font-medium">
            <p>Republic of the Philippines &bull; Department of Education</p>
            <p className="font-semibold text-slate-700 dark:text-slate-300">Palanas National Agriculture High School</p>
          </div>

          <h1 id="privacy-consent-title" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Data Privacy Consent and Conditions of Use
          </h1>

          <div className="pt-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-neutral-800/80 flex flex-wrap items-center justify-between gap-y-1">
            <p>
              Account: <span className="font-semibold text-slate-800 dark:text-slate-200">{userName}</span> ({formattedRole})
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Statutory Ref: RA 10173 &bull; RA 12028
            </p>
          </div>
        </header>

        {/* Formal Plain Text Body */}
        <div className="overflow-y-auto space-y-4 text-xs sm:text-[13px] leading-6 text-slate-700 dark:text-slate-300 pr-2">
          <p>
            The <strong>ARALert Academic Early Warning and Intervention Platform</strong> is an official institutional system of Palanas National Agriculture High School. Pursuant to the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong> and the <strong>Academic Recovery and Accessible Learning (ARAL) Program Act (Republic Act No. 12028)</strong>, this notice governs the handling of educational and personnel records.
          </p>

          <div className="space-y-1">
            <h2 className="font-bold text-slate-900 dark:text-white uppercase tracking-wide text-xs">
              1. Purpose and Scope of Processing
            </h2>
            <p>
              The system collects and processes personal identity details, learner assessment results (BOSY, MOSY, EOSY), learning recovery intervention milestones, and daily attendance records strictly for educational evaluation, learning recovery tracking, and verified attendance accountability under Department of Education standards.
            </p>
          </div>

          <div className="space-y-1">
            <h2 className="font-bold text-slate-900 dark:text-white uppercase tracking-wide text-xs">
              2. Confidentiality and Security Standards
            </h2>
            <p>
              All stored records are treated with institutional confidentiality. Data is protected through role-based access controls and encrypted authentication. Information recorded on this platform is never sold, shared, or disclosed for commercial or non-educational purposes.
            </p>
          </div>

          <div className="space-y-1">
            <h2 className="font-bold text-slate-900 dark:text-white uppercase tracking-wide text-xs">
              3. Data Subject Rights
            </h2>
            <p>
              In accordance with RA 10173, authorized individuals retain the right to be informed, review their recorded data, request reasonable correction of erroneous information, and address inquiries to the school administration.
            </p>
          </div>

          <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-neutral-800 flex items-center gap-3">
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0052B7] dark:text-blue-400 hover:underline font-medium"
            >
              Data Privacy Statement
            </a>
            <span>&bull;</span>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0052B7] dark:text-blue-400 hover:underline font-medium"
            >
              Terms of Service
            </a>
          </div>
        </div>

        {/* Consent and Action Buttons */}
        <footer className="space-y-4 pt-3 border-t border-slate-200 dark:border-neutral-800 shrink-0">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(e) => setHasAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-neutral-700 text-[#0052B7] focus:ring-[#0052B7] cursor-pointer"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 leading-normal">
              I have read and understood the <strong>Terms of Service</strong> and hereby give my consent to the collection and processing of my records in accordance with <strong>Republic Act No. 10173</strong>.
            </span>
          </label>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onDecline}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E1E1E] border border-slate-300 dark:border-neutral-700 transition cursor-pointer disabled:opacity-60"
            >
              Decline &amp; Sign Out
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!hasAgreed || loading}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                hasAgreed && !loading
                  ? 'bg-[#0052B7] hover:bg-[#004294] text-white shadow-xs'
                  : 'bg-slate-200 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Recording Consent...' : 'Accept and Proceed'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
