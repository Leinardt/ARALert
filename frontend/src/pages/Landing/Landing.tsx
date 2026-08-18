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
  Users
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
    answer: "The Academic Recovery and Accessible Learning (ARAL) program is an educational recovery initiative. ARALert serves as the primary companion tool to monitor student achievements, track attendance, and manage student learning recovery sessions."
  },
  {
    id: 2,
    question: "How does student performance monitoring work?",
    answer: "The system dynamically aggregates grade records logged by tutors across multiple subjects. By applying customized component weights, it computes the student's current grade point average (GPA) in real time to trace their academic progress."
  },
  {
    id: 3,
    question: "What triggers a student risk alert?",
    answer: "Risk levels (Low, Medium, High) are automatically evaluated by checking grade thresholds and consecutive absent logs. Tutors and school principals receive risk alerts instantly when grades fall or attendance drops below target goals."
  },
  {
    id: 4,
    question: "How is attendance tracked using QR codes?",
    answer: "Tutors generate unique session QR codes for check-in and check-out. Students or staff verify their arrival and departure by scanning the code, which creates a tamper-proof timestamped attendance log."
  },
  {
    id: 5,
    question: "Can tutors modify the grading weights?",
    answer: "Yes, grading weights for assessments, weekly tasks, and attendance are fully customizable per tutor or program guideline, allowing flexible performance evaluations."
  },
  {
    id: 6,
    question: "Is student academic data secure in ARALert?",
    answer: "Absolutely. Student records, credentials, and logs are protected using role-based access controls and industry-standard security practices to maintain complete student confidentiality."
  }
];

export const Landing: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

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
      <section className="relative py-20 md:py-32 flex items-center justify-center border-b border-slate-200 dark:border-slate-900">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          {/* <div className="inline-block px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Palanas National Agriculture High School</span>
          </div> */}
          
          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-950 dark:text-slate-50 tracking-tight leading-[1.25]">
            Detect risk.<br />
            Support growth.
          </h1>
          
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
            Intelligent monitoring for the ARAL program. Early detection, real-time tracking, and proactive interventions for student success.
          </p>

          <div className="pt-4">
            <Link
              to={isAuthenticated ? getDashboardLink() : '/login'}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-bold text-base shadow-lg shadow-blue-500/20"
            >
              <span>{isAuthenticated ? 'Go to Dashboard' : 'Access Portal'}</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── ABOUT SECTION ── */}
      <section id="about" className="py-20 max-w-5xl mx-auto px-6 border-b border-slate-200 dark:border-slate-900">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-450 mb-3">
              <Info className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">About the Project</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-slate-50 tracking-tight">About ARALert</h2>
          </div>
          <div className="md:col-span-8 space-y-4 text-slate-650 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <p>
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION ── */}
      <section id="features" className="py-20 max-w-5xl mx-auto px-6 border-b border-slate-200 dark:border-slate-900">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-450">
            <BookOpen className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Our Features</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-slate-50 tracking-tight">Key Features</h2>
          <p className="text-sm text-slate-500 dark:text-slate-450 leading-relaxed">
            Discover how ARALert supports every student's learning recovery path with key monitoring details.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Performance Tracking */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">Performance Tracking</h3>
              <p className="text-xs sm:text-sm text-slate-550 dark:text-slate-400 leading-relaxed">
                Consolidates academic assessments, weekly tasks, and class activities into a visual representation of progress.
              </p>
            </div>
            <div className="text-slate-400 dark:text-slate-500 text-xs italic pt-4 border-t border-slate-100 dark:border-slate-800/60">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.
            </div>
          </div>

          {/* Risk Alerts */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-650 dark:text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">Risk Alerts</h3>
              <p className="text-xs sm:text-sm text-slate-550 dark:text-slate-400 leading-relaxed">
                Identifies student risks automatically through threshold rules on performance trends and attendance logs.
              </p>
            </div>
            <div className="text-slate-400 dark:text-slate-500 text-xs italic pt-4 border-t border-slate-100 dark:border-slate-800/60">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.
            </div>
          </div>

          {/* QR Attendance */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-650 dark:text-emerald-450">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">QR Attendance</h3>
              <p className="text-xs sm:text-sm text-slate-550 dark:text-slate-400 leading-relaxed">
                Manages student check-ins and check-outs securely using timed QR codes for accurate duration tracking.
              </p>
            </div>
            <div className="text-slate-400 dark:text-slate-500 text-xs italic pt-4 border-t border-slate-100 dark:border-slate-800/60">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ SECTION ── */}
      <section id="faq" className="py-20 max-w-3xl mx-auto px-6">
        <div className="text-center space-y-3 mb-12">
          <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-450">
            <Users className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Help & FAQ</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-slate-50 tracking-tight">Frequently Asked Questions</h2>
          <p className="text-sm text-slate-500 dark:text-slate-450 leading-relaxed">
            Find simple answers to standard details about the ARALert success companion application.
          </p>
        </div>

        <div className="space-y-4">
          {FAQ_DATA.map((faq) => {
            const isOpen = openFAQ === faq.id;
            return (
              <div
                key={faq.id}
                className="bg-white dark:bg-slate-900 border border-slate-250/60 dark:border-slate-800 rounded-xl overflow-hidden transition-all duration-300"
              >
                <button
                  type="button"
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full flex items-center justify-between p-5 text-left text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-100/40 dark:hover:bg-slate-850/40 transition-colors"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-blue-650 dark:text-blue-400 shrink-0 transition-transform duration-250 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[300px] border-t border-slate-100 dark:border-slate-800/80' : 'max-h-0'
                  } overflow-hidden`}
                >
                  <p className="p-5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
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