import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { Grade, User } from '../../types';
import { ExportScoreModal } from '../../components/ExportScoreModal';
import {
  getScoreDescription,
  getCurrentSemesterMilestone,
  getActiveSystemMilestone,
  getActiveSystemSemester,
  setActiveSystemSemester,
  isAssessmentWindowOpen,
  type SemesterType,
} from '../../utils/sessionDescriptionHelpers';
import { matchesSearch } from '../../utils/searchHelpers';
import { compareNamesByLastName } from '../../utils/studentFormatters';
import {
  BookOpen,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  Lock,
  Award,
  Download,
  X,
  CalendarDays,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Search,
  Edit3,
  Check,
  Layers,
  User as UserIcon,
} from 'lucide-react';

/* ─── Constants & Helpers ──────────────────────────────────────── */
type ScoreEntryKind = 'daily' | 'mosy' | 'eosy' | 'endline';
type ScorePeriod = 'ARAL Summer Assessment' | 'MOSY' | 'EOSY';

const semesterScoreEntry: Record<ScorePeriod, { kind: ScoreEntryKind; buttonLabel: string; title: string; subject: string }> = {
  MOSY: { kind: 'mosy', buttonLabel: 'Add MOSY Score', title: 'MOSY Reading Score (Q1/Q2)', subject: 'MOSY Reading' },
  EOSY: { kind: 'eosy', buttonLabel: 'Add EOSY Score', title: 'EOSY Reading Score (Q3/Q4)', subject: 'EOSY Reading' },
  'ARAL Summer Assessment': { kind: 'endline', buttonLabel: 'Add ARAL Summer Assessment', title: 'ARAL Summer Assessment', subject: 'ARAL Summer Assessment' },
};

const generateUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const DRAFT_STORAGE_KEY_PREFIX = 'aralert_score_entry_draft_';
const STUDENTS_CACHE_KEY_PREFIX = 'aralert_assigned_students_';

interface SingleDraftState {
  entryScores: Record<string, number | ''>;
  entryStatus: Record<string, 'Taken' | 'Not'>;
  totalScore: number | '';
  logDate: string;
}

interface ScoreDraftData {
  draftsByKind?: Partial<Record<ScoreEntryKind, SingleDraftState>>;
  entryScores?: Record<string, number | ''>;
  entryStatus?: Record<string, 'Taken' | 'Not'>;
  totalScore?: number | '';
  entryKind: ScoreEntryKind;
  logDate?: string;
  showAddEntry: boolean;
  updatedAt: number;
}

const getStoredDraft = (userId?: number | string): ScoreDraftData | null => {
  if (!userId) return null;
  try {
    // Purge any lingering legacy draft from localStorage so it never persists across logins
    try {
      localStorage.removeItem(`${DRAFT_STORAGE_KEY_PREFIX}${userId}`);
    } catch {
      // ignore
    }
    const raw = sessionStorage.getItem(`${DRAFT_STORAGE_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.draftsByKind) {
        const legacyKind: ScoreEntryKind = parsed.entryKind || 'daily';
        return {
          draftsByKind: {
            [legacyKind]: {
              entryScores: parsed.entryScores || {},
              entryStatus: parsed.entryStatus || {},
              totalScore: parsed.totalScore !== undefined && parsed.totalScore !== '' ? parsed.totalScore : (legacyKind === 'daily' ? 20 : 40),
              logDate: parsed.logDate || new Date().toLocaleDateString('en-CA'),
            },
          },
          entryKind: legacyKind,
          showAddEntry: parsed.showAddEntry ?? true,
          updatedAt: parsed.updatedAt || Date.now(),
        };
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse score draft:', e);
  }
  return null;
};

const getCachedStudents = (userId?: number | string): User[] => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${STUDENTS_CACHE_KEY_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse cached students:', e);
  }
  return [];
};

const scoreColor = (pct: number) => {
  if (isNaN(pct)) return 'text-rose-500';
  return pct >= 70 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-500' : 'text-rose-500';
};

const scoreBg = (pct: number) => {
  if (isNaN(pct)) return 'bg-rose-50 border-rose-200 text-rose-700';
  return pct >= 70 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : pct >= 60 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-rose-50 border-rose-200 text-rose-700';
};

const sanitizeScoreInput = (rawVal: string, maxVal?: number): number | '' => {
  const digitsOnly = rawVal.replace(/\D/g, '');
  if (digitsOnly === '') return '';
  const num = parseInt(digitsOnly, 10);
  if (Number.isNaN(num)) return '';
  if (maxVal !== undefined && num > maxVal) return '';
  return num;
};

/** Show up to 2 decimal places but omit trailing zeros (100.00 → 100, 99.5 → 99.5, 99.57 → 99.57) */
const smartPct = (n: number): string => {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const fixed2 = n.toFixed(2);
  // Remove trailing zeros after decimal point
  const trimmed = parseFloat(fixed2).toString();
  return isNaN(Number(trimmed)) ? '0' : trimmed;
};

const blockSymbolKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['e', 'E', '+', '-', '.', ',', ' '].includes(e.key)) {
    e.preventDefault();
  }
};

import { buildAvatarColorMap } from '../../utils/studentFormatters';

const formatDateStr = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;

  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const day = d.toLocaleDateString('en-US', { day: 'numeric' });
  const year = d.toLocaleDateString('en-US', { year: 'numeric' });

  return `${month} ${day}, ${year} | ${weekday}`;
};

const formatTimeStr = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—';
  const normalized = dateStr.includes(' ') && !dateStr.includes('T') ? dateStr.replace(' ', 'T') : dateStr;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const formatDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const ScoreCalendarDropdown: React.FC<{
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onClear: () => void;
  onClose: () => void;
  loggedDates: Set<string>;
  className?: string;
  style?: React.CSSProperties;
  align?: 'left' | 'right' | 'center';
}> = ({ selectedDate, onSelectDate, onClear, onClose, loggedDates, className, style, align = 'center' }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const date = new Date(`${selectedDate}T00:00:00`);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date();
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toLocaleDateString('en-CA');
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) =>
    index < firstDay ? null : index - firstDay + 1
  );

  const alignmentClass = className?.includes('fixed')
    ? ''
    : align === 'center'
    ? 'left-1/2 -translate-x-1/2'
    : align === 'left'
    ? 'left-0'
    : 'right-0';

  return (
    <div
      ref={dropdownRef}
      className={`absolute top-full mt-2 z-[60] w-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-2xl select-none text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 ${alignmentClass} ${className || ''}`}
      style={style}
    >
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold tracking-wide text-slate-900 dark:text-slate-100">
          {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} className="h-7 w-7" />;
          const dateKey = formatDateKey(year, month, day);
          const isSelected = selectedDate === dateKey;
          const hasRecords = loggedDates.has(dateKey);
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => { onSelectDate(dateKey); onClose(); }}
              className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold cursor-pointer transition ${
                isSelected
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : dateKey === today
                  ? 'border border-[var(--brand)] text-[var(--brand)]'
                  : hasRecords
                  ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {day}
              {hasRecords && !isSelected && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--brand)]" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 text-[11px] font-semibold">
        <button type="button" onClick={() => { onSelectDate(today); onClose(); }} className="text-[var(--brand)] hover:underline cursor-pointer">Today</button>
        {selectedDate && <button type="button" onClick={() => { onClear(); onClose(); }} className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 cursor-pointer">Clear</button>}
      </div>
    </div>
  );
};

type ScoreSortKey = 'student' | 'description' | 'score' | 'remark' | 'status' | 'date' | 'time';

interface ScoreEntryTableProps {
  rows: Grade[];
  lastSavedBatchId: string | null;
  lastRowRef: React.RefObject<HTMLTableRowElement | null>;
  editingGradeId: number | null;
  editScore: number | '';
  editStatus: 'Taken' | 'Not';
  editDate: string;
  editCalendarGradeId: number | null;
  editCalendarPosition: { top: number; left: number };
  grades: Grade[];
  blockSymbolKeys: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  sanitizeScoreInput: (value: string, maxScore: number) => number | '';
  setEditScore: (score: number | '') => void;
  setEditStatus: (status: 'Taken' | 'Not') => void;
  setEditDate: (date: string) => void;
  setEditCalendarGradeId: (id: number | null) => void;
  toggleEditCalendar: (event: React.MouseEvent<HTMLButtonElement>, id: number) => void;
  startEditingGrade: (grade: Grade) => void;
  cancelEditingGrade: () => void;
  saveEditingGrade: () => void;
  isEditingGrade: boolean;
  formatDateStr: (dateStr: string) => string;
  formatTimeStr: (createdStr?: string | null) => string;
  avatarColor: (name: string) => string;
}

const ScoreEntryTable: React.FC<ScoreEntryTableProps> = ({
  rows,
  lastSavedBatchId,
  lastRowRef,
  editingGradeId,
  editScore,
  editStatus,
  editDate,
  editCalendarGradeId,
  editCalendarPosition,
  grades,
  blockSymbolKeys,
  sanitizeScoreInput,
  setEditScore,
  setEditStatus,
  setEditDate,
  setEditCalendarGradeId,
  toggleEditCalendar,
  startEditingGrade,
  cancelEditingGrade,
  saveEditingGrade,
  isEditingGrade,
  formatDateStr,
  formatTimeStr,
  avatarColor,
}) => {
  const [sortConfig, setSortConfig] = useState<{ key: ScoreSortKey | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });

  const toggleSort = (key: ScoreSortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return rows;
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    const getScoreValue = (grade: Grade) => {
      const isNotTaken = grade.remarks?.trim().toLowerCase() === 'not taken';
      const scoreNum = Number(grade.score);
      const totalNum = Number(grade.total_score);
      const validTotal = !isNaN(totalNum) && totalNum > 0 ? totalNum : 100;
      const validScore = !isNaN(scoreNum) ? scoreNum : 0;
      const scorePercentage = (validScore / validTotal) * 100;
      switch (sortConfig.key) {
        case 'student': return grade.student_name || '';
        case 'description': return getScoreDescription(grade);
        case 'score': return validScore;
        case 'remark': return isNotTaken ? 'Not Taken' : scorePercentage >= 70 ? 'Passed' : 'Failed';
        case 'status': return isNotTaken ? 'Not Taken' : 'Taken';
        case 'date': return grade.date_logged || '';
        case 'time': return grade.created_at || '';
        default: return '';
      }
    };
    const compareValues = (firstValue: string | number, secondValue: string | number) => {
      if (typeof firstValue === 'number' && typeof secondValue === 'number') return (firstValue - secondValue) * direction;
      return String(firstValue).localeCompare(String(secondValue), undefined, { numeric: true, sensitivity: 'base' }) * direction;
    };
    return [...rows].sort((first, second) => {
      if (sortConfig.key === 'student') {
        const cmp = compareNamesByLastName(first.student_name || '', second.student_name || '');
        return direction * cmp;
      }
      return compareValues(getScoreValue(first), getScoreValue(second));
    });
  }, [rows, sortConfig]);

  const SortableScoreHeader: React.FC<{ label: string; sortKey: ScoreSortKey }> = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-gray-700 cursor-pointer"
        aria-label={`Sort by ${label}`}
      >
        {label}
        {isActive ? (
          sortConfig.direction === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
        )}
      </button>
    );
  };

  return (
    <>
      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block overflow-x-auto mobile-scroll-table">
        <table className="min-w-[900px] w-full divide-y divide-gray-100 dark:divide-slate-700 text-sm">
          <thead>
            <tr className="divide-x divide-gray-100 dark:divide-slate-700 bg-gray-50 dark:bg-slate-900">
              <th className="w-[22%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap"><SortableScoreHeader label="STUDENT" sortKey="student" /></th>
              <th className="w-[18%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap"><SortableScoreHeader label="DESCRIPTION" sortKey="description" /></th>
              <th className="w-[10%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap"><SortableScoreHeader label="SCORE" sortKey="score" /></th>
              <th className="w-[12%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap"><SortableScoreHeader label="REMARK" sortKey="remark" /></th>
              <th className="w-[10%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap"><SortableScoreHeader label="STATUS" sortKey="status" /></th>
              <th className="w-[14%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap"><SortableScoreHeader label="DATE" sortKey="date" /></th>
              <th className="w-[8%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap"><SortableScoreHeader label="TIME" sortKey="time" /></th>
              <th className="w-[6%] px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-slate-700 dark:bg-slate-900">
            {sortedRows.map((grade) => {
              const isEditing = editingGradeId === grade.id;
              const isLastSaved = grade.batch_id === lastSavedBatchId;
              const isNotTaken = grade.remarks?.trim().toLowerCase() === 'not taken';
              const scoreNum = Number(grade.score);
              const totalNum = Number(grade.total_score);
              const validTotal = !isNaN(totalNum) && totalNum > 0 ? totalNum : 100;
              const validScore = !isNaN(scoreNum) ? scoreNum : 0;
              const scorePercentage = (validScore / validTotal) * 100;
              const descriptionVal = getScoreDescription(grade);
              return (
                <tr
                  key={grade.id}
                  ref={isLastSaved ? lastRowRef : undefined}
                  className={`group divide-x divide-gray-100 dark:divide-slate-700 border-t border-gray-100 dark:border-slate-700 text-left transition-colors ${isLastSaved ? 'bg-[var(--brand-light)] hover:bg-[var(--brand-light)]' : 'hover:bg-gray-50/80 dark:hover:bg-slate-800'}`}
                >
                  <td className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-100 whitespace-nowrap">
                    {grade.student_name || 'Unknown student'}
                  </td>
                  <td className="px-4 py-3 text-left whitespace-nowrap">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                      descriptionVal !== 'Intervention Activity'
                        ? 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {descriptionVal}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 dark:text-slate-300 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editScore}
                        onKeyDown={blockSymbolKeys}
                        onChange={(event) => setEditScore(sanitizeScoreInput(event.target.value, Number(grade.total_score)))}
                        className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold outline-none focus:border-[var(--brand)]"
                      />
                    ) : `${grade.score} / ${grade.total_score}`}
                  </td>
                  <td className="px-4 py-3 text-left whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${isNotTaken ? 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400' : scorePercentage >= 70 ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'}`}>
                      {isNotTaken ? 'Not Taken' : scorePercentage >= 70 ? 'Passed' : 'Failed'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left whitespace-nowrap">
                    {isEditing ? (
                      <select value={editStatus} onChange={(event) => setEditStatus(event.target.value as 'Taken' | 'Not')} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-[var(--brand)]">
                        <option value="Taken">Taken</option>
                        <option value="Not">Not Taken</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize whitespace-nowrap ${isNotTaken ? 'bg-amber-50 text-amber-700 border-amber-200 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
                        {isNotTaken ? 'Not Taken' : 'Taken'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs">
                    {isEditing ? (
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={(event) => toggleEditCalendar(event, grade.id)}
                          className="h-9 rounded-xl border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold outline-none transition-all cursor-pointer hover:bg-gray-100 hover:text-gray-700"
                          style={{ color: editDate ? '#1f2937' : '#9ca3af' }}
                        >
                          {editDate || 'Select date'}
                        </button>
                        {editCalendarGradeId === grade.id && createPortal(
                          <ScoreCalendarDropdown
                            selectedDate={editDate}
                            onSelectDate={setEditDate}
                            onClear={() => setEditDate('')}
                            onClose={() => setEditCalendarGradeId(null)}
                            loggedDates={new Set(grades.map((entry) => entry.date_logged))}
                            className="fixed"
                            style={{ position: 'fixed', top: editCalendarPosition.top, left: editCalendarPosition.left, marginTop: 0, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
                          />,
                          document.body
                        )}
                      </div>
                    ) : formatDateStr(grade.date_logged)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs">{formatTimeStr(grade.created_at)}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {isEditing ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button type="button" onClick={saveEditingGrade} disabled={isEditingGrade} className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" aria-label="Save score changes" title="Save score changes">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={cancelEditingGrade} disabled={isEditingGrade} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50" aria-label="Cancel score changes" title="Cancel score changes">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => startEditingGrade(grade)} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 cursor-pointer" aria-label={`Edit score for ${grade.student_name}`} title="Edit score">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
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
          const isEditing = editingGradeId === grade.id;
          const isLastSaved = grade.batch_id === lastSavedBatchId;
          const isNotTaken = grade.remarks?.trim().toLowerCase() === 'not taken';
          const scoreNum = Number(grade.score);
          const totalNum = Number(grade.total_score);
          const validTotal = !isNaN(totalNum) && totalNum > 0 ? totalNum : 100;
          const validScore = !isNaN(scoreNum) ? scoreNum : 0;
          const scorePercentage = (validScore / validTotal) * 100;
          const descriptionVal = getScoreDescription(grade);

          return (
            <div
              key={`mobile-row-${grade.id}`}
              ref={isLastSaved ? (lastRowRef as any) : undefined}
              className={`rounded-xl border p-4 space-y-3 transition-colors ${
                isLastSaved
                  ? 'border-[var(--brand)] bg-[var(--brand-light)] dark:bg-slate-800'
                  : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              {/* Header: Student Name + Action */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-gray-900 dark:text-slate-100 truncate">
                    {grade.student_name || 'Unknown student'}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                    {formatDateStr(grade.date_logged)}
                  </p>
                </div>

                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => startEditingGrade(grade)}
                    className="h-8 px-2.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                    aria-label={`Edit score for ${grade.student_name}`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {/* Badges: Description & Status */}
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

              {/* Content area: Editing vs Viewing */}
              {isEditing ? (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Score</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editScore}
                        onKeyDown={blockSymbolKeys}
                        onChange={(event) => setEditScore(sanitizeScoreInput(event.target.value, Number(grade.total_score)))}
                        className="w-full h-9 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-sm font-bold text-gray-900 outline-none focus:border-[var(--brand)]"
                        placeholder={`0–${grade.total_score}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Status</label>
                      <select
                        value={editStatus}
                        onChange={(event) => setEditStatus(event.target.value as 'Taken' | 'Not')}
                        className="w-full h-9 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 outline-none focus:border-[var(--brand)]"
                      >
                        <option value="Taken">Taken</option>
                        <option value="Not">Not Taken</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Date</label>
                    <button
                      type="button"
                      onClick={(event) => toggleEditCalendar(event, grade.id)}
                      className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold outline-none transition-all cursor-pointer hover:bg-gray-100 text-left flex items-center justify-between"
                      style={{ color: editDate ? '#1f2937' : '#9ca3af' }}
                    >
                      <span>{editDate || 'Select date'}</span>
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {editCalendarGradeId === grade.id && createPortal(
                      <ScoreCalendarDropdown
                        selectedDate={editDate}
                        onSelectDate={setEditDate}
                        onClear={() => setEditDate('')}
                        onClose={() => setEditCalendarGradeId(null)}
                        loggedDates={new Set(grades.map((entry) => entry.date_logged))}
                        className="fixed"
                        style={{ position: 'fixed', top: editCalendarPosition.top, left: Math.min(editCalendarPosition.left, window.innerWidth - 300), marginTop: 0, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
                      />,
                      document.body
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={cancelEditingGrade}
                      disabled={isEditingGrade}
                      className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveEditingGrade}
                      disabled={isEditingGrade}
                      className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Check className="h-4 w-4" />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
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
                    <p className={`text-xl font-black ${scoreColor(scorePercentage)}`}>
                      {isNotTaken ? '0%' : `${smartPct(scorePercentage)}%`}
                    </p>
                  </div>
                </div>
              )}

              {/* Timestamp footer */}
              <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500 pt-0.5">
                <span className="truncate">{formatDateStr(grade.date_logged)}</span>
                <span>{formatTimeStr(grade.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

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

const getWeekTitle = (mondayStr: string) => {
  const d = new Date(`${mondayStr}T00:00:00`);
  const weekNum = computeWeekOfMonth(d);
  return `WEEK ${weekNum}`;
};

type ScoreTableGroup = {
  key: string;
  title: string;
  weekMonday?: string;
  isMonthGroup?: boolean;
  rows: Grade[];
};

type ScoreHistoryGroupSectionProps = Omit<ScoreEntryTableProps, 'rows'> & {
  tableGroup: ScoreTableGroup;
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
};

const ScoreHistoryGroupSection: React.FC<ScoreHistoryGroupSectionProps> = ({
  tableGroup,
  selectedDate,
  onSelectDate,
  ...tableProps
}) => {
  const datesWithRecords = useMemo(() => {
    return new Set(tableGroup.rows.map((r) => r.date_logged.slice(0, 10)));
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
    return tableGroup.rows.filter((r) => r.date_logged.slice(0, 10) === selectedDate);
  }, [tableGroup.rows, selectedDate, isOpen]);

  const milestoneTypes = useMemo(() => {
    const types = new Set<string>();
    displayRows.forEach((grade) => {
      const desc = getScoreDescription(grade);
      if (desc !== 'Intervention Activity') {
        types.add(desc);
      }
    });
    return Array.from(types);
  }, [displayRows]);

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
              const dateGrades = tableGroup.rows.filter((r) => r.date_logged.slice(0, 10) === dateStr);
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
                  title={hasRecord ? (isSelected ? `Active: ${label}` : `View ${label}${hasMilestone ? ' (Milestone Assessment)' : ''}`) : `No records on ${label}`}
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
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400">
              {displayRows.length} Record{displayRows.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
      {isOpen && (
        <div className="space-y-2.5">
          {milestoneTypes.map((milestone) => (
            <div
              key={milestone}
              className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-md border border-orange-200 dark:border-orange-900/60 bg-gradient-to-r from-orange-50/90 to-amber-50/50 dark:from-orange-950/40 dark:to-amber-950/20 text-orange-900 dark:text-orange-200"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-xs">
                  <Award className="h-3 w-3" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-900 dark:text-orange-100">
                  {milestone === 'ARAL Summer Assessment' ? 'ARAL Summer Assessment' : `${milestone} Assessment Score Sheet`}
                </span>
                <span className="rounded bg-orange-100 dark:bg-orange-900/60 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                  Official Assessment
                </span>
              </div>
            </div>
          ))}
          <ScoreEntryTable
            rows={displayRows}
            {...tableProps}
          />
        </div>
      )}
    </div>
  );
};

/* ─── Component ────────────────────────────────────────────────── */
export const TutorScores: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>(() => getCachedStudents(user?.id));
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(() => getCachedStudents(user?.id).length === 0);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarColor = useMemo(() => buildAvatarColorMap(students), [students]);

  // Form State - initialized synchronously from draft/cache so the container never flashes/reloads
  const [draftsByKind, setDraftsByKind] = useState<Partial<Record<ScoreEntryKind, SingleDraftState>>>(() => {
    const draft = getStoredDraft(user?.id);
    return draft?.draftsByKind || {};
  });
  const [showAddEntry, setShowAddEntry] = useState<boolean>(() => {
    const draft = getStoredDraft(user?.id);
    return draft?.showAddEntry ?? true;
  });
  const [entryKind, setEntryKind] = useState<ScoreEntryKind>(() => {
    const draft = getStoredDraft(user?.id);
    return draft?.entryKind ?? 'daily';
  });
  const autoOpenedEntryRef = useRef(false);
  const [entryScores, setEntryScores] = useState<Record<string, number | ''>>(() => {
    const draft = getStoredDraft(user?.id);
    const activeKind = draft?.entryKind ?? 'daily';
    return draft?.draftsByKind?.[activeKind]?.entryScores ?? {};
  });
  const [entryStatus, setEntryStatus] = useState<Record<string, 'Taken' | 'Not'>>(() => {
    const draft = getStoredDraft(user?.id);
    const activeKind = draft?.entryKind ?? 'daily';
    return draft?.draftsByKind?.[activeKind]?.entryStatus ?? {};
  });
  const [totalScore, setTotalScore] = useState<number | ''>(() => {
    const draft = getStoredDraft(user?.id);
    const activeKind = draft?.entryKind ?? 'daily';
    const draftTotal = draft?.draftsByKind?.[activeKind]?.totalScore;
    if (draftTotal !== undefined && draftTotal !== '') {
      return draftTotal;
    }
    return activeKind === 'daily' ? 20 : 40;
  });
  const [logDate, setLogDate] = useState<string>(() => {
    const draft = getStoredDraft(user?.id);
    const activeKind = draft?.entryKind ?? 'daily';
    return draft?.draftsByKind?.[activeKind]?.logDate || new Date().toLocaleDateString('en-CA');
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showMilestoneConfirmation, setShowMilestoneConfirmation] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Attendance-pattern: track last saved batch for inline DTR row highlight
  const [lastSavedBatchId, setLastSavedBatchId] = useState<string | null>(null);
  const lastRowRef = useRef<HTMLTableRowElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  // Export modal
  const [exportModalConfig, setExportModalConfig] = useState<{ isOpen: boolean; mode: 'all' | 'daily' | 'weekly' | 'monthly'; targetKey: string }>({
    isOpen: false, mode: 'weekly', targetKey: ''
  });

  type ViewMode = 'week' | 'month';
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);
  const [showEntryCalendarPopover, setShowEntryCalendarPopover] = useState(false);
  const [studentSortDirection, setStudentSortDirection] = useState<'asc' | 'desc'>('asc');
  const [studentSortActive, setStudentSortActive] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [scoreStudentSearch, setScoreStudentSearch] = useState('');
  const [editingGradeId, setEditingGradeId] = useState<number | null>(null);
  const [editScore, setEditScore] = useState<number | ''>('');
  const [editStatus, setEditStatus] = useState<'Taken' | 'Not'>('Taken');
  const [editDate, setEditDate] = useState('');
  const [editCalendarGradeId, setEditCalendarGradeId] = useState<number | null>(null);
  const [editCalendarPosition, setEditCalendarPosition] = useState({ top: 0, left: 0 });
  const editCalendarAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [isEditingGrade, setIsEditingGrade] = useState(false);

  const fetchGrades = async () => {
    setGradesLoading(true);
    try {
      const gradeData = await academicService.getGrades();
      setGrades(Array.isArray(gradeData) ? gradeData : (gradeData as any)?.results ?? []);
    } catch (err) {
      console.error(err);
      setError('Failed to load score records.');
    } finally {
      setGradesLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      if (!user) return;
      const data = await userService.getAllUsers({ role: 'student', assigned_tutor: user.id });
      setStudents(data);
      if (user?.id) {
        try {
          localStorage.setItem(`${STUDENTS_CACHE_KEY_PREFIX}${user.id}`, JSON.stringify(data));
        } catch (e) {
          // ignore localStorage quota error
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load assigned students.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddEntry = (kind: ScoreEntryKind = 'daily') => {
    // 1. Snapshot current form inputs into draftsByKind under the previous entryKind
    const updatedDrafts = {
      ...draftsByKind,
      [entryKind]: {
        entryScores,
        entryStatus,
        totalScore,
        logDate,
      },
    };

    setDraftsByKind(updatedDrafts);
    setEntryKind(kind);
    setShowAddEntry(true);

    // 2. Load the target kind's isolated draft (if any), or start with clean defaults
    const targetDraft = updatedDrafts[kind];
    const targetTotal = targetDraft?.totalScore !== undefined && targetDraft?.totalScore !== ''
      ? targetDraft.totalScore
      : (kind === 'daily' ? 20 : 40);
    const targetLogDate = targetDraft?.logDate || new Date().toLocaleDateString('en-CA');

    const nextScores: Record<string, number | ''> = { ...(targetDraft?.entryScores || {}) };
    const nextStatus: Record<string, 'Taken' | 'Not'> = { ...(targetDraft?.entryStatus || {}) };

    (students || []).forEach((student) => {
      if (nextScores[student.id] === undefined) {
        if (kind !== 'daily') {
          const existingGrade = periodGrades.find((g) => String(g.student) === String(student.id));
          if (existingGrade) {
            nextScores[student.id] = existingGrade.remarks === 'Not Taken' ? 0 : existingGrade.score;
            nextStatus[student.id] = existingGrade.remarks === 'Not Taken' ? 'Not' : 'Taken';
          } else {
            nextScores[student.id] = '';
            nextStatus[student.id] = 'Taken';
          }
        } else {
          nextScores[student.id] = '';
          nextStatus[student.id] = 'Taken';
        }
      }
      if (nextStatus[student.id] === undefined) {
        nextStatus[student.id] = 'Taken';
      }
    });

    setEntryScores(nextScores);
    setEntryStatus(nextStatus);
    setTotalScore(targetTotal);
    setLogDate(targetLogDate);
    setSaveSuccessMsg(null);
  };

  const handleMilestoneEntryClick = () => {
    if (!isWindowOpen) {
      alert(`The ${assignedPeriod} assessment window is currently closed by administration.`);
      return;
    }
    setShowMilestoneConfirmation(true);
  };

  const confirmMilestoneEntry = () => {
    setShowMilestoneConfirmation(false);
    handleOpenAddEntry(levelEntry.kind);
  };

  const confirmSaveScores = () => {
    setShowSaveConfirmation(false);
    handleAddScore();
  };

  const handleAddScore = async () => {
    const activeTotal = totalScore === '' ? 0 : Number(totalScore);
    if (activeTotal <= 0) return alert('Please specify a valid total score greater than 0.');
    if (Object.values(entryScores).every((score) => score === '' || score === undefined || score === null)) {
      return alert('Please enter a score for at least one student.');
    }

    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const batchId = generateUuid();
      const todayDateStr = logDate || new Date().toLocaleDateString('en-CA');
      const entriesToCreate: Partial<Grade>[] = [];
      const entriesToUpdate: { id: number; data: Partial<Grade> }[] = [];

      (students || []).forEach((student) => {
        const rawScore = entryScores[student.id];
        const hasScore = (rawScore !== '' && rawScore !== undefined && rawScore !== null) || entryStatus[student.id] === 'Not';
        if (!hasScore) return;

        const isNotTaken = entryStatus[student.id] === 'Not';
        const numScore = isNotTaken ? 0 : Number(entryScores[student.id] || 0);
        const remarks = isNotTaken ? 'Not Taken' : (numScore / activeTotal >= 0.7 ? 'Passed' : 'Failed');
        const subject = entryKind === 'daily' ? `${user?.subject || 'Reading'} Intervention Activity` : levelEntry.subject;

        if (entryKind !== 'daily') {
          const existingGrade = periodGrades.find((g) => String(g.student) === String(student.id));
          if (existingGrade) {
            entriesToUpdate.push({
              id: existingGrade.id,
              data: {
                score: numScore,
                total_score: activeTotal,
                remarks: remarks,
                date_logged: todayDateStr,
                subject: subject,
              },
            });
            return;
          }
        }

        entriesToCreate.push({
          student: student.id,
          component_type: 'assessment' as Grade['component_type'],
          subject: subject,
          quarter: Math.ceil((new Date().getMonth() + 1) / 3),
          score: numScore,
          total_score: activeTotal,
          remarks: remarks,
          date_logged: todayDateStr,
          batch_id: batchId,
        });
      });

      if (entriesToCreate.length === 0 && entriesToUpdate.length === 0) {
        setIsSaving(false);
        return alert('No scores entered.');
      }

      await Promise.all([
        ...entriesToCreate.map((entry) => academicService.createGrade(entry)),
        ...entriesToUpdate.map(({ id, data }) => academicService.updateGrade(id, data)),
      ]);

      // Cleanly reset current entry kind draft and form state
      const resetScores: Record<string, number | ''> = {};
      const resetStatus: Record<string, 'Taken' | 'Not'> = {};
      (students || []).forEach((student) => {
        resetScores[student.id] = '';
        resetStatus[student.id] = 'Taken';
      });
      setEntryScores(resetScores);
      setEntryStatus(resetStatus);
      setTotalScore(entryKind === 'daily' ? 20 : 40);

      // Remove the submitted entry kind from draftsByKind
      const updatedDrafts = { ...draftsByKind };
      delete updatedDrafts[entryKind];
      setDraftsByKind(updatedDrafts);

      // Save updated draftsByKind to sessionStorage (only for current session)
      if (user?.id) {
        try {
          const draftKey = `${DRAFT_STORAGE_KEY_PREFIX}${user.id}`;
          const draft: ScoreDraftData = {
            draftsByKind: updatedDrafts,
            entryKind,
            showAddEntry,
            updatedAt: Date.now(),
          };
          sessionStorage.setItem(draftKey, JSON.stringify(draft));
        } catch (e) {
          // ignore sessionStorage error
        }
      }

      await fetchGrades();

      // ── Attendance-pattern: store batch ID → highlights the DTR row ──
      setLastSavedBatchId(batchId);
      const titleName = entryKind === 'daily' ? 'Intervention Activity' : (Object.values(semesterScoreEntry).find((e) => e.kind === entryKind)?.title || assignedPeriod);
      setSaveSuccessMsg(`${titleName} scores saved and highlighted below.`);
      setShowSuccessModal(true);
      setTimeout(() => {
        if (lastRowRef.current) {
          lastRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (tableContainerRef.current) {
          tableContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    } catch (err: any) {
      console.error('Error saving scores:', err);
      const data = err?.response?.data;
      const detailMsg = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : err?.message || 'Failed to log scores.';
      alert(`Failed to log scores: ${detailMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingGrade = (grade: Grade) => {
    setEditingGradeId(grade.id);
    setEditScore(grade.score);
    setEditStatus(grade.remarks === 'Not Taken' ? 'Not' : 'Taken');
    setEditDate(grade.date_logged || '');
  };

  const cancelEditingGrade = () => setEditingGradeId(null);

  const handleDismissSuccessModal = () => {
    setShowSuccessModal(false);
  };

  useEffect(() => {
    if (!showSuccessModal) return;
    const timer = setTimeout(() => {
      setShowSuccessModal(false);
    }, 4500);
    return () => clearTimeout(timer);
  }, [showSuccessModal]);

  const toggleEditCalendar = (event: React.MouseEvent<HTMLButtonElement>, gradeId: number) => {
    if (editCalendarGradeId === gradeId) {
      setEditCalendarGradeId(null);
      return;
    }
    editCalendarAnchorRef.current = event.currentTarget;
    const bounds = event.currentTarget.getBoundingClientRect();
    setEditCalendarPosition({
      top: bounds.bottom + 8,
      left: Math.max(8, bounds.right - 288),
    });
    setEditCalendarGradeId(gradeId);
  };

  useEffect(() => {
    if (editCalendarGradeId === null) return;
    const updateEditCalendarPosition = () => {
      const anchor = editCalendarAnchorRef.current;
      if (!anchor) return;
      const bounds = anchor.getBoundingClientRect();
      setEditCalendarPosition({ top: bounds.bottom + 8, left: Math.max(8, bounds.right - 288) });
    };
    window.addEventListener('scroll', updateEditCalendarPosition, true);
    window.addEventListener('resize', updateEditCalendarPosition);
    return () => {
      window.removeEventListener('scroll', updateEditCalendarPosition, true);
      window.removeEventListener('resize', updateEditCalendarPosition);
    };
  }, [editCalendarGradeId]);

  const saveEditingGrade = async () => {
    if (editingGradeId === null || editScore === '' || !editDate) return;
    setIsEditingGrade(true);
    try {
      await academicService.updateGrade(editingGradeId, {
        score: editStatus === 'Not' ? 0 : Number(editScore),
        remarks: editStatus === 'Not' ? 'Not Taken' : Number(editScore) / (Number(grades.find((grade) => grade.id === editingGradeId)?.total_score) || 100) >= 0.7 ? 'Passed' : 'Failed',
        date_logged: editDate,
      });
      await fetchGrades();
      setEditingGradeId(null);
    } catch (err) {
      console.error(err);
      alert('Failed to update score record.');
    } finally {
      setIsEditingGrade(false);
    }
  };

  // Auto-scroll to the highlighted row after grades reload (mirrors attendance scanner auto-update)
  useEffect(() => {
    if (lastSavedBatchId && lastRowRef.current) {
      lastRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [lastSavedBatchId, grades]);

  // Ensure default entries exist for all loaded students while strictly preserving existing inputted scores
  useEffect(() => {
    if (students.length === 0) return;
    setEntryScores((prev) => {
      let changed = false;
      const next = { ...prev };
      students.forEach((s) => {
        if (next[s.id] === undefined) {
          next[s.id] = '';
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setEntryStatus((prev) => {
      let changed = false;
      const next = { ...prev };
      students.forEach((s) => {
        if (next[s.id] === undefined) {
          next[s.id] = 'Taken';
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [students]);

  // Re-sync draft when user changes
  useEffect(() => {
    if (!user?.id) return;
    const cachedStudents = getCachedStudents(user.id);
    if (cachedStudents.length > 0) {
      setStudents(cachedStudents);
    }
    const draft = getStoredDraft(user.id);
    if (draft) {
      const activeKind = draft.entryKind ?? 'daily';
      const kindDraft = draft.draftsByKind?.[activeKind];
      setDraftsByKind(draft.draftsByKind || {});
      setShowAddEntry(draft.showAddEntry ?? true);
      setEntryKind(activeKind);
      setEntryScores(kindDraft?.entryScores ?? {});
      setEntryStatus(kindDraft?.entryStatus ?? {});
      setTotalScore(kindDraft?.totalScore !== undefined && kindDraft?.totalScore !== '' ? kindDraft.totalScore : (activeKind === 'daily' ? 20 : 40));
      setLogDate(kindDraft?.logDate || new Date().toLocaleDateString('en-CA'));
    }
  }, [user?.id]);

  // Persist draft in sessionStorage whenever score entry state changes (survives refreshes/tab switching during active session only)
  useEffect(() => {
    if (!user?.id) return;
    const draftKey = `${DRAFT_STORAGE_KEY_PREFIX}${user.id}`;
    const currentKindDraft: SingleDraftState = {
      entryScores,
      entryStatus,
      totalScore,
      logDate,
    };
    const updatedDraftsByKind: Partial<Record<ScoreEntryKind, SingleDraftState>> = {
      ...draftsByKind,
      [entryKind]: currentKindDraft,
    };
    const draft: ScoreDraftData = {
      draftsByKind: updatedDraftsByKind,
      entryKind,
      showAddEntry,
      updatedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch (e) {
      // ignore sessionStorage quota errors
    }
  }, [user?.id, entryScores, entryStatus, totalScore, entryKind, logDate, showAddEntry, draftsByKind]);

  const [activeSystemSem, setActiveSystemSem] = useState<SemesterType>(() => getActiveSystemSemester());
  const [isWindowOpen, setIsWindowOpen] = useState<boolean>(() => isAssessmentWindowOpen(getActiveSystemSemester()));

  useEffect(() => {
    academicService.getCurrentSchoolYear().then((sy) => {
      if (sy && sy.current_semester) {
        const sem = sy.current_semester as any;
        setActiveSystemSemester(sem);
        setActiveSystemSem(sem);
        setIsWindowOpen(isAssessmentWindowOpen(sem));
      }
    }).catch(() => {});

    const handleSemChange = (e: any) => {
      const newSem = e?.detail?.semester || getActiveSystemSemester();
      setActiveSystemSem(newSem);
      setIsWindowOpen(isAssessmentWindowOpen(newSem));
    };

    const handleWindowChange = (e: any) => {
      if (typeof e?.detail?.isOpen === 'boolean') {
        setIsWindowOpen(e.detail.isOpen);
      } else {
        setIsWindowOpen(isAssessmentWindowOpen(activeSystemSem));
      }
    };

    window.addEventListener('system_semester_changed', handleSemChange);
    window.addEventListener('assessment_window_changed', handleWindowChange);
    return () => {
      window.removeEventListener('system_semester_changed', handleSemChange);
      window.removeEventListener('assessment_window_changed', handleWindowChange);
    };
  }, [activeSystemSem]);

  useEffect(() => { fetchStudents(); }, [user]);
  useEffect(() => { fetchGrades(); }, [user]);

  const safeGrades = useMemo(() => (Array.isArray(grades) ? grades : []), [grades]);
  const assignedPeriod = useMemo<ScorePeriod>(() => {
    return getActiveSystemMilestone();
  }, [activeSystemSem]);
  const tutorSubject = user?.subject || 'Reading';
  const levelEntry = useMemo(() => {
    const base = semesterScoreEntry[assignedPeriod] || semesterScoreEntry.MOSY;
    if (assignedPeriod === 'ARAL Summer Assessment') {
      return {
        ...base,
        title: 'ARAL Summer Assessment',
        subject: 'ARAL Summer Assessment',
      };
    }
    const semesterQuarter = assignedPeriod === 'MOSY' ? '(Q1/Q2)' : '(Q3/Q4)';
    return {
      ...base,
      title: `${assignedPeriod} ${tutorSubject} Score ${semesterQuarter}`,
      subject: `${assignedPeriod} ${tutorSubject}`,
    };
  }, [assignedPeriod, tutorSubject]);
  const dailyGrades = useMemo(() => safeGrades.filter((grade) => grade.component_type === 'assessment'), [safeGrades]);
  const studentsWithEntries = useMemo(() => new Set(dailyGrades.map((g) => g.student)).size, [dailyGrades]);
  const avgScoreAll = useMemo(() => {
    if (dailyGrades.length === 0) return 0;
    const sum = dailyGrades.reduce((acc, g) => acc + (Number(g.score) / (Number(g.total_score) || 100)) * 100, 0);
    return Math.round((sum / dailyGrades.length) * 10) / 10;
  }, [dailyGrades]);

  // Live evaluation progress tracking for milestone periods (MOSY / EOSY / Summer)
  const periodGrades = useMemo(() => safeGrades.filter((grade) => {
    if (grade.component_type !== 'assessment') return false;
    const subj = (grade.subject || '').toLowerCase();
    if (assignedPeriod === 'MOSY') {
      return subj.includes('mosy');
    }
    if (assignedPeriod === 'EOSY') {
      return subj.includes('eosy');
    }
    if (assignedPeriod === 'ARAL Summer Assessment') {
      return subj.includes('summer') || subj.includes('endline');
    }
    return false;
  }), [safeGrades, assignedPeriod]);

  const evaluatedStudentIds = useMemo(() => new Set(periodGrades.map((g) => String(g.student))), [periodGrades]);
  const evaluatedStudentsCount = useMemo(() => {
    return students.filter((s) => evaluatedStudentIds.has(String(s.id))).length;
  }, [students, evaluatedStudentIds]);

  const evaluationStatus = useMemo(() => {
    if (students.length === 0) return 'No Students';
    if (evaluatedStudentsCount >= students.length) return 'Completed';
    if (evaluatedStudentsCount > 0) return 'In Progress';
    return 'Pending';
  }, [students.length, evaluatedStudentsCount]);

  const isPending = evaluationStatus === 'Pending' || evaluationStatus === 'In Progress';

  // ── DTR-mirror: batchRows (mirrors dtrRows in StaffAttendanceScanner) ──
  // Each unique batch_id → one row in the table, newest-first
  const batchRows = useMemo(() => {
    const map = new Map<string, {
      batchId: string;
      dateStr: string;
      timeStr: string | null;
      subject: string;
      totalItems: number;
      takenCount: number;
      notTakenCount: number;
      avgPct: number;
      grades: Grade[];
    }>();

    dailyGrades.forEach((grade) => {
      const key = grade.batch_id || `solo-${grade.id}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          batchId: key,
          dateStr: grade.date_logged || '',
          timeStr: grade.created_at || null,
          subject: grade.subject || 'Reading',
          totalItems: Number(grade.total_score) || 0,
          takenCount: grade.remarks !== 'Not Taken' ? 1 : 0,
          notTakenCount: grade.remarks === 'Not Taken' ? 1 : 0,
          avgPct: 0, // computed below
          grades: [grade],
        });
      } else {
        existing.grades.push(grade);
        if (grade.remarks !== 'Not Taken') existing.takenCount++;
        else existing.notTakenCount++;
      }
    });

    // Compute per-batch average %
    map.forEach((row) => {
      const taken = row.grades.filter((g) => g.remarks !== 'Not Taken');
      row.avgPct = taken.length > 0
        ? Math.round(
          (taken.reduce((acc, g) => acc + (Number(g.score) / (Number(g.total_score) || 100)) * 100, 0) / taken.length) * 10
        ) / 10
        : 0;
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime()
    );
  }, [dailyGrades]);

  const searchedBatchRows = useMemo(() => {
    return batchRows.filter((batch) =>
      batch.grades.some((grade) => matchesSearch(scoreStudentSearch, grade.student_name, grade.subject))
    );
  }, [batchRows, scoreStudentSearch]);

  const visibleBatchRows = useMemo(() => {
    if (jumpDate) {
      return searchedBatchRows.filter((batch) => batch.dateStr === jumpDate);
    }
    return searchedBatchRows;
  }, [searchedBatchRows, jumpDate]);

  const visibleScoreRows = useMemo(() => visibleBatchRows.flatMap((batch) => batch.grades), [visibleBatchRows]);

  const getWeekKey = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return date.toLocaleDateString('en-CA');
  };

  const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);

  const getMonthTitle = (monthKey: string) => {
    const d = new Date(`${monthKey}-01T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  const mostRecentDateWithEntry = useMemo(() => {
    if (visibleScoreRows.length === 0) return null;
    return visibleScoreRows[0].date_logged.slice(0, 10);
  }, [visibleScoreRows]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (jumpDate) {
      setSelectedDate(jumpDate);
    } else if (mostRecentDateWithEntry) {
      setSelectedDate(mostRecentDateWithEntry);
    } else {
      setSelectedDate(null);
    }
  }, [jumpDate, mostRecentDateWithEntry, viewMode, scoreStudentSearch]);

  const scoreTableGroups = useMemo((): ScoreTableGroup[] => {
    if (jumpDate) {
      return [{
        key: jumpDate,
        title: viewMode === 'week' ? getWeekTitle(getWeekKey(jumpDate)) : getMonthTitle(getMonthKey(jumpDate)),
        weekMonday: getWeekKey(jumpDate),
        isMonthGroup: viewMode === 'month',
        rows: visibleScoreRows,
      }];
    }

    const groups = new Map<string, Grade[]>();
    visibleScoreRows.forEach((grade) => {
      const key = viewMode === 'week' ? getWeekKey(grade.date_logged) : getMonthKey(grade.date_logged);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(grade);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, rows]) => ({
        key,
        title: viewMode === 'week' ? getWeekTitle(key) : getMonthTitle(key),
        weekMonday: viewMode === 'week' ? key : undefined,
        isMonthGroup: viewMode === 'month',
        rows,
      }));
  }, [jumpDate, viewMode, visibleScoreRows]);
  const loggedScoreDates = useMemo(() => new Set(batchRows.map((batch) => batch.dateStr)), [batchRows]);
  const sortedStudents = useMemo(
    () => [...students]
      .filter((student) => matchesSearch(studentSearch, student.full_name, student.first_name, student.last_name, student.lrn))
      .sort((firstStudent, secondStudent) => {
        const comparison = compareNamesByLastName(firstStudent, secondStudent);
        return studentSortDirection === 'asc' ? comparison : -comparison;
      }),
    [students, studentSearch, studentSortDirection]
  );

  // Mobile score entry must ALWAYS be in alphabetical order (A to Z by last name)
  const mobileAlphabeticalStudents = useMemo(
    () => [...students]
      .filter((student) => matchesSearch(studentSearch, student.full_name, student.first_name, student.last_name, student.lrn))
      .sort((firstStudent, secondStudent) => {
        return compareNamesByLastName(firstStudent, secondStudent);
      }),
    [students, studentSearch]
  );



  if (error) return (
    <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-2xl p-5 shadow-sm max-w-6xl mx-auto">
      <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold">Failed to load scores</p>
        <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
        >
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col space-y-4 max-w-6xl mx-auto data-loaded-content">

      {/* ── Score Entry Form ───────────────────────────────────────── */}
      {showAddEntry && (
        <div className="order-1 flex flex-col rounded-md border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-full min-w-0 max-w-full sm:h-[600px] sm:min-h-[500px] sm:overflow-hidden">
          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm uppercase">
                {entryKind === 'daily' ? 'Add Intervention Activity Scores' : levelEntry.title}
              </h3>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleOpenAddEntry('daily')}
                className={`inline-flex min-h-[44px] sm:min-h-0 sm:h-8 w-full sm:w-auto shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-xs font-bold transition ${entryKind === 'daily' ? 'border-[var(--brand)] bg-[var(--brand)] text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--brand-border)] hover:text-[var(--brand)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
              >
                <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                Add Intervention Score
              </button>
              <button
                type="button"
                onClick={handleMilestoneEntryClick}
                disabled={!isWindowOpen}
                title={!isWindowOpen ? `The ${assignedPeriod} assessment window is closed by administration.` : undefined}
                className={`inline-flex min-h-[44px] sm:min-h-0 sm:h-8 w-full sm:w-auto shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-xs font-bold transition ${
                  !isWindowOpen
                    ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-60 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-500'
                    : entryKind !== 'daily'
                    ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand-dark)] cursor-pointer'
                    : 'border-orange-500 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-orange-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/60 cursor-pointer'
                }`}
              >
                {!isWindowOpen ? (
                  <Lock className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                ) : (
                  <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                )}
                {assignedPeriod === 'ARAL Summer Assessment' ? 'Add ARAL Summer Assessment' : `Add ${assignedPeriod} Score`}
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 sm:p-5 flex flex-col gap-4 sm:min-h-0 sm:overflow-hidden">
            <div className="shrink-0 flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1.8fr)_auto] sm:items-end relative z-30">
              <div className="min-w-0 w-full">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,260px)_160px]">
                  <div className="w-full relative z-30">
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                      DATE
                    </label>
                    <div className="relative w-full z-30">
                      <button
                        type="button"
                        onClick={() => setShowEntryCalendarPopover((previous) => !previous)}
                        className="flex w-full min-h-[44px] sm:min-h-0 sm:h-9 items-center justify-between rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 sm:py-1.5 text-left text-xs font-semibold text-gray-900 dark:text-slate-100 transition hover:bg-gray-50 dark:hover:bg-slate-700/50 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] cursor-pointer"
                        aria-label="Select score date"
                      >
                        <span>{logDate ? formatDateStr(logDate) : 'Select date'}</span>
                        <Calendar className="h-4 w-4 text-gray-400" />
                      </button>
                      {showEntryCalendarPopover && (
                        <ScoreCalendarDropdown
                          selectedDate={logDate || null}
                          onSelectDate={setLogDate}
                          onClear={() => setLogDate('')}
                          onClose={() => setShowEntryCalendarPopover(false)}
                          loggedDates={new Set<string>()}
                          align="center"
                        />
                      )}
                    </div>
                  </div>

                  <div className="w-full">
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">TOTAL ITEMS</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={totalScore}
                      onKeyDown={blockSymbolKeys}
                      onChange={(e) => setTotalScore(sanitizeScoreInput(e.target.value))}
                      className="w-full min-h-[44px] sm:min-h-0 sm:h-9 rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 sm:py-1.5 text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] [appearance:textfield]"
                    />
                  </div>
                </div>
              </div>

              <div className="w-full sm:w-auto flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => setShowSaveConfirmation(true)}
                  disabled={isSaving}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 sm:h-9 inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
                >
                  {isSaving ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                  ) : entryKind === 'daily' ? 'Save Intervention Activity Scores' : `Save ${assignedPeriod} Scores`}
                </button>
              </div>
            </div>

            {students.length === 0 ? (
              isLoading ? (
                <div className="flex flex-col rounded-md border border-gray-200 dark:border-slate-800 p-6 space-y-4 animate-pulse">
                  <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-100 dark:border-slate-800">
                      <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 shrink-0" />
                      <div className="h-4 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="h-8 w-24 rounded-md bg-gray-100 dark:bg-gray-800" />
                      <div className="h-8 w-24 rounded-md bg-gray-100 dark:bg-gray-800" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-6 text-xs text-gray-400">No assigned students found.</p>
              )
            ) : (
              <div className="flex flex-col rounded-md border border-gray-200 dark:border-slate-800 sm:min-h-0 sm:flex-1 sm:overflow-hidden">
                <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 sm:py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase text-gray-900 dark:text-slate-100">Student Score List</h3>
                    <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">Enter scores for assigned students</p>
                  </div>
                  <label className="relative flex w-full sm:w-auto sm:min-w-56 items-center">
                    <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-gray-400" />
                    <input
                      type="search"
                      placeholder="Search Student Name"
                      value={studentSearch}
                      onChange={(event) => setStudentSearch(event.target.value)}
                      className="min-h-[44px] sm:min-h-0 sm:h-8 w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 pl-10 pr-3 text-xs font-medium text-gray-700 dark:text-slate-200 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-[var(--brand)]"
                      aria-label="Search student name"
                    />
                  </label>
                </div>
                <div className="mobile-scroll-table sm:min-h-0 sm:flex-1 sm:overflow-auto">
                  {/* Desktop Table View (>= 640px) */}
                  <table className="hidden sm:table min-w-[680px] w-full divide-y divide-gray-100 dark:divide-slate-800 text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-900">
                      <tr className="divide-x divide-gray-100 dark:divide-slate-800">
                        <th aria-sort={studentSortActive ? (studentSortDirection === 'asc' ? 'ascending' : 'descending') : undefined} className="w-[38%] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() => {
                              setStudentSortActive(true);
                              setStudentSortDirection((direction) => direction === 'desc' ? 'asc' : 'desc');
                            }}
                            className="inline-flex items-center gap-1 text-left transition-colors hover:text-gray-700 dark:hover:text-slate-200"
                            aria-label={`Sort students ${studentSortDirection === 'desc' ? 'ascending' : 'descending'}`}
                          >
                            STUDENT
                            {studentSortActive
                              ? studentSortDirection === 'desc'
                                ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                : <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                              : <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />}
                          </button>
                        </th>
                        <th className="w-[24%] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">Score (OUT OF {totalScore || 'Total'})</th>
                        <th className="w-[19%] px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">Preview %</th>
                        <th className="w-[19%] px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {sortedStudents.map((student) => {
                        const status = entryStatus[student.id] || 'Taken';
                        const isNotTaken = status === 'Not';
                        const rawScore = entryScores[student.id];
                        const activeTotal = Number(totalScore) || 0;
                        const hasValidScore = rawScore !== '' && rawScore !== undefined && rawScore !== null && !isNaN(Number(rawScore));
                        const pct = isNotTaken
                          ? 0
                          : (hasValidScore && activeTotal > 0
                            ? Math.round((Number(rawScore) / activeTotal) * 100 * 10) / 10
                            : null);
                        const isPassingMilestone = entryKind !== 'daily' && pct !== null && !isNaN(pct) && pct >= 70;

                        return (
                          <tr key={student.id} className="divide-x divide-gray-100 dark:divide-slate-800 transition-colors hover:bg-gray-50/80 dark:hover:bg-slate-800/60">
                            <td className="px-4 py-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-gray-900 dark:text-slate-100">{student.full_name}</p>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={isNotTaken ? 0 : (entryScores[student.id] ?? '')}
                                onKeyDown={blockSymbolKeys}
                                onChange={(e) => {
                                  const sanitized = sanitizeScoreInput(e.target.value, activeTotal);
                                  setEntryScores((prev) => ({ ...prev, [student.id]: sanitized }));
                                }}
                                placeholder={`0–${activeTotal}`}
                                disabled={isNotTaken}
                                className="w-full max-w-[110px] rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:bg-gray-100 dark:disabled:bg-slate-800/50 disabled:opacity-60"
                              />
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {pct !== null && !isNaN(pct) ? (
                                <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                                  <span className={`text-xs font-extrabold ${scoreColor(pct)}`}>{pct}%</span>
                                  {entryKind !== 'daily' && (
                                    <span className={`text-[10px] font-bold ${isPassingMilestone ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                      {isPassingMilestone ? '✓ Pass' : '✕ Fail'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300 dark:text-slate-600">0%</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <select
                                value={status}
                                onChange={(e) => {
                                  const newStatus = e.target.value as 'Taken' | 'Not';
                                  setEntryStatus((prev) => ({ ...prev, [student.id]: newStatus }));
                                  if (newStatus === 'Not') setEntryScores((prev) => ({ ...prev, [student.id]: 0 }));
                                }}
                                className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-gray-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                              >
                                <option value="Taken">Taken</option>
                                <option value="Not">Not Taken</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Mobile Card Entry View (< 640px) - always strictly alphabetical order (A to Z) */}
                  <div className="sm:hidden p-3 space-y-3">
                    {mobileAlphabeticalStudents.length === 0 ? (
                      <p className="text-center py-6 text-xs text-gray-400">No students found matching "{studentSearch}".</p>
                    ) : (
                      mobileAlphabeticalStudents.map((student) => {
                      const status = entryStatus[student.id] || 'Taken';
                      const isNotTaken = status === 'Not';
                      const rawScore = entryScores[student.id];
                      const activeTotal = Number(totalScore) || 0;
                      const hasValidScore = rawScore !== '' && rawScore !== undefined && rawScore !== null && !isNaN(Number(rawScore));
                      const pct = isNotTaken
                        ? 0
                        : (hasValidScore && activeTotal > 0
                          ? Math.round((Number(rawScore) / activeTotal) * 100 * 10) / 10
                          : null);
                      const isPassingMilestone = entryKind !== 'daily' && pct !== null && !isNaN(pct) && pct >= 70;

                      return (
                        <div
                          key={`mobile-entry-${student.id}`}
                          className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-base text-gray-900 dark:text-slate-100 break-words">
                                {student.full_name}
                              </p>
                            </div>
                            <div className="shrink-0">
                              <select
                                value={status}
                                onChange={(e) => {
                                  const newStatus = e.target.value as 'Taken' | 'Not';
                                  setEntryStatus((prev) => ({ ...prev, [student.id]: newStatus }));
                                  if (newStatus === 'Not') setEntryScores((prev) => ({ ...prev, [student.id]: 0 }));
                                }}
                                className="min-h-[44px] rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 focus:border-[var(--brand)] focus:outline-none cursor-pointer"
                              >
                                <option value="Taken">Taken</option>
                                <option value="Not">Not Taken</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <label htmlFor={`score-input-${student.id}`} className="text-xs font-bold text-gray-600 dark:text-slate-400 shrink-0">
                                Score:
                              </label>
                              <input
                                id={`score-input-${student.id}`}
                                type="text"
                                inputMode="numeric"
                                value={isNotTaken ? 0 : (entryScores[student.id] ?? '')}
                                onKeyDown={blockSymbolKeys}
                                onChange={(e) => {
                                  const sanitized = sanitizeScoreInput(e.target.value, activeTotal);
                                  setEntryScores((prev) => ({ ...prev, [student.id]: sanitized }));
                                }}
                                placeholder={`0–${activeTotal}`}
                                disabled={isNotTaken}
                                className="w-24 min-h-[44px] rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-center text-sm font-bold text-gray-900 dark:text-slate-100 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:bg-gray-100 dark:disabled:bg-slate-800/50 disabled:opacity-60"
                              />
                              <span className="text-xs font-semibold text-gray-400 shrink-0">/ {activeTotal}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs font-medium text-gray-400">Preview:</span>
                              {pct !== null && !isNaN(pct) ? (
                                <div className="flex items-center gap-1">
                                  <span className={`text-sm font-black ${scoreColor(pct)}`}>{pct}%</span>
                                  {entryKind !== 'daily' && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPassingMilestone ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}`}>
                                      {isPassingMilestone ? 'Pass' : 'Fail'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 font-semibold">0%</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── DTR-style Score Records Table ─────────────────────────── */}
      <div ref={tableContainerRef} className="order-4 mt-2.5 sm:mt-4 rounded-md border border-gray-200 bg-white overflow-visible">

        {/* Table header */}
        <div className="flex flex-col gap-3 px-5 py-3.5 border-b border-gray-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase">STUDENTS SCORES HISTORY</h3>
              <p className="mt-0.5 text-xs font-normal text-gray-500">
                {visibleScoreRows.length} Record{visibleScoreRows.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex w-full sm:w-auto sm:min-w-52 items-center">
              <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-gray-400" />
              <input
                type="search"
                value={scoreStudentSearch}
                onChange={(event) => setScoreStudentSearch(event.target.value)}
                placeholder="Search Student Name"
                aria-label="Search score records by student"
                className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs font-medium text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white focus:ring-1 focus:ring-[var(--brand)]"
              />
            </label>
            <div className="flex h-8 shrink-0 items-center gap-0.5 rounded-md bg-gray-100 dark:bg-[#1A1A1A] p-0.5">
              {(['week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setViewMode(mode); setJumpDate(null); }}
                  className={`h-7 whitespace-nowrap rounded-sm px-3 text-[10px] font-bold uppercase transition-all cursor-pointer ${viewMode === mode && !jumpDate ? 'bg-[var(--brand)] text-white' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="relative inline-flex items-center z-30">
              <button
                type="button"
                onClick={() => setShowCalendarPopover((previous) => !previous)}
                className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border p-0 transition-all ${jumpDate ? 'border-[var(--brand)] bg-[var(--brand)] text-white' : 'border-[var(--brand-border)] bg-[var(--brand-light)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)]'}`}
                aria-label="Open score calendar"
                title="Select a specific date from calendar"
              >
                <Calendar className="w-4 h-4" />
              </button>
              {showCalendarPopover && (
                <ScoreCalendarDropdown
                  selectedDate={jumpDate}
                  onSelectDate={setJumpDate}
                  onClear={() => setJumpDate(null)}
                  onClose={() => setShowCalendarPopover(false)}
                  loggedDates={loggedScoreDates}
                  align="right"
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (jumpDate) {
                  setExportModalConfig({ isOpen: true, mode: 'daily', targetKey: jumpDate });
                } else if (viewMode === 'month') {
                  const monthStr = new Date().toLocaleDateString('en-CA').slice(0, 7);
                  setExportModalConfig({ isOpen: true, mode: 'monthly', targetKey: monthStr });
                } else {
                  setExportModalConfig({ isOpen: true, mode: 'weekly', targetKey: '' });
                }
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--brand)] px-3.5 py-2 sm:py-1.5 text-xs font-bold text-white transition-all hover:bg-[var(--brand-hover)] active:scale-[0.98] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              Export Score Sheet
            </button>
          </div>
        </div>

        {jumpDate && (
          <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-50 bg-emerald-50/60">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">
              {new Date(`${jumpDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => setJumpDate(null)} className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800">
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}

        <div className="p-4 sm:p-5">
          {gradesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-md animate-pulse" />
              ))}
            </div>
          ) : visibleScoreRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <BookOpen className="w-8 h-8 text-gray-200" />
              <p className="text-xs font-semibold text-gray-500">
                {scoreStudentSearch.trim()
                  ? 'No matching score records'
                  : jumpDate
                  ? 'No records for this date'
                  : 'No score records yet'}
              </p>
              <p className="text-[11px] text-gray-400">
                {scoreStudentSearch.trim()
                  ? 'Try a different student name or subject'
                  : jumpDate
                  ? 'Try a different date or clear the filter'
                  : 'Records will appear after logging scores'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto mobile-scroll-table -mx-2 px-2 space-y-6">
              {scoreTableGroups.map((tableGroup) => (
                <ScoreHistoryGroupSection
                  key={tableGroup.key}
                  tableGroup={tableGroup}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  lastSavedBatchId={lastSavedBatchId}
                  lastRowRef={lastRowRef}
                  editingGradeId={editingGradeId}
                  editScore={editScore}
                  editStatus={editStatus}
                  editDate={editDate}
                  editCalendarGradeId={editCalendarGradeId}
                  editCalendarPosition={editCalendarPosition}
                  grades={grades}
                  blockSymbolKeys={blockSymbolKeys}
                  sanitizeScoreInput={sanitizeScoreInput}
                  setEditScore={setEditScore}
                  setEditStatus={setEditStatus}
                  setEditDate={setEditDate}
                  setEditCalendarGradeId={setEditCalendarGradeId}
                  toggleEditCalendar={toggleEditCalendar}
                  startEditingGrade={startEditingGrade}
                  cancelEditingGrade={cancelEditingGrade}
                  saveEditingGrade={saveEditingGrade}
                  isEditingGrade={isEditingGrade}
                  formatDateStr={formatDateStr}
                  formatTimeStr={formatTimeStr}
                  avatarColor={avatarColor}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ExportScoreModal
        isOpen={exportModalConfig.isOpen}
        onClose={() => setExportModalConfig((prev) => ({ ...prev, isOpen: false }))}
        currentUser={user}
        students={students}
        grades={grades}
        initialMode={exportModalConfig.mode}
        initialTargetKey={exportModalConfig.targetKey}
      />

      {showMilestoneConfirmation && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
          style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowMilestoneConfirmation(false); }}
        >
          <div className="relative w-full max-w-sm rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-3 animate-fade-in-scale">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase">
                {assignedPeriod === 'ARAL Summer Assessment' ? 'Add ARAL Summer Assessment' : `Add ${assignedPeriod} Score`}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-slate-400">
                This is a one-time milestone evaluation for your assigned students. Please ensure all student scores and statuses are accurate before proceeding. You can still edit individual student results in the score records until the semester or school year is transitioned by administration.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMilestoneConfirmation(false)}
                className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMilestoneEntry}
                className="rounded-md bg-[var(--brand)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-dark)] cursor-pointer"
              >
                {assignedPeriod === 'ARAL Summer Assessment' ? 'Add Summer Assessment' : `Add ${assignedPeriod}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSaveConfirmation && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
          style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaveConfirmation(false); }}
        >
          <div className="relative w-full max-w-sm rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-3 animate-fade-in-scale">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase">
                {entryKind === 'daily' ? 'Save Intervention Scores' : `Submit ${assignedPeriod} Scores`}
              </h3>
              <p className="mt-1 text-xs font-normal text-gray-500 dark:text-slate-400 leading-relaxed">
                {entryKind === 'daily'
                  ? 'Are you sure you want to save these intervention activity scores?'
                  : `Are you sure you want to submit these ${assignedPeriod} evaluation scores? You can continue to edit individual scores in the records below until the semester or school year is transitioned.`}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveConfirmation(false)}
                className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSaveScores}
                className="rounded-md bg-[var(--brand)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-dark)] cursor-pointer"
              >
                {entryKind === 'daily' ? 'Save Intervention Activity Scores' : `Save ${assignedPeriod} Scores`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Saved Scores Floating Notification Toast ─────────────────────── */}
      {showSuccessModal && (
        <aside
          aria-live="polite"
          className="fixed top-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-white p-3.5 shadow-xl">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-gray-900">
                  Scores Saved Successfully
                </h3>
                <button
                  type="button"
                  onClick={handleDismissSuccessModal}
                  className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  aria-label="Close notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                {saveSuccessMsg || 'Intervention Activity scores saved and highlighted below.'}
              </p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default TutorScores;
