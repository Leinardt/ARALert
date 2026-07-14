import React from 'react';

export const Settings: React.FC = () => {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-2">System Settings</h2>
        <p className="text-sm text-gray-600">
          Manage system-wide configuration and preferences.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        <div className="p-6">
          <h3 className="text-sm font-bold text-gray-900">General</h3>
          <p className="text-xs text-gray-500 mt-1">Application name, timezone, and locale settings.</p>
          <div className="mt-4 bg-gray-50 p-3 rounded border border-gray-100 text-xs text-gray-400 italic">
            Placeholder — configurable in a future sprint.
          </div>
        </div>
        <div className="p-6">
          <h3 className="text-sm font-bold text-gray-900">Security</h3>
          <p className="text-xs text-gray-500 mt-1">Password policies, session timeout, and two-factor authentication.</p>
          <div className="mt-4 bg-gray-50 p-3 rounded border border-gray-100 text-xs text-gray-400 italic">
            Placeholder — configurable in a future sprint.
          </div>
        </div>
        <div className="p-6">
          <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
          <p className="text-xs text-gray-500 mt-1">Email notifications and alert thresholds for academic risk flags.</p>
          <div className="mt-4 bg-gray-50 p-3 rounded border border-gray-100 text-xs text-gray-400 italic">
            Placeholder — configurable in a future sprint.
          </div>
        </div>
      </div>
    </div>
  );
};
