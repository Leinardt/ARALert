import React, { useState } from 'react';
import { ShieldCheck, Lock, ExternalLink, Check, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-200 dark:border-[#262626] shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] flex flex-col justify-between"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-consent-title"
      >
        {/* Top Header */}
        <div className="space-y-3 shrink-0">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#222222] pb-4">
            <div className="flex items-center gap-2.5">
              <img src={aralertLogo} alt="ARALert" className="h-7 w-auto" />
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">
                  ARALert
                </h3>
                <span className="text-[10px] font-semibold text-[var(--brand)] dark:text-blue-400 uppercase tracking-widest">
                  DepEd ARAL Program
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> RA 10173 Protected
            </span>
          </div>

          <div>
            <h2 id="privacy-consent-title" className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
              Data Privacy Consent & Terms Agreement
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Welcome, <strong className="text-gray-900 dark:text-white">{userName}</strong> ({userRole.toUpperCase()}). Please review and accept our data privacy policy to activate your session.
            </p>
          </div>
        </div>

        {/* Scrollable Policy Brief */}
        <div className="overflow-y-auto pr-1 space-y-3 text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-[#161616] p-4 rounded-xl border border-gray-100 dark:border-[#222222] leading-relaxed">
          <p className="font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[var(--brand)]" />
            Notice on Collection of Educational & Attendance Data:
          </p>
          <p>
            In accordance with <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong>, ARALert collects and processes your student/educator profile, daily attendance, assessment scores (BOSY, MOSY, EOSY, and Summer Remediation), and academic risk evaluations solely for:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 text-gray-500 dark:text-slate-400">
            <li>Monitoring learning recovery interventions under DepEd guidelines.</li>
            <li>Evaluating learner progression and milestone achievements.</li>
            <li>Securing verified daily attendance and time-log accountability.</li>
          </ul>
          <p className="pt-1 text-[11px] text-gray-500 dark:text-slate-400">
            Your personal information is strictly confidential and protected with role-based access control and encryption.
          </p>
          <div className="pt-2 flex items-center gap-3 text-[11px] font-bold text-[var(--brand)] dark:text-blue-400 border-t border-gray-200/60 dark:border-[#262626]">
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1">
              Read Full Privacy Policy <ExternalLink className="w-3 h-3" />
            </a>
            <span>•</span>
            <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1">
              Read Terms of Service <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Consent Checkbox & Action Buttons */}
        <div className="space-y-4 shrink-0 pt-2">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(e) => setHasAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer"
            />
            <span className="text-xs font-medium text-gray-700 dark:text-slate-300 leading-snug">
              I have read, understood, and agree to the <strong>Terms of Service</strong> and give my explicit consent to the processing of records under <strong>RA 10173</strong>.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onDecline}
              disabled={loading}
              className="w-full sm:w-1/3 py-2.5 px-4 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-[#202020] hover:bg-gray-200 dark:hover:bg-[#282828] transition-colors cursor-pointer text-center disabled:opacity-60"
            >
              Decline & Exit
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!hasAgreed || loading}
              className={`w-full sm:w-2/3 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                hasAgreed && !loading
                  ? 'bg-[var(--brand)] text-white shadow-md hover:opacity-95'
                  : 'bg-gray-200 dark:bg-[#202020] text-gray-400 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              {loading ? (
                'Recording Consent...'
              ) : (
                <>
                  <Check className="w-4 h-4" /> Accept & Proceed to Dashboard
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
