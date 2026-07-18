import React from 'react';
import { Outlet } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <img src="/src/assets/ARALert_LOGO.png" alt="ARALert logo" className="w-12 h-12 shadow-md rounded-lg" />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          ARALert
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Early Academic Risk Detection System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
