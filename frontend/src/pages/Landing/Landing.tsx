import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  Shield,
  Activity,
  BarChart3,
  QrCode,
  Users,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Award,
} from 'lucide-react';

export const Landing: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.is_superuser) return '/superadmin';
    return `/${user.role}`;
  };
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #F0FDF4 0%, #F8FAFC 50%, #FFFFFF 100%)',
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
        padding: '2rem 1.5rem 4rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* ── Outer Card Wrapper ── */}
      <div
        style={{
          width: '100%',
          maxWidth: '1140px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '32px',
          boxShadow: '0 32px 90px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(9, 115, 55, 0.12)',
          overflow: 'hidden',
        }}
      >
        {/* ── Top Bar Brand Header ── */}
        <div
          style={{
            padding: '1.75rem 2.5rem',
            borderBottom: '1px solid var(--slate-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <img
              src="/src/assets/ARALert_LOGO.png"
              alt="ARALert Logo"
              style={{ width: '36px', height: '36px', objectFit: 'contain' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              ARALert
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <Link
              to={isAuthenticated ? getDashboardLink() : '/login'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.35rem',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--brand)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.875rem',
                textDecoration: 'none',
                boxShadow: '0 10px 25px rgba(9, 115, 55, 0.3)',
                transition: 'var(--transition-fast)',
              }}
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Sign In'} <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* ── Hero Section ── */}
        <div style={{ padding: '3.5rem 2.5rem 2.5rem', textAlign: 'center', position: 'relative' }}>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(2rem, 4vw, 3.1rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              color: '#0F172A',
              maxWidth: '900px',
              margin: '0 auto 1.5rem',
              letterSpacing: '-0.03em',
            }}
          >
            Student Performance Monitoring & Early Academic Risk Detection
          </h1>

          <p
            style={{
              fontSize: '1.05rem',
              lineHeight: 1.75,
              color: 'var(--text-secondary)',
              maxWidth: '780px',
              margin: '0 auto 2.25rem',
            }}
          >
            Empowering the Academic Recovery and Accessible Learning (ARAL) program with automated risk detection, real-time QR attendance tracking, weighted academic evaluation, and targeted intervention management.
          </p>

          {/* Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link
              to={isAuthenticated ? getDashboardLink() : '/login'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.9rem 2.25rem',
                borderRadius: 'var(--radius-pill)',
                background: 'linear-gradient(135deg, #097337 0%, #075C2C 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                textDecoration: 'none',
                boxShadow: 'var(--shadow-brand)',
              }}
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Access System Portal'} <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* ── Feature Cards Grid ── */}
        <div
          id="features"
          style={{
            padding: '2.5rem',
            background: 'var(--slate-50)',
            borderTop: '1px solid var(--slate-100)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '24px',
              padding: '2rem',
              border: '1px solid var(--slate-200)',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#E6F7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#097337', marginBottom: '1.25rem' }}>
              <BarChart3 size={24} />
            </div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Continuous Performance Tracking
            </h3>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Consolidates assessments, weekly tasks, and attendance scores using customizable weight ratios to compute instant performance indicators per student.
            </p>
          </div>

          <div
            style={{
              background: '#fff',
              borderRadius: '24px',
              padding: '2rem',
              border: '1px solid var(--slate-200)',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', marginBottom: '1.25rem' }}>
              <Shield size={24} />
            </div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Automated Early Risk Warning
            </h3>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Algorithms analyze attendance thresholds and grade drops to surface high, medium, and low risk alerts, enabling proactive interventions.
            </p>
          </div>

          <div
            style={{
              background: '#fff',
              borderRadius: '24px',
              padding: '2rem',
              border: '1px solid var(--slate-200)',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', marginBottom: '1.25rem' }}>
              <QrCode size={24} />
            </div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              QR Code Attendance & Scanning
            </h3>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Generates session-specific QR codes for both students and staff, recording precise timestamped clock-in and clock-out events.
            </p>
          </div>
        </div>

        {/* ── System Roles Footer ── */}
        <div style={{ padding: '2rem 2.5rem', background: '#fff', borderTop: '1px solid var(--slate-100)', textTransform: 'none' }}>
          <p style={{ margin: 0, textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            SUPPORTED SYSTEM ROLES & ACCESS BOUNDARIES
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {['SuperAdmin', 'School Admin', 'Principal', 'Faculty', 'Tutor', 'Student'].map((role) => (
              <span
                key={role}
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '0.4rem 0.9rem',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--surface-muted)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--slate-200)',
                }}
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
