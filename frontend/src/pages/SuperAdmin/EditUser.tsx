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
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Last Name is required.'),
  email: z.string().optional(),
  role: z.enum(['admin', 'principal', 'faculty', 'tutor', 'student'], {
    message: 'Please select a valid role.',
  }),
  lrn: z.string().optional(),
  is_active: z.boolean(),
  assigned_tutor: z.string().optional().nullable(),
  aral_level: z.string().optional(),
  subject: z.string().optional(),
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
  const [tutors, setTutors] = useState<User[]>([]);

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
    const loadData = async () => {
      if (!id) return;
      try {
        const [userData, tutorsData] = await Promise.all([
          userService.getUser(id),
          userService.getTutors(),
        ]);

        setTutors(tutorsData);
        reset({
          first_name: userData.first_name,
          middle_name: userData.middle_name || '',
          last_name: userData.last_name,
          email: userData.email,
          role: userData.role as EditUserFields['role'],
          lrn: userData.lrn || '',
          is_active: userData.is_active,
          assigned_tutor: userData.assigned_tutor || '',
          aral_level: userData.aral_level || 'basic',
          subject: userData.subject || 'Reading',
        });
      } catch (err) {
        console.error(err);
        setFetchError('User account not found or could not be loaded.');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [id, reset]);

  const onSubmit = async (data: EditUserFields) => {
    if (!id) return;
    setIsSubmitting(true);
    setServerErrors(null);
    try {
      const payload = {
        ...data,
        first_name: data.first_name.toUpperCase().trim(),
        middle_name: data.middle_name ? data.middle_name.toUpperCase().trim() : '',
        last_name: data.last_name.toUpperCase().trim(),
        assigned_tutor: data.role === 'student' && data.assigned_tutor ? data.assigned_tutor : null,
        subject: data.role === 'tutor' ? data.subject || 'Reading' : null,
      };
      await userService.updateUser(id, payload);
      navigate(currentUser?.is_superuser ? '/superadmin/users' : data.role === 'tutor' ? '/admin/tutors' : '/admin/students');
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
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
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
          Back to {currentUser?.is_superuser ? 'Directory' : 'Student Directory'}
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">{fetchError}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        to={currentUser?.is_superuser ? '/superadmin/users' : '/admin/students'}
        className="text-slate-500 hover:text-blue-700 inline-flex items-center text-sm font-semibold transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to {currentUser?.is_superuser ? 'Directory' : 'Student Directory'}
      </Link>

      <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-md">
        <h2 className="text-lg font-bold text-gray-900 mb-6">
          {currentUser?.is_superuser ? 'Edit User Profile' : 'Edit Student Record'}
        </h2>

        {serverErrors?.detail && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md p-3 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{Array.isArray(serverErrors.detail) ? serverErrors.detail[0] : serverErrors.detail}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-semibold text-gray-700">First Name</label>
              <input id="first_name" type="text" {...register('first_name')}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] sm:text-sm ${errors.first_name || serverErrors?.first_name ? 'border-red-300' : 'border-gray-300'}`}
              />
              {(errors.first_name || serverErrors?.first_name) && (
                <p className="mt-1 text-xs text-red-600">{errors.first_name?.message || serverErrors?.first_name?.[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="middle_name" className="block text-sm font-semibold text-gray-700">Middle Name <span className="font-normal text-gray-400">(optional)</span></label>
              <input id="middle_name" type="text" {...register('middle_name')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="last_name" className="block text-sm font-semibold text-gray-700">Last Name</label>
              <input id="last_name" type="text" {...register('last_name')}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] sm:text-sm ${errors.last_name || serverErrors?.last_name ? 'border-red-300' : 'border-gray-300'}`}
              />
              {(errors.last_name || serverErrors?.last_name) && (
                <p className="mt-1 text-xs text-red-600">{errors.last_name?.message || serverErrors?.last_name?.[0]}</p>
              )}
            </div>
          </div>

          {selectedRole !== 'student' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Google Email Address</label>
                <input id="email" type="email" {...register('email')}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] sm:text-sm ${errors.email || serverErrors?.email ? 'border-red-300' : 'border-gray-300'}`}
                />
                {(errors.email || serverErrors?.email) && (
                  <p className="mt-1 text-xs text-red-600">{errors.email?.message || serverErrors?.email?.[0]}</p>
                )}
              </div>

              {selectedRole === 'tutor' && (
                <>
                  <div>
                    <label htmlFor="aral_level" className="block text-sm font-semibold text-gray-700">ARAL Level</label>
                    <select id="aral_level" {...register('aral_level')}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] sm:text-sm bg-white font-medium"
                    >
                      <option value="basic">ARAL Basic</option>
                      <option value="plus">ARAL Plus</option>
                      <option value="summer">ARAL Summer</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="subject" className="block text-sm font-semibold text-gray-700">Assigned Subject</label>
                    <select id="subject" {...register('subject')}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] sm:text-sm bg-white font-medium"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="role" className="block text-sm font-semibold text-gray-700">System Role</label>
              <select id="role" {...register('role')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] sm:text-sm bg-white font-medium"
              >
                {currentUser?.is_superuser ? (
                  <>
                    <option value="tutor">Tutor</option>
                    <option value="faculty">Faculty</option>
                    <option value="principal">Principal</option>
                    <option value="admin">School Admin</option>
                    <option value="student">Student</option>
                  </>
                ) : (
                  <>
                    <option value="student">Student</option>
                    <option value="tutor">Tutor</option>
                  </>
                )}
              </select>
              {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
            </div>

            {selectedRole === 'student' && (
              <div>
                <label htmlFor="assigned_tutor" className="block text-sm font-semibold text-gray-700">
                  Assigned Tutor
                </label>
                <select
                  id="assigned_tutor"
                  {...register('assigned_tutor')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] sm:text-sm bg-white"
                >
                  <option value="">-- TBA (Unassigned) --</option>
                  {tutors.map((tutor) => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.full_name || `${tutor.first_name} ${tutor.last_name}`} ({tutor.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {selectedRole === 'student' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="lrn" className="block text-sm font-semibold text-gray-700">
                  Learner Reference Number (LRN)
                </label>
                <input
                  id="lrn"
                  type="text"
                  maxLength={12}
                  placeholder="12-digit LRN"
                  {...register('lrn')}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] sm:text-sm ${
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
                <label htmlFor="student_aral_level_edit" className="block text-sm font-semibold text-gray-700">
                  ARAL Level
                </label>
                <select
                  id="student_aral_level_edit"
                  {...register('aral_level')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand)] sm:text-sm bg-white font-medium"
                >
                  <option value="basic">ARAL Basic</option>
                  <option value="plus">ARAL Plus</option>
                  <option value="summer">ARAL Summer</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center pt-2">
            <input id="is_active" type="checkbox" {...register('is_active')}
              className="h-4 w-4 text-[var(--brand)] focus:ring-[var(--brand)] border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm font-medium text-gray-900 cursor-pointer">
              Account Status (Active)
            </label>
          </div>

          <div className="flex justify-end pt-4 space-x-3">
            <Link to={currentUser?.is_superuser ? '/superadmin/users' : '/admin/students'}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-50 transition-colors"
            >Cancel</Link>
            <button type="submit" disabled={isSubmitting}
              className="bg-[var(--brand)] text-white px-5 py-2 rounded-md text-sm font-semibold hover:bg-[var(--brand-dark)] shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
            >{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
