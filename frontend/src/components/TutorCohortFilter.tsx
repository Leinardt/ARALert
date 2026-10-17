import React, { useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { User } from '../types';
import {
  parseTutorHandledAralLevels,
  parseTutorHandledSubjects,
  parseTutorHandledCohorts,
  type TutorSubjectOption,
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

interface ParsedCohort {
  raw: string;
  grade: string;
  section: string;
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
  // 1. Available ARAL Levels (Basic, Plus, or both)
  const availableAralLevels = useMemo(() => parseTutorHandledAralLevels(user), [user]);

  // Synchronize active ARAL level if currently selected level is not in available levels
  useEffect(() => {
    if (!allowAll && availableAralLevels.length > 0 && (selectedAralLevel === 'all' || !availableAralLevels.includes(selectedAralLevel as any))) {
      onSelectAralLevel(availableAralLevels[0]);
    }
  }, [availableAralLevels, selectedAralLevel, onSelectAralLevel, allowAll]);

  // 2. Available Subjects for the currently selected ARAL Level
  const availableSubjects = useMemo(() => {
    if (allowAll && selectedAralLevel === 'all') {
      const basicSubs = parseTutorHandledSubjects(user, 'basic');
      const plusSubs = parseTutorHandledSubjects(user, 'plus');
      const map = new Map<string, TutorSubjectOption>();
      [...basicSubs, ...plusSubs].forEach((s) => map.set(s.id, s));
      return Array.from(map.values());
    }
    return parseTutorHandledSubjects(user, selectedAralLevel === 'plus' ? 'plus' : 'basic');
  }, [user, selectedAralLevel, allowAll]);

  // Synchronize active subject when switching ARAL level or when subject becomes unavailable
  useEffect(() => {
    if (!allowAll && selectedSubject === 'all') {
      if (availableSubjects.length > 0) {
        onSelectSubject(availableSubjects[0].id);
      }
    } else if (availableSubjects.length > 0 && selectedSubject !== 'all') {
      const match = availableSubjects.find((s) => s.id === selectedSubject);
      if (!match) {
        onSelectSubject(allowAll ? 'all' : availableSubjects[0].id);
      }
    }
  }, [availableSubjects, selectedSubject, onSelectSubject, allowAll]);

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
      if (allowAll && g === 'ALL') return 'ALL';
      if (availableGrades.includes(g)) return g;
    }
    if (allowAll && (selectedCohort === 'ALL' || selectedCohort.toUpperCase() === 'ALL - ALL')) {
      return 'ALL';
    }
    const directMatch = availableGrades.find((g) => g === selectedCohort.toUpperCase().trim());
    if (directMatch) return directMatch;
    return allowAll ? 'ALL' : (availableGrades[0] || 'GRADE 7');
  }, [selectedCohort, availableGrades, allowAll]);

  // Sections available for the currently active grade (sorted alphabetically)
  const availableSections = useMemo<string[]>(() => {
    const sectionSet = new Set<string>();

    if (currentGrade === 'ALL') {
      // Collect sections from all assigned cohorts
      parsedCohorts
        .filter((p) => p.section && p.section !== 'ALL')
        .forEach((p) => sectionSet.add(p.section));

      // Collect sections from students loaded
      if (students && Array.isArray(students)) {
        students.forEach((stu) => {
          const anyStu = stu as any;
          const stuGradeStr = (stu.grade_level || anyStu.grade || '').toUpperCase().trim();
          if (stuGradeStr.includes(' - ')) {
            const sec = stuGradeStr.split(' - ')[1].trim().toUpperCase();
            if (sec) sectionSet.add(sec);
          } else if (anyStu.section) {
            const sec = String(anyStu.section).trim().toUpperCase();
            if (sec) sectionSet.add(sec);
          }
        });
      }
    } else {
      // 1. From tutor's assigned cohorts
      parsedCohorts
        .filter((p) => p.grade === currentGrade && p.section && p.section !== 'ALL')
        .forEach((p) => sectionSet.add(p.section));

      // 2. From students assigned or loaded
      if (students && Array.isArray(students)) {
        students.forEach((stu) => {
          const anyStu = stu as any;
          const stuGradeStr = (stu.grade_level || anyStu.grade || '').toUpperCase().trim();
          const gradeNum = currentGrade.replace(/[^0-9]/g, '');
          const stuGradeNum = stuGradeStr.replace(/[^0-9]/g, '');
          const isGradeMatch =
            (gradeNum && stuGradeNum && gradeNum === stuGradeNum) ||
            stuGradeStr.includes(currentGrade);

          if (isGradeMatch) {
            if (stuGradeStr.includes(' - ')) {
              const sec = stuGradeStr.split(' - ')[1].trim().toUpperCase();
              if (sec) sectionSet.add(sec);
            } else if (anyStu.section) {
              const sec = String(anyStu.section).trim().toUpperCase();
              if (sec) sectionSet.add(sec);
            }
          }
        });
      }
    }

    // 3. Fallback standard section if none found
    if (sectionSet.size === 0) {
      if (currentGrade === 'GRADE 7') sectionSet.add('HYACINTH');
      else if (currentGrade === 'GRADE 8') sectionSet.add('MANGO');
      else sectionSet.add('HYACINTH');
    }

    // Sort sections strictly alphabetically!
    return Array.from(sectionSet).sort((a, b) => a.localeCompare(b));
  }, [parsedCohorts, students, currentGrade]);

  // Determine current active section
  const currentSection = useMemo<string>(() => {
    if (selectedCohort && selectedCohort.includes(' - ')) {
      const s = selectedCohort.split(' - ')[1].trim().toUpperCase();
      if (allowAll && s === 'ALL') return 'ALL';
      if (availableSections.includes(s)) return s;
    }
    if (allowAll && (selectedCohort === 'ALL' || selectedCohort.toUpperCase() === 'ALL - ALL')) {
      return 'ALL';
    }

    // Default is ALWAYS the first section alphabetically, or 'ALL' if allowAll
    return allowAll ? 'ALL' : (availableSections[0] || 'HYACINTH');
  }, [selectedCohort, availableSections, allowAll]);

  // Synchronize active cohort: ensure default is NEVER 'ALL' when allowAll is false
  useEffect(() => {
    if (!allowAll && availableSections.length > 0) {
      const isCurrentValid =
        selectedCohort &&
        selectedCohort.includes(' - ') &&
        !selectedCohort.toUpperCase().includes('ALL') &&
        availableSections.includes(selectedCohort.split(' - ')[1].trim().toUpperCase());

      // If selectedCohort was plain "GRADE 7" without a section, had "ALL", or an invalid section:
      if (!isCurrentValid) {
        const defaultSec = availableSections[0];
        const validGrade = currentGrade === 'ALL' ? (availableGrades[0] || 'GRADE 7') : currentGrade;
        onSelectCohort(`${validGrade} - ${defaultSec}`);
      }
    }
  }, [availableSections, currentGrade, selectedCohort, onSelectCohort, allowAll, availableGrades]);

  // Handle Grade Level selection change
  const handleGradeChange = (newGrade: string) => {
    if (newGrade === 'ALL') {
      onSelectCohort(`ALL - ${allowAll ? currentSection : (availableSections[0] || 'HYACINTH')}`);
      return;
    }

    const sectionsForNewGrade = Array.from(
      new Set(
        parsedCohorts
          .filter((p) => p.grade === newGrade && p.section !== 'ALL')
          .map((p) => p.section)
      )
    ).sort((a, b) => a.localeCompare(b));

    const fallbackDefault =
      allowAll && currentSection === 'ALL'
        ? 'ALL'
        : (sectionsForNewGrade[0] || (newGrade === 'GRADE 8' ? 'MANGO' : 'HYACINTH'));

    if (currentSection && (currentSection === 'ALL' || sectionsForNewGrade.includes(currentSection))) {
      onSelectCohort(`${newGrade} - ${currentSection}`);
    } else {
      onSelectCohort(`${newGrade} - ${fallbackDefault}`);
    }
  };

  // Handle Section selection change
  const handleSectionChange = (newSec: string) => {
    onSelectCohort(`${currentGrade} - ${newSec}`);
  };

  return (
    <div className="w-full rounded-lg border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#111111] p-3 sm:px-4 sm:py-3 shadow-xs space-y-2.5">
      {/* ── Label on top ── */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
          {title || 'CURRENT CLASS FOR RECORD OR VIEW'}
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
              onChange={(e) => onSelectAralLevel(e.target.value as any)}
              className="cohort-filter-select w-full appearance-none rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] px-3 py-1.5 pr-8 text-xs font-bold !text-[var(--brand)] dark:!text-blue-400 shadow-xs focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] focus:outline-none transition-colors cursor-pointer"
            >
              {allowAll && (
                <option
                  value="all"
                  className="bg-white dark:bg-[#161616] !text-[var(--brand)] dark:!text-blue-400 font-bold"
                >
                  ALL ARAL LEVELS
                </option>
              )}
              {availableAralLevels.map((level) => (
                <option
                  key={level}
                  value={level}
                  className="bg-white dark:bg-[#161616] !text-[var(--brand)] dark:!text-blue-400 font-bold"
                >
                  {level === 'basic' ? 'BASIC' : 'PLUS'}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--brand)] dark:text-blue-400" />
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
              className="cohort-filter-select w-full appearance-none rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] px-3 py-1.5 pr-8 text-xs font-bold !text-[var(--brand)] dark:!text-blue-400 shadow-xs focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] focus:outline-none transition-colors cursor-pointer"
            >
              {allowAll && (
                <option
                  value="all"
                  className="bg-white dark:bg-[#161616] !text-[var(--brand)] dark:!text-blue-400 font-bold"
                >
                  ALL SUBJECTS
                </option>
              )}
              {availableSubjects.map((sub) => (
                <option
                  key={sub.id}
                  value={sub.id}
                  className="bg-white dark:bg-[#161616] !text-[var(--brand)] dark:!text-blue-400 font-bold"
                >
                  {sub.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--brand)] dark:text-blue-400" />
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
              className="cohort-filter-select w-full appearance-none rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] px-3 py-1.5 pr-8 text-xs font-bold !text-[var(--brand)] dark:!text-blue-400 shadow-xs focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] focus:outline-none transition-colors cursor-pointer"
            >
              {allowAll && (
                <option
                  value="ALL"
                  className="bg-white dark:bg-[#161616] !text-[var(--brand)] dark:!text-blue-400 font-bold"
                >
                  ALL GRADES
                </option>
              )}
              {availableGrades.map((grade) => (
                <option
                  key={grade}
                  value={grade}
                  className="bg-white dark:bg-[#161616] !text-[var(--brand)] dark:!text-blue-400 font-bold"
                >
                  {grade}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--brand)] dark:text-blue-400" />
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
              className="cohort-filter-select w-full appearance-none rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#111111] px-3 py-1.5 pr-8 text-xs font-bold !text-[var(--brand)] dark:!text-blue-400 shadow-xs focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] focus:outline-none transition-colors cursor-pointer"
            >
              {allowAll && (
                <option
                  value="ALL"
                  className="bg-white dark:bg-[#161616] !text-[var(--brand)] dark:!text-blue-400 font-bold"
                >
                  ALL SECTIONS
                </option>
              )}
              {availableSections.map((sec) => (
                <option
                  key={sec}
                  value={sec}
                  className="bg-white dark:bg-[#161616] !text-[var(--brand)] dark:!text-blue-400 font-bold"
                >
                  {sec}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--brand)] dark:text-blue-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorCohortFilter;
