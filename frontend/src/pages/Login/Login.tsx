import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../hooks/useAuth';
import {
  AlertCircle, Shield, GraduationCap, ArrowLeft, BookOpen,
  User, Hash, Info, CheckCircle2,
} from 'lucide-react';

// ── Student Login Schema (3 Name Fields + LRN) ──────────────────────────
const studentLoginSchema = z.object({
  firstName: z.string().min(1, 'First Name is required.'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last Name is required.'),
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
    defaultValues: { firstName: '', middleName: '', lastName: '', lrn: '' },
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
      const response = await studentLogin(
        data.firstName,
        data.middleName || '',
        data.lastName,
        data.lrn
      );
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f7f5' }}>
      {/* ── Top Navigation Header ────────────────────────────────────────── */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img
              src="/src/assets/ARALert_LOGO.png"
              alt="ARALert logo"
              style={{ width: '36px', height: '36px', objectFit: 'contain' }}
            />
            <span style={{ fontWeight: 700, fontSize: '20px', color: '#1a1a1a', letterSpacing: '-0.3px' }}>ARALert</span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {['Home', 'About', 'Features', 'Contact'].map((item) => (
              <a
                key={item}
                href={item === 'Home' ? '/' : `/#${item.toLowerCase()}`}
                style={{
                  color: '#6b7280',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  padding: '8px 14px',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#2E7D32';
                  e.currentTarget.style.background = '#f0fdf4';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6b7280';
                  e.currentTarget.style.background = 'transparent';
                }}
              >{item}</a>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Main Container ────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: loginType === 'select' ? '640px' : '460px',
          transition: 'max-width 0.3s ease',
        }}>
          {/* Session expired alert */}
          {isSessionExpired && (
            <div style={{
              marginBottom: '20px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              fontSize: '13px',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <AlertCircle style={{ width: '18px', height: '18px', color: '#d97706', flexShrink: 0 }} />
              <span>Your session has expired. Please log in again to continue.</span>
            </div>
          )}

          {/* Server error alert */}
          {serverError && (
            <div style={{
              marginBottom: '20px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '13px',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <AlertCircle style={{ width: '18px', height: '18px', color: '#dc2626', flexShrink: 0 }} />
              <span>{serverError}</span>
            </div>
          )}

          {/* ── Card ──────────────────────────────────────────────────────── */}
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}>
            {/* Card Header */}
            <div style={{
              padding: '32px 32px 0',
              textAlign: 'center',
            }}>
              {loginType !== 'select' && (
                <button
                  onClick={handleBack}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#6b7280',
                    fontSize: '13px',
                    fontWeight: 500,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#2E7D32';
                    e.currentTarget.style.background = '#f0fdf4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#6b7280';
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  <ArrowLeft style={{ width: '16px', height: '16px' }} />
                  Back to options
                </button>
              )}

              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: '#e8f5e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                {loginType === 'student' ? (
                  <GraduationCap style={{ width: '26px', height: '26px', color: '#2E7D32' }} />
                ) : loginType === 'staff' ? (
                  <Shield style={{ width: '26px', height: '26px', color: '#2E7D32' }} />
                ) : (
                  <BookOpen style={{ width: '26px', height: '26px', color: '#2E7D32' }} />
                )}
              </div>

              <h1 style={{
                fontSize: loginType === 'select' ? '24px' : '22px',
                fontWeight: 700,
                color: '#111827',
                margin: '0 0 6px',
                letterSpacing: '-0.3px',
              }}>
                {loginType === 'select' && 'Sign In Options'}
                {loginType === 'staff' && 'Staff Google Login'}
                {loginType === 'student' && 'Student Login'}
              </h1>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: '0 0 24px',
              }}>
                {loginType === 'select' && 'Select your portal to continue.'}
                {loginType === 'staff' && 'Sign in using your Google account.'}
                {loginType === 'student' && 'Enter your full name and Learner Reference Number.'}
              </p>
            </div>

            {/* Card Body */}
            <div style={{ padding: '0 32px 32px' }}>

              {/* ── Option Cards ────────────────────────────────────────── */}
              {loginType === 'select' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Staff Google Login Option */}
                  <button
                    type="button"
                    onClick={() => { setLoginType('staff'); setServerError(null); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '18px',
                      padding: '22px 24px',
                      borderRadius: '16px',
                      border: '2px solid #e5e7eb',
                      background: '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.25s ease',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#2E7D32';
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(46,125,50,0.12)';
                      e.currentTarget.style.background = '#fafff9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.background = '#ffffff';
                    }}
                  >
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Shield style={{ width: '26px', height: '26px', color: '#2E7D32' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '16px', color: '#111827', marginBottom: '4px' }}>
                        Faculty, Principal, and ARAL Program Tutor Login
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                        Sign in using your registered email.
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
                      padding: '22px 24px',
                      borderRadius: '16px',
                      border: '2px solid #e5e7eb',
                      background: '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.25s ease',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#2E7D32';
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(46,125,50,0.12)';
                      e.currentTarget.style.background = '#fafff9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.background = '#ffffff';
                    }}
                  >
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <GraduationCap style={{ width: '26px', height: '26px', color: '#2E7D32' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '16px', color: '#111827', marginBottom: '4px' }}>
                        Student Login
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                        Sign in using your name and LRN.
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
                    <div style={{ fontSize: '14px', color: '#2E7D32', fontWeight: 500 }}>
                      Authenticating with Google...
                    </div>
                  )}

                  <div style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    textAlign: 'center',
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <Info style={{ width: '14px', height: '14px' }} />
                    Only registered Google accounts to ARALert are permitted.
                  </div>
                </div>
              )}

              {/* ── Student Login Form (3 Name Fields + LRN) ─────────────── */}
              {loginType === 'student' && (
                <form onSubmit={studentForm.handleSubmit(onStudentSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* First Name */}
                  <div>
                    <label htmlFor="firstName" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      First Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#9ca3af' }} />
                      <input
                        id="firstName"
                        type="text"
                        placeholder="e.g. Juan"
                        {...studentForm.register('firstName')}
                        style={{
                          width: '100%',
                          padding: '12px 14px 12px 42px',
                          border: `1.5px solid ${studentForm.formState.errors.firstName ? '#fca5a5' : '#d1d5db'}`,
                          borderRadius: '12px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                          background: '#fafafa',
                          boxSizing: 'border-box',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#2E7D32';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(46,125,50,0.1)';
                          e.currentTarget.style.background = '#fff';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = studentForm.formState.errors.firstName ? '#fca5a5' : '#d1d5db';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.background = '#fafafa';
                        }}
                      />
                    </div>
                    {studentForm.formState.errors.firstName && (
                      <p style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{studentForm.formState.errors.firstName.message}</p>
                    )}
                  </div>

                  {/* Middle Name */}
                  <div>
                    <label htmlFor="middleName" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Middle Name <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#9ca3af' }} />
                      <input
                        id="middleName"
                        type="text"
                        placeholder="e.g. Santos"
                        {...studentForm.register('middleName')}
                        style={{
                          width: '100%',
                          padding: '12px 14px 12px 42px',
                          border: '1.5px solid #d1d5db',
                          borderRadius: '12px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                          background: '#fafafa',
                          boxSizing: 'border-box',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#2E7D32';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(46,125,50,0.1)';
                          e.currentTarget.style.background = '#fff';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#d1d5db';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.background = '#fafafa';
                        }}
                      />
                    </div>
                  </div>

                  {/* Last Name */}
                  <div>
                    <label htmlFor="lastName" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Last Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#9ca3af' }} />
                      <input
                        id="lastName"
                        type="text"
                        placeholder="e.g. Dela Cruz"
                        {...studentForm.register('lastName')}
                        style={{
                          width: '100%',
                          padding: '12px 14px 12px 42px',
                          border: `1.5px solid ${studentForm.formState.errors.lastName ? '#fca5a5' : '#d1d5db'}`,
                          borderRadius: '12px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                          background: '#fafafa',
                          boxSizing: 'border-box',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#2E7D32';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(46,125,50,0.1)';
                          e.currentTarget.style.background = '#fff';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = studentForm.formState.errors.lastName ? '#fca5a5' : '#d1d5db';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.background = '#fafafa';
                        }}
                      />
                    </div>
                    {studentForm.formState.errors.lastName && (
                      <p style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{studentForm.formState.errors.lastName.message}</p>
                    )}
                  </div>

                  {/* LRN */}
                  <div>
                    <label htmlFor="lrn" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Learner Reference Number (LRN) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Hash style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#9ca3af' }} />
                      <input
                        id="lrn"
                        type="text"
                        placeholder="12-digit LRN"
                        maxLength={12}
                        {...studentForm.register('lrn')}
                        style={{
                          width: '100%',
                          padding: '12px 14px 12px 42px',
                          border: `1.5px solid ${studentForm.formState.errors.lrn ? '#fca5a5' : '#d1d5db'}`,
                          borderRadius: '12px',
                          fontSize: '14px',
                          outline: 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                          background: '#fafafa',
                          boxSizing: 'border-box',
                          letterSpacing: '1px',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#2E7D32';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(46,125,50,0.1)';
                          e.currentTarget.style.background = '#fff';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = studentForm.formState.errors.lrn ? '#fca5a5' : '#d1d5db';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.background = '#fafafa';
                        }}
                      />
                    </div>
                    {studentForm.formState.errors.lrn && (
                      <p style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{studentForm.formState.errors.lrn.message}</p>
                    )}
                    <p style={{ marginTop: '4px', fontSize: '11px', color: '#9ca3af' }}>12-digit number assigned by DepEd.</p>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      padding: '13px',
                      background: isSubmitting ? '#66bb6a' : '#2E7D32',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(46,125,50,0.25)',
                      marginTop: '8px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting) e.currentTarget.style.background = '#1b5e20';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubmitting) e.currentTarget.style.background = '#2E7D32';
                    }}
                  >
                    {isSubmitting ? 'Signing in...' : 'Sign In as Student'}
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
