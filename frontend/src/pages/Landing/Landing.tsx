import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LogoImg from '../../assets/ARALert_Logo_LIGHT.png';
import {
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

/* ── 🖊️ Lightweight Hand-Drawn Pen Sketch Accents ────────────────────────── */
const PenRoughUnderline: React.FC<{ className?: string; variant?: 'single' | 'double' }> = ({
  className = 'text-[#1A5DAD]/80 dark:text-blue-400/80',
  variant = 'single',
}) => (
  <svg
    viewBox="0 0 240 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`absolute -bottom-0.5 left-0 w-full h-2 pointer-events-none ${className}`}
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path
      d="M2 4C55 8 135 2 238 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {variant === 'double' && (
      <path
        d="M6 9C65 10 145 6 232 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    )}
  </svg>
);

const TeacherCheckmark: React.FC<{ className?: string }> = ({ className = 'text-[#1A5DAD] dark:text-blue-400' }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-4 h-4 inline-block shrink-0 ${className}`}
    aria-hidden="true"
  >
    <path
      d="M3 10.5L7.5 15L17 4.5"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PenDoodleOval: React.FC<{ className?: string }> = ({
  className = 'text-[#0052B7] dark:text-blue-400',
}) => (
  <svg
    viewBox="0 0 460 76"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`absolute -inset-x-4 -inset-y-3 w-[calc(100%+2rem)] h-[calc(100%+1.5rem)] pointer-events-none select-none ${className}`}
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    {/* Primary hand-drawn organic loop */}
    <path
      d="M16 38 C 14 16, 50 4, 130 3 C 240 1, 415 3, 442 18 C 458 29, 452 54, 422 65 C 378 74, 175 74, 70 69 C 26 67, 9 52, 17 35 C 24 20, 70 8, 150 5"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-95"
    />
    {/* Secondary soft pen pass for organic realism */}
    <path
      d="M26 35 C 24 23, 65 11, 140 9 C 228 7, 395 8, 434 23 C 449 34, 436 55, 408 62 C 352 70, 155 70, 58 64"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-60"
    />
  </svg>
);

interface FAQItem {
  id: number;
  questionNumber: string;
  question: string;
  topic: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 1,
    questionNumber: 'Q01',
    topic: 'Mandate & Coverage',
    question: 'What is the primary mandate and coverage of the ARAL Program?',
    answer:
      'Established under Republic Act No. 12028 (Academic Recovery and Accessible Learning Program Act), the ARAL initiative organizes targeted intervention sessions in English, Mathematics, and Science for learners at Palanas National Agriculture High School to recover critical academic competencies.',
  },
  {
    id: 2,
    questionNumber: 'Q02',
    topic: 'Risk Detection',
    question: 'How does ARALert automatically identify learners at academic risk?',
    answer:
      'ARALert continuously tracks formative assessments, periodic quiz scores, and session attendance records. When a student\'s scores drop below established passing thresholds or unexcused absences accumulate, the system automatically flags them into Low, Moderate, or High Risk cohorts for timely teacher and tutor intervention.',
  },
  {
    id: 3,
    questionNumber: 'Q03',
    topic: 'Access & Roles',
    question: 'Who is authorized to access student performance records and evaluations?',
    answer:
      'System access is strictly governed by institutional role: School Principals and Administrators oversee school-wide cohort analytics; Subject Teachers and Tutors manage their assigned student groups; while Students have individualized access to review their personal score trajectories and attendance records.',
  },
  {
    id: 4,
    questionNumber: 'Q04',
    topic: 'Attendance Security',
    question: 'How does the dynamic QR attendance verification prevent proxy attendance?',
    answer:
      'Tutors generate dynamic, time-sensitive QR check-in codes at the beginning of each scheduled tutorial session. Learners scan the code through their student portal, immediately logging verified timestamps without paper attendance sheets or proxy check-ins.',
  },
  {
    id: 5,
    questionNumber: 'Q05',
    topic: 'Grade Adjustments',
    question: 'Can tutors submit score updates or assessment corrections after submission?',
    answer:
      'Yes. Tutors can submit student score revision requests directly through their evaluation portal. All edit requests are submitted to academic administrators for verification and logged into the immutable audit trail to ensure grading transparency.',
  },
  {
    id: 6,
    questionNumber: 'Q06',
    topic: 'Data Privacy',
    question: 'How does ARALert protect learner data under Philippine privacy laws?',
    answer:
      'All learner records—including Learner Reference Numbers (LRN), academic scores, and attendance logs—are secured under Republic Act No. 10173 (Data Privacy Act of 2012) using encrypted authentication, role-based access control, and comprehensive audit trails.',
  },
];

export const Landing: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [openFAQ, setOpenFAQ] = useState<number | null>(1);

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.is_superuser) return '/superadmin';
    return `/${user.role}`;
  };

  const toggleFAQ = (id: number) => {
    setOpenFAQ((prev) => (prev === id ? null : id));
  };

  // Handle hash scrolling when arriving from other pages
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 120);
      }
    }
  }, []);

  // Snap each section's height to at least full viewport, integer multiple of 32px notebook grid
  useEffect(() => {
    const snapSections = () => {
      ['home', 'about', 'features', 'faq'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.style.minHeight = '';
          const rect = el.getBoundingClientRect();
          const targetHeight = Math.max(rect.height, window.innerHeight);
          const snapped = Math.ceil(targetHeight / 40) * 40;
          el.style.minHeight = `${snapped}px`;
        }
      });
    };

    snapSections();
    const timer = setTimeout(snapSections, 150);
    window.addEventListener('resize', snapSections);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', snapSections);
    };
  }, []);

  // Scroll-triggered entrance animations observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          } else {
            entry.target.classList.remove('revealed');
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.1,
      }
    );

    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen notebook-paper text-slate-900 dark:text-white transition-colors duration-200">
      {/* ═══════════════════════════════════════════════════════════════
          1. HOME SECTION (Notebook Cover Page with Pen Accents)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="home"
        className="landing-section-anchor relative min-h-screen min-h-[100dvh] w-full flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 pt-20 pb-12 text-slate-900 dark:text-white overflow-hidden box-border"
      >
        <div className="max-w-4xl mx-auto w-full my-auto flex flex-col items-center justify-center text-center">
          <div className="w-full flex flex-col justify-center items-center text-center max-w-3xl mx-auto scroll-reveal">
            {/* Main Hero Headline */}
            <h1 className="notebook-snap-h1 font-black tracking-tight flex items-center justify-center gap-2 select-none mx-auto mb-8">
              <img
                src={LogoImg}
                alt="A"
                className="h-[52px] sm:h-[58px] w-auto object-contain inline-block drop-shadow-sm transition-transform duration-200 hover:scale-105"
              />
              <span className="text-[#0052B7] dark:text-blue-400 font-extrabold tracking-tight">
                RALert
              </span>
            </h1>

            {/* Subtitle / Accompanying Description Text with Clean Pen Underlines & Encircled School Accent */}
            <p className="text-base sm:text-lg lg:text-[1.25rem] leading-[2.25rem] sm:leading-[2.5rem] text-slate-700 dark:text-slate-200 font-medium max-w-3xl mx-auto px-2 mb-8">
              A Web-Based Student Performance Monitoring and{' '}
              <span className="relative inline-block text-red-600 dark:text-red-500 font-bold">
                Early Academic Risk Detection
                <PenRoughUnderline variant="single" className="text-[#1A5DAD]/80 dark:text-blue-400/80" />
              </span>{' '}
              System for the ARAL Program of{' '}
              <span className="relative inline-block px-4 py-1 mx-2 font-bold text-[#0052B7] dark:text-blue-400 whitespace-nowrap">
                Palanas National Agriculture High School
                <PenDoodleOval className="text-[#0052B7] dark:text-blue-400" />
              </span>
              <span className="inline-block pl-1">.</span>
            </p>

            {/* Primary Action Group: 2-line buttons (64px, borders flush with rules) */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-8 w-full">
              <Link
                to={isAuthenticated ? getDashboardLink() : '/login'}
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="group notebook-btn-2line inline-flex items-center justify-center gap-2.5 px-8 font-bold rounded-xl cursor-pointer select-none text-base border-2 border-[#0052B7] dark:border-blue-400 bg-transparent text-[#0052B7] dark:text-blue-400 hover:!bg-[#0052B7] hover:!text-white hover:!border-[#0052B7] dark:hover:!bg-[#0052B7] dark:hover:!text-white hover:shadow-lg hover:shadow-blue-600/25 transition-all duration-200"
              >
                <span className="text-[#0052B7] dark:text-blue-400 group-hover:!text-white transition-colors duration-200">
                  {isAuthenticated ? 'Go to Dashboard' : 'Access System Portal'}
                </span>
                <ArrowRight className="w-5 h-5 text-[#0052B7] dark:text-blue-400 group-hover:!text-white group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
              </Link>

              <a
                href="#faq"
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById('faq');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="group notebook-btn-2line inline-flex items-center justify-center gap-1.5 px-8 text-base font-bold rounded-xl border-2 border-slate-300 dark:border-neutral-700 bg-transparent text-slate-700 dark:text-slate-200 hover:!bg-[#0052B7] hover:!text-white hover:!border-[#0052B7] dark:hover:!bg-[#0052B7] dark:hover:!text-white hover:shadow-lg hover:shadow-blue-600/25 transition-all duration-200 cursor-pointer select-none"
              >
                <span>FAQ</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          2. ABOUT SECTION (Left-to-Right Margin Layout with Red Rule)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="about"
        className="landing-section-anchor relative min-h-screen min-h-[100dvh] w-full flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 pt-20 pb-12 box-border"
      >
        <div className="notebook-page-container max-w-6xl mx-auto w-full my-auto">
          {/* Vertical Red Margin Rule Line */}
          <div className="notebook-red-margin-line" aria-hidden="true" />

          {/* Left Margin Gutter Annotation */}
          <div className="absolute left-1 sm:left-2 lg:left-3 top-4 sm:top-6 font-mono text-[10px] sm:text-xs text-[#1A5DAD]/80 dark:text-blue-400/70 font-bold select-none tracking-tight">
            PART I
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start text-left">
            {/* Left Column (5 cols): Natural Left-to-Right Flow */}
            <div className="lg:col-span-5 flex flex-col lg:sticky lg:top-28 scroll-reveal text-left">
              <span className="notebook-snap-xs font-semibold tracking-wider uppercase text-[#0052B7] dark:text-blue-400 block text-left">
                About the Initiative
              </span>
              <h2 className="notebook-snap-h2 font-bold text-slate-900 dark:text-white tracking-tight mb-8 text-left">
                Bridging learning gaps through purposeful academic monitoring.
              </h2>
              <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal mb-8 text-left">
                Designed for Palanas National Agriculture High School, ARALert provides educators and tutors with clear insight into student performance and attendance.
              </p>
              <div className="pt-8 border-t border-slate-200/80 dark:border-neutral-800 text-left">
                <p className="notebook-snap-xs text-slate-400 dark:text-slate-500 text-left">
                  Aligned with{' '}
                  <span className="relative inline-block font-semibold text-slate-600 dark:text-slate-300">
                    Republic Act No. 12028
                    <PenRoughUnderline variant="single" className="text-amber-500/80 dark:text-amber-400/80" />
                  </span>{' '}
                  (Academic Recovery and Accessible Learning Program Act) to support educational recovery and equity.
                </p>
              </div>
            </div>

            {/* Right Column (7 cols): Three Left-Aligned Items with Pen Checkmarks */}
            <div className="lg:col-span-7 flex flex-col space-y-8 scroll-reveal scroll-delay-100 text-left">
              {/* Item 1 */}
              <div className="text-left">
                <div className="flex items-center gap-2 h-8">
                  <TeacherCheckmark />
                  <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                    Core learning recovery
                  </h3>
                </div>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal text-left">
                  Focuses on essential competencies in English, Science, and Mathematics through structured, tutor-led sessions tailored to individual student needs.
                </p>
              </div>

              {/* Item 2 */}
              <div className="text-left">
                <div className="flex items-center gap-2 h-8">
                  <TeacherCheckmark />
                  <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                    Early risk detection
                  </h3>
                </div>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal text-left">
                  Replaces end-of-term surprises with continuous monitoring. Performance dips and attendance patterns are identified early so teachers can adapt their support.
                </p>
              </div>

              {/* Item 3 */}
              <div className="text-left">
                <div className="flex items-center gap-2 h-8">
                  <TeacherCheckmark />
                  <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                    Connected school community
                  </h3>
                </div>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal text-left">
                  Brings school administrators, subject teachers, tutors, and students together onto a unified, transparent record for shared accountability.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          3. FEATURES SECTION (Left-to-Right Margin Layout with Red Rule)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="features"
        className="landing-section-anchor relative min-h-screen min-h-[100dvh] w-full flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 pt-20 pb-12 box-border"
      >
        <div className="notebook-page-container max-w-6xl mx-auto w-full my-auto">
          {/* Vertical Red Margin Rule Line */}
          <div className="notebook-red-margin-line" aria-hidden="true" />

          {/* Left Margin Gutter Annotation */}
          <div className="absolute left-1 sm:left-2 lg:left-3 top-4 sm:top-6 font-mono text-[10px] sm:text-xs text-[#1A5DAD]/80 dark:text-blue-400/70 font-bold select-none tracking-tight">
            PART II
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start text-left">
            {/* Left Column (5 cols): Clean, Left-Aligned Intro */}
            <div className="lg:col-span-5 flex flex-col lg:sticky lg:top-28 scroll-reveal text-left">
              <span className="notebook-snap-xs font-semibold tracking-wider uppercase text-[#0052B7] dark:text-blue-400 block text-left">
                Platform Capabilities
              </span>
              <h2 className="notebook-snap-h2 font-bold text-slate-900 dark:text-white tracking-tight mb-8 text-left">
                Practical tools designed for everyday classroom workflow.
              </h2>
              <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal mb-8 text-left">
                Three essential modules that simplify daily administrative routines and keep instructional time focused on student mentorship.
              </p>
              <div className="pt-8 border-t border-slate-200/80 dark:border-neutral-800 text-left">
                <p className="notebook-snap-xs text-slate-400 dark:text-slate-500 text-left">
                  Synchronized in real time across daily check-ins, assessment scoring, and official DepEd reporting formats.
                </p>
              </div>
            </div>

            {/* Right Column (7 cols): Three Left-Aligned Items with Pen Checkmarks */}
            <div className="lg:col-span-7 flex flex-col space-y-8 scroll-reveal scroll-delay-100 text-left">
              {/* Feature 1 */}
              <div className="text-left">
                <div className="flex items-center gap-2 h-8">
                  <TeacherCheckmark />
                  <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                    Automated performance tracking
                  </h3>
                </div>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal text-left">
                  Consolidates formative assessments, weekly quizzes, and tasks into clear summaries with automatic weighted calculations—saving teachers hours of spreadsheet work.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="text-left">
                <div className="flex items-center gap-2 h-8">
                  <TeacherCheckmark />
                  <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                    Academic risk alerts
                  </h3>
                </div>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal text-left">
                  Flags learners who fall below target passing thresholds or incur unexcused absences, prompting timely intervention before learning gaps widen.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="text-left">
                <div className="flex items-center gap-2 h-8">
                  <TeacherCheckmark />
                  <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                    Quick QR attendance
                  </h3>
                </div>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal text-left">
                  Fast session check-in and check-out via dynamic QR codes, keeping attendance records verified and tamper-proof without paper sign-in sheets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          4. FAQ SECTION (Quiz-Style Assessment Paper with Reveal Interaction)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="faq"
        className="landing-section-anchor relative min-h-screen min-h-[100dvh] w-full flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 pt-20 pb-16 box-border"
      >
        <div className="notebook-page-container max-w-6xl mx-auto w-full my-auto">
          {/* Vertical Red Margin Rule Line */}
          <div className="notebook-red-margin-line" aria-hidden="true" />

          {/* Left Margin Gutter Annotation */}
          <div className="absolute left-1 sm:left-2 lg:left-3 top-4 sm:top-6 font-mono text-[10px] sm:text-xs text-[#1A5DAD]/80 dark:text-blue-400/70 font-bold select-none tracking-tight">
            PART III
          </div>

          {/* Classroom Exam Paper Header Block */}
          <div className="border-b-2 border-slate-300 dark:border-neutral-700 pb-8 mb-8 text-xs font-mono text-slate-500 dark:text-slate-400 scroll-reveal text-left">
            <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-dashed border-slate-200 dark:border-neutral-800">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">ASSESSMENT:</span> ARAL Program Knowledge Check
              </div>
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">SUBJECT:</span> Academic Recovery & Oversight
              </div>
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">SCORE:</span>{' '}
                <span className="text-[#0052B7] dark:text-blue-400 font-bold underline decoration-blue-400">100% (A+)</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 text-[11px]">
              <p className="text-slate-600 dark:text-slate-400">
                <strong className="text-slate-800 dark:text-slate-200">DIRECTIONS:</strong> Click any question below to break the seal and reveal the verified answer key.
              </p>
              <span className="text-[#0052B7] dark:text-blue-400 font-semibold uppercase tracking-wider text-[10px]">
                [ Official Teacher's Key ]
              </span>
            </div>
          </div>

          {/* Section Titles */}
          <div className="mb-8 scroll-reveal text-left">
            <span className="notebook-snap-xs font-bold tracking-widest uppercase text-[#0052B7] dark:text-blue-400 block mb-8 text-left">
              Frequently Asked Questions
            </span>
            <h2 className="notebook-snap-h2 font-black text-slate-900 dark:text-white tracking-tight mb-8 text-left">
              Comprehensive Platform Knowledge Check
            </h2>
            <p className="notebook-snap-p text-slate-600 dark:text-slate-400 text-left mb-8">
              Everything educators, tutors, and learners need to know regarding ARALert workflows, early risk detection, and attendance verification.
            </p>
          </div>

          {/* Quiz Test Paper Rows with Reveal Interaction */}
          <div className="divide-y divide-slate-200/80 dark:divide-neutral-800 border-y border-slate-200/80 dark:border-neutral-800 scroll-reveal scroll-delay-100 text-left">
            {FAQ_DATA.map((faq, index) => {
              const isOpen = openFAQ === faq.id;

              return (
                <div
                  key={faq.id}
                  className={`transition-colors duration-200 relative ${isOpen
                      ? 'bg-blue-50/20 dark:bg-neutral-900/40'
                      : 'hover:bg-slate-50/30 dark:hover:bg-neutral-900/10'
                    }`}
                >
                  {/* Left Margin Gutter Question Indicator (Comfortably left of vertical margin guide line) */}
                  <div
                    className="absolute right-[calc(100%+1.25rem)] sm:right-[calc(100%+1.75rem)] lg:right-[calc(100%+2.25rem)] top-5 font-mono font-bold text-xs sm:text-sm text-[#1A5DAD] dark:text-blue-400 select-none text-right whitespace-nowrap"
                    aria-hidden="true"
                  >
                    {faq.questionNumber}
                  </div>

                  <button
                    type="button"
                    id={`quiz-question-${faq.id}`}
                    aria-expanded={isOpen}
                    aria-controls={`quiz-answer-${faq.id}`}
                    onClick={() => toggleFAQ(faq.id)}
                    className="w-full flex flex-wrap items-center justify-between gap-3 py-4 sm:py-5 text-left group cursor-pointer select-none transition-colors box-border min-h-16"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 pr-2 min-w-0 flex-1">
                      {/* Left vertical status indicator */}
                      <span
                        className={`w-1.5 h-6 rounded-full transition-colors duration-200 shrink-0 ${isOpen ? 'bg-[#0052B7] dark:bg-blue-400' : 'bg-transparent'
                          }`}
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
                          {faq.topic}
                        </span>
                        <span
                          className={`text-sm sm:text-base lg:text-lg tracking-tight transition-colors block ${isOpen
                              ? 'text-[#0052B7] dark:text-blue-400 font-bold'
                              : 'text-slate-900 dark:text-white group-hover:text-[#0052B7] dark:group-hover:text-blue-400 font-semibold'
                            }`}
                        >
                          {faq.question}
                        </span>
                      </div>
                    </div>

                    {/* Interactive Reveal Tag / Button */}
                    <div className="flex items-center gap-2 shrink-0 pr-2">
                      <span
                        className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all duration-200 border ${isOpen
                            ? 'bg-blue-100/70 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-[#0052B7] dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-400 group-hover:border-[#0052B7] group-hover:text-[#0052B7] dark:group-hover:text-blue-400'
                          }`}
                      >
                        {isOpen ? 'Answer Key: Revealed ✓' : 'Reveal Answer Key ▾'}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform duration-300 ease-out ${isOpen
                            ? 'rotate-180 text-[#0052B7] dark:text-blue-400'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-[#0052B7] dark:group-hover:text-blue-400'
                          }`}
                      />
                    </div>
                  </button>

                  {/* Revealed Teacher Answer Key Content */}
                  <div
                    id={`quiz-answer-${faq.id}`}
                    role="region"
                    aria-labelledby={`quiz-question-${faq.id}`}
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pb-6 pt-2 pl-4 sm:pl-7 pr-2 sm:pr-6 border-l-2 border-[#0052B7] dark:border-blue-400 ml-2 mb-4">
                        <div className="text-xs font-bold font-mono text-[#0052B7] dark:text-blue-400 mb-2 flex items-center gap-1.5 h-6">
                          <TeacherCheckmark />
                          <span>OFFICIAL ANSWER KEY & RATIONALE:</span>
                        </div>
                        <p className="notebook-snap-p text-slate-700 dark:text-slate-300 font-normal text-left">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
