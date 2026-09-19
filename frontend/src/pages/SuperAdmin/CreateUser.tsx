import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { ArrowLeft, AlertCircle, CheckCircle2, UserCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const createUserSchema = z.object({
  first_name: z.string().min(1, 'First Name is required.'),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Last Name is required.'),
  email: z.string().optional(),
  role: z.enum(['admin', 'principal', 'faculty', 'tutor', 'student'], {
    message: 'Please select a valid role.',
  }),
  lrn: z.string().optional(),
  assigned_tutor: z.string().optional().nullable(),
  aral_level: z.string().optional(),
  subject: z.string().optional(),
}).refine((data) => {
  if (data.role === 'student') {
    return !!data.lrn && /^\d{12}$/.test(data.lrn);
  } else {
    return !!data.email && z.string().email().safeParse(data.email).success;
  }
}, {
  message: 'Valid Google email is required for staff accounts; 12-digit LRN is required for students.',
  path: ['email'],
});

type CreateUserFields = z.infer<typeof createUserSchema>;

export const CreateUser: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tutors, setTutors] = useState<User[]>([]);

  const searchParams = new URLSearchParams(location.search);
  const requestedRole = searchParams.get('role');
  const initialRole = (requestedRole === 'student' || requestedRole === 'tutor' || requestedRole === 'faculty' || requestedRole === 'admin' || requestedRole === 'principal')
    ? requestedRole
    : (currentUser?.is_superuser ? 'tutor' : 'student');

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
      assigned_tutor: '',
      aral_level: 'basic',
      subject: 'Reading',
    },
  });

  const selectedRole = watch('role');
  const isAdminView = Boolean(currentUser && !currentUser.is_superuser);

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

  const onSubmit = async (data: CreateUserFields) => {
    setIsSubmitting(true);
    setServerErrors(null);
    try {
      const payload = {
        ...data,
        role: isAdminView ? data.role : data.role,
        first_name: data.first_name.toUpperCase().trim(),
        middle_name: data.middle_name ? data.middle_name.toUpperCase().trim() : '',
        last_name: data.last_name.toUpperCase().trim(),
        assigned_tutor: data.role === 'student' && data.assigned_tutor ? data.assigned_tutor : null,
        subject: data.role === 'tutor' ? data.subject || 'Reading' : null,
      };
      await userService.createUser(payload);
      navigate(
        currentUser?.is_superuser
          ? '/superadmin/users'
          : data.role === 'tutor'
          ? '/admin/tutors'
          : data.role === 'faculty'
          ? '/admin/faculty'
          : '/admin/students'
      );
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

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="flex items-center space-x-2">
        <Link
          to={currentUser?.is_superuser ? '/superadmin/users' : '/admin/students'}
          className="inline-flex items-center text-sm font-semibold text-slate-500 transition-colors hover:text-blue-700"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to {currentUser?.is_superuser || currentUser?.role === 'admin' ? 'User Management' : 'Student Directory'}
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 font-heading">
              {currentUser?.is_superuser ? 'Pre-Register User Account' : 'Enroll New Account'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              {isAdminView
                ? selectedRole === 'student'
                  ? 'Create a student enrollment with the required LRN and tutor assignment details.'
                  : selectedRole === 'tutor'
                  ? 'Register a tutor with their Google email and assigned ARAL subject.'
                  : 'Register a faculty member with their Google email.'
                : selectedRole === 'student'
                  ? 'Enroll a student account with LRN. You can assign a tutor now or set assignment to TBA.'
                  : 'Pre-register a staff account by entering their Google email and role.'}
            </p>
          </div>
        </div>

        {serverErrors?.detail && (
          <div className="mb-4 flex items-start space-x-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <span>{serverErrors.detail}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!isAdminView ? (
            <div>
              <label htmlFor="role" className="mb-1 block text-sm font-semibold text-gray-700">
                System Role <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                {...register('role')}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-[var(--brand)] focus:outline-none focus:ring-[var(--brand)]"
              >
                <option value="tutor">Tutor</option>
                <option value="faculty">Faculty</option>
                <option value="principal">Principal</option>
                <option value="admin">School Admin</option>
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="role" className="mb-1 block text-sm font-semibold text-gray-700">
                Account Type <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                {...register('role')}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-[var(--brand)] focus:outline-none focus:ring-[var(--brand)]"
              >
                <option value="student">Student</option>
                <option value="tutor">Tutor</option>
                <option value="faculty">Faculty</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="first_name" className="mb-1 block text-sm font-semibold text-gray-700">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                id="first_name"
                type="text"
                placeholder="e.g. Juan"
                {...register('first_name')}
                className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-[var(--brand)] ${
                  errors.first_name || serverErrors?.first_name ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {(errors.first_name || serverErrors?.first_name) && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.first_name?.message || serverErrors?.first_name?.[0]}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="middle_name" className="mb-1 block text-sm font-semibold text-gray-700">
                Middle Name <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="middle_name"
                type="text"
                placeholder="e.g. Santos"
                {...register('middle_name')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-[var(--brand)]"
              />
            </div>

            <div>
              <label htmlFor="last_name" className="mb-1 block text-sm font-semibold text-gray-700">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                id="last_name"
                type="text"
                placeholder="e.g. Dela Cruz"
                {...register('last_name')}
                className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-[var(--brand)] ${
                  errors.last_name || serverErrors?.last_name ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {(errors.last_name || serverErrors?.last_name) && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.last_name?.message || serverErrors?.last_name?.[0]}
                </p>
              )}
            </div>
          </div>

          {selectedRole !== 'student' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-semibold text-gray-700">
                  Google Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="e.g. user@bicol-u.edu.ph"
                  {...register('email')}
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-[var(--brand)] ${
                    errors.email || serverErrors?.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {(errors.email || serverErrors?.email) && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.email?.message || serverErrors?.email?.[0]}
                  </p>
                )}
              </div>

              {selectedRole === 'tutor' && (
                <>
                  <div>
                    <label htmlFor="aral_level" className="mb-1 block text-sm font-semibold text-gray-700">
                      ARAL Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="aral_level"
                      {...register('aral_level')}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-[var(--brand)] focus:outline-none focus:ring-[var(--brand)]"
                    >
                      <option value="basic">ARAL Basic</option>
                      <option value="plus">ARAL Plus</option>
                      <option value="summer">ARAL Summer</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="subject" className="mb-1 block text-sm font-semibold text-gray-700">
                      Assigned Subject <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="subject"
                      {...register('subject')}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-[var(--brand)] focus:outline-none focus:ring-[var(--brand)]"
                    >
                      <option value="Reading">Reading</option>
                      <option value="Science">Science</option>
                      <option value="Math">Math</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {selectedRole === 'student' && (
            <div className="space-y-4 border-t border-gray-100 pt-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="lrn" className="mb-1 block text-sm font-semibold text-gray-700">
                    Learner Reference Number (LRN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lrn"
                    type="text"
                    {...register('lrn')}
                    maxLength={12}
                    placeholder="12-digit LRN"
                    className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-[var(--brand)] ${
                      errors.lrn || serverErrors?.lrn ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {(errors.lrn || serverErrors?.lrn) && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.lrn?.message || serverErrors?.lrn?.[0]}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="student_aral_level" className="mb-1 block text-sm font-semibold text-gray-700">
                    ARAL Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="student_aral_level"
                    {...register('aral_level')}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-[var(--brand)] focus:outline-none focus:ring-[var(--brand)]"
                  >
                    <option value="basic">ARAL Basic</option>
                    <option value="plus">ARAL Plus</option>
                    <option value="summer">ARAL Summer</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="assigned_tutor" className="block text-sm font-semibold text-gray-700 mb-1">
                    Assign Tutor
                  </label>
                  <select
                    id="assigned_tutor"
                    {...register('assigned_tutor')}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-[var(--brand)]"
                  >
                    <option value="">-- TBA (Unassigned) --</option>
                    {tutors.map((tutor) => (
                      <option key={tutor.id} value={tutor.id}>
                        {tutor.full_name || `${tutor.first_name} ${tutor.last_name}`} ({tutor.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start space-x-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold text-sm">
                {isAdminView ? 'Student Enrollment' : selectedRole === 'student' ? 'Student Enrollment' : 'Staff Pre-Registration'}
              </p>
              <p className="mt-1 text-emerald-800">
                {isAdminView
                  ? 'Students can be enrolled with their LRN and tutor assignment details for the school directory.'
                  : selectedRole === 'student'
                    ? 'Students log in using their Name and LRN. You can assign a tutor now or leave as TBA to bulk-assign later.'
                    : 'No password is required. The staff user can immediately click "Continue with Google" using this email to access their dashboard.'}
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <Link
              to={currentUser?.is_superuser ? '/superadmin/users' : '/admin/students'}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="cursor-pointer rounded-md bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-dark)] disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
