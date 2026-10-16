import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { ArrowLeft, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isTutorEligibleForStudent, formatTutorAssignmentOption } from '../../utils/tutorCohortHelpers';

const NAME_REGEX = /^[a-zA-Z\s.\-ñÑ']+$/;
const SECTION_REGEX = /^[a-zA-Z0-9\s\-]+$/;
const PHONE_REGEX = /^\d{11}$/;
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
    .max(11, 'Contact Number must be exactly 11 digits.')
    .optional()
    .refine((v) => !v || PHONE_REGEX.test(v), 'Contact Number must be exactly 11 digits (e.g. 09123456789).')
    .refine((v) => !v || !DANGEROUS_INJECTION_PATTERN.test(v), 'Invalid characters detected.'),
  has_bosy: z.boolean().optional(),
  has_mosy: z.boolean().optional(),
  has_eosy: z.boolean().optional(),
  has_summer: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'student') {
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
    setValue,
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
      subject: 'Filipino',
      parent_guardian_name: '',
      contact_number: '',
      has_bosy: true,
      has_mosy: false,
      has_eosy: false,
      has_summer: false,
    },
  });

  const selectedRole = watch('role');
  const watchedStudentGrade = watch('grade_level_grade');
  const watchedStudentSection = watch('grade_level_section');
  const watchedStudentAralLevel = watch('aral_level');
  const watchedStudentSubject = watch('subject');

  // Synchronize student subject with selected ARAL level:
  // - Basic: English is unavailable, replaced by Filipino (value="Filipino")
  // - Plus: Filipino is unavailable, replaced by English (value="English")
  // - Math and Science remain untouched
  useEffect(() => {
    if (selectedRole === 'student') {
      if (watchedStudentAralLevel === 'plus' && (watchedStudentSubject === 'Filipino' || watchedStudentSubject === 'Reading')) {
        setValue('subject', 'English');
      } else if (watchedStudentAralLevel !== 'plus' && watchedStudentSubject === 'English') {
        setValue('subject', 'Filipino');
      }
    }
  }, [selectedRole, watchedStudentAralLevel, watchedStudentSubject, setValue]);

  // Filter tutors matching student's grade, section, and ARAL level
  const matchingTutors = useMemo(() => {
    if (selectedRole !== 'student') return tutors;
    return tutors.filter((tutor) =>
      isTutorEligibleForStudent(tutor, {
        grade: watchedStudentGrade,
        section: watchedStudentSection,
        aral_level: watchedStudentAralLevel,
      })
    );
  }, [tutors, selectedRole, watchedStudentGrade, watchedStudentSection, watchedStudentAralLevel]);

  // Tutor multi-level and multi-section state
  const [tutorAralLevels, setTutorAralLevels] = useState<('basic' | 'plus')[]>(['basic']);
  const [tutorSubjects, setTutorSubjects] = useState<string[]>(['Filipino']);
  const [tutorGradeLevels, setTutorGradeLevels] = useState<string[]>(['GRADE 7']);
  const [tutorSections, setTutorSections] = useState<string[]>(['']);
  const [tutorRoleErrors, setTutorRoleErrors] = useState<{
    aralLevel?: string;
    subject?: string;
    gradeLevel?: string;
    sections?: string;
  }>({});

  const toggleAralLevel = (level: 'basic' | 'plus') => {
    setTutorAralLevels((prev) => {
      const next = prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level];
      setTutorSubjects((prevSubj) => {
        let updated = [...prevSubj];
        if (!next.includes('basic')) updated = updated.filter((s) => s !== 'Filipino');
        if (!next.includes('plus')) updated = updated.filter((s) => s !== 'English');
        if (next.includes('basic') && !prev.includes('basic') && !updated.includes('Filipino')) updated.push('Filipino');
        if (next.includes('plus') && !prev.includes('plus') && !updated.includes('English')) updated.push('English');
        return updated;
      });
      return next;
    });
    if (tutorRoleErrors.aralLevel) {
      setTutorRoleErrors((prev) => ({ ...prev, aralLevel: undefined }));
    }
  };

  const toggleSubject = (subj: string) => {
    if (subj === 'Filipino' && !tutorAralLevels.includes('basic')) return;
    if (subj === 'English' && !tutorAralLevels.includes('plus')) return;
    setTutorSubjects((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj]
    );
    if (tutorRoleErrors.subject) {
      setTutorRoleErrors((prev) => ({ ...prev, subject: undefined }));
    }
  };

  const toggleGradeLevel = (grade: string) => {
    setTutorGradeLevels((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
    if (tutorRoleErrors.gradeLevel) {
      setTutorRoleErrors((prev) => ({ ...prev, gradeLevel: undefined }));
    }
  };

  const addSection = () => {
    setTutorSections((prev) => [...prev, '']);
  };

  const removeSection = (index: number) => {
    setTutorSections((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const updateSection = (index: number, val: string) => {
    const sanitized = val.toUpperCase().replace(/[^a-zA-Z0-9\s\-]/g, '');
    setTutorSections((prev) => {
      const next = [...prev];
      next[index] = sanitized;
      return next;
    });
  };

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
          title: 'Add Admin',
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
      if (selectedRole === 'tutor') {
        const rErrors: typeof tutorRoleErrors = {};
        if (tutorAralLevels.length === 0) {
          rErrors.aralLevel = 'At least one ARAL Level (BASIC or PLUS) must be selected.';
        }
        if (tutorSubjects.length === 0) {
          rErrors.subject = 'At least one Assigned Subject must be selected.';
        }
        if (tutorGradeLevels.length === 0) {
          rErrors.gradeLevel = 'At least one Assigned Grade Level must be selected.';
        }
        const validSections = tutorSections.map((s) => s.trim().toUpperCase()).filter(Boolean);
        if (validSections.length === 0) {
          rErrors.sections = 'At least one Assigned Section is required.';
        }
        if (Object.keys(rErrors).length > 0) {
          setTutorRoleErrors(rErrors);
          setIsSubmitting(false);
          return;
        }
        setTutorRoleErrors({});
      }

      let combinedGradeLevel = '';
      if (selectedRole === 'tutor') {
        const validSections = tutorSections.map((s) => s.trim().toUpperCase()).filter(Boolean);
        if (validSections.length === 1) {
          combinedGradeLevel = tutorGradeLevels.map((g) => `${g} - ${validSections[0]}`).join(', ');
        } else if (validSections.length === tutorGradeLevels.length) {
          combinedGradeLevel = tutorGradeLevels.map((g, i) => `${g} - ${validSections[i]}`).join(', ');
        } else {
          combinedGradeLevel = tutorGradeLevels
            .map((g) => validSections.map((s) => `${g} - ${s}`).join(', '))
            .join(', ');
        }
        if (combinedGradeLevel.length > 98) {
          combinedGradeLevel = combinedGradeLevel.slice(0, 98);
        }
      } else if (selectedRole === 'student') {
        const sectionStr = data.grade_level_section ? data.grade_level_section.toUpperCase().trim() : '';
        const gradeStr = data.grade_level_grade ? data.grade_level_grade.toUpperCase().trim() : 'GRADE 7';
        combinedGradeLevel = sectionStr ? `${gradeStr} - ${sectionStr}` : gradeStr;
      }

      const tutorAralLevel = selectedRole === 'tutor'
        ? (tutorAralLevels.length > 1 ? 'basic,plus' : (tutorAralLevels[0] || 'basic'))
        : (data.aral_level || 'basic');

      const tutorTutorType = selectedRole === 'tutor'
        ? (tutorAralLevels.length > 1 ? 'basic_plus' : (tutorAralLevels[0] || 'basic'))
        : (data.aral_level || 'basic');

      const tutorSubject = selectedRole === 'tutor'
        ? (tutorSubjects.includes('Filipino') ? 'Filipino' : tutorSubjects[0] || 'Filipino')
        : (data.subject || 'Filipino');

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
        subject: tutorSubject,
        aral_level: tutorAralLevel,
        tutor_type: tutorTutorType,
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
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
              Personal Information
            </h4>
            <div className={`grid grid-cols-1 gap-4 ${selectedRole !== 'student' ? 'sm:grid-cols-2 md:grid-cols-4' : 'sm:grid-cols-3'}`}>
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

              {/* For Staff (tutor, faculty, principal, admin, superadmin): Google Email Address is part of Personal Information */}
              {selectedRole !== 'student' && (
                <div>
                  <label htmlFor="email" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Google Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder={
                      selectedRole === 'tutor'
                        ? 'e.g. tutor@bicol-u.edu.ph'
                        : selectedRole === 'faculty'
                        ? 'e.g. faculty@deped.gov.ph'
                        : selectedRole === 'principal'
                        ? 'e.g. principal@deped.gov.ph'
                        : selectedRole === 'admin'
                        ? 'e.g. admin@deped.gov.ph'
                        : 'e.g. superadmin@deped.gov.ph'
                    }
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
              )}
            </div>
          </div>

          {/* ── Section 2: Role Details (for Tutors) ───────────────────── */}
          {selectedRole === 'tutor' && (
            <div className="space-y-4 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                Role Details
              </h4>

              {/* 1. ARAL Level (checkboxes: BASIC / PLUS) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  ARAL Level <span className="text-red-500">*</span>
                </label>
                <div className="p-3 bg-gray-50/70 dark:bg-[#141414] border border-gray-200 dark:border-[#222222] rounded-lg">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {[
                      { key: 'basic' as const, label: 'BASIC' },
                      { key: 'plus' as const, label: 'PLUS' },
                    ].map((lvl) => {
                      const isChecked = tutorAralLevels.includes(lvl.key);
                      return (
                        <label
                          key={lvl.key}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all select-none cursor-pointer ${
                            isChecked
                              ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] shadow-2xs'
                              : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838] hover:bg-gray-50/70 dark:hover:bg-[#1e1e1e]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleAralLevel(lvl.key)}
                            className="h-4 w-4 rounded border-gray-300 text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer"
                          />
                          <span className="font-semibold">{lvl.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                {tutorRoleErrors.aralLevel && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">{tutorRoleErrors.aralLevel}</p>
                )}
              </div>

              {/* 2. Assigned Subject (checkboxes: FILIPINO / ENGLISH / SCIENCE / MATH) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Assigned Subject <span className="text-red-500">*</span>
                </label>
                <div className="p-3 bg-gray-50/70 dark:bg-[#141414] border border-gray-200 dark:border-[#222222] rounded-lg">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* FILIPINO: Requires BASIC */}
                    {(() => {
                      const isFilipinoDisabled = !tutorAralLevels.includes('basic');
                      const isFilipinoChecked = !isFilipinoDisabled && tutorSubjects.includes('Filipino');
                      return (
                        <label
                          title={isFilipinoDisabled ? 'Select BASIC ARAL Level above to enable Filipino' : undefined}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all select-none ${
                            isFilipinoDisabled
                              ? 'cursor-not-allowed bg-gray-100/70 dark:bg-[#191919] border-gray-200 dark:border-[#282828] text-gray-400 dark:text-neutral-500 opacity-60'
                              : isFilipinoChecked
                              ? 'cursor-pointer border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] shadow-2xs'
                              : 'cursor-pointer border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838] hover:bg-gray-50/70 dark:hover:bg-[#1e1e1e]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isFilipinoDisabled}
                            checked={isFilipinoChecked}
                            onChange={() => toggleSubject('Filipino')}
                            className="h-4 w-4 rounded border-gray-300 text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="font-semibold">FILIPINO</span>
                          {isFilipinoDisabled && (
                            <span className="text-[10px] font-normal text-gray-400 dark:text-neutral-500">
                              (Requires Basic)
                            </span>
                          )}
                        </label>
                      );
                    })()}

                    {/* ENGLISH: Requires PLUS */}
                    {(() => {
                      const isEnglishDisabled = !tutorAralLevels.includes('plus');
                      const isEnglishChecked = !isEnglishDisabled && tutorSubjects.includes('English');
                      return (
                        <label
                          title={isEnglishDisabled ? 'Select PLUS ARAL Level above to enable English' : undefined}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all select-none ${
                            isEnglishDisabled
                              ? 'cursor-not-allowed bg-gray-100/70 dark:bg-[#191919] border-gray-200 dark:border-[#282828] text-gray-400 dark:text-neutral-500 opacity-60'
                              : isEnglishChecked
                              ? 'cursor-pointer border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] shadow-2xs'
                              : 'cursor-pointer border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838] hover:bg-gray-50/70 dark:hover:bg-[#1e1e1e]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isEnglishDisabled}
                            checked={isEnglishChecked}
                            onChange={() => toggleSubject('English')}
                            className="h-4 w-4 rounded border-gray-300 text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="font-semibold">ENGLISH</span>
                          {isEnglishDisabled && (
                            <span className="text-[10px] font-normal text-gray-400 dark:text-neutral-500">
                              (Requires Plus)
                            </span>
                          )}
                        </label>
                      );
                    })()}

                    {/* SCIENCE */}
                    {(() => {
                      const isChecked = tutorSubjects.includes('Science');
                      return (
                        <label
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all select-none cursor-pointer ${
                            isChecked
                              ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] shadow-2xs'
                              : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838] hover:bg-gray-50/70 dark:hover:bg-[#1e1e1e]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSubject('Science')}
                            className="h-4 w-4 rounded border-gray-300 text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer"
                          />
                          <span className="font-semibold">SCIENCE</span>
                        </label>
                      );
                    })()}

                    {/* MATH */}
                    {(() => {
                      const isChecked = tutorSubjects.includes('Math');
                      return (
                        <label
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all select-none cursor-pointer ${
                            isChecked
                              ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] shadow-2xs'
                              : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838] hover:bg-gray-50/70 dark:hover:bg-[#1e1e1e]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSubject('Math')}
                            className="h-4 w-4 rounded border-gray-300 text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer"
                          />
                          <span className="font-semibold">MATH</span>
                        </label>
                      );
                    })()}
                  </div>
                </div>
                {tutorAralLevels.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Select an ARAL Level above to enable Filipino (Basic) or English (Plus).
                  </p>
                )}
                {tutorRoleErrors.subject && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">{tutorRoleErrors.subject}</p>
                )}
              </div>

              {/* 3. ASSIGNED GRADE LEVEL (GRADE 7 to GRADE 12) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  ASSIGNED GRADE LEVEL <span className="text-red-500">*</span>
                </label>
                <div className="p-3 bg-gray-50/70 dark:bg-[#141414] border border-gray-200 dark:border-[#222222] rounded-lg">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {['GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'].map((grade) => {
                      const isChecked = tutorGradeLevels.includes(grade);
                      return (
                        <label
                          key={grade}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all select-none cursor-pointer ${
                            isChecked
                              ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] shadow-2xs'
                              : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838] hover:bg-gray-50/70 dark:hover:bg-[#1e1e1e]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleGradeLevel(grade)}
                            className="h-4 w-4 rounded border-gray-300 text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer"
                          />
                          <span className="font-semibold">{grade}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                {tutorRoleErrors.gradeLevel && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">{tutorRoleErrors.gradeLevel}</p>
                )}
              </div>

              {/* 4. ASSIGNED SECTIONS (Dynamic Section Inputs) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  ASSIGNED SECTIONS <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2 max-w-lg">
                  {tutorSections.map((sec, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={sec}
                        onChange={(e) => updateSection(idx, e.target.value)}
                        placeholder={idx === 0 ? 'e.g. MANGO' : `Section ${idx + 1}`}
                        className="w-full rounded-md border border-gray-300 dark:border-[#222222] bg-white dark:bg-[#161616] px-3 py-2 text-xs font-semibold uppercase shadow-2xs focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:text-slate-100"
                      />
                      {tutorSections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(idx)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                          title="Remove section"
                          aria-label="Remove section"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand)] hover:underline cursor-pointer pt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Another Assigned Section
                </button>
                {tutorRoleErrors.sections && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">{tutorRoleErrors.sections}</p>
                )}
              </div>
            </div>
          )}


          {/* ── Section 3: Student Academic & ARAL Enrollment Details ───── */}
          {selectedRole === 'student' && (
            <>
              <div className="space-y-3 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
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
                      <option value="GRADE 11">GRADE 11</option>
                      <option value="GRADE 12">GRADE 12</option>
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
                      <option value="basic">BASIC</option>
                      <option value="plus">PLUS</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="student_subject" className="mb-1 block text-xs font-semibold text-gray-700 dark:text-slate-300">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="student_subject"
                      {...register('subject')}
                      className="w-full rounded-md border border-gray-300 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-3 py-2 text-xs font-medium shadow-2xs focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:text-slate-100 cursor-pointer"
                    >
                      {watchedStudentAralLevel === 'plus' ? (
                        <option value="English">ENGLISH (for Plus)</option>
                      ) : (
                        <option value="Filipino">FILIPINO (for Basic)</option>
                      )}
                      <option value="Math">MATH</option>
                      <option value="Science">SCIENCE</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="assigned_tutor" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                      Assign Tutor
                    </label>
                    <select
                      id="assigned_tutor"
                      {...register('assigned_tutor')}
                      className={`w-full rounded-md border px-3 py-2 text-xs font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:bg-[#111111] dark:text-slate-100 cursor-pointer ${
                        errors.assigned_tutor || serverErrors?.assigned_tutor ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                      }`}
                    >
                      <option value="">To Be Assigned (TBA)</option>
                      {matchingTutors.map((tutor) => (
                        <option key={tutor.id} value={tutor.id}>
                          {formatTutorAssignmentOption(tutor)}
                        </option>
                      ))}
                    </select>
                    {(errors.assigned_tutor || serverErrors?.assigned_tutor) && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                        {errors.assigned_tutor?.message || serverErrors?.assigned_tutor?.[0]}
                      </p>
                    )}
                    {matchingTutors.length === 0 && (
                      <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                        No tutors currently handle {watchedStudentGrade || 'this grade'}{watchedStudentSection ? `, Section ${watchedStudentSection.toUpperCase()}` : ''}, and ARAL {(watchedStudentAralLevel || 'basic').toUpperCase()}.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Section 4: Parent/Guardian & Contact Information ───────── */}
              <div className="space-y-3 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
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
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="e.g. 09552040068"
                      {...register('contact_number')}
                      onInput={(e) => {
                        e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 11);
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
