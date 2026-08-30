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
} from 'lucide-react';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 1,
    question: "What is the ARAL Program?",
    answer: "The Academic Recovery and Accessible Learning (ARAL) program is a national initiative to support learning recovery. ARALert serves as the dedicated digital companion for Palanas National Agriculture High School to track student attendance, monitor academic performance, and organize timely recovery sessions."
  },
  {
    id: 2,
    question: "How does student performance monitoring work?",
    answer: "Tutors and teachers log assessment and activity scores into clean digital sheets. The system automatically applies official DepEd component weights to compute real-time grades and show progress over time without manual spreadsheet formulas."
  },
  {
    id: 3,
    question: "What triggers an academic risk alert?",
    answer: "Risk levels (Low, Moderate, High) are evaluated automatically based on academic scores and attendance trends. When a learner falls below target passing thresholds or misses consecutive sessions, teachers and administrators are notified early to provide intervention."
  },
  {
    id: 4,
    question: "How is attendance recorded using QR codes?",
    answer: "Tutors generate or display a unique session QR code. Scanning verifies check-in and check-out times instantly, creating an accurate, tamper-proof attendance record without manual paper sign-in sheets."
  },
  {
    id: 5,
    question: "Is ARALert easy to use for teachers?",
    answer: "Yes, ARALert is designed with a clean, simple layout, clear buttons, and large readable text. It simplifies daily record-keeping and generates one-click printable reports and DTR files."
  },
  {
    id: 6,
    question: "Is student academic data kept confidential?",
    answer: "Yes. All student records, evaluations, and attendance logs are secured with role-based permissions, ensuring that only authorized teachers, tutors, and administrators can view sensitive information."
  }
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
    <div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 min-h-screen">
      
      {/* ── HERO SECTION ── */}
      <section className="relative py-16 md:py-24 border-b border-slate-200/80 dark:border-slate-850 overflow-hidden">
        {/* Subtle background ambient light */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(34,139,34,0.1),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(34,139,34,0.15),rgba(0,0,0,0))] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 text-center space-y-6 relative z-10">
          
          {/* School & Program Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-semibold shadow-xs">
            <School className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Palanas National Agriculture High School • ARAL Program</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-slate-950 dark:text-slate-50 tracking-tight leading-[1.2]">
            Detect academic risk early. <br />
            <span className="text-[var(--brand)]">Support student growth.</span>
          </h1>
          
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
            A clean, modern monitoring system for the ARAL learning recovery program. Simple QR attendance, real-time risk alerts, and clear progress tracking for every learner.
          </p>

            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                to={isAuthenticated ? getDashboardLink() : '/login'}
                className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-slate-950 font-extrabold rounded-xl transition-all text-base shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                <span>{isAuthenticated ? 'Go to Dashboard' : 'Access System Portal'}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
        </div>
      </section>

      {/* ── ABOUT SECTION ── */}
      <section id="about" className="py-16 md:py-20 max-w-5xl mx-auto px-6 border-b border-slate-200/80 dark:border-slate-850">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-4 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[var(--brand)] text-xs font-bold uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>About the Project</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-slate-50 tracking-tight">
              About ARALert
            </h2>
          </div>
          <div className="md:col-span-8 space-y-4 text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
            <p>
              <strong>ARALert</strong> is designed specifically for <strong>Palanas National Agriculture High School</strong> to support the implementation of the Academic Recovery and Accessible Learning (ARAL) program. It helps teachers, tutors, and school leaders track student participation and academic milestones with minimal effort.
            </p>
            <p>
              By combining real-time QR attendance check-ins with weighted assessment tracking, ARALert automatically identifies students who need additional assistance in core subjects—ensuring timely interventions before minor learning gaps widen.
            </p>
          </div>
        </div>
      </section>

      {/* ── BENTO-STYLE FEATURES SECTION ── */}
      <section id="features" className="py-16 md:py-20 max-w-5xl mx-auto px-6 border-b border-slate-200/80 dark:border-slate-850">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-[var(--brand)] text-xs font-bold uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>Key Capabilities</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-slate-50 tracking-tight">
            Designed for Simplicity & Impact
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Three core features that simplify daily school operations and support student recovery.
          </p>
        </div>

        {/* 3 Bento Cards with Subtle Interactive Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Performance Tracking */}
          <div
            onClick={() => setActiveFeatureTab(0)}
            className={`bg-white dark:bg-slate-900 border rounded-2xl p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer ${
              activeFeatureTab === 0 
                ? 'border-emerald-500/80 ring-2 ring-emerald-500/20' 
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">Performance Tracking</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Consolidates formative assessments, weekly quizzes, and tasks into clear progress summaries with automatic weighted calculations.
              </p>
            </div>

            {/* Visual Micro-Preview */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Progress Metric</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> 88% On Track
              </span>
            </div>
          </div>

          {/* Card 2: Risk Alerts */}
          <div
            onClick={() => setActiveFeatureTab(1)}
            className={`bg-white dark:bg-slate-900 border rounded-2xl p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer ${
              activeFeatureTab === 1 
                ? 'border-amber-500/80 ring-2 ring-amber-500/20' 
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">Early Risk Alerts</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Automatically identifies at-risk learners when scores drop below 75% or when sessions are missed, allowing early intervention.
              </p>
            </div>

            {/* Visual Micro-Preview */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Early Warning</span>
              <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                <Clock className="w-3.5 h-3.5" /> Auto-Flagged
              </span>
            </div>
          </div>

          {/* Card 3: QR Attendance */}
          <div
            onClick={() => setActiveFeatureTab(2)}
            className={`bg-white dark:bg-slate-900 border rounded-2xl p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer ${
              activeFeatureTab === 2 
                ? 'border-teal-500/80 ring-2 ring-teal-500/20' 
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-100 dark:border-teal-900 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">QR Attendance</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Fast, reliable session check-in and check-out using timed QR codes, saving valuable classroom time and eliminating paper sign-in sheets.
              </p>
            </div>

            {/* Visual Micro-Preview */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Fast Check-In</span>
              <span className="inline-flex items-center gap-1 font-bold text-teal-600 dark:text-teal-400">
                <Sparkles className="w-3.5 h-3.5" /> Instant Log
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ── FAQ SECTION ── */}
      <section id="faq" className="py-16 md:py-20 max-w-3xl mx-auto px-6">
        <div className="text-center space-y-2 mb-10">
          <div className="inline-flex items-center gap-1.5 text-[var(--brand)] text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-4 h-4" />
            <span>Help & FAQ</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-slate-50 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Answers to common questions about using ARALert at Palanas NHS.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_DATA.map((faq) => {
            const isOpen = openFAQ === faq.id;
            return (
              <div
                key={faq.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all duration-200"
              >
                <button
                  type="button"
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors"
                >
                  <span className="pr-3">{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--brand)] shrink-0 transition-transform duration-250 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[300px] border-t border-slate-100 dark:border-slate-800' : 'max-h-0'
                  } overflow-hidden`}
                >
                  <p className="p-4 sm:p-5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
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