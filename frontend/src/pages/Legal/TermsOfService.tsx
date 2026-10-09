import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import aralertLogo from '../../assets/ARALert_Logo_LIGHT.png';

export const TermsOfService: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="flex-1 w-full bg-slate-50 dark:bg-[#0A0A0A] text-slate-800 dark:text-slate-200 pt-28 sm:pt-32 pb-24 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-[#222222] shadow-sm p-6 sm:p-12 space-y-10">
        
        {/* Navigation Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222222] pb-5">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-[#0052B7] dark:text-slate-400 dark:hover:text-blue-400 transition-colors cursor-pointer bg-transparent border-0 p-0 outline-none select-none group"
          >
            <ArrowLeft className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:-translate-x-1 text-slate-500 group-hover:text-[#0052B7] dark:text-slate-400 dark:group-hover:text-blue-400" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <img src={aralertLogo} alt="ARALert Logo" className="h-6 sm:h-7 w-auto object-contain" />
            <span className="font-bold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">ARALert</span>
          </div>
        </div>

        {/* Document Header */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Institutional Terms of Use &bull; Educational Operational Policy
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Terms of Service and Operational Conditions
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Governed by the Laws of the Republic of the Philippines, Republic Act No. 12028 (ARAL Program Act), Republic Act No. 10173 (Data Privacy Act of 2012), and Department of Education Service Guidelines.
          </p>
          <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-500 border-t border-slate-100 dark:border-[#1E1E1E]">
            Effective Date: School Year 2026–2027 &bull; Institutional Locale: Palanas National Agriculture High School, Masbate
          </div>
        </div>

        {/* Legal Body Articles */}
        <div className="space-y-8 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          
          {/* Article I */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article I. Acceptance of Terms and Regulatory Framework
            </h2>
            <p>
              1.1. <strong>Binding Agreement:</strong> By accessing, logging into, or utilizing the Automated Reading Assessment and Literacy Evaluation Tracking System (&ldquo;ARALert&rdquo; or &ldquo;System&rdquo;), whether as a School Administrator, Principal, Faculty Member, ARAL Volunteer Tutor, Student Learner, or Technical Evaluator, you acknowledge that you have read, understood, and agreed to be legally bound by these Terms of Service and the accompanying Data Privacy Statement.
            </p>
            <p>
              1.2. <strong>Regulatory Scope:</strong> ARALert is deployed under the statutory authority of <strong>Republic Act No. 12028 (Academic Recovery and Accessible Learning Program Act)</strong> and complies with academic standards mandated by the Department of Education (DepEd) and the Commission on Higher Education (CHED Memorandum Order No. 25, Series of 2015).
            </p>
          </section>

          {/* Article II */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article II. Authorized User Roles, Authentication, and Account Security
            </h2>
            <p>
              2.1. <strong>Authorized Account Provisioning:</strong> System accounts are provisioned exclusively for authorized institutional personnel and registered learners:
            </p>
            <ul className="list-disc list-outside ml-5 space-y-1 text-slate-600 dark:text-slate-300">
              <li><strong>Administrative Personnel (SuperAdmin, Admin, Principal):</strong> Responsible for user provisioning, school year transitions, audit oversight, and official report endorsements.</li>
              <li><strong>Faculty and Volunteer Tutors:</strong> Authorized to initiate dynamic QR attendance sessions, record task assessments, and monitor assigned student cohorts.</li>
              <li><strong>Student Learners:</strong> Authorized to access individual attendance logs, task evaluation feedback, and personal progression status via verified Learner Reference Numbers (LRN).</li>
            </ul>
            <p className="pt-2">
              2.2. <strong>Credential Confidentiality:</strong> Users are strictly prohibited from sharing login credentials, account passwords, or two-factor tokens. Any action performed through an authenticated session is legally attributed to the registered account holder.
            </p>
          </section>

          {/* Article III */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article III. Academic Integrity and Prohibited Conduct
            </h2>
            <p>
              3.1. <strong>Prohibited Acts:</strong> Users must uphold the highest standards of academic and administrative honesty. The following acts constitute severe violations:
            </p>
            <ul className="list-disc list-outside ml-5 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li>Falsifying, inflating, or arbitrarily tampering with student assessment scores (BOSY, MOSY, EOSY, or regular task scores);</li>
              <li>Generating fraudulent attendance records, proxy scanning QR codes on behalf of absent learners, or manipulating staff Daily Time Record (DTR) punches;</li>
              <li>Attempting unauthorized privilege escalation, SQL injection, automated payload transmission, or reverse engineering of the platform codebase;</li>
              <li>Impersonating institutional officials, educators, tutors, or students.</li>
            </ul>
            <p className="pt-2">
              3.2. <strong>Sanctions and Disciplinary Penalties:</strong> Verified violations of this Article will result in immediate termination of system access and formal referral to the School Grievance Committee, DepEd Division Administrative Disciplinary Board, or University Academic Integrity Reviewers.
            </p>
          </section>

          {/* Article IV */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article IV. QR Attendance and Daily Time Record (DTR) Operational Standards
            </h2>
            <p>
              4.1. <strong>Session Validity and Timekeeping Authority:</strong> Dynamic QR codes generated for student sessions and staff DTR terminals operate under strict cryptographic expiration windows. All timestamps are derived exclusively from the authoritative application server clock.
            </p>
            <p>
              4.2. <strong>Manual Entry Verification:</strong> Six-character manual fallback codes are provided solely for emergency check-in during temporary camera or terminal hardware failures. Repeated manual check-ins are logged and subject to administrative review.
            </p>
          </section>

          {/* Article V */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article V. Score Adjustments, Edit Requests, and Immutable Audit Trails
            </h2>
            <p>
              5.1. <strong>Formal Edit Request Workflow:</strong> Once submitted by a tutor or teacher, historical scores and attendance marks cannot be modified directly. Corrections require the submission of a formal digital Edit Request stating the justification and evidence.
            </p>
            <p>
              5.2. <strong>Administrative Approval:</strong> Only designated School Administrators or the Principal may approve edit requests. All modifications are immutably preserved in the System Audit Log.
            </p>
          </section>

          {/* Article VI */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article VI. Pilot Testing, ISO/IEC 25010 Quality Evaluation, and Service Disclaimers
            </h2>
            <p>
              6.1. <strong>Pilot Testing Deployment:</strong> ARALert is deployed for operational pilot testing in fulfillment of the IT 124 Capstone Project 2 academic curriculum. System features, responsiveness, and usability are evaluated in real-world educational conditions.
            </p>
            <p>
              6.2. <strong>Independent ISO/IEC 25010 Evaluation:</strong> System evaluators (End Users, Client Representatives, and IT Practitioners) agree to provide impartial ratings according to the declared evaluation scale. Developers are disqualified from participating as evaluators.
            </p>
            <p>
              6.3. <strong>Service Availability:</strong> While the system is engineered for continuous local network and web availability, temporary interruptions for database backups, security patching, or school power fluctuations may occur. The development team and partner school disclaim liability for external telecommunication outages.
            </p>
          </section>

          {/* Article VII */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article VII. Institutional Inquiries and Legal Jurisdiction
            </h2>
            <p>
              7.1. These Terms are governed by and construed in accordance with the Laws of the Republic of the Philippines. Any dispute arising from these terms shall be submitted to the jurisdiction of the proper courts in the Province of Masbate.
            </p>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] space-y-1 text-xs">
              <p className="font-bold text-slate-900 dark:text-white">Office of the School Principal / ARAL Program Lead</p>
              <p className="text-slate-600 dark:text-slate-400">Palanas National Agriculture High School &bull; DepEd Division of Masbate, Region V</p>
              <p className="text-slate-600 dark:text-slate-400">Technical Research Inquiries: <span className="font-mono text-slate-900 dark:text-slate-100">contact@aralert.ph</span></p>
            </div>
          </section>

        </div>

        {/* Footer Navigation */}
        <div className="pt-6 border-t border-slate-200 dark:border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>&copy; {new Date().getFullYear()} ARALert &bull; DepEd ARAL Program Implementation</span>
          <Link
            to="/privacy"
            className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white hover:text-[#0052B7] dark:hover:text-blue-400 transition-colors group"
          >
            <span>View Data Privacy Policy</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </div>

      </div>
    </div>
  );
};

export default TermsOfService;
