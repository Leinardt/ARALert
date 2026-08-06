import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  const { user: currentUser } = useAuth();
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tutors, setTutors] = useState<User[]>([]);

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
      role: currentUser?.is_superuser ? 'tutor' : 'student',
      lrn: '',
      assigned_tutor: '',
      aral_level: 'basic',
    },
  });

  const selectedRole = watch('role');

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
        first_name: data.first_name.toUpperCase().trim(),
        middle_name: data.middle_name ? data.middle_name.toUpperCase().trim() : '',
        last_name: data.last_name.toUpperCase().trim(),
        assigned_tutor: data.role === 'student' && data.assigned_tutor ? data.assigned_tutor : null,
      };
      await userService.createUser(payload);
      navigate(currentUser?.is_superuser ? '/superadmin/users' : '/admin/students');
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
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center space-x-2">
        <Link
          to={currentUser?.is_superuser ? '/superadmin/users' : '/admin/students'}
          className="text-gray-500 hover:text-[var(--brand)] inline-flex items-center text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to {currentUser?.is_superuser ? 'Directory' : 'Student Directory'}
        </Link>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          {currentUser?.is_superuser ? 'Pre-Register User Account' : 'Enroll New Student'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {selectedRole === 'student'
            ? 'Enroll a student account with LRN. You can assign a tutor now or set assignment to TBA.'
            : 'Pre-register a staff account by entering their Google email and role.'}
        </p>

        {serverErrors?.detail && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md p-3 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{serverErrors.detail}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Role selector */}
          <div>
            <label htmlFor="role" className="block text-sm font-semibold text-gray-700 mb-1">
              System Role <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              {...register('role')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] focus:border-[var(--brand)] text-sm bg-white font-medium"
            >
              {currentUser?.is_superuser ? (
                <>
                  <option value="tutor">Tutor</option>
                  <option value="faculty">Faculty</option>
                  <option value="principal">Principal</option>
                  <option value="admin">School Admin</option>
                </>
              ) : (
                <option value="student">Student</option>
              )}
            </select>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-semibold text-gray-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                id="first_name"
                type="text"
                placeholder="e.g. Juan"
                {...register('first_name')}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-sm ${
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
              <label htmlFor="middle_name" className="block text-sm font-semibold text-gray-700 mb-1">
                Middle Name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="middle_name"
                type="text"
                placeholder="e.g. Santos"
                {...register('middle_name')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-sm"
              />
            </div>

            <div>
              <label htmlFor="last_name" className="block text-sm font-semibold text-gray-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                id="last_name"
                type="text"
                placeholder="e.g. Dela Cruz"
                {...register('last_name')}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-sm ${
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

          {/* Email for staff */}
          {selectedRole !== 'student' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
                  Google Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="e.g. user@bicol-u.edu.ph"
                  {...register('email')}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-sm ${
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
                <div>
                  <label htmlFor="aral_level" className="block text-sm font-semibold text-gray-700 mb-1">
                    ARAL Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="aral_level"
                    {...register('aral_level')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-sm bg-white font-medium"
                  >
                    <option value="basic">ARAL Basic</option>
                    <option value="plus">ARAL Plus</option>
                    <option value="summer">ARAL Summer</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Student fields */}
          {selectedRole === 'student' && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="lrn" className="block text-sm font-semibold text-gray-700 mb-1">
                    Learner Reference Number (LRN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lrn"
                    type="text"
                    {...register('lrn')}
                    maxLength={12}
                    placeholder="12-digit LRN"
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-sm ${
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
                  <label htmlFor="student_aral_level" className="block text-sm font-semibold text-gray-700 mb-1">
                    ARAL Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="student_aral_level"
                    {...register('aral_level')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-sm bg-white font-medium"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] text-sm bg-white"
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

          {/* Info Banner */}
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm rounded-lg p-4 flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {selectedRole === 'student' ? 'Student Enrollment' : 'Staff Pre-Registration'}
              </p>
              <p className="text-xs text-emerald-800 mt-1">
                {selectedRole === 'student'
                  ? 'Students log in using their Name and LRN. You can assign a tutor now or leave as TBA to bulk-assign later.'
                  : 'No password is required. The staff user can immediately click "Continue with Google" using this email to access their dashboard.'}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 space-x-3">
            <Link
              to={currentUser?.is_superuser ? '/superadmin/users' : '/admin/students'}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[var(--brand)] text-white px-5 py-2 rounded-md text-sm font-semibold hover:bg-[var(--brand-dark)] shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Registering...' : 'Register Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
