import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Grade, User, StudentCompleteHistory, SchoolYear } from '../../types';
import {
  CalendarDays,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Check,
  X,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { getScoreDescription, getActiveSystemSemester } from '../../utils/sessionDescriptionHelpers';
import { compareNamesByLastName } from '../../utils/studentFormatters';

/* ─── Helpers ─────────────────────────────────────────────────── */

const smartPct = (n: number): string => {
  const fixed2 = n.toFixed(2);
  return parseFloat(fixed2).toString();
};

export const getDepEdSchoolYear = (date: Date = new Date()) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  let syStart = year;
  let syEnd = year + 1;
  let currentPeriod: '1st' | '2nd' | 'summer' = '1st';

  if (month < 7) {
    syStart = year - 1;
    syEnd = year;
    currentPeriod = month === 6 ? 'summer' : '2nd';
  } else {
    currentPeriod = '1st';
  }

  return {
    syStart,
    syEnd,
    currentPeriod,
    currentKey: `${syStart}-${syEnd}`,
    displayLabel: `SY ${syStart}–${syEnd}`,
  };
};

export const resolveTutorForPeriod = (
  sy: string,
  period: '1st' | '2nd' | 'summer',
  studentHistory: StudentCompleteHistory | null
): string | null => {
  if (!studentHistory) return null;

  if (period === 'summer' && studentHistory.summer_history) {
    const summer = studentHistory.summer_history.find((s) => s.school_year === sy);
    if (summer?.evaluator) return summer.evaluator;
  }

  if (studentHistory.tutor_history) {
    const matchingTutor = studentHistory.tutor_history.find((t) => {
      if (t.school_year !== sy) return false;
      const p = t.period?.toLowerCase() || '';
      if (period === '1st' && (p.includes('1st') || p.includes('mosy'))) return true;
      if (period === '2nd' && (p.includes('2nd') || p.includes('eosy'))) return true;
      if (period === 'summer' && p.includes('summer')) return true;
      return p.includes('full');
    });
    if (matchingTutor?.tutor_name) return matchingTutor.tutor_name;
  }

  if (studentHistory.enrollment_history) {
    const enrollment = studentHistory.enrollment_history.find((e) => e.school_year === sy);
    const tutor = enrollment?.tutor_name || (enrollment as any)?.assigned_tutor;
    if (tutor) return tutor;
  }

  return null;
};

export const getSchoolYearFromDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '2026-2027';
  const clean = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
  const d = new Date(clean);
  if (isNaN(d.getTime())) return '2026-2027';
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  // DepEd academic school year runs July/August through May/June of next year
  if (month >= 7) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
};

export const getSemesterFromGrade = (grade: Grade): '1st' | '2nd' | 'summer' => {
  if (grade.quarter === 1 || grade.quarter === 2) return '1st';
  if (grade.quarter === 3 || grade.quarter === 4) return '2nd';
  if (grade.date_logged) {
    const clean = grade.date_logged.includes('T') ? grade.date_logged : `${grade.date_logged}T00:00:00`;
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const month = d.getMonth() + 1;
      if (month >= 7 && month <= 12) return '1st';
      if (month >= 1 && month <= 5) return '2nd';
      if (month === 6) return 'summer';
    }
  }
  return '1st';
};

export const getSemesterLabel = (sem: '1st' | '2nd' | 'summer' | 'all'): string => {
  switch (sem) {
    case '1st':
      return '1st Semester (MOSY / Q1-Q2)';
    case '2nd':
      return '2nd Semester (EOSY / Q3-Q4)';
    case 'summer':
      return 'Summer Remediation';
    default:
      return 'All Semesters';
  }
};

const formatDateString = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year} | ${weekday}`;
};

const formatTimeString = (value: string | null | undefined): string => {
  if (!value) return '—';

  // Handle standard "HH:MM:SS" or "HH:MM" time strings
  const timeParts = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeParts) {
    let hours = parseInt(timeParts[1], 10);
    const minutes = timeParts[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  // Handle full ISO / datetime strings
  const date = new Date(value.includes('T') || value.includes(' ') ? value : `1970-01-01T${value}`);
  if (!Number.isNaN(date.getTime())) {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  return value;
};

const formatDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const formatDateButtonLabel = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00`);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(d.getDate()).padStart(2, '0');
  return `${month} ${day}`;
};

const getWeekdaysForMonday = (mondayStr: string, extraDates: string[] = []): string[] => {
  const dates: string[] = [];
  const monday = new Date(`${mondayStr}T00:00:00`);
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toLocaleDateString('en-CA'));
  }
  extraDates.forEach((d) => {
    if (d && !dates.includes(d)) dates.push(d);
  });
  return dates.sort();
};

const computeWeekOfMonth = (dateObj: Date): number => {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const day = d.getDay();
  const wedDiff = day === 0 ? 3 : 3 - day;
  const wednesday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + wedDiff);
  const firstDay = new Date(wednesday.getFullYear(), wednesday.getMonth(), 1).getDay();
  return Math.ceil((wednesday.getDate() + (firstDay === 0 ? 6 : firstDay - 1)) / 7);
};

const getWeekKey = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return mon.toLocaleDateString('en-CA');
};

const getWeekTitle = (mondayStr: string) => {
  const d = new Date(`${mondayStr}T00:00:00`);
  const weekNum = computeWeekOfMonth(d);
  return `WEEK ${weekNum}`;
};

const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);

const getMonthTitle = (monthKey: string) => {
  const d = new Date(`${monthKey}-01T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
};

type ScoreTableGroup = {
  key: string;
  title: string;
  weekMonday?: string;
  isMonthGroup?: boolean;
  rows: Grade[];
};

/* ─── Calendar Dropdown ───────────────────────────────────────── */

const CustomCalendarDropdown: React.FC<{
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onClear: () => void;
  onClose: () => void;
  loggedDates: Set<string>;
  className?: string;
}> = ({ selectedDate, onSelectDate, onClear, onClose, loggedDates, className }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00');
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div
      ref={dropdownRef}
      className={`absolute z-50 mt-2 p-4 w-72 rounded-2xl bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] shadow-xl text-gray-800 dark:text-slate-200 ${className || ''}`}
      style={{ top: '100%', right: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1A1A1A] text-gray-500 hover:text-gray-900 dark:hover:text-slate-100 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold text-gray-900 dark:text-slate-100">{monthName}</span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1A1A1A] text-gray-500 hover:text-gray-900 dark:hover:text-slate-100 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <span key={i} className="text-[10px] font-bold text-gray-400 dark:text-slate-500">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const key = formatDateKey(year, month, d);
          const isSelected = selectedDate === key;
          const hasLog = loggedDates.has(key);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className={`relative py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${isSelected
                ? 'bg-[var(--brand)] text-white font-bold'
                : 'hover:bg-gray-100 dark:hover:bg-[#1A1A1A] text-gray-700 dark:text-slate-300'
                }`}
            >
              {d}
              {hasLog && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--brand)]" />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#1A1A1A] flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold text-rose-500 hover:text-rose-600 cursor-pointer"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
};

/* ─── ScoreHistoryGroupSection (matches Tutor Score UI & Sorting) ───────── */

interface ScoreHistoryGroupSectionProps {
  tableGroup: ScoreTableGroup;
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  formatDateStr: (d?: string | null) => string;
  formatTimeStr: (d?: string | null) => string;
  studentHistory: StudentCompleteHistory | null;
}

const ScoreHistoryGroupSection: React.FC<ScoreHistoryGroupSectionProps> = ({
  tableGroup,
  selectedDate,
  onSelectDate,
  formatDateStr,
  formatTimeStr,
  studentHistory,
}) => {
  const datesWithRecords = useMemo(() => {
    return new Set(tableGroup.rows.map((r) => r.date_logged?.slice(0, 10)));
  }, [tableGroup.rows]);

  const groupDates = useMemo(() => {
    if (tableGroup.isMonthGroup) {
      return Array.from(datesWithRecords).sort();
    }
    const recordDates = Array.from(datesWithRecords);
    return getWeekdaysForMonday(tableGroup.weekMonday || tableGroup.key, recordDates);
  }, [tableGroup.isMonthGroup, tableGroup.weekMonday, tableGroup.key, datesWithRecords]);

  const isOpen = useMemo(() => {
    if (!selectedDate) return false;
    return groupDates.includes(selectedDate);
  }, [groupDates, selectedDate]);

  const displayRows = useMemo(() => {
    if (!selectedDate || !isOpen) return tableGroup.rows;
    return tableGroup.rows.filter((r) => r.date_logged?.slice(0, 10) === selectedDate);
  }, [tableGroup.rows, selectedDate, isOpen]);

  type SortKey = 'student' | 'description' | 'score' | 'remarks' | 'status' | 'date' | 'time';
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return displayRows;
    return [...displayRows].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      const aTotal = Number(a.total_score) || 100;
      const bTotal = Number(b.total_score) || 100;
      const aPct = (Number(a.score) / aTotal) * 100;
      const bPct = (Number(b.score) / bTotal) * 100;
      const aNotTaken = a.remarks?.trim().toLowerCase() === 'not taken';
      const bNotTaken = b.remarks?.trim().toLowerCase() === 'not taken';

      if (sortConfig.key === 'student') {
        const aName = a.tutor_name || resolveTutorForPeriod(getSchoolYearFromDate(a.date_logged || a.created_at), getSemesterFromGrade(a), studentHistory) || studentHistory?.current_tutor || 'Assigned Tutor';
        const bName = b.tutor_name || resolveTutorForPeriod(getSchoolYearFromDate(b.date_logged || b.created_at), getSemesterFromGrade(b), studentHistory) || studentHistory?.current_tutor || 'Assigned Tutor';
        const cmp = compareNamesByLastName(aName, bName);
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      } else if (sortConfig.key === 'description') {
        aVal = getScoreDescription(a);
        bVal = getScoreDescription(b);
      } else if (sortConfig.key === 'score') {
        return sortConfig.direction === 'asc' ? aPct - bPct : bPct - aPct;
      } else if (sortConfig.key === 'remarks') {
        aVal = aNotTaken ? 'Not Taken' : aPct >= 70 ? 'Passed' : 'Failed';
        bVal = bNotTaken ? 'Not Taken' : bPct >= 70 ? 'Passed' : 'Failed';
      } else if (sortConfig.key === 'status') {
        aVal = aNotTaken ? 'Not Taken' : 'Taken';
        bVal = bNotTaken ? 'Not Taken' : 'Taken';
      } else if (sortConfig.key === 'date') {
        aVal = a.date_logged || '';
        bVal = b.date_logged || '';
      } else if (sortConfig.key === 'time') {
        aVal = a.created_at || '';
        bVal = b.created_at || '';
      }
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [displayRows, sortConfig, studentHistory]);

  const SortableScoreHeader: React.FC<{ label: string; sortKey: SortKey }> = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer"
        aria-label={`Sort by ${label}`}
      >
        {label}
        {isActive ? (
          sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-2.5 border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-slate-100 select-none">
              {tableGroup.title}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {groupDates.map((dateStr) => {
              const hasRecord = datesWithRecords.has(dateStr);
              const isSelected = selectedDate === dateStr;
              const label = formatDateButtonLabel(dateStr);
              const dateGrades = tableGroup.rows.filter((r) => r.date_logged?.slice(0, 10) === dateStr);
              const hasMilestone = dateGrades.some((g) => getScoreDescription(g) !== 'Intervention Activity');
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={!hasRecord}
                  onClick={() => onSelectDate(dateStr)}
                  className={`h-7.5 whitespace-nowrap rounded-md px-3 text-[11px] font-bold uppercase transition-all inline-flex items-center gap-1.5 ${
                    hasRecord
                      ? isSelected
                        ? 'bg-[var(--brand)] text-white shadow-xs font-bold border border-[var(--brand)] cursor-pointer'
                        : hasMilestone
                        ? 'bg-orange-50 text-orange-700 border border-orange-300 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60 cursor-pointer font-semibold'
                        : 'bg-blue-50/80 text-[var(--brand)] border border-blue-200/80 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 dark:hover:bg-blue-900/50 cursor-pointer font-semibold'
                      : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-[#222222] cursor-not-allowed opacity-50'
                  }`}
                  title={
                    hasRecord
                      ? isSelected
                        ? `Active: ${label}`
                        : `View ${label}${hasMilestone ? ' (Milestone Assessment)' : ''}`
                      : `No records on ${label}`
                  }
                  aria-label={label}
                >
                  {hasMilestone && (
                    <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-orange-300' : 'bg-orange-500'}`} />
                  )}
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {isOpen && (
          <span className="text-[11px] font-semibold text-gray-400">
            {displayRows.length} Record{displayRows.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isOpen && (
        <>
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-x-auto mobile-scroll-table -mx-2 px-2">
            <table className="min-w-[900px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm">
              <thead>
                <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                  <th className="w-[22%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    <SortableScoreHeader label="HANDLED BY (TUTOR)" sortKey="student" />
                  </th>
                  <th className="w-[18%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    <SortableScoreHeader label="DESCRIPTION" sortKey="description" />
                  </th>
                  <th className="w-[10%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    <SortableScoreHeader label="SCORE" sortKey="score" />
                  </th>
                  <th className="w-[12%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    <SortableScoreHeader label="REMARK" sortKey="remarks" />
                  </th>
                  <th className="w-[10%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    <SortableScoreHeader label="STATUS" sortKey="status" />
                  </th>
                  <th className="w-[14%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    <SortableScoreHeader label="DATE" sortKey="date" />
                  </th>
                  <th className="w-[8%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    <SortableScoreHeader label="TIME" sortKey="time" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                {sortedRows.map((grade) => {
                  const isNotTaken = grade.remarks?.trim().toLowerCase() === 'not taken';
                  const totalScore = Number(grade.total_score) || 100;
                  const scorePct = (Number(grade.score) / totalScore) * 100;
                  const desc = getScoreDescription(grade);
                  const gradeSy = getSchoolYearFromDate(grade.date_logged || grade.created_at);
                  const gradeSem = getSemesterFromGrade(grade);
                  const handlerName =
                    grade.tutor_name ||
                    resolveTutorForPeriod(gradeSy, gradeSem, studentHistory) ||
                    studentHistory?.current_tutor ||
                    'Assigned Tutor';

                  return (
                    <tr key={grade.id} className="group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#111111]/80">
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-100 whitespace-nowrap">
                        {handlerName}
                      </td>
                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                          desc !== 'Intervention Activity'
                            ? 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300 font-bold'
                            : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {desc}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 dark:text-slate-300 whitespace-nowrap font-medium">
                        {grade.score} / {grade.total_score}
                      </td>
                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                          isNotTaken
                            ? 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                            : scorePct >= 70
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}>
                          {isNotTaken ? 'Not Taken' : scorePct >= 70 ? 'Passed' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize whitespace-nowrap ${
                          isNotTaken
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}>
                          {isNotTaken ? 'Not Taken' : 'Taken'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs">
                        {formatDateStr(grade.date_logged)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs">
                        {formatTimeStr(grade.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="md:hidden space-y-3">
            {sortedRows.map((grade) => {
              const isNotTaken = grade.remarks?.trim().toLowerCase() === 'not taken';
              const scoreNum = Number(grade.score);
              const totalNum = Number(grade.total_score);
              const validTotal = !isNaN(totalNum) && totalNum > 0 ? totalNum : 100;
              const validScore = !isNaN(scoreNum) ? scoreNum : 0;
              const scorePercentage = (validScore / validTotal) * 100;
              const descriptionVal = getScoreDescription(grade);
              const gradeSy = getSchoolYearFromDate(grade.date_logged || grade.created_at);
              const gradeSem = getSemesterFromGrade(grade);
              const handlerName =
                grade.tutor_name ||
                resolveTutorForPeriod(gradeSy, gradeSem, studentHistory) ||
                studentHistory?.current_tutor ||
                'Assigned Tutor';

              return (
                <div
                  key={`mobile-row-${grade.id}`}
                  className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 dark:text-slate-100 truncate">
                        {handlerName}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                        {formatDateStr(grade.date_logged)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        descriptionVal !== 'Intervention Activity'
                          ? 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300 font-bold'
                          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {descriptionVal}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                        isNotTaken
                          ? 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                          : scorePercentage >= 70
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      {isNotTaken ? 'Not Taken' : scorePercentage >= 70 ? 'Passed' : 'Failed'}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                        isNotTaken
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      }`}
                    >
                      {isNotTaken ? 'Not Taken' : 'Taken'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50/80 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                        Score
                      </span>
                      <p className="text-xl font-extrabold text-gray-900 dark:text-slate-100">
                        {grade.score}{' '}
                        <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                          / {grade.total_score}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                        Result
                      </span>
                      <p className={`text-xl font-black ${isNotTaken ? 'text-gray-400' : scorePercentage >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isNotTaken ? '0%' : `${smartPct(scorePercentage)}%`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500 pt-0.5">
                    <span className="truncate">{formatDateStr(grade.date_logged)}</span>
                    <span>{formatTimeStr(grade.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/* ─── Main Component ──────────────────────────────────────────── */

type ViewMode = 'week' | 'month';

export const StudentScores: React.FC = () => {
  const { user } = useAuth();
  const studentFirstName = user?.first_name || user?.full_name?.trim().split(' ')[0] || 'Student';
  const studentFullName = user?.full_name || 'STUDENT';
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sort States
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);

  // ── Unified School Year - Semester/Summer Filter State ──
  const currentSchoolYear = useMemo(() => getDepEdSchoolYear(), []);
  const [activeSystemSy, setActiveSystemSy] = useState<string>(
    () => `${currentSchoolYear.syStart}-${currentSchoolYear.syEnd}`
  );
  const [activeSystemSem, setActiveSystemSem] = useState<'1st' | '2nd' | 'summer'>(
    () => (getActiveSystemSemester() || currentSchoolYear.currentPeriod) as '1st' | '2nd' | 'summer'
  );
  const activePeriodKey = useMemo(() => `${activeSystemSy}|${activeSystemSem}`, [activeSystemSy, activeSystemSem]);

  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    () => `${currentSchoolYear.syStart}-${currentSchoolYear.syEnd}|${currentSchoolYear.currentPeriod}`
  );
  const [studentHistory, setStudentHistory] = useState<StudentCompleteHistory | null>(null);

  // Fetch grades, complete history, and current active school year
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const [gradesData, historyData, currentSyData] = await Promise.allSettled([
          academicService.getGrades({ student_id: String(user.id) }),
          academicService.getStudentCompleteHistory(String(user.id)),
          academicService.getCurrentSchoolYear(),
        ]);
        if (!cancelled) {
          if (gradesData.status === 'fulfilled') {
            const myGrades = gradesData.value.filter((g) => String(g.student) === String(user.id));
            setGrades(myGrades);
          }
          if (historyData.status === 'fulfilled') {
            setStudentHistory(historyData.value);
          }
          if (currentSyData.status === 'fulfilled' && currentSyData.value?.school_year) {
            const activeSy = currentSyData.value.school_year;
            const activeSem = (currentSyData.value.current_semester || currentSyData.value.current_period || getActiveSystemSemester() || '1st') as '1st' | '2nd' | 'summer';
            setActiveSystemSy(activeSy);
            setActiveSystemSem(activeSem);
            const resolvedActiveKey = `${activeSy}|${activeSem}`;
            setSelectedPeriod((prev) => {
              if (!prev || prev === `${currentSchoolYear.syStart}-${currentSchoolYear.syEnd}|${currentSchoolYear.currentPeriod}` || prev === activePeriodKey) {
                return resolvedActiveKey;
              }
              return prev;
            });
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error(err);
          setError('Failed to load scores.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, [user, currentSchoolYear.currentPeriod, activePeriodKey]);

  // Distinct dates with grades (for calendar)
  const loggedDates = useMemo(() => {
    const set = new Set<string>();
    grades.forEach((g) => {
      const dStr = g.date_logged || g.created_at;
      if (dStr) {
        set.add(dStr.slice(0, 10));
      }
    });
    return set;
  }, [grades]);

  // Dropdown options in SCHOOLYEAR - SEMESTER/SUMMER format (only existing records + active period)
  const schoolYearOptions = useMemo(() => {
    const activeKey = `${activeSystemSy}|${activeSystemSem}`;

    const recordedPeriods = new Set<string>();

    // Always include current active period
    recordedPeriods.add(activeKey);

    // 1. From student's actual grades
    for (const g of grades) {
      const gDate = g.date_logged || g.created_at;
      const sy = getSchoolYearFromDate(gDate);
      const sem = getSemesterFromGrade(g);
      if (sy && sem) {
        recordedPeriods.add(`${sy}|${sem}`);
      }
    }

    // 2. From student history (summer)
    if (studentHistory?.summer_history) {
      for (const s of studentHistory.summer_history) {
        if (s.school_year) {
          recordedPeriods.add(`${s.school_year}|summer`);
        }
      }
    }

    // 3. From student history (tutor assignments)
    if (studentHistory?.tutor_history) {
      for (const t of studentHistory.tutor_history) {
        if (t.school_year) {
          const p = t.period?.toLowerCase() || '';
          if (p.includes('1st') || p.includes('mosy')) {
            recordedPeriods.add(`${t.school_year}|1st`);
          } else if (p.includes('2nd') || p.includes('eosy')) {
            recordedPeriods.add(`${t.school_year}|2nd`);
          } else if (p.includes('summer')) {
            recordedPeriods.add(`${t.school_year}|summer`);
          } else if (p.includes('full')) {
            recordedPeriods.add(`${t.school_year}|1st`);
            recordedPeriods.add(`${t.school_year}|2nd`);
          }
        }
      }
    }

    // 4. From student history (enrollment history)
    if (studentHistory?.enrollment_history) {
      for (const e of studentHistory.enrollment_history) {
        if (e.school_year) {
          if (e.mosy_result && e.mosy_result !== '—') {
            recordedPeriods.add(`${e.school_year}|1st`);
          }
          if (e.eosy_result && e.eosy_result !== '—') {
            recordedPeriods.add(`${e.school_year}|2nd`);
          }
          if (e.summer_status && e.summer_status !== 'none') {
            recordedPeriods.add(`${e.school_year}|summer`);
          }
          if (!e.mosy_result && !e.eosy_result && !e.summer_status) {
            recordedPeriods.add(`${e.school_year}|1st`);
          }
        }
      }
    }

    // Convert to list of { sy, sem }
    const periodsList = Array.from(recordedPeriods).map((key) => {
      const [sy, sem] = key.split('|');
      return { key, sy, sem: sem as '1st' | '2nd' | 'summer' };
    });

    // Sort descending by starting year, then semester order, placing active period first
    const semRank: Record<string, number> = { '1st': 1, '2nd': 2, 'summer': 3 };
    periodsList.sort((a, b) => {
      if (a.key === activeKey) return -1;
      if (b.key === activeKey) return 1;
      const yearA = parseInt(a.sy.split('-')[0], 10) || 0;
      const yearB = parseInt(b.sy.split('-')[0], 10) || 0;
      if (yearA !== yearB) {
        return yearB - yearA;
      }
      return (semRank[a.sem] || 0) - (semRank[b.sem] || 0);
    });

    const opts: { key: string; label: string }[] = [];

    periodsList.forEach(({ key, sy, sem }) => {
      const isCurrent = key === activeKey;
      const tag = isCurrent ? ' (Active)' : '';
      const syDisplay = `SY ${sy.replace('-', '–')}`;
      const semDisplay = sem === '1st' ? '1st Semester' : sem === '2nd' ? '2nd Semester' : 'Summer';

      const tutor = resolveTutorForPeriod(sy, sem, studentHistory) || (isCurrent ? studentHistory?.current_tutor : null);
      const tutorSuffix = tutor ? ` — ${tutor}` : '';

      opts.push({
        key,
        label: `${syDisplay} - ${semDisplay}${tag}${tutorSuffix}`,
      });
    });

    return opts;
  }, [activeSystemSy, activeSystemSem, studentHistory, grades]);

  const effectiveSelectedPeriod = useMemo(() => {
    if (schoolYearOptions.some((opt) => opt.key === selectedPeriod)) {
      return selectedPeriod;
    }
    return activePeriodKey;
  }, [selectedPeriod, schoolYearOptions, activePeriodKey]);

  // ── Filter by Unified School Year - Semester & jumpDate ──
  const filteredGrades = useMemo(() => {
    let result = [...grades];
    if (effectiveSelectedPeriod && effectiveSelectedPeriod.includes('|')) {
      const [filterSy, filterSem] = effectiveSelectedPeriod.split('|');
      if (filterSy) {
        result = result.filter((g) => {
          const sy = getSchoolYearFromDate(g.date_logged || g.created_at);
          return sy === filterSy;
        });
      }
      if (filterSem) {
        result = result.filter((g) => {
          const sem = getSemesterFromGrade(g);
          return sem === filterSem;
        });
      }
    }
    if (jumpDate) {
      result = result.filter((g) => g.date_logged === jumpDate);
    }
    return result;
  }, [grades, effectiveSelectedPeriod, jumpDate]);

  // ── Top KPI Stat Calculations (scoped to current filtered view) ──
  const { passedCount, failedCount, calculatedAvgScore } = useMemo(() => {
    if (filteredGrades.length === 0) {
      return { passedCount: 0, failedCount: 0, calculatedAvgScore: 0 };
    }
    const takenGrades = filteredGrades.filter(
      (g) => g.remarks?.trim().toLowerCase() !== 'not taken'
    );
    const passed = takenGrades.filter((g) => {
      const total = Number(g.total_score) || 100;
      return (Number(g.score) / total) >= 0.7;
    }).length;
    const failed = takenGrades.filter((g) => {
      const total = Number(g.total_score) || 100;
      return (Number(g.score) / total) < 0.7;
    }).length;
    const avg = takenGrades.length > 0
      ? Number((takenGrades.reduce((sum, g) => sum + ((Number(g.score) / (Number(g.total_score) || 100)) * 100), 0) / takenGrades.length).toFixed(2))
      : 0;
    return {
      passedCount: passed,
      failedCount: failed,
      calculatedAvgScore: avg,
    };
  }, [filteredGrades]);

  const hasScoreData = useMemo(() => {
    return filteredGrades.some((g) => g.remarks?.trim().toLowerCase() !== 'not taken');
  }, [filteredGrades]);

  const sortedHistory = useMemo(
    () => [...filteredGrades].sort((a, b) => (b.date_logged > a.date_logged ? 1 : b.date_logged < a.date_logged ? -1 : 0)),
    [filteredGrades]
  );

  const mostRecentDateWithEntry = useMemo(() => {
    if (sortedHistory.length === 0) return null;
    return sortedHistory[0].date_logged?.slice(0, 10) || null;
  }, [sortedHistory]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (jumpDate) {
      setSelectedDate(jumpDate);
    } else if (mostRecentDateWithEntry) {
      setSelectedDate(mostRecentDateWithEntry);
    } else {
      setSelectedDate(null);
    }
  }, [jumpDate, mostRecentDateWithEntry, viewMode]);

  const groupedHistory = useMemo((): ScoreTableGroup[] => {
    if (jumpDate) {
      return [{
        key: jumpDate,
        title: viewMode === 'week' ? getWeekTitle(getWeekKey(jumpDate)) : getMonthTitle(getMonthKey(jumpDate)),
        weekMonday: getWeekKey(jumpDate),
        isMonthGroup: viewMode === 'month',
        rows: sortedHistory,
      }];
    }
    const grouped = new Map<string, Grade[]>();
    for (const log of sortedHistory) {
      const dateKey = log.date_logged?.slice(0, 10) || log.date_logged;
      if (!dateKey) continue;
      const key = viewMode === 'week' ? getWeekKey(dateKey) : getMonthKey(dateKey);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, rows]) => ({
        key,
        title: viewMode === 'week' ? getWeekTitle(key) : getMonthTitle(key),
        weekMonday: viewMode === 'week' ? key : undefined,
        isMonthGroup: viewMode === 'month',
        rows,
      }));
  }, [sortedHistory, jumpDate, viewMode]);
  const visibleRecordsCount = sortedHistory.length;

  if (loading) {
    return (
      <div className="space-y-4 skeleton-container" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* KPI containers skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 skeleton-row-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 min-h-[100px] flex items-center gap-3.5 animate-pulse"
            >
              {i < 3 && <div className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-800 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
                <div className="h-7 w-14 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-2 w-44 rounded bg-gray-100 dark:bg-gray-800/60 mt-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Score Entries Table skeleton */}
        <div className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] overflow-hidden skeleton-row-2">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1">
              <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-28 rounded-md bg-gray-100 dark:bg-gray-800" />
              <div className="h-8 w-8 rounded-md bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
          <div className="p-4 sm:p-5 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-md bg-gray-100 dark:bg-gray-800/60" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 data-loaded-content" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── Top KPI Stat Containers ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* TOTAL PASSED */}
        <div className="rounded-md border border-emerald-500 dark:border-emerald-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#0A0A0A]">
          <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={3} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">TOTAL PASSED</p>
            <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">{passedCount}</p>
            <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s total passed score records</p>
          </div>
        </div>

        {/* TOTAL FAILED */}
        <div className="rounded-md border border-rose-500 dark:border-rose-500 bg-white p-4 min-h-[100px] flex items-center gap-3.5 dark:bg-[#0A0A0A]">
          <X className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">TOTAL FAILED</p>
            <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-100 mt-0.5">{failedCount}</p>
            <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s total failed score records</p>
          </div>
        </div>

        {/* AVERAGE SCORE */}
        <div className="rounded-md border border-gray-200 bg-white p-4 min-h-[100px] flex flex-col justify-center dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">AVERAGE SCORE</p>
            <p
              className={`text-2xl font-extrabold mt-0.5 ${
                !hasScoreData
                  ? 'text-gray-900 dark:text-slate-100'
                  : calculatedAvgScore >= 81
                  ? 'text-risk-low text-emerald-600 dark:text-emerald-400'
                  : calculatedAvgScore >= 70
                  ? 'text-risk-medium text-amber-600 dark:text-amber-400'
                  : 'text-risk-high text-rose-600 dark:text-rose-400'
              }`}
            >
              {hasScoreData ? `${smartPct(calculatedAvgScore)}%` : '—'}
            </p>
            <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s average score</p>
          </div>
        </div>
      </div>

      {/* ── Academic Records Container ──────────────────────────────────── */}
      <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] relative">
        {/* Header & Controls Toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3.5 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
          <div className="min-w-0 flex-1 truncate">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-xs sm:text-sm uppercase truncate">
              {studentFirstName}'s Academic Records
            </h3>
            <p className="mt-0.5 text-[10px] sm:text-xs font-medium text-gray-500 dark:text-slate-400 truncate">
              {visibleRecordsCount} Record{visibleRecordsCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Filter controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
            {/* Unified School Year - Semester/Summer Dropdown (matches Tutor Assigned Students dropdown) */}
            <div className="relative inline-flex items-center shrink-0">
              <select
                value={effectiveSelectedPeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value);
                  setJumpDate(null);
                }}
                aria-label="Filter by School Year and Semester"
                className="h-7.5 sm:h-8 appearance-none rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] pl-2.5 pr-7 sm:pl-3 sm:pr-8 text-[11px] sm:text-xs font-bold text-[var(--brand)] outline-none transition hover:bg-gray-100 dark:hover:bg-[#222222] focus:border-[var(--brand)] cursor-pointer"
              >
                {schoolYearOptions.map((opt) => (
                  <option
                    key={opt.key}
                    value={opt.key}
                    className="bg-white dark:bg-[#111111] text-gray-800 dark:text-slate-200 font-medium"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 sm:right-2.5 h-3 sm:h-3.5 w-3 sm:w-3.5 text-[var(--brand)] opacity-75" />
            </div>

            {/* View mode toggle (WEEK / MONTH) */}
            <div className="flex bg-gray-100 dark:bg-[#111111] rounded-md p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
              {(['week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setViewMode(mode);
                    setJumpDate(null);
                  }}
                  className={`h-7.5 sm:h-7 whitespace-nowrap rounded-sm px-2 sm:px-3 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer ${viewMode === mode && !jumpDate
                    ? 'bg-[var(--brand)] text-white'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                    }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Custom Calendar Dropdown Button */}
            <div className="relative inline-flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setShowCalendarPopover((prev) => !prev)}
                className={`flex h-7.5 w-7.5 sm:h-8 sm:w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border p-0 transition-all ${jumpDate
                  ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                  : 'border-[var(--brand-border)] bg-[var(--brand-light)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)]'
                  }`}
                title="Select a specific date from calendar"
                aria-label="Open score calendar"
              >
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {showCalendarPopover && (
                <CustomCalendarDropdown
                  selectedDate={jumpDate}
                  onSelectDate={(d) => {
                    setJumpDate(d);
                    setShowCalendarPopover(false);
                  }}
                  onClear={() => {
                    setJumpDate(null);
                    setShowCalendarPopover(false);
                  }}
                  onClose={() => setShowCalendarPopover(false)}
                  loggedDates={loggedDates}
                />
              )}
            </div>
          </div>
        </div>

        {/* Jump-to-date active chip */}
        {jumpDate && (
          <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-50 dark:border-[#1A1A1A] bg-emerald-50/60 dark:bg-emerald-950/20">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {new Date(jumpDate + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <button
              type="button"
              onClick={() => setJumpDate(null)}
              className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-5">
          {error ? (
            <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-md p-4">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold">Failed to load scores</p>
                <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
              </div>
            </div>
          ) : sortedHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarDays className="w-10 h-10 text-gray-200 dark:text-gray-700" />
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">
                {jumpDate ? 'No records for this date' : 'No score records yet'}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                {jumpDate ? 'Try a different date or clear the filter' : 'Records will appear once scores are logged for you'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedHistory.map((group) => (
                <ScoreHistoryGroupSection
                  key={group.key}
                  tableGroup={group}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  formatDateStr={formatDateString}
                  formatTimeStr={formatTimeString}
                  studentHistory={studentHistory}
                />
              ))}
            </div>
          )}
        </div>
      </div>


    </div>
  );
};

export default StudentScores;
