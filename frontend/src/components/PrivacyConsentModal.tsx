import React, { useState } from 'react';
import { ShieldCheck, ExternalLink, Check, FileText, Scale, Lock } from 'lucide-react';
import { DEPED_LOGO_SRC, PNAHS_LOGO_SRC } from '../assets/template_logos/logosBase64';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-[#222222] shadow-2xl max-w-2xl w-full p-5 sm:p-7 space-y-5 max-h-[92vh] flex flex-col justify-between"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-consent-title"
      >
        {/* Institutional Header with Official Seals */}
        <div className="space-y-3 shrink-0">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 pb-3.5">
            <div className="flex items-center gap-3">
              <img
                src={DEPED_LOGO_SRC}
                alt="Department of Education Logo"
                className="h-10 w-10 object-contain shrink-0"
              />
              <img
                src={PNAHS_LOGO_SRC}
                alt="PNAHS Logo"
                className="h-10 w-10 object-contain shrink-0"
              />
              <div className="leading-tight">
                <p className="text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                  Republic of the Philippines &bull; Department of Education
                </p>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Palanas National Agriculture High School
                </h3>
                <p className="text-[10px] font-medium text-[var(--brand)] dark:text-blue-400">
                  ARALert: Academic Early Warning &amp; Recovery Platform
                </p>
              </div>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> RA 10173 &amp; RA 12028
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 id="privacy-consent-title" className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Institutional Data Privacy Consent &amp; Terms of Service
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              Authorized Account: <strong className="text-slate-900 dark:text-white font-semibold">{userName}</strong>{' '}
              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-[#1E1E1E] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-neutral-800 uppercase">
                {formattedRole}
              </span>
            </p>
          </div>
        </div>

        {/* Scrollable Formal Institutional Agreement Content */}
        <div className="overflow-y-auto pr-1.5 space-y-3.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-[#151515] p-4 rounded-xl border border-slate-200/90 dark:border-[#222222] leading-relaxed max-h-[46vh]">
          {/* Statutory Authority Statement */}
          <div className="flex items-start gap-2 text-slate-800 dark:text-slate-200 bg-white dark:bg-[#1A1A1A] p-2.5 rounded-lg border border-slate-200 dark:border-neutral-800">
            <Scale className="w-4 h-4 text-[#0052B7] dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Pursuant to the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, its Implementing Rules and Regulations, and the statutory provisions of the <strong>Academic Recovery and Accessible Learning (ARAL) Program Act (Republic Act No. 12028)</strong>, this document establishes the terms governing the collection, processing, and management of educational and personnel records within the ARALert platform.
            </p>
          </div>

          {/* Section 1: Collection Scope */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5 text-[#0052B7] dark:text-blue-400" />
              1. Institutional Scope of Record Processing
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              Upon session authentication, ARALert processes identity details, contact references, learner academic assessments (BOSY, MOSY, EOSY), learning intervention milestones, and QR-verified daily attendance logs strictly for:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-600 dark:text-slate-300">
              <li>Identifying students requiring urgent academic intervention under validated scoring weights.</li>
              <li>Monitoring learning recovery progress andDepEd remediation milestone compliance.</li>
              <li>Maintaining tamper-resistant, verifiable daily time logs and attendance accountability.</li>
              <li>Generating authorized institutional progress reports for Palanas National Agriculture High School.</li>
            </ul>
          </div>

          {/* Section 2: Safeguards & Confidentiality */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
              <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              2. Data Protection, Access Control, and Confidentiality
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              All personal and academic information is strictly confidential. In accordance with National Privacy Commission (NPC) mandates, data is secured using cryptographic protection, role-based access restrictions, and administrative audit logging. Data will never be sold, disclosed, or shared with unauthorized commercial or non-institutional third parties.
            </p>
          </div>

          {/* Section 3: Legal Rights */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              3. Data Subject Rights &amp; Institutional Governance
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              As a recognized data subject under RA 10173, you retain the right to be informed, access your stored records, request reasonable correction of inaccuracies, and lodge formal inquiries with the designated School Data Protection Officer.
            </p>
          </div>

          {/* Links to Full Policies */}
          <div className="pt-2.5 flex flex-wrap items-center gap-4 text-[11px] font-semibold text-[#0052B7] dark:text-blue-400 border-t border-slate-200 dark:border-neutral-800">
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline inline-flex items-center gap-1"
            >
              Full Data Privacy Statement <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-slate-300 dark:text-neutral-700">&bull;</span>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline inline-flex items-center gap-1"
            >
              Institutional Terms of Service <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Consent Checkbox & Formal Actions */}
        <div className="space-y-4 shrink-0 pt-1">
          <label className="flex items-start gap-3 cursor-pointer select-none p-2.5 rounded-xl bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] hover:bg-slate-100/60 dark:hover:bg-[#1A1A1A] transition">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(e) => setHasAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-neutral-700 text-[#0052B7] focus:ring-[#0052B7] cursor-pointer shrink-0"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              I acknowledge that I have read, understood, and agreed to the{' '}
              <strong className="text-slate-900 dark:text-white font-semibold">Institutional Terms of Service</strong> and hereby give my explicit, formal consent to the processing of personal and educational records pursuant to{' '}
              <strong className="text-slate-900 dark:text-white font-semibold">Republic Act No. 10173 (Data Privacy Act of 2012)</strong> and{' '}
              <strong className="text-slate-900 dark:text-white font-semibold">Republic Act No. 12028 (ARAL Program Act)</strong>.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={onDecline}
              disabled={loading}
              className="w-full sm:w-1/3 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1E1E1E] hover:bg-slate-200 dark:hover:bg-[#282828] border border-slate-200 dark:border-neutral-800 transition-colors cursor-pointer text-center disabled:opacity-60"
            >
              Decline &amp; Sign Out
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!hasAgreed || loading}
              className={`w-full sm:w-2/3 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                hasAgreed && !loading
                  ? 'bg-[#0052B7] hover:bg-[#004294] text-white shadow-sm hover:shadow'
                  : 'bg-slate-200 dark:bg-[#202020] text-slate-400 dark:text-neutral-500 cursor-not-allowed border border-slate-200 dark:border-[#262626]'
              }`}
            >
              {loading ? (
                'Recording Consent...'
              ) : (
                <>
                  <Check className="w-4 h-4" /> Accept &amp; Proceed to Dashboard
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
