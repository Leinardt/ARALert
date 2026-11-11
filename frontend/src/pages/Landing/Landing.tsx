import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LogoImg from '../../assets/ARALert_Logo_LIGHT.png';
import {
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

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

  // Scroll-triggered entrance animations observer
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
        threshold: 0.08,
      }
    );

    const elements = document.querySelectorAll('.landing-reveal');
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
    <div className="landing-canvas relative min-h-screen w-full text-slate-900 dark:text-white transition-colors duration-200">
      {/* ═══════════════════════════════════════════════════════════════
          1. HOME SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="home"
        className="landing-section-anchor relative z-[2] min-h-[100svh] w-full flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 pt-28 pb-20 box-border overflow-hidden"
      >
        <div className="relative z-10 max-w-6xl mx-auto w-full px-2 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center landing-reveal revealed">
            {/* Left Side: Animated Large Brand Logo */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="group relative flex flex-col items-center">
                <div className="hero-logo-float">
                  <img
                    src={LogoImg}
                    alt="ARALert Logo"
                    className="w-40 sm:w-52 md:w-64 lg:w-[290px] xl:w-[330px] h-auto object-contain select-none transition-transform duration-500 ease-out group-hover:scale-[1.04] group-hover:-rotate-2 drop-shadow-[0_20px_40px_rgba(0,82,183,0.16)] dark:drop-shadow-[0_24px_52px_rgba(59,130,246,0.22)] dark:brightness-110"
                  />
                </div>
                {/* Synchronized ambient floor shadow */}
                <div
                  aria-hidden="true"
                  className="hero-logo-shadow mt-6 w-28 sm:w-36 lg:w-44 h-4 rounded-full bg-[#0052B7]/35 dark:bg-blue-400/35 blur-md pointer-events-none"
                />
              </div>
            </div>

            {/* Right Side: Main Hero Copy & Actions */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-extrabold tracking-[-0.04em] leading-none select-none text-[#0052B7] dark:text-blue-400 mb-6 sm:mb-7">
                ARALert
              </h1>

              {/* Uniform, simplified subtitle */}
              <p className="max-w-2xl mx-auto lg:mx-0 text-lg sm:text-xl md:text-[1.25rem] leading-[1.7] tracking-[-0.01em] text-slate-600 dark:text-slate-300 font-medium mb-9 sm:mb-10">
                A Student Performance Monitoring and Early Academic Risk Detection System for the ARAL Program of Palanas National Agriculture High School.
              </p>

              {/* Primary actions */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 sm:gap-4">
                <Link
                  id="hero-portal-cta"
                  to={isAuthenticated ? getDashboardLink() : '/login'}
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="group inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-xl bg-[#0052B7] hover:bg-[#003982] dark:bg-[#0052B7] dark:hover:bg-[#2563EB] text-white font-semibold text-sm sm:text-[15px] whitespace-nowrap cursor-pointer select-none transition-all duration-200 shadow-[0_8px_24px_-6px_rgba(0,82,183,0.42)] hover:shadow-[0_14px_30px_-6px_rgba(0,57,130,0.58)] hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>
                    {isAuthenticated ? 'Go to Dashboard' : 'Access System Portal'}
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200 shrink-0" />
                </Link>

                <a
                  id="hero-faq-cta"
                  href="#faq"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="group inline-flex items-center justify-center h-12 px-7 rounded-xl bg-white/85 dark:bg-white/[0.06] backdrop-blur-md border border-slate-200/90 dark:border-white/15 text-slate-900 dark:text-white hover:border-[#0052B7] dark:hover:border-blue-400 hover:text-[#0052B7] dark:hover:text-blue-400 font-semibold text-sm sm:text-[15px] whitespace-nowrap cursor-pointer select-none transition-all duration-200 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
                >
                  <span>FAQ</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          2. ABOUT SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="about"
        className="landing-section-anchor relative z-[2] w-full px-4 sm:px-8 lg:px-12 py-24 sm:py-32 box-border"
      >
        <div className="max-w-6xl mx-auto w-full">
          {/* Section Header */}
          <div className="max-w-3xl text-left mb-14 sm:mb-16 landing-reveal">
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0052B7] dark:text-blue-400 mb-3">
              About the Initiative
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-[2.5rem] font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.15] mb-4">
              Bridging learning gaps through purposeful academic monitoring.
            </h2>
            <p className="text-sm sm:text-base lg:text-[17px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Designed for Palanas National Agriculture High School, ARALert provides educators, tutors, and administrators with clear real-time visibility into student performance and attendance.
            </p>
          </div>

          {/* 3 Minimalist Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-7 text-left landing-reveal reveal-delay-100">
            <div className="rounded-2xl bg-white/75 dark:bg-white/[0.03] backdrop-blur-xl border border-white/90 dark:border-white/[0.08] p-7 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.07)] dark:hover:border-white/15">
              <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 dark:text-white tracking-tight mb-2.5">
                Targeted Interventions
              </h3>
              <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Focuses on essential foundational competencies in English, Science, and Mathematics through structured, tutor-led remedial sessions tailored to learner needs.
              </p>
            </div>

            <div className="rounded-2xl bg-white/75 dark:bg-white/[0.03] backdrop-blur-xl border border-white/90 dark:border-white/[0.08] p-7 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.07)] dark:hover:border-white/15">
              <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 dark:text-white tracking-tight mb-2.5">
                Early Risk Detection
              </h3>
              <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Eliminates end-of-term surprises by tracking assessments and attendance in real time, alerting teachers early to adapt learning interventions.
              </p>
            </div>

            <div className="rounded-2xl bg-white/75 dark:bg-white/[0.03] backdrop-blur-xl border border-white/90 dark:border-white/[0.08] p-7 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.07)] dark:hover:border-white/15">
              <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 dark:text-white tracking-tight mb-2.5">
                Unified Community
              </h3>
              <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Connects school heads, subject teachers, volunteer tutors, and students on a single transparent platform with role-based access and shared accountability.
              </p>
            </div>
          </div>

          <p className="mt-8 text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 text-left landing-reveal">
            Aligned with Republic Act No. 12028 (Academic Recovery and Accessible Learning Program Act) to advance learning equity.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          3. FEATURES SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="features"
        className="landing-section-anchor relative z-[2] w-full px-4 sm:px-8 lg:px-12 py-24 sm:py-32 box-border"
      >
        <div className="max-w-6xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start text-left">
            {/* Section Header Column */}
            <div className="lg:col-span-5 lg:sticky lg:top-28 landing-reveal">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0052B7] dark:text-blue-400 mb-3">
                Platform Capabilities
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-[2.5rem] font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.15] mb-4">
                Practical tools built for modern classroom workflows.
              </h2>
              <p className="text-sm sm:text-base lg:text-[17px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Purpose-built modules that eliminate paperwork, keeping educator attention focused on student guidance and measurable recovery.
              </p>
            </div>

            {/* 3 Capability Modules Column */}
            <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-5 landing-reveal reveal-delay-100">
              <div className="rounded-2xl bg-white/75 dark:bg-white/[0.03] backdrop-blur-xl border border-white/90 dark:border-white/[0.08] p-7 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.07)] dark:hover:border-white/15">
                <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                  Automated Grade Tracking
                </h3>
                <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Consolidates formative assessments, periodic quizzes, and task scores with automated weighted computations and clear visual trajectories.
                </p>
              </div>

              <div className="rounded-2xl bg-white/75 dark:bg-white/[0.03] backdrop-blur-xl border border-white/90 dark:border-white/[0.08] p-7 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.07)] dark:hover:border-white/15">
                <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                  Proactive Risk Alerts
                </h3>
                <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Instantly categorizes learners into Low, Moderate, or High Risk cohorts when scores dip below passing benchmarks or absences mount.
                </p>
              </div>

              <div className="rounded-2xl bg-white/75 dark:bg-white/[0.03] backdrop-blur-xl border border-white/90 dark:border-white/[0.08] p-7 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.07)] dark:hover:border-white/15">
                <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                  Dynamic QR Attendance
                </h3>
                <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Rapid session check-in via time-sensitive QR codes prevents proxy attendance and instantly syncs verified timestamps to student records.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          4. FAQ SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="faq"
        className="landing-section-anchor relative z-[2] w-full px-4 sm:px-8 lg:px-12 py-24 sm:py-32 box-border"
      >
        <div className="max-w-6xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start text-left">
            {/* Header Column */}
            <div className="lg:col-span-4 lg:sticky lg:top-28 landing-reveal">
              <div className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0052B7] dark:text-blue-400 mb-3">
                Frequently Asked Questions
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-[2.5rem] font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.15] mb-4">
                Everything you need to know.
              </h2>
              <p className="text-sm sm:text-base lg:text-[17px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Find clear answers regarding ARALert workflows, early risk detection, and attendance verification.
              </p>
            </div>

            {/* Accordion Column */}
            <div className="lg:col-span-8 rounded-2xl bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-white/90 dark:border-white/[0.08] divide-y divide-slate-200/70 dark:divide-white/[0.07] shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:shadow-none overflow-hidden landing-reveal reveal-delay-100">
              {FAQ_DATA.map((faq) => {
                const isOpen = openFAQ === faq.id;

                return (
                  <div
                    key={faq.id}
                    className={`transition-colors duration-200 ${
                      isOpen
                        ? 'bg-white/60 dark:bg-white/[0.02]'
                        : 'hover:bg-white/40 dark:hover:bg-white/[0.01]'
                    }`}
                  >
                    <button
                      type="button"
                      id={`faq-question-${faq.id}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${faq.id}`}
                      onClick={() => toggleFAQ(faq.id)}
                      className="w-full flex items-center justify-between gap-4 px-6 sm:px-8 py-5 sm:py-6 text-left cursor-pointer select-none group"
                    >
                      <span
                        className={`text-base sm:text-[17px] font-semibold tracking-tight leading-snug transition-colors ${
                          isOpen
                            ? 'text-[#0052B7] dark:text-blue-400'
                            : 'text-slate-900 dark:text-white group-hover:text-[#0052B7] dark:group-hover:text-blue-400'
                        }`}
                      >
                        {faq.question}
                      </span>

                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                          isOpen
                            ? 'bg-[#0052B7]/10 dark:bg-blue-400/15 text-[#0052B7] dark:text-blue-400'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-[#0052B7] dark:group-hover:text-blue-400'
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
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-6 sm:px-8 pb-6 text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
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
