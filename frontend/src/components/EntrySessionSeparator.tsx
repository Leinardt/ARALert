import React from 'react';

interface EntrySessionSeparatorProps {
  label: string; // e.g. "INTERVENTION ACTIVITY", "MOSY ASSESSMENT", etc.
  time?: string | null; // e.g. "10:40 AM"
  className?: string;
}

export const EntrySessionSeparator: React.FC<EntrySessionSeparatorProps> = ({
  label,
  time,
  className = '',
}) => {
  const cleanLabel = label.trim().toUpperCase();
  const cleanTime = time && time !== '—' && time !== '-' ? time.trim() : null;

  return (
    <div className={`flex items-center gap-3 my-4 select-none ${className}`}>
      <div className="h-px flex-1 bg-gray-200 dark:bg-[#222222]" />
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#262626] text-[10.5px] font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 font-mono shadow-2xs">
        <span>{cleanLabel}</span>
        {cleanTime && (
          <>
            <span className="text-gray-400 dark:text-slate-500 font-sans">•</span>
            <span className="text-gray-900 dark:text-slate-100">{cleanTime}</span>
          </>
        )}
      </span>
      <div className="h-px flex-1 bg-gray-200 dark:bg-[#222222]" />
    </div>
  );
};
