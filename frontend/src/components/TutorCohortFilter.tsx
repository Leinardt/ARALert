import React, { useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
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

interface ParsedCohort {
  raw: string;
  grade: string;
  section: string;
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

  // Parse cohorts into grade and section pairs
  const parsedCohorts = useMemo<ParsedCohort[]>(() => {
    return availableCohorts.map((cohortStr) => {
      if (cohortStr.includes(' - ')) {
        const [g, s] = cohortStr.split(' - ').map((part) => part.trim().toUpperCase());
        return { raw: cohortStr, grade: g, section: s };
      }
      return { raw: cohortStr, grade: cohortStr.toUpperCase().trim(), section: 'ALL' };
    });
  }, [availableCohorts]);

  // Unique available grades for tutor
  const availableGrades = useMemo<string[]>(() => {
    const set = new Set<string>();
    parsedCohorts.forEach((p) => {
      if (p.grade) set.add(p.grade);
    });
    const arr = Array.from(set);
    return arr.length > 0 ? arr : ['GRADE 7'];
  }, [parsedCohorts]);

  // Determine current active grade
  const currentGrade = useMemo<string>(() => {
    if (selectedCohort && selectedCohort.includes(' - ')) {
      const g = selectedCohort.split(' - ')[0].trim().toUpperCase();
      if (availableGrades.includes(g)) return g;
    }
    const directMatch = availableGrades.find((g) => g === selectedCohort.toUpperCase().trim());
    if (directMatch) return directMatch;
    return availableGrades[0] || 'GRADE 7';
  }, [selectedCohort, availableGrades]);

  // Sections available for the currently active grade
  const availableSections = useMemo<string[]>(() => {
    const matching = parsedCohorts.filter((p) => p.grade === currentGrade);
    const set = new Set<string>();
    matching.forEach((m) => {
      if (m.section) set.add(m.section);
    });
    const arr = Array.from(set);
    return arr.length > 0 ? arr : ['ALL'];
  }, [parsedCohorts, currentGrade]);

  // Determine current active section
  const currentSection = useMemo<string>(() => {
    if (selectedCohort && selectedCohort.includes(' - ')) {
      const s = selectedCohort.split(' - ')[1].trim().toUpperCase();
      if (availableSections.includes(s)) return s;
    }
    return availableSections[0] || 'ALL';
  }, [selectedCohort, availableSections]);

  // Synchronize active cohort if currently selected cohort is not in available cohorts
  useEffect(() => {
    if (availableCohorts.length > 0 && !availableCohorts.includes(selectedCohort)) {
      onSelectCohort(availableCohorts[0]);
    }
  }, [availableCohorts, selectedCohort, onSelectCohort]);

  // Handle Grade Level selection change
  const handleGradeChange = (newGrade: string) => {
    const sectionsForNewGrade = parsedCohorts
      .filter((p) => p.grade === newGrade)
      .map((p) => p.section);

    if (currentSection !== 'ALL' && sectionsForNewGrade.includes(currentSection)) {
      onSelectCohort(`${newGrade} - ${currentSection}`);
    } else {
      const nextSec = sectionsForNewGrade[0] || 'ALL';
      if (nextSec === 'ALL') {
        onSelectCohort(newGrade);
      } else {
        onSelectCohort(`${newGrade} - ${nextSec}`);
      }
    }
  };

  // Handle Section selection change
  const handleSectionChange = (newSec: string) => {
    if (newSec === 'ALL') {
      onSelectCohort(currentGrade);
    } else {
      onSelectCohort(`${currentGrade} - ${newSec}`);
    }
  };

  return (
    <div className="w-full rounded-lg border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#111111] p-3 sm:px-4 sm:py-3 shadow-xs space-y-2.5">
      {/* ── Label on top ── */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
          CURRENT CLASS FOR RECORD OR VIEW
        </h4>
      </div>

      {/* ── 4 Dropdowns (ARAL Level, Subject, Grade Level, Section) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {/* 1. ARAL Level Dropdown */}
        <div className="flex flex-col gap-1 w-full">
          <label
            htmlFor="filter-aral-level"
            className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400"
          >
            ARAL Level
          </label>
          <div className="relative">
            <select
              id="filter-aral-level"
              value={selectedAralLevel}
              onChange={(e) => onSelectAralLevel(e.target.value as 'basic' | 'plus')}
              className="w-full appearance-none rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] px-3 py-1.5 pr-8 text-xs font-bold text-gray-900 dark:text-slate-100 shadow-xs focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] focus:outline-none transition-colors cursor-pointer"
            >
              {availableAralLevels.map((level) => (
                <option
                  key={level}
                  value={level}
                  className="bg-white dark:bg-[#161616] text-gray-900 dark:text-slate-100"
                >
                  {level === 'basic' ? 'ARAL BASIC' : 'ARAL PLUS'}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
          </div>
        </div>

        {/* 2. Subject Dropdown */}
        <div className="flex flex-col gap-1 w-full">
          <label
            htmlFor="filter-subject"
            className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400"
          >
            Subject
          </label>
          <div className="relative">
            <select
              id="filter-subject"
              value={selectedSubject}
              onChange={(e) => onSelectSubject(e.target.value)}
              className="w-full appearance-none rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] px-3 py-1.5 pr-8 text-xs font-bold text-gray-900 dark:text-slate-100 shadow-xs focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] focus:outline-none transition-colors cursor-pointer"
            >
              {availableSubjects.map((sub) => (
                <option
                  key={sub.id}
                  value={sub.id}
                  className="bg-white dark:bg-[#161616] text-gray-900 dark:text-slate-100"
                >
                  {sub.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
          </div>
        </div>

        {/* 3. Grade Level Dropdown */}
        <div className="flex flex-col gap-1 w-full">
          <label
            htmlFor="filter-grade-level"
            className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400"
          >
            Grade Level
          </label>
          <div className="relative">
            <select
              id="filter-grade-level"
              value={currentGrade}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full appearance-none rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] px-3 py-1.5 pr-8 text-xs font-bold text-gray-900 dark:text-slate-100 shadow-xs focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] focus:outline-none transition-colors cursor-pointer"
            >
              {availableGrades.map((grade) => (
                <option
                  key={grade}
                  value={grade}
                  className="bg-white dark:bg-[#161616] text-gray-900 dark:text-slate-100"
                >
                  {grade}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
          </div>
        </div>

        {/* 4. Section Dropdown */}
        <div className="flex flex-col gap-1 w-full">
          <label
            htmlFor="filter-section"
            className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400"
          >
            Section
          </label>
          <div className="relative">
            <select
              id="filter-section"
              value={currentSection}
              onChange={(e) => handleSectionChange(e.target.value)}
              className="w-full appearance-none rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] px-3 py-1.5 pr-8 text-xs font-bold text-gray-900 dark:text-slate-100 shadow-xs focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] focus:outline-none transition-colors cursor-pointer"
            >
              {availableSections.map((sec) => (
                <option
                  key={sec}
                  value={sec}
                  className="bg-white dark:bg-[#161616] text-gray-900 dark:text-slate-100"
                >
                  {sec === 'ALL' ? 'ALL SECTIONS' : sec}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorCohortFilter;
