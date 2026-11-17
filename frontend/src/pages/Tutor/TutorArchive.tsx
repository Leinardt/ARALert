import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, ChevronUp, ChevronDown, ArrowUpDown, CalendarDays, Check
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import type { SchoolYear, Grade, Attendance, User, TutorCohortHistoryData } from '../../types';
import { matchesSearch } from '../../utils/searchHelpers';
import { formatSessionLabel, getScoreDescription } from '../../utils/sessionDescriptionHelpers';
import { EntrySessionSeparator } from '../../components/EntrySessionSeparator';
import { SlidingPeriodToggle, useSlidingIndicator } from '../../components/SlidingTabs';
import { HistoryWeekDropdown } from '../../components/HistoryWeekDropdown';
import {
  generateSchoolYearWeeks,
  getSchoolYearWeekNumberForDate,
} from '../../config/academicConfig';

/* ─── Shared Custom Dropdown (Matches System FilterDropdowns) ────────── */
interface ArchiveFilterOption {
  value: string;
  label: string;
}

const ArchiveFilterDropdown: React.FC<{
  id: string;
  label: string;
  value: string;
  options: ArchiveFilterOption[];
  emptyLabel: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  alignRight?: boolean;
}> = ({ id, label, value, options, emptyLabel, onChange, disabled = false, alignRight = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];
  const displayLabel = selectedOption ? selectedOption.label : emptyLabel;
  const isDisabled = disabled || options.length === 0;

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`flex flex-col gap-1 relative min-w-0 ${isOpen ? 'z-50' : 'z-10'}`}>
      <label
        htmlFor={id}
        className="text-[10px] sm:text-[10.5px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider"
      >
        {label}
      </label>
      <button
        id={id}
        type="button"
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label}
        onClick={() => !isDisabled && setIsOpen((prev) => !prev)}
        title={displayLabel}
        className="w-full min-h-[40px] flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#141414] px-3 py-2 text-[11px] sm:text-sm font-bold text-gray-900 dark:text-slate-100 shadow-2xs transition hover:border-gray-300 dark:hover:border-[#2E2E2E] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
      >
        <span className="min-w-0 leading-snug break-words sm:truncate">{displayLabel}</span>
        <ChevronDown
          className={`shrink-0 h-4 w-4 text-gray-400 dark:text-slate-500 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </button>

      {isOpen && !isDisabled && (
        <div
          className={`animate-fade-in-scale origin-top absolute left-0 right-0 w-full max-w-full ${alignRight ? 'sm:left-auto sm:right-0' : 'sm:left-0 sm:right-auto'
            } sm:w-max sm:min-w-full sm:max-w-[480px] top-full z-50 mt-1.5 rounded-xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] shadow-xl overflow-hidden`}
        >
          <div
            role="listbox"
            aria-label={label}
            className="max-h-60 overflow-y-auto dropdown-scroll p-1.5 flex flex-col gap-0.5"
          >
            {options.map((opt) => {
              const isSelected = opt.value === selectedOption?.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 text-left rounded-lg px-2.5 sm:px-3 py-2 text-[11px] sm:text-sm font-semibold transition-colors cursor-pointer ${isSelected
                    ? 'bg-[var(--brand)] text-white'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                    }`}
                >
                  <span className="min-w-0 whitespace-normal sm:whitespace-nowrap break-words leading-snug">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1 sm:ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Date & Week Helper Functions (Mirrors TutorScores & TutorQRGenerator) ── */
const getWeekTitle = (
  mondayStr: string,
  schoolYear?: Partial<SchoolYear> | null,
  recordedDateKeys?: string[]
): string => {
  const weekNum = getSchoolYearWeekNumberForDate(mondayStr, schoolYear, recordedDateKeys);
  return `WEEK ${weekNum}`;
};

interface ArchiveSlidingTabOption<T extends string> {
  id: T;
  label: string;
  shortLabel?: string;
  title?: string;
}

/**
 * Variable-width segmented tab track with Data Analytics' gliding active pill.
 */
function ArchiveSlidingTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  containerClassName = '',
  buttonClassName = '',
}: {
  options: readonly ArchiveSlidingTabOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  containerClassName?: string;
  buttonClassName?: string;
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.id === value)
  );
  const { containerRef, setItemRef, pillStyle } = useSlidingIndicator(activeIndex, [
    options.map((opt) => `${opt.id}:${opt.label}:${opt.shortLabel || ''}`).join('|'),
  ]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`relative overflow-hidden p-0.5 bg-gray-100 dark:bg-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#222222] shadow-sm select-none ${containerClassName}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-0.5 bottom-0.5 left-0 rounded-sm bg-[var(--brand)] shadow-xs will-change-transform motion-reduce:transition-none ${pillStyle.animate
          ? 'transition-[transform,width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
          : ''
          } ${pillStyle.ready ? 'opacity-100' : 'opacity-0'}`}
        style={{
          width: `${pillStyle.width}px`,
          transform: `translate3d(${pillStyle.left}px, 0, 0)`,
        }}
      />
      {options.map((opt, index) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            ref={setItemRef(index)}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.id)}
            title={opt.title}
            className={`relative z-10 rounded-sm uppercase tracking-tight sm:tracking-wider transition-colors duration-200 cursor-pointer text-center whitespace-nowrap select-none ${buttonClassName} ${isActive
              ? 'text-white font-extrabold'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 font-bold'
              }`}
          >
            {opt.shortLabel ? (
              <>
                <span className="hidden min-[400px]:inline">{opt.label}</span>
                <span className="min-[400px]:hidden">{opt.shortLabel}</span>
              </>
            ) : (
              opt.label
            )}
          </button>
        );
      })}
    </div>
  );
}

const getWeekKey = (dateStr: string): string => {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString('en-CA');
};

const getMonthKey = (dateStr: string): string => dateStr.slice(0, 7);

const getMonthTitle = (monthKey: string): string => {
  const d = new Date(`${monthKey}-01T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
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

const formatDateButtonShort = (dateStr: string): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(d.getDate()).padStart(2, '0');
  return `${month} ${day}`;
};

const formatDateButtonFull = (dateStr: string): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(d.getDate()).padStart(2, '0');
  return `${weekday}, ${month} ${day}`;
};

const formatDateButtonLabel = formatDateButtonShort;

// Formats full date with weekday matching Score Entry and Attendance History: "October 29, 2026 | Thursday"
const formatDateString = (value: string | null | undefined): string => {
  if (!value) return '—';
  try {
    const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year} | ${weekday}`;
  } catch {
    return value;
  }
};

// Formats time strings to 12-hour AM/PM: "1:23 PM" or "8:29 AM"
const formatTimeString = (value: string | null | undefined): string => {
  if (!value || value === '—') return '—';
  try {
    const timeParts = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeParts) {
      let hours = parseInt(timeParts[1], 10);
      const minutes = timeParts[2];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm}`;
    }
    const date = new Date(value.includes('T') || value.includes(' ') ? value : `1970-01-01T${value}`);
    if (!Number.isNaN(date.getTime())) {
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes} ${ampm}`;
    }
    return value;
  } catch {
    return value;
  }
};

// Helper to format clean Grade - Section (e.g., "Grade 7 - Mango") avoiding duplicate "Grade" or trailing "- Section"
const formatStudentClassSection = (st: User | undefined | null): string => {
  if (!st) return 'Grade 7 - Mango';
  const rawGrade = (st.grade_level || '').trim();
  const rawSec = (st.section || '').trim();

  if (rawGrade.includes(' - ')) {
    const parts = rawGrade.split(' - ');
    const gPart = parts[0].trim();
    const sPart = parts[1].trim();
    const cleanG = gPart.toLowerCase().startsWith('grade') ? gPart : `Grade ${gPart}`;
    return `${cleanG} - ${sPart}`;
  }

  const gMatch = rawGrade.match(/\d+/);
  const gradeNum = gMatch ? gMatch[0] : '7';
  const cleanGrade = `Grade ${gradeNum}`;
  const cleanSec = rawSec && rawSec.toLowerCase() !== 'section' ? rawSec : 'Mango';
  return `${cleanGrade} - ${cleanSec}`;
};

const getSemesterFromRecord = (periodOrSubj?: string | null, dateStr?: string | null): '1st' | '2nd' | 'summer' => {
  const text = (periodOrSubj || '').toLowerCase();
  if (text.includes('summer')) return 'summer';
  if (text.includes('2nd') || text.includes('eosy') || text.includes('q3') || text.includes('q4')) return '2nd';
  if (text.includes('1st') || text.includes('mosy') || text.includes('q1') || text.includes('q2')) return '1st';

  if (dateStr) {
    const month = parseInt(dateStr.slice(5, 7), 10);
    if (month >= 6 && month <= 7) return 'summer';
    if (month >= 1 && month <= 5) return '2nd';
    return '1st';
  }
  return '1st';
};

/* ─── Sortable Column Header Component ─────────────────────────────── */
interface SortableHeaderProps {
  label: string;
  field: string;
  currentField: string;
  direction: 'asc' | 'desc';
  onSort: (field: string) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  field,
  currentField,
  direction,
  onSort,
  align = 'left',
  className = '',
}) => {
  const isActive = currentField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1.5 transition-colors hover:text-gray-900 dark:hover:text-slate-100 select-none text-[10.5px] font-extrabold uppercase tracking-wider ${align === 'center' ? 'justify-center w-full' : align === 'right' ? 'justify-end w-full' : 'text-left'
        } ${isActive ? 'text-gray-900 dark:text-slate-100' : 'text-gray-600 dark:text-slate-300'
        } ${className} cursor-pointer`}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      {isActive ? (
        direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
      ) : (
        <ArrowUpDown className="w-3.5 h-3.5 opacity-40 shrink-0" />
      )}
    </button>
  );
};

/* ─── Record Interfaces ────────────────────────────────────────────── */
interface ConcludedScoreRecord {
  id: string | number;
  studentId: string;
  studentName: string;
  lrn: string;
  classSection: string;
  activityTitle: string;
  isAssessment: boolean;
  scoreVal: number;
  totalScore: number;
  scoreDisplay: string;
  scorePct: number;
  remarks: string;
  status: string;
  date: string;
  time: string;
}

interface ConcludedAttendanceRecord {
  id: string | number;
  studentId: string;
  studentName: string;
  lrn: string;
  classSection: string;
  date: string;
  timeIn: string;
  timeOut: string;
  status: string;
  session: string;
}

interface ArchiveTableGroup<T> {
  key: string;
  title: string;
  weekMonday?: string;
  isMonthGroup?: boolean;
  records: T[];
}

/* ─── Main TutorArchive Component ──────────────────────────────────── */
export const TutorArchive: React.FC = () => {
  const { user } = useAuth();

  // Top Filter Selectors State
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [currentSchoolYear, setCurrentSchoolYear] = useState<SchoolYear | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<'1st' | '2nd' | 'summer'>('1st');
  const [selectedClass, setSelectedClass] = useState<string>('');

  // Record View Switcher State: 'scores' | 'attendance'
  const [recordType, setRecordType] = useState<'scores' | 'attendance'>('scores');

  // Sub-filter for Score Records: 'all' | 'intervention' | 'assessment'
  const [activityFilter, setActivityFilter] = useState<'all' | 'intervention' | 'assessment'>('all');

  // Table Control State (Search, View Mode, Selected Week & Date)
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [selectedWeekMonday, setSelectedWeekMonday] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Sorting State
  const [scoreSortField, setScoreSortField] = useState<string>('studentName');
  const [scoreSortDir, setScoreSortDir] = useState<'asc' | 'desc'>('asc');

  const [attSortField, setAttSortField] = useState<string>('studentName');
  const [attSortDir, setAttSortDir] = useState<'asc' | 'desc'>('asc');

  // Data State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cohortHistory, setCohortHistory] = useState<TutorCohortHistoryData | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);

  // 1. Initial Load of School Years and Current System State
  useEffect(() => {
    let mounted = true;
    const fetchInitialMeta = async () => {
      try {
        const [sys, cur] = await Promise.all([
          academicService.getSchoolYears(),
          academicService.getCurrentSchoolYear().catch(() => null),
        ]);
        if (!mounted) return;

        setCurrentSchoolYear(cur);

        // Include current active school year and historical archived school years
        const allYears: SchoolYear[] = [];
        if (cur) {
          allYears.push(cur);
        }
        (sys || []).forEach((y) => {
          if (!allYears.some((ay) => ay.school_year === y.school_year)) {
            allYears.push(y);
          }
        });

        setSchoolYears(allYears);
        setSelectedSchoolYear(cur?.school_year || allYears[0]?.school_year || '2026-2027');
      } catch (err) {
        console.error('Failed to fetch school years:', err);
      }
    };

    fetchInitialMeta();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Compute Available Concluded Semesters for the Selected School Year
  const availableSemesters = useMemo<Array<{ id: '1st' | '2nd' | 'summer'; label: string }>>(() => {
    if (!selectedSchoolYear) return [];
    const isSelectedYearActive =
      (selectedSchoolYear === currentSchoolYear?.school_year && Boolean(currentSchoolYear?.is_active)) ||
      Boolean(schoolYears.find((y) => y.school_year === selectedSchoolYear)?.is_active);

    if (!isSelectedYearActive) {
      return [
        { id: '1st', label: '1st Semester — MOSY (Q1 & Q2 • Middle of School Year)' },
        { id: '2nd', label: '2nd Semester — EOSY (Q3 & Q4 • End of School Year)' },
        { id: 'summer', label: 'Summer Remediation (Midyear)' },
      ];
    }

    const curSem = currentSchoolYear?.current_semester || '2nd';
    if (curSem === '2nd') {
      return [{ id: '1st', label: '1st Semester — MOSY (Q1 & Q2 • Middle of School Year)' }];
    }
    if (curSem === 'summer') {
      return [
        { id: '1st', label: '1st Semester — MOSY (Q1 & Q2 • Middle of School Year)' },
        { id: '2nd', label: '2nd Semester — EOSY (Q3 & Q4 • End of School Year)' },
      ];
    }
    return [];
  }, [schoolYears, selectedSchoolYear, currentSchoolYear]);

  // Ensure selected semester is always an available concluded semester
  useEffect(() => {
    if (availableSemesters.length > 0) {
      if (!availableSemesters.some((s) => s.id === selectedSemester)) {
        setSelectedSemester(availableSemesters[0].id);
      }
    }
  }, [availableSemesters, selectedSemester]);

  // 3. Fetch Data when School Year Changes
  useEffect(() => {
    if (!user?.id || !selectedSchoolYear || availableSemesters.length === 0) {
      setCohortHistory(null);
      setGrades([]);
      setAttendance([]);
      setAllStudents([]);
      setIsLoading(false);
      return;
    }
    let mounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const [historyData, gradesData, attendanceData, studentsData] = await Promise.all([
          academicService.getTutorCohortHistory(String(user.id), selectedSchoolYear).catch(() => null),
          academicService.getGrades().catch(() => [] as Grade[]),
          academicService.getAttendanceHistory().catch(() => [] as Attendance[]),
          userService.getAllUsers({ role: 'student', include_graduated: true }).catch(() => [] as User[]),
        ]);

        if (mounted) {
          setCohortHistory(historyData);
          setGrades(gradesData);
          setAttendance(attendanceData);
          setAllStudents(studentsData);
        }
      } catch (err) {
        console.error('Failed to load archive data:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [user?.id, selectedSchoolYear]);

  // Student directory map
  const studentMap = useMemo(() => {
    const map = new Map<string, User>();
    for (const s of allStudents) {
      map.set(String(s.id), s);
    }
    return map;
  }, [allStudents]);

  // Dynamic Assessment Name for the Selected Semester
  const assessmentFilterName = useMemo(() => {
    if (selectedSemester === '1st') return 'MOSY ASSESSMENT';
    if (selectedSemester === '2nd') return 'EOSY ASSESSMENT';
    return 'SUMMER ASSESSMENT';
  }, [selectedSemester]);

  // 4. Compute Handled Classes for the Selected School Year and Concluded Semester
  const handledClasses = useMemo(() => {
    const classes = new Set<string>();

    // From tutor assignment past records
    if (cohortHistory?.past_records) {
      for (const rec of cohortHistory.past_records) {
        if (rec.school_year === selectedSchoolYear) {
          const sem = getSemesterFromRecord(rec.period, rec.start_date);
          if (sem === selectedSemester) {
            const st = studentMap.get(rec.student_id);
            if (st) {
              classes.add(formatStudentClassSection(st));
            }
          }
        }
      }
    }

    // From grades logged for this tutor in the concluded semester
    for (const g of grades) {
      const gDate = g.date_logged ? g.date_logged.slice(0, 10) : '';
      const sem = getSemesterFromRecord(g.subject, gDate);
      if (sem === selectedSemester) {
        const sid = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
        const st = studentMap.get(String(sid));
        if (st) {
          classes.add(formatStudentClassSection(st));
        }
      }
    }

    // From attendance logged for this tutor's students in the concluded semester
    for (const a of attendance) {
      const sem = getSemesterFromRecord(null, a.date);
      if (sem === selectedSemester) {
        const uid = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
        const st = studentMap.get(String(uid));
        if (st) {
          classes.add(formatStudentClassSection(st));
        }
      }
    }

    return Array.from(classes).sort();
  }, [cohortHistory, grades, attendance, studentMap, selectedSchoolYear, selectedSemester]);

  // Always default selected class to the first available handled class (no "all" option)
  useEffect(() => {
    if (handledClasses.length > 0) {
      if (!selectedClass || !handledClasses.includes(selectedClass)) {
        setSelectedClass(handledClasses[0]);
      }
    } else {
      setSelectedClass('');
    }
  }, [handledClasses, selectedClass]);

  // 5. Build Concluded Score Records
  const scoreRecords = useMemo(() => {
    const list: ConcludedScoreRecord[] = [];

    for (const g of grades) {
      const gDate = g.date_logged ? g.date_logged.slice(0, 10) : '';
      const sem = getSemesterFromRecord(g.subject, gDate);
      if (sem !== selectedSemester) continue;

      const sid = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
      const st = studentMap.get(String(sid));
      const sName = st ? `${st.last_name ? st.last_name.toUpperCase() + ', ' : ''}${st.first_name || ''} ${st.middle_name ? st.middle_name.charAt(0) + '.' : ''}`.trim() : (g.student_name || 'Student');
      const lrn = st?.lrn || (g as any).student_lrn || '—';
      const classSec = formatStudentClassSection(st);

      const total = Number(g.total_score) || 100;
      const scoreVal = Number(g.score) || 0;
      const pct = total > 0 ? Math.round((scoreVal / total) * 1000) / 10 : 0;
      const isNotTaken = (g.remarks || '').trim().toLowerCase() === 'not taken';
      const isPassed = !isNotTaken && (pct >= 70 || (g.remarks || '').toLowerCase().includes('pass'));

      const subjUpper = (g.subject || '').toUpperCase();
      const isAssessment = subjUpper.includes('MOSY') || subjUpper.includes('EOSY') || subjUpper.includes('SUMMER') || subjUpper.includes('ASSESSMENT');

      list.push({
        id: g.id,
        studentId: String(sid),
        studentName: sName || 'Unknown Student',
        lrn,
        classSection: classSec,
        activityTitle: g.subject || 'Intervention Activity',
        isAssessment,
        scoreVal,
        totalScore: total,
        scoreDisplay: `${scoreVal.toFixed(2)} / ${total.toFixed(2)}`,
        scorePct: pct,
        remarks: isNotTaken ? 'Not Taken' : isPassed ? 'Passed' : 'Failed',
        status: isNotTaken ? 'Not Taken' : 'Taken',
        date: gDate,
        time: formatTimeString(g.created_at),
      });
    }

    return list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }, [grades, studentMap, selectedSemester]);

  // 6. Build Concluded Attendance Records
  const attendanceRecords = useMemo(() => {
    const list: ConcludedAttendanceRecord[] = [];

    for (const a of attendance) {
      const sem = getSemesterFromRecord(null, a.date);
      if (sem !== selectedSemester) continue;

      const uid = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
      const st = studentMap.get(String(uid));
      const sName = st ? `${st.last_name ? st.last_name.toUpperCase() + ', ' : ''}${st.first_name || ''} ${st.middle_name ? st.middle_name.charAt(0) + '.' : ''}`.trim() : (a.user_name || 'Student');
      const lrn = st?.lrn || '—';
      const classSec = formatStudentClassSection(st);

      list.push({
        id: a.id,
        studentId: String(uid),
        studentName: sName || 'Unknown Student',
        lrn,
        classSection: classSec,
        date: a.date || '',
        timeIn: formatTimeString(a.time_in),
        timeOut: formatTimeString(a.time_out),
        status: a.status_display || a.status || 'Present',
        session: 'Session',
      });
    }

    return list.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }, [attendance, studentMap, selectedSemester]);

  // 7. Base Filtered Records (Strictly filtered by selected handled class, sub-filter, and search)
  const baseScores = useMemo(() => {
    return scoreRecords.filter((rec) => {
      if (selectedClass && rec.classSection !== selectedClass) return false;
      if (activityFilter === 'intervention' && rec.isAssessment) return false;
      if (activityFilter === 'assessment' && !rec.isAssessment) return false;
      if (studentSearch.trim()) {
        return matchesSearch(studentSearch, rec.studentName, rec.lrn, rec.activityTitle, rec.remarks);
      }
      return true;
    });
  }, [scoreRecords, selectedClass, activityFilter, studentSearch]);

  const baseAttendance = useMemo(() => {
    return attendanceRecords.filter((rec) => {
      if (selectedClass && rec.classSection !== selectedClass) return false;
      if (studentSearch.trim()) {
        return matchesSearch(studentSearch, rec.studentName, rec.lrn, rec.status, rec.session);
      }
      return true;
    });
  }, [attendanceRecords, selectedClass, studentSearch]);

  // 8. Most Recent Date, School Year Weeks & selectedDate state management
  const mostRecentScoreDate = useMemo(() => {
    if (baseScores.length === 0) return null;
    return baseScores[0].date || null;
  }, [baseScores]);

  const mostRecentAttDate = useMemo(() => {
    if (baseAttendance.length === 0) return null;
    return baseAttendance[0].date || null;
  }, [baseAttendance]);

  const selectedSchoolYearObj = useMemo(
    () => schoolYears.find((sy) => sy.school_year === selectedSchoolYear) || currentSchoolYear,
    [schoolYears, selectedSchoolYear, currentSchoolYear]
  );

  const recordedArchiveDateKeys = useMemo(() => {
    const set = new Set<string>();
    const activeList = recordType === 'scores' ? baseScores : baseAttendance;
    activeList.forEach((r) => {
      if (r.date) set.add(r.date);
    });
    return Array.from(set);
  }, [recordType, baseScores, baseAttendance]);

  const schoolYearWeeks = useMemo(
    () => generateSchoolYearWeeks(selectedSchoolYearObj, recordedArchiveDateKeys),
    [selectedSchoolYearObj, recordedArchiveDateKeys]
  );

  const recordedArchiveWeekKeys = useMemo(
    () => new Set(recordedArchiveDateKeys.map((d) => getWeekKey(d))),
    [recordedArchiveDateKeys]
  );

  useEffect(() => {
    if (schoolYearWeeks.length === 0) return;
    const mostRecent = recordType === 'scores' ? mostRecentScoreDate : mostRecentAttDate;
    setSelectedWeekMonday((prev) => {
      if (
        prev &&
        schoolYearWeeks.some((w) => w.weekKey === prev) &&
        (recordedArchiveWeekKeys.size === 0 || recordedArchiveWeekKeys.has(prev))
      ) {
        return prev;
      }
      if (mostRecent) {
        const recentMon = getWeekKey(mostRecent);
        if (schoolYearWeeks.some((w) => w.weekKey === recentMon)) {
          return recentMon;
        }
      }
      return schoolYearWeeks[schoolYearWeeks.length - 1].weekKey;
    });
  }, [schoolYearWeeks, recordedArchiveWeekKeys, recordType, mostRecentScoreDate, mostRecentAttDate]);

  const selectedWeekOption = useMemo(
    () => schoolYearWeeks.find((w) => w.weekKey === selectedWeekMonday) || schoolYearWeeks[schoolYearWeeks.length - 1] || null,
    [schoolYearWeeks, selectedWeekMonday]
  );

  useEffect(() => {
    if (viewMode === 'week' && selectedWeekOption) {
      const activeList = recordType === 'scores' ? baseScores : baseAttendance;
      const firstMatchInWeek = activeList.find(
        (r) => r.date && getWeekKey(r.date) === selectedWeekOption.weekKey
      );
      setSelectedDate(firstMatchInWeek ? firstMatchInWeek.date : selectedWeekOption.weekKey);
    } else {
      const mostRecent = recordType === 'scores' ? mostRecentScoreDate : mostRecentAttDate;
      setSelectedDate(mostRecent);
    }
  }, [viewMode, selectedWeekOption, recordType, baseScores, baseAttendance, mostRecentScoreDate, mostRecentAttDate]);

  // 9. Table Groups (Week dropdown and Month grouping matching TutorScores & TutorQRGenerator)
  const buildArchiveTableGroups = <T extends { date: string }>(records: T[]): ArchiveTableGroup<T>[] => {
    if (viewMode === 'week' && selectedWeekOption) {
      const weekRecords = records.filter(
        (r) => r.date && getWeekKey(r.date) === selectedWeekOption.weekKey
      );
      return [{
        key: selectedWeekOption.weekKey,
        title: selectedWeekOption.label.toUpperCase(),
        weekMonday: selectedWeekOption.weekKey,
        isMonthGroup: false,
        records: weekRecords,
      }];
    }

    const groups = new Map<string, T[]>();
    records.forEach((record) => {
      if (!record.date) return;
      const key = viewMode === 'week' ? getWeekKey(record.date) : getMonthKey(record.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(record);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, groupRecords]) => ({
        key,
        title: viewMode === 'week'
          ? getWeekTitle(key, selectedSchoolYearObj, recordedArchiveDateKeys)
          : getMonthTitle(key),
        weekMonday: viewMode === 'week' ? key : undefined,
        isMonthGroup: viewMode === 'month',
        records: groupRecords,
      }));
  };

  const scoreTableGroups = useMemo(
    () => buildArchiveTableGroups(baseScores),
    [viewMode, selectedWeekOption, baseScores, selectedSchoolYearObj, recordedArchiveDateKeys]
  );

  const attendanceTableGroups = useMemo(
    () => buildArchiveTableGroups(baseAttendance),
    [viewMode, selectedWeekOption, baseAttendance, selectedSchoolYearObj, recordedArchiveDateKeys]
  );

  // Sort Handlers
  const handleToggleScoreSort = (field: string) => {
    if (scoreSortField === field) setScoreSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setScoreSortField(field);
      setScoreSortDir('asc');
    }
  };

  const handleToggleAttSort = (field: string) => {
    if (attSortField === field) setAttSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setAttSortField(field);
      setAttSortDir('asc');
    }
  };

  const sortScoreList = (list: ConcludedScoreRecord[]) => {
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (scoreSortField === 'studentName') cmp = a.studentName.localeCompare(b.studentName);
      else if (scoreSortField === 'activityTitle') cmp = a.activityTitle.localeCompare(b.activityTitle);
      else if (scoreSortField === 'score') cmp = a.scorePct - b.scorePct;
      else if (scoreSortField === 'remarks') cmp = a.remarks.localeCompare(b.remarks);
      else if (scoreSortField === 'status') cmp = a.status.localeCompare(b.status);
      else if (scoreSortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (scoreSortField === 'time') cmp = a.time.localeCompare(b.time);
      return scoreSortDir === 'asc' ? cmp : -cmp;
    });
  };

  const sortAttendanceList = (list: ConcludedAttendanceRecord[]) => {
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (attSortField === 'studentName') cmp = a.studentName.localeCompare(b.studentName);
      else if (attSortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (attSortField === 'time') cmp = a.timeIn.localeCompare(b.timeIn);
      else if (attSortField === 'status') cmp = a.status.localeCompare(b.status);
      return attSortDir === 'asc' ? cmp : -cmp;
    });
  };

  const totalRecordsCount = recordType === 'scores' ? baseScores.length : baseAttendance.length;

  return (
    <div className="flex flex-col gap-3.5 sm:gap-5 p-2.5 sm:p-6 max-w-7xl mx-auto w-full" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Concluded Cohort Selection Card ── */}
      <div className="relative z-20 w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 sm:px-4 sm:py-3.5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
          {/* 1. School Year Selector */}
          <div className="sm:col-span-3 min-w-0">
            <ArchiveFilterDropdown
              id="archive-sy-select"
              label="School Year"
              value={selectedSchoolYear}
              options={schoolYears.map((sy) => ({
                value: sy.school_year,
                label: `SY ${sy.school_year}`,
              }))}
              emptyLabel="No Concluded School Years"
              onChange={(val) => setSelectedSchoolYear(val)}
            />
          </div>

          {/* 2. Concluded Semester Selector */}
          <div className="sm:col-span-6 min-w-0">
            <ArchiveFilterDropdown
              id="archive-semester-select"
              label="Concluded Semester"
              value={availableSemesters.length === 0 ? '' : selectedSemester}
              options={availableSemesters.map((s) => ({
                value: s.id,
                label: s.label,
              }))}
              emptyLabel="No Concluded Semesters"
              onChange={(val) => setSelectedSemester(val as any)}
              disabled={availableSemesters.length === 0}
            />
          </div>

          {/* 3. Handled Classes Selector */}
          <div className="sm:col-span-3 min-w-0">
            <ArchiveFilterDropdown
              id="archive-class-select"
              label="Handled Classes"
              value={handledClasses.length === 0 ? '' : selectedClass}
              options={handledClasses.map((cls) => ({
                value: cls,
                label: cls,
              }))}
              emptyLabel="No Handled Classes"
              onChange={(val) => setSelectedClass(val)}
              disabled={handledClasses.length === 0}
              alignRight
            />
          </div>
        </div>
      </div>

      {/* ── Record Type Switcher (Score Records or Attendance Records) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
        {/* Two Filters: SCORE RECORDS or ATTENDANCE RECORDS */}
        <ArchiveSlidingTabs
          ariaLabel="Archive record type"
          value={recordType}
          onChange={setRecordType}
          containerClassName="grid grid-cols-2 w-full sm:w-auto sm:inline-grid"
          buttonClassName="min-w-0 py-1.5 px-1.5 sm:px-3.5 text-[10px] min-[375px]:text-[11px] sm:text-xs"
          options={[
            { id: 'scores', label: 'SCORE RECORDS' },
            { id: 'attendance', label: 'ATTENDANCE RECORDS' },
          ]}
        />

        {/* Sub-filter for Score Records: ALL / INTERVENTION ACTIVITY / (MOSY/EOSY/SUMMER) */}
        {recordType === 'scores' && (
          <ArchiveSlidingTabs
            ariaLabel="Score record activity filter"
            value={activityFilter}
            onChange={setActivityFilter}
            containerClassName="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-0.5 sm:inline-flex"
            buttonClassName="px-2 sm:px-3.5 py-1.5 text-[10px] min-[375px]:text-[11px] sm:text-xs shrink-0"
            options={[
              { id: 'all', label: 'ALL' },
              {
                id: 'intervention',
                label: 'INTERVENTION ACTIVITY',
                shortLabel: 'INTERVENTION',
                title: 'Intervention Activity',
              },
              {
                id: 'assessment',
                label:
                  selectedSemester === '1st'
                    ? 'MOSY ASSESSMENT (Q1 & Q2)'
                    : selectedSemester === '2nd'
                      ? 'EOSY ASSESSMENT (Q3 & Q4)'
                      : assessmentFilterName,
                shortLabel: assessmentFilterName.replace(' ASSESSMENT', ''),
                title:
                  selectedSemester === '1st'
                    ? 'MOSY Assessment (Middle of School Year • Q1 & Q2)'
                    : selectedSemester === '2nd'
                      ? 'EOSY Assessment (End of School Year • Q3 & Q4)'
                      : 'Summer Assessment (Midyear)',
              },
            ]}
          />
        )}
      </div>

      {/* ── Table Container ── */}
      <div className="bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A] shadow-sm overflow-hidden">
    {/* Table Top Controls Bar (No Export Button) */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
      <div>
        <h2 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-slate-100 uppercase tracking-wider">
          {recordType === 'scores' ? 'CONCLUDED SEMESTER SCORE RECORDS' : 'CONCLUDED SEMESTER ATTENDANCE RECORDS'}
        </h2>
        <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
          {totalRecordsCount} Record{totalRecordsCount !== 1 ? 's' : ''} in historical archive
        </p>
      </div>

      <div className="flex flex-row items-center gap-1.5 sm:gap-2 w-full sm:w-auto min-w-0">
        {/* Search Input - Shares row with WEEK/MONTH toggle on mobile */}
        <div className="relative flex-1 min-w-0 sm:flex-initial sm:w-60">
          <Search className="pointer-events-none absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="search"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            placeholder="Search Student Name"
            className="h-8 w-full rounded-md border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#141414] pl-8 sm:pl-9 pr-2.5 sm:pr-3 text-[11px] sm:text-xs font-bold text-gray-900 dark:text-slate-100 outline-none transition placeholder:text-gray-400 placeholder:font-normal focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#111111]"
          />
        </div>

        {/* View Mode Toggle: WEEK / MONTH */}
        <div className="flex items-center shrink-0">
          <SlidingPeriodToggle
            options={['week', 'month'] as const}
            value={viewMode}
            onChange={(mode) => setViewMode(mode)}
            ariaLabel="Archive records view period"
            className="h-8 bg-gray-100 dark:bg-[#1A1A1A]"
            buttonClassName="h-7 px-2 sm:px-3 text-[9.5px] sm:text-[10.5px] font-extrabold"
          />
        </div>
      </div>
    </div>

    {/* Loading and Empty States */}
    {isLoading ? (
      <div className="p-12 text-center text-xs text-slate-500 dark:text-zinc-400">
        Loading historical archive records...
      </div>
    ) : totalRecordsCount === 0 ? (
      <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
        <CalendarDays className="w-10 h-10 text-slate-300 dark:text-zinc-700" />
        <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
          No historical records found for this concluded semester.
        </p>
        <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-md">
          {studentSearch.trim()
            ? 'Try a different student name search filter.'
            : 'Only concluded semester records are preserved in the archive. Current semester data is not archived.'}
        </p>
      </div>
    ) : recordType === 'scores' ? (
      /* ─── SCORES ACCORDION SECTIONS (WEEK / MONTH) ─── */
      <div className="p-2 sm:p-5 space-y-6">
        {scoreTableGroups.map((group) => {
          const datesWithRecords = new Set(group.records.map((r) => r.date));
          const groupDates = group.isMonthGroup
            ? Array.from(datesWithRecords).sort()
            : getWeekdaysForMonday(group.weekMonday || group.key, Array.from(datesWithRecords));

          const isOpen = Boolean(selectedDate && groupDates.includes(selectedDate));
          const displayRecords = selectedDate && isOpen
            ? group.records.filter((r) => r.date === selectedDate)
            : group.records;

          // Group display records by Session / Activity
          const sessionMap = new Map<string, ConcludedScoreRecord[]>();
          displayRecords.forEach((r) => {
            const label = formatSessionLabel(getScoreDescription({ subject: r.activityTitle }));
            const time = r.time && r.time !== '—' ? r.time : '';
            const key = `${label}|${time}`;
            if (!sessionMap.has(key)) sessionMap.set(key, []);
            sessionMap.get(key)!.push(r);
          });

          const sessions = Array.from(sessionMap.entries()).map(([key, sRows]) => {
            const [label, time] = key.split('|');
            return { key, label, time: time || null, rows: sortScoreList(sRows) };
          });

          const renderScoreDateButton = (dateStr: string) => {
            const hasRecord = datesWithRecords.has(dateStr);
            const isSelected = selectedDate === dateStr;
            const fullLabel = formatDateButtonFull(dateStr);
            const shortLabel = formatDateButtonShort(dateStr);
            const dateRows = group.records.filter((r) => r.date === dateStr);
            const hasMilestone = dateRows.some((r) => r.isAssessment);

            return (
              <button
                key={dateStr}
                type="button"
                disabled={!hasRecord}
                onClick={() => setSelectedDate(dateStr)}
                className={`${group.isMonthGroup
                  ? 'shrink-0 px-1.5 sm:px-3 text-[9px] sm:text-[11px]'
                  : 'flex-1 min-w-0 sm:flex-initial sm:w-auto px-0.5 sm:px-3 text-[8.5px] min-[375px]:text-[9.5px] sm:text-[11px] tracking-tight sm:tracking-normal justify-center'
                  } h-7 sm:h-7.5 whitespace-nowrap rounded-md font-bold uppercase transition-all inline-flex items-center gap-0.5 sm:gap-1 ${hasRecord
                    ? isSelected
                      ? 'bg-[var(--brand)] text-white shadow-xs font-bold border border-[var(--brand)] cursor-pointer'
                      : hasMilestone
                        ? 'bg-sky-50 text-sky-700 border border-sky-300 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60 cursor-pointer font-semibold'
                        : 'bg-blue-50/80 text-[var(--brand)] border border-blue-200/80 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 dark:hover:bg-blue-900/50 cursor-pointer font-semibold'
                    : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-[#222222] cursor-not-allowed opacity-50'
                  }`}
                title={
                  hasRecord
                    ? isSelected
                      ? `Active: ${fullLabel}`
                      : `View ${fullLabel}${hasMilestone ? ' (Milestone Assessment)' : ''}`
                    : `No records on ${fullLabel}`
                }
                aria-label={fullLabel}
              >
                {hasMilestone && (
                  <span className={`h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full shrink-0 ${isSelected ? 'bg-sky-200' : 'bg-[#0284C7] dark:bg-[#38BDF8]'}`} />
                )}
                {group.isMonthGroup ? (
                  <span>{shortLabel}</span>
                ) : (
                  <>
                    <span className="hidden sm:inline">{fullLabel}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                  </>
                )}
              </button>
            );
          };

          return (
            <div key={group.key} className="space-y-3">
              {/* Group Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-2.5 pt-1 pb-2.5 border-b border-gray-100 dark:border-[#1A1A1A]">
                <div
                  className={
                    group.isMonthGroup
                      ? 'flex flex-wrap items-center gap-1 sm:gap-1.5 min-w-0 w-full sm:w-auto py-0.5'
                      : 'flex flex-row items-center gap-1 sm:gap-3 min-w-0 w-full sm:w-auto'
                  }
                >
                  <div className={`flex items-center py-0.5 shrink-0 ${group.isMonthGroup ? 'mr-1 sm:mr-1.5' : ''}`}>
                    {!group.isMonthGroup && schoolYearWeeks.length > 0 ? (
                      <HistoryWeekDropdown
                        weeks={schoolYearWeeks}
                        selectedWeekKey={selectedWeekOption?.weekKey || group.weekMonday || group.key}
                        recordedWeekKeys={recordedArchiveWeekKeys}
                        label={group.title}
                        onSelectWeek={(weekKey) => {
                          setSelectedWeekMonday(weekKey);
                          setViewMode('week');
                        }}
                        ariaLabel="Select school year week for archived records"
                      />
                    ) : (
                      <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-gray-900 dark:text-slate-100 select-none whitespace-nowrap shrink-0">
                        {group.title}
                      </span>
                    )}
                  </div>

                  {group.isMonthGroup ? (
                    groupDates.map(renderScoreDateButton)
                  ) : (
                    <div className="flex items-center gap-0.5 sm:gap-1.5 py-0.5 flex-1 min-w-0 sm:flex-initial">
                      {groupDates.map(renderScoreDateButton)}
                    </div>
                  )}
                </div>

                {isOpen && displayRecords.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                      {displayRecords.length} Record{displayRecords.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Open Week Sessions and Tables (Mirrors Score Entry History Columns) */}
              {isOpen && (
                <div className="space-y-4">
                  {sessions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No score records for the selected date.
                    </div>
                  ) : (
                    sessions.map((session, sIdx) => (
                      <div key={session.key} className={sIdx > 0 ? 'mt-4' : ''}>
                        <EntrySessionSeparator label={session.label} time={session.time} />

                        {/* Mobile View (< 768px): Sticky Student Column */}
                        <div className="md:hidden overflow-x-auto mobile-scroll-table bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A]">
                          <table className="min-w-[620px] w-full border-separate border-spacing-0 text-xs text-gray-700 dark:text-slate-300" style={{ fontFamily: 'var(--font-body)' }}>
                            <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515]">
                              <tr className="bg-gray-50 dark:bg-[#151515]">
                                <th className="sticky left-0 top-0 z-30 bg-gray-50 dark:bg-[#151515] w-[38%] min-w-[140px] px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-200 dark:border-[#1A1A1A] shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                                  <SortableHeader label="STUDENT" field="studentName" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                </th>
                                <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[130px] px-2.5 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                  <SortableHeader label="DESCRIPTION" field="activityTitle" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                </th>
                                <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[90px] px-2 py-2 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                  <SortableHeader label="SCORE" field="score" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                </th>
                                <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[85px] px-2 py-2 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                  <SortableHeader label="REMARK" field="remarks" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                </th>
                                <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[80px] px-2 py-2 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                  <SortableHeader label="STATUS" field="status" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                </th>
                                <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[160px] px-2.5 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                  <SortableHeader label="DATE" field="date" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                </th>
                                <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[75px] px-2 py-2 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-gray-100 dark:border-[#1A1A1A]">
                                  <SortableHeader label="TIME" field="time" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-[#111111]">
                              {session.rows.map((row) => (
                                <tr key={`mobile-score-${row.id}`} className="group transition-colors hover:bg-gray-50/70 dark:hover:bg-[#151515]">
                                  <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 dark:bg-[#111111] dark:group-hover:bg-[#151515] px-3 py-2.5 font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap border-b border-r border-gray-200 dark:border-[#1A1A1A] shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                                    <span className="block truncate max-w-[135px] text-xs font-bold" title={row.studentName}>
                                      {row.studentName}
                                    </span>
                                  </td>
                                  <td className="px-2.5 py-2.5 text-left font-bold text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                    <span className="block truncate max-w-[125px]" title={row.activityTitle}>
                                      {row.activityTitle}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-center font-mono font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap text-xs border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                    {row.scoreDisplay}
                                  </td>
                                  <td className="px-2 py-2.5 text-center whitespace-nowrap text-xs border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold border uppercase tracking-wider ${row.remarks === 'Passed'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                                        : row.remarks === 'Not Taken'
                                          ? 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400'
                                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                                        }`}
                                    >
                                      {row.remarks}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2.5 text-center whitespace-nowrap text-xs border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold border uppercase tracking-wider ${row.status === 'Taken'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                        }`}
                                    >
                                      {row.status}
                                    </span>
                                  </td>
                                  <td className="px-2.5 py-2.5 text-left text-xs font-bold text-gray-800 dark:text-slate-200 whitespace-nowrap border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                    {formatDateString(row.date)}
                                  </td>
                                  <td className="px-2 py-2.5 text-center text-xs font-mono font-bold text-gray-600 dark:text-slate-400 whitespace-nowrap border-b border-gray-100 dark:border-[#1A1A1A]">
                                    {row.time}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Desktop View (>= 768px): Exact Mirror of Score Entry History Columns */}
                        <div className="hidden md:block overflow-x-auto rounded-md border border-gray-200 dark:border-[#1A1A1A]">
                          <table className="min-w-[760px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-left text-xs font-normal">
                            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] shadow-xs">
                              <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#151515]">
                                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-4 py-2.5 text-left whitespace-nowrap">
                                  <SortableHeader label="STUDENT" field="studentName" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                </th>
                                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-4 py-2.5 text-left whitespace-nowrap">
                                  <SortableHeader label="DESCRIPTION" field="activityTitle" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                </th>
                                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-3 py-2.5 text-center whitespace-nowrap">
                                  <SortableHeader label="SCORE" field="score" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                </th>
                                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-3 py-2.5 text-center whitespace-nowrap">
                                  <SortableHeader label="REMARK" field="remarks" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                </th>
                                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-3 py-2.5 text-center whitespace-nowrap">
                                  <SortableHeader label="STATUS" field="status" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                </th>
                                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-4 py-2.5 text-left whitespace-nowrap">
                                  <SortableHeader label="DATE" field="date" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                </th>
                                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-3 py-2.5 text-center whitespace-nowrap">
                                  <SortableHeader label="TIME" field="time" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#111111]">
                              {session.rows.map((row) => (
                                <tr key={`score-${row.id}`} className="divide-x divide-gray-100 dark:divide-[#1A1A1A] hover:bg-gray-50/70 dark:hover:bg-[#151515] transition-colors">
                                  <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-slate-100 text-xs sm:text-[13px] tracking-tight whitespace-nowrap">
                                    {row.studentName}
                                  </td>
                                  <td className="px-4 py-2.5 text-gray-700 dark:text-slate-300 whitespace-nowrap font-bold text-xs">
                                    <span>{row.activityTitle}</span>
                                    {row.isAssessment && (
                                      <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-[var(--brand)] border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900">
                                        Assessment
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono font-bold text-gray-900 dark:text-slate-100 text-xs whitespace-nowrap">
                                    {row.scoreDisplay}
                                  </td>
                                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold border uppercase tracking-wider ${row.remarks === 'Passed'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                                        : row.remarks === 'Not Taken'
                                          ? 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400'
                                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                                        }`}
                                    >
                                      {row.remarks}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold border uppercase tracking-wider ${row.status === 'Taken'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                        }`}
                                    >
                                      {row.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-left text-xs font-bold text-gray-800 dark:text-slate-200 whitespace-nowrap">
                                    {formatDateString(row.date)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-xs font-mono font-bold text-gray-600 dark:text-slate-400 whitespace-nowrap">
                                    {row.time}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    ) : (
      /* ─── ATTENDANCE ACCORDION SECTIONS (WEEK / MONTH) ─── */
      <div className="p-2 sm:p-5 space-y-6">
        {attendanceTableGroups.map((group) => {
          const datesWithRecords = new Set(group.records.map((r) => r.date));
          const groupDates = group.isMonthGroup
            ? Array.from(datesWithRecords).sort()
            : getWeekdaysForMonday(group.weekMonday || group.key, Array.from(datesWithRecords));

          const isOpen = Boolean(selectedDate && groupDates.includes(selectedDate));
          const displayRecords = selectedDate && isOpen
            ? group.records.filter((r) => r.date === selectedDate)
            : group.records;

          // Group display records by Session / Activity
          const sessionMap = new Map<string, ConcludedAttendanceRecord[]>();
          displayRecords.forEach((r) => {
            const label = 'SESSION';
            const time = r.timeIn && r.timeIn !== '—' ? r.timeIn : '';
            const key = `${label}|${time}`;
            if (!sessionMap.has(key)) sessionMap.set(key, []);
            sessionMap.get(key)!.push(r);
          });

          const sessions = Array.from(sessionMap.entries()).map(([key, sRows]) => {
            const [, time] = key.split('|');
            return { key, label: 'SESSION', time: time || null, rows: sortAttendanceList(sRows) };
          });

          const renderAttDateButton = (dateStr: string) => {
            const hasRecord = datesWithRecords.has(dateStr);
            const isSelected = selectedDate === dateStr;
            const fullLabel = formatDateButtonFull(dateStr);
            const shortLabel = formatDateButtonShort(dateStr);

            return (
              <button
                key={dateStr}
                type="button"
                disabled={!hasRecord}
                onClick={() => setSelectedDate(dateStr)}
                className={`${group.isMonthGroup
                  ? 'shrink-0 px-1.5 sm:px-3 text-[9px] sm:text-[11px]'
                  : 'flex-1 min-w-0 sm:flex-initial sm:w-auto px-0.5 sm:px-3 text-[8.5px] min-[375px]:text-[9.5px] sm:text-[11px] tracking-tight sm:tracking-normal justify-center'
                  } h-7 sm:h-7.5 whitespace-nowrap rounded-md font-bold uppercase transition-all inline-flex items-center gap-0.5 sm:gap-1 ${hasRecord
                    ? isSelected
                      ? 'bg-[var(--brand)] text-white shadow-xs font-bold border border-[var(--brand)] cursor-pointer'
                      : 'bg-blue-50/80 text-[var(--brand)] border border-blue-200/80 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 dark:hover:bg-blue-900/50 cursor-pointer font-semibold'
                    : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-[#222222] cursor-not-allowed opacity-50'
                  }`}
                title={
                  hasRecord
                    ? isSelected
                      ? `Active: ${fullLabel}`
                      : `View ${fullLabel}`
                    : `No records on ${fullLabel}`
                }
                aria-label={fullLabel}
              >
                {group.isMonthGroup ? (
                  <span>{shortLabel}</span>
                ) : (
                  <>
                    <span className="hidden sm:inline">{fullLabel}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                  </>
                )}
              </button>
            );
          };

          return (
            <div key={group.key} className="space-y-3">
              {/* Group Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-2.5 pt-1 pb-2.5 border-b border-gray-100 dark:border-[#1A1A1A]">
                <div
                  className={
                    group.isMonthGroup
                      ? 'flex flex-wrap items-center gap-1 sm:gap-1.5 min-w-0 w-full sm:w-auto py-0.5'
                      : 'flex flex-row items-center gap-1 sm:gap-3 min-w-0 w-full sm:w-auto'
                  }
                >
                  <div className={`flex items-center py-0.5 shrink-0 ${group.isMonthGroup ? 'mr-1 sm:mr-1.5' : ''}`}>
                    {!group.isMonthGroup && schoolYearWeeks.length > 0 ? (
                      <HistoryWeekDropdown
                        weeks={schoolYearWeeks}
                        selectedWeekKey={selectedWeekOption?.weekKey || group.weekMonday || group.key}
                        recordedWeekKeys={recordedArchiveWeekKeys}
                        label={group.title}
                        onSelectWeek={(weekKey) => {
                          setSelectedWeekMonday(weekKey);
                          setViewMode('week');
                        }}
                        ariaLabel="Select school year week for archived records"
                      />
                    ) : (
                      <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-gray-900 dark:text-slate-100 select-none whitespace-nowrap shrink-0">
                        {group.title}
                      </span>
                    )}
                  </div>

                  {group.isMonthGroup ? (
                    groupDates.map(renderAttDateButton)
                  ) : (
                    <div className="flex items-center gap-0.5 sm:gap-1.5 py-0.5 flex-1 min-w-0 sm:flex-initial">
                      {groupDates.map(renderAttDateButton)}
                    </div>
                  )}
                </div>

                {isOpen && displayRecords.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                      {displayRecords.length} Record{displayRecords.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Open Week Sessions and Tables (Mirrors QR Attendance History Columns) */}
              {isOpen && (
                <div className="space-y-4">
                  {sessions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No attendance records for the selected date.
                    </div>
                  ) : (
                    sessions.map((session, sIdx) => (
                      <div key={session.key} className={sIdx > 0 ? 'mt-4' : ''}>
                        <EntrySessionSeparator label={session.label} time={session.time} />

                        {/* Mobile View (< 768px): Sticky Student Column */}
                        <div className="md:hidden overflow-x-auto mobile-scroll-table bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A]">
                          <table className="min-w-[540px] w-full border-separate border-spacing-0 text-xs text-gray-700 dark:text-slate-300" style={{ fontFamily: 'var(--font-body)' }}>
                            <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515]">
                              <tr className="bg-gray-50 dark:bg-[#151515]">
                                <th className="sticky left-0 top-0 z-30 bg-gray-50 dark:bg-[#151515] w-[42%] min-w-[140px] px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-200 dark:border-[#1A1A1A] shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                                  <SortableHeader label="STUDENT" field="studentName" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                                </th>
                                <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[160px] px-2.5 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                  <SortableHeader label="DATE" field="date" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                                </th>
                                <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[80px] px-2 py-2 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                  <SortableHeader label="TIME" field="time" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} align="center" />
                                </th>
                                <th className="sticky top-0 z-20 bg-gray-50 dark:bg-[#151515] min-w-[80px] px-2 py-2 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300 border-b border-gray-100 dark:border-[#1A1A1A]">
                                  <SortableHeader label="STATUS" field="status" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} align="center" />
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-[#111111]">
                              {session.rows.map((row) => (
                                <tr key={`mobile-att-${row.id}`} className="group transition-colors hover:bg-gray-50/70 dark:hover:bg-[#151515]">
                                  <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 dark:bg-[#111111] dark:group-hover:bg-[#151515] px-3 py-2.5 font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap border-b border-r border-gray-200 dark:border-[#1A1A1A] shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                                    <span className="block truncate max-w-[135px] text-xs font-bold" title={row.studentName}>
                                      {row.studentName}
                                    </span>
                                  </td>
                                  <td className="px-2.5 py-2.5 text-left text-xs font-bold text-gray-800 dark:text-slate-200 whitespace-nowrap border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                    {formatDateString(row.date)}
                                  </td>
                                  <td className="px-2 py-2.5 text-center font-mono font-bold text-gray-600 dark:text-slate-400 whitespace-nowrap text-xs border-b border-r border-gray-100 dark:border-[#1A1A1A]">
                                    {row.timeIn}
                                  </td>
                                  <td className="px-2 py-2.5 text-center whitespace-nowrap text-xs border-b border-gray-100 dark:border-[#1A1A1A]">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold border uppercase tracking-wider ${row.status.toLowerCase() === 'present'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                                        : row.status.toLowerCase() === 'late'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                                        }`}
                                    >
                                      {row.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Desktop View (>= 768px): Exact Mirror of QR Attendance History Columns */}
                        <div className="hidden md:block overflow-x-auto rounded-md border border-gray-200 dark:border-[#1A1A1A]">
                          <table className="min-w-[720px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-left text-xs font-normal">
                            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] shadow-xs">
                              <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#151515]">
                                <th className="sticky top-0 z-10 px-4 py-2.5 text-left whitespace-nowrap bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222]">
                                  <SortableHeader label="STUDENT" field="studentName" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                                </th>
                                <th className="sticky top-0 z-10 px-4 py-2.5 text-left whitespace-nowrap bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222]">
                                  <SortableHeader label="DATE" field="date" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                                </th>
                                <th className="sticky top-0 z-10 px-3 py-2.5 text-center whitespace-nowrap bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222]">
                                  <SortableHeader label="TIME" field="time" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} align="center" />
                                </th>
                                <th className="sticky top-0 z-10 px-3 py-2.5 text-center whitespace-nowrap bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222]">
                                  <SortableHeader label="STATUS" field="status" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} align="center" />
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#111111]">
                              {session.rows.map((row) => (
                                <tr key={`att-${row.id}`} className="divide-x divide-gray-100 dark:divide-[#1A1A1A] hover:bg-gray-50/70 dark:hover:bg-[#151515] transition-colors">
                                  <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-slate-100 text-xs sm:text-[13px] tracking-tight whitespace-nowrap">
                                    {row.studentName}
                                  </td>
                                  <td className="px-4 py-2.5 text-gray-800 dark:text-slate-200 whitespace-nowrap font-bold text-xs">
                                    {formatDateString(row.date)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono font-bold text-gray-600 dark:text-slate-400 whitespace-nowrap text-xs">
                                    {row.timeIn}
                                  </td>
                                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold border uppercase tracking-wider ${row.status.toLowerCase() === 'present'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                                        : row.status.toLowerCase() === 'late'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                                        }`}
                                    >
                                      {row.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
    </div >
  );
};

export default TutorArchive;
