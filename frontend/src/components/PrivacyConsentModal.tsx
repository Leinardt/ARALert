import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import aralertLogo from '../assets/ARALert_Logo_LIGHT.png';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div
        className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-[#262626] shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] flex flex-col justify-between"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-consent-title"
      >
        {/* Top Header */}
        <div className="space-y-3 shrink-0">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-4">
            <div className="flex items-center gap-2.5">
              <img src={aralertLogo} alt="ARALert" className="h-7 w-auto object-contain" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                  ARALert
                </h3>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  DepEd ARAL Program &bull; RA 12028
                </span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              RA 10173 Compliance
            </span>
          </div>

          <div>
            <h2 id="privacy-consent-title" className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Data Privacy Consent and Terms Agreement
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Account: <strong className="text-slate-900 dark:text-white">{userName}</strong> &bull; Role: <strong className="text-slate-900 dark:text-white uppercase">{userRole}</strong>
            </p>
          </div>
        </div>

        {/* Scrollable Policy Brief */}
        <div className="overflow-y-auto pr-1 space-y-3 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#161616] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-[#222222] leading-relaxed">
          <p className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-[11px]">
            Notice of Data Collection and Statutory Compliance:
          </p>
          <p>
            In accordance with <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong> and <strong>Republic Act No. 12028 (ARAL Program Act)</strong>, ARALert processes student profiles, assessment results (BOSY, MOSY, EOSY), QR attendance logs, and personnel Daily Time Records (DTR) strictly for the following purposes:
          </p>
          <ul className="list-disc list-outside ml-4 space-y-1 text-slate-600 dark:text-slate-400">
            <li>Administering and monitoring learner reading and academic interventions;</li>
            <li>Tracking student participation, milestone progression, and tutor hours;</li>
            <li>Generating official Department of Education accomplishment registers;</li>
            <li>Conducting operational pilot testing and ISO/IEC 25010 software quality evaluation.</li>
          </ul>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            All records are protected through Role-Based Access Control (RBAC), password hashing, and encrypted transmission. Data will not be shared with unauthorized third parties.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-800 dark:text-slate-200 border-t border-slate-200 dark:border-[#262626]">
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:underline text-[var(--brand)] dark:text-blue-400 group"
            >
              <span>Read Complete Privacy Policy</span>
              <ArrowRight className="w-3 h-3 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
            </a>
            <span>&bull;</span>
            <a
              href="/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:underline text-[var(--brand)] dark:text-blue-400 group"
            >
              <span>Read Terms of Service</span>
              <ArrowRight className="w-3 h-3 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>

        {/* Consent Checkbox & Action Buttons */}
        <div className="space-y-4 shrink-0 pt-1">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(e) => setHasAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">
              I have read, understood, and agree to the <strong>Terms of Service</strong> and provide my explicit consent to data processing under <strong>Republic Act No. 10173</strong>.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onDecline}
              disabled={loading}
              className="w-full sm:w-1/3 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1E1E1E] hover:bg-slate-200 dark:hover:bg-[#282828] transition-colors cursor-pointer text-center disabled:opacity-60"
            >
              Decline &amp; Sign Out
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!hasAgreed || loading}
              className={`w-full sm:w-2/3 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                hasAgreed && !loading
                  ? 'bg-[var(--brand)] text-white shadow-xs hover:bg-[var(--brand-dark)]'
                  : 'bg-slate-200 dark:bg-[#202020] text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              {loading ? 'Recording Consent...' : 'Accept & Continue to System'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyConsentModal;
