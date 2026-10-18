import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { ArrowLeft, AlertCircle, Plus, Trash2, CheckCircle2, X, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  isTutorEligibleForStudent,
  formatTutorAssignmentOption,
  TutorRoleDetailGroup,
  createDefaultRoleDetail,
  buildTutorPayloadFromRoleDetails,
} from '../../utils/tutorCohortHelpers';
import { TutorRoleDetailsSection } from '../../components/TutorRoleDetailsSection';
import { BatchStudentEnrollmentModal } from '../../components/BatchStudentEnrollmentModal';

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
  const cachedInitialTutors = userService.getCachedTutors();
  const [tutors, setTutors] = useState<User[]>(cachedInitialTutors || []);
  const [isLoadingTutors, setIsLoadingTutors] = useState(!cachedInitialTutors);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Floating Toast Notifications (Matches EditUser toast feedback system)
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successToastTitle, setSuccessToastTitle] = useState('Account Registered Successfully');
  const [successToastMessage, setSuccessToastMessage] = useState('User account has been registered.');
  const [errorToast, setErrorToast] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => {
      setErrorToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [errorToast]);

  const handleDismissToast = () => {
    setShowSuccessToast(false);
    navigate(getBackLink(), {
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
      grade_level_section: '',
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

  // Tutor modular role details state (connecting ARAL Level, Grade Level, Subject, and Sections)
  const [tutorRoleDetails, setTutorRoleDetails] = useState<TutorRoleDetailGroup[]>([createDefaultRoleDetail()]);
  const [tutorGroupErrors, setTutorGroupErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isSuperUser && (requestedRole === 'admin' || requestedRole === 'superadmin')) {
      navigate('/admin/students', { replace: true });
    }
  }, [isSuperUser, requestedRole, navigate]);

  useEffect(() => {
    let isMounted = true;
    const loadTutors = async () => {
      if (!userService.getCachedTutors()) {
        setIsLoadingTutors(true);
      }
      try {
        const response = await userService.getTutors();
        if (isMounted) {
          setTutors(response);
        }
      } catch (error) {
        console.error('Failed to load tutors', error);
      } finally {
        if (isMounted) {
          setIsLoadingTutors(false);
        }
      }
    };

    loadTutors();
    return () => {
      isMounted = false;
    };
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
          setIsSubmitting(false);
          return;
        }
        setTutorGroupErrors({});
      }

      let combinedGradeLevel = '';
      let tutorAralLevel = data.aral_level || 'basic';
      let tutorTutorType = data.aral_level || 'basic';
      let tutorSubject = data.subject || 'Filipino';

      if (selectedRole === 'tutor') {
        const computed = buildTutorPayloadFromRoleDetails(tutorRoleDetails);
        combinedGradeLevel = computed.grade_level;
        tutorAralLevel = computed.aral_level;
        tutorTutorType = computed.tutor_type;
        tutorSubject = computed.subject;
      } else if (selectedRole === 'student') {
        const sectionStr = data.grade_level_section ? data.grade_level_section.toUpperCase().trim() : '';
        const gradeStr = data.grade_level_grade ? data.grade_level_grade.toUpperCase().trim() : 'GRADE 7';
        combinedGradeLevel = sectionStr ? `${gradeStr} - ${sectionStr}` : gradeStr;
      }

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

      try {
        await userService.createUser(payload);
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
          await userService.createUser(fallbackPayload);
        } else {
          throw primaryErr;
        }
      }
      const roleTitle = selectedRole ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1) : 'User';
      const successTitle = selectedRole === 'student' ? 'Student Enrolled Successfully' : `${roleTitle} Registered Successfully`;
      const successMessage =
        selectedRole === 'student'
          ? 'The student has been enrolled and registered into the system successfully.'
          : selectedRole === 'tutor'
            ? 'The tutor account and cohort assignments have been created successfully.'
            : `The ${roleTitle.toLowerCase()} account has been created successfully.`;

      setSuccessToastTitle(successTitle);
      setSuccessToastMessage(successMessage);
      setShowSuccessToast(true);

      const targetPath = getBackLink();
      setTimeout(() => {
        navigate(targetPath, {
          state: {
            toastNotification: {
              show: true,
              type: 'success',
              title: successTitle,
              message: successMessage,
            },
          },
        });
      }, 2200);
    } catch (error: any) {
      console.error(error);
      const errorsPayload = error.response?.data;
      if (errorsPayload && typeof errorsPayload === 'object') {
        setServerErrors(errorsPayload);
        const firstKey = Object.keys(errorsPayload)[0];
        const firstVal = Array.isArray(errorsPayload[firstKey]) ? errorsPayload[firstKey][0] : errorsPayload[firstKey];
        setErrorToast({
          title: 'Registration Failed',
          message: typeof firstVal === 'string' ? firstVal : 'Please check the highlighted errors in the form.',
        });
      } else {
        setErrorToast({
          title: 'Registration Error',
          message: error?.response?.data?.detail || 'An unexpected error occurred while creating the account.',
        });
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
        <div className="mb-5 border-b border-slate-100 dark:border-[#1A1A1A] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">
            {headingInfo.title}
          </h2>
          {selectedRole === 'student' && (
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-md bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Import List for Batch Enrollment
            </button>
          )}
        </div>

        {serverErrors?.detail && (
          <div className="mb-4 flex items-start space-x-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <span>{serverErrors.detail}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit, (formErrors) => {
            const firstKey = Object.keys(formErrors)[0];
            const firstErr = formErrors[firstKey as keyof CreateUserFields];
            if (firstErr?.message) {
              setErrorToast({
                title: 'Missing Required Information',
                message: firstErr.message,
              });
            }
          })}
          className="space-y-5"
        >
          {/* Hidden input to preserve role without showing redundant dropdown */}
          <input type="hidden" {...register('role')} value={selectedRole} />

          {/* ── Section 1: Personal Information ─────────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
              Personal Information
            </h4>
            <div className={`grid grid-cols-1 gap-4 ${selectedRole !== 'student' ? 'sm:grid-cols-2 md:grid-cols-4' : 'sm:grid-cols-3'}`}>
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
                  Middle Name (M.I.) <span className="font-normal text-gray-400 dark:text-slate-500">(optional)</span>
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
                  className="w-full rounded-md border border-gray-300 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-3 py-2 text-xs font-medium uppercase shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:text-slate-100"
                />
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

          {/* ── Section 2: Role Details & Assignment Groups (for Tutors) ── */}
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
            <>
              <div className="space-y-3 border-t border-gray-100 dark:border-[#1A1A1A] pt-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                  ARAL PROGRAM DETAILS &amp; TUTOR ASSIGNMENT
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
                      disabled={isLoadingTutors}
                      className={`w-full rounded-md border px-3 py-2 text-xs font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:bg-[#111111] dark:text-slate-100 cursor-pointer ${
                        errors.assigned_tutor || serverErrors?.assigned_tutor ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-[#1A1A1A]'
                      } ${isLoadingTutors ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <option value="">{isLoadingTutors ? 'Loading available tutors...' : 'To Be Assigned (TBA)'}</option>
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
                    {!isLoadingTutors && matchingTutors.length === 0 && (
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

      {/* ── Saved Changes Floating Notification Toast (Matches EditUser / TutorScores Toast System) ── */}
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

      {/* ── Error / Validation Floating Notification Toast (Matches EditUser / TutorScores Validation Toast) ── */}
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
      {/* ── Batch Student Enrollment Modal (DepEd BOSY Excel List Import) ── */}
      <BatchStudentEnrollmentModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        tutors={tutors}
        onEnrollmentSuccess={(count) => {
          setSuccessToastTitle('Batch Enrollment Completed');
          setSuccessToastMessage(`Successfully enrolled ${count} student${count === 1 ? '' : 's'} into the system.`);
          setShowSuccessToast(true);
          setTimeout(() => {
            navigate(getBackLink(), {
              state: {
                toastNotification: {
                  show: true,
                  type: 'success',
                  title: 'Batch Enrollment Completed',
                  message: `Successfully enrolled ${count} student${count === 1 ? '' : 's'} into the system.`,
                },
              },
            });
          }, 2000);
        }}
      />
    </div>
  );
};

export default CreateUser;
