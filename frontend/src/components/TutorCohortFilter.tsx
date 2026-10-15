import React, { useEffect, useMemo } from 'react';
import type { User } from '../types';
import {
  parseTutorHandledAralLevels,
  parseTutorHandledSubjects,
  parseTutorHandledCohorts,
} from '../utils/tutorCohortHelpers';

export interface TutorCohortFilterProps {
  user: User | null;
  selectedAralLevel: 'basic' | 'plus';
  onSelectAralLevel: (level: 'basic' | 'plus') => void;
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
  selectedCohort: string;
  onSelectCohort: (cohort: string) => void;
}

export const TutorCohortFilter: React.FC<TutorCohortFilterProps> = ({
  user,
  selectedAralLevel,
  onSelectAralLevel,
  selectedSubject,
  onSelectSubject,
  selectedCohort,
  onSelectCohort,
}) => {
  // 1. Available ARAL Levels (Basic, Plus, or both)
  const availableAralLevels = useMemo(() => parseTutorHandledAralLevels(user), [user]);

  // Synchronize active ARAL level if currently selected level is not in available levels
  useEffect(() => {
    if (availableAralLevels.length > 0 && !availableAralLevels.includes(selectedAralLevel)) {
      onSelectAralLevel(availableAralLevels[0]);
    }
  }, [availableAralLevels, selectedAralLevel, onSelectAralLevel]);

  // 2. Available Subjects for the currently selected ARAL Level
  const availableSubjects = useMemo(
    () => parseTutorHandledSubjects(user, selectedAralLevel),
    [user, selectedAralLevel]
  );

  // Synchronize active subject when switching ARAL level or when subject becomes unavailable
  useEffect(() => {
    if (availableSubjects.length > 0) {
      const match = availableSubjects.find((s) => s.id === selectedSubject);
      if (!match) {
        onSelectSubject(availableSubjects[0].id);
      }
    }
  }, [availableSubjects, selectedSubject, onSelectSubject]);

  // 3. Available Cohorts (Grade Level - Section combinations)
  const availableCohorts = useMemo(() => parseTutorHandledCohorts(user), [user]);

  // Synchronize active cohort if currently selected cohort is not in available cohorts
  useEffect(() => {
    if (availableCohorts.length > 0 && !availableCohorts.includes(selectedCohort)) {
      onSelectCohort(availableCohorts[0]);
    }
  }, [availableCohorts, selectedCohort, onSelectCohort]);

  return (
    <div className="space-y-1.5 w-full">
      {/* ── Tier 1: ARAL Level (BASIC / PLUS) ── */}
      <div
        className="flex w-full rounded-md bg-gray-100 p-0.5 gap-0.5 dark:bg-[#111111]"
        role="tablist"
        aria-label="ARAL Level filter"
      >
        {availableAralLevels.map((level) => {
          const isActive = selectedAralLevel === level;
          const label = level === 'basic' ? 'ARAL BASIC' : 'ARAL PLUS';
          return (
            <button
              key={level}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectAralLevel(level)}
              className={`flex-1 h-8 rounded-sm px-4 flex items-center justify-center text-xs font-bold uppercase transition-all cursor-pointer ${
                isActive
                  ? 'bg-[var(--brand)] text-white shadow-xs'
                  : 'text-gray-400 opacity-60 hover:bg-white/60 hover:text-gray-600 hover:opacity-100 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Tier 2: Assigned Subject (FILIPINO/ENGLISH / SCIENCE / MATH) ── */}
      <div
        className="flex w-full rounded-md bg-gray-100 p-0.5 gap-0.5 dark:bg-[#111111]"
        role="tablist"
        aria-label="Subject filter"
      >
        {availableSubjects.map((sub) => {
          const isActive = selectedSubject === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectSubject(sub.id)}
              className={`flex-1 h-8 rounded-sm px-4 flex items-center justify-center text-xs font-bold uppercase transition-all cursor-pointer ${
                isActive
                  ? 'bg-[var(--brand)] text-white shadow-xs'
                  : 'text-gray-400 opacity-60 hover:bg-white/60 hover:text-gray-600 hover:opacity-100 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300'
              }`}
            >
              {sub.label}
            </button>
          );
        })}
      </div>

      {/* ── Tier 3: Assigned Grade Level - Section (e.g. GRADE 8 - MANGO) ── */}
      <div
        className="flex w-full rounded-md bg-gray-100 p-0.5 gap-0.5 dark:bg-[#111111]"
        role="tablist"
        aria-label="Grade level and section filter"
      >
        {availableCohorts.map((cohort) => {
          const isActive = selectedCohort === cohort;
          return (
            <button
              key={cohort}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectCohort(cohort)}
              className={`flex-1 h-8 rounded-sm px-4 flex items-center justify-center text-xs font-bold uppercase transition-all cursor-pointer ${
                isActive
                  ? 'bg-[var(--brand)] text-white shadow-xs'
                  : 'text-gray-400 opacity-60 hover:bg-white/60 hover:text-gray-600 hover:opacity-100 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-slate-300'
              }`}
            >
              {cohort}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TutorCohortFilter;
