import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon, ArrowRight, School } from 'lucide-react';

export const PublicLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.is_superuser) return '/superadmin';
    return `/${user.role}`;
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
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

  const logoSrc = '/src/assets/ARALert_Logo_LIGHT.png';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-bg)] text-[var(--text-primary)] font-sans">
      {/* ── Top Navigation Header ── */}
      <header className="sticky top-0 z-50 bg-[var(--glass-bg)] backdrop-blur-md border-b border-[var(--slate-200)] shadow-xs">
        <div className="max-w-6xl mx-auto px-6 h-16 grid grid-cols-3 items-center">
          {/* Logo / Brand */}
          <div className="flex items-center justify-start">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-decoration-none group"
              onClick={(e) => handleNavClick(e, 'home')}
            >
              <img
                src={logoSrc}
                alt="ARALert logo"
                className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="font-extrabold text-xl tracking-tight text-[var(--brand)] font-heading">
                ARALert
              </span>
            </Link>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center justify-center gap-1.5 justify-self-center">
            {[
              { label: 'Home', id: 'home', to: '/#home' },
              { label: 'About', id: 'about', to: '/#about' },
              { label: 'Features', id: 'features', to: '/#features' },
              { label: 'FAQ', id: 'faq', to: '/#faq' },
            ].map((item) => (
              <a
                key={item.id}
                href={item.to}
                onClick={(e) => handleNavClick(e, item.id)}
                className="text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--brand)] hover:bg-[var(--surface-muted)] transition-all duration-150"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center justify-end gap-3 col-start-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="w-9 h-9 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-card)] hover:bg-[var(--surface-muted)] flex items-center justify-center cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-150 shadow-xs"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <Link
              to={isAuthenticated ? getDashboardLink() : '/login'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white font-bold text-xs sm:text-sm transition-all duration-150 shadow-xs hover:shadow-md"
            >
              <span>{isAuthenticated ? 'Dashboard' : 'Sign In'}</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="bg-[var(--surface-card)] text-[var(--text-secondary)] border-t border-[var(--slate-200)]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {/* Col 1: Brand & DepEd Affiliation */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <img
                  src={logoSrc}
                  alt="ARALert logo"
                  className="w-7 h-7 object-contain"
                />
                <span className="font-extrabold text-lg text-[var(--text-primary)] tracking-tight">
                  ARALert
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Student Performance Monitoring & Early Academic Risk Detection system for the Academic Recovery and Accessible Learning (ARAL) initiative.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] pt-1">
                <School className="w-3.5 h-3.5 text-[var(--brand)]" />
                <span>Palanas National Agriculture High School</span>
              </div>
            </div>

            {/* Col 2: Navigation Links */}
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">
                Quick Navigation
              </h4>
              <ul className="space-y-2 text-xs font-medium">
                <li>
                  <a
                    href="/#home"
                    onClick={(e) => handleNavClick(e, 'home')}
                    className="hover:text-[var(--brand)] transition-colors"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="/#about"
                    onClick={(e) => handleNavClick(e, 'about')}
                    className="hover:text-[var(--brand)] transition-colors"
                  >
                    About ARALert
                  </a>
                </li>
                <li>
                  <a
                    href="/#features"
                    onClick={(e) => handleNavClick(e, 'features')}
                    className="hover:text-[var(--brand)] transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="/#faq"
                    onClick={(e) => handleNavClick(e, 'faq')}
                    className="hover:text-[var(--brand)] transition-colors"
                  >
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Institutional Details */}
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">
                School Information
              </h4>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Palanas National Agriculture High School<br />
                Division of Masbate • Region V (Bicol)<br />
                Dedicated implementation partner for the DepEd ARAL Program.
              </p>
            </div>

            {/* Col 4: Portals & Security */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">
                System Access
              </h4>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Authorized staff sign in via Google OAuth. Learners access their portal using their registered 12-digit LRN.
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand)] hover:underline"
                >
                  <span>Portal Login</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-[var(--slate-200)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
            <p>&copy; {new Date().getFullYear()} ARALert. Palanas National Agriculture High School.</p>
            <p className="text-[11px]">Academic Recovery and Accessible Learning Management System</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
