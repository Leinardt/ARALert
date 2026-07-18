import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authService } from '../../services/authService';
import { AlertCircle, Mail } from 'lucide-react';

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
});

type ForgotFields = z.infer<typeof forgotSchema>;

export const ForgotPassword: React.FC = () => {
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotFields>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotFields) => {
    setIsSubmitting(true);
    setServerMessage(null);
    setServerError(null);
    try {
      const response = await authService.forgotPassword(data.email);
      setServerMessage(response.detail);
    } catch (error: any) {
      const message = error.response?.data?.errors?.email?.[0] || 'Unable to send reset instructions.';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f5', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '460px', background: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Forgot password?</h2>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>Enter your registered email address and we will send a secure reset link.</p>
        {serverError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18} /><span>{serverError}</span></div>}
        {serverMessage && <div style={{ background: '#ecfdf3', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>{serverMessage}</div>}
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input type="email" {...register('email')} style={{ width: '100%', padding: '12px 14px 12px 42px', border: `1.5px solid ${errors.email ? '#fca5a5' : '#d1d5db'}`, borderRadius: '12px', fontSize: '14px', outline: 'none' }} />
            </div>
            {errors.email && <p style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{errors.email.message}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '13px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
        <p style={{ marginTop: '16px', fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
          <Link to="/login" style={{ color: '#2E7D32', fontWeight: 600 }}>Back to login</Link>
        </p>
      </div>
    </div>
  );
};
