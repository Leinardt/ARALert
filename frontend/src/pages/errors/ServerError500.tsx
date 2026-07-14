import React from 'react';
import { Link } from 'react-router-dom';
import { ServerCrash } from 'lucide-react';

export const ServerError500: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <ServerCrash className="w-16 h-16 text-yellow-500" />
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
          500 - Server Error
        </h1>
        <p className="mt-2 text-base text-gray-500">
          Something went wrong on our server. Please try again later.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Retry Home
          </Link>
        </div>
      </div>
    </div>
  );
};
