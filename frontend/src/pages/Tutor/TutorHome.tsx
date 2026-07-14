import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export const TutorHome: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900">Welcome Tutor</h2>
      <p className="mt-2 text-gray-600">
        Hello {user?.full_name || user?.username}, you are currently logged in as an Academic Tutor.
      </p>
      <p className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded border border-gray-100 italic">
        Note: The Tutor portal features are out of scope for Sprint 1 and will be developed in a future sprint.
      </p>
    </div>
  );
};
