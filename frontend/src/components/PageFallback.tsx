import React from 'react';

/**
 * Centered spinner loading animation used for pages that do not have skeleton loading
 * (e.g. Landing, Login, Terms, Privacy, Auth, and Error pages).
 */
export const PageFallback: React.FC = () => (
  <div className="flex-1 min-h-[50vh] flex items-center justify-center p-8 bg-transparent">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-[#0052B7] dark:border-blue-400 border-t-transparent animate-spin" />
      <span className="text-xs font-medium text-slate-400 dark:text-neutral-500 tracking-wide">
        Loading...
      </span>
    </div>
  </div>
);

export default PageFallback;
