import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import aralertLogo from '../../assets/ARALert_Logo_LIGHT.png';

export const PrivacyPolicy: React.FC = () => {
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
            Republic of the Philippines &bull; National Privacy Commission Compliance
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Data Privacy Statement and Policy
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            In compliance with Republic Act No. 10173 (Data Privacy Act of 2012), its Implementing Rules and Regulations (IRR), Republic Act No. 12028 (ARAL Program Act), and Bicol University Research Ethics Standards.
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
              Article I. General Privacy Principles and Scope
            </h2>
            <p>
              1.1. <strong>Institutional Mandate:</strong> The Automated Reading Assessment and Literacy Evaluation Tracking System (&ldquo;ARALert&rdquo;) is an institutional educational management platform deployed to monitor learner recovery, attendance verification, and academic progression under the Department of Education (DepEd) Academic Recovery and Accessible Learning (ARAL) Program.
            </p>
            <p>
              1.2. <strong>Core Principles:</strong> All processing of personal information and sensitive educational data within ARALert strictly adheres to the core data privacy principles established by the National Privacy Commission (NPC):
            </p>
            <ul className="list-disc list-outside ml-5 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li><strong>Transparency:</strong> Data subjects are fully informed regarding the nature, purpose, extent, and lawful basis of all data collection.</li>
              <li><strong>Legitimate Purpose:</strong> Data is collected solely for authorized educational remediation, attendance logging, and academic evaluation.</li>
              <li><strong>Proportionality:</strong> Data processing is strictly limited to information necessary to fulfill the educational objectives of the ARAL Program.</li>
            </ul>
          </section>

          {/* Article II */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article II. Categories of Personal and Academic Data Processed
            </h2>
            <p>
              2.1. <strong>Student Learner Information:</strong> To accurately track student literacy progression, ARALert processes:
            </p>
            <ul className="list-disc list-outside ml-5 space-y-1 text-slate-600 dark:text-slate-300">
              <li>Official twelve-digit Learner Reference Number (LRN);</li>
              <li>Learner Full Legal Name, Grade Level, and Enrolled Section;</li>
              <li>Assigned ARAL Intervention Track (Reading Intervention, Mathematics, or Science);</li>
              <li>Progression Milestone Classification (Basic, Plus, Summer Remediation, or Graduated);</li>
              <li>Periodic Assessment Scores: Beginning of School Year (BOSY), Middle of School Year (MOSY), End of School Year (EOSY), and regular activity tasks;</li>
              <li>Daily QR session attendance check-in timestamps and status records.</li>
            </ul>
            <p className="pt-2">
              2.2. <strong>Educator and Personnel Information:</strong> To ensure administrative accountability and daily time record tracking:
            </p>
            <ul className="list-disc list-outside ml-5 space-y-1 text-slate-600 dark:text-slate-300">
              <li>Full Legal Name, Institutional Email Address, and Contact Details;</li>
              <li>Assigned System Role (SuperAdministrator, School Administrator, Principal, Faculty / Subject Teacher, Volunteer Tutor);</li>
              <li>Subject Specialization and Cohort Assignment Rosters;</li>
              <li>Daily Time Record (DTR) check-in / check-out timestamps and manual entry logs;</li>
              <li>Immutable system transaction audit logs (action type, record ID, and timestamps).</li>
            </ul>
          </section>

          {/* Article III */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article III. Lawful Basis and Purpose of Processing
            </h2>
            <p>
              3.1. Under Sections 12 and 13 of Republic Act No. 10173, the processing of learner and personnel records by ARALert is lawful under the statutory authority of Republic Act No. 12028 (ARAL Program Act) and the educational mandates of the Department of Education.
            </p>
            <p>
              3.2. Collected data is processed strictly for the following operational and research objectives:
            </p>
            <ul className="list-disc list-outside ml-5 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li>Automating early-warning risk identification for struggling readers and learners requiring targeted intervention;</li>
              <li>Computing verified composite progression indices (weighted at 30% Assessment, 50% Tasks, and 20% Attendance);</li>
              <li>Managing tutor cohort allocations, instructional scheduling, and attendance accountability;</li>
              <li>Generating standardized DepEd school, district, and division accomplishment registers;</li>
              <li>Conducting empirical software quality evaluation under ISO/IEC 25010 standards for the IT 124 Capstone Project 2 study.</li>
            </ul>
          </section>

          {/* Article IV */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article IV. Data Anonymization, Research Masking, and Appendices Protocol
            </h2>
            <p>
              4.1. <strong>Manuscript Masking Standards:</strong> In accordance with the Bicol University CSIT Capstone 2 Guidelines (Sections 4.1 to 4.4), all screenshots, exhibits, and tables reproduced in academic manuscripts, presentations, or publications strictly anonymize individual identities. Sensitive contact details, residential addresses, and personal student histories are replaced with synthetic, realistic data or sanitized role labels (e.g., &ldquo;Tutor 1&rdquo;, &ldquo;Faculty A&rdquo;).
            </p>
            <p>
              4.2. <strong>Appendices Confidentiality:</strong> Raw survey questionnaires, signed informed consent forms, and User Acceptance Testing (UAT) sign-off sheets archived in the manuscript Appendices are accessible exclusively to authorized academic evaluation panels and the Capstone Project Coordinator.
            </p>
            <p>
              4.3. <strong>Data Retention and Disposal:</strong> Operational academic records are retained for the duration of the official academic year. Upon conclusion of the intervention and validation period, records are formally turned over to the partner school administration, and residual local staging data is purged securely.
            </p>
          </section>

          {/* Article V */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article V. Technical and Organizational Security Safeguards
            </h2>
            <p>
              5.1. <strong>Role-Based Access Control (RBAC):</strong> Access permissions are strictly partitioned: tutors have visibility only into their assigned student cohorts; learners can view only their personal records; administrative modifications are restricted to verified administrative staff.
            </p>
            <p>
              5.2. <strong>Cryptographic Protection:</strong> User passwords are encrypted utilizing industry-standard one-way cryptographic hashing algorithms with individual per-user salts. Plaintext passwords are never stored or logged.
            </p>
            <p>
              5.3. <strong>Audit Logging:</strong> All critical state changes—including score inputs, grade adjustment requests, attendance punch overrides, and user provisioning—generate immutable audit log entries recording the acting user, target entity, and timestamp.
            </p>
            <p>
              5.4. <strong>Transport Security:</strong> All data transmitted between client browsers, scanning terminals, and the backend application server utilizes Transport Layer Security (TLS 1.3 / HTTPS) encryption.
            </p>
          </section>

          {/* Article VI */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article VI. Statutory Rights of Data Subjects
            </h2>
            <p>
              6.1. Under Chapter III of Republic Act No. 10173, registered learners, parents/guardians, and school personnel retain the following enforceable rights:
            </p>
            <ul className="list-disc list-outside ml-5 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li><strong>Right to be Informed:</strong> To understand how academic records and time logs are gathered, processed, and stored;</li>
              <li><strong>Right of Access:</strong> To view registered scores, attendance history, and profile data through dedicated role portals;</li>
              <li><strong>Right to Rectification:</strong> To request formal dispute resolution and correction of erroneous scores, names, or attendance marks via the official School Administrator review mechanism;</li>
              <li><strong>Right to File a Complaint:</strong> To seek institutional redress or file complaints with the National Privacy Commission (NPC) for any proven privacy violation.</li>
            </ul>
          </section>

          {/* Article VII */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-100 dark:border-[#202020] pb-1">
              Article VII. Institutional Inquiries and Governance
            </h2>
            <p>
              7.1. Inquiries regarding this policy, data rectification requests, or privacy concerns may be formally addressed to:
            </p>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-[#222222] space-y-1 text-xs">
              <p className="font-bold text-slate-900 dark:text-white">Data Protection and Compliance Desk</p>
              <p className="text-slate-600 dark:text-slate-400">Palanas National Agriculture High School &bull; DepEd Division of Masbate</p>
              <p className="text-slate-600 dark:text-slate-400">Academic Project: ARALert Capstone Research Team &bull; Bicol University College of Science</p>
              <p className="text-slate-600 dark:text-slate-400">Official Correspondence: <span className="font-mono text-slate-900 dark:text-slate-100">contact@aralert.ph</span></p>
            </div>
          </section>

        </div>

        {/* Footer Navigation */}
        <div className="pt-6 border-t border-slate-200 dark:border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>&copy; {new Date().getFullYear()} ARALert &bull; DepEd ARAL Program Implementation</span>
          <Link
            to="/terms"
            className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white hover:text-[#0052B7] dark:hover:text-blue-400 transition-colors group"
          >
            <span>View Terms of Service</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </div>

      </div>
    </div>
  );
};

export default PrivacyPolicy;
