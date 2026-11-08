import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { User } from '../types';
import {
  buildTutorClassSections,
  type TutorHandledClassSection,
} from '../utils/tutorCohortHelpers';

export interface TutorCohortFilterProps {
  user: User | null;
  students?: User[];
  isLoading?: boolean;
  selectedAralLevel: 'all' | 'basic' | 'plus' | 'summer';
  onSelectAralLevel: (level: 'all' | 'basic' | 'plus' | 'summer') => void;
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
  selectedCohort: string;
  onSelectCohort: (cohort: string) => void;
  onSelectClass?: (level: 'all' | 'basic' | 'plus' | 'summer', subject: string, cohort: string) => void;
  allowAll?: boolean;
  title?: string;
}

export const TutorCohortFilter: React.FC<TutorCohortFilterProps> = ({
  user,
  students,
  isLoading = false,
  selectedAralLevel,
  onSelectAralLevel,
  selectedSubject,
  onSelectSubject,
  selectedCohort,
  onSelectCohort,
  onSelectClass,
  allowAll = false,
  title,
}) => {
  // Build concrete classes handled by the tutor with their respective students
  const classSections = useMemo<TutorHandledClassSection<User>[]>(() => {
    return buildTutorClassSections(user, students || []);
  }, [user, students]);

  // Determine active selected class key
  const activeClassKey = useMemo<string>(() => {
    const isAllAral = !selectedAralLevel || selectedAralLevel.toLowerCase() === 'all';
    const isAllSubject = !selectedSubject || selectedSubject.toLowerCase() === 'all';
    const isAllCohort =
      !selectedCohort ||
      selectedCohort.toLowerCase() === 'all' ||
      selectedCohort.toUpperCase() === 'ALL - ALL';

    if (isAllAral && isAllSubject && isAllCohort) {
      return allowAll ? 'ALL' : (classSections[0]?.key || 'ALL');
    }

    const directMatch = classSections.find((c) => {
      const matchAral = isAllAral || c.aralLevel.toLowerCase() === selectedAralLevel.toLowerCase();
      const matchSubj = isAllSubject || c.subject.toLowerCase() === selectedSubject.toLowerCase();
      const matchCohort = isAllCohort || c.cohort.toUpperCase() === selectedCohort.toUpperCase();
      return matchAral && matchSubj && matchCohort;
    });

    if (directMatch) return directMatch.key;

    // Fallback: match by cohort if available
    if (!isAllCohort) {
      const cohortMatch = classSections.find(
        (c) => c.cohort.toUpperCase() === selectedCohort.toUpperCase()
      );
      if (cohortMatch) return cohortMatch.key;
    }

    return allowAll ? 'ALL' : (classSections[0]?.key || 'ALL');
  }, [selectedAralLevel, selectedSubject, selectedCohort, classSections, allowAll]);

  // If allowAll is false and active selection is ALL, auto-select the first class
  useEffect(() => {
    if (!allowAll && activeClassKey === 'ALL' && classSections.length > 0) {
      const first = classSections[0];
      if (onSelectClass) {
        onSelectClass(first.aralLevel, first.subject, first.cohort);
      } else {
        onSelectAralLevel(first.aralLevel);
        onSelectSubject(first.subject);
        onSelectCohort(first.cohort);
      }
    }
  }, [allowAll, activeClassKey, classSections, onSelectAralLevel, onSelectSubject, onSelectCohort, onSelectClass]);

  // Handle class selection
  const handleClassSelect = (key: string) => {
    if (key === 'ALL') {
      if (onSelectClass) {
        onSelectClass('all', 'all', 'ALL - ALL');
      } else {
        onSelectAralLevel('all');
        onSelectSubject('all');
        onSelectCohort('ALL - ALL');
      }
      return;
    }

    const match = classSections.find((c) => c.key === key);
    if (match) {
      if (onSelectClass) {
        onSelectClass(match.aralLevel, match.subject, match.cohort);
      } else {
        onSelectAralLevel(match.aralLevel);
        onSelectSubject(match.subject);
        onSelectCohort(match.cohort);
      }
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeClassLabel = useMemo(() => {
    if (activeClassKey === 'ALL') {
      return 'ALL HANDLED CLASSES (OVERALL VIEW)';
    }
    const match = classSections.find((c) => c.key === activeClassKey);
    return match?.label || classSections[0]?.label || 'Select class';
  }, [activeClassKey, classSections]);

  if (isLoading && classSections.length === 0) {
    return (
      <div className="w-full rounded-xl border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#0E0E0E] p-3 sm:px-4 sm:py-3.5 shadow-sm space-y-2 animate-pulse">
        <div className="h-3 w-36 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="w-full min-h-[44px] rounded-lg border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#141414] px-3.5 py-2.5 flex items-center justify-between">
          <div className="h-3.5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-4 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full rounded-xl border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#0E0E0E] p-3 sm:px-4 sm:py-3.5 shadow-sm space-y-2 relative transition-all ${isOpen ? 'z-20' : 'z-0'}`}>
      {/* ── Header: Title Only ── */}
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
        {title || 'Current Class'}
      </h4>

      {/* ── Single Unified Class Dropdown (Constrained to container width) ── */}
      <div ref={dropdownRef} className="relative w-full max-w-full">
        <button
          type="button"
          id="tutor-class-selector"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Select class to view or record"
          className="w-full min-h-[44px] flex items-center justify-between rounded-lg border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#141414] px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-800 dark:text-slate-100 shadow-2xs focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 focus:outline-none transition-all cursor-pointer text-left"
        >
          <span className="truncate pr-2">{activeClassLabel}</span>
          <ChevronDown className={`shrink-0 w-4 h-4 text-gray-400 dark:text-slate-500 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div
            role="listbox"
            aria-label="Handled Classes"
            className="absolute left-0 right-0 top-full mt-1.5 z-30 w-full max-w-full rounded-xl border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] p-1.5 shadow-xl max-h-64 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-100"
          >
            {allowAll && (
              <button
                type="button"
                role="option"
                aria-selected={activeClassKey === 'ALL'}
                onClick={() => {
                  handleClassSelect('ALL');
                  setIsOpen(false);
                }}
                className={`w-full max-w-full flex items-center justify-between text-left rounded-lg px-3 py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                  activeClassKey === 'ALL'
                    ? 'bg-[var(--brand-light)] text-[var(--brand-dark)] dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                }`}
                title="ALL HANDLED CLASSES (OVERALL VIEW)"
              >
                <span className="truncate">ALL HANDLED CLASSES (OVERALL VIEW)</span>
                {activeClassKey === 'ALL' && <Check className="w-4 h-4 shrink-0 text-[var(--brand)] dark:text-blue-400 ml-2" />}
              </button>
            )}
            {classSections.map((cls) => {
              const isSelected = activeClassKey === cls.key;
              return (
                <button
                  key={cls.key}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    handleClassSelect(cls.key);
                    setIsOpen(false);
                  }}
                  className={`w-full max-w-full flex items-center justify-between text-left rounded-lg px-3 py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--brand-light)] text-[var(--brand-dark)] dark:bg-blue-950/60 dark:text-blue-300'
                      : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                  }`}
                  title={cls.label}
                >
                  <span className="truncate">{cls.label}</span>
                  {isSelected && <Check className="w-4 h-4 shrink-0 text-[var(--brand)] dark:text-blue-400 ml-2" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TutorCohortFilter;
