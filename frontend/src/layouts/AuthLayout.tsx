import React from 'react';
import { Outlet, Link } from 'react-router-dom';

/**
 * AuthLayout — wraps all auth pages (activate, reset, MFA, forgot-password).
 * Provides a premium gradient background with decorative orbs and a centred card.
 */
export const AuthLayout: React.FC = () => {
  return (
    <div className="auth-bg" style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Decorative background orbs */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-5%',
          width: '40vw',
          height: '40vw',
          maxWidth: '500px',
          maxHeight: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
          animation: 'orb-drift 18s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: '-5%',
          right: '-8%',
          width: '35vw',
          height: '35vw',
          maxWidth: '450px',
          maxHeight: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(5,150,105,0.09) 0%, transparent 70%)',
          animation: 'orb-drift 22s ease-in-out infinite reverse',
          pointerEvents: 'none',
        }}
      />

      {/* Top-left brand link */}
      <Link
        to="/"
        style={{
          position: 'absolute',
          top: '1.5rem',
          left: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          textDecoration: 'none',
          zIndex: 10,
        }}
      >
        <img
          src="/src/assets/ARALert_Logo_LIGHT.png"
          alt="ARALert"
          style={{ width: '32px', height: '32px', objectFit: 'contain' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: '1.1rem',
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          ARALert
        </span>
      </Link>

      {/* Centred card outlet */}
      <div style={{ width: '100%', maxWidth: '440px', zIndex: 2, padding: '1rem' }}>
        <Outlet />
      </div>
    </div>
  );
};
