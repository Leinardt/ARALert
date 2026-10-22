import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { User, Grade } from '../types';
import { userService } from '../services/userService';
import {
  exportScoresToExcel,
  formatSessionDateHeader,
  ScoreExportData,
  ScoreExportWeek,
  ScoreExportDay,
} from '../utils/scoreExportService';
import { exportScoresToDocx } from '../utils/scoreDocxExportService';
import { exportScoresToPdf } from '../utils/scorePdfExportService';
import { DEPED_LOGO_SRC, PNAHS_LOGO_SRC } from '../assets/template_logos/logosBase64';
import { formatStudentName } from '../utils/studentFormatters';
import { getScoreDescription, getTutorAssignedMilestone } from '../utils/sessionDescriptionHelpers';

export interface ExportScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  students: User[];
  grades: Grade[];
  initialMode?: 'all' | 'daily' | 'weekly' | 'monthly';
  initialTargetKey?: string;
  /** Optional: 'MOSY' | 'EOSY' | 'ARAL Summer Assessment' — used as the filename prefix */
  assessmentType?: string;
  selectedCohort?: string;
  selectedAralLevel?: string;
  selectedSubject?: string;
}

const formatStudentNameDepEd = formatStudentName;

const getWeekStartKey = (dateObj: Date): string => {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const day = d.getDay();
  const diff = d.getDate() + (day === 0 ? 1 : 1 - day);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dayStr = String(monday.getDate()).padStart(2, '0');
  return `${monday.getFullYear()}-${m}-${dayStr}`;
};

const formatDateKey = (year: number, month: number, day: number): string => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

const formatNumericDate = (d: Date | string): string => {
  if (typeof d === 'string') {
    const parts = d.split('-');
    if (parts.length === 3) {
      const [y, m, day] = parts;
      return `${m.padStart(2, '0')}/${day.padStart(2, '0')}/${y}`;
    }
    d = new Date(d);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}/${year}`;
};

export const getScoreWeeksForMonth = (
  year: number,
  month: number // 0-indexed: 0 = Jan, 11 = Dec
): ScoreExportWeek[] => {
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  const monthRangeLabel = `${formatNumericDate(startOfMonth)} - ${formatNumericDate(endOfMonth)}`;
  const dayNames = ['M', 'T', 'W', 'TH', 'F'];
  const days: Array<{ dateKey: string; dayNum: string; dayName?: string }> = [];

  for (let d = 1; d <= endOfMonth.getDate(); d++) {
    const cur = new Date(year, month, d);
    const dayOfWeek = cur.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        dateKey: `${year}-${mStr}-${dStr}`,
        dayNum: String(d),
        dayName: dayNames[dayOfWeek - 1],
      });
    }
  }

  return [
    {
      label: monthRangeLabel,
      days,
    },
  ];
};

// ─── Interactive Calendar Picker Component ──────────────────────────────────
interface CalendarPickerProps {
  exportMode: 'daily' | 'weekly' | 'monthly';
  selectedDateKey: string;
  selectedWeekKey: string;
  selectedMonthKey: string;
  onSelectDate: (dateKey: string) => void;
  onSelectWeek: (weekStartKey: string) => void;
  onSelectMonth: (monthKey: string) => void;
  loggedDatesCount: Record<string, number>;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({
  exportMode,
  selectedDateKey,
  selectedWeekKey,
  selectedMonthKey,
  onSelectDate,
  onSelectWeek,
  onSelectMonth,
  loggedDatesCount,
}) => {
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDateKey) {
      const [y, m] = selectedDateKey.split('-');
      return new Date(Number(y), Number(m) - 1, 1);
    }
    return new Date();
  });

  // Only sync viewDate when exportMode changes
  const prevModeRef = useRef(exportMode);
  useEffect(() => {
    if (prevModeRef.current !== exportMode) {
      prevModeRef.current = exportMode;
      if (exportMode === 'daily' && selectedDateKey) {
        const [y, m] = selectedDateKey.split('-');
        setViewDate(new Date(Number(y), Number(m) - 1, 1));
      } else if (exportMode === 'weekly' && selectedWeekKey) {
        const [y, m] = selectedWeekKey.split('-');
        setViewDate(new Date(Number(y), Number(m) - 1, 1));
      } else if (exportMode === 'monthly' && selectedMonthKey) {
        const [y, m] = selectedMonthKey.split('-');
        setViewDate(new Date(Number(y), Number(m) - 1, 1));
      }
    }
  }, [exportMode, selectedDateKey, selectedWeekKey, selectedMonthKey]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const currentMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const prevMonth = () => {
    setViewDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      if (exportMode === 'monthly') {
        const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        onSelectMonth(nextKey);
      }
      return next;
    });
  };

  const nextMonth = () => {
    setViewDate((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      if (exportMode === 'monthly') {
        const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        onSelectMonth(nextKey);
      }
      return next;
    });
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Fixed 42 cells (6 full weeks) with subtle leading & trailing dates from adjacent months
  const calendarCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const offset = i - firstDayOfWeek;
      const cellDateObj = new Date(year, month, 1 + offset);
      const cellYear = cellDateObj.getFullYear();
      const cellMonth = cellDateObj.getMonth();
      const cellDate = cellDateObj.getDate();
      const isCurrentMonth = cellMonth === month;
      const cellDateKey = formatDateKey(cellYear, cellMonth, cellDate);
      const cellWeekStartKey = getWeekStartKey(cellDateObj);
      const isWeekday = cellDateObj.getDay() >= 1 && cellDateObj.getDay() <= 5;

      cells.push({
        dateObj: cellDateObj,
        cellDateKey,
        dayNum: cellDate,
        cellWeekStartKey,
        isCurrentMonth,
        isWeekday,
        cellYear,
        cellMonth,
      });
    }
    return cells;
  }, [year, month, firstDayOfWeek]);

  return (
    <div
      className="p-3 sm:p-3.5 text-xs select-none"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="flex items-center justify-between pb-2.5 pt-0.5 border-b border-slate-100 dark:border-[#1A1A1A]">
        <span className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wide">{monthName}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="flex items-center justify-center w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-bold transition cursor-pointer"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="flex items-center justify-center w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-bold transition cursor-pointer"
            aria-label="Next Month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center font-bold text-slate-400 dark:text-slate-500 py-2 text-[10px] uppercase tracking-wider">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {calendarCells.map((cell) => {
          const entriesCount = loggedDatesCount[cell.cellDateKey] || 0;
          const hasLoggedData = entriesCount > 0;

          const isDaySelected = exportMode === 'daily' && selectedDateKey === cell.cellDateKey;
          const isWeekSelected = exportMode === 'weekly' && selectedWeekKey === cell.cellWeekStartKey && cell.isWeekday;
          const isMonthSelected = exportMode === 'monthly' && cell.isCurrentMonth && currentMonthKey === (selectedMonthKey || currentMonthKey);

          return (
            <button
              key={cell.cellDateKey}
              type="button"
              onClick={() => {
                if (exportMode === 'daily') {
                  onSelectDate(cell.cellDateKey);
                } else if (exportMode === 'weekly') {
                  onSelectWeek(cell.cellWeekStartKey);
                } else if (exportMode === 'monthly') {
                  if (cell.isCurrentMonth) {
                    onSelectMonth(currentMonthKey);
                  } else {
                    const targetMonthKey = `${cell.cellYear}-${String(cell.cellMonth + 1).padStart(2, '0')}`;
                    setViewDate(new Date(cell.cellYear, cell.cellMonth, 1));
                    onSelectMonth(targetMonthKey);
                  }
                } else {
                  onSelectDate(cell.cellDateKey);
                }
              }}
              title={cell.isCurrentMonth ? cell.cellDateKey : `${cell.cellDateKey} (Adjacent month)`}
              className={`relative flex flex-col items-center justify-center h-8.5 sm:h-9 rounded-lg transition text-[11px] cursor-pointer ${isDaySelected
                ? 'bg-[var(--brand)] text-white font-bold shadow-xs border border-[var(--brand)]'
                : isWeekSelected
                  ? cell.isCurrentMonth
                    ? 'bg-[var(--brand)] text-white font-bold shadow-xs border border-[var(--brand)]'
                    : 'bg-[var(--brand)]/60 text-white/90 dark:bg-[var(--brand)]/40 dark:text-white/90 font-semibold border border-dashed border-[var(--brand)]/60'
                  : isMonthSelected
                    ? 'bg-[var(--brand-light)] text-[var(--brand-dark)] dark:bg-[var(--brand)]/30 dark:text-white font-semibold border border-[var(--brand-border)]/60 hover:bg-[var(--brand-light)] dark:hover:bg-[var(--brand)]/40'
                    : hasLoggedData
                      ? cell.isCurrentMonth
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700'
                        : 'bg-slate-50/80 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300'
                      : cell.isCurrentMonth
                        ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        : 'text-slate-300 dark:text-slate-600 font-normal hover:text-slate-500 dark:hover:text-slate-400 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                }`}
            >
              <span className={`text-[11px] ${!cell.isCurrentMonth && !isDaySelected && !isWeekSelected && !isMonthSelected ? 'opacity-80' : ''}`}>
                {cell.dayNum}
              </span>
              {hasLoggedData && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${
                    isDaySelected || (isWeekSelected && cell.isCurrentMonth)
                      ? 'bg-white'
                      : isWeekSelected && !cell.isCurrentMonth
                        ? 'bg-white/80'
                        : isMonthSelected
                          ? 'bg-[var(--brand)] dark:bg-white'
                          : cell.isCurrentMonth
                            ? 'bg-[var(--brand)] dark:bg-blue-400'
                            : 'bg-[var(--brand)]/40 dark:bg-blue-400/40'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-[#1A1A1A]">
        <div className="flex items-center gap-1 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)] dark:bg-blue-400 inline-block" />
          <span>Has score record</span>
        </div>
        <span className="text-[9px] text-slate-400 dark:text-slate-500 italic">
          {exportMode === 'weekly' ? 'Mon – Fri week' : exportMode === 'monthly' ? 'Full month' : 'Daily view'}
        </span>
      </div>
    </div>
  );
};

// ─── Paper Configuration ───────────────────────────────────────────────────
export const PAPER_CONFIG = {
  a4: {
    width: '794px',
    minHeight: '1123px',
    label: 'A4 (210 × 297 mm)',
    pageCss: '@page { size: A4 portrait; margin: 10mm; }',
  },
  folio: {
    width: '816px',
    minHeight: '1248px',
    label: 'Long / Folio (8.5 × 13 in)',
    pageCss: '@page { size: 8.5in 13in portrait; margin: 10mm; }',
  },
  letter: {
    width: '816px',
    minHeight: '1056px',
    label: 'Short / Letter (8.5 × 11 in)',
    pageCss: '@page { size: letter portrait; margin: 10mm; }',
  },
};

// ─── Main Modal Component ───────────────────────────────────────────────────
export const ExportScoreModal: React.FC<ExportScoreModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  students,
  grades,
  initialMode = 'weekly',
  initialTargetKey = '',
  assessmentType,
  selectedCohort = '',
  selectedAralLevel = '',
  selectedSubject = '',
}) => {
  const [division, setDivision] = useState('DIVISION OF MASBATE');
  const [district, setDistrict] = useState('PALANAS NORTH DISTRICT');
  const [schoolName, setSchoolName] = useState('PALANAS NATIONAL AGRICULTURE HIGH SCHOOL');
  const [schoolAddress, setSchoolAddress] = useState('Sta. Cruz, Palanas, Masbate');

  const [subjectTitle, setSubjectTitle] = useState(() => {
    if (selectedSubject) {
      const levelStr = selectedAralLevel ? ` (${selectedAralLevel.toUpperCase()})` : '';
      return `ARAL PROGRAM WEEKLY TASK SCORE SHEET - ${selectedSubject.toUpperCase()}${levelStr}`;
    }
    return 'ARAL PROGRAM WEEKLY TASK SCORE SHEET';
  });
  const [gradeSection, setGradeSection] = useState(() => selectedCohort || 'MIXED (GRADES 7-12)');
  const [taskTitle, setTaskTitle] = useState('WEEKLY TASK');
  const [dateStr, setDateStr] = useState(() => formatNumericDate(new Date()));

  useEffect(() => {
    if (selectedCohort) {
      setGradeSection(selectedCohort);
    }
    if (selectedSubject) {
      const levelStr = selectedAralLevel ? ` (${selectedAralLevel.toUpperCase()})` : '';
      setSubjectTitle(`ARAL PROGRAM WEEKLY TASK SCORE SHEET - ${selectedSubject.toUpperCase()}${levelStr}`);
    }
  }, [selectedCohort, selectedSubject, selectedAralLevel]);

  const [tutorName, setTutorName] = useState('');
  const [tutorTitle, setTutorTitle] = useState('ARAL Tutor');
  const [checkedName, setCheckedName] = useState('FIRSTNAME M.I. LASTNAME');
  const [checkedTitle, setCheckedTitle] = useState('HT/Asst. to the Principal');
  const [notedName, setNotedName] = useState('FIRSTNAME M.I. LASTNAME');
  const [notedTitle, setNotedTitle] = useState('Principal I');

  const [paperSize, setPaperSize] = useState<'a4' | 'folio' | 'letter'>('letter');
  const [customWeekLabels, setCustomWeekLabels] = useState<Record<number, string>>({});

  const [exportMode, setExportMode] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>('');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [weekNumber, setWeekNumber] = useState<string>('1');

  const [selectedAssessmentType, setSelectedAssessmentType] = useState<string>(assessmentType || '');
  const [showSettings, setShowSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [confirmDownloadFormat, setConfirmDownloadFormat] = useState<'docx' | 'pdf' | 'excel' | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const handleToggleSettings = () => {
    setShowSettings((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          if (scrollBodyRef.current) {
            scrollBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
          settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
      return next;
    });
  };

  useEffect(() => {
    if (currentUser?.full_name) {
      setTutorName(currentUser.full_name.toUpperCase());
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    userService
      .getUsers({ role: 'principal', status: 'active' })
      .then((res) => {
        if (isMounted && res.results && res.results.length > 0) {
          const principal = res.results[0];
          const name = principal.full_name || `${principal.first_name} ${principal.last_name}`;
          if (name && name.trim()) {
            setNotedName(name.toUpperCase().trim());
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load active principal for score sheet:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Extract assessment grades & count of entries per date for calendar dots
  const assessmentGrades = useMemo(
    () => grades.filter((g) => g.component_type === 'assessment'),
    [grades]
  );

  const loggedDatesCount = useMemo(() => {
    return assessmentGrades.reduce((acc, g) => {
      if (!g.date_logged) return acc;
      const dateKey = g.date_logged.length >= 10 ? g.date_logged.slice(0, 10) : new Date(g.date_logged).toISOString().slice(0, 10);
      acc[dateKey] = (acc[dateKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [assessmentGrades]);

  const computeWeekOfMonth = (dateObj: Date): number => {
    // School weeks run Mon-Fri. Use Wednesday (school midweek) to determine which month this school week primarily belongs to
    const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const day = d.getDay();
    const wedDiff = day === 0 ? 3 : 3 - day;
    const wednesday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + wedDiff);
    const firstDay = new Date(wednesday.getFullYear(), wednesday.getMonth(), 1).getDay();
    return Math.ceil((wednesday.getDate() + (firstDay === 0 ? 6 : firstDay - 1)) / 7);
  };

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentMonth = todayKey.slice(0, 7);

    const effectiveMode: 'daily' | 'weekly' | 'monthly' =
      initialMode === 'daily' || initialMode === 'weekly' || initialMode === 'monthly'
        ? initialMode
        : 'weekly';

    setExportMode(effectiveMode);

    if (effectiveMode === 'daily') {
      const targetDate = initialTargetKey || todayKey;
      setSelectedDateKey(targetDate);
      setSelectedMonthKey(targetDate.slice(0, 7));
    } else if (effectiveMode === 'weekly') {
      const targetWeek = initialTargetKey || getWeekStartKey(now);
      setSelectedWeekKey(targetWeek);
      setSelectedMonthKey(targetWeek.slice(0, 7));
      const [y, m, d] = targetWeek.split('-').map(Number);
      setWeekNumber(String(computeWeekOfMonth(new Date(y, m - 1, d))));
    } else if (effectiveMode === 'monthly') {
      const targetMonth = initialTargetKey ? initialTargetKey.slice(0, 7) : currentMonth;
      setSelectedMonthKey(targetMonth);
    }
  }, [isOpen, initialMode, initialTargetKey]);

  useEffect(() => {
    if (exportMode === 'daily' && selectedDateKey) {
      const [y, m, d] = selectedDateKey.split('-').map(Number);
      setDateStr(formatNumericDate(new Date(y, m - 1, d)));
    } else if (exportMode === 'weekly' && selectedWeekKey) {
      const [y, m, d] = selectedWeekKey.split('-').map(Number);
      const ws = new Date(y, m - 1, d);
      const we = new Date(y, m - 1, d + 4);
      setDateStr(`${formatNumericDate(ws)} - ${formatNumericDate(we)}`);
      setWeekNumber(String(computeWeekOfMonth(ws)));
    } else if (exportMode === 'monthly' && selectedMonthKey) {
      const [yr, mo] = selectedMonthKey.split('-').map(Number);
      const startOfMonth = new Date(yr, mo - 1, 1);
      const endOfMonth = new Date(yr, mo, 0);
      setDateStr(`${formatNumericDate(startOfMonth)} - ${formatNumericDate(endOfMonth)}`);
    }
  }, [exportMode, selectedDateKey, selectedWeekKey, selectedMonthKey]);

  // Helper to compute session number for any date within its week (1-5)
  const getSessionNumberForDate = useMemo(() => {
    return (dateKey: string): number => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const targetDateObj = new Date(y, m - 1, d);
      const monKey = getWeekStartKey(targetDateObj);
      const [my, mm, md] = monKey.split('-').map(Number);
      const monObj = new Date(my, mm - 1, md);

      const weekDayKeys: string[] = [];
      for (let i = 0; i < 5; i++) {
        const cur = new Date(monObj.getFullYear(), monObj.getMonth(), monObj.getDate() + i);
        const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        weekDayKeys.push(k);
      }

      // Find all distinct dates in this week that have logged assessment grades:
      const datesWithScoresInWeek = weekDayKeys.filter((k) =>
        assessmentGrades.some((g) => {
          const gKey = g.date_logged?.length >= 10 ? g.date_logged.slice(0, 10) : new Date(g.date_logged).toISOString().slice(0, 10);
          return gKey === k;
        })
      );

      // If dateKey is in datesWithScoresInWeek, its session number is its 1-based index (1-5)
      const foundIdx = datesWithScoresInWeek.indexOf(dateKey);
      if (foundIdx !== -1) {
        return Math.min(5, Math.max(1, foundIdx + 1));
      }

      // If dateKey has no scores yet, count prior dates with scores in this week
      const priorScoresCount = datesWithScoresInWeek.filter((k) => k < dateKey).length;
      return Math.min(5, Math.max(1, priorScoresCount + 1));
    };
  }, [assessmentGrades]);

  // Compute weeks dynamically based on exportMode
  const weeks: ScoreExportWeek[] = useMemo(() => {
    if (exportMode === 'daily') {
      const targetDate = selectedDateKey || new Date().toISOString().slice(0, 10);
      const [y, m, d] = targetDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const sNum = getSessionNumberForDate(targetDate);
      return [
        {
          label: formatNumericDate(dateObj),
          days: [
            {
              dateKey: targetDate,
              dayNum: String(d),
              entries: [
                {
                  entryIndex: 0,
                  label: `Session #${sNum}`,
                },
              ],
            },
          ],
        },
      ];
    }

    if (exportMode === 'weekly') {
      const targetWeek = selectedWeekKey || getWeekStartKey(new Date());
      const [y, m, d] = targetWeek.split('-').map(Number);
      const mon = new Date(y, m - 1, d);

      const weekDayKeys: string[] = [];
      for (let i = 0; i < 5; i++) {
        const cur = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
        const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        weekDayKeys.push(k);
      }

      // Find which dates in this week have assessment scores logged:
      const activeDatesInWeek = weekDayKeys.filter((k) =>
        assessmentGrades.some((g) => {
          const gKey = g.date_logged?.length >= 10 ? g.date_logged.slice(0, 10) : new Date(g.date_logged).toISOString().slice(0, 10);
          return gKey === k;
        })
      );

      // If active dates exist, each active date becomes Session #1, Session #2, ...
      // If no active dates exist in this week yet, provide Session #1 as a blank entry
      const effectiveDates = activeDatesInWeek.length > 0 ? activeDatesInWeek : [weekDayKeys[0]];

      const days: ScoreExportDay[] = effectiveDates.map((dateKey, idx) => {
        const [, , dayPart] = dateKey.split('-');
        return {
          dateKey,
          dayNum: String(Number(dayPart)),
          entries: [
            {
              entryIndex: 0,
              label: `Session #${idx + 1}`,
            },
          ],
        };
      });

      const fri = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 4);
      const defaultLabel = `${formatNumericDate(mon)} - ${formatNumericDate(fri)}`;
      return [
        {
          label: customWeekLabels[0] || defaultLabel,
          days,
        },
      ];
    }

    // Monthly mode
    const [yr, mo] = (selectedMonthKey || new Date().toISOString().slice(0, 7))
      .split('-')
      .map(Number);
    const computed = getScoreWeeksForMonth(yr, mo - 1);
    return computed.map((w, idx) => {
      const activeDatesInWeek = w.days.filter((day) =>
        assessmentGrades.some((g) => {
          const gKey = g.date_logged?.length >= 10 ? g.date_logged.slice(0, 10) : new Date(g.date_logged).toISOString().slice(0, 10);
          return gKey === day.dateKey;
        })
      );
      const effectiveDays = activeDatesInWeek.length > 0 ? activeDatesInWeek : [w.days[0]];
      return {
        ...w,
        label: customWeekLabels[idx] || w.label,
        days: effectiveDays.map((day, sIdx) => ({
          ...day,
          entries: [
            {
              entryIndex: 0,
              label: `Session #${sIdx + 1}`,
            },
          ],
        })),
      };
    });
  }, [exportMode, selectedDateKey, selectedWeekKey, selectedMonthKey, customWeekLabels, getSessionNumberForDate, assessmentGrades]);

  const allEntryCols = useMemo(() => {
    return weeks.flatMap((w) =>
      w.days.flatMap((d) => {
        const dayEntries = d.entries && d.entries.length > 0 ? d.entries : [{ entryIndex: 0, label: 'Session #1' }];
        return dayEntries.map((e) => ({
          dateKey: d.dateKey,
          dayNum: d.dayNum,
          dayName: d.dayName,
          entryIndex: e.entryIndex,
          entryLabel: e.label,
        }));
      })
    );
  }, [weeks]);

  // Detect if active dates have milestone grades logged
  useEffect(() => {
    if (assessmentType !== undefined && assessmentType !== '') {
      setSelectedAssessmentType(assessmentType);
      return;
    }
    const activeDateKeys = weeks.flatMap((w) => w.days.map((d) => d.dateKey));
    const gradesInRange = assessmentGrades.filter((g) => {
      const dKey = g.date_logged?.length >= 10 ? g.date_logged.slice(0, 10) : new Date(g.date_logged).toISOString().slice(0, 10);
      return activeDateKeys.includes(dKey);
    });

    let detected = '';
    for (const g of gradesInRange) {
      const desc = getScoreDescription(g);
      if (desc === 'MOSY' || desc === 'EOSY' || desc === 'ARAL Summer Assessment') {
        detected = desc;
        break;
      }
    }
    setSelectedAssessmentType(detected);
  }, [assessmentType, weeks, assessmentGrades]);

  const colWidths = useMemo(() => {
    const totalCols = allEntryCols.length;
    if (totalCols === 1) {
      return { index: '35px', name: '280px', day: '160px', total: '120px' };
    }
    if (totalCols <= 3) {
      return { index: '32px', name: '260px', day: '90px', total: '110px' };
    }
    if (totalCols <= 6) {
      return { index: '30px', name: '250px', day: '72px', total: '95px' };
    }
    if (totalCols <= 10) {
      return { index: '28px', name: '230px', day: '55px', total: '85px' };
    }
    const dayWidth = totalCols > 20 ? '45px' : '50px';
    const nameWidth = totalCols > 20 ? '200px' : '215px';
    const totalWidth = '80px';
    return { index: '26px', name: nameWidth, day: dayWidth, total: totalWidth };
  }, [allEntryCols.length]);

  if (!isOpen) return null;

  const sortedStudents = [...students].sort((a, b) => {
    const nameA = formatStudentNameDepEd(a);
    const nameB = formatStudentNameDepEd(b);
    return nameA.localeCompare(nameB);
  });

  // Adaptive 1-page preview metrics based on student count and paper size
  const paperHeightPx = paperSize === 'folio' ? 1248 : paperSize === 'a4' ? 1123 : 1056;
  const totalStudentsCount = Math.max(sortedStudents.length, 1);
  const rawRowBudgetPx = (paperHeightPx - (taskTitle ? 380 : 360)) / totalStudentsCount;
  const isPreviewDense = rawRowBudgetPx < 18;
  const isPreviewCompact = rawRowBudgetPx >= 18 && rawRowBudgetPx < 24;
  const previewRowFontPx =
    rawRowBudgetPx >= 24 ? (allEntryCols.length > 5 ? 10 : 10.5) :
    rawRowBudgetPx >= 20 ? 9.5 :
    rawRowBudgetPx >= 17 ? 9 :
    rawRowBudgetPx >= 14.5 ? 8.5 : 8;
  const previewRowPadYPx =
    rawRowBudgetPx >= 26 ? 4 :
    rawRowBudgetPx >= 22 ? 2.5 :
    rawRowBudgetPx >= 18 ? 1.5 :
    rawRowBudgetPx >= 15 ? 1 : 0.5;
  const previewTutorName = tutorName || (currentUser?.full_name || 'TUTOR NAME');

  const studentExportRows = sortedStudents.map((student) => {
    const scoresByDate: Record<string, number | string> = {};
    const scores: (number | string)[] = [];
    let sum = 0;
    let hasAnyScore = false;

    allEntryCols.forEach((col) => {
      const studentGradesOnDate = assessmentGrades.filter((g) => {
        if (String(g.student) !== String(student.id)) return false;
        const dKey = g.date_logged?.length >= 10 ? g.date_logged.slice(0, 10) : new Date(g.date_logged).toISOString().slice(0, 10);
        return dKey === col.dateKey;
      });

      let matchedGrade: Grade | undefined;
      const sortedStudentGrades = [...studentGradesOnDate].sort((a, b) => {
        const timeA = a.created_at || a.date_logged || '';
        const timeB = b.created_at || b.date_logged || '';
        if (timeA && timeB && timeA !== timeB) return timeA.localeCompare(timeB);
        return a.id - b.id;
      });
      matchedGrade = sortedStudentGrades[col.entryIndex] || sortedStudentGrades[0];

      if (
        matchedGrade &&
        matchedGrade.score !== undefined &&
        matchedGrade.score !== null &&
        !isNaN(Number(matchedGrade.score)) &&
        matchedGrade.remarks !== 'Not Taken'
      ) {
        const val = Number(matchedGrade.score);
        scores.push(val);
        scoresByDate[`${col.dateKey}-${col.entryIndex}`] = val;
        sum += val;
        hasAnyScore = true;
      } else {
        scores.push('');
        scoresByDate[`${col.dateKey}-${col.entryIndex}`] = '';
      }
    });

    const totalScore: number | string = hasAnyScore ? sum : '';

    return {
      id: String(student.id),
      name: formatStudentNameDepEd(student),
      scores,
      scoresByDate,
      totalScore,
    };
  });

  const getExportData = (): ScoreExportData => ({
    division,
    district,
    schoolName,
    schoolAddress,
    subjectTitle,
    gradeSection,
    taskTitle,
    weekNumber,
    dateStr,
    paperSize,
    assessmentType: selectedAssessmentType || undefined,
    tutorName: tutorName || (currentUser?.full_name || 'TUTOR NAME').toUpperCase(),
    tutorTitle,
    checkedName,
    checkedTitle,
    notedName,
    notedTitle,
    weeks,
    students: studentExportRows,
  });

  const handleInitiateDownload = (format: 'docx' | 'pdf' | 'excel') => {
    // Hide template details settings if open to give full visibility to paper preview
    if (showSettings) setShowSettings(false);
    // Smoothly scroll the preview into view
    setTimeout(() => {
      if (scrollBodyRef.current) {
        scrollBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (printRef.current) {
        printRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
    setConfirmDownloadFormat(format);
  };

  const handleExecuteConfirmedDownload = async () => {
    if (!confirmDownloadFormat) return;
    if (confirmDownloadFormat === 'docx') {
      try {
        setIsExportingDocx(true);
        await exportScoresToDocx(getExportData());
        setConfirmDownloadFormat(null);
      } catch (err: any) {
        console.error('Failed to export DOCX:', err);
        alert(`Failed to generate DOCX file: ${err?.message || err}.`);
      } finally {
        setIsExportingDocx(false);
      }
    } else if (confirmDownloadFormat === 'pdf') {
      try {
        setIsExportingPdf(true);
        await exportScoresToPdf(getExportData());
        setConfirmDownloadFormat(null);
      } catch (err: any) {
        console.error('Failed to export PDF:', err);
        alert(`Failed to generate PDF file: ${err?.message || err}. Please check the browser console for details.`);
      } finally {
        setIsExportingPdf(false);
      }
    } else if (confirmDownloadFormat === 'excel') {
      try {
        setIsExporting(true);
        await exportScoresToExcel(getExportData());
        setConfirmDownloadFormat(null);
      } catch (err) {
        console.error('Failed to export Excel:', err);
        alert('Failed to generate Excel file.');
      } finally {
        setIsExporting(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="relative w-full max-w-[96vw] 2xl:max-w-[1640px] h-[95vh] max-h-[95vh] rounded-3xl bg-white dark:bg-[#0A0A0A] shadow-2xl border border-slate-200 dark:border-[#1A1A1A] flex flex-col overflow-hidden">
        {/* Fixed Top Header (Solid Opaque, Non-scrollable) */}
        {confirmDownloadFormat ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-[#1A1A1A] px-5 py-2.5 sm:py-3 flex-shrink-0 bg-white dark:bg-[#0A0A0A] z-20 animate-fade-in">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 uppercase">
                Full Export Preview — {confirmDownloadFormat === 'docx' ? 'Word Document (.docx)' : confirmDownloadFormat === 'pdf' ? 'PDF Document (.pdf)' : 'Excel Spreadsheet (.xlsx)'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDownloadFormat(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-[#1A1A1A] px-5 py-2.5 sm:py-3 flex-shrink-0 bg-white dark:bg-[#0A0A0A] z-20">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">EXPORT STUDENT SCORE SHEET</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSettings}
                className="rounded-xl bg-[var(--brand)] px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-white hover:bg-[var(--brand-dark)] transition shadow-xs cursor-pointer"
              >
                {showSettings ? 'Hide Template Details' : 'Edit Template Details'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-2.5 space-y-2.5 scroll-smooth">
          {/* Header Settings Form - Displayed at the Top */}
          {!confirmDownloadFormat && showSettings && (
            <div ref={settingsRef} className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50 dark:bg-[#0E0E0E] p-4 sm:p-5 space-y-6 text-xs animate-in fade-in duration-150 shadow-xs">
              {/* Section 1: HEADER */}
              <div className="pb-1">
                <div className="mb-4">
                  <span className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">
                    HEADER
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">DIVISION</label>
                    <input
                      type="text"
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">DISTRICT</label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">SCHOOL NAME</label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">SCHOOL ADDRESS</label>
                    <input
                      type="text"
                      value={schoolAddress}
                      onChange={(e) => setSchoolAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">DOCUMENT TITLE</label>
                    <input
                      type="text"
                      value={subjectTitle}
                      onChange={(e) => setSubjectTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">GRADE &amp; SECTION</label>
                    <input
                      type="text"
                      value={gradeSection}
                      onChange={(e) => setGradeSection(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">TASK TITLE</label>
                    <input
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">ASSESSMENT TYPE / PREFIX</label>
                    <select
                      value={selectedAssessmentType}
                      onChange={(e) => setSelectedAssessmentType(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs cursor-pointer"
                    >
                      <option value="">None (General Intervention Activity)</option>
                      <option value="MOSY">MOSY</option>
                      <option value="EOSY">EOSY</option>
                      <option value="ARAL Summer Assessment">ARAL Summer Assessment</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: WEEK & DATE (sectioned line) */}
              <div className="pt-5 border-t border-slate-200 dark:border-[#1A1A1A] pb-1">
                <div className="mb-4">
                  <span className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">
                    WEEK &amp; DATE
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-full sm:w-36">
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">WEEK NUMBER</label>
                    <input
                      type="text"
                      value={weekNumber}
                      onChange={(e) => setWeekNumber(e.target.value)}
                      placeholder="1, 2, 3..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div className="w-full sm:w-72">
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">DATE</label>
                    <input
                      type="text"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      placeholder="MM/DD/YYYY or Date Range"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: SIGNATURES (sectioned line) */}
              <div className="pt-5 border-t border-slate-200 dark:border-[#1A1A1A] pb-2">
                <div className="mb-4">
                  <span className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">
                    SIGNATURES
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">PREPARED BY (TUTOR NAME)</label>
                    <input
                      type="text"
                      value={tutorName}
                      onChange={(e) => setTutorName(e.target.value)}
                      placeholder="TUTOR FULL NAME"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">CHECKED BY (HT / ASST. NAME)</label>
                    <input
                      type="text"
                      value={checkedName}
                      onChange={(e) => setCheckedName(e.target.value)}
                      placeholder="FIRSTNAME M.I. LASTNAME"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">NOTED BY (PRINCIPAL NAME)</label>
                    <input
                      type="text"
                      value={notedName}
                      onChange={(e) => setNotedName(e.target.value)}
                      placeholder="FIRSTNAME M.I. LASTNAME"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Two-Column Body: Left (Controls + Calendar), Right (Fixed-Size Paper Sheet Preview) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Date Filter Bar, Calendar Picker & Paper Size (Hidden in Full Preview Confirmation Mode) */}
            {!confirmDownloadFormat && (
              <div className="lg:col-span-4 xl:col-span-3 2xl:col-span-3 space-y-2 lg:sticky lg:top-0">
              {/* Connected Date Filter & Calendar Container */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] shadow-sm overflow-hidden text-xs">
                {/* Connected Filter Bar Header */}
                <div className="bg-slate-50/80 dark:bg-[#0E0E0E] border-b border-slate-200 dark:border-[#1A1A1A] p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">SELECT DATE</span>
                  </div>
                  <div className="flex bg-white dark:bg-[#141414] border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 gap-1 shadow-2xs">
                    {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setExportMode(mode);
                          const now = new Date();
                          const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                          const currentMonth = todayKey.slice(0, 7);

                          if (mode === 'daily') {
                            setSelectedDateKey(todayKey);
                            setSelectedMonthKey(currentMonth);
                          } else if (mode === 'weekly') {
                            const targetWk = getWeekStartKey(now);
                            setSelectedWeekKey(targetWk);
                            setSelectedMonthKey(currentMonth);
                            const [y, m, d] = targetWk.split('-').map(Number);
                            setWeekNumber(String(computeWeekOfMonth(new Date(y, m - 1, d))));
                          } else if (mode === 'monthly') {
                            setSelectedMonthKey(currentMonth);
                          }
                        }}
                        className={`flex-1 rounded-lg h-7 py-1 px-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer text-center whitespace-nowrap flex items-center justify-center ${exportMode === mode
                          ? 'bg-[var(--brand)] text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                      >
                        {mode === 'daily' ? 'Day' : mode === 'weekly' ? 'Week' : 'Month'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs font-medium text-slate-600 px-1 pt-3">
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">WEEK:</span>
                      <input
                        type="text"
                        value={weekNumber}
                        onChange={(e) => setWeekNumber(e.target.value)}
                        className="w-5 py-0.5 text-left font-bold text-slate-800 dark:text-slate-100 bg-transparent border-0 p-0 text-xs focus:outline-none cursor-text"
                        title="Edit Week Number"
                        placeholder="1"
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0" title={dateStr}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">DATE:</span>
                      <span className="text-[10.5px] font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {dateStr}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Connected Calendar Picker Body */}
                <CalendarPicker
                  exportMode={exportMode}
                  selectedDateKey={selectedDateKey}
                  selectedWeekKey={selectedWeekKey}
                  selectedMonthKey={selectedMonthKey}
                  onSelectDate={(dKey) => {
                    setSelectedDateKey(dKey);
                    if (exportMode !== 'daily') setExportMode('daily');
                  }}
                  onSelectWeek={(wKey) => {
                    setSelectedWeekKey(wKey);
                    const [y, m, d] = wKey.split('-').map(Number);
                    setWeekNumber(String(computeWeekOfMonth(new Date(y, m - 1, d))));
                    if (exportMode !== 'weekly') setExportMode('weekly');
                  }}
                  onSelectMonth={(mKey) => {
                    setSelectedMonthKey(mKey);
                  }}
                  loggedDatesCount={loggedDatesCount}
                />
              </div>

              {/* Paper Size Selector */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50/80 dark:bg-[#0E0E0E] p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Paper Size</span>
                  <span className="text-[10px] font-bold text-[var(--brand)] dark:text-blue-400">
                    {PAPER_CONFIG[paperSize].label}
                  </span>
                </div>
                <div className="flex bg-white dark:bg-[#141414] border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 gap-1 shadow-2xs">
                  {(['letter', 'a4', 'folio'] as const).map((sizeKey) => (
                    <button
                      key={sizeKey}
                      type="button"
                      onClick={() => setPaperSize(sizeKey)}
                      title={PAPER_CONFIG[sizeKey].label}
                      className={`flex-1 rounded-lg h-7 py-1 px-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer text-center whitespace-nowrap flex items-center justify-center ${paperSize === sizeKey
                        ? 'bg-[var(--brand)] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                      {sizeKey === 'letter' ? 'Short' : sizeKey === 'a4' ? 'A4' : 'Long'}
                    </button>
                  ))}
                </div>
                </div>
              </div>
            )}

            {/* Right Column: Physical Paper Sheet Preview (Full Width in Confirmation Mode) */}
            <div className={confirmDownloadFormat ? "col-span-12 flex flex-col items-center justify-center min-w-0 animate-fade-in" : "lg:col-span-8 xl:col-span-9 2xl:col-span-9 flex flex-col min-w-0"}>
              {/* Paper Workspace Canvas */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-100/90 dark:bg-[#111111] p-4 sm:p-6 overflow-x-auto flex flex-col items-center shadow-inner">
                {/* Physical Sheet Card with Fixed Proportions */}
                <div
                  ref={printRef}
                  data-print-container="true"
                  style={{
                    width: PAPER_CONFIG[paperSize].width,
                    minHeight: PAPER_CONFIG[paperSize].minHeight,
                    fontFamily: "'Times New Roman', Times, Georgia, serif",
                    colorScheme: 'light',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    ['--slate-50' as any]: '#F8FAFC',
                    ['--slate-100' as any]: '#F1F5F9',
                    ['--slate-200' as any]: '#E2E8F0',
                    ['--slate-300' as any]: '#CBD5E1',
                    ['--slate-400' as any]: '#94A3B8',
                    ['--slate-500' as any]: '#64748B',
                    ['--slate-600' as any]: '#475569',
                    ['--slate-700' as any]: '#334155',
                    ['--slate-800' as any]: '#1E293B',
                    ['--slate-900' as any]: '#0F172A',
                  }}
                  className={`export-paper-sheet bg-white shadow-xl border border-slate-300 ${
                    isPreviewDense ? 'pt-8 pb-8' : isPreviewCompact ? 'pt-12 pb-12' : 'pt-20 pb-20'
                  } ${
                    exportMode === 'monthly' ? 'px-8 sm:px-10' : 'px-12 sm:px-16'
                  } text-slate-900 font-serif transition-all duration-200 flex-shrink-0`}
                >
                  {/* Header Section with Official Logos (Strictly Equidistant & Never Wrapping) */}
                  <div className="flex flex-nowrap items-center justify-center gap-5 sm:gap-7 pb-2 mx-auto w-full max-w-3xl">
                    {/* Left: DepEd Seal */}
                    <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                      <img
                        src={DEPED_LOGO_SRC}
                        alt="DepEd Logo"
                        className="w-16 h-16 sm:w-20 sm:h-20 object-contain select-none"
                      />
                    </div>

                    {/* Center: School Letterhead Metadata */}
                    <div className="text-center px-2 space-y-0.5 min-w-0 flex-shrink-0">
                      <p className="text-xs uppercase tracking-wider text-slate-600">{division}</p>
                      <p className="text-xs uppercase tracking-wider text-slate-600">{district}</p>
                      <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900 leading-tight">{schoolName}</h4>
                      <p className="text-xs text-slate-500">{schoolAddress}</p>
                    </div>

                    {/* Right: PNAHS School Seal */}
                    <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                      <img
                        src={PNAHS_LOGO_SRC}
                        alt="PNAHS Logo"
                        className="w-16 h-16 sm:w-20 sm:h-20 object-contain select-none"
                      />
                    </div>
                  </div>

                  <div className={`text-center ${isPreviewDense ? 'pt-1.5 pb-2' : 'pt-2.5 pb-3.5 sm:pb-4'}`}>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">{subjectTitle}</h3>
                    <p className="text-xs font-semibold text-slate-700">{gradeSection}</p>
                    {taskTitle && (
                      <p className="text-xs tracking-widest text-slate-600 uppercase mt-0.5">{taskTitle}</p>
                    )}
                  </div>

                  {/* Period Meta Row with WEEK: on the left and DATE: on the right */}
                  <div className={`flex justify-between items-center text-xs font-bold ${isPreviewDense ? 'mt-2.5 mb-2' : isPreviewCompact ? 'mt-4 mb-2.5' : 'mt-6 sm:mt-7 mb-3'} px-1 text-slate-900`}>
                    <div className="inline-flex items-center gap-1.5">
                      <span>WEEK:</span>
                      <div className="inline-flex flex-col items-center min-w-[50px]">
                        <span className="font-semibold text-slate-900 px-2 pb-0.5 leading-none">{weekNumber || '1'}</span>
                        <div className="w-full h-[1.5px] bg-slate-900" />
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <span>DATE:</span>
                      <div className="inline-flex flex-col items-center min-w-[140px]">
                        <span className="font-semibold text-slate-900 px-2 pb-0.5 leading-none">{dateStr || '_______'}</span>
                        <div className="w-full h-[1.5px] bg-slate-900" />
                      </div>
                    </div>
                  </div>

                  {/* DepEd Multi-Week Task Scores Table */}
                  <table className="w-full border-collapse border border-slate-800 text-xs table-fixed">
                    <colgroup>
                      <col style={{ width: colWidths.index }} />
                      <col style={{ width: colWidths.name }} />
                      {allEntryCols.map((_, cIdx) => (
                        <col key={`col-entry-${cIdx}`} style={{ width: colWidths.day }} />
                      ))}
                      <col style={{ width: colWidths.total }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50 text-slate-900">
                        <th
                          className={`border border-slate-800 px-0.5 ${isPreviewDense ? 'py-1' : isPreviewCompact ? 'py-1.5' : 'py-2.5'} text-center font-bold text-[10px] bg-slate-50 uppercase whitespace-nowrap align-middle`}
                          style={{ width: colWidths.index }}
                        >
                          #
                        </th>
                        <th
                          className={`border border-slate-800 px-2 ${isPreviewDense ? 'py-1' : isPreviewCompact ? 'py-1.5' : 'py-2.5'} text-center font-bold text-[10.5px] bg-slate-50 uppercase tracking-wide whitespace-nowrap align-middle`}
                          style={{ width: colWidths.name }}
                        >
                          NAME OF THE STUDENTS
                        </th>
                        {allEntryCols.map((col, cIdx) => (
                          <th
                            key={`session-date-head-${cIdx}`}
                            className={`border border-slate-800 px-0.5 ${isPreviewDense ? 'py-1' : isPreviewCompact ? 'py-1.5' : 'py-2.5'} text-center font-bold bg-slate-50 text-slate-900 whitespace-nowrap align-middle ${
                              allEntryCols.length > 8 ? 'text-[9px]' : allEntryCols.length > 5 ? 'text-[9.5px]' : 'text-[10px]'
                            }`}
                            style={{ width: colWidths.day }}
                            title={col.dateKey}
                          >
                            {formatSessionDateHeader(col.dateKey)}
                          </th>
                        ))}
                        <th
                          className={`border border-slate-800 px-1 ${isPreviewDense ? 'py-1' : isPreviewCompact ? 'py-1.5' : 'py-2.5'} text-center font-bold text-[10px] bg-slate-50 uppercase whitespace-nowrap align-middle`}
                          style={{ width: colWidths.total }}
                        >
                          TOTAL SCORE
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStudents.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2 + allEntryCols.length + 1}
                            className="border border-slate-800 py-6 text-center text-slate-500 italic"
                          >
                            No assigned students found.
                          </td>
                        </tr>
                      ) : (
                        sortedStudents.map((student, idx) => {
                          const studentName = formatStudentNameDepEd(student);
                          const row = studentExportRows[idx];
                          return (
                            <tr key={student.id} className="hover:bg-slate-50">
                              <td
                                className="border border-slate-800 px-0.5 text-center font-medium whitespace-nowrap"
                                style={{
                                  width: colWidths.index,
                                  fontSize: `${previewRowFontPx}px`,
                                  paddingTop: `${previewRowPadYPx}px`,
                                  paddingBottom: `${previewRowPadYPx}px`,
                                  lineHeight: isPreviewDense ? 1.15 : 1.3,
                                }}
                              >
                                {idx + 1}
                              </td>
                              <td
                                className="border border-slate-800 px-1.5 font-semibold uppercase text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis"
                                style={{
                                  width: colWidths.name,
                                  fontSize: `${previewRowFontPx}px`,
                                  paddingTop: `${previewRowPadYPx}px`,
                                  paddingBottom: `${previewRowPadYPx}px`,
                                  lineHeight: isPreviewDense ? 1.15 : 1.3,
                                }}
                              >
                                {studentName}
                              </td>
                              {allEntryCols.map((col, colIdx) => {
                                const val = row?.scores?.[colIdx];
                                return (
                                  <td
                                    key={`score-${student.id}-${col.dateKey}-${col.entryIndex}`}
                                    className="border border-slate-800 p-0 text-center font-bold whitespace-nowrap"
                                    style={{
                                      width: colWidths.day,
                                      fontSize: `${previewRowFontPx}px`,
                                      lineHeight: isPreviewDense ? 1.15 : 1.3,
                                    }}
                                  >
                                    {val !== undefined && val !== '' ? val : ''}
                                  </td>
                                );
                              })}
                              <td
                                className="border border-slate-800 p-0 text-center font-bold whitespace-nowrap"
                                style={{
                                  width: colWidths.total,
                                  fontSize: `${previewRowFontPx}px`,
                                  lineHeight: isPreviewDense ? 1.15 : 1.3,
                                }}
                              >
                                {row?.totalScore !== undefined && row?.totalScore !== '' ? row.totalScore : ''}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  {/* Footer Signatures (Order: 1. Line for signature, 2. Fullname below line, 3. Role below fullname) */}
                  <div className={`text-xs text-slate-900 ${isPreviewDense ? 'mt-4 space-y-3' : isPreviewCompact ? 'mt-6 space-y-4' : 'mt-10 space-y-7'}`}>
                    <div className="flex justify-end">
                      <div className="text-center w-64">
                        <p className={`italic text-left ${isPreviewDense ? 'mb-5' : isPreviewCompact ? 'mb-7' : 'mb-10'}`}>Prepared by:</p>
                        <div className="flex flex-col items-center w-full">
                          <div className="w-full h-[1.5px] bg-slate-900 mb-1" />
                          <span
                            className="font-bold uppercase tracking-wide text-slate-900 text-center leading-tight break-words w-full"
                            style={{ fontSize: previewTutorName.length > 26 ? '10px' : '11.5px' }}
                          >
                            {previewTutorName}
                          </span>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">{tutorTitle}</p>
                        </div>
                      </div>
                    </div>

                    <div className={`flex justify-between items-start ${isPreviewDense ? 'pt-2' : isPreviewCompact ? 'pt-3.5' : 'pt-5 sm:pt-6'}`}>
                      <div className="text-center w-60">
                        <p className={`italic text-left ${isPreviewDense ? 'mb-5' : isPreviewCompact ? 'mb-7' : 'mb-10'}`}>Checked:</p>
                        <div className="flex flex-col items-center w-full">
                          <div className="w-full h-[1.5px] bg-slate-900 mb-1" />
                          <span
                            className="font-bold uppercase tracking-wide text-slate-900 text-center leading-tight break-words w-full"
                            style={{ fontSize: (checkedName || '').length > 26 ? '10px' : '11.5px' }}
                          >
                            {checkedName}
                          </span>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">{checkedTitle}</p>
                        </div>
                      </div>

                      <div className="text-center w-60">
                        <p className={`italic text-left ${isPreviewDense ? 'mb-5' : isPreviewCompact ? 'mb-7' : 'mb-10'}`}>Noted:</p>
                        <div className="flex flex-col items-center w-full">
                          <div className="w-full h-[1.5px] bg-slate-900 mb-1" />
                          <span
                            className="font-bold uppercase tracking-wide text-slate-900 text-center leading-tight break-words w-full"
                            style={{ fontSize: (notedName || '').length > 26 ? '10px' : '11.5px' }}
                          >
                            {notedName}
                          </span>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">{notedTitle}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed, 100% Solid Opaque Footer for Save/Export / Confirmation Buttons */}
        {confirmDownloadFormat ? (
          <div className="flex-shrink-0 bg-white dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-[#1A1A1A] px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] animate-fade-in">
            <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100">{subjectTitle}</span>
              <span>•</span>
              <span className="font-semibold text-[var(--brand)]">
                {exportMode === 'weekly' ? `Week ${weekNumber || '1'} (${dateStr})` : exportMode === 'monthly' ? `Month (${selectedMonthKey})` : `Daily (${dateStr})`}
              </span>
              <span>•</span>
              <span>{sortedStudents.length} Student{sortedStudents.length !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span className="uppercase font-semibold text-slate-700 dark:text-slate-300">{PAPER_CONFIG[paperSize]?.label || paperSize}</span>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={isExporting || isExportingDocx || isExportingPdf}
                onClick={() => setConfirmDownloadFormat(null)}
                className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={isExporting || isExportingDocx || isExportingPdf}
                onClick={handleExecuteConfirmedDownload}
                className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-sm disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {(isExporting || isExportingDocx || isExportingPdf) ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating {confirmDownloadFormat === 'docx' ? '.docx' : confirmDownloadFormat === 'pdf' ? '.pdf' : '.xlsx'}...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Confirm Download {confirmDownloadFormat === 'docx' ? 'Document(.docx)' : confirmDownloadFormat === 'pdf' ? 'PDF(.pdf)' : 'Excel(.xlsx)'}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-shrink-0 bg-white dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-[#1A1A1A] px-5 py-2.5 flex flex-col sm:flex-row items-center justify-end gap-2 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleInitiateDownload('docx')}
              disabled={isExportingDocx || isExportingPdf || isExporting}
              className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              Download Document (.docx)
            </button>
            <button
              type="button"
              onClick={() => handleInitiateDownload('pdf')}
              disabled={isExportingDocx || isExportingPdf || isExporting}
              className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              Download PDF (.pdf)
            </button>
            <button
              type="button"
              onClick={() => handleInitiateDownload('excel')}
              disabled={isExportingDocx || isExportingPdf || isExporting}
              className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              Download Excel (.xlsx)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportScoreModal;
