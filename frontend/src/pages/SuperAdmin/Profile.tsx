import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export const Profile: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  const fields = [
    { label: 'Full Name', value: user.full_name },
    { label: 'Username', value: user.username },
    { label: 'Email', value: user.email },
    { label: 'Role', value: user.is_superuser ? 'SuperAdmin' : (user.role || 'N/A') },
    { label: 'Account Status', value: user.is_active ? 'Active' : 'Inactive' },
    { label: 'Member Since', value: new Date(user.date_joined).toLocaleDateString('en-US', { dateStyle: 'long' }) },
    { label: 'Last Login', value: user.last_login ? new Date(user.last_login).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never' },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-md">
            {user.first_name ? user.first_name[0].toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user.full_name || user.username}</h2>
            <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">
              {user.is_superuser ? 'SuperAdmin' : user.role}
            </span>
          </div>
        </div>

        <dl className="divide-y divide-gray-100">
          {fields.map((field, i) => (
            <div key={i} className="py-3 flex justify-between text-sm">
              <dt className="font-medium text-gray-500">{field.label}</dt>
              <dd className="text-gray-900 font-semibold">{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <p className="text-xs text-gray-500 italic">
          Profile editing and password change features are planned for a future sprint.
        </p>
      </div>
    </div>
  );
};
