import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { ArrowLeft, AlertCircle, ShieldCheck, Plus, Trash2, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  isTutorEligibleForStudent,
  formatTutorAssignmentOption,
  TutorRoleDetailGroup,
  createDefaultRoleDetail,
  buildTutorPayloadFromRoleDetails,
  parseTutorRoleDetailsFromUser,
} from '../../utils/tutorCohortHelpers';
import { TutorRoleDetailsSection } from '../../components/TutorRoleDetailsSection';

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
  grade_level_section: z.string().optional(),
  is_active: z.boolean(),
  assigned_tutor: z.string().optional().nullable(),
  aral_level: z.string().optional(),
  subject: z.string().optional(),
  parent_guardian_name: z.string().optional(),
  contact_number: z.string().optional(),
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
    } else if (data.grade_level_section.length > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Section must not exceed 50 characters.',
        path: ['grade_level_section'],
      });
    } else if (!SECTION_REGEX.test(data.grade_level_section)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Section can only contain letters, numbers, hyphens, and spaces.',
        path: ['grade_level_section'],
      });
    } else if (DANGEROUS_INJECTION_PATTERN.test(data.grade_level_section)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid characters detected.',
        path: ['grade_level_section'],
      });
    }

    if (!data.lrn || !LRN_REGEX.test(data.lrn)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'LRN must be exactly 12 digits (numbers only).',
        path: ['lrn'],
      });
    }
    if (data.parent_guardian_name && data.parent_guardian_name.trim()) {
      if (data.parent_guardian_name.length > 200) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Parent / Guardian Name must not exceed 200 characters.',
          path: ['parent_guardian_name'],
        });
      } else if (!NAME_REGEX.test(data.parent_guardian_name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Parent / Guardian Name can only contain letters, spaces, hyphens, and periods.',
          path: ['parent_guardian_name'],
        });
      } else if (DANGEROUS_INJECTION_PATTERN.test(data.parent_guardian_name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid characters detected in Parent / Guardian Name.',
          path: ['parent_guardian_name'],
        });
      }
    }

    if (data.contact_number && data.contact_number.trim()) {
      if (!PHONE_REGEX.test(data.contact_number.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Contact Number must be exactly 11 digits (e.g. 09123456789).',
          path: ['contact_number'],
        });
      }
    }
  } else {
    if (!data.email || !data.email.trim() || !z.string().email().safeParse(data.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A valid email address is required.',
        path: ['email'],
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
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successToastTitle, setSuccessToastTitle] = useState('Changes Saved Successfully');
  const [successToastMessage, setSuccessToastMessage] = useState('User profile has been updated.');
  const [errorToast, setErrorToast] = useState<{ title: string; message: string } | null>(null);

  // Auto-dismiss error floating toast notification after 4 seconds (matches TutorScores toast behavior)
  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => {
      setErrorToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [errorToast]);

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
  // - Basic: English is unavailable, replaced by Filipino (value="Filipino")
  // - Plus: Filipino is unavailable, replaced by English (value="English")
  // - Math and Science remain untouched
  useEffect(() => {
    if (!isLoading && selectedRole === 'student') {
      if (watchedStudentAralLevel === 'plus' && (watchedStudentSubject === 'Filipino' || watchedStudentSubject === 'Reading')) {
        setValue('subject', 'English');
      } else if (watchedStudentAralLevel === 'basic' && watchedStudentSubject === 'English') {
        setValue('subject', 'Filipino');
      }
    }
  }, [isLoading, selectedRole, watchedStudentAralLevel, watchedStudentSubject, setValue]);

  // Tutor modular role details state (connecting ARAL Level, Grade Level, Subject, and Sections)
  const [tutorRoleDetails, setTutorRoleDetails] = useState<TutorRoleDetailGroup[]>([createDefaultRoleDetail()]);
  const [tutorGroupErrors, setTutorGroupErrors] = useState<Record<string, string>>({});

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
          const loadedGroups = parseTutorRoleDetailsFromUser(userData);
          setTutorRoleDetails(loadedGroups);
        }

        let initialGrade = 'GRADE 7';
        let initialSection = '';
        if (userData.role === 'student' && userData.grade_level) {
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
          subject: (userData.aral_level === 'plus' && (!userData.subject || userData.subject === 'Reading' || userData.subject === 'Filipino'))
            ? 'English'
            : (userData.aral_level !== 'plus' && userData.subject === 'English')
            ? 'Filipino'
            : (userData.subject === 'Reading' ? 'Filipino' : (userData.subject || 'Filipino')),
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
    setErrorToast(null);
    try {
      if (data.role === 'tutor') {
        const groupErrors: Record<string, string> = {};
        tutorRoleDetails.forEach((group, idx) => {
          if (!group.aralLevel) {
            groupErrors[`group_${idx}`] = 'Please select an ARAL Level (BASIC or PLUS).';
          } else if (group.subjects.length === 0) {
            groupErrors[`group_${idx}`] = 'Please select at least one assigned subject.';
          } else if (!group.gradeLevel) {
            groupErrors[`group_${idx}`] = 'Please select an assigned grade level.';
          } else {
            const validSecs = group.sections.map((s) => s.trim()).filter(Boolean);
            if (validSecs.length === 0) {
              groupErrors[`group_${idx}`] = `Please enter at least one assigned section for ${group.gradeLevel}.`;
            }
          }
        });

        if (Object.keys(groupErrors).length > 0) {
          setTutorGroupErrors(groupErrors);
          const firstErr = Object.values(groupErrors)[0];
          setErrorToast({
            title: 'Role Details Incomplete',
            message: firstErr || 'Please check the assigned ARAL level, subject, grade, or sections in each role detail group.',
          });
          setIsSubmitting(false);
          return;
        }
        setTutorGroupErrors({});
      }

      let combinedGradeLevel = '';
      let tutorAralLevel = data.aral_level || 'basic';
      let tutorTutorType = data.aral_level || 'basic';
      let tutorSubject = data.subject || 'Filipino';

      if (data.role === 'tutor') {
        const computed = buildTutorPayloadFromRoleDetails(tutorRoleDetails);
        combinedGradeLevel = computed.grade_level;
        tutorAralLevel = computed.aral_level;
        tutorTutorType = computed.tutor_type;
        tutorSubject = computed.subject;
      } else if (data.role === 'student') {
        const sectionStr = data.grade_level_section ? data.grade_level_section.toUpperCase().trim() : '';
        const gradeStr = data.grade_level_grade ? data.grade_level_grade.toUpperCase().trim() : 'GRADE 7';
        combinedGradeLevel = sectionStr ? `${gradeStr} - ${sectionStr}` : gradeStr;
      }

      const payload: any = {
        ...data,
        first_name: data.first_name.toUpperCase().trim(),
        middle_name: data.middle_name ? data.middle_name.toUpperCase().trim() : '',
        last_name: data.last_name.toUpperCase().trim(),
        parent_guardian_name: data.role === 'student' && data.parent_guardian_name ? data.parent_guardian_name.toUpperCase().trim() : '',
        contact_number: data.role === 'student' && data.contact_number ? data.contact_number.trim() : '',
        grade_level: combinedGradeLevel,
        has_bosy: !!data.has_bosy,
        has_mosy: !!data.has_mosy,
        has_eosy: !!data.has_eosy,
        has_summer: !!data.has_summer,
        assigned_tutor: data.role === 'student' && data.assigned_tutor ? data.assigned_tutor : null,
        lrn: data.role === 'student' && data.lrn ? data.lrn.trim() : null,
        subject: tutorSubject,
        aral_level: tutorAralLevel,
        tutor_type: tutorTutorType,
      };

      if (data.role !== 'student') {
        payload.lrn = null;
        payload.assigned_tutor = null;
        payload.parent_guardian_name = '';
        payload.contact_number = '';
      }
      delete payload.grade_level_grade;
      delete payload.grade_level_section;

      try {
        await userService.updateUser(id, payload);
      } catch (primaryErr: any) {
        const errData = primaryErr.response?.data;
        if (
          errData &&
          (errData.aral_level || errData.tutor_type || errData.subject || errData.grade_level)
        ) {
          const fallbackPayload = { ...payload };
          if (errData.aral_level || errData.tutor_type) {
            const hasBasic = tutorRoleDetails.some((g) => g.aralLevel === 'basic');
            fallbackPayload.aral_level = hasBasic ? 'basic' : 'plus';
            fallbackPayload.tutor_type = hasBasic ? 'basic' : 'plus';
          }
          if (errData.subject && fallbackPayload.subject?.includes(',')) {
            fallbackPayload.subject = fallbackPayload.subject.includes('Filipino') ? 'Filipino' : 'English';
          } else if (errData.subject && fallbackPayload.subject === 'Filipino') {
            fallbackPayload.subject = 'Reading';
          }
          if (errData.grade_level && combinedGradeLevel.includes(',')) {
            fallbackPayload.grade_level = combinedGradeLevel.replace(/,\s*/g, ' - ');
            if (fallbackPayload.grade_level.length > 98) {
              fallbackPayload.grade_level = fallbackPayload.grade_level.slice(0, 98);
            }
          }
          await userService.updateUser(id, fallbackPayload);
        } else {
          throw primaryErr;
        }
      }

      const roleTitle = data.role ? data.role.charAt(0).toUpperCase() + data.role.slice(1) : 'User';
      setSuccessToastTitle(`${roleTitle} Changes Saved Successfully`);
      setSuccessToastMessage(
        data.role === 'tutor'
          ? 'The tutor profile and assigned cohort details have been updated successfully.'
          : `The ${roleTitle.toLowerCase()} profile and assignments have been updated successfully.`
      );
      setShowSuccessToast(true);

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

      setTimeout(() => {
        navigate(getBackPath(), {
          state: {
            toastNotification: {
              show: true,
              type: 'success',
              title: `${roleTitle} Changes Saved Successfully`,
              message:
                data.role === 'tutor'
                  ? 'The tutor profile and assigned cohort details have been updated successfully.'
                  : `The ${roleTitle.toLowerCase()} profile and assignments have been updated successfully.`,
            },
          },
        });
      }, 2200);
    } catch (error: any) {
      console.error('Update user error:', error);
      const errorsPayload = error.response?.data;
      let errorMsg = 'An unexpected error occurred while updating the user record.';
      if (errorsPayload && typeof errorsPayload === 'object') {
        setServerErrors(errorsPayload);
        const firstField = Object.keys(errorsPayload)[0];
        const val = errorsPayload[firstField];
        const detail = Array.isArray(val) ? val.join(' ') : String(val);
        errorMsg = firstField === 'detail' ? detail : `${firstField.replace(/_/g, ' ').toUpperCase()}: ${detail}`;
      } else if (error.message) {
        errorMsg = error.message;
      }
      setErrorToast({
        title: 'Unable to Save Changes',
        message: errorMsg,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismissToast = () => {
    setShowSuccessToast(false);
    const role = watch('role') || userInitialData?.role;
    let target = '/admin/students';
    if (currentUser?.is_superuser) {
      if (role === 'student') target = '/superadmin/students';
      else if (role === 'tutor') target = '/superadmin/tutors';
      else if (role === 'faculty') target = '/superadmin/faculty';
      else if (role === 'principal') target = '/superadmin/principals';
      else if (role === 'admin') target = '/superadmin/admins';
      else target = '/superadmin/superadmins';
    } else {
      if (role === 'principal') target = '/admin/principals';
      else if (role === 'faculty') target = '/admin/faculty';
      else if (role === 'tutor') target = '/admin/tutors';
    }
    navigate(target, {
      state: {
        toastNotification: {
          show: true,
          type: 'success',
          title: successToastTitle,
          message: successToastMessage,
        },
      },
    });
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

        {serverErrors && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-xs rounded-md p-3 space-y-1.5">
            {Object.entries(serverErrors).map(([key, val]) => (
              <div key={key} className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span>
                  {key !== 'detail' && <strong>{key.replace(/_/g, ' ').toUpperCase()}: </strong>}
                  {Array.isArray(val) ? val.join(' ') : String(val)}
                </span>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit, (errs) => {
            console.error('Validation errors:', errs);
            const firstKey = Object.keys(errs)[0];
            const firstErr = (errs as any)[firstKey];
            const message = firstErr?.message || 'Please check the required fields in the form.';
            setErrorToast({
              title: 'Form Validation Error',
              message: String(message),
            });
          })}
          className="space-y-6"
        >
          {/* ── Section 1: Personal Information ─────────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
              Personal Information
            </h4>
            <div className={`grid grid-cols-1 gap-4 ${selectedRole !== 'student' ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
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
                  {...register('middle_name', {
                    onBlur: (e) => {
                      const val = e.target.value?.trim();
                      if (val && val.length <= 2 && !val.endsWith('.')) {
                        setValue('middle_name', `${val.toUpperCase()}.`);
                      }
                    },
                  })}
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

              {/* For Staff: Google Email Address is placed directly in Personal Information */}
              {selectedRole !== 'student' && (
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Google Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder={
                      selectedRole === 'tutor'
                        ? 'e.g. tutor@bicol-u.edu.ph'
                        : selectedRole === 'faculty'
                        ? 'e.g. faculty@bicol-u.edu.ph'
                        : selectedRole === 'principal'
                        ? 'e.g. principal@bicol-u.edu.ph'
                        : selectedRole === 'admin'
                        ? 'e.g. admin@bicol-u.edu.ph'
                        : 'e.g. user@bicol-u.edu.ph'
                    }
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

          {/* ── Section 2: Tutor Role Details & Assignment Groups ──────── */}
          {selectedRole === 'tutor' && (
            <div className="border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
              <TutorRoleDetailsSection
                groups={tutorRoleDetails}
                onChange={setTutorRoleDetails}
                errors={tutorGroupErrors}
              />
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
                    <option value="summer">SUMMER</option>
                    <option value="graduated">GRADUATED (Archive)</option>
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
                    {watchedStudentAralLevel === 'plus' || watchedStudentAralLevel === 'graduated' ? (
                      <option value="English">ENGLISH (for Plus/Graduated)</option>
                    ) : (
                      <option value="Filipino">FILIPINO (for Basic)</option>
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
                    disabled={isLoading}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-xs bg-white dark:bg-[#111111] dark:text-slate-100 cursor-pointer ${
                      errors.assigned_tutor || serverErrors?.assigned_tutor ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                    } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="">{isLoading ? 'Loading available tutors...' : 'To Be Assigned (TBA)'}</option>
                    {matchingTutors.map((tutor) => (
                      <option key={tutor.id} value={tutor.id}>
                        {formatTutorAssignmentOption(tutor)}
                      </option>
                    ))}
                  </select>
                  {(errors.assigned_tutor || serverErrors?.assigned_tutor) && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {errors.assigned_tutor?.message || serverErrors?.assigned_tutor?.[0]}
                    </p>
                  )}
                  {!isLoading && matchingTutors.length === 0 && (
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
                      Parent / Guardian Name
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
                      Contact Number
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

      {/* ── Saved Changes Floating Notification Toast (Matches TutorScores Score Success Notification) ── */}
      {showSuccessToast && (
        <aside
          aria-live="polite"
          className="fixed top-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-white dark:bg-[#111111] dark:border-emerald-800 p-3.5 shadow-xl">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-gray-900 dark:text-slate-100">
                  {successToastTitle}
                </h3>
                <button
                  type="button"
                  onClick={handleDismissToast}
                  className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  aria-label="Close notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
                {successToastMessage}
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* ── Error / Validation Floating Notification Toast (Matches TutorScores Validation Toast) ── */}
      {errorToast && (
        <aside
          aria-live="assertive"
          className="fixed top-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div className="flex items-start gap-3 rounded-lg border border-rose-300 dark:border-rose-700/80 bg-white dark:bg-[#111111] p-3.5 shadow-xl">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-gray-900 dark:text-slate-100">
                  {errorToast.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setErrorToast(null)}
                  className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  aria-label="Close error notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
                {errorToast.message}
              </p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default EditUser;
