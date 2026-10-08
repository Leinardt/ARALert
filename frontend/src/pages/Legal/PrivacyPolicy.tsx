import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, Eye, Database, FileCheck, CheckCircle2, UserCheck, AlertCircle, School } from 'lucide-react';
import aralertLogo from '../../assets/ARALert_Logo_LIGHT.png';

export const PrivacyPolicy: React.FC = () => {
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Republic Act No. 10173 Compliance
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Data Privacy Statement & Policy
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400">
            In compliance with the Philippine Data Privacy Act of 2012 (RA 10173) and National Privacy Commission (NPC) Circulars
          </p>
        </div>

        {/* Highlight Summary Box */}
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3.5">
          <Lock className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-1">
            <strong className="text-slate-900 dark:text-white block">Commitment to Learner & Personnel Data Privacy</strong>
            <span>
              ARALert strictly protects the privacy and confidentiality of student academic records, tutor daily time logs, and educator profiles. We do not sell, share, or monetize any educational data with external commercial entities.
            </span>
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="space-y-8 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#0052B7] dark:text-blue-400" />
              1. General Privacy Declaration
            </h2>
            <p>
              <strong>ARALert</strong> (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;platform&rdquo;) operates in accordance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, its Implementing Rules and Regulations (IRR), and applicable guidelines issued by the Department of Education (DepEd) and the National Privacy Commission (NPC).
            </p>
            <p>
              This policy outlines how personal and academic data is collected, stored, processed, and safeguarded when you access the platform at Palanas National Agriculture High School.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-[#0052B7] dark:text-blue-400" />
              2. Categories of Data Collected
            </h2>
            <p>To implement the DepEd ARAL Program effectively, ARALert processes the following data categories:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              
              <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                  Student Learner Data
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <li>Official 12-digit Learner Reference Number (LRN)</li>
                  <li>Full Legal Name, Grade Level & Section</li>
                  <li>Assigned ARAL Subject (Reading, Math, Science)</li>
                  <li>ARAL Program Level (Basic, Plus, Summer, Graduated)</li>
                  <li>Assessment Scores (BOSY, MOSY, EOSY, Tasks)</li>
                  <li>Daily QR Session Attendance Records</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                  Educator & Personnel Data
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <li>Full Name & Institutional DepEd Email</li>
                  <li>Assigned Role (Principal, Admin, Faculty, Tutor)</li>
                  <li>Specialization & Assigned Student Cohorts</li>
                  <li>Daily Time Record (DTR) check-in timestamps</li>
                  <li>System Audit Logs (IP, timestamps for security)</li>
                </ul>
              </div>

            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-[#0052B7] dark:text-blue-400" />
              3. Lawful Basis & Purpose of Processing
            </h2>
            <p>
              Under Sections 12 and 13 of RA 10173, the processing of learner data is strictly justified under statutory compliance with <strong>Republic Act No. 12028 (ARAL Program Act)</strong> and the legitimate educational mandates of the Department of Education. Data is processed exclusively to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-slate-600 dark:text-slate-300">
              <li>Identify learning competencies requiring urgent recovery and targeted tutoring.</li>
              <li>Monitor daily student participation and tutor instructional hours.</li>
              <li>Compute milestone progression (30% Assessment, 50% Tasks, 20% Attendance).</li>
              <li>Generate official DepEd Division and Regional accomplishment reports.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#0052B7] dark:text-blue-400" />
              4. Technical & Organizational Security Controls
            </h2>
            <p>
              ARALert maintains rigorous physical, technical, and administrative controls to protect information:
            </p>
            <div className="space-y-2 pt-1">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Role-Based Access Control (RBAC):</strong> Strict cryptographic permissions guarantee that tutors only see assigned learners, students only see their own scores, and administrators have scoped management access.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Encrypted Communications:</strong> All data transmissions are protected via SSL/TLS 256-bit encryption.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Audit Trails:</strong> All administrative modifications to scores or accounts generate immutable audit logs.</span>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#0052B7] dark:text-blue-400" />
              5. Rights of Data Subjects under Philippine Law
            </h2>
            <p>
              As a data subject (or as a parent/legal guardian exercising rights on behalf of a minor student), you are entitled to the following rights under RA 10173:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-slate-600 dark:text-slate-300">
              <li><strong>Right to be Informed:</strong> To know how and why your personal data is collected and processed.</li>
              <li><strong>Right to Access:</strong> To view your academic history and attendance records anytime through the student portal.</li>
              <li><strong>Right to Rectification:</strong> To request correction of inaccurate names, LRNs, or erroneous scores through the official School Admin review process.</li>
              <li><strong>Right to File a Complaint:</strong> To seek redress with the National Privacy Commission (NPC) if your privacy rights have been infringed.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <School className="w-5 h-5 text-[#0052B7] dark:text-blue-400" />
              6. Data Protection Inquiries
            </h2>
            <p>
              To exercise your data privacy rights, file a correction request, or submit an inquiry, please contact:
            </p>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-1 text-xs sm:text-sm">
              <div className="font-bold text-slate-900 dark:text-white">
                Data Protection Compliance Committee
              </div>
              <p className="text-slate-500 dark:text-neutral-400">Palanas National Agriculture High School &bull; DepEd Masbate</p>
              <p className="text-slate-500 dark:text-neutral-400">Official Email: <a href="mailto:contact@aralert.ph" className="text-[#0052B7] dark:text-blue-400 hover:underline">contact@aralert.ph</a></p>
              <p className="text-slate-500 dark:text-neutral-400">Website: <a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer" className="text-[#0052B7] dark:text-blue-400 hover:underline">National Privacy Commission (NPC)</a></p>
            </div>
          </section>

        </div>

        {/* Footer Link Switcher */}
        <div className="pt-6 border-t border-slate-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-neutral-400">
          <span>&copy; {new Date().getFullYear()} ARALert &bull; DepEd ARAL Program</span>
          <Link to="/terms" className="text-[#0052B7] dark:text-blue-400 hover:underline font-bold flex items-center gap-1">
            Read Terms of Service &rarr;
          </Link>
        </div>

      </div>
    </div>
  );
};

export default PrivacyPolicy;
