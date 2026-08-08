import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { User } from '../../types';
import { Link } from 'react-router-dom';
import {
  User as UserIcon,
  ShieldCheck,
  KeyRound,
  Upload,
  Calendar,
  Mail,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [localUser, setLocalUser] = useState<User | null>(user);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar ?? null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalUser(user);
    setAvatarPreview(user?.avatar ?? null);
  }, [user]);

  if (!localUser) {
    return (
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading profile information...
      </div>
    );
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Avatar images must be 2MB or smaller.');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    const formData = new FormData();
    formData.append('username', localUser.username);
    if (password) {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setIsSaving(false);
        return;
      }
      formData.append('password', password);
      formData.append('confirm_password', confirmPassword);
    }
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }

    try {
      const updated = await updateProfile(formData);
      setLocalUser(updated);
      setMessage('Profile updated successfully.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const messageText = err instanceof Error ? err.message : 'Unable to save profile.';
      setError(messageText);
      console.error('Profile update failed', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── User Overview Header ── */}
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: '2rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '22px',
                  background: 'var(--brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  fontSize: '2rem',
                  overflow: 'hidden',
                  boxShadow: '0 8px 20px rgba(9, 115, 55, 0.3)',
                }}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (localUser.first_name?.[0] || localUser.username[0]).toUpperCase()
                )}
              </div>
            </div>

            <div>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {localUser.full_name || localUser.username}
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={14} /> {localUser.email}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--brand-light)', color: 'var(--brand-dark)', border: '1px solid var(--brand-border)' }}>
                  {localUser.is_superuser ? 'SuperAdmin' : localUser.role?.toUpperCase() || 'USER'}
                </span>
                {localUser.mfa_enabled ? (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <ShieldCheck size={12} /> MFA Enabled
                  </span>
                ) : (
                  <Link to="/mfa" style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <ShieldCheck size={12} /> Enable MFA
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form Section ── */}
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--slate-200)', padding: '2rem', boxShadow: 'var(--shadow-xs)' }}>
        <h2 style={{ margin: '0 0 1.5rem', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Account & Profile Settings
        </h2>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {message && (
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} /> {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>First Name</label>
              <input
                value={localUser.first_name}
                readOnly
                disabled
                style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', background: 'var(--surface-muted)', fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'not-allowed' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Last Name</label>
              <input
                value={localUser.last_name}
                readOnly
                disabled
                style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', background: 'var(--surface-muted)', fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Email Address</label>
              <input
                type="email"
                value={localUser.email}
                readOnly
                disabled
                style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', background: 'var(--surface-muted)', fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'not-allowed' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Username</label>
              <input
                value={localUser.username}
                onChange={(event) => setLocalUser({ ...localUser, username: event.target.value })}
                style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', fontSize: '0.875rem', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--slate-100)', margin: '0.5rem 0', paddingTop: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <KeyRound size={16} color="var(--brand)" /> Change Password
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', fontSize: '0.875rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat new password"
                  style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', fontSize: '0.875rem', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--slate-100)', margin: '0.5rem 0', paddingTop: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Upload size={15} /> Upload New Avatar
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', fontSize: '0.8rem' }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Allowed formats: JPEG, PNG, WEBP. Max size: 2MB.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={15} /> Member Since
                </label>
                <input
                  value={new Date(localUser.date_joined).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  readOnly
                  disabled
                  style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', background: 'var(--surface-muted)', fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'not-allowed' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="submit"
              disabled={isSaving}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem', borderRadius: 'var(--radius-md)' }}
            >
              <Save size={16} />
              {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
