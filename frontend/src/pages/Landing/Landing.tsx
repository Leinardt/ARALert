import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LogoImg from '../../assets/ARALert_Logo_LIGHT.png';
import {
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

/* ── 🖊️ Lightweight Hand-Drawn Pen Sketch Accents ────────────────────────── */
/* Positioned so the stroke traces the ruled line the text sits on. */
const PenRoughUnderline: React.FC<{ className?: string; variant?: 'single' | 'double' }> = ({
  className = 'text-[#1A5DAD]/80 dark:text-blue-400/80',
  variant = 'single',
}) => (
  <svg
    viewBox="0 0 240 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`absolute bottom-[5px] left-0 w-full h-2 pointer-events-none ${className}`}
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
    questionNumber: 'Q1',
    topic: 'Mandate & Coverage',
    question: 'What is the primary mandate and coverage of the ARAL Program?',
    answer:
      'Established under Republic Act No. 12028 (Academic Recovery and Accessible Learning Program Act), the ARAL initiative organizes targeted intervention sessions in English, Mathematics, and Science for learners at Palanas National Agriculture High School to recover critical academic competencies.',
  },
  {
    id: 2,
    questionNumber: 'Q2',
    topic: 'Risk Detection',
    question: 'How does ARALert automatically identify learners at academic risk?',
    answer:
      'ARALert continuously tracks formative assessments, periodic quiz scores, and session attendance records. When a student\'s scores drop below established passing thresholds or unexcused absences accumulate, the system automatically flags them into Low, Moderate, or High Risk cohorts for timely teacher and tutor intervention.',
  },
  {
    id: 3,
    questionNumber: 'Q3',
    topic: 'Access & Roles',
    question: 'Who is authorized to access student performance records and evaluations?',
    answer:
      'System access is strictly governed by institutional role: School Principals and Administrators oversee school-wide cohort analytics; Tutors manage their assigned student groups; while Students have individualized access to review their personal score trajectories and attendance records.',
  },
  {
    id: 4,
    questionNumber: 'Q4',
    topic: 'Attendance Security',
    question: 'How does the dynamic QR attendance verification prevent proxy attendance?',
    answer:
      'Tutors generate dynamic, time-sensitive QR check-in codes at the beginning of each scheduled tutorial session. Learners scan the code through their student portal, immediately logging verified timestamps without paper attendance sheets or proxy check-ins.',
  },
  {
    id: 5,
    questionNumber: 'Q5',
    topic: 'Grade Adjustments',
    question: 'Can tutors submit score updates or assessment corrections after submission?',
    answer:
      'Yes. Tutors can submit student score revision requests directly through their evaluation portal. All edit requests are submitted to academic administrators for verification and logged into the immutable audit trail to ensure grading transparency.',
  },
  {
    id: 6,
    questionNumber: 'Q6',
    topic: 'Data Privacy',
    question: 'How does ARALert protect learner data under Philippine privacy laws?',
    answer:
      'All learner records—including Learner Reference Numbers (LRN), academic scores, and attendance logs—are secured under Republic Act No. 10173 (Data Privacy Act of 2012) using encrypted authentication, role-based access control, and comprehensive audit trails.',
  },
];

/* Notebook grid constants (must match --notebook-grid in theme.css) */
const GRID = 40;
const SECTION_IDS = ['home', 'about', 'features', 'faq'];
/* Rows reserved at the top of every section: 2 for the fixed navbar + 1 blank row */
const MIN_TOP_ROWS = 3;

/* Shared section shell: same side padding as the navbar so edges line up */
const SECTION_CLASS =
  'landing-section-anchor relative z-[2] min-h-screen w-full flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 pt-20 pb-20 box-border';

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

  // Snap every section's height to a multiple of the 40px ruled grid
  useEffect(() => {
    const snapSections = () => {
      SECTION_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.style.minHeight = '';
          const rect = el.getBoundingClientRect();
          const targetHeight = Math.max(rect.height, window.innerHeight);
          const snapped = Math.ceil(targetHeight / GRID) * GRID;
          el.style.minHeight = `${snapped}px`;
        }
      });
    };

    snapSections();
    const timer = setTimeout(snapSections, 150);
    document.fonts?.ready.then(snapSections);
    window.addEventListener('resize', snapSections);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', snapSections);
    };
  }, []);

  // Scroll-triggered entrance animations observer with eager reveal on load
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      {
        threshold: 0.05,
      }
    );

    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add('revealed');
      }
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen notebook-paper text-slate-900 dark:text-white transition-colors duration-200">
      {/* Main Sections */}

      {/* ═══════════════════════════════════════════════════════════════
          1. HOME SECTION (Notebook Cover Page with Pen Accents)
          ═══════════════════════════════════════════════════════════════ */}
      <section id="home" className={`${SECTION_CLASS} overflow-hidden text-slate-900 dark:text-white`}>
        <div className="notebook-page-container notebook-page-container--centered max-w-6xl mx-auto w-full">
          <div className="max-w-3xl mx-auto text-center scroll-reveal">
            {/* Main Hero Headline — 2 rows, wordmark baseline resting on the second rule */}
            <h1 className="notebook-snap-h1 font-black tracking-tight flex items-end justify-center gap-2 select-none mb-10">
              <img
                src={LogoImg}
                alt="A"
                className="h-[52px] sm:h-[58px] w-auto object-contain mb-3"
              />
              <span className="relative top-[calc(28px-0.35em)] text-[#0052B7] dark:text-blue-400 font-extrabold tracking-tight">
                RALert
              </span>
            </h1>

            {/* Subtitle — one ruled row per line */}
            <p className="notebook-snap-lead text-slate-700 dark:text-slate-200 font-medium mb-10">
              A Student Performance Monitoring and{' '}
              <span className="relative inline-block text-slate-900 dark:text-white font-bold">
                Early Academic Risk Detection
                <PenRoughUnderline variant="single" className="text-[#1A5DAD]/80 dark:text-blue-400/80" />
              </span>{' '}
              System for the ARAL Program of{' '}
              <span className="relative inline-block px-3.5 mx-1 font-bold text-[#0052B7] dark:text-blue-400 whitespace-normal sm:whitespace-nowrap break-words">
                Palanas National Agriculture High School
                <PenDoodleOval className="text-[#0052B7] dark:text-blue-400" />
              </span>
              <span className="inline-block pl-0.5">.</span>
            </p>

            {/* Primary actions — one blank row, then 2-row buttons whose borders sit on rules */}
            <div className="mt-10 flex flex-wrap items-start justify-center gap-x-4 gap-y-[38px]">
              <Link
                id="hero-portal-cta"
                to={isAuthenticated ? getDashboardLink() : '/login'}
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="group notebook-btn-2line inline-flex items-center justify-center gap-2.5 px-8 rounded-xl border-2 border-[#0052B7] dark:border-blue-400 text-[#0052B7] dark:text-blue-400 hover:!bg-[#0052B7] hover:!text-white hover:!border-[#0052B7] dark:hover:!bg-[#0052B7] dark:hover:!text-white font-bold text-base cursor-pointer select-none transition-all duration-200 hover:shadow-lg hover:shadow-blue-600/25"
              >
                <span className="text-[#0052B7] dark:text-blue-400 group-hover:!text-white transition-colors duration-200">
                  {isAuthenticated ? 'Go to Dashboard' : 'Access System Portal'}
                </span>
                <ArrowRight className="w-5 h-5 text-[#0052B7] dark:text-blue-400 group-hover:!text-white group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
              </Link>

              <a
                id="hero-faq-cta"
                href="#faq"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="group notebook-btn-2line inline-flex items-center justify-center px-8 rounded-xl border-2 border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-slate-200 hover:!border-[#0052B7] hover:!bg-blue-50/70 hover:!text-[#0052B7] dark:hover:!border-blue-400 dark:hover:!bg-blue-950/40 dark:hover:!text-blue-400 font-bold text-base cursor-pointer select-none transition-all duration-200"
              >
                <span className="group-hover:!text-[#0052B7] dark:group-hover:!text-blue-400 transition-colors duration-200">
                  FAQ
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          2. ABOUT SECTION (Minimalist & Grid-Aligned)
          ═══════════════════════════════════════════════════════════════ */}
      <section id="about" className={SECTION_CLASS}>
        <div className="notebook-page-container max-w-6xl mx-auto w-full relative">
          {/* Dark Mode Glassmorphic Container (encapsulates text with zero position shift) */}
          <div className="pointer-events-none absolute -inset-x-4 sm:-inset-x-8 -inset-y-6 sm:-inset-y-8 rounded-3xl opacity-0 dark:opacity-100 bg-neutral-900/60 backdrop-blur-xl backdrop-saturate-150 border border-white/10 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7),inset_0_1px_1px_0_rgba(255,255,255,0.08)] transition-opacity duration-300 overflow-hidden">
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10">
            {/* Section Header (locked to 40px grid) */}
            <div className="max-w-4xl scroll-reveal text-left mb-10">
              <p className="notebook-snap-xs font-semibold tracking-wider uppercase text-[#0052B7] dark:text-blue-400">
                About the Initiative
              </p>
              <h2 className="notebook-snap-h2 font-bold text-slate-900 dark:text-white tracking-tight">
                Bridging learning gaps through purposeful academic monitoring.
              </h2>
              <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal">
                Designed for Palanas National Agriculture High School, ARALert provides educators, tutors, and administrators with clear real-time visibility into student performance and attendance.
              </p>
            </div>

            {/* 3 Minimalist Pillars (each element locked to 40px rows) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 lg:gap-x-12 gap-y-10 scroll-reveal scroll-delay-100 text-left">
              <div>
                <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                  Targeted Interventions
                </h3>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal">
                  Focuses on essential foundational competencies in English, Science, and Mathematics through structured, tutor-led remedial sessions tailored to learner needs.
                </p>
              </div>

              <div>
                <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                  Early Risk Detection
                </h3>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal">
                  Eliminates end-of-term surprises by tracking assessments and attendance in real time, alerting teachers early to adapt learning interventions.
                </p>
              </div>

              <div>
                <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                  Unified Community
                </h3>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal">
                  Connects school heads, subject teachers, volunteer tutors, and students on a single transparent platform with role-based access and shared accountability.
                </p>
              </div>
            </div>

            <p className="notebook-snap-xs mt-10 text-slate-500 dark:text-slate-400 text-left scroll-reveal">
              Aligned with <strong className="text-slate-700 dark:text-slate-300 font-semibold">Republic Act No. 12028</strong> (Academic Recovery and Accessible Learning Program Act) to advance learning equity.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          3. FEATURES SECTION (Minimalist & Grid-Aligned)
          ═══════════════════════════════════════════════════════════════ */}
      <section id="features" className={SECTION_CLASS}>
        <div className="notebook-page-container max-w-6xl mx-auto w-full relative">
          {/* Dark Mode Glassmorphic Container (encapsulates text with zero position shift) */}
          <div className="pointer-events-none absolute -inset-x-4 sm:-inset-x-8 -inset-y-6 sm:-inset-y-8 rounded-3xl opacity-0 dark:opacity-100 bg-neutral-900/60 backdrop-blur-xl backdrop-saturate-150 border border-white/10 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7),inset_0_1px_1px_0_rgba(255,255,255,0.08)] transition-opacity duration-300 overflow-hidden">
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10">
            {/* Section Header (locked to 40px grid) */}
            <div className="max-w-4xl scroll-reveal text-left mb-10">
              <p className="notebook-snap-xs font-semibold tracking-wider uppercase text-[#0052B7] dark:text-blue-400">
                Platform Capabilities
              </p>
              <h2 className="notebook-snap-h2 font-bold text-slate-900 dark:text-white tracking-tight">
                Practical tools built for modern classroom workflows.
              </h2>
              <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal">
                Purpose-built modules that eliminate paperwork, keeping educator attention focused on student guidance and measurable recovery.
              </p>
            </div>

            {/* 3 Minimalist Capability Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 lg:gap-x-12 gap-y-10 scroll-reveal scroll-delay-100 text-left">
              <div>
                <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                  Automated Grade Tracking
                </h3>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal">
                  Consolidates formative assessments, periodic quizzes, and task scores with automated weighted computations and clear visual trajectories.
                </p>
              </div>

              <div>
                <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                  Proactive Risk Alerts
                </h3>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal">
                  Instantly categorizes learners into Low, Moderate, or High Risk cohorts when scores dip below passing benchmarks or absences mount.
                </p>
              </div>

              <div>
                <h3 className="notebook-snap-h3 font-semibold text-slate-900 dark:text-white tracking-tight">
                  Dynamic QR Attendance
                </h3>
                <p className="notebook-snap-p text-slate-600 dark:text-slate-400 font-normal">
                  Rapid session check-in via time-sensitive QR codes prevents proxy attendance and instantly syncs verified timestamps to student records.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          4. FAQ SECTION (Clean Container Accordion)
          ═══════════════════════════════════════════════════════════════ */}
      <section id="faq" className={SECTION_CLASS}>
        <div className="max-w-4xl mx-auto w-full px-2 sm:px-0">
          {/* Glassmorphic Dedicated Container */}
          <div className="relative overflow-hidden bg-white/70 dark:bg-neutral-900/50 backdrop-blur-xl backdrop-saturate-150 border border-white/70 dark:border-white/10 rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.06),inset_0_1px_1px_0_rgba(255,255,255,0.85)] dark:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7),inset_0_1px_1px_0_rgba(255,255,255,0.08)] scroll-reveal">
            {/* Subtle glass reflection highlight */}
            <div className="pointer-events-none absolute -top-20 -left-20 w-64 h-64 bg-blue-400/10 dark:bg-blue-500/10 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-3xl" />

            {/* Header */}
            <div className="relative text-left mb-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase text-[#0052B7] dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/50 backdrop-blur-md border border-blue-200/50 dark:border-blue-800/40 mb-3">
                Frequently Asked Questions
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Everything you need to know.
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                Find clear answers regarding ARALert workflows, early risk detection, and attendance verification.
              </p>
            </div>

            {/* Clean Glass Accordion Items */}
            <div className="relative divide-y divide-slate-200/50 dark:divide-white/5 text-left">
              {FAQ_DATA.map((faq) => {
                const isOpen = openFAQ === faq.id;

                return (
                  <div key={faq.id} className="py-4 first:pt-0 last:pb-0 transition-colors">
                    <button
                      type="button"
                      id={`faq-question-${faq.id}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${faq.id}`}
                      onClick={() => toggleFAQ(faq.id)}
                      className="w-full flex items-center justify-between gap-4 text-left cursor-pointer select-none group"
                    >
                      <span
                        className={`text-base sm:text-lg font-semibold tracking-tight transition-colors ${
                          isOpen
                            ? 'text-[#0052B7] dark:text-blue-400'
                            : 'text-slate-900 dark:text-white group-hover:text-[#0052B7] dark:group-hover:text-blue-400'
                        }`}
                      >
                        {faq.question}
                      </span>

                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                          isOpen
                            ? 'bg-blue-500/10 dark:bg-blue-400/15 text-[#0052B7] dark:text-blue-400'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-[#0052B7] dark:group-hover:text-blue-400 group-hover:bg-slate-100/60 dark:group-hover:bg-white/5'
                        }`}
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ease-out ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>

                    <div
                      id={`faq-answer-${faq.id}`}
                      role="region"
                      aria-labelledby={`faq-question-${faq.id}`}
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out ${
                        isOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed pl-1">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
