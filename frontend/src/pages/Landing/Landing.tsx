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
  ArrowRight,
  ChevronDown,
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
    question: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit?',
    answer:
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus nulla gravida orci a odio.',
  },
  {
    id: 2,
    question: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem?',
    answer:
      'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.',
  },
  {
    id: 3,
    question: 'At vero eos et accusamus et iusto odio dignissimos ducimus?',
    answer:
      'Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus temporibus autem.',
  },
  {
    id: 4,
    question: 'Temporibus autem quibusdam et aut officiis debitis aut rerum?',
    answer:
      'Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat. Quisque velit nisi, pretium ut lacinia in, elementum id enim.',
  },
  {
    id: 5,
    question: 'Quis autem vel eum iure reprehenderit qui in ea voluptate velit?',
    answer:
      'Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae.',
  },
  {
    id: 6,
    question: 'Et harum quidem rerum facilis est et expedita distinctio?',
    answer:
      'Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Pellentesque habitant morbi tristique senectus et netus.',
  },
];

export const Landing: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [openFAQ, setOpenFAQ] = useState<number | null>(1);

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
    setOpenFAQ((prev) => (prev === id ? null : id));
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

  // Scroll-triggered entrance animations observer (replays on every scroll revisit)
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
            <div className="lg:col-span-6 flex flex-col items-center justify-center order-2 lg:order-1 scroll-reveal">
              <button
                type="button"
                onClick={nextImage}
                title="Click to switch illustration"
                className="group relative w-full max-w-xs sm:max-w-md lg:max-w-xl flex items-center justify-center cursor-pointer select-none focus:outline-none transition-all duration-300"
              >
                {/* Subtle ambient backlight glow for enhanced contrast in dark mode */}
                <img
                  src={HERO_ILLUSTRATIONS[currentImageIndex].src}
                  alt={HERO_ILLUSTRATIONS[currentImageIndex].alt}
                  className={`relative z-10 w-full h-auto max-h-[260px] sm:max-h-[380px] lg:max-h-[520px] object-contain drop-shadow-sm transition-all duration-300 transform group-hover:scale-[1.02] group-active:scale-95 ${
                    isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                  }`}
                />
              </button>
            </div>

            {/* Right Column: Hero Content (Centered & Aesthetic) */}
            <div className="lg:col-span-6 flex flex-col justify-center items-center text-center space-y-5 sm:space-y-6 md:space-y-7 order-1 lg:order-2 scroll-reveal scroll-delay-100">
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

              {/* Primary Action Group - Refined Glassmorphism (Border-Only Hover Effect) */}
              <div className="flex items-center justify-center pt-1 w-full max-w-xs sm:max-w-none">
                <Link
                  to={isAuthenticated ? getDashboardLink() : '/login'}
                  className="glass-btn group inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3 sm:py-3.5 font-semibold rounded-2xl cursor-pointer select-none text-sm sm:text-base"
                >
                  <span>{isAuthenticated ? 'Go to Dashboard' : 'Access System Portal'}</span>
                  <ArrowRight className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-[#0052B7] dark:group-hover:text-blue-300 transition-colors duration-200 shrink-0" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          2. ABOUT SECTION (Refined Editorial Layout: Natural & Human-Designed)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="about"
        className="px-6 sm:px-8 lg:px-12 py-24 sm:py-32 bg-white dark:bg-black border-b border-slate-100 dark:border-neutral-900"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
            {/* Left Column (5 cols): Clean, Spacious Intro */}
            <div className="lg:col-span-5 flex flex-col space-y-5 lg:sticky lg:top-28 scroll-reveal">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#0052B7] dark:text-blue-400">
                About the Initiative
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 dark:text-white tracking-tight leading-snug">
                Bridging learning gaps through purposeful academic monitoring.
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Designed for Palanas National Agriculture High School, ARALert provides educators and tutors with clear insight into student performance and attendance.
              </p>
              <div className="pt-6 border-t border-slate-100 dark:border-neutral-900">
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                  Aligned with Republic Act No. 12028 (Academic Recovery and Accessible Learning Program Act) to support educational recovery and equity.
                </p>
              </div>
            </div>

            {/* Right Column (7 cols): Three Clean Content Items */}
            <div className="lg:col-span-7 flex flex-col divide-y divide-slate-100 dark:divide-neutral-900 scroll-reveal scroll-delay-100">
              {/* Item 1 */}
              <div className="space-y-2.5 pb-8 first:pt-0">
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                  Core learning recovery
                </h3>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Focuses on essential competencies in English, Science, and Mathematics through structured, tutor-led sessions tailored to individual student needs.
                </p>
              </div>

              {/* Item 2 */}
              <div className="space-y-2.5 py-8">
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                  Early risk detection
                </h3>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Replaces end-of-term surprises with continuous monitoring. Performance dips and attendance patterns are identified early so teachers can adapt their support.
                </p>
              </div>

              {/* Item 3 */}
              <div className="space-y-2.5 pt-8">
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                  Connected school community
                </h3>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Brings school administrators, subject teachers, tutors, and students together onto a unified, transparent record for shared accountability.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          3. FEATURES SECTION (Refined Editorial Layout: Natural & Human-Designed)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="features"
        className="px-6 sm:px-8 lg:px-12 py-24 sm:py-32 bg-white dark:bg-black border-b border-slate-100 dark:border-neutral-900"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
            {/* Left Column (5 cols): Clean, Spacious Intro */}
            <div className="lg:col-span-5 flex flex-col space-y-5 lg:sticky lg:top-28 scroll-reveal">
              <span className="text-xs font-semibold tracking-wider uppercase text-[#0052B7] dark:text-blue-400">
                Platform Capabilities
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 dark:text-white tracking-tight leading-snug">
                Practical tools designed for everyday classroom workflow.
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Three essential modules that simplify daily administrative routines and keep instructional time focused on student mentorship.
              </p>
              <div className="pt-6 border-t border-slate-100 dark:border-neutral-900">
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                  Synchronized in real time across daily check-ins, assessment scoring, and official DepEd reporting formats.
                </p>
              </div>
            </div>

            {/* Right Column (7 cols): Three Clean Feature Items */}
            <div className="lg:col-span-7 flex flex-col divide-y divide-slate-100 dark:divide-neutral-900 scroll-reveal scroll-delay-100">
              {/* Feature 1 */}
              <div className="space-y-2.5 pb-8 first:pt-0">
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                  Automated performance tracking
                </h3>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Consolidates formative assessments, weekly quizzes, and tasks into clear summaries with automatic weighted calculations—saving teachers hours of spreadsheet work.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="space-y-2.5 py-8">
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                  Academic risk alerts
                </h3>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Flags learners who fall below target passing thresholds or incur unexcused absences, prompting timely intervention before learning gaps widen.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="space-y-2.5 pt-8">
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
                  Quick QR attendance
                </h3>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Fast session check-in and check-out via dynamic QR codes, keeping attendance records verified and tamper-proof without paper sign-in sheets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          4. FAQ SECTION (Interactive Brand-Accented Accordion Layout)
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="faq"
        className="px-6 sm:px-8 lg:px-12 py-24 sm:py-32 max-w-4xl mx-auto"
      >
        <div className="space-y-4 mb-14 scroll-reveal">
          <span className="text-xs font-bold tracking-widest uppercase text-[#0052B7] dark:text-blue-400">
            Frequently Asked Questions
          </span>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
            Lorem Ipsum Dolor Sit Amet
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
            Cras mattis consectetur purus sit amet fermentum donec sed odio dui vivamus sagittis.
          </p>
        </div>

        {/* Minimal Interactive Accordion with subtle hairline dividers & brand accent */}
        <div className="divide-y divide-slate-200/80 dark:divide-neutral-800 border-y border-slate-200/80 dark:border-neutral-800 scroll-reveal scroll-delay-100">
          {FAQ_DATA.map((faq, index) => {
            const isOpen = openFAQ === faq.id;
            const itemNumber = (index + 1).toString().padStart(2, '0');
            return (
              <div
                key={faq.id}
                className={`transition-colors duration-200 ${
                  isOpen
                    ? 'bg-slate-50/50 dark:bg-neutral-900/30'
                    : 'hover:bg-slate-50/20 dark:hover:bg-neutral-900/10'
                }`}
              >
                <button
                  type="button"
                  id={`faq-question-${faq.id}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${faq.id}`}
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full flex items-center justify-between py-5 sm:py-6 px-4 sm:px-6 text-left group cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center gap-3 sm:gap-4 pr-4">
                    {/* Left subtle brand accent indicator */}
                    <span
                      className={`w-1 h-5 rounded-full transition-colors duration-200 shrink-0 ${
                        isOpen ? 'bg-[#0052B7] dark:bg-blue-400' : 'bg-transparent'
                      }`}
                    />
                    <span
                      className={`text-xs font-mono transition-colors shrink-0 ${
                        isOpen
                          ? 'text-[#0052B7] dark:text-blue-400 font-bold'
                          : 'text-slate-400 dark:text-slate-500 font-medium'
                      }`}
                    >
                      {itemNumber}
                    </span>
                    <span
                      className={`text-base sm:text-lg tracking-tight transition-colors ${
                        isOpen
                          ? 'text-[#0052B7] dark:text-blue-400 font-bold'
                          : 'text-slate-900 dark:text-white group-hover:text-[#0052B7] dark:group-hover:text-blue-400 font-semibold'
                      }`}
                    >
                      {faq.question}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform duration-300 ease-out ${
                      isOpen
                        ? 'rotate-180 text-[#0052B7] dark:text-blue-400'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-[#0052B7] dark:group-hover:text-blue-400'
                    }`}
                  />
                </button>
                <div
                  id={`faq-answer-${faq.id}`}
                  role="region"
                  aria-labelledby={`faq-question-${faq.id}`}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="pb-6 pt-0 px-4 sm:px-6 pl-8 sm:pl-11">
                      <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
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

