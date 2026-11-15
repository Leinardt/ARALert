import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { parseDateKeyLocal, type SchoolYearWeekOption } from '../config/academicConfig';

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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Group weeks by Month and Year (e.g. "August 2026", "September 2026")
  const groupedWeeks = useMemo(() => {
    const groups: { monthKey: string; monthLabel: string; weeks: SchoolYearWeekOption[] }[] = [];
    const map = new Map<string, { monthKey: string; monthLabel: string; weeks: SchoolYearWeekOption[] }>();

    for (const week of weeks) {
      const monthLabel =
        week.monthLabel ||
        (() => {
          const d = parseDateKeyLocal(week.mondayDate);
          return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        })();
      const monthKey = monthLabel;

      if (!map.has(monthKey)) {
        const group = { monthKey, monthLabel, weeks: [] };
        map.set(monthKey, group);
        groups.push(group);
      }
      map.get(monthKey)!.weeks.push(week);
    }
    return groups;
  }, [weeks]);

  const calculatePosition = useCallback((): { top: number; left: number } | null => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 240; // w-60
    const estimatedHeight = Math.min(weeks.length * 32 + groupedWeeks.length * 24 + 16, 288);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const top =
      spaceBelow >= estimatedHeight || rect.top < estimatedHeight
        ? rect.bottom + 6
        : Math.max(8, rect.top - estimatedHeight - 6);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
    return { top, left };
  }, [weeks.length, groupedWeeks.length]);

  const handleToggle = () => {
    if (!isOpen) {
      const pos = calculatePosition();
      if (pos) {
        setMenuPos(pos);
      }
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    const pos = calculatePosition();
    if (pos) {
      setMenuPos(pos);
    }
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    if (!isOpen) return;

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
      const pos = calculatePosition();
      if (pos) {
        setMenuPos(pos);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, calculatePosition]);

  return (
    <div className="relative inline-flex shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
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
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[9999] w-60 rounded-xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="max-h-72 overflow-y-auto dropdown-scroll p-1.5 flex flex-col">
              {groupedWeeks.map((group, groupIdx) => (
                <div key={group.monthKey} className="flex flex-col">
                  {/* Subtle hairline divider between different months */}
                  {groupIdx > 0 && (
                    <div className="my-1 border-t border-gray-100 dark:border-[#1C1C1C]" />
                  )}

                  {/* Clean, lightweight month title */}
                  <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 select-none">
                    {group.monthLabel}
                  </div>

                  {/* Compact single-line week items */}
                  <div className="flex flex-col gap-0.5">
                    {group.weeks.map((week) => {
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
                          className={`flex items-center justify-between w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--brand-light)] text-[var(--brand)] font-bold dark:bg-blue-950/50 dark:text-blue-300'
                              : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                          }`}
                        >
                          <span className="font-semibold text-xs">{week.label}</span>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-normal">
                              {week.dateRangeLabel.replace(/, \d{4}$/, '')}
                            </span>
                            {weekHasRecords && (
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-[var(--brand)] shrink-0"
                                title="Has recorded entries"
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
