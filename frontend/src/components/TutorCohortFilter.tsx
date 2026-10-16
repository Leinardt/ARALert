import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Users, ChevronDown, Check } from 'lucide-react';
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

export interface TutorClassOption {
  key: string;
  cohort: string;
  subjectId: string;
  subjectLabel: string;
  aralLevel: 'basic' | 'plus';
  aralLevelLabel: string;
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // 4. Compute all distinct class combinations the tutor handles
  const allClasses = useMemo<TutorClassOption[]>(() => {
    const list: TutorClassOption[] = [];
    for (const cohort of availableCohorts) {
      for (const level of availableAralLevels) {
        const subs = parseTutorHandledSubjects(user, level);
        for (const sub of subs) {
          list.push({
            key: `${cohort}__${level}__${sub.id}`,
            cohort,
            subjectId: sub.id,
            subjectLabel: sub.label,
            aralLevel: level,
            aralLevelLabel: level === 'basic' ? 'ARAL Basic' : 'ARAL Plus',
          });
        }
      }
    }
    return list;
  }, [user, availableCohorts, availableAralLevels]);

  // Current active class display
  const currentClass = useMemo<TutorClassOption>(() => {
    const exact = allClasses.find(
      (c) =>
        c.cohort === selectedCohort &&
        c.aralLevel === selectedAralLevel &&
        c.subjectId === selectedSubject
    );
    if (exact) return exact;

    const partial = allClasses.find(
      (c) => c.cohort === selectedCohort && c.aralLevel === selectedAralLevel
    );
    if (partial) return partial;

    return (
      allClasses[0] || {
        key: 'default',
        cohort: selectedCohort || 'GRADE 7',
        subjectId: selectedSubject || 'Filipino',
        subjectLabel: (selectedSubject || 'FILIPINO').toUpperCase(),
        aralLevel: selectedAralLevel || 'basic',
        aralLevelLabel: selectedAralLevel === 'plus' ? 'ARAL Plus' : 'ARAL Basic',
      }
    );
  }, [allClasses, selectedCohort, selectedAralLevel, selectedSubject]);

  // Handle switching class with a single click
  const handleSelectClass = (opt: TutorClassOption) => {
    if (opt.cohort !== selectedCohort) onSelectCohort(opt.cohort);
    if (opt.aralLevel !== selectedAralLevel) onSelectAralLevel(opt.aralLevel);
    if (opt.subjectId !== selectedSubject) onSelectSubject(opt.subjectId);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handlePointerDownOutside);
      document.addEventListener('touchstart', handlePointerDownOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const hasMultipleClasses = allClasses.length > 1;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── Compact Unified Class Bar (Option 1) ── */}
      <div
        onClick={() => hasMultipleClasses && setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (hasMultipleClasses && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        role={hasMultipleClasses ? 'button' : undefined}
        tabIndex={hasMultipleClasses ? 0 : undefined}
        aria-haspopup={hasMultipleClasses ? 'listbox' : undefined}
        aria-expanded={hasMultipleClasses ? isOpen : undefined}
        className={`w-full min-h-[46px] rounded-lg border px-3 sm:px-4 py-2 flex items-center justify-between gap-3 transition-all ${
          hasMultipleClasses
            ? 'cursor-pointer border-gray-200 hover:border-gray-300 dark:border-[#1E1E1E] dark:hover:border-[#2A2A2A] bg-white hover:bg-gray-50/70 dark:bg-[#111111] dark:hover:bg-[#151515] shadow-xs'
            : 'border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#111111] cursor-default'
        }`}
      >
        {/* Left: Class Context info */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center text-[var(--brand)] shrink-0">
            <Users className="w-4 h-4" />
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 shrink-0">
              Active Class:
            </span>
            <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 truncate">
              {currentClass.cohort}
            </span>
            <span className="text-gray-300 dark:text-slate-700 hidden xs:inline">•</span>
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              {currentClass.subjectLabel}
            </span>
            <span className="inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[var(--brand)] border border-blue-200/80 dark:border-blue-800/80">
              {currentClass.aralLevelLabel}
            </span>
          </div>
        </div>

        {/* Right: Switcher control / Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {hasMultipleClasses ? (
            <>
              <span className="hidden md:inline-flex text-[11px] font-medium text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-[#1A1A1A] px-2 py-0.5 rounded">
                {allClasses.length} classes
              </span>
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  isOpen
                    ? 'bg-[var(--brand)] text-white shadow-xs'
                    : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-[var(--brand)] border border-blue-200/80 dark:border-blue-800/80'
                }`}
              >
                <span>Switch Class</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </>
          ) : (
            <span className="text-[11px] font-medium text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-[#161616] border border-gray-100 dark:border-[#222222] px-2.5 py-0.5 rounded-full">
              Single Cohort
            </span>
          )}
        </div>
      </div>

      {/* ── Dropdown Menu (Opened on demand) ── */}
      {isOpen && hasMultipleClasses && (
        <div
          role="listbox"
          aria-label="Assigned Classes"
          className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#222222] rounded-lg shadow-xl overflow-hidden animate-fade-in"
        >
          {/* Dropdown Header */}
          <div className="px-4 py-2 border-b border-gray-100 dark:border-[#222222] bg-gray-50/80 dark:bg-[#101010] flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Select Class to Manage
            </span>
            <span className="text-[11px] font-medium text-gray-400 dark:text-slate-500">
              Click to switch
            </span>
          </div>

          {/* List of Classes */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-[#202020]">
            {allClasses.map((opt) => {
              const isActive =
                opt.cohort === selectedCohort &&
                opt.aralLevel === selectedAralLevel &&
                opt.subjectId === selectedSubject;

              return (
                <button
                  key={opt.key}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectClass(opt);
                  }}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-50/80 dark:bg-blue-950/30'
                      : 'hover:bg-gray-50 dark:hover:bg-[#1A1A1A]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                    <span
                      className={`text-xs sm:text-sm font-bold truncate ${
                        isActive
                          ? 'text-[var(--brand)]'
                          : 'text-gray-900 dark:text-slate-100'
                      }`}
                    >
                      {opt.cohort}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                        {opt.subjectLabel}
                      </span>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                        {opt.aralLevelLabel}
                      </span>
                    </div>
                  </div>

                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand)] shrink-0 ml-2">
                      <Check className="w-4 h-4" />
                      <span className="hidden xs:inline">Active</span>
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 shrink-0 ml-2">
                      Switch
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorCohortFilter;
