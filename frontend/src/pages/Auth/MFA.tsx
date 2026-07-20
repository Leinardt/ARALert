import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { ShieldCheck, Mail, ArrowLeft } from 'lucide-react';

export const MFA: React.FC = () => {
  const { user, completeAuthSession } = useAuth();
  const navigate = useNavigate();
  const [isEnabled, setIsEnabled] = useState(Boolean(user?.mfa_enabled));
  const [isSaving, setIsSaving] = useState(false);
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(localStorage.getItem('mfa_user_id'));

  useEffect(() => {
    setIsEnabled(Boolean(user?.mfa_enabled));
  }, [user]);

  const pageTitle = useMemo(() => (pendingUserId ? 'Verify your one-time code' : 'Multi-Factor Authentication'), [pendingUserId]);

  const handleToggle = async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await authService.toggleMfa(!isEnabled);
      setIsEnabled(result.mfa_enabled);
      setMessage(result.mfa_enabled ? 'MFA is now enabled for your account.' : 'MFA has been disabled.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update MFA settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingUserId) {
      setError('No verification request is active. Please sign in again and try the OTP step.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await authService.verifyOtp(pendingUserId, otp);
      completeAuthSession(response);
      localStorage.removeItem('mfa_user_id');
      navigate(response.redirect ?? '/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The verification code was invalid or has expired.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '480px', background: '#ffffff', borderRadius: '24px', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)', border: '1px solid #dbeafe', overflow: 'hidden' }}>
        <div style={{ padding: '32px 32px 16px', background: 'linear-gradient(135deg, #eef5ff 0%, #ffffff 100%)' }}>
          <button type="button" onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0b5ed7', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#e7f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={24} color="#0b5ed7" />
            </div>
          </div>
          <h1 style={{ textAlign: 'center', fontSize: '24px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>{pageTitle}</h1>
          <p style={{ textAlign: 'center', color: '#64748b', margin: 0 }}>
            {pendingUserId ? 'Enter the secure code sent to your registered email to continue.' : 'Set or remove two-step verification for your account.'}
          </p>
        </div>

        <div style={{ padding: '24px 32px 32px' }}>
          {message && <div style={{ marginBottom: '16px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 14px' }}>{message}</div>}
          {error && <div style={{ marginBottom: '16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 14px' }}>{error}</div>}

          {!pendingUserId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ borderRadius: '16px', border: '1px solid #dbeafe', background: '#f8fbff', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Mail size={18} color="#0b5ed7" />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>Email-based verification</p>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>You’ll receive a one-time code whenever MFA is enabled and you log in.</p>
                  </div>
                </div>
              </div>
              <button type="button" onClick={handleToggle} disabled={isSaving} style={{ border: 'none', borderRadius: '999px', background: isEnabled ? '#0b5ed7' : '#64748b', color: '#ffffff', padding: '14px 18px', fontWeight: 700, cursor: 'pointer' }}>
                {isSaving ? 'Updating…' : isEnabled ? 'Disable MFA' : 'Enable MFA'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#334155', fontSize: '14px', fontWeight: 600 }}>
                One-time password
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  autoFocus
                  style={{ border: '1px solid #dbeafe', borderRadius: '12px', padding: '12px 14px', fontSize: '16px', outline: 'none' }}
                />
              </label>
              <button type="submit" disabled={isSaving || otp.length < 6} style={{ border: 'none', borderRadius: '999px', background: otp.length < 6 ? '#94a3b8' : '#0b5ed7', color: '#ffffff', padding: '14px 18px', fontWeight: 700, cursor: otp.length < 6 ? 'not-allowed' : 'pointer' }}>
                {isSaving ? 'Verifying…' : 'Verify code'}
              </button>
              <Link to="/login" style={{ textAlign: 'center', color: '#0b5ed7', textDecoration: 'none', fontWeight: 600 }}>Return to sign in</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
