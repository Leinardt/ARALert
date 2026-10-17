import React, { useEffect, useMemo } from 'react';
import { ChevronDown, GraduationCap, Users } from 'lucide-react';
import type { User } from '../types';
import {
  buildTutorClassSections,
  type TutorHandledClassSection,
} from '../utils/tutorCohortHelpers';

export interface TutorCohortFilterProps {
  user: User | null;
  students?: User[];
  selectedAralLevel: 'all' | 'basic' | 'plus';
  onSelectAralLevel: (level: 'all' | 'basic' | 'plus') => void;
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
  selectedCohort: string;
  onSelectCohort: (cohort: string) => void;
  allowAll?: boolean;
  title?: string;
}

export const TutorCohortFilter: React.FC<TutorCohortFilterProps> = ({
  user,
  students,
  selectedAralLevel,
  onSelectAralLevel,
  selectedSubject,
  onSelectSubject,
  selectedCohort,
  onSelectCohort,
  allowAll = false,
  title,
}) => {
  // Build concrete classes handled by the tutor with their respective students
  const classSections = useMemo<TutorHandledClassSection<User>[]>(() => {
    return buildTutorClassSections(user, students || []);
  }, [user, students]);

  const totalLearnersCount = useMemo(() => {
    if (students && Array.isArray(students)) return students.length;
    return classSections.reduce((acc, cls) => acc + cls.students.length, 0);
  }, [students, classSections]);

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
      onSelectAralLevel(first.aralLevel);
      onSelectSubject(first.subject);
      onSelectCohort(first.cohort);
    }
  }, [allowAll, activeClassKey, classSections, onSelectAralLevel, onSelectSubject, onSelectCohort]);

  // Handle class selection
  const handleClassSelect = (key: string) => {
    if (key === 'ALL') {
      onSelectAralLevel('all');
      onSelectSubject('all');
      onSelectCohort('ALL - ALL');
      return;
    }

    const match = classSections.find((c) => c.key === key);
    if (match) {
      onSelectAralLevel(match.aralLevel);
      onSelectSubject(match.subject);
      onSelectCohort(match.cohort);
    }
  };

  const currentActiveClass = useMemo(() => {
    if (activeClassKey === 'ALL') return null;
    return classSections.find((c) => c.key === activeClassKey) || null;
  }, [activeClassKey, classSections]);

  return (
    <div className="w-full rounded-xl border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#0E0E0E] p-3 sm:px-4 sm:py-3.5 shadow-xs space-y-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-[var(--brand)] dark:text-blue-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
            {title || 'CURRENT CLASS FOR VIEW'}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 font-medium">
          <Users className="w-3.5 h-3.5" />
          <span>
            {currentActiveClass
              ? `${currentActiveClass.students.length} Student${currentActiveClass.students.length === 1 ? '' : 's'}`
              : `${totalLearnersCount} Total Students`}
          </span>
        </div>
      </div>

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
              ALL HANDLED CLASSES (OVERALL VIEW) &bull; {totalLearnersCount} Learners
            </option>
          )}
          {classSections.map((cls) => (
            <option key={cls.key} value={cls.key}>
              {cls.label} &bull; {cls.students.length} Students
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
      </div>

      {/* ── Active Class Metadata Chips ── */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {currentActiveClass ? (
          <>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-[var(--brand)] dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/40">
              {currentActiveClass.aralLevel.toUpperCase()}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
              {currentActiveClass.subject}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
              {currentActiveClass.cohort}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-slate-500 ml-auto font-mono">
              Class Roster: {currentActiveClass.students.length} Learners
            </span>
          </>
        ) : (
          <span className="text-[11px] text-gray-400 dark:text-slate-500 italic">
            Viewing combined aggregate data across all {classSections.length} handled class{classSections.length === 1 ? '' : 'es'}.
          </span>
        )}
      </div>
    </div>
  );
};

export default TutorCohortFilter;
