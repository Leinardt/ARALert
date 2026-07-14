import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../hooks/useAuth';
import {
  Eye, EyeOff, AlertCircle, Shield, GraduationCap,
  ArrowLeft, BookOpen, Mail, Lock, User, Hash,
} from 'lucide-react';

// ── Schemas ──────────────────────────────────────────────
const staffLoginSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Username or Email is required.'),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean(),
});
type StaffLoginFields = z.infer<typeof staffLoginSchema>;

const studentLoginSchema = z.object({
  fullName: z.string().min(1, 'Full Name is required.'),
  lrn: z.string()
    .min(1, 'LRN is required.')
    .regex(/^\d{12}$/, 'LRN must be exactly 12 digits.'),
});
type StudentLoginFields = z.infer<typeof studentLoginSchema>;

// ── Login type enum ──────────────────────────────────────
type LoginType = 'select' | 'staff' | 'student';

// ── Component ────────────────────────────────────────────
export const Login: React.FC = () => {
  const { login, studentLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loginType, setLoginType] = useState<LoginType>('select');
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSessionExpired = searchParams.get('expired') === 'true';

  // Staff form
  const staffForm = useForm<StaffLoginFields>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: { usernameOrEmail: '', password: '', rememberMe: false },
  });

  // Student form
  const studentForm = useForm<StudentLoginFields>({
    resolver: zodResolver(studentLoginSchema),
    defaultValues: { fullName: '', lrn: '' },
  });

  const onStaffSubmit = async (data: StaffLoginFields) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const response = await login(data.usernameOrEmail, data.password, data.rememberMe);
      navigate(response.redirect);
    } catch (error: any) {
      const errorsPayload = error.response?.data?.errors;
      if (errorsPayload?.detail) {
        setServerError(errorsPayload.detail);
      } else if (errorsPayload?.non_field_errors) {
        setServerError(errorsPayload.non_field_errors[0]);
      } else if (typeof errorsPayload === 'object') {
        const errorMsg = Object.values(errorsPayload).flat().join(' ');
        setServerError(errorMsg || 'Failed to authenticate. Please check your credentials.');
      } else {
        setServerError('Authentication failed. Server might be offline.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onStudentSubmit = async (data: StudentLoginFields) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const response = await studentLogin(data.fullName, data.lrn);
      navigate(response.redirect);
    } catch (error: any) {
      const errorsPayload = error.response?.data?.errors;
      if (errorsPayload?.detail) {
        setServerError(errorsPayload.detail);
      } else if (errorsPayload?.non_field_errors) {
        setServerError(errorsPayload.non_field_errors[0]);
      } else if (typeof errorsPayload === 'object') {
        const errorMsg = Object.values(errorsPayload).flat().join(' ');
        setServerError(errorMsg || 'Invalid Full Name or LRN.');
      } else {
        setServerError('Authentication failed. Server might be offline.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setLoginType('select');
    setServerError(null);
    setShowPassword(false);
    staffForm.reset();
    studentForm.reset();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f7f5' }}>
      {/* ── Top Navigation ──────────────────────────── */}
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
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#2E7D32',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '18px',
              boxShadow: '0 2px 8px rgba(46,125,50,0.3)',
            }}>A</div>
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
            <div style={{
              background: '#2E7D32',
              color: '#fff',
              padding: '8px 20px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(46,125,50,0.25)',
              cursor: 'default',
            }}>Sign In</div>
          </nav>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────── */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: loginType === 'select' ? '640px' : '440px',
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

          {/* ── Card ──────────────────────────────── */}
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
                background: loginType === 'student' ? '#e8f5e9' : loginType === 'staff' ? '#e8f5e9' : '#e8f5e9',
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
                {loginType === 'staff' && 'Staff Login'}
                {loginType === 'student' && 'Student Login'}
              </h1>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: '0 0 24px',
              }}>
                {loginType === 'select' && 'Select your login type to continue.'}
                {loginType === 'staff' && 'Sign in using your registered email and password.'}
                {loginType === 'student' && 'Sign in using your Full Name and Learner Reference Number.'}
              </p>
            </div>

            {/* Card Body */}
            <div style={{ padding: '0 32px 32px' }}>

              {/* ── Selection Cards ───────────────── */}
              {loginType === 'select' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Staff Login Card */}
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
                        Staff Login
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                        For Super Admin, Admin, Faculty, and Tutor. Sign in using your registered email address and password.
                      </div>
                    </div>
                  </button>

                  {/* Student Login Card */}
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
                        For enrolled students. Sign in using your Full Name and Learner Reference Number (LRN).
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* ── Staff Login Form ─────────────── */}
              {loginType === 'staff' && (
                <form onSubmit={staffForm.handleSubmit(onStaffSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Email / Username */}
                  <div>
                    <label htmlFor="usernameOrEmail" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Username or Email
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#9ca3af' }} />
                      <input
                        id="usernameOrEmail"
                        type="text"
                        placeholder="Enter your username or email"
                        {...staffForm.register('usernameOrEmail')}
                        style={{
                          width: '100%',
                          padding: '12px 14px 12px 42px',
                          border: `1.5px solid ${staffForm.formState.errors.usernameOrEmail ? '#fca5a5' : '#d1d5db'}`,
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
                          e.currentTarget.style.borderColor = staffForm.formState.errors.usernameOrEmail ? '#fca5a5' : '#d1d5db';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.background = '#fafafa';
                        }}
                      />
                    </div>
                    {staffForm.formState.errors.usernameOrEmail && (
                      <p style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{staffForm.formState.errors.usernameOrEmail.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#9ca3af' }} />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        {...staffForm.register('password')}
                        style={{
                          width: '100%',
                          padding: '12px 44px 12px 42px',
                          border: `1.5px solid ${staffForm.formState.errors.password ? '#fca5a5' : '#d1d5db'}`,
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
                          e.currentTarget.style.borderColor = staffForm.formState.errors.password ? '#fca5a5' : '#d1d5db';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.background = '#fafafa';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '14px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#9ca3af',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {showPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                      </button>
                    </div>
                    {staffForm.formState.errors.password && (
                      <p style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{staffForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  {/* Remember me & Forgot password */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                      <input
                        type="checkbox"
                        {...staffForm.register('rememberMe')}
                        style={{
                          width: '16px',
                          height: '16px',
                          accentColor: '#2E7D32',
                          cursor: 'pointer',
                        }}
                      />
                      Remember me
                    </label>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); alert('Password recovery coming soon.'); }}
                      style={{ fontSize: '13px', color: '#2E7D32', textDecoration: 'none', fontWeight: 500 }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      Forgot password?
                    </a>
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
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting) e.currentTarget.style.background = '#1b5e20';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubmitting) e.currentTarget.style.background = '#2E7D32';
                    }}
                  >
                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              )}

              {/* ── Student Login Form ────────────── */}
              {loginType === 'student' && (
                <form onSubmit={studentForm.handleSubmit(onStudentSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Full Name */}
                  <div>
                    <label htmlFor="fullName" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Full Name
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#9ca3af' }} />
                      <input
                        id="fullName"
                        type="text"
                        placeholder="e.g. Juan Dela Cruz"
                        {...studentForm.register('fullName')}
                        style={{
                          width: '100%',
                          padding: '12px 14px 12px 42px',
                          border: `1.5px solid ${studentForm.formState.errors.fullName ? '#fca5a5' : '#d1d5db'}`,
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
                          e.currentTarget.style.borderColor = studentForm.formState.errors.fullName ? '#fca5a5' : '#d1d5db';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.background = '#fafafa';
                        }}
                      />
                    </div>
                    {studentForm.formState.errors.fullName && (
                      <p style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{studentForm.formState.errors.fullName.message}</p>
                    )}
                  </div>

                  {/* LRN */}
                  <div>
                    <label htmlFor="lrn" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Learner Reference Number (LRN)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Hash style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#9ca3af' }} />
                      <input
                        id="lrn"
                        type="text"
                        placeholder="e.g. 123456789012"
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
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmitting) e.currentTarget.style.background = '#1b5e20';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubmitting) e.currentTarget.style.background = '#2E7D32';
                    }}
                  >
                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>
              )}
            </div>

            {/* ── Bottom Section (Divider + Links) ── */}
            <div style={{
              borderTop: '1px solid #f3f4f6',
              padding: '24px 32px',
              background: '#fafbfa',
            }}>
              {/* OR divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '16px',
              }}>
                <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
              </div>

              {/* Help links */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '24px',
                flexWrap: 'wrap',
              }}>
                {['Contact Administrator', 'User Guide', 'Privacy Policy'].map((link) => (
                  <a
                    key={link}
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      textDecoration: 'none',
                      fontWeight: 500,
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#2E7D32'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
                  >{link}</a>
                ))}
              </div>
            </div>
          </div>

          {/* Agreement text */}
          <p style={{
            textAlign: 'center',
            fontSize: '12px',
            color: '#9ca3af',
            marginTop: '20px',
            lineHeight: '1.6',
          }}>
            By continuing, you agree to the ARALert{' '}
            <a href="#" onClick={(e) => e.preventDefault()} style={{ color: '#2E7D32', textDecoration: 'none', fontWeight: 500 }}>Terms of Service</a>
            {' '}and{' '}
            <a href="#" onClick={(e) => e.preventDefault()} style={{ color: '#2E7D32', textDecoration: 'none', fontWeight: 500 }}>Privacy Policy</a>.
          </p>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────── */}
      <footer style={{
        background: '#1a1a1a',
        padding: '20px 24px',
        borderTop: '1px solid #333',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: '#2E7D32',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '12px',
            }}>A</div>
            <span style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>ARALert</span>
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280' }}>
            &copy; {new Date().getFullYear()} ARALert Student Performance Monitoring. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};
