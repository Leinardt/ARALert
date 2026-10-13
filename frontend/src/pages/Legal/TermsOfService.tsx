import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export const TermsOfService: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return (
    <div
      className="min-h-screen w-full bg-slate-50 dark:bg-[#0A0A0A] text-slate-800 dark:text-slate-200 pt-24 sm:pt-28 pb-24 px-4 sm:px-6 lg:px-8 transition-colors"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Navigation */}
        <div className="flex items-center justify-between pb-2">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/login');
              }
            }}
            className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0052B7] dark:hover:text-blue-400 transition-colors cursor-pointer py-1"
          >
            &larr; Return to Previous Page
          </button>
          <span className="text-xs font-medium text-slate-500 dark:text-neutral-500">
            Institutional Document
          </span>
        </div>

        {/* Institutional Document Header */}
        <header className="border-b border-slate-300 dark:border-neutral-800 pb-8 space-y-4">
          <div className="space-y-1 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <p className="font-semibold">Republic of the Philippines</p>
            <p className="font-semibold">Department of Education &bull; Region V (Bicol) &bull; Division of Masbate</p>
            <p className="font-bold text-slate-700 dark:text-slate-300">Palanas National Agriculture High School</p>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight pt-2">
            Terms of Service and Conditions of Platform Use
          </h1>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-6 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-neutral-800/80 pt-4">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Document Identifier: </span>
              <span>DepEd-PNAHS-ARAL-TOS-2025</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Statutory Mandate: </span>
              <span>Republic Act No. 12028 (ARAL Program Act)</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Effective Date: </span>
              <span>School Year 2025–2026 onwards</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Jurisdiction: </span>
              <span>Republic of the Philippines</span>
            </div>
          </div>
        </header>

        {/* Preamble */}
        <div className="space-y-4 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
          <p>
            The <strong>ARALert Academic Early Warning and Intervention Platform</strong> (&ldquo;ARALert&rdquo; or the &ldquo;System&rdquo;) is an institutional information system deployed at Palanas National Agriculture High School. The platform provides continuous tracking of academic recovery indicators, attendance verification, risk cohort flagging, and assessment record management pursuant to the <strong>Academic Recovery and Accessible Learning (ARAL) Program Act (Republic Act No. 12028)</strong> and Department of Education regulations.
          </p>
          <p>
            By accessing, authenticating into, or utilizing any portion of this platform, whether as a School Administrator, Principal, Faculty Member, ARAL Tutor, Student Learner, or Legal Guardian, you formally acknowledge that you have read, understood, and agreed to be bound by these Terms of Service in their entirety, alongside our <strong>Data Privacy Statement</strong>.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 1. General Provisions and Scope of Applicability
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              <strong>1.1 Purpose.</strong> The platform is designed solely to facilitate educational assessment, intervention delivery, daily attendance recording, and progress reporting under the ARAL Program. Commercial exploitation, private utilization, or unauthorized administrative manipulation is strictly prohibited.
            </p>
            <p>
              <strong>1.2 Institutional Scope.</strong> These Terms apply to all sessions, data exchanges, automated scoring procedures, and reporting modules conducted through ARALert under the jurisdiction of Palanas National Agriculture High School.
            </p>
            <p>
              <strong>1.3 Discontinuation of Access.</strong> Any individual who does not consent to these Terms of Service or subsequent official amendments must immediately refrain from accessing or utilizing the platform.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 2. User Classifications, Authentication, and Responsibilities
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              <strong>2.1 School Administrators and Principals.</strong> Administrative accounts possess privileged oversight for user lifecycle management, school year transitions, institutional evaluation tools, and school-wide analytics. Administrators are legally bound to enforce role-based access restrictions and ensure audit integrity.
            </p>
            <p>
              <strong>2.2 Faculty Members and ARAL Tutors.</strong> Instructional personnel must authenticate exclusively via authorized institutional Google accounts. Tutors are responsible for the prompt, accurate encoding of assessment scores and genuine verification of session attendance. Tutors may only access student records assigned directly to their instructional cohorts.
            </p>
            <p>
              <strong>2.3 Student Learners.</strong> Learners access personal performance trends, session attendance records, and risk level status using their official 12-digit Learner Reference Number (LRN). Learners are permitted to view only their own individual records.
            </p>
            <p>
              <strong>2.4 Credential Confidentiality.</strong> Users are strictly prohibited from sharing, delegating, or disclosing access credentials. Any transaction performed under an authenticated profile shall be presumed to have been executed by the registered account holder.
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 3. Standards of Academic Integrity and Prohibited Conduct
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              All interactions within the platform must strictly conform to Philippine civil service laws, the Code of Ethics for Professional Teachers (Resolution No. 435, s. 1997), and DepEd Child Protection guidelines. The following acts constitute grave violations:
            </p>
            <div className="pl-4 border-l-2 border-slate-300 dark:border-neutral-700 space-y-2.5">
              <p>
                <strong>3.1 Falsification of Academic Data.</strong> Tampering with, inflating, pre-dating, or retroactively falsifying formative scores, periodic assessment results (BOSY, MOSY, EOSY, or Summer), or learning recovery evaluations.
              </p>
              <p>
                <strong>3.2 Attendance Fraud.</strong> Creating fraudulent QR codes, proxy scanning attendance for absent personnel or students, or certifying false Daily Time Record (DTR) entries.
              </p>
              <p>
                <strong>3.3 Security Infiltration and Tampering.</strong> Engaging in reverse engineering, SQL injection, unauthorized API scraping, privilege escalation, or intentional denial of service against the school server infrastructure.
              </p>
              <p>
                <strong>3.4 Identity Misrepresentation.</strong> Impersonating school officials, faculty members, tutors, or students, or submitting unauthorized profile modifications.
              </p>
            </div>
            <p>
              <strong>3.5 Disciplinary Sanctions.</strong> Violations of this Section shall immediately trigger account suspension, administrative investigation under DepEd Order No. 49, s. 2006 (Revised Rules of Procedure of the Department of Education in Administrative Cases), and possible prosecution under the Cybercrime Prevention Act of 2012 (Republic Act No. 10175).
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 4. Data Privacy and Confidentiality Compliance
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              <strong>4.1 Statutory Compliance.</strong> All personal, academic, and biometric identifiers processed through ARALert are collected and handled in strict accordance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, its Implementing Rules and Regulations, and National Privacy Commission directives.
            </p>
            <p>
              <strong>4.2 Scope of Data Processing.</strong> Personal information is collected exclusively to carry out the legitimate educational functions of the ARAL Program, compute risk tiers, track composite performance, and generate division-level statistical reports.
            </p>
            <p>
              <strong>4.3 Detailed Privacy Statement.</strong> For specific terms regarding data retention, disclosure restrictions, and the rights of data subjects, users must consult the official{' '}
              <Link to="/privacy" className="font-semibold text-[#0052B7] dark:text-blue-400 hover:underline">
                Data Privacy Statement and Compliance Policy
              </Link>.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 5. System Availability, Backups, and Service Limitations
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              <strong>5.1 Maintenance Schedules.</strong> Palanas National Agriculture High School reserves the right to suspend platform availability periodically for routine database optimization, server patching, security audits, and deployment of academic updates. Notice will be provided prior to scheduled downtime whenever practicable.
            </p>
            <p>
              <strong>5.2 Service Warranty Disclaimer.</strong> While every reasonable technical measure is enacted to secure operational availability and data integrity, the platform is provided on an institutional &ldquo;as-available&rdquo; basis. The institution shall not be held liable for disruptions arising from telecommunications outages, local power disruptions, or unauthorized external cyber incidents beyond reasonable institutional control.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 6. Amendments, Governing Law, and Severability
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              <strong>6.1 Right of Amendment.</strong> The School Administration and the ARAL Program Implementation Committee reserve the right to amend or update these Terms to reflect legislative changes, DepEd orders, or technical enhancements. Continued use of the platform after publication of revised terms constitutes formal acceptance.
            </p>
            <p>
              <strong>6.2 Governing Law.</strong> These Terms of Service shall be governed by and construed in conformity with the laws of the Republic of the Philippines and relevant Department of Education administrative regulations.
            </p>
            <p>
              <strong>6.3 Severability.</strong> Should any provision of these Terms be adjudicated invalid, illegal, or unenforceable by a court of competent jurisdiction, such invalidity shall not affect the enforceability of the remaining sections.
            </p>
          </div>
        </section>

        {/* Section 7 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 7. Institutional Inquiries and Official Contact
          </h2>
          <div className="space-y-2 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              Official correspondence regarding the interpretation of these Terms, technical grievances, or academic disputes may be addressed to:
            </p>
            <div className="pl-4 border-l-2 border-slate-300 dark:border-neutral-700 space-y-1 text-xs sm:text-sm">
              <p className="font-bold text-slate-900 dark:text-white">Office of the School Principal &bull; ARAL Program Committee</p>
              <p className="text-slate-600 dark:text-slate-400">Palanas National Agriculture High School</p>
              <p className="text-slate-600 dark:text-slate-400">Division of Masbate, Region V (Bicol), Philippines</p>
              <p className="text-slate-600 dark:text-slate-400">
                Official Email:{' '}
                <a href="mailto:contact@aralert.ph" className="font-semibold text-[#0052B7] dark:text-blue-400 hover:underline">
                  contact@aralert.ph
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Formal Document Footer */}
        <footer className="pt-8 border-t border-slate-300 dark:border-neutral-800 text-xs text-slate-500 dark:text-neutral-500 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p>
              &copy; {new Date().getFullYear()} Palanas National Agriculture High School. ARALert Educational System.
            </p>
            <p>
              Related Document:{' '}
              <Link to="/privacy" className="font-semibold text-[#0052B7] dark:text-blue-400 hover:underline">
                Data Privacy Statement &rarr;
              </Link>
            </p>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-neutral-600">
            Published pursuant to DepEd ARAL Program operational standards. This document is officially cataloged and maintained by the School Administration.
          </p>
        </footer>

      </div>
    </div>
  );
};

export default TermsOfService;
