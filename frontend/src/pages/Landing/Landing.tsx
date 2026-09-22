import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LogoImg from '../../assets/ARALert_Logo_LIGHT.png';
import EducationRafiki from '../../assets/Education-rafiki (1).svg';
import EducationAmico from '../../assets/Education-amico.svg';
import EducationBro from '../../assets/Education-bro (2).svg';
import EducationCuate from '../../assets/Education-cuate.svg';
import EducationPana from '../../assets/Education-pana.svg';
import {
  TrendingUp,
  AlertTriangle,
  QrCode,
  ArrowRight,
  ChevronDown,
  Info,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  Users,
  Target,
  RotateCw,
} from 'lucide-react';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const HERO_ILLUSTRATIONS = [
  { id: 'rafiki', src: EducationRafiki, alt: 'ARALert Education Learning' },
  { id: 'amico', src: EducationAmico, alt: 'ARALert Academic Monitoring' },
  { id: 'bro', src: EducationBro, alt: 'ARALert Student Evaluation' },
  { id: 'cuate', src: EducationCuate, alt: 'ARALert Early Intervention' },
  { id: 'pana', src: EducationPana, alt: 'ARALert Recovery Support' },
];

const FAQ_DATA: FAQItem[] = [
  {
    id: 1,
    question: 'What is the ARAL Program?',
    answer:
      'The Academic Recovery and Accessible Learning (ARAL) program is a national Department of Education initiative established under Republic Act No. 12028 to accelerate learning recovery. ARALert serves as the dedicated digital monitoring and early intervention platform for Palanas National Agriculture High School to track student attendance, analyze performance trends, and coordinate targeted recovery sessions.',
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
      'Tutors generate session-specific QR codes. Students scan the code using the integrated QR scanner to register instant, timestamped check-ins and check-outs, eliminating manual sign-in sheets and errors.',
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

  // Random initial image on page refresh
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(() =>
    Math.floor(Math.random() * HERO_ILLUSTRATIONS.length)
  );
  const [isFading, setIsFading] = useState(false);

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.is_superuser) return '/superadmin';
    return `/${user.role}`;
  };

  const toggleFAQ = (id: number) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  const nextImage = () => {
    setIsFading(true);
    setTimeout(() => {
      setCurrentImageIndex((prev) => (prev + 1) % HERO_ILLUSTRATIONS.length);
      setIsFading(false);
    }, 200);
  };

  // Auto-switch SVG every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      nextImage();
    }, 10000);
    return () => clearInterval(timer);
  }, [currentImageIndex]);

  return (
    <div className="relative min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white transition-colors duration-200">
      {/* ═══════════════════════════════════════════════════════════════
          1. HOME SECTION (Plain White in Light, Plain Black in Dark)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="home"
        className="relative min-h-screen flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 pt-20 sm:pt-24 pb-8 sm:pb-12 bg-white dark:bg-black text-slate-900 dark:text-white overflow-hidden border-b border-slate-200/80 dark:border-neutral-800"
      >
        <div className="max-w-7xl mx-auto w-full flex-1 flex items-center justify-center my-auto">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center py-2 sm:py-4">
            {/* Left Column: Interactive Educational SVG Illustrations */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center order-2 lg:order-1">
              <button
                type="button"
                onClick={nextImage}
                title="Click to switch illustration"
                className="group relative w-full max-w-xs sm:max-w-md lg:max-w-xl flex items-center justify-center cursor-pointer select-none focus:outline-none transition-all duration-300"
              >
                {/* Subtle ambient backlight glow for enhanced contrast in dark mode */}
                <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-600/20 blur-3xl rounded-full pointer-events-none transition-all duration-500 group-hover:scale-105" />

                <img
                  src={HERO_ILLUSTRATIONS[currentImageIndex].src}
                  alt={HERO_ILLUSTRATIONS[currentImageIndex].alt}
                  className={`relative z-10 w-full h-auto max-h-[260px] sm:max-h-[380px] lg:max-h-[520px] object-contain drop-shadow-sm dark:drop-shadow-[0_12px_40px_rgba(59,130,246,0.25)] transition-all duration-300 transform group-hover:scale-[1.03] group-active:scale-95 ${
                    isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                  }`}
                />
              </button>
            </div>

            {/* Right Column: Hero Content (Centered & Aesthetic) */}
            <div className="lg:col-span-6 flex flex-col justify-center items-center text-center space-y-5 sm:space-y-6 md:space-y-7 order-1 lg:order-2">
              {/* Main Hero Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight flex items-center justify-center gap-1 sm:gap-1.5 leading-none select-none max-w-xl mx-auto">
                <img
                  src={LogoImg}
                  alt="A"
                  className="h-[1.1em] w-auto object-contain inline-block drop-shadow-sm transition-transform duration-200 hover:scale-105 -mt-0.5"
                />
                <span className="text-[#0052B7] dark:text-blue-400 font-extrabold tracking-tight">
                  RALert
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-lg mx-auto px-2 sm:px-0">
                A Web-Based Student Performance Monitoring and Early Academic Risk Detection System for the ARAL Program of{' '}
                <span className="text-[#0052B7] dark:text-blue-400 font-semibold">
                  Palanas National Agriculture High School
                </span>
                .
              </p>

              {/* Primary Action Group */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1 w-full max-w-xs sm:max-w-none">
                <Link
                  to={isAuthenticated ? getDashboardLink() : '/login'}
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white font-bold rounded-xl transition-all duration-200 text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>{isAuthenticated ? 'Go to Dashboard' : 'Access System Portal'}</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </Link>

                <a
                  href="#about"
                  className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/80 hover:bg-slate-100 dark:bg-neutral-900/80 dark:hover:bg-neutral-900 text-slate-800 dark:text-slate-200 font-semibold backdrop-blur-md text-sm shadow-xs hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                >
                  <Info className="w-4 h-4 text-[#0052B7] dark:text-blue-400" />
                  <span>Learn About ARALert</span>
                </a>
              </div>

              {/* Quick Metrics Ribbon */}
              <div className="pt-5 sm:pt-6 border-t border-slate-200 dark:border-neutral-800 grid grid-cols-3 gap-2 sm:gap-4 w-full max-w-lg mx-auto">
                <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 dark:bg-neutral-900/70 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col items-center justify-center text-center">
                  <div className="flex items-center justify-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <Target className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0052B7] dark:text-blue-400 shrink-0" />
                    <span className="truncate">Risk Alerts</span>
                  </div>
                  <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm lg:text-base font-extrabold text-slate-900 dark:text-white">Automated</p>
                </div>

                <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 dark:bg-neutral-900/70 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col items-center justify-center text-center">
                  <div className="flex items-center justify-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <QrCode className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0052B7] dark:text-blue-400 shrink-0" />
                    <span className="truncate">Attendance</span>
                  </div>
                  <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm lg:text-base font-extrabold text-slate-900 dark:text-white">QR Check-In</p>
                </div>

                <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 dark:bg-neutral-900/70 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex flex-col items-center justify-center text-center">
                  <div className="flex items-center justify-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                    <span className="truncate">Evaluation</span>
                  </div>
                  <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm lg:text-base font-extrabold text-slate-900 dark:text-white">DepEd Metrics</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          2. ABOUT SECTION (Plain White in Light, Plain Black in Dark)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="about"
        className="min-h-[calc(100vh-64px)] flex flex-col justify-center px-6 py-20 md:py-28 bg-white dark:bg-black border-b border-slate-200/80 dark:border-neutral-800 relative"
      >
        <div className="max-w-5xl mx-auto w-full space-y-12">
          {/* Section Header */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Bridging Learning Gaps Through Purpose-Built Technology
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Designed specifically for Palanas National Agriculture High School to support academic recovery under the national ARAL initiative.
            </p>
          </div>

          {/* Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="p-7 rounded-2xl bg-slate-50/60 dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-neutral-700 transition-all duration-200 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-[#0052B7] dark:text-blue-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Core Learning Recovery</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Focuses on essential competencies in English, Science, and Mathematics, giving learners personalized guidance through tutor-led sessions.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-200/60 dark:border-neutral-800 flex items-center gap-2 text-xs font-semibold text-[#0052B7] dark:text-blue-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Standardized Curriculum Focus</span>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="p-7 rounded-2xl bg-slate-50/60 dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-neutral-700 transition-all duration-200 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Proactive Intervention</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Replaces end-of-term surprises with continuous monitoring. Risk factors are flagged immediately so educators can adapt lesson plans.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-200/60 dark:border-neutral-800 flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
                <span>Immediate Risk Mitigation</span>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="p-7 rounded-2xl bg-slate-50/60 dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-neutral-700 transition-all duration-200 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Connected Stakeholders</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Seamlessly connects school administrators, subject faculties, assigned tutors, and students onto a unified, transparent digital record.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-200/60 dark:border-neutral-800 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>Role-Based Collaboration</span>
              </div>
            </div>
          </div>

          {/* Institutional Note */}
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-neutral-900/70 border border-slate-200 dark:border-neutral-800 text-center max-w-3xl mx-auto">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong className="text-slate-900 dark:text-white font-semibold">ARALert</strong> adheres to the guidelines set by Republic Act No. 12028 (Academic Recovery and Accessible Learning Program Act) to accelerate learning progress and safeguard educational equity.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          3. FEATURES SECTION (Plain White in Light, Plain Black in Dark)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="features"
        className="px-6 py-20 md:py-28 bg-white dark:bg-black border-b border-slate-200/80 dark:border-neutral-800"
      >
        <div className="max-w-5xl mx-auto space-y-12">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Designed for Speed, Accuracy &amp; Simplicity
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Three essential modules that streamline daily classroom operations and eliminate manual paperwork.
            </p>
          </div>

          {/* 3 Core Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Performance Tracking */}
            <div
              onClick={() => setActiveFeatureTab(0)}
              className={`bg-slate-50/60 dark:bg-neutral-950 border rounded-2xl p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                activeFeatureTab === 0
                  ? 'border-[#0052B7] ring-2 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-500'
                  : 'border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-[#0052B7] dark:text-blue-400">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Performance Tracking
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Consolidates formative assessments, weekly quizzes, and tasks into clear progress summaries with automatic weighted calculations.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-neutral-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Calculation Engine</span>
                <span className="inline-flex items-center gap-1 font-bold text-[#0052B7] dark:text-blue-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Weighted
                </span>
              </div>
            </div>

            {/* Card 2: Risk Alerts */}
            <div
              onClick={() => setActiveFeatureTab(1)}
              className={`bg-slate-50/60 dark:bg-neutral-950 border rounded-2xl p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                activeFeatureTab === 1
                  ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30 dark:bg-amber-950/20'
                  : 'border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Early Risk Alerts
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Automatically flags students who drop below 75% or miss consecutive sessions, alerting educators before gaps compound.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-neutral-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Alert Level</span>
                <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" /> Real-Time Flags
                </span>
              </div>
            </div>

            {/* Card 3: QR Attendance */}
            <div
              onClick={() => setActiveFeatureTab(2)}
              className={`bg-slate-50/60 dark:bg-neutral-950 border rounded-2xl p-7 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                activeFeatureTab === 2
                  ? 'border-[#0052B7] ring-2 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-500'
                  : 'border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-[#0052B7] dark:text-blue-400">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  QR Attendance
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Fast, tamper-proof session check-in and check-out using dynamic QR codes, saving valuable instructional time.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-neutral-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Session Check-In</span>
                <span className="inline-flex items-center gap-1 font-bold text-[#0052B7] dark:text-blue-400">
                  <Sparkles className="w-3.5 h-3.5" /> Instant Scan
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          4. FAQ SECTION (Plain White in Light, Plain Black in Dark)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="faq"
        className="px-6 py-20 md:py-28 max-w-3xl mx-auto"
      >
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Have Questions? We Have Answers.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Common questions about accessing and using the ARALert platform.
          </p>
        </div>

        <div className="space-y-4">
          {FAQ_DATA.map((faq) => {
            const isOpen = openFAQ === faq.id;
            return (
              <div
                key={faq.id}
                className="bg-slate-50/60 dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 rounded-2xl overflow-hidden transition-all duration-200 shadow-xs hover:border-blue-200 dark:hover:border-neutral-700"
              >
                <button
                  type="button"
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm sm:text-base font-bold text-slate-900 dark:text-white hover:bg-slate-100/70 dark:hover:bg-neutral-900/60 transition-colors cursor-pointer"
                >
                  <span className="pr-4">{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#0052B7] dark:text-blue-400 shrink-0 transition-transform duration-250 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[300px] border-t border-slate-200/60 dark:border-neutral-800/80' : 'max-h-0'
                  } overflow-hidden`}
                >
                  <p className="p-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-white/70 dark:bg-neutral-900/40">
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

export default Landing;

