import React, { useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { User } from '../types';
import {
  buildTutorClassSections,
  type TutorHandledClassSection,
} from '../utils/tutorCohortHelpers';

export interface TutorCohortFilterProps {
  user: User | null;
  students?: User[];
  isLoading?: boolean;
  selectedAralLevel: 'all' | 'basic' | 'plus';
  onSelectAralLevel: (level: 'all' | 'basic' | 'plus') => void;
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
  selectedCohort: string;
  onSelectCohort: (cohort: string) => void;
  onSelectClass?: (level: 'all' | 'basic' | 'plus', subject: string, cohort: string) => void;
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

  if (isLoading && classSections.length === 0) {
    return (
      <div className="w-full rounded-xl border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#0E0E0E] p-3 sm:px-4 sm:py-3.5 shadow-xs space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
          {title || 'CURRENT CLASS FOR VIEW'}
        </h4>
        <div className="h-10 rounded-lg border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#141414] px-3.5 flex items-center gap-2 animate-pulse">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin" />
          <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">
            Loading handled classes...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#0E0E0E] p-3 sm:px-4 sm:py-3.5 shadow-xs space-y-2">
      {/* ── Header: Title Only ── */}
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
        {title || 'CURRENT CLASS FOR VIEW'}
      </h4>

      {/* ── Single Unified Class Dropdown ── */}
      <div className="relative">
        <select
          id="tutor-class-selector"
          value={activeClassKey}
          onChange={(e) => handleClassSelect(e.target.value)}
          aria-label="Select class to view or record"
          className="w-full appearance-none rounded-lg border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#141414] px-3.5 py-2.5 pr-10 text-xs sm:text-sm font-bold text-gray-900 dark:text-white shadow-2xs focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 focus:outline-none transition-all cursor-pointer"
        >
          {allowAll && (
            <option value="ALL">
              ALL HANDLED CLASSES (OVERALL VIEW)
            </option>
          )}
          {classSections.map((cls) => (
            <option key={cls.key} value={cls.key}>
              {cls.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
      </div>
    </div>
  );
};

export default TutorCohortFilter;
