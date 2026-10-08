import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ArrowRight, Menu, X, School, Mail } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

import aralertLogo from '../assets/ARALert_Logo_LIGHT.png';

export const PublicLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLoginPage = location.pathname === '/login';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 25);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.is_superuser) return '/superadmin';
    return `/${user.role}`;
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    setMobileMenuOpen(false);
    if (location.pathname === '/') {
      e.preventDefault();
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const logoSrc = aralertLogo;

  const navLinks = [
    { label: 'Home', id: 'home', to: '/#home' },
    { label: 'About', id: 'about', to: '/#about' },
    { label: 'Features', id: 'features', to: '/#features' },
    { label: 'FAQ', id: 'faq', to: '/#faq' },
  ];

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col font-sans bg-white dark:bg-black text-slate-900 dark:text-white relative w-full overflow-x-clip"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Dynamic Navbar ── */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 pointer-events-none px-3 sm:px-6 ${
          isScrolled ? 'pt-3 sm:pt-4' : 'pt-2'
        }`}
      >
        <header
          className={`pointer-events-auto mx-auto transition-all duration-300 ${
            isScrolled
              ? 'w-full max-w-5xl bg-white/80 dark:bg-neutral-900/50 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-2xl px-4 sm:px-6 h-14 shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.12)] flex items-center justify-between text-slate-800 dark:text-white'
              : 'w-full max-w-7xl px-3 sm:px-6 h-16 sm:h-18 bg-transparent border-transparent shadow-none flex items-center justify-between text-slate-900 dark:text-white'
          }`}
        >
          {/* Left: Logo & Brand + "/" Divider + Navigation links */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/"
              className="landing-brand-link flex items-center gap-2 text-decoration-none group px-2 py-1.5 rounded-xl hover:bg-blue-50/80 dark:hover:bg-blue-950/40 hover:backdrop-blur-md transition-all duration-200"
              onClick={(e) => handleNavClick(e, 'home')}
            >
              <img
                src={logoSrc}
                alt="ARALert logo"
                className="w-8 h-8 sm:w-8.5 sm:h-8.5 object-contain transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </Link>


            {/* Navigation links (Desktop & Tablet landscape) */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((item) => (
                <a
                  key={item.id}
                  href={item.to}
                  onClick={(e) => handleNavClick(e, item.id)}
                  className="landing-nav-link text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-[#0052B7] dark:hover:text-blue-400 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 hover:backdrop-blur-md border border-transparent transition-all duration-200 cursor-pointer"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Right: Dark mode toggle + Sign In / Dashboard button + Mobile Menu Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="w-8 h-8 sm:w-9 sm:h-9" size={15} />

            {(!isLoginPage || isAuthenticated) && (
              <Link
                to={isAuthenticated ? getDashboardLink() : '/login'}
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="glass-btn group hidden sm:inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm !text-[#0052B7] dark:!text-blue-400 hover:!bg-[#0052B7] hover:!text-white hover:!border-[#0052B7] dark:hover:!bg-[#0052B7] dark:hover:!text-white hover:shadow-md hover:shadow-blue-600/20 transition-all duration-200"
              >
                <span className="text-[#0052B7] dark:text-blue-400 group-hover:!text-white font-bold transition-colors duration-200">
                  {isAuthenticated ? 'Dashboard' : 'Sign In'}
                </span>
                <ArrowRight size={14} className="text-[#0052B7] dark:text-blue-400 group-hover:!text-white group-hover:translate-x-0.5 transition-all duration-200" />
              </Link>
            )}

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="glass-btn md:hidden w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Dropdown Menu & Backdrop */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden pointer-events-auto"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="pointer-events-auto relative z-50 mt-2 max-w-5xl mx-auto md:hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="bg-white/95 dark:bg-neutral-950/95 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-2xl space-y-2">
                <nav className="flex flex-col space-y-1">
                  {navLinks.map((item) => (
                    <a
                      key={item.id}
                      href={item.to}
                      onClick={(e) => handleNavClick(e, item.id)}
                      className="landing-nav-link min-h-[44px] flex items-center px-4 py-3 rounded-xl text-base font-semibold text-slate-700 dark:text-slate-200 hover:text-[#0052B7] dark:hover:text-blue-400 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 transition-colors"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>

                {(!isLoginPage || isAuthenticated) && (
                  <div className="pt-2 border-t border-slate-200 dark:border-neutral-800 flex flex-col gap-2">
                    <Link
                      to={isAuthenticated ? getDashboardLink() : '/login'}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="glass-btn group w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm !text-[#0052B7] dark:!text-blue-400 hover:!bg-[#0052B7] hover:!text-white hover:!border-[#0052B7] dark:hover:!bg-[#0052B7] dark:hover:!text-white transition-all duration-200"
                    >
                      <span className="text-[#0052B7] dark:text-blue-400 group-hover:!text-white font-bold transition-colors duration-200">
                        {isAuthenticated ? 'Go to Dashboard' : 'Sign In to Portal'}
                      </span>
                      <ArrowRight size={16} className="text-[#0052B7] dark:text-blue-400 group-hover:!text-white group-hover:translate-x-0.5 transition-all duration-200" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col w-full">
        <Outlet />
      </main>

      {/* ── Compact Restored Sticky Footer ── */}
      <footer className="w-full mt-auto bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-slate-200/80 dark:border-neutral-800 text-slate-500 dark:text-slate-400 relative z-10 shrink-0">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7">
          {/* 4-Column Restored Content Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 text-xs">
            {/* Col 1: Brand & DepEd Program */}
            <div className="space-y-2">
              <Link
                to="/"
                onClick={(e) => handleNavClick(e, 'home')}
                className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-white hover:text-[var(--brand)] transition-colors no-underline"
              >
                <img
                  src={logoSrc}
                  alt="ARALert"
                  className="w-5 h-5 object-contain shrink-0"
                />
                <span className="font-extrabold text-sm tracking-tight">ARALert</span>
              </Link>
              <p className="leading-relaxed text-slate-500 dark:text-slate-400">
                Student Performance Monitoring & Early Academic Risk Detection platform for the Academic Recovery and Accessible Learning (ARAL) initiative.
              </p>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium pt-0.5">
                <School className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
                <span>Palanas National Agriculture High School</span>
              </div>
            </div>

            {/* Col 2: Quick Navigation */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
                Quick Navigation
              </h4>
              <ul className="space-y-1.5 font-medium">
                <li>
                  <a
                    href="/#home"
                    onClick={(e) => handleNavClick(e, 'home')}
                    className="hover:text-[var(--brand)] dark:hover:text-blue-400 transition-colors"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="/#about"
                    onClick={(e) => handleNavClick(e, 'about')}
                    className="hover:text-[var(--brand)] dark:hover:text-blue-400 transition-colors"
                  >
                    About ARALert
                  </a>
                </li>
                <li>
                  <a
                    href="/#features"
                    onClick={(e) => handleNavClick(e, 'features')}
                    className="hover:text-[var(--brand)] dark:hover:text-blue-400 transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="/#faq"
                    onClick={(e) => handleNavClick(e, 'faq')}
                    className="hover:text-[var(--brand)] dark:hover:text-blue-400 transition-colors"
                  >
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: School Information */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
                School Information
              </h4>
              <p className="leading-relaxed text-slate-500 dark:text-slate-400">
                <strong className="text-slate-700 dark:text-slate-300 font-medium">Palanas National Agriculture High School</strong><br />
                Division of Masbate • Region V (Bicol)<br />
                Dedicated implementation partner for the DepEd ARAL Program.
              </p>
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mt-2">
                <Mail className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
                <a href="mailto:contact@aralert.ph" className="hover:underline hover:text-[var(--brand)]">contact@aralert.ph</a>
              </div>
            </div>

            {/* Col 4: System Access */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
                System Access
              </h4>
              <p className="leading-relaxed text-slate-500 dark:text-slate-400">
                Authorized staff sign in via Google OAuth. Learners access their portal using their registered 12-digit LRN.
              </p>
              <div className="pt-1">
                <Link
                  to={isAuthenticated ? getDashboardLink() : '/login'}
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1 text-[var(--brand)] dark:text-blue-400 hover:underline font-bold"
                >
                  <span>{isAuthenticated ? 'Go to Dashboard' : 'Portal Login'}</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Copyright & Status Bar */}
          <div className="mt-5 pt-3.5 border-t border-slate-200/80 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <p>
              &copy; {new Date().getFullYear()} ARALert &bull; Palanas National Agriculture High School. All rights reserved.
            </p>
            <p className="text-center sm:text-right">
              Academic Recovery and Accessible Learning (ARAL) Program
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
