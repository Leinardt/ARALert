import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../hooks/useAuth';
import { AlertCircle } from 'lucide-react';

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
      setServerError(
        parseApiError(error, 'Google Sign-In failed. Check your email domain permissions.')
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // Initialize Google Identity Services Script
  useEffect(() => {
    if (loginType !== 'staff') return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

    if (!clientId) {
      setServerError(
        'Google Client ID is not configured. Please add VITE_GOOGLE_CLIENT_ID to your frontend/.env file.'
      );
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
    <div className="min-h-screen flex flex-col items-center justify-center px-3.5 sm:px-6 py-6 sm:py-12 md:py-16 box-border bg-white dark:bg-black text-slate-900 dark:text-white transition-colors">
      <div
        className="w-full transition-all duration-300 mx-auto"
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

        {/* Server error alert */}
        {serverError && (
          <div className="mb-4 p-3.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{serverError}</span>
          </div>
        )}

        {/* ── Card ── */}
        <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-slate-200/90 dark:border-neutral-800 shadow-sm overflow-hidden">
          {/* Card Header (No icons) */}
          <div className="p-5 sm:p-8 sm:pb-0 text-center">
            {loginType !== 'select' && (
              <button
                onClick={handleBack}
                type="button"
                className="glass-btn inline-flex items-center text-xs font-semibold px-3.5 py-1.5 rounded-full mb-4 cursor-pointer"
              >
                &larr; Back to options
              </button>
            )}

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              {loginType === 'select' && 'Sign In Options'}
              {loginType === 'staff' && 'Staff Google Login'}
              {loginType === 'student' && 'Student Login'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
              {loginType === 'select' && 'Select your portal to access the ARALert system.'}
              {loginType === 'staff' && 'Sign in using your pre-registered Google account.'}
              {loginType === 'student' && 'Enter your 12-digit Learner Reference Number to continue.'}
            </p>
          </div>

          {/* Card Body */}
          <div className="p-5 sm:p-8 pt-0 sm:pt-0">
            {/* ── Option Cards (Glass Style, Border-Only Blue Hover Effect) ── */}
            {loginType === 'select' && (
              <div className="flex flex-col gap-3.5">
                {/* Staff Google Login Option */}
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('staff');
                    setServerError(null);
                  }}
                  className="glass-card-btn group flex flex-col p-4 sm:p-5 rounded-xl text-left w-full cursor-pointer select-none"
                >
                  <div className="card-title font-semibold text-sm sm:text-base text-slate-900 dark:text-white mb-1 transition-colors duration-200">
                    Staff & Faculty Portal
                  </div>
                  <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Sign in using your pre-registered Google account (Principal, Admin, Tutor, Faculty).
                  </div>
                </button>

                {/* Student Login Option */}
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('student');
                    setServerError(null);
                  }}
                  className="glass-card-btn group flex flex-col p-4 sm:p-5 rounded-xl text-left w-full cursor-pointer select-none"
                >
                  <div className="card-title font-semibold text-sm sm:text-base text-slate-900 dark:text-white mb-1 transition-colors duration-200">
                    Student Learner Portal
                  </div>
                  <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Sign in directly with your 12-digit Learner Reference Number (LRN).
                  </div>
                </button>
              </div>
            )}

            {/* ── Staff Google Login (Glass Style, Border-Only Blue Hover Effect) ── */}
            {loginType === 'staff' && (
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-full max-w-[340px] mx-auto">
                  <button
                    type="button"
                    disabled={googleLoading}
                    className="glass-btn group w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl font-medium text-sm cursor-pointer select-none"
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

                <div className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 leading-relaxed w-full">
                  Only authorized DepEd / ARALert accounts are permitted to access.
                </div>
              </div>
            )}

            {/* ── Student Login Form (Glass Style, Border-Only Blue Hover Effect) ── */}
            {loginType === 'student' && (
              <form
                onSubmit={studentForm.handleSubmit(onStudentSubmit)}
                className="flex flex-col gap-4"
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
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50/50 dark:bg-neutral-900 text-slate-900 dark:text-white text-sm tracking-wide placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0052B7]/20 focus:border-[#0052B7] dark:focus:border-blue-500 transition-all duration-150 ${
                      studentForm.formState.errors.lrn
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-slate-200 dark:border-neutral-800'
                    }`}
                  />
                  {studentForm.formState.errors.lrn && (
                    <p className="mt-1 text-xs text-red-500">
                      {studentForm.formState.errors.lrn.message}
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-slate-400 dark:text-neutral-500">
                    Official 12-digit number issued by the Department of Education.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="glass-btn w-full py-2.5 px-4 rounded-xl font-semibold text-sm cursor-pointer mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
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

export default Login;
