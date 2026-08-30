import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon, ArrowRight } from 'lucide-react';

export const PublicLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.is_superuser) return '/superadmin';
    return `/${user.role}`;
  };

  const logoSrc = '/src/assets/ARALert_Logo_LIGHT.png';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-bg)',
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
        transition: 'background-color 0.3s ease, color 0.3s ease',
      }}
    >
      {/* ── Top Navigation Header ── */}
      <header style={{
        background: 'var(--surface-card)',
        borderBottom: '1px solid var(--slate-200)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          height: '64px',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
              <img
                src={logoSrc}
                alt="ARALert logo"
                style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <span style={{ fontWeight: 800, fontSize: '20px', color: 'var(--brand)', letterSpacing: '-0.3px', fontFamily: 'var(--font-heading)' }}>ARALert</span>
            </Link>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', justifySelf: 'center', gap: '8px' }}>
            {['Home', 'About', 'Features', 'FAQ'].map((item) => (
              <a
                key={item}
                href={item === 'Home' ? '/' : `/#${item.toLowerCase()}`}
                style={{
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  padding: '8px 14px',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--brand)';
                  e.currentTarget.style.background = 'var(--surface-muted)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >{item}</a>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                border: '1px solid var(--slate-200)',
                background: 'var(--surface-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-light)'; e.currentTarget.style.color = 'var(--brand-dark)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-muted)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link
              to={isAuthenticated ? getDashboardLink() : '/login'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                background: 'var(--brand)',
                color: '#0F172A',
                fontWeight: 700,
                fontSize: '0.875rem',
                textDecoration: 'none',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand)'; }}
            >
              {isAuthenticated ? 'Dashboard' : 'Sign In'} <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 text-slate-650 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* Footer Top */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {/* Column 1: About & Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <img
                  src={logoSrc}
                  alt="ARALert logo"
                  className="w-7 h-7 object-contain"
                />
                <span className="font-extrabold text-lg text-slate-900 dark:text-slate-100 tracking-tight">ARALert</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-450 font-medium">
                A monitoring and early academic risk detection platform for the Academic Recovery and Accessible Learning (ARAL) program.
              </p>
              {/* Project description placeholder */}
              <p className="text-[10px] text-slate-400 dark:text-slate-550 italic">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
            </div>

            {/* Column 2: Useful Links */}
            <div>
              <h4 className="text-xs font-bold text-slate-950 dark:text-slate-50 uppercase tracking-widest mb-4">Useful Links</h4>
              <ul className="space-y-2 text-xs font-medium">
                <li><a href="/" className="hover:text-[var(--brand)] transition-colors">Home</a></li>
                <li><a href="/#about" className="hover:text-[var(--brand)] transition-colors">About</a></li>
                <li><a href="/#features" className="hover:text-[var(--brand)] transition-colors">Features</a></li>
                <li><a href="/#faq" className="hover:text-[var(--brand)] transition-colors">FAQ</a></li>
              </ul>
            </div>

            {/* Column 3: Project Information */}
            <div>
              <h4 className="text-xs font-bold text-slate-950 dark:text-slate-50 uppercase tracking-widest mb-4">Project Details</h4>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-450 font-medium">
                Palanas National Agriculture High School.<br />
                Academic recovery monitoring, QR attendance logs, automatic risk assessment warning, and comprehensive analytics.
              </p>
            </div>

            {/* Column 4: Contact/Socials */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-950 dark:text-slate-50 uppercase tracking-widest">Get in Touch</h4>
              <div className="text-xs space-y-1.5 text-slate-500 dark:text-slate-400 font-medium">
                <p>Email: <a href="mailto:contact@aralert.ph" className="hover:underline text-[var(--brand)]">contact@aralert.ph</a></p>
                <p>Phone: +63 (2) 1234-5678</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 italic">
                  ARALert Support & Information Office Placeholder Area.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-slate-105 dark:border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            <p>&copy; {new Date().getFullYear()} ARALert Student Performance Monitoring. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#terms" className="hover:underline">Terms of Service</a>
              <a href="#privacy" className="hover:underline font-semibold">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
