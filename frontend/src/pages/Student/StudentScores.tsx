import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Grade } from '../../types';
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
  Smile,
  Meh,
  Frown,
  AlertCircle,
} from 'lucide-react';

/* ─── Helpers ─────────────────────────────────────────────────── */

const smartPct = (n: number): string => {
  const fixed2 = n.toFixed(2);
  return parseFloat(fixed2).toString();
};

const formatDateString = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${weekday} | ${month} ${day}, ${year}`;
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

const getWeekKey = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return mon.toISOString().slice(0, 10);
};

const weekLabel = (mondayStr: string) => {
  const mon = new Date(mondayStr + 'T00:00:00');
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(mon)} – ${fmt(fri)}, ${fri.getFullYear()}`;
};

const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);

const monthLabel = (key: string) => {
  const d = new Date(key + '-01T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
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
              className={`relative py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                isSelected
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

/* ─── Main Component ──────────────────────────────────────────── */

type SortKey = 'score' | 'remarks' | 'status' | 'date' | 'time';
type ViewMode = 'day' | 'week' | 'month';

export const StudentScores: React.FC = () => {
  const { user } = useAuth();
  const studentFirstName = user?.first_name || user?.full_name?.trim().split(' ')[0] || 'Student';
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sort States (Copied from TutorStudentProfile Score tab)
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  });
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);

  // Fetch grades for logged-in student
  useEffect(() => {
    let cancelled = false;
    const loadGrades = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const data = await academicService.getGrades({ student_id: String(user.id) });
        if (!cancelled) {
          // Strict student isolation
          const myGrades = data.filter((g) => String(g.student) === String(user.id));
          setGrades(myGrades);
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
    loadGrades();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Distinct dates with grades
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

  // ── Top KPI Stat Calculations (Exact logic from TutorStudentProfile.tsx) ──
  const { passedCount, failedCount, calculatedAvgScore } = useMemo(() => {
    if (grades.length === 0) {
      return { passedCount: 0, failedCount: 0, calculatedAvgScore: 0 };
    }
    const takenGrades = grades.filter(
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
  }, [grades]);

  const hasScoreData = useMemo(() => {
    return grades.some((g) => g.remarks?.trim().toLowerCase() !== 'not taken');
  }, [grades]);

  const scoreMood = useMemo(() => {
    if (!hasScoreData) {
      return {
        icon: Smile,
        iconBg: 'bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700',
        iconColor: 'text-gray-400 dark:text-slate-500',
        valueColor: 'text-gray-400 dark:text-slate-500',
      };
    }
    if (calculatedAvgScore >= 81) {
      return {
        icon: Smile,
        iconBg: 'risk-badge-low',
        iconColor: 'text-risk-low',
        valueColor: 'text-risk-low',
      };
    }
    if (calculatedAvgScore >= 75) {
      return {
        icon: Meh,
        iconBg: 'risk-badge-medium',
        iconColor: 'text-risk-medium',
        valueColor: 'text-risk-medium',
      };
    }
    return {
      icon: Frown,
      iconBg: 'risk-badge-high',
      iconColor: 'text-risk-high',
      valueColor: 'text-risk-high',
    };
  }, [calculatedAvgScore, hasScoreData]);

  // ── History Helpers & Grouping (Exact match to TutorStudentProfile.tsx) ──
  const sortedHistory = useMemo(
    () => [...grades].sort((a, b) => (b.date_logged > a.date_logged ? 1 : b.date_logged < a.date_logged ? -1 : 0)),
    [grades]
  );

  const jumpFiltered = useMemo(
    () => (jumpDate ? sortedHistory.filter((l) => l.date_logged === jumpDate) : null),
    [sortedHistory, jumpDate]
  );

  type Group = { key: string; label: string; records: typeof sortedHistory };

  const groupedHistory = useMemo((): Group[] => {
    if (jumpFiltered !== null) return [];
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of sortedHistory) {
      const key = viewMode === 'week' ? getWeekKey(log.date_logged) : getMonthKey(log.date_logged);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, records]) => ({
        key,
        label: viewMode === 'week' ? weekLabel(key) : monthLabel(key),
        records,
      }));
  }, [sortedHistory, viewMode, jumpFiltered]);

  const timeGroupedHistory = useMemo((): Group[] => {
    const source = jumpFiltered ?? sortedHistory;
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of source) {
      const timeStr = log.created_at ? formatTimeString(log.created_at) : '—';
      const key = `${log.date_logged}|${timeStr}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    return Array.from(grouped.entries()).map(([key, records]) => {
      const [date, time] = key.split('|');
      return {
        key,
        label: time !== '—' ? `${formatDateString(date).toUpperCase()} | ${time}` : formatDateString(date).toUpperCase(),
        records,
      };
    });
  }, [sortedHistory, jumpFiltered]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortRecords = (list: Grade[]) => {
    return [...list].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      const aTotal = Number(a.total_score) || 100;
      const bTotal = Number(b.total_score) || 100;
      const aPct = (Number(a.score) / aTotal) * 100;
      const bPct = (Number(b.score) / bTotal) * 100;
      const aNotTaken = a.remarks?.trim().toLowerCase() === 'not taken';
      const bNotTaken = b.remarks?.trim().toLowerCase() === 'not taken';

      if (sortConfig.key === 'score') {
        aVal = aPct;
        bVal = bPct;
        return sortConfig.direction === 'asc' ? ((aVal as number) - (bVal as number)) : ((bVal as number) - (aVal as number));
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
  };

  const SortableHeader: React.FC<{ label: string; sortKey: SortKey }> = ({ label, sortKey }) => {
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

  const renderTable = (records: Grade[]) => (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-[#1A1A1A]">
      <table className="min-w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm">
        <thead>
          <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              <SortableHeader label="SCORE" sortKey="score" />
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              <SortableHeader label="REMARKS" sortKey="remarks" />
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              <SortableHeader label="STATUS" sortKey="status" />
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              <SortableHeader label="DATE" sortKey="date" />
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
              <SortableHeader label="TIME" sortKey="time" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
          {records.map((grade) => {
            const isNotTaken = grade.remarks?.trim().toLowerCase() === 'not taken';
            const totalScore = Number(grade.total_score) || 100;
            const scorePct = (Number(grade.score) / totalScore) * 100;
            const isPassed = !isNotTaken && scorePct >= 70;

            return (
              <tr key={grade.id} className="group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#111111]/80">
                <td className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-200 whitespace-nowrap text-xs">
                  <span className="font-bold text-gray-900 dark:text-slate-100">{Number(grade.score).toFixed(2)}</span>
                  <span className="text-gray-400 dark:text-slate-500 font-normal"> / {Number(grade.total_score || 100).toFixed(2)}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                      isNotTaken
                        ? 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                        : isPassed
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40'
                    }`}
                  >
                    {isNotTaken ? 'Not Taken' : isPassed ? 'PASSED' : 'FAILED'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                      isNotTaken
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                    }`}
                  >
                    {isNotTaken ? 'NOT TAKEN' : 'TAKEN'}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-200 whitespace-nowrap text-xs">
                  {formatDateString(grade.date_logged)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400 font-mono text-xs">
                  {grade.created_at ? formatTimeString(grade.created_at) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const currentRecordsCount = jumpFiltered !== null ? jumpFiltered.length : sortedHistory.length;

  if (loading) {
    return (
      <div className="space-y-6 skeleton-container">
        {/* KPI containers skeleton (exact match from TutorStudentProfile) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 skeleton-row-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 shadow-sm flex items-center gap-4 animate-pulse"
            >
              <div className="w-11 h-11 rounded-2xl bg-gray-200 dark:bg-gray-800 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-7 w-16 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-2.5 w-36 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>

        {/* Score Entries Table skeleton */}
        <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl border border-gray-200 dark:border-[#1A1A1A] shadow-sm p-6 space-y-4 skeleton-row-2">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1.5">
              <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-28 rounded-xl bg-gray-100 dark:bg-gray-800" />
              <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800/60" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 data-loaded-content">
      {/* ── Top KPI Stat Containers (Exact Match to TutorStudentProfile.tsx) ──── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* TOTAL PASSED */}
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20 p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">TOTAL PASSED</p>
            <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">{passedCount}</p>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">{studentFirstName}'s total passed score records</p>
          </div>
        </div>

        {/* TOTAL FAILED */}
        <div className="rounded-3xl border border-rose-200 bg-rose-50 dark:border-rose-800/40 dark:bg-rose-950/20 p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center shrink-0">
            <X className="w-5 h-5 text-rose-600 dark:text-rose-400" strokeWidth={3} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">TOTAL FAILED</p>
            <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-100 mt-0.5">{failedCount}</p>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">{studentFirstName}'s total failed score records</p>
          </div>
        </div>

        {/* AVERAGE SCORE */}
        <div className="rounded-3xl border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] p-5 shadow-sm flex items-center gap-4">
          <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${scoreMood.iconBg}`}>
            <scoreMood.icon className={`w-5 h-5 ${scoreMood.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">AVERAGE SCORE</p>
            <p className={`text-2xl font-extrabold mt-0.5 ${scoreMood.valueColor}`}>
              {hasScoreData ? `${smartPct(calculatedAvgScore)}%` : '—'}
            </p>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">{studentFirstName}'s average score</p>
          </div>
        </div>
      </div>

      {/* ── Scores History Container (Exact Match to TutorStudentProfile.tsx) ──── */}
      <div
        className="bg-white dark:bg-[#0A0A0A] rounded-3xl border border-gray-200 dark:border-[#1A1A1A] shadow-sm p-6 space-y-4 relative"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base">SCORES HISTORY</h3>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">
              {currentRecordsCount} Record{currentRecordsCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Filter controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View mode toggle (DAY / WEEK / MONTH) */}
            <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-0.5 gap-0.5">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setViewMode(mode);
                    setJumpDate(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    viewMode === mode && !jumpDate
                      ? 'bg-[var(--brand)] text-white shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Custom Calendar Dropdown Button */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                onClick={() => setShowCalendarPopover((prev) => !prev)}
                className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                  jumpDate
                    ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-sm'
                    : 'border-[var(--brand-border)] bg-[var(--brand-light)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)] shadow-xs'
                }`}
                title="Select a specific date from calendar"
                aria-label="Open Calendar"
              >
                <Calendar className="w-4 h-4" />
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
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20">
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
              onClick={() => setJumpDate(null)}
              className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}

        {/* Content */}
        {error ? (
          <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-2xl p-5 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Failed to load scores</p>
              <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
            </div>
          </div>
        ) : jumpFiltered !== null ? (
          jumpFiltered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarDays className="w-10 h-10 text-gray-200 dark:text-gray-700" />
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No records for this date</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Try a different date or clear the filter</p>
            </div>
          ) : (
            <div className="space-y-6">
              {timeGroupedHistory.map((group) => (
                <div key={group.key}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                      {group.label}
                    </span>
                    <div className="h-px flex-1 bg-gray-100 dark:bg-[#1A1A1A]" />
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
                      {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {renderTable(sortRecords(group.records))}
                </div>
              ))}
            </div>
          )
        ) : viewMode === 'day' ? (
          sortedHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarDays className="w-10 h-10 text-gray-200 dark:text-gray-700" />
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No score records yet</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Records will appear once scores are logged for you</p>
            </div>
          ) : (
            <div className="space-y-6">
              {timeGroupedHistory.map((group) => (
                <div key={group.key}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                      {group.label}
                    </span>
                    <div className="h-px flex-1 bg-gray-100 dark:bg-[#1A1A1A]" />
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
                      {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {renderTable(sortRecords(group.records))}
                </div>
              ))}
            </div>
          )
        ) : (
          groupedHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarDays className="w-10 h-10 text-gray-200 dark:text-gray-700" />
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No records to display</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedHistory.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-[#1A1A1A]" />
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
                      {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {renderTable(sortRecords(group.records))}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default StudentScores;
