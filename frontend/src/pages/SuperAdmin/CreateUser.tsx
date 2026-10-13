import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const NAME_REGEX = /^[a-zA-Z\s.\-ñÑ']+$/;
const SECTION_REGEX = /^[a-zA-Z0-9\s\-]+$/;
const PHONE_REGEX = /^[0-9+\-\s()]+$/;
const LRN_REGEX = /^\d{12}$/;
const DANGEROUS_INJECTION_PATTERN = /(--|;|\/\*|\*\/|@@|char|nchar|varchar|nvarchar|alter|begin|cast|create|cursor|declare|delete|drop|end|exec|execute|fetch|insert|kill|open|select|sys|sysobjects|syscolumns|table|update|<script|<\/script>)/i;

const createUserSchema = z.object({
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
  role: z.enum(['superadmin', 'admin', 'principal', 'faculty', 'tutor', 'student'], {
    message: 'Please select a valid role.',
  }),
  lrn: z.string().optional(),
  grade_level_grade: z.string().optional(),
  grade_level_section: z.string()
    .max(50, 'Section must not exceed 50 characters.')
    .optional()
    .refine((v) => !v || SECTION_REGEX.test(v), 'Section can only contain letters, numbers, hyphens, and spaces.')
    .refine((v) => !v || !DANGEROUS_INJECTION_PATTERN.test(v), 'Invalid characters detected.'),
  assigned_tutor: z.string().optional().nullable(),
  aral_level: z.string().optional(),
  subject: z.string().optional(),
  parent_guardian_name: z.string()
    .max(200, 'Parent/Guardian Name must not exceed 200 characters.')
    .optional()
    .refine((v) => !v || NAME_REGEX.test(v), 'Parent / Guardian Name can only contain letters, spaces, hyphens, and periods.')
    .refine((v) => !v || !DANGEROUS_INJECTION_PATTERN.test(v), 'Invalid characters detected.'),
  contact_number: z.string()
    .max(30, 'Contact Number must not exceed 30 characters.')
    .optional()
    .refine((v) => !v || PHONE_REGEX.test(v), 'Contact Number can only contain digits, spaces, hyphens, and plus sign (+).')
    .refine((v) => !v || !DANGEROUS_INJECTION_PATTERN.test(v), 'Invalid characters detected.'),
  has_bosy: z.boolean().optional(),
  has_mosy: z.boolean().optional(),
  has_eosy: z.boolean().optional(),
  has_summer: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'student') {
    if (!data.lrn || !LRN_REGEX.test(data.lrn)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'LRN must be exactly 12 digits (numbers only).',
        path: ['lrn'],
      });
    }
    if (!data.grade_level_section || !data.grade_level_section.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Section is required.',
        path: ['grade_level_section'],
      });
    }
    if (!data.assigned_tutor || !data.assigned_tutor.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Assigned Tutor is required.',
        path: ['assigned_tutor'],
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
  } else {
    if (!data.email || !z.string().email().safeParse(data.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valid Google email is required for staff accounts.',
        path: ['email'],
      });
    }
  }
});

type CreateUserFields = z.infer<typeof createUserSchema>;

export const CreateUser: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tutors, setTutors] = useState<User[]>([]);

  const isSuperUser = Boolean(currentUser?.is_superuser);
  const searchParams = new URLSearchParams(location.search);
  const requestedRole = searchParams.get('role');
  const allowedRoles = isSuperUser
    ? ['student', 'tutor', 'faculty', 'principal', 'admin', 'superadmin']
    : ['student', 'tutor', 'faculty', 'principal'];
  const initialRole = (requestedRole && allowedRoles.includes(requestedRole))
    ? (requestedRole as CreateUserFields['role'])
    : (isSuperUser ? 'tutor' : 'student');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateUserFields>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      first_name: '',
      middle_name: '',
      last_name: '',
      email: '',
      role: initialRole,
      lrn: '',
      grade_level_grade: 'GRADE 7',
      grade_level_section: 'HYACINTH',
      assigned_tutor: '',
      aral_level: 'basic',
      subject: 'Reading',
      parent_guardian_name: '',
      contact_number: '',
      has_bosy: true,
      has_mosy: false,
      has_eosy: false,
      has_summer: false,
    },
  });

  const selectedRole = watch('role');

  useEffect(() => {
    if (!isSuperUser && (requestedRole === 'admin' || requestedRole === 'superadmin')) {
      navigate('/admin/students', { replace: true });
    }
  }, [isSuperUser, requestedRole, navigate]);

  useEffect(() => {
    const loadTutors = async () => {
      try {
        const response = await userService.getTutors();
        setTutors(response);
      } catch (error) {
        console.error('Failed to load tutors', error);
      }
    };

    loadTutors();
  }, []);

  const getPageHeading = () => {
    switch (selectedRole) {
      case 'student':
        return {
          title: 'Enroll Student',
        };
      case 'tutor':
        return {
          title: 'Add Tutor',
        };
      case 'faculty':
        return {
          title: 'Add Faculty',
        };
      case 'principal':
        return {
          title: 'Add Principal',
        };
      case 'admin':
        return {
          title: 'Pre-Register School Admin',
        };
      case 'superadmin':
        return {
          title: 'Add Super Admin',
        };
      default:
        return {
          title: 'Register Account',
        };
    }
  };

  const getBackLink = () => {
    if (currentUser?.is_superuser) {
      if (selectedRole === 'student') return '/superadmin/students';
      if (selectedRole === 'tutor') return '/superadmin/tutors';
      if (selectedRole === 'faculty') return '/superadmin/faculty';
      if (selectedRole === 'principal') return '/superadmin/principals';
      if (selectedRole === 'admin') return '/superadmin/admins';
      if (selectedRole === 'superadmin') return '/superadmin/superadmins';
      return '/superadmin/users';
    }
    if (selectedRole === 'tutor') return '/admin/tutors';
    if (selectedRole === 'faculty') return '/admin/faculty';
    if (selectedRole === 'principal') return '/admin/principals';
    return '/admin/students';
  };

  const onSubmit = async (data: CreateUserFields) => {
    setIsSubmitting(true);
    setServerErrors(null);
    try {
      const sectionStr = data.grade_level_section ? data.grade_level_section.toUpperCase().trim() : '';
      const gradeStr = data.grade_level_grade ? data.grade_level_grade.toUpperCase().trim() : 'GRADE 7';
      const combinedGradeLevel = selectedRole === 'student'
        ? (sectionStr ? `${gradeStr} - ${sectionStr}` : gradeStr)
        : '';

      const payload: any = {
        ...data,
        role: selectedRole,
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
        assigned_tutor: selectedRole === 'student' && data.assigned_tutor ? data.assigned_tutor : null,
        subject: selectedRole === 'student' || selectedRole === 'tutor' ? data.subject || 'Reading' : null,
      };

      await userService.createUser(payload);
      navigate(getBackLink());
    } catch (error: any) {
      console.error(error);
      const errorsPayload = error.response?.data;
      if (errorsPayload && typeof errorsPayload === 'object') {
        setServerErrors(errorsPayload);
      } else {
        alert('An unexpected error occurred while creating account.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const headingInfo = getPageHeading();

  return (
    <div className="mx-auto max-w-4xl space-y-3" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div className="flex items-center space-x-2">
        <Link
          to={getBackLink()}
          className="inline-flex items-center text-xs font-semibold text-slate-500 transition-colors hover:text-blue-700"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back to {selectedRole === 'student' ? 'Student Directory' : `${selectedRole.toUpperCase()} Directory`}
        </Link>
      </div>

      <div className="rounded-md border border-slate-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-6 shadow-xs">
        <div className="mb-5 border-b border-slate-100 dark:border-[#1A1A1A] pb-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">
            {headingInfo.title}
          </h2>
        </div>

        {serverErrors?.detail && (
          <div className="mb-4 flex items-start space-x-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <span>{serverErrors.detail}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Hidden input to preserve role without showing redundant dropdown */}
          <input type="hidden" {...register('role')} value={selectedRole} />

          {/* ── Section 1: Personal Information ─────────────────────────── */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
              Personal Information
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="first_name" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
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
                  className={`w-full rounded-md border px-3 py-2 text-xs font-medium uppercase shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:bg-[#111111] dark:text-slate-100 ${
                    errors.first_name || serverErrors?.first_name ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                  }`}
                />
                {(errors.first_name || serverErrors?.first_name) && (
                  <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                    {errors.first_name?.message || serverErrors?.first_name?.[0]}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="middle_name" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Middle Name <span className="font-normal text-gray-400 dark:text-slate-500">(optional)</span>
                </label>
                <input
                  id="middle_name"
                  type="text"
                  placeholder="e.g. SANTOS"
                  {...register('middle_name')}
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^a-zA-Z\s.\-ñÑ']/g, '');
                  }}
                  className="w-full rounded-md border border-gray-300 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-3 py-2 text-xs font-medium uppercase shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="last_name" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
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
                  className={`w-full rounded-md border px-3 py-2 text-xs font-medium uppercase shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:bg-[#111111] dark:text-slate-100 ${
                    errors.last_name || serverErrors?.last_name ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                  }`}
                />
                {(errors.last_name || serverErrors?.last_name) && (
                  <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                    {errors.last_name?.message || serverErrors?.last_name?.[0]}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 2: Staff Email (for non-students) ───────────────── */}
          {selectedRole !== 'student' && (
            <div className="space-y-2 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                Authentication &amp; Role Details
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="email" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Google Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="e.g. user@bicol-u.edu.ph"
                    {...register('email')}
                    className={`w-full rounded-md border px-3 py-2 text-xs shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:bg-[#111111] dark:text-slate-100 ${
                      errors.email || serverErrors?.email ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                    }`}
                  />
                  {(errors.email || serverErrors?.email) && (
                    <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                      {errors.email?.message || serverErrors?.email?.[0]}
                    </p>
                  )}
                </div>

                {selectedRole === 'tutor' && (
                  <>
                    <div>
                      <label htmlFor="aral_level" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
                        ARAL Level <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="aral_level"
                        {...register('aral_level')}
                        className="w-full rounded-md border border-gray-300 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-3 py-2 text-xs font-medium shadow-2xs focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:text-slate-100"
                      >
                        <option value="basic">ARAL Basic</option>
                        <option value="plus">ARAL Plus</option>
                        <option value="summer">ARAL Summer</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="subject" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
                        Assigned Subject <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="subject"
                        {...register('subject')}
                        className="w-full rounded-md border border-gray-300 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-3 py-2 text-xs font-medium shadow-2xs focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:text-slate-100"
                      >
                        <option value="Reading">Reading</option>
                        <option value="Science">Science</option>
                        <option value="Math">Math</option>
                        <option value="English">English</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Section 3: Student Academic & ARAL Enrollment Details ───── */}
          {selectedRole === 'student' && (
            <>
              <div className="space-y-3 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                  ARAL Academic &amp; Tutor Assignment
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="lrn" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
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
                      className={`w-full rounded-md border px-3 py-2 text-xs font-mono font-bold shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:bg-[#111111] dark:text-slate-100 ${
                        errors.lrn || serverErrors?.lrn ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                      }`}
                    />
                    {(errors.lrn || serverErrors?.lrn) && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                        {errors.lrn?.message || serverErrors?.lrn?.[0]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="grade_level_grade" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
                      Grade Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="grade_level_grade"
                      {...register('grade_level_grade')}
                      className="w-full rounded-md border border-gray-300 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-3 py-2 text-xs font-semibold uppercase shadow-2xs focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:text-slate-100"
                    >
                      <option value="GRADE 7">GRADE 7</option>
                      <option value="GRADE 8">GRADE 8</option>
                      <option value="GRADE 9">GRADE 9</option>
                      <option value="GRADE 10">GRADE 10</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="grade_level_section" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
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
                      className={`w-full rounded-md border px-3 py-2 text-xs font-medium uppercase shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:bg-[#111111] dark:text-slate-100 ${
                        errors.grade_level_section || serverErrors?.grade_level_section ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                      }`}
                    />
                    {(errors.grade_level_section || serverErrors?.grade_level_section) && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                        {errors.grade_level_section?.message || serverErrors?.grade_level_section?.[0]}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="student_aral_level" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
                      ARAL Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="student_aral_level"
                      {...register('aral_level')}
                      className="w-full rounded-md border border-gray-300 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-3 py-2 text-xs font-medium shadow-2xs focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:text-slate-100 cursor-pointer"
                    >
                      <option value="basic">ARAL Basic</option>
                      <option value="plus">ARAL Plus</option>
                      <option value="summer">ARAL Summer</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="student_subject" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
                      Subject Focus <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="student_subject"
                      {...register('subject')}
                      className="w-full rounded-md border border-gray-300 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-3 py-2 text-xs font-medium shadow-2xs focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:text-slate-100 cursor-pointer"
                    >
                      <option value="Reading">READING</option>
                      <option value="Math">MATH</option>
                      <option value="Science">SCIENCE</option>
                      <option value="English">ENGLISH</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="assigned_tutor" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Assign Tutor <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="assigned_tutor"
                      {...register('assigned_tutor')}
                      className={`w-full rounded-md border px-3 py-2 text-xs font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:bg-[#111111] dark:text-slate-100 cursor-pointer ${
                        errors.assigned_tutor || serverErrors?.assigned_tutor ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                      }`}
                    >
                      <option value="">-- Select Assigned Tutor --</option>
                      {tutors.map((tutor) => (
                        <option key={tutor.id} value={tutor.id}>
                          {tutor.full_name || `${tutor.first_name} ${tutor.last_name}`} ({tutor.email})
                        </option>
                      ))}
                    </select>
                    {(errors.assigned_tutor || serverErrors?.assigned_tutor) && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                        {errors.assigned_tutor?.message || serverErrors?.assigned_tutor?.[0]}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Section 4: Parent/Guardian & Contact Information ───────── */}
              <div className="space-y-3 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                  Additional Information &amp; Contact
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="parent_guardian_name" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
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
                      className={`w-full rounded-md border px-3 py-2 text-xs font-medium uppercase shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:bg-[#111111] dark:text-slate-100 ${
                        errors.parent_guardian_name || serverErrors?.parent_guardian_name ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                      }`}
                    />
                    {(errors.parent_guardian_name || serverErrors?.parent_guardian_name) && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                        {errors.parent_guardian_name?.message || serverErrors?.parent_guardian_name?.[0]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contact_number" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
                      Contact Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="contact_number"
                      type="text"
                      inputMode="tel"
                      placeholder="e.g. 09552040068"
                      {...register('contact_number')}
                      onInput={(e) => {
                        e.currentTarget.value = e.currentTarget.value.replace(/[^0-9+\-\s()]/g, '');
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-xs font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:bg-[#111111] dark:text-slate-100 ${
                        errors.contact_number || serverErrors?.contact_number ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                      }`}
                    />
                    {(errors.contact_number || serverErrors?.contact_number) && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                        {errors.contact_number?.message || serverErrors?.contact_number?.[0]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}


          {/* Action buttons */}
          <div className="flex justify-end space-x-3 pt-2">
            <Link
              to={getBackLink()}
              className="rounded-md border border-gray-300 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer rounded-md bg-[var(--brand)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors hover:bg-[var(--brand-dark)] disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : headingInfo.title}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUser;
