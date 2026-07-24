import React from 'react';
import { Link } from 'react-router-dom';

export const ServerError500: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
    <div className="max-w-xl w-full bg-white shadow-lg rounded-3xl border border-slate-200 p-10 text-center">
      <h1 className="text-5xl font-bold text-slate-900">500</h1>
      <p className="mt-4 text-lg text-slate-600">An unexpected server error occurred.</p>
      <Link
        to="/"
        className="mt-8 inline-block rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-dark)]"
      >
        Return home
      </Link>
    </div>
  </div>
);
