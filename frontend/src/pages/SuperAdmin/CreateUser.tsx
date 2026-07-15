import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const createUserSchema = z.object({
  first_name: z.string().min(1, 'First Name is required.'),
  last_name: z.string().min(1, 'Last Name is required.'),
  username: z.string().min(3, 'Username must be at least 3 characters.'),
  email: z.string().email('Invalid email address.'),
  role: z.enum(['admin', 'principal', 'faculty', 'tutor', 'student'], {
    message: 'Please select a valid role.',
  }),
  lrn: z.string().optional(),
  is_active: z.boolean(),
  assigned_tutor: z.string().optional().nullable(),
}).refine((data) => {
  if (data.role === 'student') {
    return !!data.lrn && /^\d{12}$/.test(data.lrn);
  }
  return true;
}, {
  message: 'LRN must be exactly 12 digits.',
  path: ['lrn'],
});

type CreateUserFields = z.infer<typeof createUserSchema>;

export const CreateUser: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tutors, setTutors] = useState<User[]>([]);

  // Fetch Tutors to populate dropdown
  useEffect(() => {
    const fetchTutors = async () => {
      try {
        const data = await userService.getTutors();
        setTutors(data);
      } catch (err) {
        console.error('Failed to load tutors list', err);
      }
    };
    fetchTutors();
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateUserFields>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      username: '',
      email: '',
      role: currentUser?.is_superuser ? 'faculty' : 'student',
      lrn: '',
      is_active: true,
      assigned_tutor: '',
    },
  });

  const selectedRole = watch('role');
  const watchFirstName = watch('first_name');
  const watchLastName = watch('last_name');
  const watchUsername = watch('username');

  const getGeneratedPasswordPreview = () => {
    if (!watchFirstName && !watchLastName && !watchUsername) {
      return '[LastName][FirstInitial]@[Username]';
    }
    const cleanLast = watchLastName ? watchLastName.replace(/[^a-zA-Z0-9]/g, '') : '';
    const cleanFirst = watchFirstName ? watchFirstName.replace(/[^a-zA-Z0-9]/g, '') : '';
    const cleanUser = watchUsername ? watchUsername.replace(/[^a-zA-Z0-9]/g, '') : '';

    const capitalizedLast = cleanLast ? cleanLast.charAt(0).toUpperCase() + cleanLast.slice(1).toLowerCase() : '';
    const firstInitial = cleanFirst ? cleanFirst.charAt(0).toUpperCase() : 'X';

    let pwd = `${capitalizedLast}${firstInitial}@${cleanUser}`;
    if (pwd.length < 8) {
      pwd = pwd + "123".substring(0, 8 - pwd.length);
    }
    return pwd;
  };

  const onSubmit = async (data: CreateUserFields) => {
    setIsSubmitting(true);
    setServerErrors(null);
    try {
      const payload = {
        ...data,
        assigned_tutor: data.role === 'student' && data.assigned_tutor ? data.assigned_tutor : null,
      };
      await userService.createUser(payload);
      navigate(currentUser?.is_superuser ? '/superadmin/users' : '/admin/students');
    } catch (error: any) {
      console.error(error);
      const errorsPayload = error.response?.data?.errors;
      if (errorsPayload && typeof errorsPayload === 'object') {
        setServerErrors(errorsPayload);
      } else {
        alert('An unexpected error occurred while creating user.');
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
          className="text-gray-500 hover:text-indigo-600 inline-flex items-center text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to {currentUser?.is_superuser ? 'Directory' : 'Student Directory'}
        </Link>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-6">
          {currentUser?.is_superuser ? 'Create New User' : 'Enroll New Student'}
        </h2>

        {serverErrors?.detail && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md p-3 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{serverErrors.detail}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* First Name */}
            <div>
              <label htmlFor="first_name" className="block text-sm font-semibold text-gray-700">
                First Name
              </label>
              <input
                id="first_name"
                type="text"
                {...register('first_name')}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                  errors.first_name || serverErrors?.first_name ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {(errors.first_name || serverErrors?.first_name) && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.first_name?.message || serverErrors?.first_name?.[0]}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="last_name" className="block text-sm font-semibold text-gray-700">
                Last Name
              </label>
              <input
                id="last_name"
                type="text"
                {...register('last_name')}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700">
                Username
              </label>
              <input
                id="username"
                type="text"
                {...register('username')}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                  errors.username || serverErrors?.username ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {(errors.username || serverErrors?.username) && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.username?.message || serverErrors?.username?.[0]}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                  errors.email || serverErrors?.email ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {(errors.email || serverErrors?.email) && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.email?.message || serverErrors?.email?.[0]}
                </p>
              )}
            </div>
          </div>

          {/* Dynamic Auto-generated Password Banner */}
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Automatic Password Generation</p>
              <p className="text-xs text-indigo-700 mt-1">
                The account password is automatically generated based on the user's details. The user can adjust their password later from their profile page.
              </p>
              <p className="text-xs text-indigo-700 mt-2">
                Format: <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono">[LastName][FirstInitial]@[Username]</code>
              </p>
              <p className="text-sm font-mono mt-2 font-semibold">
                Generated Password: <span className="bg-indigo-100 px-2 py-1 rounded text-indigo-900 border border-indigo-300 select-all font-bold">{getGeneratedPasswordPreview()}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-semibold text-gray-700">
                System Role
              </label>
              <select
                id="role"
                {...register('role')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
              >
                {currentUser?.is_superuser ? (
                  <>
                    <option value="student">Student</option>
                    <option value="tutor">Tutor</option>
                    <option value="faculty">Faculty</option>
                    <option value="principal">Principal</option>
                    <option value="admin">School Admin</option>
                  </>
                ) : (
                  <option value="student">Student</option>
                )}
              </select>
              {errors.role && (
                <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>
              )}
            </div>

            {/* Assigned Tutor selection — visible only when role is student */}
            {selectedRole === 'student' && (
              <div>
                <label htmlFor="assigned_tutor" className="block text-sm font-semibold text-gray-700">
                  Assigned Tutor
                </label>
                <select
                  id="assigned_tutor"
                  {...register('assigned_tutor')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
                >
                  <option value="">No Tutor Assigned</option>
                  {tutors.map((tutor) => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.full_name} ({tutor.email})
                    </option>
                  ))}
                </select>
                {errors.assigned_tutor && (
                  <p className="mt-1 text-xs text-red-600">{errors.assigned_tutor.message}</p>
                )}
              </div>
            )}
          </div>

          {/* LRN Field — visible only when role is student */}
          {selectedRole === 'student' && (
            <div className="max-w-sm">
              <label htmlFor="lrn" className="block text-sm font-semibold text-gray-700">
                Learner Reference Number (LRN)
              </label>
              <input
                id="lrn"
                type="text"
                maxLength={12}
                placeholder="e.g. 123456789012"
                {...register('lrn')}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                  errors.lrn || serverErrors?.lrn ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {(errors.lrn || serverErrors?.lrn) && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.lrn?.message || serverErrors?.lrn?.[0]}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">12-digit number assigned by DepEd.</p>
            </div>
          )}

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
              className="bg-indigo-600 text-white px-5 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700 shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Registering...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
