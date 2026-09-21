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
            const btnWidth = Math.min(340, Math.max(220, window.innerWidth - 72));
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: 'outline',
              size: 'large',
              width: btnWidth,
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
    <div className="min-h-screen flex flex-col items-center justify-center px-3.5 sm:px-6 py-6 sm:py-12 md:py-16 box-border">
      <div
        className="w-full transition-all duration-300 mx-auto"
        style={{
          maxWidth: loginType === 'select' ? '560px' : '440px',
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
          <div className="p-5 sm:p-8 sm:pb-0 text-center">
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
          <div className="p-5 sm:p-8 pt-0 sm:pt-0">
            {/* ── Option Cards ────────────────────────────────────────── */}
            {loginType === 'select' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Staff Google Login Option */}
                <button
                  type="button"
                  onClick={() => { setLoginType('staff'); setServerError(null); }}
                  className="flex items-center gap-3.5 sm:gap-4.5 p-3.5 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-left transition-all duration-200 w-full hover:border-brand hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                  style={{
                    background: 'var(--surface-card)',
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
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: 'var(--brand-light)',
                      border: '1px solid var(--brand-border)',
                    }}
                  >
                    <Shield style={{ width: '22px', height: '22px', color: 'var(--brand)' }} />
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
                  className="flex items-center gap-3.5 sm:gap-4.5 p-3.5 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-left transition-all duration-200 w-full hover:border-brand hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                  style={{
                    background: 'var(--surface-card)',
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
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: 'var(--brand-light)',
                      border: '1px solid var(--brand-border)',
                    }}
                  >
                    <GraduationCap style={{ width: '22px', height: '22px', color: 'var(--brand)' }} />
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
