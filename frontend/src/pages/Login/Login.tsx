import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/axios';
import type { User } from '../../types';
import { PrivacyConsentModal } from '../../components/PrivacyConsentModal';
import { AlertCircle, ArrowLeft, ChevronRight } from 'lucide-react';
import aralertLogo from '../../assets/ARALert_Logo_LIGHT.png';

// ── Student Login Schema (LRN only) ───────────────────────────────
const studentLoginSchema = z.object({
  lrn: z
    .string()
    .min(1, 'LRN is required.')
    .regex(/^\d{12}$/, 'LRN must be exactly 12 digits.'),
});
type StudentLoginFields = z.infer<typeof studentLoginSchema>;

// ── Error parsing helper ──────────────────────────────────────────
const parseApiError = (error: any, fallback: string): string => {
  if (!error || !error.response) {
    return 'Authentication failed. Server might be offline or unreachable.';
  }
  const data = error.response.data;
  if (!data) return fallback;

  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.non_field_errors) {
    return Array.isArray(data.non_field_errors)
      ? data.non_field_errors[0]
      : String(data.non_field_errors);
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
  const { googleLogin, studentLogin, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loginType, setLoginType] = useState<LoginType>('select');
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Privacy Consent Modal state (intermediate gate)
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState<string>('/login');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);

  const isSessionExpired = searchParams.get('expired') === 'true';

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, []);

  // Student form
  const studentForm = useForm<StudentLoginFields>({
    resolver: zodResolver(studentLoginSchema),
    defaultValues: { lrn: '' },
  });

  const handleSuccessfulAuth = (res: any) => {
    const user = res.user;
    const isFirstTime = !user?.privacy_consent_accepted_at || user?.is_first_login;
    if (isFirstTime) {
      setPendingUser(user);
      setPendingRedirect(res.redirect ?? '/login');
      setShowConsentModal(true);
    } else {
      sessionStorage.setItem('aralert_is_first_login', 'false');
      navigate(res.redirect ?? '/login');
    }
  };

  const handleAcceptConsent = async () => {
    setConsentLoading(true);
    try {
      await api.post('/auth/consent/');
      if (pendingUser) {
        const updatedUser = {
          ...pendingUser,
          privacy_consent_accepted_at: new Date().toISOString(),
          is_first_login: false,
        };
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
      }
      sessionStorage.setItem('aralert_is_first_login', 'true');
      setShowConsentModal(false);
      navigate(pendingRedirect);
    } catch (err) {
      console.warn('Consent recording error:', err);
      sessionStorage.setItem('aralert_is_first_login', 'true');
      setShowConsentModal(false);
      navigate(pendingRedirect);
    } finally {
      setConsentLoading(false);
    }
  };

  const handleDeclineConsent = async () => {
    setShowConsentModal(false);
    setPendingUser(null);
    await logout();
    setServerError('You must accept the Data Privacy Terms to access the system.');
  };

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
      handleSuccessfulAuth(res);
    } catch (error: any) {
      setServerError(
        parseApiError(error, 'Google Sign-In failed. Check your email domain permissions.')
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // Preload Google Identity Services Script on initial mount
  useEffect(() => {
    if (!window.google?.accounts?.id) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // Initialize & Render Google Button when in staff view
  useEffect(() => {
    if (loginType !== 'staff') return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    if (!clientId) {
      setServerError(
        'Google Client ID is not configured. Please add VITE_GOOGLE_CLIENT_ID to your frontend/.env file.'
      );
      return;
    }

    const renderGoogleButton = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
          });

          const btnWidth = Math.min(340, Math.max(220, window.innerWidth - 72));
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: btnWidth,
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'center',
          });
          return true;
        } catch (err) {
          console.warn('Google Identity Services initialization error:', err);
        }
      }
      return false;
    };

    if (!renderGoogleButton()) {
      const interval = setInterval(() => {
        if (renderGoogleButton()) {
          clearInterval(interval);
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [loginType]);

  const onStudentSubmit = async (data: StudentLoginFields) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const response = await studentLogin(data.lrn);
      handleSuccessfulAuth(response);
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
    <div className="w-full min-h-[100dvh] flex flex-col items-center justify-center px-3.5 sm:px-6 py-12 sm:py-16 box-border bg-white dark:bg-black text-slate-900 dark:text-white transition-colors">
      <div
        className="w-full transition-all duration-300 ease-out mx-auto"
        style={{
          maxWidth: loginType === 'select' ? '540px' : '440px',
        }}
      >
        {/* Session expired alert */}
        {isSessionExpired && (
          <div className="mb-4 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Your session has expired. Please log in again to continue.</span>
          </div>
        )}

        {/* Server error / Notification alert */}
        {serverError && (
          <div className="mb-4 p-3.5 rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 text-xs sm:text-sm flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-orange-600 dark:text-orange-400" />
            <span>{serverError}</span>
          </div>
        )}

        {/* ── Card ── */}
        <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-slate-200/90 dark:border-neutral-800 shadow-sm overflow-hidden relative">
          {/* Card Header */}
          <div className="p-6 sm:p-8 sm:pb-0 text-center flex flex-col items-center relative">
            {/* Back to Options button on upper left with generous bottom spacing */}
            {loginType !== 'select' && (
              <div className="w-full flex items-center justify-start mb-6 sm:mb-7 animate-view-fade-in">
                <button
                  onClick={handleBack}
                  type="button"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-[#0052B7] dark:text-slate-400 dark:hover:text-blue-400 transition-colors cursor-pointer bg-transparent border-0 p-0 outline-none select-none group"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:-translate-x-1 text-slate-500 group-hover:text-[#0052B7] dark:text-slate-400 dark:group-hover:text-blue-400" />
                  <span>Back to Options</span>
                </button>
              </div>
            )}

            {/* ARALert Logo Icon */}
            <div className="mb-3.5 flex items-center justify-center">
              <img
                src={aralertLogo}
                alt="ARALert Logo"
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain transition-transform duration-200 hover:scale-105"
              />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              {loginType === 'select' && 'Sign In Options'}
              {loginType === 'staff' && 'PNAHS Personnel Login'}
              {loginType === 'student' && 'Student Login'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-5 sm:mb-6 leading-relaxed text-center w-full px-1 sm:px-2">
              {loginType === 'select' && 'Select your portal to access ARALert.'}
              {loginType === 'staff' && 'Sign in using your pre-registered Google account.'}
              {loginType === 'student' && 'Enter your 12-digit Learner Reference Number.'}
            </p>
          </div>

          {/* Card Body */}
          <div className="p-4 sm:p-8 pt-0 sm:pt-0">
            {/* ── Option Cards (Solid Visible Cards with Chevron and High-Contrast Hover) ── */}
            {loginType === 'select' && (
              <div className="flex flex-col gap-3 sm:gap-3.5 animate-view-fade-in">
                {/* PNAHS Personnel Google Login Option */}
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('staff');
                    setServerError(null);
                  }}
                  className="group flex items-center justify-between p-3.5 sm:p-5 rounded-xl text-left w-full cursor-pointer select-none transition-all duration-200 bg-slate-50 hover:bg-blue-50/70 dark:bg-neutral-900 dark:hover:bg-neutral-800/90 border border-slate-300 hover:border-[#0052B7] dark:border-neutral-700 dark:hover:border-blue-500 shadow-xs hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="min-w-0 pr-2.5 sm:pr-3">
                    <div className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-[#0052B7] dark:group-hover:text-blue-400 mb-0.5 sm:mb-1 transition-colors duration-200">
                      PNAHS Personnel Portal
                    </div>
                    <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-snug sm:leading-relaxed">
                      Sign in using your pre-registered Google account.
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors shrink-0" />
                </button>

                {/* Student Login Option */}
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('student');
                    setServerError(null);
                  }}
                  className="group flex items-center justify-between p-3.5 sm:p-5 rounded-xl text-left w-full cursor-pointer select-none transition-all duration-200 bg-slate-50 hover:bg-blue-50/70 dark:bg-neutral-900 dark:hover:bg-neutral-800/90 border border-slate-300 hover:border-[#0052B7] dark:border-neutral-700 dark:hover:border-blue-500 shadow-xs hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="min-w-0 pr-2.5 sm:pr-3">
                    <div className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-[#0052B7] dark:group-hover:text-blue-400 mb-0.5 sm:mb-1 transition-colors duration-200">
                      Student Portal
                    </div>
                    <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-snug sm:leading-relaxed">
                      Sign in using your 12-digit Learner Reference Number.
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors shrink-0" />
                </button>
              </div>
            )}

            {/* ── Staff Google Login (Solid High-Contrast Button) ── */}
            {loginType === 'staff' && (
              <div className="flex flex-col items-center gap-4 animate-view-fade-in">
                <div className="relative w-full max-w-[340px] h-[44px] mx-auto">
                  <button
                    type="button"
                    disabled={googleLoading}
                    className="group w-full h-full flex items-center justify-center gap-2.5 px-4 rounded-xl font-semibold text-sm cursor-pointer select-none transition-all duration-200 bg-white hover:bg-slate-50 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-800 dark:text-white border-2 border-slate-300 hover:border-[#0052B7] dark:border-neutral-700 dark:hover:border-blue-500 shadow-xs hover:shadow-md hover:-translate-y-0.5"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.34 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
                  </button>
                  <div
                    ref={googleBtnRef}
                    className="absolute inset-0 w-full h-full opacity-[0.001] overflow-hidden cursor-pointer flex items-center justify-center z-10"
                    title="Continue with Google"
                  />
                </div>

                <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 text-center mt-2 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 w-full leading-relaxed select-none tracking-tight">
                  Only authorized Google accounts are permitted to access.
                </div>
              </div>
            )}

            {/* ── Student Login Form (Solid Brand Button) ── */}
            {loginType === 'student' && (
              <form
                onSubmit={studentForm.handleSubmit(onStudentSubmit)}
                className="flex flex-col gap-4 animate-view-fade-in"
              >
                <div>
                  <label
                    htmlFor="lrn"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Learner Reference Number (LRN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lrn"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter 12-digit LRN"
                    maxLength={12}
                    {...studentForm.register('lrn')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50/50 dark:bg-neutral-900 text-slate-900 dark:text-white text-sm tracking-wide placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052B7]/20 focus:border-[#0052B7] dark:focus:border-blue-500 transition-all duration-150 ${studentForm.formState.errors.lrn
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-slate-200 dark:border-neutral-800'
                      }`}
                  />
                  {studentForm.formState.errors.lrn && (
                    <p className="mt-1 text-xs text-red-500">
                      {studentForm.formState.errors.lrn.message}
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-slate-400 dark:text-neutral-500 leading-relaxed">
                    Official 12-digit number issued by the Department of Education.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm cursor-pointer mt-1 text-white bg-[#0052B7] hover:bg-[#004294] transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign In as Student'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer Legal Links */}
        <div className="mt-5 sm:mt-6 text-center text-xs text-slate-500 dark:text-neutral-500 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5">
          <span>By continuing, you acknowledge our</span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Link to="/terms" className="text-[#0052B7] dark:text-blue-400 hover:underline font-medium">
              Terms of Service
            </Link>
            <span>&bull;</span>
            <Link to="/privacy" className="text-[#0052B7] dark:text-blue-400 hover:underline font-medium">
              Privacy Policy
            </Link>
          </span>
        </div>
      </div>

      {/* Privacy Consent Modal Gate for First-Time Logins */}
      <PrivacyConsentModal
        isOpen={showConsentModal}
        userName={pendingUser?.full_name || [pendingUser?.first_name, pendingUser?.last_name].filter(Boolean).join(' ') || pendingUser?.username || 'User'}
        userRole={pendingUser?.is_superuser ? 'Super Admin' : (pendingUser?.role || 'Member')}
        onAccept={handleAcceptConsent}
        onDecline={handleDeclineConsent}
        isLoading={consentLoading}
      />
    </div>
  );
};

export default Login;

