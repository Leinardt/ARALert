import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authService } from '../../services/authService';
import { AlertCircle, Eye, EyeOff, Lock, CheckCircle2, XCircle } from 'lucide-react';

// ── Password complexity rules ──────────────────────────────────────────────
const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'At least one uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'At least one lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'At least one number', test: (p: string) => /\d/.test(p) },
  { label: 'At least one special character (!@#$%^&*…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const activateSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters.')
    .max(150, 'Username is too long.')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, digits, dots, underscores, and hyphens.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/\d/, 'Password must contain at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character.'),
  confirmPassword: z.string().min(1, 'Please confirm your password.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type ActivateFields = z.infer<typeof activateSchema>;

// ── Password strength indicator ────────────────────────────────────────────
const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const percent = (passed / PASSWORD_RULES.length) * 100;
  const color = percent <= 40 ? '#dc2626' : percent <= 80 ? '#d97706' : '#16a34a';
  const label = percent <= 40 ? 'Weak' : percent <= 80 ? 'Fair' : passed === PASSWORD_RULES.length ? 'Strong' : 'Good';

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>Password strength</span>
        <span style={{ fontSize: '11px', color, fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: '99px', transition: 'width 0.3s, background 0.3s' }} />
      </div>
      <ul style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px', listStyle: 'none', padding: 0 }}>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: ok ? '#16a34a' : '#6b7280' }}>
              {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const ActivateAccount: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = searchParams.get('token') || '';

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ActivateFields>({
    resolver: zodResolver(activateSchema),
    defaultValues: { username: '', password: '', confirmPassword: '' },
  });

  const watchedPassword = watch('password', '');

  useEffect(() => {
    if (!token) {
      navigate('/invalid-link');
    }
  }, [navigate, token]);

  const onSubmit = async (data: ActivateFields) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const response = await authService.activateAccount(token, data.username, data.password, data.confirmPassword);
      const accessToken = response.access ?? '';
      const refreshToken = response.refresh ?? '';
      const redirectPath = response.redirect ?? '/login';

      if (accessToken) localStorage.setItem('access_token', accessToken);
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
      } else {
        localStorage.removeItem('user');
      }

      window.location.assign(redirectPath);
    } catch (error: any) {
      // DRF returns errors at error.response.data (not .data.errors)
      const errorData = error.response?.data;
      let message = 'Unable to activate the account. Please try again.';

      if (errorData) {
        if (typeof errorData.token === 'string') {
          message = errorData.token;
        } else if (Array.isArray(errorData.token)) {
          message = errorData.token[0];
        } else if (typeof errorData.username === 'string') {
          message = errorData.username;
        } else if (Array.isArray(errorData.username)) {
          message = errorData.username[0];
        } else if (typeof errorData.password === 'string') {
          message = errorData.password;
        } else if (Array.isArray(errorData.password)) {
          message = errorData.password[0];
        } else if (typeof errorData.detail === 'string') {
          message = errorData.detail;
        } else if (Array.isArray(errorData.non_field_errors)) {
          message = errorData.non_field_errors[0];
        }
      }

      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f5', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '480px', background: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Complete your account setup</h2>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>Choose a username and a secure password to activate your ARALert account.</p>

        {serverError && (
          <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} aria-hidden="true" /> <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Username */}
          <div>
            <label htmlFor="activate-username" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Username
            </label>
            <input
              id="activate-username"
              type="text"
              autoComplete="username"
              {...register('username')}
              style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${errors.username ? '#fca5a5' : '#d1d5db'}`, borderRadius: '12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
            {errors.username && <p role="alert" style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{errors.username.message}</p>}
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="activate-password" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} aria-hidden="true" />
              <input
                id="activate-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('password')}
                style={{ width: '100%', padding: '12px 44px 12px 42px', border: `1.5px solid ${errors.password ? '#fca5a5' : '#d1d5db'}`, borderRadius: '12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p role="alert" style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{errors.password.message}</p>}
            <PasswordStrength password={watchedPassword} />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="activate-confirm-password" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} aria-hidden="true" />
              <input
                id="activate-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('confirmPassword')}
                style={{ width: '100%', padding: '12px 44px 12px 42px', border: `1.5px solid ${errors.confirmPassword ? '#fca5a5' : '#d1d5db'}`, borderRadius: '12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && <p role="alert" style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{errors.confirmPassword.message}</p>}
          </div>

          <button
            type="submit"
            id="activate-submit"
            disabled={isSubmitting}
            style={{ width: '100%', padding: '13px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.75 : 1 }}
          >
            {isSubmitting ? 'Activating account…' : 'Create username and password'}
          </button>
        </form>

        <p style={{ marginTop: '16px', fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
          Need help? <Link to="/login" style={{ color: '#2E7D32', fontWeight: 600 }}>Back to login</Link>
        </p>
      </div>
    </div>
  );
};
