import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { User } from '../../types';
import { getUserInitial, getUserAvatarColorResolved } from '../../utils/studentFormatters';
import {
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Edit3,
  X,
  Save,
  Info,
} from 'lucide-react';

/**
 * Format ARAL level string (e.g. 'basic' -> 'Basic').
 */
const formatAralLevel = (level: string | null | undefined): string => {
  if (!level) return 'Basic';
  return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
};


/**
 * Format string to Title Case (normal typography with first letter of each word capitalized).
 */
const toTitleCase = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Format user full name for system display:
 * All UPPERCASE as LASTNAME, FIRSTNAME M.I (e.g. "DELA CRUZ, JUAN S.").
 */
const formatSystemDisplayName = (user: User | null): string => {
  if (!user) return '';
  const first = (user.first_name || '').trim().toUpperCase();
  const last = (user.last_name || '').trim().toUpperCase();
  let middleInitial = '';
  if (user.middle_name && user.middle_name.trim()) {
    middleInitial = `${user.middle_name.trim()[0].toUpperCase()}.`;
  }
  const given = [first, middleInitial].filter(Boolean).join(' ');
  if (last && given) {
    return `${last}, ${given}`;
  }
  return (last || given || user.full_name || user.username || '').toUpperCase();
};

const SecurityHelpButton: React.FC<{ label: string; description: string }> = ({ label, description }) => (
  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} className="group">
    <button
      type="button"
      aria-label={label}
      style={{
        border: 'none',
        background: 'transparent',
        padding: 0,
        color: 'var(--text-muted)',
        fontSize: '0.7rem',
        fontWeight: 800,
        letterSpacing: '0.06em',
        cursor: 'pointer',
      }}
    >
      {label.toUpperCase()}
    </button>
    <button
      type="button"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-muted)',
        cursor: 'pointer',
      }}
    >
      <Info size={14} />
    </button>
    <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block">
      {description}
    </span>
  </span>
);

export const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [localUser, setLocalUser] = useState<User | null>(user);
  const [isEditing, setIsEditing] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editMiddle, setEditMiddle] = useState('');
  const [editLast, setEditLast] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalUser(user);
  }, [user]);

  const handleEditOpen = () => {
    if (!localUser) return;
    setEditFirst(toTitleCase(localUser.first_name));
    setEditMiddle(toTitleCase(localUser.middle_name));
    setEditLast(toTitleCase(localUser.last_name));
    setMessage(null);
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!localUser) return;
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('first_name', toTitleCase(editFirst));
      formData.append('middle_name', toTitleCase(editMiddle));
      formData.append('last_name', toTitleCase(editLast));
      const updated = await updateProfile(formData);
      setLocalUser(updated);
      setMessage('Profile updated successfully.');
      setIsEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!localUser) {
    return (
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading profile information...
      </div>
    );
  }

  const readonlyStyle: React.CSSProperties = {
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--slate-200)',
    background: 'var(--surface-muted)',
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
  };

  const editableStyle: React.CSSProperties = {
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--brand)',
    background: 'var(--surface-card)',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const avatarColor = getUserAvatarColorResolved(localUser);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── User Overview Header ── */}
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', padding: '2rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              className={`flex items-center justify-center font-extrabold overflow-hidden${avatarColor.kind === 'class' ? ` ${avatarColor.value}` : ''}`}
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '22px',
                fontFamily: 'var(--font-heading)',
                fontSize: '2rem',
                ...(avatarColor.kind === 'style' ? avatarColor.value : {}),
              }}
            >
              {localUser.avatar ? (
                <img src={localUser.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                getUserInitial(localUser)
              )}
            </div>

            <div>
              {/* Displayed in uppercase with middle initial only across the system */}
              <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                {formatSystemDisplayName(localUser)}
              </h1>
              {localUser.role === 'student' ? (
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)' }}>LRN:</span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>{localUser.lrn || '—'}</span>
                </p>
              ) : (
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Mail size={14} /> {localUser.email}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--brand-light)', color: 'var(--brand-dark)', border: '1px solid var(--brand-border)' }}>
                  {localUser.is_superuser ? 'SuperAdmin' : localUser.role?.toUpperCase() || 'USER'}
                </span>
                {(localUser.role === 'student' || localUser.role === 'tutor') && (
                  <>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/80">
                      ARAL {formatAralLevel(localUser.aral_level).toUpperCase()}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                      (localUser.subject || 'Reading') === 'Reading'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80'
                        : (localUser.subject || 'Reading') === 'Science'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80'
                        : 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/80'
                    }`}>
                      {localUser.subject || 'Reading'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile Details Section ── */}
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--slate-200)', padding: '2rem', boxShadow: 'var(--shadow-xs)' }}>

        {/* Card header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            PROFILE INFORMATION
          </h2>

          {!isEditing ? (
            <button
              type="button"
              onClick={handleEditOpen}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1.1rem',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--brand)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(9, 115, 55, 0.25)',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-dark, #065f2c)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand)'; }}
            >
              <Edit3 size={14} />
              Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--slate-200)',
                  background: 'var(--surface-muted)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--slate-100)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-muted)'; }}
              >
                <X size={14} />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1.1rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: isSaving ? 'var(--brand-muted, #6ee7a0)' : 'var(--brand)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-body)',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'var(--transition-fast)',
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                <Save size={14} />
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Alerts */}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* First Name / Middle Name / Last Name (Normal Typography) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>First Name</label>
              {isEditing ? (
                <input
                  value={editFirst}
                  onChange={(e) => setEditFirst(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                  placeholder="First name"
                  style={editableStyle}
                />
              ) : (
                <input value={toTitleCase(localUser.first_name)} readOnly disabled style={readonlyStyle} />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Middle Name</label>
              {isEditing ? (
                <input
                  value={editMiddle}
                  onChange={(e) => setEditMiddle(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                  placeholder="Middle name"
                  style={editableStyle}
                />
              ) : (
                <input value={toTitleCase(localUser.middle_name) || '—'} readOnly disabled style={readonlyStyle} />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Last Name</label>
              {isEditing ? (
                <input
                  value={editLast}
                  onChange={(e) => setEditLast(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                  placeholder="Last name"
                  style={editableStyle}
                />
              ) : (
                <input value={toTitleCase(localUser.last_name)} readOnly disabled style={readonlyStyle} />
              )}
            </div>
          </div>

          {/* Email (or LRN for students) / Member Since */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {localUser.role === 'student' ? 'Learner Reference Number (LRN)' : 'Email Address'}
              </label>
              <input
                type={localUser.role === 'student' ? 'text' : 'email'}
                value={localUser.role === 'student' ? (localUser.lrn || '—') : localUser.email}
                readOnly
                disabled
                style={readonlyStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Member Since
              </label>
              <input
                value={new Date(localUser.date_joined).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                readOnly
                disabled
                style={readonlyStyle}
              />
            </div>
          </div>

          {/* Tutor Academic Assignment: ARAL Level & Subject Assigned */}
          {localUser.role === 'tutor' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  ARAL Level Assigned
                </label>
                <input
                  value={formatAralLevel(localUser.aral_level)}
                  readOnly
                  disabled
                  style={readonlyStyle}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  ARAL Subject Assigned
                </label>
                <input
                  value={localUser.subject || 'Reading'}
                  readOnly
                  disabled
                  style={readonlyStyle}
                />
              </div>
            </div>
          )}

          {/* Student Academic Information */}
          {localUser.role === 'student' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  ARAL Level
                </label>
                <input
                  value={formatAralLevel(localUser.aral_level)}
                  readOnly
                  disabled
                  style={readonlyStyle}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Subject
                </label>
                <input
                  value={localUser.subject || 'Reading'}
                  readOnly
                  disabled
                  style={readonlyStyle}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {localUser.role === 'tutor' && (
        <section style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--slate-200)', padding: '2rem', boxShadow: 'var(--shadow-xs)' }}>
          <h2 style={{ margin: '0 0 1.25rem', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            ACCOUNT SECURITY
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-lg)', padding: '1.15rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>CHANGE PASSWORD</h3>
              <p style={{ margin: '0.35rem 0 0.85rem', fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>Your sign-in password is managed through your Google Account.</p>
              <SecurityHelpButton label="How to change password" description="Open your Google Account, select Security, then choose Password under “How you sign in to Google.”" />
            </div>
            <div style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-lg)', padding: '1.15rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>ENABLE 2-FACTOR AUTHENTICATION</h3>
              <p style={{ margin: '0.35rem 0 0.85rem', fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>Two-factor authentication is managed through your Google Account.</p>
              <SecurityHelpButton label="How to enable 2-factor authentication" description="Open your Google Account, select Security, then choose 2-Step Verification and follow the setup steps." />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
