import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  TrendingUp,
  AlertTriangle,
  QrCode,
  ArrowRight,
  ChevronDown,
  Info,
  BookOpen,
  HelpCircle,
  School,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  Users,
  Target,
} from 'lucide-react';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 1,
    question: 'What is the ARAL Program?',
    answer:
      'The Academic Recovery and Accessible Learning (ARAL) program is a national Department of Education initiative established to accelerate learning recovery. ARALert serves as the dedicated digital monitoring and early intervention system for Palanas National Agriculture High School to track student attendance, analyze performance trends, and coordinate targeted recovery sessions.',
  },
  {
    id: 2,
    question: 'How does performance monitoring and evaluation work?',
    answer:
      'Tutors and faculty log assessment scores, weekly tasks, and session activities. The system automatically computes weighted performance indicators based on official program metrics, updating learner progress in real time without manual spreadsheet calculations.',
  },
  {
    id: 3,
    question: 'What triggers an academic risk alert?',
    answer:
      'Risk levels (Low, Moderate, High) are evaluated automatically through attendance patterns and assessment scores. If a learner scores below target thresholds or incurs unexcused absences, tutors and school leaders receive instant alerts to provide timely interventions.',
  },
  {
    id: 4,
    question: 'How is attendance recorded using QR codes?',
    answer:
      'Tutors generate session-specific QR codes. Students or staff scan the code using the integrated QR scanner to register instant, timestamped check-ins and check-outs, eliminating manual sign-in sheets and errors.',
  },
  {
    id: 5,
    question: 'Who has access to ARALert data?',
    answer:
      'ARALert implements strict role-based access control. Principals, Administrators, Faculty, Tutors, and Students each have tailored portal views with secured permissions to protect sensitive student records.',
  },
  {
    id: 6,
    question: 'Can reports and attendance logs be exported?',
    answer:
      'Yes. Teachers and administrators can generate official printable DTR logs, attendance sheets, and academic score summaries with one click for administrative reporting and DepEd documentation.',
  },
];

export const Landing: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [openFAQ, setOpenFAQ] = useState<number | null>(1);
  const [activeFeatureTab, setActiveFeatureTab] = useState<number>(0);

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.is_superuser) return '/superadmin';
    return `/${user.role}`;
  };

  const toggleFAQ = (id: number) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  return (
    <div className="bg-[var(--surface-bg)] text-[var(--text-primary)]">
      {/* ═══════════════════════════════════════════════════════════════
          1. HOME SECTION (Fills Full Viewport)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="home"
        className="relative min-h-[calc(100vh-64px)] flex flex-col justify-center items-center px-6 py-12 md:py-20 border-b border-[var(--slate-200)] overflow-hidden"
      >
        {/* Subtle Ambient Background Gradients */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-60 dark:opacity-30"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 10%, rgba(46, 158, 68, 0.08) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20 bg-[var(--brand)]"
        />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6 md:space-y-8">
          {/* Institutional Badge */}
          {/* Main Hero Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.15] text-[var(--text-primary)]">
            Detect academic risk early.{' '}
            <span className="text-[var(--brand)] block sm:inline">
              Empower student recovery.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed font-normal">
            A unified digital companion for the Academic Recovery and Accessible Learning initiative.
            Automated performance tracking, rapid QR attendance, and intelligent risk detection for every learner.
          </p>

          {/* Primary Action Group */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <Link
              to={isAuthenticated ? getDashboardLink() : '/login'}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white font-bold rounded-xl transition-all duration-200 text-base shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              <span>{isAuthenticated ? 'Go to Dashboard' : 'Access System Portal'}</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            <a
              href="#about"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-[var(--slate-300)] bg-[var(--surface-card)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] font-semibold transition-all duration-200 text-base shadow-xs"
            >
              <Info className="w-4 h-4 text-[var(--brand)]" />
              <span>Learn About ARALert</span>
            </a>
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-xl mx-auto text-left border-t border-[var(--slate-200)] mt-8">
            <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--slate-200)] shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
                <Target className="w-4 h-4 text-[var(--brand)]" />
                <span>Risk Detection</span>
              </div>
              <p className="mt-1 text-base font-extrabold text-[var(--text-primary)]">Automated</p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--slate-200)] shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
                <QrCode className="w-4 h-4 text-[var(--brand)]" />
                <span>Attendance Log</span>
              </div>
              <p className="mt-1 text-base font-extrabold text-[var(--text-primary)]">QR Check-In</p>
            </div>
            <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--slate-200)] shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
                <Award className="w-4 h-4 text-[var(--brand)]" />
                <span>Evaluation</span>
              </div>
              <p className="mt-1 text-base font-extrabold text-[var(--text-primary)]">DepEd Weighted</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          2. ABOUT SECTION (Full Viewport on Navigation)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="about"
        className="min-h-[calc(100vh-64px)] flex flex-col justify-center px-6 py-16 md:py-24 border-b border-[var(--slate-200)] relative"
      >
        <div className="max-w-5xl mx-auto w-full space-y-12">
          {/* Section Header */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--brand-light)] text-[var(--brand)] text-xs font-bold uppercase tracking-wider">
              <Info className="w-3.5 h-3.5" />
              <span>About the Program</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Bridging Learning Gaps Through Purpose-Built Technology
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
              Designed specifically for Palanas National Agriculture High School to support academic recovery under the national ARAL initiative.
            </p>
          </div>

          {/* Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="p-7 rounded-2xl bg-[var(--surface-card)] border border-[var(--slate-200)] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[var(--brand-light)] border border-[var(--brand-border)] flex items-center justify-center text-[var(--brand)]">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Core Learning Recovery</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Focuses on essential competencies in English, Science, and Mathematics, giving learners personalized guidance through tutor-led sessions.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-[var(--slate-200)] flex items-center gap-2 text-xs font-semibold text-[var(--brand)]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Standardized Curriculum Focus</span>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="p-7 rounded-2xl bg-[var(--surface-card)] border border-[var(--slate-200)] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Proactive Intervention</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Replaces end-of-term surprises with continuous monitoring. Risk factors are flagged immediately so educators can adapt lesson plans.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-[var(--slate-200)] flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
                <span>Immediate Risk Mitigation</span>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="p-7 rounded-2xl bg-[var(--surface-card)] border border-[var(--slate-200)] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Connected Stakeholders</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Seamlessly connects school administrators, subject faculties, assigned tutors, and students onto a unified, transparent digital record.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-[var(--slate-200)] flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>Role-Based Collaboration</span>
              </div>
            </div>
          </div>

          {/* Institutional Note */}
          <div className="p-6 rounded-2xl bg-[var(--surface-muted)] border border-[var(--slate-200)] text-center max-w-3xl mx-auto">
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-[var(--text-primary)]">ARALert</strong> adheres to the guidelines set by Republic Act No. 12028 (Academic Recovery and Accessible Learning Program Act) to accelerate learning progress and safeguard educational equity.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          3. FEATURES SECTION (Balanced, Clean Bento Grid)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="features"
        className="px-6 py-16 md:py-24 border-b border-[var(--slate-200)]"
      >
        <div className="max-w-5xl mx-auto space-y-12">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--brand-light)] text-[var(--brand)] text-xs font-bold uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Core Capabilities</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight">
              Designed for Speed, Accuracy & Simplicity
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)]">
              Three essential modules that streamline daily classroom operations and eliminate manual paperwork.
            </p>
          </div>

          {/* 3 Core Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Performance Tracking */}
            <div
              onClick={() => setActiveFeatureTab(0)}
              className={`bg-[var(--surface-card)] border rounded-2xl p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                activeFeatureTab === 0
                  ? 'border-[var(--brand)] ring-2 ring-[var(--brand-glow)]'
                  : 'border-[var(--slate-200)]'
              }`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--brand-light)] border border-[var(--brand-border)] flex items-center justify-center text-[var(--brand)]">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Performance Tracking
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Consolidates formative assessments, weekly quizzes, and tasks into clear progress summaries with automatic weighted calculations.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--slate-200)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)] font-medium">Calculation Engine</span>
                <span className="inline-flex items-center gap-1 font-bold text-[var(--brand)]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Weighted
                </span>
              </div>
            </div>

            {/* Card 2: Risk Alerts */}
            <div
              onClick={() => setActiveFeatureTab(1)}
              className={`bg-[var(--surface-card)] border rounded-2xl p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                activeFeatureTab === 1
                  ? 'border-amber-500 ring-2 ring-amber-500/20'
                  : 'border-[var(--slate-200)]'
              }`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Early Risk Alerts
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Automatically flags students who drop below 75% or miss consecutive sessions, alerting educators before gaps compound.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--slate-200)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)] font-medium">Alert Level</span>
                <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" /> Real-Time Flags
                </span>
              </div>
            </div>

            {/* Card 3: QR Attendance */}
            <div
              onClick={() => setActiveFeatureTab(2)}
              className={`bg-[var(--surface-card)] border rounded-2xl p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                activeFeatureTab === 2
                  ? 'border-[var(--brand)] ring-2 ring-[var(--brand-glow)]'
                  : 'border-[var(--slate-200)]'
              }`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--brand-light)] border border-[var(--brand-border)] flex items-center justify-center text-[var(--brand)]">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  QR Attendance
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Fast, tamper-proof session check-in and check-out using dynamic QR codes, saving valuable instructional time.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--slate-200)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)] font-medium">Session Check-In</span>
                <span className="inline-flex items-center gap-1 font-bold text-[var(--brand)]">
                  <Sparkles className="w-3.5 h-3.5" /> Instant Scan
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          4. FAQ SECTION (Spacious & Clean Accordion)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="faq"
        className="px-6 py-16 md:py-24 max-w-3xl mx-auto"
      >
        <div className="text-center space-y-3 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--brand-light)] text-[var(--brand)] text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Frequently Asked Questions</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight">
            Have Questions? We Have Answers.
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Common questions about accessing and using the ARALert platform.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_DATA.map((faq) => {
            const isOpen = openFAQ === faq.id;
            return (
              <div
                key={faq.id}
                className="bg-[var(--surface-card)] border border-[var(--slate-200)] rounded-xl overflow-hidden transition-all duration-200 shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                >
                  <span className="pr-4">{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--brand)] shrink-0 transition-transform duration-250 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[300px] border-t border-[var(--slate-200)]' : 'max-h-0'
                  } overflow-hidden`}
                >
                  <p className="p-4 sm:p-5 text-sm text-[var(--text-secondary)] leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};