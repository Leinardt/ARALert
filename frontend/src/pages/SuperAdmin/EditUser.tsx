import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { ArrowLeft, AlertCircle, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isTutorEligibleForStudent } from '../../utils/tutorCohortHelpers';

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
    setValue,
    formState: { errors },
  } = useForm<EditUserFields>({
    resolver: zodResolver(editUserSchema),
  });

  const [userInitialData, setUserInitialData] = useState<User | null>(null);
  const selectedRole = watch('role');
  const watchedStudentGrade = watch('grade_level_grade');
  const watchedStudentSection = watch('grade_level_section');
  const watchedStudentAralLevel = watch('aral_level');
  const watchedStudentSubject = watch('subject');

  // Synchronize student subject with selected ARAL level:
  // - Basic: English is unavailable, replaced by Filipino (value="Reading")
  // - Plus: Filipino is unavailable, replaced by English (value="English")
  // - Math and Science remain untouched
  useEffect(() => {
    if (!isLoading && selectedRole === 'student') {
      if (watchedStudentAralLevel === 'plus' && watchedStudentSubject === 'Reading') {
        setValue('subject', 'English');
      } else if (watchedStudentAralLevel !== 'plus' && watchedStudentSubject === 'English') {
        setValue('subject', 'Reading');
      }
    }
  }, [isLoading, selectedRole, watchedStudentAralLevel, watchedStudentSubject, setValue]);

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
        return updated.length > 0 ? updated : (next.includes('basic') ? ['Filipino'] : ['English']);
      });
      return next;
    });
    if (tutorRoleErrors.aralLevel) {
      setTutorRoleErrors((prev) => ({ ...prev, aralLevel: undefined }));
    }
  };

  const toggleSubject = (subjectName: string) => {
    if (subjectName === 'Filipino' && !tutorAralLevels.includes('basic')) return;
    if (subjectName === 'English' && !tutorAralLevels.includes('plus')) return;
    setTutorSubjects((prev) => {
      if (prev.includes(subjectName)) {
        return prev.filter((s) => s !== subjectName);
      } else {
        return [...prev, subjectName];
      }
    });
    if (tutorRoleErrors.subject) {
      setTutorRoleErrors((prev) => ({ ...prev, subject: undefined }));
    }
  };

  const toggleGradeLevel = (grade: string) => {
    setTutorGradeLevels((prev) => {
      if (prev.includes(grade)) {
        return prev.filter((g) => g !== grade);
      } else {
        return [...prev, grade];
      }
    });
    if (tutorRoleErrors.gradeLevel) {
      setTutorRoleErrors((prev) => ({ ...prev, gradeLevel: undefined }));
    }
  };

  const addSection = () => {
    setTutorSections((prev) => [...prev, '']);
  };

  const removeSection = (index: number) => {
    setTutorSections((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']));
  };

  const updateSection = (index: number, value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9\s\-]/g, '').toUpperCase();
    setTutorSections((prev) => {
      const next = [...prev];
      next[index] = sanitized;
      return next;
    });
    if (tutorRoleErrors.sections) {
      setTutorRoleErrors((prev) => ({ ...prev, sections: undefined }));
    }
  };

  // Filter tutors matching student's grade, section, and ARAL level (always preserving current assignment)
  const matchingTutors = useMemo(() => {
    if (selectedRole !== 'student') return tutors;
    const currentTutorId = userInitialData?.assigned_tutor;
    return tutors.filter((tutor) =>
      (currentTutorId && String(tutor.id) === String(currentTutorId)) ||
      isTutorEligibleForStudent(tutor, {
        grade: watchedStudentGrade,
        section: watchedStudentSection,
        aral_level: watchedStudentAralLevel,
      })
    );
  }, [tutors, selectedRole, userInitialData, watchedStudentGrade, watchedStudentSection, watchedStudentAralLevel]);

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

        setUserInitialData(userData);

        if (userData.role === 'tutor') {
          const rawAral = (userData.aral_level || '').toLowerCase();
          const rawType = (userData.tutor_type || '').toLowerCase();
          const levels: ('basic' | 'plus')[] = [];
          if (rawAral.includes('basic') || rawType.includes('basic') || (!rawAral && !rawType)) levels.push('basic');
          if (rawAral.includes('plus') || rawType.includes('plus')) levels.push('plus');
          setTutorAralLevels(levels.length > 0 ? levels : ['basic']);

          const rawSub = (userData.subject || '').toLowerCase();
          const subs: string[] = [];
          if (rawSub.includes('reading') || rawSub.includes('filipino')) subs.push('Filipino');
          if (rawSub.includes('english')) subs.push('English');
          if (rawSub.includes('science')) subs.push('Science');
          if (rawSub.includes('math')) subs.push('Math');
          if (subs.length === 0) {
            if (levels.includes('basic')) subs.push('Filipino');
            else subs.push('English');
          }
          setTutorSubjects(subs);

          if (userData.grade_level) {
            const chunks = userData.grade_level.split(',').map((c: string) => c.trim()).filter(Boolean);
            const parsedGrades: string[] = [];
            const parsedSections: string[] = [];

            chunks.forEach((chunk: string) => {
              if (chunk.includes(' - ')) {
                const [g, s] = chunk.split(' - ').map((part: string) => part.trim().toUpperCase());
                if (['GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'].includes(g) && !parsedGrades.includes(g)) {
                  parsedGrades.push(g);
                }
                if (s && !parsedSections.includes(s)) {
                  parsedSections.push(s);
                }
              } else {
                const g = chunk.toUpperCase();
                if (['GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'].includes(g) && !parsedGrades.includes(g)) {
                  parsedGrades.push(g);
                } else if (g) {
                  parsedSections.push(g);
                }
              }
            });

            if (parsedGrades.length > 0) setTutorGradeLevels(parsedGrades);
            if (parsedSections.length > 0) setTutorSections(parsedSections);
          }
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
            if (['GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'].includes(g)) {
              initialGrade = g;
            } else if (['7', '8', '9', '10', '11', '12'].includes(g)) {
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
          subject: (userData.aral_level === 'plus' && (!userData.subject || userData.subject === 'Reading'))
            ? 'English'
            : (userData.aral_level !== 'plus' && userData.subject === 'English')
            ? 'Reading'
            : (userData.subject || 'Reading'),
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
      if (data.role === 'tutor') {
        const errors: typeof tutorRoleErrors = {};
        if (tutorAralLevels.length === 0) {
          errors.aralLevel = 'Please select at least one ARAL Level (BASIC and/or PLUS).';
        }
        if (tutorSubjects.length === 0) {
          errors.subject = 'Please select at least one Assigned Subject.';
        }
        if (tutorGradeLevels.length === 0) {
          errors.gradeLevel = 'Please select at least one Assigned Grade Level.';
        }
        const validSections = tutorSections.map((s) => s.trim().toUpperCase()).filter(Boolean);
        if (validSections.length === 0) {
          errors.sections = 'At least one valid assigned section name is required.';
        }

        if (Object.keys(errors).length > 0) {
          setTutorRoleErrors(errors);
          setIsSubmitting(false);
          return;
        }
        setTutorRoleErrors({});
      }

      let combinedGradeLevel = '';
      if (data.role === 'tutor') {
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
      } else if (data.role === 'student') {
        const sectionStr = data.grade_level_section ? data.grade_level_section.toUpperCase().trim() : '';
        const gradeStr = data.grade_level_grade ? data.grade_level_grade.toUpperCase().trim() : 'GRADE 7';
        combinedGradeLevel = sectionStr ? `${gradeStr} - ${sectionStr}` : gradeStr;
      }

      const tutorAralLevel = data.role === 'tutor'
        ? (tutorAralLevels.length > 1 ? 'basic,plus' : (tutorAralLevels[0] || 'basic'))
        : (data.aral_level || 'basic');

      const tutorTutorType = data.role === 'tutor'
        ? (tutorAralLevels.length > 1 ? 'basic_plus' : (tutorAralLevels[0] || 'basic'))
        : (data.aral_level || 'basic');

      const tutorSubject = data.role === 'tutor'
        ? (tutorSubjects.includes('Filipino') ? 'Reading' : tutorSubjects[0] || 'Reading')
        : (data.subject || 'Reading');

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
        subject: tutorSubject,
        aral_level: tutorAralLevel,
        tutor_type: tutorTutorType,
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
      <div className="space-y-6 max-w-4xl mx-auto skeleton-container animate-pulse" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="bg-white dark:bg-[#0A0A0A] p-8 sm:p-10 rounded-2xl border border-slate-200 dark:border-[#1A1A1A] shadow-md space-y-6">
          <div className="h-6 w-52 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="space-y-3 pt-2">
            <div className="h-3 w-36 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-10 rounded-md bg-gray-100 dark:bg-gray-900" />
              <div className="h-10 rounded-md bg-gray-100 dark:bg-gray-900" />
              <div className="h-10 rounded-md bg-gray-100 dark:bg-gray-900" />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-10 rounded-md bg-gray-100 dark:bg-gray-900" />
              <div className="h-10 rounded-md bg-gray-100 dark:bg-gray-900" />
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <div className="h-10 w-32 rounded-md bg-gray-200 dark:bg-gray-800" />
            <div className="h-10 w-24 rounded-md bg-gray-100 dark:bg-gray-900" />
          </div>
        </div>
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
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
              Personal Information
            </h4>
            <div className={`grid grid-cols-1 gap-4 ${selectedRole === 'tutor' ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
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

              {/* For Tutor: Google Email Address is placed directly in Personal Information */}
              {selectedRole === 'tutor' && (
                <div>
                  <label htmlFor="tutor_personal_email" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Google Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="tutor_personal_email"
                    type="email"
                    placeholder="e.g. tutor@bicol-u.edu.ph"
                    {...register('email')}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs dark:bg-[#111111] dark:text-slate-100 ${
                      errors.email || serverErrors?.email ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                    }`}
                  />
                  {(errors.email || serverErrors?.email) && (
                    <p className="mt-1 text-xs text-red-600">{errors.email?.message || serverErrors?.email?.[0]}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Section 2: Tutor Role Details Container ──────────────────── */}
          {selectedRole === 'tutor' && (
            <div className="space-y-4 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                Role Details
              </h4>

              {/* 1. ARAL Level (Checkbox: BASIC and/or PLUS) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  ARAL Level <span className="text-red-500">*</span>
                </label>
                <div className="p-3 bg-gray-50/70 dark:bg-[#141414] border border-gray-200 dark:border-[#222222] rounded-lg">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {[
                      { key: 'basic', label: 'BASIC' },
                      { key: 'plus', label: 'PLUS' },
                    ].map((lvl) => {
                      const isChecked = tutorAralLevels.includes(lvl.key as any);
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
                            onChange={() => toggleAralLevel(lvl.key as any)}
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

              {/* 2. Assigned Subject (FILIPINO if Basic, ENGLISH if Plus, SCIENCE, MATH) */}
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

          {/* ── Section 2: Non-Tutor Staff Authentication (admin, principal, faculty) ─ */}
          {selectedRole !== 'student' && selectedRole !== 'tutor' && (
            <div className="space-y-3 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
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
              </div>
            </div>
          )}

          {/* ── Section 3: Student Academic & ARAL Enrollment Details ───── */}
          {selectedRole === 'student' && (
            <div className="space-y-4 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
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
                    <option value="GRADE 11">GRADE 11</option>
                    <option value="GRADE 12">GRADE 12</option>
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
                    <option value="basic">BASIC</option>
                    <option value="plus">PLUS</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="student_subject_edit" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="student_subject_edit"
                    {...register('subject')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#1A1A1A] rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs bg-white dark:bg-[#111111] dark:text-slate-100 font-medium cursor-pointer"
                  >
                    {watchedStudentAralLevel === 'plus' ? (
                      <option value="English">ENGLISH (for Plus)</option>
                    ) : (
                      <option value="Reading">FILIPINO (for Basic)</option>
                    )}
                    <option value="Math">MATH</option>
                    <option value="Science">SCIENCE</option>
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
                    {matchingTutors.map((tutor) => (
                      <option key={tutor.id} value={tutor.id}>
                        {tutor.full_name || `${tutor.first_name} ${tutor.last_name}`} — [Handled: {tutor.grade_level || 'General'}]
                      </option>
                    ))}
                  </select>
                  {(errors.assigned_tutor || serverErrors?.assigned_tutor) && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
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

              {/* ── Section 4: Parent / Guardian & Contact ──────────────────── */}
              <div className="space-y-3 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
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
