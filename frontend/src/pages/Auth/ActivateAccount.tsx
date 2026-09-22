import React from 'react';
import { Link } from 'react-router-dom';

export const ActivateAccount: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl border border-gray-200 max-w-md w-full text-center space-y-4 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Google OAuth Enabled</h2>
        <p className="text-sm text-gray-600">
          Account activation links are no longer required. All staff sign in directly using Google OAuth with their registered email.
        </p>
        <Link
          to="/login"
          className="inline-block bg-[var(--brand)] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[var(--brand-dark)] transition-all"
        >
          Go to Sign In
        </Link>
      </div>
    </div>
  );
};
