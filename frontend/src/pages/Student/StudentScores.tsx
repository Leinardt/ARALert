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
  UserCheck,
} from 'lucide-react';
import { getScoreDescription } from '../../utils/sessionDescriptionHelpers';
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

/* ─── Main Component ──────────────────────────────────────────── */

type SortKey = 'student' | 'description' | 'score' | 'remarks' | 'status' | 'date' | 'time';
type ViewMode = 'day' | 'week' | 'month';

export const StudentScores: React.FC = () => {
  const { user } = useAuth();
  const studentFirstName = user?.first_name || user?.full_name?.trim().split(' ')[0] || 'Student';
  const studentFullName = user?.full_name || 'STUDENT';
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sort States
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  });
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);

  // ── Unified School Year - Semester/Summer Filter State ──
  const currentSchoolYear = useMemo(() => getDepEdSchoolYear(), []);
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
            setSelectedPeriod((prev) => {
              if (prev === 'all|all') return prev;
              const sem = prev.split('|')[1] || currentSchoolYear.currentPeriod;
              return `${activeSy}|${sem}`;
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
  }, [user, currentSchoolYear.currentPeriod]);

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
    const { syStart, syEnd, currentPeriod } = currentSchoolYear;
    const activeSy = `${syStart}-${syEnd}`;
    const activePeriodKey = `${activeSy}|${currentPeriod || '1st'}`;

    const recordedPeriods = new Set<string>();

    // Always include current active period
    recordedPeriods.add(activePeriodKey);

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

    // Sort descending by starting year, then semester order (1st, 2nd, summer)
    const semRank: Record<string, number> = { '1st': 1, '2nd': 2, 'summer': 3 };
    periodsList.sort((a, b) => {
      const yearA = parseInt(a.sy.split('-')[0], 10) || 0;
      const yearB = parseInt(b.sy.split('-')[0], 10) || 0;
      if (yearA !== yearB) {
        return yearB - yearA;
      }
      return (semRank[a.sem] || 0) - (semRank[b.sem] || 0);
    });

    const opts: { key: string; label: string }[] = [
      { key: 'all|all', label: 'All School Years & Semesters' },
    ];

    periodsList.forEach(({ key, sy, sem }) => {
      const isCurrentSy = sy === activeSy;
      const isCurrentSem = isCurrentSy && sem === (currentPeriod || '1st');
      const tag = isCurrentSem ? ' (Active)' : '';
      const syDisplay = `SY ${sy.replace('-', '–')}`;
      const semDisplay = sem === '1st' ? '1st Semester' : sem === '2nd' ? '2nd Semester' : 'Summer';

      const tutor = resolveTutorForPeriod(sy, sem, studentHistory) || (isCurrentSy ? studentHistory?.current_tutor : null);
      const tutorSuffix = tutor ? ` — ${tutor}` : '';

      opts.push({
        key,
        label: `${syDisplay} - ${semDisplay}${tag}${tutorSuffix}`,
      });
    });

    return opts;
  }, [currentSchoolYear, studentHistory, grades]);

  // ── Filter by Unified School Year - Semester & jumpDate ──
  const filteredGrades = useMemo(() => {
    let result = [...grades];
    if (selectedPeriod !== 'all|all') {
      const [filterSy, filterSem] = selectedPeriod.split('|');
      if (filterSy && filterSy !== 'all') {
        result = result.filter((g) => {
          const sy = getSchoolYearFromDate(g.date_logged || g.created_at);
          return sy === filterSy;
        });
      }
      if (filterSem && filterSem !== 'all') {
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
  }, [grades, selectedPeriod, jumpDate]);

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

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPeriod, jumpDate, viewMode]);

  const sortedHistory = useMemo(
    () => [...filteredGrades].sort((a, b) => (b.date_logged > a.date_logged ? 1 : b.date_logged < a.date_logged ? -1 : 0)),
    [filteredGrades]
  );

  const paginatedRecords = useMemo(
    () => sortedHistory.slice((currentPage - 1) * 30, currentPage * 30),
    [sortedHistory, currentPage]
  );

  type Group = { key: string; label: string; records: typeof sortedHistory };

  const groupedHistory = useMemo((): Group[] => {
    if (jumpDate !== null) return [];
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of paginatedRecords) {
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
  }, [paginatedRecords, viewMode, jumpDate]);

  const timeGroupedHistory = useMemo((): Group[] => {
    const source = paginatedRecords;
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
  }, [paginatedRecords]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortRecords = (list: Grade[]) => {
    if (viewMode === 'day') return list;
    return [...list].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      const aTotal = Number(a.total_score) || 100;
      const bTotal = Number(b.total_score) || 100;
      const aPct = (Number(a.score) / aTotal) * 100;
      const bPct = (Number(b.score) / bTotal) * 100;
      const aNotTaken = a.remarks?.trim().toLowerCase() === 'not taken';
      const bNotTaken = b.remarks?.trim().toLowerCase() === 'not taken';

      if (sortConfig.key === 'student') {
        const cmp = compareNamesByLastName(a.student_name || user?.full_name || '', b.student_name || user?.full_name || '');
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      } else if (sortConfig.key === 'description') {
        aVal = getScoreDescription(a);
        bVal = getScoreDescription(b);
      } else if (sortConfig.key === 'score') {
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
    if (viewMode === 'day') {
      return <span>{label}</span>;
    }
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
    <div>
      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block overflow-x-auto mobile-scroll-table -mx-2 px-2">
        <table className="min-w-[900px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm">
          <thead>
            <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
              <th className="w-[22%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                <SortableHeader label="HANDLED BY (TUTOR)" sortKey="student" />
              </th>
              <th className="w-[18%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                <SortableHeader label="DESCRIPTION" sortKey="description" />
              </th>
              <th className="w-[10%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                <SortableHeader label="SCORE" sortKey="score" />
              </th>
              <th className="w-[12%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                <SortableHeader label="REMARK" sortKey="remarks" />
              </th>
              <th className="w-[10%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                <SortableHeader label="STATUS" sortKey="status" />
              </th>
              <th className="w-[14%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
                <SortableHeader label="DATE" sortKey="date" />
              </th>
              <th className="w-[8%] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 whitespace-nowrap">
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
              const desc = getScoreDescription(grade);
              const gradeSy = getSchoolYearFromDate(grade.date_logged || grade.created_at);
              const gradeSem = getSemesterFromGrade(grade);
              const handlerName =
                grade.tutor_name ||
                resolveTutorForPeriod(gradeSy, gradeSem, studentHistory) ||
                studentHistory?.current_tutor ||
                'Assigned Tutor';
              const semLabel = grade.quarter
                ? `Quarter ${grade.quarter}`
                : getSemesterLabel(getSemesterFromGrade(grade));

              return (
                <tr key={grade.id} className="group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#111111]/80">
                  {/* HANDLED BY */}
                  <td className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-100 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-1.5 text-xs">
                        <UserCheck className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
                        {handlerName}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                        {semLabel}
                      </span>
                    </div>
                  </td>

                  {/* DESCRIPTION */}
                  <td className="px-4 py-3 text-left whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                        desc !== 'Intervention Activity'
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {desc}
                    </span>
                  </td>

                  {/* SCORE */}
                  <td className="px-4 py-3 text-xs text-gray-700 dark:text-slate-300 whitespace-nowrap">
                    {grade.score} / {grade.total_score || 100}
                  </td>

                  {/* REMARK */}
                  <td className="px-4 py-3 text-left whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${isNotTaken
                        ? 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                        : isPassed
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                    >
                      {isNotTaken ? 'Not Taken' : isPassed ? 'Passed' : 'Failed'}
                    </span>
                  </td>

                  {/* STATUS */}
                  <td className="px-4 py-3 text-left whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize whitespace-nowrap ${isNotTaken
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                    >
                      {isNotTaken ? 'Not Taken' : 'Taken'}
                    </span>
                  </td>

                  {/* DATE */}
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs">
                    {formatDateString(grade.date_logged)}
                  </td>

                  {/* TIME */}
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs">
                    {grade.created_at ? formatTimeString(grade.created_at) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout (< 768px) */}
      <div className="md:hidden space-y-3">
        {records.map((grade) => {
          const isNotTaken = grade.remarks?.trim().toLowerCase() === 'not taken';
          const totalScore = Number(grade.total_score) || 100;
          const scorePct = (Number(grade.score) / totalScore) * 100;
          const isPassed = !isNotTaken && scorePct >= 70;
          const desc = getScoreDescription(grade);
          const gradeSy = getSchoolYearFromDate(grade.date_logged || grade.created_at);
          const gradeSem = getSemesterFromGrade(grade);
          const handlerName =
            grade.tutor_name ||
            resolveTutorForPeriod(gradeSy, gradeSem, studentHistory) ||
            studentHistory?.current_tutor ||
            'Assigned Tutor';
          const semLabel = grade.quarter
            ? `Quarter ${grade.quarter}`
            : getSemesterLabel(getSemesterFromGrade(grade));

          return (
            <div
              key={`mobile-card-${grade.id}`}
              className="rounded-xl border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#111111] p-4 space-y-3 shadow-xs"
            >
              {/* Header: Description + Status Pills */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    desc !== 'Intervention Activity'
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {desc}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                      isNotTaken
                        ? 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                        : isPassed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    {isNotTaken ? 'Not Taken' : isPassed ? 'Passed' : 'Failed'}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      isNotTaken
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    }`}
                  >
                    {isNotTaken ? 'Not Taken' : 'Taken'}
                  </span>
                </div>
              </div>

              {/* Score Hero Row */}
              <div className="flex items-baseline justify-between py-2 px-3 rounded-lg bg-gray-50/80 dark:bg-[#161616] border border-gray-100 dark:border-[#222222]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                    Score
                  </span>
                  <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">
                    {grade.score}{' '}
                    <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                      / {grade.total_score || 100}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                    Percentage
                  </span>
                  <p
                    className={`text-xl sm:text-2xl font-black mt-0.5 ${
                      isNotTaken
                        ? 'text-gray-400 dark:text-slate-500'
                        : isPassed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isNotTaken ? '0%' : `${smartPct(scorePct)}%`}
                  </p>
                </div>
              </div>

              {/* Handled By & Timestamp Row */}
              <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-100 dark:border-[#222222] text-xs">
                <div className="flex items-center justify-between text-slate-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium">
                    <UserCheck className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
                    <span>Handled by: <strong className="font-bold text-slate-900 dark:text-white">{handlerName}</strong></span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{semLabel}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{formatDateString(grade.date_logged)}</span>
                  </div>
                  {grade.created_at && (
                    <span className="text-[11px] text-gray-400 dark:text-slate-500">
                      {formatTimeString(grade.created_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const visibleRecordsCount = filteredGrades.length;

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
            <p className="text-2xl font-extrabold mt-0.5 text-gray-900 dark:text-slate-100">
              {hasScoreData ? `${smartPct(calculatedAvgScore)}%` : '—'}
            </p>
            <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s average score</p>
          </div>
        </div>
      </div>

      {/* ── Academic Records Container ──────────────────────────────────── */}
      <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] relative">
        {/* Header & Controls Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm uppercase">
              {studentFirstName}'s Academic Records
            </h3>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">
              {visibleRecordsCount} Record{visibleRecordsCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Filter controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Unified School Year - Semester/Summer Dropdown (matches Tutor Assigned Students dropdown) */}
            <div className="relative inline-flex items-center">
              <select
                value={selectedPeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value);
                  setJumpDate(null);
                }}
                aria-label="Filter by School Year and Semester"
                className="h-8.5 sm:h-8 appearance-none rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] pl-3 pr-8 text-xs font-bold text-[var(--brand)] outline-none transition hover:bg-gray-100 dark:hover:bg-[#222222] focus:border-[var(--brand)] cursor-pointer"
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
              <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[var(--brand)] opacity-75" />
            </div>

            {/* View mode toggle (DAY / WEEK / MONTH) */}
            <div className="flex bg-gray-100 dark:bg-[#111111] rounded-md p-0.5 gap-0.5">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setViewMode(mode);
                    setJumpDate(null);
                  }}
                  className={`h-8 sm:h-7 whitespace-nowrap rounded-sm px-3 text-xs sm:text-[10px] font-bold uppercase transition-all cursor-pointer ${viewMode === mode && !jumpDate
                    ? 'bg-[var(--brand)] text-white'
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
                className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border p-0 transition-all ${jumpDate
                  ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                  : 'border-[var(--brand-border)] bg-[var(--brand-light)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)]'
                  }`}
                title="Select a specific date from calendar"
                aria-label="Open score calendar"
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
          ) : jumpDate !== null ? (
            sortedHistory.length === 0 ? (
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
                <BookOpen className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">
                  No score records yet
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Records will appear once scores are logged for you
                </p>
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


    </div>
  );
};

export default StudentScores;
