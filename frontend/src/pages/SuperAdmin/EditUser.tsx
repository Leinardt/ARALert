import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userService } from '../../services/userService';
import type { User } from '../../types';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const editUserSchema = z.object({
  first_name: z.string().min(1, 'First Name is required.'),
  last_name: z.string().min(1, 'Last Name is required.'),
  username: z.string().min(3, 'Username must be at least 3 characters.'),
  email: z.string().email('Invalid email address.'),
  role: z.enum(['admin', 'principal', 'faculty', 'tutor', 'student'], {
    message: 'Please select a valid role.',
  }),
  lrn: z.string().optional(),
  is_active: z.boolean(),
}).refine((data) => {
  if (data.role === 'student') {
    return !!data.lrn && /^\d{12}$/.test(data.lrn);
  }
  return true;
}, {
  message: 'LRN must be exactly 12 digits.',
  path: ['lrn'],
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
    const fetchUser = async () => {
      if (!id) return;
      try {
        const user: User = await userService.getUser(id);
        reset({
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          email: user.email,
          role: user.role as EditUserFields['role'],
          lrn: user.lrn || '',
          is_active: user.is_active,
        });
      } catch (err) {
        console.error(err);
        setFetchError('User not found or could not be loaded.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [id, reset]);

  const onSubmit = async (data: EditUserFields) => {
    if (!id) return;
    setIsSubmitting(true);
    setServerErrors(null);
    try {
      await userService.updateUser(id, data);
      navigate(currentUser?.is_superuser ? '/superadmin/users' : '/admin/students');
    } catch (error: any) {
      console.error(error);
      const errorsPayload = error.response?.data?.errors;
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
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-4">
        <Link
          to={currentUser?.is_superuser ? '/superadmin/users' : '/admin/students'}
          className="text-gray-500 hover:text-indigo-600 inline-flex items-center text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to {currentUser?.is_superuser ? 'Directory' : 'Student Directory'}
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">{fetchError}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        to={currentUser?.is_superuser ? '/superadmin/users' : '/admin/students'}
        className="text-gray-500 hover:text-indigo-600 inline-flex items-center text-sm font-semibold transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to {currentUser?.is_superuser ? 'Directory' : 'Student Directory'}
      </Link>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-6">
          {currentUser?.is_superuser ? 'Edit User' : 'Edit Student'}
        </h2>

        {serverErrors?.detail && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md p-3 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{Array.isArray(serverErrors.detail) ? serverErrors.detail[0] : serverErrors.detail}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="first_name" className="block text-sm font-semibold text-gray-700">First Name</label>
              <input id="first_name" type="text" {...register('first_name')}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${errors.first_name || serverErrors?.first_name ? 'border-red-300' : 'border-gray-300'}`}
              />
              {(errors.first_name || serverErrors?.first_name) && (
                <p className="mt-1 text-xs text-red-600">{errors.first_name?.message || serverErrors?.first_name?.[0]}</p>
              )}
            </div>
            <div>
              <label htmlFor="last_name" className="block text-sm font-semibold text-gray-700">Last Name</label>
              <input id="last_name" type="text" {...register('last_name')}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${errors.last_name || serverErrors?.last_name ? 'border-red-300' : 'border-gray-300'}`}
              />
              {(errors.last_name || serverErrors?.last_name) && (
                <p className="mt-1 text-xs text-red-600">{errors.last_name?.message || serverErrors?.last_name?.[0]}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700">Username</label>
              <input id="username" type="text" {...register('username')}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${errors.username || serverErrors?.username ? 'border-red-300' : 'border-gray-300'}`}
              />
              {(errors.username || serverErrors?.username) && (
                <p className="mt-1 text-xs text-red-600">{errors.username?.message || serverErrors?.username?.[0]}</p>
              )}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Email</label>
              <input id="email" type="email" {...register('email')}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${errors.email || serverErrors?.email ? 'border-red-300' : 'border-gray-300'}`}
              />
              {(errors.email || serverErrors?.email) && (
                <p className="mt-1 text-xs text-red-600">{errors.email?.message || serverErrors?.email?.[0]}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="role" className="block text-sm font-semibold text-gray-700">System Role</label>
              <select id="role" {...register('role')}
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
              {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
            </div>
            <div className="flex items-center mt-6">
              <input id="is_active" type="checkbox" {...register('is_active')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                Account Status (Active)
              </label>
            </div>
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
            <Link to={currentUser?.is_superuser ? '/superadmin/users' : '/admin/students'}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-50 transition-colors"
            >Cancel</Link>
            <button type="submit" disabled={isSubmitting}
              className="bg-indigo-600 text-white px-5 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700 shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
            >{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
