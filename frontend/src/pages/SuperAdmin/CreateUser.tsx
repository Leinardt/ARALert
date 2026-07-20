import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { userService } from '../../services/userService';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const createUserSchema = z.object({
  first_name: z.string().min(1, 'First Name is required.'),
  last_name: z.string().min(1, 'Last Name is required.'),
  email: z.string().email('Invalid email address.'),
  role: z.enum(['admin', 'principal', 'faculty', 'tutor'], {
    message: 'Please select a valid role.',
  }),
  is_active: z.boolean(),
});

type CreateUserFields = z.infer<typeof createUserSchema>;

export const CreateUser: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserFields>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      role: 'faculty',
      is_active: false,
    },
  });

  const onSubmit = async (data: CreateUserFields) => {
    setIsSubmitting(true);
    setServerErrors(null);
    try {
      const payload = {
        ...data,
        is_active: false,
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

          <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Invitation-Based Account Setup</p>
              <p className="text-xs text-indigo-700 mt-1">
                The account will be created as pending setup. The user will receive an email invitation to choose their username and password and activate the account.
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
                    <option value="tutor">Tutor</option>
                    <option value="faculty">Faculty</option>
                    <option value="principal">Principal</option>
                    <option value="admin">School Admin</option>
                  </>
                ) : null}
              </select>
              {errors.role && (
                <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>
              )}
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
