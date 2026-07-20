import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authService } from '../../services/authService';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';

const activateSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string().min(8, 'Confirm your password.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type ActivateFields = z.infer<typeof activateSchema>;

export const ActivateAccount: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = searchParams.get('token') || '';

  const { register, handleSubmit, formState: { errors } } = useForm<ActivateFields>({
    resolver: zodResolver(activateSchema),
    defaultValues: { username: '', password: '', confirmPassword: '' },
  });

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
      const errorsPayload = error.response?.data?.errors;
      const message = errorsPayload?.token?.[0] || errorsPayload?.detail || 'Unable to activate the account.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f5', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '460px', background: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Complete your account setup</h2>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>Choose a username and a secure password to activate your ARALert account.</p>
        {serverError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} /> <span>{serverError}</span>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Username</label>
            <input type="text" {...register('username')} style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${errors.username ? '#fca5a5' : '#d1d5db'}`, borderRadius: '12px', fontSize: '14px', outline: 'none' }} />
            {errors.username && <p style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{errors.username.message}</p>}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>New Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input type={showPassword ? 'text' : 'password'} {...register('password')} style={{ width: '100%', padding: '12px 44px 12px 42px', border: `1.5px solid ${errors.password ? '#fca5a5' : '#d1d5db'}`, borderRadius: '12px', fontSize: '14px', outline: 'none' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {errors.password && <p style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{errors.password.message}</p>}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input type={showConfirm ? 'text' : 'password'} {...register('confirmPassword')} style={{ width: '100%', padding: '12px 44px 12px 42px', border: `1.5px solid ${errors.confirmPassword ? '#fca5a5' : '#d1d5db'}`, borderRadius: '12px', fontSize: '14px', outline: 'none' }} />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {errors.confirmPassword && <p style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '13px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {isSubmitting ? 'Activating account...' : 'Create username and password'}
          </button>
        </form>
        <p style={{ marginTop: '16px', fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
          Need help? <Link to="/login" style={{ color: '#2E7D32', fontWeight: 600 }}>Back to login</Link>
        </p>
      </div>
    </div>
  );
};
