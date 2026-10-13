import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { ArrowLeft, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const NAME_REGEX = /^[a-zA-Z\s.\-ñÑ']+$/;
const SECTION_REGEX = /^[a-zA-Z0-9\s\-]+$/;
const PHONE_REGEX = /^\d{11}$/;
const LRN_REGEX = /^\d{12}$/;
const DANGEROUS_INJECTION_PATTERN = /(--|;|\/\*|\*\/|@@|char|nchar|varchar|nvarchar|alter|begin|cast|create|cursor|declare|delete|drop|end|exec|execute|fetch|insert|kill|open|select|sys|sysobjects|syscolumns|table|update|<script|<\/script>)/i;

const editUserSchema = z.object({
  first_name: z.string()
    .min(1, 'First Name is required.')
    .max(100, 'First Name must not exceed 100 characters.')
    .refine((v) => NAME_REGEX.test(v), 'First Name can only contain letters, spaces, hyphens, and periods.')
    .refine((v) => !DANGEROUS_INJECTION_PATTERN.test(v), 'Invalid characters detected.'),
  middle_name: z.string()
    .max(100, 'Middle Name must not exceed 100 characters.')
    .optional()
    .refine((v) => !v || NAME_REGEX.test(v), 'Middle Name can only contain letters, spaces, hyphens, and periods.')
    .refine((v) => !v || !DANGEROUS_INJECTION_PATTERN.test(v), 'Invalid characters detected.'),
  last_name: z.string()
    .min(1, 'Last Name is required.')
    .max(100, 'Last Name must not exceed 100 characters.')
    .refine((v) => NAME_REGEX.test(v), 'Last Name can only contain letters, spaces, hyphens, and periods.')
    .refine((v) => !DANGEROUS_INJECTION_PATTERN.test(v), 'Invalid characters detected.'),
  email: z.string().optional(),
  role: z.enum(['admin', 'principal', 'faculty', 'tutor', 'student'], {
    message: 'Please select a valid role.',
  }),
  lrn: z.string().optional(),
  grade_level_grade: z.string().optional(),
  grade_level_section: z.string()
    .max(50, 'Section must not exceed 50 characters.')
    .optional()
    .refine((v) => !v || SECTION_REGEX.test(v), 'Section can only contain letters, numbers, hyphens, and spaces.')
    .refine((v) => !v || !DANGEROUS_INJECTION_PATTERN.test(v), 'Invalid characters detected.'),
  is_active: z.boolean(),
  assigned_tutor: z.string().optional().nullable(),
  aral_level: z.string().optional(),
  subject: z.string().optional(),
  parent_guardian_name: z.string()
    .max(200, 'Parent/Guardian Name must not exceed 200 characters.')
    .optional()
    .refine((v) => !v || NAME_REGEX.test(v), 'Parent / Guardian Name can only contain letters, spaces, hyphens, and periods.')
    .refine((v) => !v || !DANGEROUS_INJECTION_PATTERN.test(v), 'Invalid characters detected.'),
  contact_number: z.string()
    .max(11, 'Contact Number must be exactly 11 digits.')
    .optional()
    .refine((v) => !v || PHONE_REGEX.test(v), 'Contact Number must be exactly 11 digits (e.g. 09123456789).')
    .refine((v) => !v || !DANGEROUS_INJECTION_PATTERN.test(v), 'Invalid characters detected.'),
  has_bosy: z.boolean().optional(),
  has_mosy: z.boolean().optional(),
  has_eosy: z.boolean().optional(),
  has_summer: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'student' || data.role === 'tutor') {
    if (!data.grade_level_section || !data.grade_level_section.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Assigned section is required.',
        path: ['grade_level_section'],
      });
    }
  }
  if (data.role === 'student') {
    if (!data.lrn || !LRN_REGEX.test(data.lrn)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'LRN must be exactly 12 digits (numbers only).',
        path: ['lrn'],
      });
    }
    if (!data.parent_guardian_name || !data.parent_guardian_name.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Parent / Guardian Name is required.',
        path: ['parent_guardian_name'],
      });
    }
    if (!data.contact_number || !data.contact_number.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Contact Number is required.',
        path: ['contact_number'],
      });
    }
  }
});

type EditUserFields = z.infer<typeof editUserSchema>;

export const EditUser: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tutors, setTutors] = useState<User[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EditUserFields>({
    resolver: zodResolver(editUserSchema),
  });

  const selectedRole = watch('role');

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const [userData, tutorsData] = await Promise.all([
          userService.getUser(id),
          userService.getTutors(),
        ]);

        if (!currentUser?.is_superuser && (userData.role === 'admin' || userData.is_superuser)) {
          setFetchError('School Administrators cannot view or edit Administrator or SuperAdmin accounts. This action is restricted to SuperAdmin.');
          setIsLoading(false);
          return;
        }

        let initialGrade = 'GRADE 7';
        let initialSection = '';
        if (userData.grade_level) {
          const parts = userData.grade_level.split(' - ');
          if (parts.length >= 2) {
            const g = parts[0].trim().toUpperCase();
            initialGrade = g.startsWith('GRADE') ? g : `GRADE ${g}`;
            initialSection = parts.slice(1).join(' - ').trim().toUpperCase();
          } else {
            const g = userData.grade_level.trim().toUpperCase();
            if (['GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10'].includes(g)) {
              initialGrade = g;
            } else if (['7', '8', '9', '10'].includes(g)) {
              initialGrade = `GRADE ${g}`;
            } else {
              initialSection = g;
            }
          }
        }

        setTutors(tutorsData);
        reset({
          first_name: userData.first_name,
          middle_name: userData.middle_name || '',
          last_name: userData.last_name,
          email: userData.email,
          role: userData.role as EditUserFields['role'],
          lrn: userData.lrn || '',
          grade_level_grade: initialGrade,
          grade_level_section: initialSection,
          is_active: userData.is_active,
          assigned_tutor: userData.assigned_tutor || '',
          aral_level: userData.aral_level || 'basic',
          subject: userData.subject || 'Reading',
          parent_guardian_name: userData.parent_guardian_name || '',
          contact_number: userData.contact_number || '',
          has_bosy: userData.has_bosy ?? true,
          has_mosy: userData.has_mosy ?? false,
          has_eosy: userData.has_eosy ?? false,
          has_summer: userData.has_summer ?? false,
        });
      } catch (err) {
        console.error(err);
        setFetchError('User account not found or could not be loaded.');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [id, reset, currentUser]);

  const onSubmit = async (data: EditUserFields) => {
    if (!id) return;
    setIsSubmitting(true);
    setServerErrors(null);
    try {
      const sectionStr = data.grade_level_section ? data.grade_level_section.toUpperCase().trim() : '';
      const gradeStr = data.grade_level_grade ? data.grade_level_grade.toUpperCase().trim() : 'GRADE 7';
      const combinedGradeLevel = (data.role === 'student' || data.role === 'tutor')
        ? (sectionStr ? `${gradeStr} - ${sectionStr}` : gradeStr)
        : '';

      const payload: any = {
        ...data,
        first_name: data.first_name.toUpperCase().trim(),
        middle_name: data.middle_name ? data.middle_name.toUpperCase().trim() : '',
        last_name: data.last_name.toUpperCase().trim(),
        parent_guardian_name: data.parent_guardian_name ? data.parent_guardian_name.toUpperCase().trim() : '',
        contact_number: data.contact_number ? data.contact_number.trim() : '',
        grade_level: combinedGradeLevel,
        has_bosy: !!data.has_bosy,
        has_mosy: !!data.has_mosy,
        has_eosy: !!data.has_eosy,
        has_summer: !!data.has_summer,
        assigned_tutor: data.role === 'student' && data.assigned_tutor ? data.assigned_tutor : null,
        subject: data.role === 'student' || data.role === 'tutor' ? data.subject || 'Reading' : null,
      };

      await userService.updateUser(id, payload);
      const getBackPath = () => {
        if (currentUser?.is_superuser) {
          if (data.role === 'student') return '/superadmin/students';
          if (data.role === 'tutor') return '/superadmin/tutors';
          if (data.role === 'faculty') return '/superadmin/faculty';
          if (data.role === 'principal') return '/superadmin/principals';
          if (data.role === 'admin') return '/superadmin/admins';
          return '/superadmin/superadmins';
        }
        if (data.role === 'principal') return '/admin/principals';
        if (data.role === 'faculty') return '/admin/faculty';
        if (data.role === 'tutor') return '/admin/tutors';
        return '/admin/students';
      };
      navigate(getBackPath());
    } catch (error: any) {
      console.error(error);
      const errorsPayload = error.response?.data;
      if (errorsPayload && typeof errorsPayload === 'object') {
        setServerErrors(errorsPayload);
      } else {
        alert('An unexpected error occurred while updating user.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-4">
        <Link
          to={currentUser?.is_superuser ? '/superadmin/users' : '/admin/students'}
          className="text-gray-500 hover:text-[var(--brand)] inline-flex items-center text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to {currentUser?.is_superuser || currentUser?.role === 'admin' ? 'User Management' : 'Student Directory'}
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">{fetchError}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <Link
        to={
          currentUser?.is_superuser
            ? selectedRole === 'student' ? '/superadmin/students'
            : selectedRole === 'tutor' ? '/superadmin/tutors'
            : selectedRole === 'faculty' ? '/superadmin/faculty'
            : selectedRole === 'principal' ? '/superadmin/principals'
            : selectedRole === 'admin' ? '/superadmin/admins'
            : '/superadmin/users'
            : selectedRole === 'admin' ? '/admin/admins'
            : selectedRole === 'principal' ? '/admin/principals'
            : selectedRole === 'faculty' ? '/admin/faculty'
            : selectedRole === 'tutor' ? '/admin/tutors'
            : '/admin/students'
        }
        className="text-slate-500 hover:text-blue-700 inline-flex items-center text-xs font-semibold transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
        Back to {selectedRole ? `${selectedRole.toUpperCase()} Directory` : 'User Management'}
      </Link>

      <div className="bg-white dark:bg-[#0A0A0A] p-8 sm:p-10 rounded-2xl border border-slate-200 dark:border-[#1A1A1A] shadow-md">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase mb-6">
          {selectedRole ? `Edit ${selectedRole.toUpperCase()} Profile` : 'Edit User Record'}
        </h2>

        {serverErrors?.detail && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md p-3 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{Array.isArray(serverErrors.detail) ? serverErrors.detail[0] : serverErrors.detail}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Section 1: Personal Information ─────────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
              Personal Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="first_name"
                  type="text"
                  placeholder="e.g. JUAN"
                  {...register('first_name')}
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z\s.\-ñÑ']/g, '');
                  }}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs uppercase dark:bg-[#111111] dark:text-slate-100 ${
                    errors.first_name || serverErrors?.first_name ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                  }`}
                />
                {(errors.first_name || serverErrors?.first_name) && (
                  <p className="mt-1 text-xs text-red-600">{errors.first_name?.message || serverErrors?.first_name?.[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="middle_name" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Middle Name <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  id="middle_name"
                  type="text"
                  placeholder="e.g. SANTOS"
                  {...register('middle_name')}
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z\s.\-ñÑ']/g, '');
                  }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#1A1A1A] rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs uppercase dark:bg-[#111111] dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="last_name" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="last_name"
                  type="text"
                  placeholder="e.g. DELA CRUZ"
                  {...register('last_name')}
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z\s.\-ñÑ']/g, '');
                  }}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs uppercase dark:bg-[#111111] dark:text-slate-100 ${
                    errors.last_name || serverErrors?.last_name ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                  }`}
                />
                {(errors.last_name || serverErrors?.last_name) && (
                  <p className="mt-1 text-xs text-red-600">{errors.last_name?.message || serverErrors?.last_name?.[0]}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 2: Staff Email (for non-students) ───────────────── */}
          {selectedRole !== 'student' && (
            <div className="space-y-3 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                Authentication &amp; Role Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Google Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="e.g. user@bicol-u.edu.ph"
                    {...register('email')}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs dark:bg-[#111111] dark:text-slate-100 ${
                      errors.email || serverErrors?.email ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                    }`}
                  />
                  {(errors.email || serverErrors?.email) && (
                    <p className="mt-1 text-xs text-red-600">{errors.email?.message || serverErrors?.email?.[0]}</p>
                  )}
                </div>

                {selectedRole === 'tutor' && (
                  <>
                    <div>
                      <label htmlFor="aral_level" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                        ARAL Level <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="aral_level"
                        {...register('aral_level')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#1A1A1A] rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs bg-white dark:bg-[#111111] dark:text-slate-100 font-medium"
                      >
                        <option value="basic">ARAL Basic</option>
                        <option value="plus">ARAL Plus</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="subject" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                        Assigned Subject <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="subject"
                        {...register('subject')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#1A1A1A] rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs bg-white dark:bg-[#111111] dark:text-slate-100 font-medium"
                      >
                        <option value="Reading">Reading</option>
                        <option value="Science">Science</option>
                        <option value="Math">Math</option>
                        <option value="English">English</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="tutor_grade_level_grade" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                        Assigned Grade Level <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="tutor_grade_level_grade"
                        {...register('grade_level_grade')}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs font-semibold uppercase dark:text-slate-100"
                      >
                        <option value="GRADE 7">GRADE 7</option>
                        <option value="GRADE 8">GRADE 8</option>
                        <option value="GRADE 9">GRADE 9</option>
                        <option value="GRADE 10">GRADE 10</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="tutor_grade_level_section" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                        Assigned Section <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="tutor_grade_level_section"
                        type="text"
                        placeholder="e.g. HYACINTH"
                        {...register('grade_level_section')}
                        onInput={(e) => {
                          e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z0-9\s\-]/g, '');
                        }}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs font-medium uppercase dark:bg-[#111111] dark:text-slate-100 ${
                          errors.grade_level_section || serverErrors?.grade_level_section ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                        }`}
                      />
                      {(errors.grade_level_section || serverErrors?.grade_level_section) && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {errors.grade_level_section?.message || serverErrors?.grade_level_section?.[0]}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Section 3: Student Academic & ARAL Enrollment Details ───── */}
          {selectedRole === 'student' && (
            <div className="space-y-4 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                ARAL Academic &amp; Tutor Assignment
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="lrn" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Learner Reference Number (LRN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lrn"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={12}
                    placeholder="12-digit LRN"
                    {...register('lrn')}
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 12);
                    }}
                    onKeyDown={(e) => {
                      if (
                        !/[0-9]/.test(e.key) &&
                        !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key) &&
                        !e.ctrlKey &&
                        !e.metaKey
                      ) {
                        e.preventDefault();
                      }
                    }}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs font-mono font-bold dark:bg-[#111111] dark:text-slate-100 ${
                      errors.lrn || serverErrors?.lrn ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                    }`}
                  />
                  {(errors.lrn || serverErrors?.lrn) && (
                    <p className="mt-1 text-xs text-red-600">{errors.lrn?.message || serverErrors?.lrn?.[0]}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="grade_level_grade" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Grade Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="grade_level_grade"
                    {...register('grade_level_grade')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#1A1A1A] rounded-md shadow-sm focus:border-[var(--brand)] focus:outline-none focus:ring-[var(--brand)] text-xs uppercase font-semibold bg-white dark:bg-[#111111] dark:text-slate-100"
                  >
                    <option value="GRADE 7">GRADE 7</option>
                    <option value="GRADE 8">GRADE 8</option>
                    <option value="GRADE 9">GRADE 9</option>
                    <option value="GRADE 10">GRADE 10</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="grade_level_section" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Section <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="grade_level_section"
                    type="text"
                    placeholder="e.g. HYACINTH"
                    {...register('grade_level_section')}
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z0-9\s\-]/g, '');
                    }}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs uppercase bg-white dark:bg-[#111111] dark:text-slate-100 ${
                      errors.grade_level_section || serverErrors?.grade_level_section ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                    }`}
                  />
                  {(errors.grade_level_section || serverErrors?.grade_level_section) && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {errors.grade_level_section?.message || serverErrors?.grade_level_section?.[0]}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="student_aral_level_edit" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    ARAL Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="student_aral_level_edit"
                    {...register('aral_level')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#1A1A1A] rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs bg-white dark:bg-[#111111] dark:text-slate-100 font-medium cursor-pointer"
                  >
                    <option value="basic">ARAL Basic</option>
                    <option value="plus">ARAL Plus</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="student_subject_edit" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Subject Focus <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="student_subject_edit"
                    {...register('subject')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#1A1A1A] rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs bg-white dark:bg-[#111111] dark:text-slate-100 font-medium cursor-pointer"
                  >
                    <option value="Reading">READING</option>
                    <option value="Math">MATH</option>
                    <option value="Science">SCIENCE</option>
                    <option value="English">ENGLISH</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="assigned_tutor" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Assigned Tutor
                  </label>
                  <select
                    id="assigned_tutor"
                    {...register('assigned_tutor')}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs bg-white dark:bg-[#111111] dark:text-slate-100 cursor-pointer ${
                      errors.assigned_tutor || serverErrors?.assigned_tutor ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                    }`}
                  >
                    <option value="">To Be Assigned (TBA)</option>
                    {tutors.map((tutor) => (
                      <option key={tutor.id} value={tutor.id}>
                        {tutor.full_name || `${tutor.first_name} ${tutor.last_name}`} ({tutor.email})
                      </option>
                    ))}
                  </select>
                  {(errors.assigned_tutor || serverErrors?.assigned_tutor) && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {errors.assigned_tutor?.message || serverErrors?.assigned_tutor?.[0]}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Section 4: Parent / Guardian & Contact ──────────────────── */}
              <div className="space-y-3 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                  Additional Information &amp; Contact
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="parent_guardian_name" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                      Parent / Guardian Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="parent_guardian_name"
                      type="text"
                      placeholder="e.g. JUANITO A. DELA CRUZ"
                      {...register('parent_guardian_name')}
                      onInput={(e) => {
                        e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z\s.\-ñÑ']/g, '');
                      }}
                      className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs uppercase bg-white dark:bg-[#111111] dark:text-slate-100 ${
                        errors.parent_guardian_name || serverErrors?.parent_guardian_name ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                      }`}
                    />
                    {(errors.parent_guardian_name || serverErrors?.parent_guardian_name) && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {errors.parent_guardian_name?.message || serverErrors?.parent_guardian_name?.[0]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contact_number" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                      Contact Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact_number"
                      type="text"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="e.g. 09552040068"
                      {...register('contact_number')}
                      onInput={(e) => {
                        e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 11);
                      }}
                      className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs bg-white dark:bg-[#111111] dark:text-slate-100 ${
                        errors.contact_number || serverErrors?.contact_number ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                      }`}
                    />
                    {(errors.contact_number || serverErrors?.contact_number) && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {errors.contact_number?.message || serverErrors?.contact_number?.[0]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {watch('email')?.trim().toLowerCase() === 'ro2023-4992-68567@bicol-u.edu.ph' ? (
            <div className="flex items-center pt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4 mr-1.5 shrink-0" />
              <span>Primary Root SuperAdmin (Account Status Protected)</span>
            </div>
          ) : (
            <div className="flex items-center pt-2">
              <input id="is_active" type="checkbox" {...register('is_active')}
                className="h-4 w-4 text-[var(--brand)] focus:ring-[var(--brand)] border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="is_active" className="ml-2 block text-xs font-semibold text-gray-900 dark:text-slate-200 cursor-pointer">
                Account Status (Active)
              </label>
            </div>
          )}

          <div className="flex justify-end pt-4 space-x-3">
            <Link to={currentUser?.is_superuser ? `/superadmin/users?role=${selectedRole}` : '/admin/students'}
              className="bg-white dark:bg-[#111111] border border-gray-300 dark:border-[#1A1A1A] text-gray-700 dark:text-slate-300 px-4 py-2 rounded-md text-xs font-semibold hover:bg-gray-50 transition-colors"
            >Cancel</Link>
            <button type="submit" disabled={isSubmitting}
              className="bg-[var(--brand)] text-white px-5 py-2 rounded-md text-xs font-bold uppercase tracking-wider hover:bg-[var(--brand-dark)] shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
            >{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUser;
