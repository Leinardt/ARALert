import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export const PrivacyPolicy: React.FC = () => {
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
            Data Privacy Statement and Compliance Policy
          </h1>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-6 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-neutral-800/80 pt-4">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Document Identifier: </span>
              <span>DepEd-PNAHS-ARAL-DPA-2025</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Statutory Authority: </span>
              <span>Republic Act No. 10173 (Data Privacy Act of 2012)</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Supervisory Body: </span>
              <span>National Privacy Commission (NPC)</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Effective Date: </span>
              <span>School Year 2025–2026 onwards</span>
            </div>
          </div>
        </header>

        {/* Preamble */}
        <div className="space-y-4 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
          <p>
            Palanas National Agriculture High School recognizes its fundamental legal obligation under the 1987 Constitution of the Republic of the Philippines and the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong> to uphold the confidentiality, security, and integrity of all educational, personal, and biometric records processed through the <strong>ARALert Academic Early Warning System</strong>.
          </p>
          <p>
            This Policy details our institutional governance framework regarding the collection, handling, safeguarding, and disposal of learner academic evaluations and personnel attendance records under the <strong>Academic Recovery and Accessible Learning (ARAL) Program Act (Republic Act No. 12028)</strong>.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 1. Institutional Privacy Declaration and Commitments
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              <strong>1.1 Institutional Role.</strong> Palanas National Agriculture High School operates as the Personal Information Controller (PIC) for all educational data processed within ARALert. The School Administration exercises authoritative control over processing guidelines and technical safeguards.
            </p>
            <p>
              <strong>1.2 Strict Non-Monetization Policy.</strong> Student learning performance metrics, tutor Daily Time Records (DTR), and assessment records are institutional educational assets. We maintain an unconditional prohibition against the commercialization, external monetization, marketing, or unauthorized transfer of user data to third-party entities.
            </p>
            <p>
              <strong>1.3 Principle of Proportionality.</strong> The platform gathers solely the minimum extent of personal information strictly indispensable to satisfy the educational monitoring and early intervention objectives of the ARAL Program.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 2. Categories of Personal and Educational Data Processed
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              In execution of mandated educational intervention functions, ARALert processes the following data categories:
            </p>
            <div className="pl-4 border-l-2 border-slate-300 dark:border-neutral-700 space-y-2.5">
              <p>
                <strong>2.1 Student Learner Records:</strong> Official 12-digit Learner Reference Number (LRN), full legal name, grade level, section, assigned ARAL subject (Filipino, English, Mathematics, or Science), assigned program cohort (Basic, Plus, Summer, or Graduated), formative and periodic marks (BOSY, MOSY, EOSY, and performance tasks), calculated risk level classifications, and daily QR session attendance timestamps.
              </p>
              <p>
                <strong>2.2 Educator and Personnel Information:</strong> Full legal name, institutional DepEd Google account email (@deped.gov.ph or authorized domain), administrative designation (Principal, Administrator, Faculty, or Tutor), assigned student cohorts, and Daily Time Record (DTR) QR check-in and check-out logs.
              </p>
              <p>
                <strong>2.3 System Audit and Security Telemetry:</strong> Network Internet Protocol (IP) addresses, cryptographic session tokens, user-agent details, and immutable audit logs recording every score creation, attendance submission, profile edit review, and administrative action.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 3. Lawful Basis and Educational Purposes of Processing
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              <strong>3.1 Statutory Basis.</strong> Under Section 12 (Criteria for Lawful Processing of Personal Information) and Section 13 (Sensitive Personal Information) of Republic Act No. 10173, data processing within ARALert is legally grounded in compliance with statutory obligations established by <strong>Republic Act No. 12028 (ARAL Program Act)</strong> and the constitutional mandate of the Department of Education to ensure accessible, quality basic education.
            </p>
            <p>
              <strong>3.2 Specific Operational Purposes.</strong> Data processed within the system is utilized exclusively for:
            </p>
            <div className="pl-4 border-l-2 border-slate-300 dark:border-neutral-700 space-y-1.5 text-xs sm:text-sm">
              <p>&bull; Identifying learners requiring immediate literacy and numeracy remediation.</p>
              <p>&bull; Generating early warning academic risk cohort classifications (Low, Medium, and High Risk).</p>
              <p>&bull; Computing weighted performance metrics under DepEd validated standards (30% Formative Assessments, 50% Tasks, and 20% Attendance Rate).</p>
              <p>&bull; Evaluating student readiness for cohort graduation or progression to advanced ARAL tiers.</p>
              <p>&bull; Formulating mandatory institutional performance and accomplishment reports for the Division of Masbate and DepEd Regional Office V.</p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 4. Technical, Physical, and Organizational Security Safeguards
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              Palanas National Agriculture High School implements comprehensive defense-in-depth safeguards to prevent unauthorized access, interception, or tampering:
            </p>
            <div className="pl-4 border-l-2 border-slate-300 dark:border-neutral-700 space-y-2.5">
              <p>
                <strong>4.1 Transport-Layer and Storage Cryptography.</strong> All network transmissions between client browsers and the school server perimeter are protected through Transport Layer Security (TLS 1.3 / SSL 256-bit encryption). Data storage is hardened against unauthorized exfiltration.
              </p>
              <p>
                <strong>4.2 Role-Based Access Control (RBAC).</strong> Strict authorization boundaries are enforced at the API gateway: tutors cannot view unassigned students; learners can view only their own records; and administrative functions are strictly restricted to verified personnel.
              </p>
              <p>
                <strong>4.3 Immutable Audit Logging.</strong> Any administrative modification, student profile edit approval, or grade adjustment creates an unalterable audit log entry containing the exact timestamp, acting user ID, and previous versus updated values.
              </p>
              <p>
                <strong>4.4 Automated Session Expiration.</strong> Authenticated user sessions are subject to strict inactivity timeouts to prevent unauthorized terminal access on shared school workstations.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 5. Data Retention, Archival, and Secure Disposal
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              <strong>5.1 Active Retention.</strong> Student assessment and attendance records are maintained actively throughout the student&rsquo;s enrollment in the ARAL Program and across the active school year cycle.
            </p>
            <p>
              <strong>5.2 Official Archival.</strong> Upon school year completion or student program graduation, performance data is securely transitioned into the historical evaluation archives in compliance with Department of Education record retention schedules and the National Archives of the Philippines Act (Republic Act No. 9470).
            </p>
            <p>
              <strong>5.3 Secure Destruction.</strong> Expired temporary data, obsolete session caches, and transient diagnostic logs are expunged using secure cryptographic erasure protocols.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 6. Statutory Rights of Data Subjects under Republic Act No. 10173
          </h2>
          <div className="space-y-3 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              Registered learners (acting through their parents or legal guardians if minor) and personnel possess enforceable legal rights under the Data Privacy Act of 2012:
            </p>
            <div className="pl-4 border-l-2 border-slate-300 dark:border-neutral-700 space-y-2">
              <p>
                <strong>6.1 Right to be Informed.</strong> Data subjects have the right to be notified regarding the nature, purpose, and extent of automated processing of their educational records.
              </p>
              <p>
                <strong>6.2 Right to Access.</strong> Learners and staff may access their verified performance history, DTR logs, and personal profile information at any time via authenticated portal access.
              </p>
              <p>
                <strong>6.3 Right to Rectification.</strong> If personal information or encoded assessment marks are inaccurate or incomplete, data subjects may lodge a formal Profile Edit Request or grade verification petition with the School Administration.
              </p>
              <p>
                <strong>6.4 Right to File a Complaint.</strong> If a data subject has reasonable grounds to believe that their privacy rights have been compromised, they have the statutory right to seek redress with the National Privacy Commission (NPC).
              </p>
            </div>
          </div>
        </section>

        {/* Section 7 */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-800/80">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            Section 7. Institutional Privacy Oversight and Contact Information
          </h2>
          <div className="space-y-2 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-300">
            <p>
              For formal data privacy inquiries, requests for record verification, or statutory complaints, please direct official communications to:
            </p>
            <div className="pl-4 border-l-2 border-slate-300 dark:border-neutral-700 space-y-1 text-xs sm:text-sm">
              <p className="font-bold text-slate-900 dark:text-white">Data Protection Compliance Committee</p>
              <p className="text-slate-600 dark:text-slate-400">Palanas National Agriculture High School &bull; DepEd Division of Masbate</p>
              <p className="text-slate-600 dark:text-slate-400">Palanas, Masbate, Region V (Bicol), Philippines</p>
              <p className="text-slate-600 dark:text-slate-400">
                Official Email:{' '}
                <a href="mailto:contact@aralert.ph" className="font-semibold text-[#0052B7] dark:text-blue-400 hover:underline">
                  contact@aralert.ph
                </a>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Supervisory Authority:{' '}
                <a
                  href="https://privacy.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#0052B7] dark:text-blue-400 hover:underline"
                >
                  National Privacy Commission (NPC) Official Portal
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
              <Link to="/terms" className="font-semibold text-[#0052B7] dark:text-blue-400 hover:underline">
                Terms of Service &rarr;
              </Link>
            </p>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-neutral-600">
            Formulated in strict adherence to Republic Act No. 10173 and National Privacy Commission Circulars. Maintained by the Data Protection Compliance Committee.
          </p>
        </footer>

      </div>
    </div>
  );
};

export default PrivacyPolicy;
