import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { User, StudentEditRequest } from '../../types';
import { userService } from '../../services/userService';
import { buildTutorClassSections } from '../../utils/tutorCohortHelpers';
import {
  User as UserIcon,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Edit3,
  X,
  Save,
  Info,
  Clock,
  Send,
  Eye,
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
    <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-800 dark:text-white shadow-lg group-hover:block group-focus-within:block">
      {description}
    </span>
  </span>
);

export const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [localUser, setLocalUser] = useState<User | null>(user);

  const [assignedStudents, setAssignedStudents] = useState<User[]>([]);

  useEffect(() => {
    if (localUser?.role === 'tutor' && localUser.id) {
      userService
        .getAllUsers({ role: 'student', assigned_tutor: localUser.id })
        .then((res) => {
          if (Array.isArray(res)) setAssignedStudents(res);
        })
        .catch(() => {});
    }
  }, [localUser?.id, localUser?.role]);

  // Compute tutor assigned classes / role details handled
  const tutorAssignedClasses = useMemo(() => {
    if (localUser?.role !== 'tutor') return [];
    return buildTutorClassSections(localUser, assignedStudents);
  }, [localUser, assignedStudents]);

  // Staff direct editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editMiddle, setEditMiddle] = useState('');
  const [editLast, setEditLast] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Profile Edit Request States
  const [pendingEditRequest, setPendingEditRequest] = useState<StudentEditRequest | null>(null);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [studentEditError, setStudentEditError] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    lrn: '',
    aral_level: 'basic' as 'basic' | 'plus' | 'summer' | 'graduated',
    reason: '',
  });

  const fetchPendingRequest = useCallback(async () => {
    if (!user || user.is_superuser) return;
    try {
      const data = await userService.getStudentEditRequests({
        status: 'pending',
      });
      if (data.results && data.results.length > 0) {
        setPendingEditRequest(data.results[0]);
      } else {
        setPendingEditRequest(null);
      }
    } catch (err) {
      console.error('Failed to check pending profile edit requests', err);
    }
  }, [user]);

  useEffect(() => {
    setLocalUser(user);
    if (user && !user.is_superuser) {
      fetchPendingRequest();
    }
  }, [user, fetchPendingRequest]);

  // Edit handler: SuperAdmin edits directly; all other roles open the Profile Edit Request modal
  const handleEditOpen = () => {
    if (!localUser) return;
    if (localUser.is_superuser) {
      setEditFirst(toTitleCase(localUser.first_name));
      setEditMiddle(toTitleCase(localUser.middle_name));
      setEditLast(toTitleCase(localUser.last_name));
      setMessage(null);
      setError(null);
      setIsEditing(true);
      return;
    }

    if (pendingEditRequest) {
      setShowPendingModal(true);
      return;
    }
    setStudentForm({
      first_name: localUser.first_name || '',
      middle_name: localUser.middle_name || '',
      last_name: localUser.last_name || '',
      lrn: localUser.lrn || '',
      aral_level: (localUser.aral_level as any) || 'basic',
      reason: '',
    });
    setStudentEditError(null);
    setIsEditingStudent(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  // Direct profile update (SuperAdmin only)
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

  // Submit profile edit request (School Admin, Tutor, Faculty, Principal, Student)
  const handleStudentFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStudentEditError(null);
    setShowConfirmModal(true);
  };

  // Confirm and create profile edit request
  const handleConfirmSubmitRequest = async () => {
    if (!localUser) return;
    setIsSavingStudent(true);
    setStudentEditError(null);

    const isStudentRole = localUser.role === 'student';
    const isSchoolAdmin = localUser.role === 'admin';

    try {
      await userService.createStudentEditRequest({
        student: isStudentRole ? localUser.id : undefined,
        request_type: isStudentRole ? 'student' : 'staff',
        required_reviewer_role: isSchoolAdmin ? 'superadmin' : 'admin',
        proposed_first_name: studentForm.first_name.trim().toUpperCase(),
        proposed_middle_name: studentForm.middle_name.trim().toUpperCase(),
        proposed_last_name: studentForm.last_name.trim().toUpperCase(),
        proposed_lrn: isStudentRole ? (studentForm.lrn.trim() || null) : null,
        proposed_aral_level: isStudentRole ? studentForm.aral_level : undefined,
        reason: (studentForm.reason || '').trim(),
      });

      setShowConfirmModal(false);
      setIsEditingStudent(false);
      const targetReviewer = isSchoolAdmin ? 'Super Admin' : 'School Admin';
      setMessage(`Your profile edit request has been submitted for ${targetReviewer} review.`);
      await fetchPendingRequest();
    } catch (err: any) {
      setShowConfirmModal(false);
      const errData = err?.response?.data;
      let msg = 'Failed to submit profile edit request.';
      if (typeof errData === 'string') {
        msg = errData;
      } else if (errData?.detail) {
        msg = errData.detail;
      } else if (errData && typeof errData === 'object') {
        const entries = Object.entries(errData);
        if (entries.length > 0) {
          const [field, errors] = entries[0];
          const errText = Array.isArray(errors) ? errors[0] : String(errors);
          const fieldLabel = field.replace(/_/g, ' ');
          msg = `${fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1)}: ${errText}`;
        }
      }
      setStudentEditError(msg);
    } finally {
      setIsSavingStudent(false);
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
    width: '100%',
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--slate-200)',
    background: 'var(--surface-muted)',
    backgroundColor: 'var(--surface-muted)',
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

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── User Overview Header ── */}
      <div className="p-4 sm:p-6 md:p-8" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-5 text-center sm:text-left">
            <div
              className="flex items-center justify-center shrink-0 overflow-hidden rounded-2xl bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 mx-auto sm:mx-0"
              style={{
                width: '76px',
                height: '76px',
              }}
            >
              {localUser.avatar ? (
                <img src={localUser.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <UserIcon size={38} />
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
                {localUser.role === 'student' && (
                  <>
                    <span className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase">
                      {formatAralLevel(localUser.aral_level).toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-300 dark:text-slate-600">•</span>
                    <span className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase">
                      {localUser.subject === 'Reading' ? 'Filipino' : (localUser.subject || 'Filipino')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pending Edit Request Notification Banner (All non-superadmin roles) ── */}
      {!localUser.is_superuser && pendingEditRequest && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                PROFILE EDIT REQUEST PENDING REVIEW
              </h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                You have submitted profile changes on{' '}
                <span className="font-semibold">
                  {new Date(pendingEditRequest.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                . Your request has been forwarded to the {localUser.role === 'admin' ? 'Super Admin' : 'School Admin'} for review and approval.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPendingModal(true)}
            className="self-start sm:self-center shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            View Request Details
          </button>
        </div>
      )}

      {/* ── Profile Details Section ── */}
      <div className="p-4 sm:p-6 md:p-8" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-xs)' }}>

        {/* Card header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            PROFILE INFORMATION
          </h2>

          {!localUser.is_superuser ? (
            pendingEditRequest ? (
              <button
                type="button"
                onClick={() => setShowPendingModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold cursor-pointer transition hover:bg-amber-200"
              >
                <Clock className="w-3.5 h-3.5" />
                Edit Pending Approval
              </button>
            ) : (
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
                Request Profile Update
              </button>
            )
          ) : !isEditing ? (
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
              {isEditing && localUser.role !== 'student' ? (
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
              {isEditing && localUser.role !== 'student' ? (
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
              {isEditing && localUser.role !== 'student' ? (
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
              <div
                className="relative group cursor-not-allowed w-full"
                title={localUser.role !== 'student' ? 'Contact admin to change email' : undefined}
              >
                <input
                  type="text"
                  name="profile_email_readonly"
                  autoComplete="off"
                  value={localUser.role === 'student' ? (localUser.lrn || '—') : localUser.email}
                  readOnly
                  disabled
                  tabIndex={-1}
                  style={readonlyStyle}
                  className="w-full pointer-events-none select-none"
                />

                {localUser.role !== 'student' && (
                  <div className="pointer-events-none absolute bottom-full left-3 mb-2 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 dark:bg-zinc-800 text-white text-xs font-semibold shadow-xl border border-slate-700/60 dark:border-zinc-700 whitespace-nowrap z-30 transition-all animate-in fade-in duration-150">
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Contact admin to change email</span>
                    <div className="absolute top-full left-6 -mt-1 border-4 border-transparent border-t-slate-900/95 dark:border-t-zinc-800" />
                  </div>
                )}
              </div>
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

          {/* Tutor Role Details & Handled Classes */}
          {localUser.role === 'tutor' && (
            <div className="mt-2 pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    ASSIGNED CLASSES
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                    Official ARAL program classes, subjects, and grade sections handled
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tutorAssignedClasses.map((cls, idx) => {
                  const isPlus = cls.aralLevel === 'plus';

                  return (
                    <div
                      key={cls.key || idx}
                      className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Role Detail #{idx + 1}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                            isPlus
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {cls.aralLevel.toUpperCase()}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-gray-900 dark:text-white pb-2.5 border-b border-slate-200/60 dark:border-zinc-800/80">
                        {cls.label}
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
                            Subject
                          </span>
                          <span className="font-semibold text-gray-800 dark:text-slate-200 text-right">
                            {cls.subject}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
                            Grade & Section
                          </span>
                          <span className="font-semibold text-gray-800 dark:text-slate-200 text-right">
                            {cls.cohort}
                          </span>
                        </div>
                        {cls.students && cls.students.length > 0 && (
                          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/50 dark:border-zinc-800/60 text-[11px]">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
                              Assigned Students
                            </span>
                            <span className="font-bold text-gray-800 dark:text-slate-200">
                              {cls.students.length}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                  value={localUser.subject === 'Reading' ? 'Filipino' : (localUser.subject || 'Filipino')}
                  readOnly
                  disabled
                  style={readonlyStyle}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {localUser.role !== 'student' && (
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

      {/* ── STUDENT EDIT REQUEST MODAL ─────────────────────────────── */}
      {isEditingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleStudentFormSubmit} className="bg-white dark:bg-[#0A0A0A] rounded-3xl p-6 max-w-lg w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A] pb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg uppercase">
                  REQUEST PROFILE UPDATE
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingStudent(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {studentEditError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{studentEditError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Proposed First Name *</label>
                <input
                  type="text"
                  required
                  value={studentForm.first_name}
                  onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })}
                  placeholder="e.g. JUAN"
                  className="w-full px-3.5 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-xl text-sm bg-gray-50 dark:bg-[#111111] text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] uppercase font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Proposed Middle Name</label>
                <input
                  type="text"
                  value={studentForm.middle_name}
                  onChange={(e) => setStudentForm({ ...studentForm, middle_name: e.target.value })}
                  placeholder="e.g. PROTACIO"
                  className="w-full px-3.5 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-xl text-sm bg-gray-50 dark:bg-[#111111] text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] uppercase font-semibold"
                />
              </div>
            </div>

            <div className={`grid grid-cols-1 ${localUser.role === 'student' ? 'sm:grid-cols-2' : ''} gap-3.5`}>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Proposed Last Name *</label>
                <input
                  type="text"
                  required
                  value={studentForm.last_name}
                  onChange={(e) => setStudentForm({ ...studentForm, last_name: e.target.value })}
                  placeholder="e.g. DELA CRUZ"
                  className="w-full px-3.5 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-xl text-sm bg-gray-50 dark:bg-[#111111] text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] uppercase font-semibold"
                />
              </div>

              {localUser.role === 'student' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Proposed LRN (12 digits)</label>
                  <input
                    type="text"
                    maxLength={12}
                    value={studentForm.lrn}
                    onChange={(e) => setStudentForm({ ...studentForm, lrn: e.target.value.replace(/\D/g, '') })}
                    placeholder="12-digit number"
                    className="w-full px-3.5 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-xl text-sm bg-gray-50 dark:bg-[#111111] text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] font-mono font-bold"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
              <button
                type="button"
                onClick={() => setIsEditingStudent(false)}
                className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer shadow-sm transition-all inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Request for Approval
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CONFIRMATION MODAL BEFORE SUBMISSION ───────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl p-6 max-w-sm w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4 animate-fade-in-scale">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                Confirm Edit Request Submission
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-slate-400">
                Are you sure you want to submit this profile change request? Your proposed details will be sent to the <span className="font-bold text-gray-700 dark:text-slate-300">School Admin</span> and <span className="font-bold text-gray-700 dark:text-slate-300">Super Admin</span> for confirmation and review.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSavingStudent}
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-4 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingStudent}
                onClick={handleConfirmSubmitRequest}
                className="rounded-xl bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--brand-dark)] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isSavingStudent ? 'Submitting...' : 'Yes, Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PENDING REQUEST DETAILS MODAL ──────────────────────────── */}
      {showPendingModal && pendingEditRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl p-6 max-w-md w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base">Edit Request Pending</h3>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">Awaiting Admin or Super Admin review</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPendingModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-[#111111] p-3.5 rounded-2xl border border-slate-200 dark:border-[#1A1A1A] space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400 font-medium">Submitted On:</span>
                  <span className="font-semibold text-gray-800 dark:text-slate-200">
                    {new Date(pendingEditRequest.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400 font-medium">Status:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    Pending Approval
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-700 dark:text-slate-300 text-xs">Proposed Changes:</h4>
                <div className="bg-gray-50 dark:bg-[#111111] p-3 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] space-y-1.5 font-mono text-[11px]">
                  <p className="text-gray-700 dark:text-slate-300">
                    <span className="text-gray-400 dark:text-slate-500 font-sans">Name: </span>
                    {pendingEditRequest.proposed_last_name}, {pendingEditRequest.proposed_first_name} {pendingEditRequest.proposed_middle_name || ''}
                  </p>
                  <p className="text-gray-700 dark:text-slate-300">
                    <span className="text-gray-400 dark:text-slate-500 font-sans">LRN: </span>
                    {pendingEditRequest.proposed_lrn || 'Unchanged'}
                  </p>
                  <p className="text-gray-700 dark:text-slate-300">
                    <span className="text-gray-400 dark:text-slate-500 font-sans">ARAL Level: </span>
                    {pendingEditRequest.proposed_aral_level ? formatAralLevel(pendingEditRequest.proposed_aral_level) : 'Unchanged'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-gray-700 dark:text-slate-300 text-xs">Reason:</h4>
                <p className="text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-[#111111] p-2.5 rounded-xl border border-gray-100 dark:border-[#1A1A1A] text-xs leading-relaxed italic">
                  "{pendingEditRequest.reason}"
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPendingModal(false)}
                className="bg-gray-100 dark:bg-[#141414] hover:bg-gray-200 dark:hover:bg-[#1f1f1f] text-gray-700 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
