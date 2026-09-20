import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../hooks/useAuth';
import {
  AlertCircle, Shield, GraduationCap, ArrowLeft, BookOpen,
  Hash, Info, CheckCircle2,
} from 'lucide-react';

// ── Student Login Schema (LRN only) ───────────────────────────────
const studentLoginSchema = z.object({
  lrn: z.string()
    .min(1, 'LRN is required.')
    .regex(/^\d{12}$/, 'LRN must be exactly 12 digits.'),
});
type StudentLoginFields = z.infer<typeof studentLoginSchema>;

// ── Error parsing helper ─────────────────────────────────────────────────
const parseApiError = (error: any, fallback: string): string => {
  if (!error || !error.response) {
    return 'Authentication failed. Server might be offline or unreachable.';
  }
  const data = error.response.data;
  if (!data) return fallback;

  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.non_field_errors) {
    return Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : String(data.non_field_errors);
  }
  if (data.id_token) {
    return Array.isArray(data.id_token) ? data.id_token[0] : String(data.id_token);
  }
  if (data.errors) {
    const ep = data.errors;
    if (typeof ep === 'string') return ep;
    if (ep.detail) return ep.detail;
    if (typeof ep === 'object') {
      const msg = Object.values(ep).flat().join(' ');
      if (msg) return msg;
    }
  }
  if (typeof data === 'object') {
    const msg = Object.values(data).flat().join(' ');
    if (msg) return msg;
  }
  return fallback;
};

type LoginType = 'select' | 'staff' | 'student';

declare global {
  interface Window {
    google?: any;
  }
}

export const Login: React.FC = () => {
  const { googleLogin, studentLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loginType, setLoginType] = useState<LoginType>('select');
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const isSessionExpired = searchParams.get('expired') === 'true';

  // Student form
  const studentForm = useForm<StudentLoginFields>({
    resolver: zodResolver(studentLoginSchema),
    defaultValues: { lrn: '' },
  });

  // Handle Google OAuth Credential Response
  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response || !response.credential) {
      setServerError('Google Sign-In failed. Please try again.');
      return;
    }
    setGoogleLoading(true);
    setServerError(null);
    try {
      const res = await googleLogin(response.credential);
      navigate(res.redirect ?? '/login');
    } catch (error: any) {
      setServerError(parseApiError(error, 'Google Sign-In failed. Check your email domain permissions.'));
    } finally {
      setGoogleLoading(false);
    }
  };

  // Initialize Google Identity Services Script
  useEffect(() => {
    if (loginType !== 'staff') return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

    if (!clientId) {
      setServerError('Google Client ID is not configured. Please add VITE_GOOGLE_CLIENT_ID to your frontend/.env file.');
      return;
    }

    const initializeGsi = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
          });

          if (googleBtnRef.current) {
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: 'outline',
              size: 'large',
              width: 340,
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'center',
            });
          }
        } catch (err) {
          console.warn('Google Identity Services initialization error:', err);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initializeGsi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGsi;
      document.body.appendChild(script);
    }
  }, [loginType]);

  const onStudentSubmit = async (data: StudentLoginFields) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const response = await studentLogin(data.lrn);
      navigate(response.redirect ?? '/student');
    } catch (error: any) {
      setServerError(parseApiError(error, 'Invalid student credentials or LRN.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setLoginType('select');
    setServerError(null);
    studentForm.reset();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '100px 20px 80px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: loginType === 'select' ? '560px' : '440px',
          margin: '0 auto',
          transition: 'max-width 0.3s ease',
        }}
      >
        {/* Session expired alert */}
        {isSessionExpired && (
          <div
            style={{
              marginBottom: '20px',
              background: 'var(--color-warning-bg)',
              border: '1px solid var(--color-warning-border)',
              color: 'var(--color-warning)',
              fontSize: '13px',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertCircle style={{ width: '18px', height: '18px', color: 'var(--color-warning)', flexShrink: 0 }} />
            <span>Your session has expired. Please log in again to continue.</span>
          </div>
        )}

        {/* Server error alert */}
        {serverError && (
          <div
            style={{
              marginBottom: '20px',
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              color: 'var(--color-danger)',
              fontSize: '13px',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertCircle style={{ width: '18px', height: '18px', color: 'var(--color-danger)', flexShrink: 0 }} />
            <span>{serverError}</span>
          </div>
        )}

        {/* ── Card ──────────────────────────────────────────────────────── */}
        <div
          style={{
            background: 'var(--surface-card)',
            borderRadius: '24px',
            border: '1px solid var(--slate-200)',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden',
          }}
        >
          {/* Card Header */}
          <div
            style={{
              padding: '36px 36px 0',
              textAlign: 'center',
            }}
          >
            {loginType !== 'select' && (
              <button
                onClick={handleBack}
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--brand)',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: 'var(--brand-light)',
                  border: '1px solid var(--brand-border)',
                  cursor: 'pointer',
                  padding: '6px 14px',
                  borderRadius: '99px',
                  marginBottom: '16px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-muted)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--brand-light)';
                }}
              >
                <ArrowLeft style={{ width: '15px', height: '15px' }} />
                Back to options
              </button>
            )}

            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'var(--brand-light)',
                border: '1px solid var(--brand-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              {loginType === 'student' ? (
                <GraduationCap style={{ width: '28px', height: '28px', color: 'var(--brand)' }} />
              ) : loginType === 'staff' ? (
                <Shield style={{ width: '28px', height: '28px', color: 'var(--brand)' }} />
              ) : (
                <BookOpen style={{ width: '28px', height: '28px', color: 'var(--brand)' }} />
              )}
            </div>

            <h1
              style={{
                fontSize: loginType === 'select' ? '24px' : '22px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '0 0 6px',
                letterSpacing: '-0.3px',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {loginType === 'select' && 'Sign In Options'}
              {loginType === 'staff' && 'Staff Google Login'}
              {loginType === 'student' && 'Student Login'}
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                margin: '0 0 28px',
              }}
            >
              {loginType === 'select' && 'Select your portal to access the ARALert system.'}
              {loginType === 'staff' && 'Sign in using your pre-registered Google account.'}
              {loginType === 'student' && 'Enter your 12-digit Learner Reference Number to continue.'}
            </p>
          </div>

          {/* Card Body */}
          <div style={{ padding: '0 36px 36px' }}>
            {/* ── Option Cards ────────────────────────────────────────── */}
            {loginType === 'select' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Staff Google Login Option */}
                <button
                  type="button"
                  onClick={() => { setLoginType('staff'); setServerError(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '18px',
                    padding: '20px 22px',
                    borderRadius: '18px',
                    border: '1.5px solid var(--slate-200)',
                    background: 'var(--surface-card)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--brand)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    e.currentTarget.style.background = 'var(--surface-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--slate-200)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.background = 'var(--surface-card)';
                  }}
                >
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '14px',
                      background: 'var(--brand-light)',
                      border: '1px solid var(--brand-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Shield style={{ width: '24px', height: '24px', color: 'var(--brand)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                      Staff & Faculty Portal
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Sign in using your pre-registered Google account (Principal, Admin, Tutor, Faculty).
                    </div>
                  </div>
                </button>

                {/* Student Login Option */}
                <button
                  type="button"
                  onClick={() => { setLoginType('student'); setServerError(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '18px',
                    padding: '20px 22px',
                    borderRadius: '18px',
                    border: '1.5px solid var(--slate-200)',
                    background: 'var(--surface-card)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--brand)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    e.currentTarget.style.background = 'var(--surface-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--slate-200)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.background = 'var(--surface-card)';
                  }}
                >
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '14px',
                      background: 'var(--brand-light)',
                      border: '1px solid var(--brand-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <GraduationCap style={{ width: '24px', height: '24px', color: 'var(--brand)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                      Student Learner Portal
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      Sign in directly with your 12-digit Learner Reference Number (LRN).
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* ── Staff Google Login ───────────────────────────────────── */}
            {loginType === 'staff' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                {/* Render Google Sign-In Button */}
                <div
                  ref={googleBtnRef}
                  style={{ minHeight: '50px', display: 'flex', justifyContent: 'center', width: '100%' }}
                />

                {googleLoading && (
                  <div style={{ fontSize: '14px', color: 'var(--brand)', fontWeight: 600 }}>
                    Authenticating with Google...
                  </div>
                )}

                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: 'var(--surface-muted)',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--slate-200)',
                    lineHeight: '1.4',
                  }}
                >
                  <Info style={{ width: '14px', height: '14px', color: 'var(--brand)', flexShrink: 0 }} />
                  <span>Only authorized DepEd / ARALert accounts are permitted to access.</span>
                </div>
              </div>
            )}

            {/* ── Student Login Form (LRN only) ────────────────────────── */}
            {loginType === 'student' && (
              <form onSubmit={studentForm.handleSubmit(onStudentSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="lrn" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Learner Reference Number (LRN) <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Hash style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                    <input
                      id="lrn"
                      type="text"
                      placeholder="Enter 12-digit LRN"
                      maxLength={12}
                      {...studentForm.register('lrn')}
                      style={{
                        width: '100%',
                        padding: '12px 14px 12px 42px',
                        border: `1.5px solid ${studentForm.formState.errors.lrn ? 'var(--color-danger)' : 'var(--slate-200)'}`,
                        borderRadius: '12px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        background: 'var(--surface-muted)',
                        color: 'var(--text-primary)',
                        boxSizing: 'border-box',
                        letterSpacing: '1px',
                        fontFamily: 'var(--font-body)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--brand)';
                        e.currentTarget.style.boxShadow = '0 0 0 3px var(--brand-glow)';
                        e.currentTarget.style.background = 'var(--surface-card)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = studentForm.formState.errors.lrn ? 'var(--color-danger)' : 'var(--slate-200)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.background = 'var(--surface-muted)';
                      }}
                    />
                  </div>
                  {studentForm.formState.errors.lrn && (
                    <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-danger)' }}>{studentForm.formState.errors.lrn.message}</p>
                  )}
                  <p style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>Official 12-digit number issued by the Department of Education.</p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '13px',
                    background: isSubmitting ? 'var(--slate-400)' : 'var(--brand)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: 'var(--shadow-brand)',
                    marginTop: '6px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.background = 'var(--brand-hover)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.background = 'var(--brand)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {isSubmitting ? 'Signing in...' : 'Sign In as Student'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
