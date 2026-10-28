import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import type { TutorRoleDetailGroup } from '../utils/tutorCohortHelpers';
import { createDefaultRoleDetail } from '../utils/tutorCohortHelpers';

interface TutorRoleDetailsSectionProps {
  groups: TutorRoleDetailGroup[];
  onChange: (groups: TutorRoleDetailGroup[]) => void;
  errors?: Record<string, string>;
}

const GRADE_OPTIONS = ['GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'];

export const TutorRoleDetailsSection: React.FC<TutorRoleDetailsSectionProps> = ({
  groups,
  onChange,
  errors = {},
}) => {
  const [groupToRemove, setGroupToRemove] = useState<number | null>(null);

  const handleAddGroup = () => {
    const lastGroup = groups[groups.length - 1];
    const nextLevel = lastGroup?.aralLevel === 'basic' && groups.length === 1 ? 'plus' : (lastGroup?.aralLevel || 'basic');
    const nextGrade = lastGroup?.gradeLevel === 'GRADE 7' && groups.length === 1 ? 'GRADE 8' : (lastGroup?.gradeLevel || 'GRADE 7');
    onChange([...groups, createDefaultRoleDetail(nextLevel, nextGrade)]);
  };

  const handleRemoveGroup = (index: number) => {
    if (groups.length <= 1) return;
    onChange(groups.filter((_, i) => i !== index));
  };

  const handleUpdateGroup = (index: number, updated: Partial<TutorRoleDetailGroup>) => {
    const next = [...groups];
    next[index] = { ...next[index], ...updated };
    onChange(next);
  };

  // Single-select ARAL Level (switches level and updates subject compatibility)
  const handleSetAralLevel = (index: number, level: 'basic' | 'plus' | 'summer') => {
    const current = groups[index];
    if (current.aralLevel === level) return;

    let nextSubject = current.subjects[0] || (level === 'plus' ? 'English' : 'Filipino');
    if (level === 'basic' && nextSubject === 'English') {
      nextSubject = 'Filipino';
    } else if (level === 'plus' && nextSubject === 'Filipino') {
      nextSubject = 'English';
    }

    handleUpdateGroup(index, {
      aralLevel: level,
      subjects: [nextSubject],
    });
  };

  // Single-select Subject
  const handleSelectSubject = (index: number, subjectName: string) => {
    const current = groups[index];
    if (subjectName === 'Filipino' && current.aralLevel === 'plus') return;
    if (subjectName === 'English' && current.aralLevel === 'basic') return;

    handleUpdateGroup(index, { subjects: [subjectName] });
  };

  // Single-select Grade Level
  const handleSetGradeLevel = (index: number, grade: string) => {
    handleUpdateGroup(index, { gradeLevel: grade });
  };

  // Single Section value
  const handleUpdateSectionValue = (groupIndex: number, val: string) => {
    const sanitized = val.toUpperCase().replace(/[^a-zA-Z0-9\s\-]/g, '');
    handleUpdateGroup(groupIndex, { sections: [sanitized] });
  };

  return (
    <div className="space-y-4">
      {/* ── Section Header ────────────────────────────────────────── */}
      <div className="border-b border-gray-100 dark:border-[#1A1A1A] pb-2">
        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
          ROLE DETAILS
        </h4>
      </div>

      {/* ── Role Details Containers List ──────────────────────────── */}
      <div className="space-y-4">
        {groups.map((group, gIdx) => {
          const groupErrorKey = `group_${gIdx}`;
          const groupError = errors[groupErrorKey];
          const currentSection = group.sections[0] || '';
          const currentSubject = group.subjects[0] || (group.aralLevel === 'basic' ? 'Filipino' : 'English');

          return (
            <div
              key={group.id}
              className="rounded-xl border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#121212] p-4 sm:p-5 shadow-2xs space-y-4 transition-all"
            >
              {/* Container Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-200/80 dark:border-[#1F1F1F]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide bg-[var(--brand)] text-white shadow-2xs">
                    Role Detail #{gIdx + 1}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-300 uppercase bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] px-2.5 py-0.5 rounded-md">
                    {group.aralLevel.toUpperCase()} • {group.gradeLevel} • {currentSubject.toUpperCase()}
                    {currentSection.trim() ? ` • ${currentSection.trim()}` : ''}
                  </span>
                </div>

                {groups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setGroupToRemove(gIdx)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2.5 py-1 rounded-md transition cursor-pointer"
                    title={`Remove Role Detail #${gIdx + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Group Error alert */}
              {groupError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{groupError}</span>
                </div>
              )}

              {/* 1. ARAL Level Selector (Outline Style Matching Subject & Grade) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  ARAL Level <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetAralLevel(gIdx, 'basic')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all cursor-pointer ${
                      group.aralLevel === 'basic'
                        ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                        : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                    }`}
                  >
                    {group.aralLevel === 'basic' && <Check className="w-3.5 h-3.5" />}
                    <span>BASIC</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetAralLevel(gIdx, 'plus')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all cursor-pointer ${
                      group.aralLevel === 'plus'
                        ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                        : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                    }`}
                  >
                    {group.aralLevel === 'plus' && <Check className="w-3.5 h-3.5" />}
                    <span>PLUS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetAralLevel(gIdx, 'summer')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all cursor-pointer ${
                      group.aralLevel === 'summer'
                        ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                        : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                    }`}
                  >
                    {group.aralLevel === 'summer' && <Check className="w-3.5 h-3.5" />}
                    <span>SUMMER</span>
                  </button>
                </div>
              </div>

              {/* 2. Assigned Subject Selector (Single Select) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Assigned Subject <span className="text-red-500">*</span>
                </label>
                <div className="p-3 bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#222222] rounded-lg">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* FILIPINO: Requires Basic or Summer */}
                    {(() => {
                      const isFilipinoDisabled = group.aralLevel === 'plus';
                      const isFilipinoSelected = !isFilipinoDisabled && currentSubject === 'Filipino';
                      return (
                        <button
                          type="button"
                          disabled={isFilipinoDisabled}
                          onClick={() => handleSelectSubject(gIdx, 'Filipino')}
                          title={isFilipinoDisabled ? 'Select BASIC or SUMMER ARAL Level above to assign Filipino' : undefined}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                            isFilipinoDisabled
                              ? 'cursor-not-allowed bg-gray-100/60 dark:bg-[#1e1e1e] border-gray-200 dark:border-[#282828] text-gray-400 dark:text-neutral-500 opacity-60'
                              : isFilipinoSelected
                              ? 'cursor-pointer border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                              : 'cursor-pointer border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                          }`}
                        >
                          {isFilipinoSelected && <Check className="w-3.5 h-3.5" />}
                          <span>FILIPINO</span>
                          {isFilipinoDisabled && (
                            <span className="text-[10px] font-normal text-gray-400 dark:text-neutral-500">
                              (Basic/Summer)
                            </span>
                          )}
                        </button>
                      );
                    })()}

                    {/* ENGLISH: Requires Plus or Summer */}
                    {(() => {
                      const isEnglishDisabled = group.aralLevel === 'basic';
                      const isEnglishSelected = !isEnglishDisabled && currentSubject === 'English';
                      return (
                        <button
                          type="button"
                          disabled={isEnglishDisabled}
                          onClick={() => handleSelectSubject(gIdx, 'English')}
                          title={isEnglishDisabled ? 'Select PLUS or SUMMER ARAL Level above to assign English' : undefined}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                            isEnglishDisabled
                              ? 'cursor-not-allowed bg-gray-100/60 dark:bg-[#1e1e1e] border-gray-200 dark:border-[#282828] text-gray-400 dark:text-neutral-500 opacity-60'
                              : isEnglishSelected
                              ? 'cursor-pointer border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                              : 'cursor-pointer border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                          }`}
                        >
                          {isEnglishSelected && <Check className="w-3.5 h-3.5" />}
                          <span>ENGLISH</span>
                          {isEnglishDisabled && (
                            <span className="text-[10px] font-normal text-gray-400 dark:text-neutral-500">
                              (Plus/Summer)
                            </span>
                          )}
                        </button>
                      );
                    })()}

                    {/* SCIENCE */}
                    {(() => {
                      const isSelected = currentSubject === 'Science';
                      return (
                        <button
                          type="button"
                          onClick={() => handleSelectSubject(gIdx, 'Science')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                              : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          <span>SCIENCE</span>
                        </button>
                      );
                    })()}

                    {/* MATH */}
                    {(() => {
                      const isSelected = currentSubject === 'Math';
                      return (
                        <button
                          type="button"
                          onClick={() => handleSelectSubject(gIdx, 'Math')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                              : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          <span>MATH</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* 3. Assigned Grade Level (Single Select) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Assigned Grade Level <span className="text-red-500">*</span>
                </label>
                <div className="p-3 bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#222222] rounded-lg">
                  <div className="flex flex-wrap items-center gap-2">
                    {GRADE_OPTIONS.map((grade) => {
                      const isSelected = group.gradeLevel === grade;
                      return (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => handleSetGradeLevel(gIdx, grade)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                              : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          <span>{grade}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 4. Assigned Section */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Assigned Section for {group.gradeLevel} <span className="text-red-500">*</span>
                </label>
                <div className="max-w-md">
                  <input
                    type="text"
                    value={currentSection}
                    onChange={(e) => handleUpdateSectionValue(gIdx, e.target.value)}
                    placeholder="e.g. HYACINTH"
                    className="w-full rounded-md border border-gray-300 dark:border-[#222222] bg-white dark:bg-[#181818] px-3 py-2 text-xs font-semibold uppercase shadow-2xs focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Button to Add Another Role Details Container */}
      <button
        type="button"
        onClick={handleAddGroup}
        className="w-full py-3 px-4 border-2 border-dashed border-gray-300 dark:border-[#262626] hover:border-[var(--brand)] dark:hover:border-[var(--brand)] rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 hover:text-[var(--brand)] dark:hover:text-[var(--brand)] bg-white/60 dark:bg-[#121212] hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
      >
        <Plus className="w-4 h-4" />
        <span>Add Another Role Details</span>
      </button>

      {/* ── Remove Role Detail Confirmation Modal ───────────────────────── */}
      {groupToRemove !== null && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
          style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
          onClick={(e) => { if (e.target === e.currentTarget) setGroupToRemove(null); }}
        >
          <div className="relative w-full max-w-sm rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-3 animate-fade-in-scale">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900">
                <Trash2 className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase">
                  Remove Role Detail
                </h3>
                <p className="mt-1.5 text-xs font-normal text-gray-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to remove Role Detail #{groupToRemove + 1}? Any assigned ARAL Level, Subject, Grade Level, and Section in this role detail will be deleted.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setGroupToRemove(null)}
                className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRemoveGroup(groupToRemove);
                  setGroupToRemove(null);
                }}
                className="rounded-md bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
