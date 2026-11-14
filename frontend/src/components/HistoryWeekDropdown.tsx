import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { SchoolYearWeekOption } from '../config/academicConfig';

interface HistoryWeekDropdownProps {
  weeks: SchoolYearWeekOption[];
  selectedWeekKey: string;
  recordedWeekKeys: Set<string>;
  label: string;
  onSelectWeek: (weekKey: string) => void;
  ariaLabel?: string;
}

export const HistoryWeekDropdown: React.FC<HistoryWeekDropdownProps> = ({
  weeks,
  selectedWeekKey,
  recordedWeekKeys,
  label,
  onSelectWeek,
  ariaLabel = 'Select school year week',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 224; // w-56
    const estimatedHeight = Math.min(weeks.length * 34 + 16, 288);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const top =
      spaceBelow >= estimatedHeight || rect.top < estimatedHeight
        ? rect.bottom + 6
        : Math.max(8, rect.top - estimatedHeight - 6);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
    setMenuPos({ top, left });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleViewportChange = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, weeks.length]);

  return (
    <div className="relative inline-flex shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className="inline-flex h-7.5 items-center justify-between gap-1.5 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] px-2.5 text-xs font-black uppercase tracking-wider text-[var(--brand)] outline-none transition hover:bg-gray-100 dark:hover:bg-[#222222] focus:border-[var(--brand)] cursor-pointer whitespace-nowrap select-none"
      >
        <span>{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 opacity-75 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[9999] w-56 max-h-72 overflow-y-auto flex flex-col gap-0.5 rounded-xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-1.5 shadow-xl"
          >
            {weeks.map((week) => {
              const isSelected = week.weekKey === selectedWeekKey;
              const weekHasRecords = recordedWeekKeys.has(week.weekKey);
              return (
                <button
                  key={week.weekKey}
                  type="button"
                  onClick={() => {
                    onSelectWeek(week.weekKey);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--brand-light)] text-[var(--brand)] font-bold dark:bg-blue-950/50 dark:text-blue-300'
                      : 'text-gray-700 dark:text-slate-200 font-medium hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                  }`}
                >
                  <span className="truncate">{week.label}</span>
                  {weekHasRecords && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[var(--brand)] shrink-0 ml-2"
                      title="Has recorded entries"
                    />
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};
