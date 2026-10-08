import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, CheckCircle2, AlertTriangle, Scale, Lock, School } from 'lucide-react';
import aralertLogo from '../../assets/ARALert_Logo_LIGHT.png';

export const TermsOfService: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="flex-1 w-full bg-slate-50 dark:bg-[#0A0A0A] text-slate-800 dark:text-slate-200 pt-28 sm:pt-32 pb-20 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto bg-white dark:bg-[#111111] rounded-3xl border border-slate-200 dark:border-neutral-800 shadow-xl p-6 sm:p-12 space-y-10">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-6">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0052B7] dark:hover:text-blue-400 transition-colors cursor-pointer px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2.5">
            <img src={aralertLogo} alt="ARALert Logo" className="h-7 sm:h-8 w-auto object-contain" />
            <span className="font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">ARALert</span>
          </div>
        </div>

        {/* Title Badge & Heading */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#0052B7] dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            <FileText className="w-4 h-4" /> Official System Terms
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400">
            Effective Date: School Year 2025–2026 &bull; Republic of the Philippines &bull; DepEd Region V (Masbate)
          </p>
        </div>

        {/* Highlight Alert Box */}
        <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3.5">
          <Scale className="w-5 h-5 text-[#0052B7] dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-1">
            <strong className="text-slate-900 dark:text-white block">Academic Recovery & Accessible Learning (ARAL) Legal Mandate</strong>
            <span>
              ARALert operates under the mandate of <strong>Republic Act No. 12028 (ARAL Program Act)</strong> and Department of Education policies. By accessing this platform, all users agree to adhere strictly to Philippine laws, DepEd ethical standards, and academic integrity regulations.
            </span>
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="space-y-8 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#0052B7] text-white text-xs font-bold">1</span>
              Acceptance of Terms
            </h2>
            <p>
              By accessing, browsing, or logging into the <strong>ARALert Monitoring and Early Warning System</strong> (&ldquo;System&rdquo;), whether as a School Administrator, Principal, Faculty Member, ARAL Tutor, Student Learner, or Parent/Guardian, you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service, along with our <strong>Data Privacy Statement</strong>.
            </p>
            <p>
              If you do not agree with any part of these Terms, you must discontinue access to the platform immediately.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#0052B7] text-white text-xs font-bold">2</span>
              Authorized User Accounts & Role Permissions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Staff & Faculty Accounts
                </div>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Must authenticate via authorized, pre-registered institutional Google accounts (@deped.gov.ph or whitelisted domains). Sharing credentials or allowing unauthorized third parties access is strictly prohibited.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Student Learner Accounts
                </div>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Learners access personal scores and attendance using their verified 12-digit Learner Reference Number (LRN). Students may only view their own records.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#0052B7] text-white text-xs font-bold">3</span>
              Academic Integrity & Prohibited Actions
            </h2>
            <p>
              ARALert exists to evaluate student learning recovery accurately. Users agree to uphold complete academic and administrative honesty. The following actions are strictly prohibited:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-slate-600 dark:text-slate-300">
              <li>Falsifying, inflating, or unauthorized tampering with student assessment scores (BOSY, MOSY, EOSY, or Summer).</li>
              <li>Generating fraudulent QR attendance logs or recording attendance for absent learners or staff.</li>
              <li>Attempting unauthorized privilege escalation, SQL injection, automated scraping, or reverse engineering of the system.</li>
              <li>Impersonating school officials, faculty members, tutors, or students.</li>
            </ul>
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Violations are subject to disciplinary sanctions, revocation of system access, and administrative proceedings under DepEd Service Manual rules.</span>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#0052B7] text-white text-xs font-bold">4</span>
              Data Protection & Privacy Compliance (RA 10173)
            </h2>
            <p>
              All personal and academic records collected through ARALert are governed by the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>. Data is processed exclusively for official ARAL learning interventions, academic performance tracking, and statutory DepEd reporting.
            </p>
            <p>
              For full details regarding how your personal information is stored, processed, and protected, please review our comprehensive <Link to="/privacy" className="text-[#0052B7] dark:text-blue-400 font-semibold hover:underline">Privacy Policy</Link>.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#0052B7] text-white text-xs font-bold">5</span>
              System Availability & Service Level
            </h2>
            <p>
              While ARALert strives for 99.9% uptime and high availability, system access may occasionally be interrupted for scheduled database backups, security patches, or server maintenance. Palanas National Agriculture High School and the development team are not liable for transient network dropouts outside the school server perimeter.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#0052B7] text-white text-xs font-bold">6</span>
              Contact & Inquiries
            </h2>
            <p>
              For questions regarding these Terms of Service or to report system discrepancies, please contact:
            </p>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-1 text-xs sm:text-sm">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <School className="w-4 h-4 text-[#0052B7] dark:text-blue-400" />
                Palanas National Agriculture High School
              </div>
              <p className="text-slate-500 dark:text-neutral-400">ARAL Program Implementation Committee &bull; Division of Masbate, Region V</p>
              <p className="text-slate-500 dark:text-neutral-400">Email: <a href="mailto:contact@aralert.ph" className="text-[#0052B7] dark:text-blue-400 hover:underline">contact@aralert.ph</a></p>
            </div>
          </section>

        </div>

        {/* Footer Link Switcher */}
        <div className="pt-6 border-t border-slate-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-neutral-400">
          <span>&copy; {new Date().getFullYear()} ARALert &bull; DepEd ARAL Program</span>
          <Link to="/privacy" className="text-[#0052B7] dark:text-blue-400 hover:underline font-bold flex items-center gap-1">
            Read Data Privacy Policy &rarr;
          </Link>
        </div>

      </div>
    </div>
  );
};

export default TermsOfService;
