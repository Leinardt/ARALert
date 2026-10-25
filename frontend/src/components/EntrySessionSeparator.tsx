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
    <div className={`flex items-center gap-3 my-3.5 select-none ${className}`}>
      <div className="h-px flex-1 bg-gray-200 dark:bg-[#222222]" />
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300">
        [{cleanLabel}] {cleanTime ? `[${cleanTime}]` : ''}
      </span>
      <div className="h-px flex-1 bg-gray-200 dark:bg-[#222222]" />
    </div>
  );
};
