import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ArrowRight, Menu, X, School, Mail } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { PageFallback } from '../components/PageFallback';

import aralertLogo from '../assets/ARALert_Logo_LIGHT.png';

const NAV_LINKS = [
  { label: 'Home', id: 'home', to: '/#home' },
  { label: 'About', id: 'about', to: '/#about' },
  { label: 'Features', id: 'features', to: '/#features' },
  { label: 'FAQ', id: 'faq', to: '/#faq' },
] as const;

const SECTION_IDS = ['home', 'about', 'features', 'faq'] as const;

export const PublicLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLoginPage = location.pathname === '/login';

  // Smooth, high-performance scroll monitoring with requestAnimationFrame throttling
  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;

      rafId = window.requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const nextScrolled = scrollY > 25;
        setIsScrolled((prev) => (prev !== nextScrolled ? nextScrolled : prev));

        if (location.pathname === '/') {
          const scrollPosition = scrollY + 160;
          for (let i = SECTION_IDS.length - 1; i >= 0; i--) {
            const el = document.getElementById(SECTION_IDS[i]);
            if (el && scrollPosition >= el.offsetTop) {
              const currentId = SECTION_IDS[i];
              setActiveSection((prev) => (prev !== currentId ? currentId : prev));
              break;
            }
          }
        }
        rafId = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [location.pathname]);

  // Clean up mobile menu on viewport resize or Escape key press
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileMenuOpen]);

  const getDashboardLink = useCallback(() => {
    if (!user) return '/login';
    if (user.is_superuser) return '/superadmin';
    return `/${user.role}`;
  }, [user]);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
      setMobileMenuOpen(false);
      if (location.pathname === '/') {
        e.preventDefault();
        setActiveSection(targetId);
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    },
    [location.pathname]
  );

  const logoSrc = aralertLogo;

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col font-sans bg-white dark:bg-black text-slate-900 dark:text-white relative w-full overflow-x-clip"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Dynamic Navbar ── */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 pointer-events-none ${
          isScrolled ? 'pt-3 sm:pt-4 px-3 sm:px-6' : 'pt-0 px-4 sm:px-8 lg:px-12'
        }`}
      >
        <header
          className={`pointer-events-auto mx-auto transition-all duration-300 flex justify-between transform-gpu ${
            isScrolled
              ? 'w-full max-w-5xl bg-white/65 dark:bg-neutral-900/45 backdrop-blur-2xl backdrop-saturate-[190%] border border-white/80 dark:border-white/15 rounded-2xl px-4 sm:px-6 h-14 items-center shadow-[0_16px_40px_-6px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.04),inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_1px_0_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),inset_0_1px_1px_0_rgba(255,255,255,0.22),inset_0_0_20px_0_rgba(255,255,255,0.02)] text-slate-800 dark:text-white'
              : 'w-full max-w-6xl px-0 h-[70px] items-end pb-0 bg-transparent border-transparent shadow-none text-slate-900 dark:text-white'
          }`}
        >
          {/* Left: Logo & Brand + Navigation links */}
          <div className={`flex gap-4 sm:gap-6 ${isScrolled ? 'items-center' : 'items-end pb-0'}`}>
            <Link
              to="/"
              className={`landing-brand-link flex transition-all duration-200 ${isScrolled ? 'items-center py-1.5' : 'items-end pb-0'}`}
              onClick={(e) => handleNavClick(e, 'home')}
              aria-label="ARALert Home"
            >
              <img
                src={logoSrc}
                alt="ARALert logo"
                width={34}
                height={34}
                loading="eager"
                decoding="async"
                className="w-8 h-8 sm:w-8.5 sm:h-8.5 object-contain transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </Link>

            {/* Navigation links (Desktop & Tablet landscape) */}
            <nav
              aria-label="Main Navigation"
              className={`hidden md:flex gap-6 ${isScrolled ? 'items-center pb-0' : 'items-end pb-[7px]'}`}
            >
              {NAV_LINKS.map((item) => {
                const isActive = location.pathname === '/' && activeSection === item.id;
                return (
                  <a
                    key={item.id}
                    href={item.to}
                    onClick={(e) => handleNavClick(e, item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`landing-nav-link pen-trigger text-sm font-semibold transition-colors duration-200 cursor-pointer ${
                      isActive
                        ? 'text-[#0052B7] dark:text-blue-400 is-active'
                        : 'text-slate-600 dark:text-slate-300 hover:text-[#0052B7] dark:hover:text-blue-400'
                    }`}
                  >
                    <span className="pen-underline">{item.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Right: Dark mode toggle + Sign In / Dashboard button + Mobile Menu Button */}
          <div className={`flex gap-2 sm:gap-3 ${isScrolled ? 'items-center' : 'items-end pb-0'}`}>
            <ThemeToggle className="w-8 h-8 sm:w-9 sm:h-9" size={15} />

            {(!isLoginPage || isAuthenticated) && (
              <Link
                to={isAuthenticated ? getDashboardLink() : '/login'}
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="group hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm border border-[#0052B7]/30 dark:border-blue-400/30 text-[#0052B7] dark:text-blue-400 hover:!bg-[#0052B7] hover:!text-white hover:!border-[#0052B7] dark:hover:!bg-[#0052B7] dark:hover:!text-white hover:shadow-md hover:shadow-blue-600/20 transition-all duration-200"
              >
                <span className="group-hover:!text-white transition-colors duration-200">
                  {isAuthenticated ? 'Dashboard' : 'Sign In'}
                </span>
                <ArrowRight size={14} className="shrink-0 group-hover:!text-white group-hover:translate-x-0.5 transition-all duration-200" />
              </Link>
            )}

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-dropdown"
              className="md:hidden w-9 h-9 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center cursor-pointer touch-manipulation shrink-0 text-slate-700 dark:text-slate-200"
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
            <div
              id="mobile-nav-dropdown"
              className="pointer-events-auto relative z-50 mt-2 max-w-5xl mx-auto md:hidden animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="bg-white/70 dark:bg-neutral-900/60 backdrop-blur-2xl backdrop-saturate-[190%] border border-white/80 dark:border-white/15 rounded-2xl p-4 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18),inset_0_1px_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8),inset_0_1px_1px_0_rgba(255,255,255,0.22)] space-y-2">
                <nav aria-label="Mobile Navigation" className="flex flex-col space-y-1">
                  {NAV_LINKS.map((item) => {
                    const isActive = location.pathname === '/' && activeSection === item.id;
                    return (
                      <a
                        key={item.id}
                        href={item.to}
                        onClick={(e) => handleNavClick(e, item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`landing-nav-link pen-trigger min-h-[44px] flex items-center px-4 py-3 rounded-xl text-base font-semibold transition-colors ${
                          isActive
                            ? 'text-[#0052B7] dark:text-blue-400 is-active'
                            : 'text-slate-700 dark:text-slate-200 hover:text-[#0052B7] dark:hover:text-blue-400'
                        }`}
                      >
                        <span className="pen-underline">{item.label}</span>
                      </a>
                    );
                  })}
                </nav>

                {(!isLoginPage || isAuthenticated) && (
                  <div className="pt-2 border-t border-slate-200 dark:border-neutral-800 flex flex-col gap-2">
                    <Link
                      to={isAuthenticated ? getDashboardLink() : '/login'}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="group w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-[#0052B7]/30 dark:border-blue-400/30 text-[#0052B7] dark:text-blue-400 hover:!bg-[#0052B7] hover:!text-white hover:!border-[#0052B7] dark:hover:!bg-[#0052B7] dark:hover:!text-white transition-all duration-200"
                    >
                      <span className="group-hover:!text-white transition-colors duration-200">
                        {isAuthenticated ? 'Go to Dashboard' : 'Sign In to Portal'}
                      </span>
                      <ArrowRight size={16} className="group-hover:!text-white group-hover:translate-x-0.5 transition-all duration-200" />
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
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
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
                Student Performance Monitoring & Early Academic Risk Detection platform for the Academic Recovery and Accessible Learning (ARAL) program of Palanas National Agriculture High School.
              </p>
            </div>

            {/* Col 2: Quick Navigation */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
                Quick Navigation
              </h4>
              <ul className="grid grid-cols-2 sm:grid-cols-1 gap-x-4 gap-y-1.5 font-medium">
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
                <li>
                  <Link
                    to="/terms"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="hover:text-[var(--brand)] dark:hover:text-blue-400 transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="hover:text-[var(--brand)] dark:hover:text-blue-400 transition-colors"
                  >
                    Privacy Policy
                  </Link>
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
                <a href="mailto:309904@deped.gov.ph" className="hover:underline hover:text-[var(--brand)]">309904@deped.gov.ph</a>
              </div>
            </div>

            {/* Col 4: System Access */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5">
                System Access
              </h4>
              <p className="leading-relaxed text-slate-500 dark:text-slate-400">
                Authorized personnel sign in via authenticated Google accounts. Students access their portal using their registered 12-digit LRN.
              </p>
              {(!isLoginPage || isAuthenticated) && (
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
              )}
            </div>
          </div>

          {/* Bottom Copyright & Status Bar */}
          <div className="mt-5 pt-3.5 border-t border-slate-200/80 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <p>
              &copy; {new Date().getFullYear()} ARALert &bull; Palanas National Agriculture High School. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
              <Link to="/terms" className="whitespace-nowrap hover:text-[var(--brand)] dark:hover:text-blue-400 transition-colors">Terms of Service</Link>
              <span>&bull;</span>
              <Link to="/privacy" className="whitespace-nowrap hover:text-[var(--brand)] dark:hover:text-blue-400 transition-colors">Privacy Policy</Link>
              <span>&bull;</span>
              <span className="whitespace-nowrap">RA 10173 &amp; RA 12028 Compliant</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
