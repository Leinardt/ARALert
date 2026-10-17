import React from 'react';
import { Plus, Trash2, Layers, Check, AlertCircle } from 'lucide-react';
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
  const handleAddGroup = () => {
    // If the last group was basic, default next group to plus if only 1 exists, or match pattern
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

  const handleSetAralLevel = (index: number, level: 'basic' | 'plus') => {
    const current = groups[index];
    if (current.aralLevel === level) return;

    let updatedSubjects = [...current.subjects];
    if (level === 'basic') {
      updatedSubjects = updatedSubjects.filter((s) => s !== 'English');
      if (!updatedSubjects.includes('Filipino')) updatedSubjects.unshift('Filipino');
    } else {
      updatedSubjects = updatedSubjects.filter((s) => s !== 'Filipino');
      if (!updatedSubjects.includes('English')) updatedSubjects.unshift('English');
    }

    handleUpdateGroup(index, {
      aralLevel: level,
      subjects: updatedSubjects.length > 0 ? updatedSubjects : [level === 'basic' ? 'Filipino' : 'English'],
    });
  };

  const handleToggleSubject = (index: number, subjectName: string) => {
    const current = groups[index];
    if (subjectName === 'Filipino' && current.aralLevel !== 'basic') return;
    if (subjectName === 'English' && current.aralLevel !== 'plus') return;

    let updated: string[];
    if (current.subjects.includes(subjectName)) {
      // Don't allow unchecking if it's the only subject
      if (current.subjects.length <= 1) return;
      updated = current.subjects.filter((s) => s !== subjectName);
    } else {
      updated = [...current.subjects, subjectName];
    }
    handleUpdateGroup(index, { subjects: updated });
  };

  const handleSetGradeLevel = (index: number, grade: string) => {
    handleUpdateGroup(index, { gradeLevel: grade });
  };

  const handleAddSectionToGroup = (groupIndex: number) => {
    const current = groups[groupIndex];
    handleUpdateGroup(groupIndex, { sections: [...current.sections, ''] });
  };

  const handleRemoveSectionFromGroup = (groupIndex: number, sectionIndex: number) => {
    const current = groups[groupIndex];
    if (current.sections.length <= 1) {
      handleUpdateGroup(groupIndex, { sections: [''] });
      return;
    }
    handleUpdateGroup(groupIndex, {
      sections: current.sections.filter((_, i) => i !== sectionIndex),
    });
  };

  const handleUpdateSectionValue = (groupIndex: number, sectionIndex: number, val: string) => {
    const sanitized = val.toUpperCase().replace(/[^a-zA-Z0-9\s\-]/g, '');
    const current = groups[groupIndex];
    const nextSections = [...current.sections];
    nextSections[sectionIndex] = sanitized;
    handleUpdateGroup(groupIndex, { sections: nextSections });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A] pb-2">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--brand)]" />
            ROLE DETAILS &amp; ASSIGNMENTS
          </h4>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Group tutor assignments by ARAL Level, Subject, Grade Level, and Sections.
          </p>
        </div>
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
          {groups.length} {groups.length === 1 ? 'Assignment Group' : 'Assignment Groups'}
        </span>
      </div>

      {/* Role Details Containers List */}
      <div className="space-y-4">
        {groups.map((group, gIdx) => {
          const groupErrorKey = `group_${gIdx}`;
          const groupError = errors[groupErrorKey];
          const validSecCount = group.sections.filter((s) => s.trim().length > 0).length;

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
                    {group.aralLevel.toUpperCase()} • {group.gradeLevel} • {group.subjects.join(', ').toUpperCase()}
                    {validSecCount > 0 ? ` • ${group.sections.filter(Boolean).join(', ')}` : ''}
                  </span>
                </div>

                {groups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveGroup(gIdx)}
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

              {/* 1. ARAL Level Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  ARAL Level <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetAralLevel(gIdx, 'basic')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md border text-xs font-bold transition-all cursor-pointer ${
                      group.aralLevel === 'basic'
                        ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-2xs'
                        : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                    }`}
                  >
                    {group.aralLevel === 'basic' && <Check className="w-3.5 h-3.5" />}
                    <span>BASIC</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetAralLevel(gIdx, 'plus')}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md border text-xs font-bold transition-all cursor-pointer ${
                      group.aralLevel === 'plus'
                        ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-2xs'
                        : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                    }`}
                  >
                    {group.aralLevel === 'plus' && <Check className="w-3.5 h-3.5" />}
                    <span>PLUS</span>
                  </button>
                </div>
              </div>

              {/* 2. Assigned Subject Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Assigned Subject <span className="text-red-500">*</span>
                </label>
                <div className="p-3 bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#222222] rounded-lg">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* FILIPINO: Requires Basic */}
                    {(() => {
                      const isFilipinoDisabled = group.aralLevel !== 'basic';
                      const isFilipinoChecked = !isFilipinoDisabled && group.subjects.includes('Filipino');
                      return (
                        <button
                          type="button"
                          disabled={isFilipinoDisabled}
                          onClick={() => handleToggleSubject(gIdx, 'Filipino')}
                          title={isFilipinoDisabled ? 'Select BASIC ARAL Level above to assign Filipino' : undefined}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                            isFilipinoDisabled
                              ? 'cursor-not-allowed bg-gray-100/60 dark:bg-[#1e1e1e] border-gray-200 dark:border-[#282828] text-gray-400 dark:text-neutral-500 opacity-60'
                              : isFilipinoChecked
                              ? 'cursor-pointer border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                              : 'cursor-pointer border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                          }`}
                        >
                          {isFilipinoChecked && <Check className="w-3.5 h-3.5" />}
                          <span>FILIPINO</span>
                          {isFilipinoDisabled && (
                            <span className="text-[10px] font-normal text-gray-400 dark:text-neutral-500">
                              (Basic)
                            </span>
                          )}
                        </button>
                      );
                    })()}

                    {/* ENGLISH: Requires Plus */}
                    {(() => {
                      const isEnglishDisabled = group.aralLevel !== 'plus';
                      const isEnglishChecked = !isEnglishDisabled && group.subjects.includes('English');
                      return (
                        <button
                          type="button"
                          disabled={isEnglishDisabled}
                          onClick={() => handleToggleSubject(gIdx, 'English')}
                          title={isEnglishDisabled ? 'Select PLUS ARAL Level above to assign English' : undefined}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                            isEnglishDisabled
                              ? 'cursor-not-allowed bg-gray-100/60 dark:bg-[#1e1e1e] border-gray-200 dark:border-[#282828] text-gray-400 dark:text-neutral-500 opacity-60'
                              : isEnglishChecked
                              ? 'cursor-pointer border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                              : 'cursor-pointer border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                          }`}
                        >
                          {isEnglishChecked && <Check className="w-3.5 h-3.5" />}
                          <span>ENGLISH</span>
                          {isEnglishDisabled && (
                            <span className="text-[10px] font-normal text-gray-400 dark:text-neutral-500">
                              (Plus)
                            </span>
                          )}
                        </button>
                      );
                    })()}

                    {/* SCIENCE */}
                    {(() => {
                      const isChecked = group.subjects.includes('Science');
                      return (
                        <button
                          type="button"
                          onClick={() => handleToggleSubject(gIdx, 'Science')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all cursor-pointer ${
                            isChecked
                              ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                              : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                          <span>SCIENCE</span>
                        </button>
                      );
                    })()}

                    {/* MATH */}
                    {(() => {
                      const isChecked = group.subjects.includes('Math');
                      return (
                        <button
                          type="button"
                          onClick={() => handleToggleSubject(gIdx, 'Math')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-all cursor-pointer ${
                            isChecked
                              ? 'border-[var(--brand)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--brand)] font-bold shadow-2xs'
                              : 'border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#181818] text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-[#383838]'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                          <span>MATH</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* 3. Assigned Grade Level */}
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

              {/* 4. Assigned Section(s) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Assigned Section(s) for {group.gradeLevel} <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2 max-w-lg">
                  {group.sections.map((sec, sIdx) => (
                    <div key={sIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={sec}
                        onChange={(e) => handleUpdateSectionValue(gIdx, sIdx, e.target.value)}
                        placeholder={sIdx === 0 ? 'e.g. HYACINTH' : `Section ${sIdx + 1}`}
                        className="w-full rounded-md border border-gray-300 dark:border-[#222222] bg-white dark:bg-[#181818] px-3 py-2 text-xs font-semibold uppercase shadow-2xs focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] dark:text-slate-100"
                      />
                      {group.sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSectionFromGroup(gIdx, sIdx)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                          title="Remove section"
                          aria-label="Remove section"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleAddSectionToGroup(gIdx)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand)] hover:underline cursor-pointer pt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Section to {group.gradeLevel}</span>
                </button>
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
        <span>+ Add Another Role Details</span>
      </button>
    </div>
  );
};
