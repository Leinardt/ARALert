import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Calendar, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUpDown, X, CalendarDays
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import type { SchoolYear, Grade, Attendance, User, TutorCohortHistoryData } from '../../types';
import { matchesSearch } from '../../utils/searchHelpers';
import { formatSessionLabel, getScoreDescription } from '../../utils/sessionDescriptionHelpers';
import { EntrySessionSeparator } from '../../components/EntrySessionSeparator';

/* ─── Date & Week Helper Functions (Mirrors TutorScores & TutorQRGenerator) ── */
const computeWeekOfMonth = (dateObj: Date): number => {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const day = d.getDay();
  const wedDiff = day === 0 ? 3 : 3 - day;
  const wednesday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + wedDiff);
  const firstDay = new Date(wednesday.getFullYear(), wednesday.getMonth(), 1).getDay();
  return Math.ceil((wednesday.getDate() + (firstDay === 0 ? 6 : firstDay - 1)) / 7);
};

const getWeekTitle = (mondayStr: string): string => {
  const d = new Date(`${mondayStr}T00:00:00`);
  const weekNum = computeWeekOfMonth(d);
  return `WEEK ${weekNum}`;
};

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

/* ─── Calendar Popover Component ───────────────────────────────────── */
interface CalendarDropdownProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onClear: () => void;
  onClose: () => void;
  loggedDates: Set<string>;
}

const ArchiveCalendarDropdown: React.FC<CalendarDropdownProps> = ({
  selectedDate,
  onSelectDate,
  onClear,
  onClose,
  loggedDates,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const d = new Date(`${selectedDate}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return d;
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
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const today = new Date().toISOString().slice(0, 10);
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-2xl font-sans select-none text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-100 dark:border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Select Date</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 tracking-wide">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400 dark:text-slate-500 py-2 text-[10px] uppercase tracking-wider">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="h-7 w-7" />;
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = selectedDate === dateKey;
          const isToday = today === dateKey;
          const hasRecords = loggedDates.has(dateKey);
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => {
                onSelectDate(dateKey);
                onClose();
              }}
              className={`h-7 w-7 rounded-md text-xs font-semibold flex items-center justify-center transition cursor-pointer ${
                isSelected
                  ? 'bg-[var(--brand)] text-white font-bold shadow-xs'
                  : hasRecords
                  ? 'bg-blue-50 text-[var(--brand)] dark:bg-blue-950/50 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-900 hover:bg-blue-100'
                  : isToday
                  ? 'border border-[var(--brand)] text-[var(--brand)] font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
      {selectedDate && (
        <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
          >
            Clear Selected Date
          </button>
        </div>
      )}
    </div>
  );
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
      className={`inline-flex items-center gap-1.5 transition-colors hover:text-slate-700 dark:hover:text-slate-200 select-none text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider ${
        align === 'center' ? 'justify-center w-full' : align === 'right' ? 'justify-end w-full' : 'text-left'
      } ${
        isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-500'
      } ${className} cursor-pointer`}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      {isActive ? (
        direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />
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

  // Table Control State (Search, View Mode, Date Filter, Calendar Popover)
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);

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
        { id: '1st', label: '1st Semester (MOSY)' },
        { id: '2nd', label: '2nd Semester (EOSY)' },
        { id: 'summer', label: 'Summer Remediation' },
      ];
    }

    const curSem = currentSchoolYear?.current_semester || '2nd';
    if (curSem === '2nd') {
      return [{ id: '1st', label: '1st Semester (MOSY)' }];
    }
    if (curSem === 'summer') {
      return [
        { id: '1st', label: '1st Semester (MOSY)' },
        { id: '2nd', label: '2nd Semester (EOSY)' },
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

  // Logged dates set for calendar highlighting
  const loggedDates = useMemo(() => {
    const set = new Set<string>();
    if (recordType === 'scores') {
      baseScores.forEach((r) => { if (r.date) set.add(r.date); });
    } else {
      baseAttendance.forEach((r) => { if (r.date) set.add(r.date); });
    }
    return set;
  }, [recordType, baseScores, baseAttendance]);

  // 8. Most Recent Date with Entry and selectedDate state management
  const mostRecentScoreDate = useMemo(() => {
    if (baseScores.length === 0) return null;
    return baseScores[0].date || null;
  }, [baseScores]);

  const mostRecentAttDate = useMemo(() => {
    if (baseAttendance.length === 0) return null;
    return baseAttendance[0].date || null;
  }, [baseAttendance]);

  useEffect(() => {
    if (jumpDate) {
      setSelectedDate(jumpDate);
    } else {
      const mostRecent = recordType === 'scores' ? mostRecentScoreDate : mostRecentAttDate;
      setSelectedDate(mostRecent);
    }
  }, [jumpDate, recordType, mostRecentScoreDate, mostRecentAttDate, viewMode, studentSearch, selectedSemester, selectedSchoolYear, selectedClass]);

  // 9. Table Groups (Week and Month grouping matching TutorScores & TutorQRGenerator)
  const scoreTableGroups = useMemo((): ArchiveTableGroup<ConcludedScoreRecord>[] => {
    if (jumpDate) {
      const matched = baseScores.filter((r) => r.date === jumpDate);
      return [{
        key: jumpDate,
        title: viewMode === 'week' ? getWeekTitle(getWeekKey(jumpDate)) : getMonthTitle(getMonthKey(jumpDate)),
        weekMonday: getWeekKey(jumpDate),
        isMonthGroup: viewMode === 'month',
        records: matched,
      }];
    }

    const groups = new Map<string, ConcludedScoreRecord[]>();
    baseScores.forEach((record) => {
      if (!record.date) return;
      const key = viewMode === 'week' ? getWeekKey(record.date) : getMonthKey(record.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(record);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, records]) => ({
        key,
        title: viewMode === 'week' ? getWeekTitle(key) : getMonthTitle(key),
        weekMonday: viewMode === 'week' ? key : undefined,
        isMonthGroup: viewMode === 'month',
        records,
      }));
  }, [jumpDate, viewMode, baseScores]);

  const attendanceTableGroups = useMemo((): ArchiveTableGroup<ConcludedAttendanceRecord>[] => {
    if (jumpDate) {
      const matched = baseAttendance.filter((r) => r.date === jumpDate);
      return [{
        key: jumpDate,
        title: viewMode === 'week' ? getWeekTitle(getWeekKey(jumpDate)) : getMonthTitle(getMonthKey(jumpDate)),
        weekMonday: getWeekKey(jumpDate),
        isMonthGroup: viewMode === 'month',
        records: matched,
      }];
    }

    const groups = new Map<string, ConcludedAttendanceRecord[]>();
    baseAttendance.forEach((record) => {
      if (!record.date) return;
      const key = viewMode === 'week' ? getWeekKey(record.date) : getMonthKey(record.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(record);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, records]) => ({
        key,
        title: viewMode === 'week' ? getWeekTitle(key) : getMonthTitle(key),
        weekMonday: viewMode === 'week' ? key : undefined,
        isMonthGroup: viewMode === 'month',
        records,
      }));
  }, [jumpDate, viewMode, baseAttendance]);

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
    <div className="flex flex-col gap-3 sm:gap-5 p-2.5 sm:p-6 max-w-7xl mx-auto w-full" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Top Filters: School Year, Semester, Handled Classes ── */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3">
          {/* 1. School Year Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="archive-sy-select" className="w-28 sm:w-auto text-[11px] sm:text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap shrink-0">
              School Year:
            </label>
            <select
              id="archive-sy-select"
              value={selectedSchoolYear}
              onChange={(e) => setSelectedSchoolYear(e.target.value)}
              className="font-bold text-xs sm:text-sm bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 min-h-[38px] sm:min-h-0 text-slate-900 dark:text-white shadow-2xs focus:outline-none cursor-pointer flex-1 sm:flex-initial"
            >
              {schoolYears.length === 0 ? (
                <option value="">No Concluded School Years</option>
              ) : (
                schoolYears.map((sy) => (
                  <option key={sy.id || sy.school_year} value={sy.school_year}>
                    SY {sy.school_year}
                  </option>
                ))
              )}
            </select>
          </div>

          <span className="hidden sm:inline text-slate-300 dark:text-zinc-700 font-bold text-base select-none">&bull;</span>

          {/* 2. Concluded Semester Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="archive-semester-select" className="w-28 sm:w-auto text-[11px] sm:text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap shrink-0">
              Semester:
            </label>
            <select
              id="archive-semester-select"
              value={availableSemesters.length === 0 ? '' : selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value as any)}
              disabled={availableSemesters.length === 0}
              className="font-bold text-xs sm:text-sm bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 min-h-[38px] sm:min-h-0 text-slate-900 dark:text-white shadow-2xs focus:outline-none cursor-pointer disabled:opacity-50 flex-1 sm:flex-initial"
            >
              {availableSemesters.length === 0 ? (
                <option value="">No Concluded Semesters</option>
              ) : (
                availableSemesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <span className="hidden sm:inline text-slate-300 dark:text-zinc-700 font-bold text-base select-none">&bull;</span>

          {/* 3. Handled Classes Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="archive-class-select" className="w-28 sm:w-auto text-[11px] sm:text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap shrink-0">
              Handled Classes:
            </label>
            <select
              id="archive-class-select"
              value={handledClasses.length === 0 ? '' : selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={handledClasses.length === 0}
              className="font-bold text-xs sm:text-sm bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 min-h-[38px] sm:min-h-0 text-slate-900 dark:text-white shadow-2xs focus:outline-none cursor-pointer disabled:opacity-50 flex-1 sm:flex-initial truncate"
            >
              {handledClasses.length === 0 ? (
                <option value="">No Handled Classes</option>
              ) : (
                handledClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))
              )}
            </select>
          </div>
      </div>

      {/* ── Record Type Switcher (Score Records or Attendance Records) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
        {/* Two Filters: SCORE RECORDS or ATTENDANCE RECORDS */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 w-full sm:w-auto sm:inline-flex">
          <button
            type="button"
            onClick={() => {
              setRecordType('scores');
              setJumpDate(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              recordType === 'scores'
                ? 'bg-[var(--brand)] text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            SCORE RECORDS
          </button>

          <button
            type="button"
            onClick={() => {
              setRecordType('attendance');
              setJumpDate(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              recordType === 'attendance'
                ? 'bg-[var(--brand)] text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ATTENDANCE RECORDS
          </button>
        </div>

        {/* Sub-filter for Score Records: ALL / INTERVENTION ACTIVITY / (MOSY/EOSY/SUMMER) */}
        {recordType === 'scores' && (
          <div className="w-full sm:w-auto flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 sm:inline-flex">
            <button
              type="button"
              onClick={() => setActivityFilter('all')}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer text-center whitespace-nowrap ${
                activityFilter === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ALL
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter('intervention')}
              className={`flex-1 min-w-0 px-1 sm:px-3 py-1.5 rounded-lg text-[9.5px] min-[360px]:text-[10px] sm:text-xs font-bold tracking-tight sm:tracking-normal transition-all cursor-pointer text-center whitespace-nowrap ${
                activityFilter === 'intervention'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Intervention Activity"
            >
              <span className="hidden min-[350px]:inline">INTERVENTION ACTIVITY</span>
              <span className="min-[350px]:hidden">INTERVENTION</span>
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter('assessment')}
              className={`flex-1 min-w-0 px-1 sm:px-3 py-1.5 rounded-lg text-[9.5px] min-[360px]:text-[10px] sm:text-xs font-bold tracking-tight sm:tracking-normal transition-all cursor-pointer text-center whitespace-nowrap ${
                activityFilter === 'assessment'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={assessmentFilterName}
            >
              <span className="hidden min-[350px]:inline">{assessmentFilterName}</span>
              <span className="min-[350px]:hidden">{assessmentFilterName.replace(' ASSESSMENT', '')}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Table Container ── */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        {/* Table Top Controls Bar (No Export Button) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3.5 sm:px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {recordType === 'scores' ? 'CONCLUDED SEMESTER SCORE RECORDS' : 'CONCLUDED SEMESTER ATTENDANCE RECORDS'}
            </h2>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400">
              {totalRecordsCount} Record{totalRecordsCount !== 1 ? 's' : ''} in historical archive
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            {/* Search Input - Full width on mobile, compact on desktop */}
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search Student Name"
                className="h-8.5 sm:h-8 w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 pl-9 pr-3 text-xs font-medium text-slate-800 dark:text-zinc-200 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:bg-white dark:focus:bg-zinc-950"
              />
            </div>

            {/* View Mode Toggle and Calendar in a clean row on mobile */}
            <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
              {/* View Mode Toggle: WEEK / MONTH */}
              <div className="flex h-8 shrink-0 items-center gap-0.5 rounded-md bg-gray-100 dark:bg-[#1A1A1A] p-0.5">
                {(['week', 'month'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setViewMode(mode);
                      setJumpDate(null);
                    }}
                    className={`h-7 whitespace-nowrap rounded-sm px-3 text-[10.5px] font-bold uppercase transition-all cursor-pointer ${
                      viewMode === mode && !jumpDate
                        ? 'bg-[var(--brand)] text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Calendar Popover */}
              <div className="relative inline-flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCalendar((prev) => !prev)}
                  className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border p-0 transition-all ${
                    jumpDate
                      ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                      : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)]'
                  }`}
                  title="Select a specific date from calendar"
                  aria-label="Open calendar"
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>

                {showCalendar && (
                  <ArchiveCalendarDropdown
                    selectedDate={jumpDate}
                    onSelectDate={(d) => setJumpDate(d)}
                    onClear={() => setJumpDate(null)}
                    onClose={() => setShowCalendar(false)}
                    loggedDates={loggedDates}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Jump Date Indicator Banner */}
        {jumpDate && (
          <div className="flex items-center justify-between px-3.5 sm:px-5 py-2 border-b border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/70 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Filtered Date: {new Date(`${jumpDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setJumpDate(null)}
              className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}

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
                : jumpDate
                ? 'No records match the selected date. Clear the date filter to view all records.'
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

              return (
                <div key={group.key} className="space-y-3">
                  {/* Group Section Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1 pb-2.5 border-b border-gray-100 dark:border-[#1A1A1A]">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto">
                      <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 py-0.5 shrink-0">
                        <span className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-slate-100 select-none whitespace-nowrap shrink-0">
                          {group.title}
                        </span>
                        {isOpen && displayRecords.length > 0 && (
                          <span className="sm:hidden text-[11px] font-semibold text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                            {displayRecords.length} Record{displayRecords.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Weekday Date Buttons */}
                      <div className={`flex items-center gap-1 sm:gap-1.5 py-0.5 w-full sm:w-auto max-w-full ${group.isMonthGroup ? 'overflow-x-auto no-scrollbar' : ''}`}>
                        {groupDates.map((dateStr) => {
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
                              className={`${
                                group.isMonthGroup
                                  ? 'shrink-0 px-2.5 sm:px-3 text-[11px]'
                                  : 'flex-1 min-w-0 sm:flex-initial sm:w-auto px-0.5 min-[360px]:px-1 sm:px-3 text-[9.5px] min-[360px]:text-[10px] min-[390px]:text-[11px] justify-center'
                              } h-7.5 whitespace-nowrap rounded-md font-bold uppercase transition-all inline-flex items-center gap-0.5 min-[360px]:gap-1 ${
                                hasRecord
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
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isSelected ? 'bg-sky-200' : 'bg-[#0284C7] dark:bg-[#38BDF8]'}`} />
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
                        })}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
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
                            <div className="md:hidden overflow-x-auto mobile-scroll-table bg-white dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800">
                              <table className="min-w-[620px] w-full border-separate border-spacing-0 text-xs text-slate-600 dark:text-zinc-300" style={{ fontFamily: 'var(--font-body)' }}>
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-zinc-900/90">
                                    <th className="sticky left-0 z-20 bg-slate-50 dark:bg-zinc-900/90 w-[38%] min-w-[140px] px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-r border-slate-200 dark:border-zinc-800 shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                                      <SortableHeader label="STUDENT" field="studentName" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                    </th>
                                    <th className="min-w-[130px] px-2.5 py-2 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-r border-slate-100 dark:border-zinc-900">
                                      <SortableHeader label="DESCRIPTION" field="activityTitle" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                    </th>
                                    <th className="min-w-[90px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-r border-slate-100 dark:border-zinc-900">
                                      <SortableHeader label="SCORE" field="score" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                    </th>
                                    <th className="min-w-[85px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-r border-slate-100 dark:border-zinc-900">
                                      <SortableHeader label="REMARK" field="remarks" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                    </th>
                                    <th className="min-w-[80px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-r border-slate-100 dark:border-zinc-900">
                                      <SortableHeader label="STATUS" field="status" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                    </th>
                                    <th className="min-w-[160px] px-2.5 py-2 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-r border-slate-100 dark:border-zinc-900">
                                      <SortableHeader label="DATE" field="date" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                    </th>
                                    <th className="min-w-[75px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-900">
                                      <SortableHeader label="TIME" field="time" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-zinc-950">
                                  {session.rows.map((row) => (
                                    <tr key={`mobile-score-${row.id}`} className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-900/50">
                                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 dark:bg-zinc-950 dark:group-hover:bg-zinc-900/50 px-3 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap border-b border-r border-slate-200 dark:border-zinc-800 shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                                        <span className="block truncate max-w-[135px] text-xs font-semibold" title={row.studentName}>
                                          {row.studentName}
                                        </span>
                                      </td>
                                      <td className="px-2.5 py-2.5 text-left font-medium text-slate-700 dark:text-zinc-300 whitespace-nowrap text-xs border-b border-r border-slate-100 dark:border-zinc-900">
                                        <span className="block truncate max-w-[125px]" title={row.activityTitle}>
                                          {row.activityTitle}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2.5 text-center font-mono font-semibold text-slate-800 dark:text-zinc-200 whitespace-nowrap text-xs border-b border-r border-slate-100 dark:border-zinc-900">
                                        {row.scoreDisplay}
                                      </td>
                                      <td className="px-2 py-2.5 text-center whitespace-nowrap text-xs border-b border-r border-slate-100 dark:border-zinc-900">
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                                            row.remarks === 'Passed'
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                                              : row.remarks === 'Not Taken'
                                              ? 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400'
                                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                                          }`}
                                        >
                                          {row.remarks}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2.5 text-center whitespace-nowrap text-xs border-b border-r border-slate-100 dark:border-zinc-900">
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                                            row.status === 'Taken'
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                          }`}
                                        >
                                          {row.status}
                                        </span>
                                      </td>
                                      <td className="px-2.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-zinc-300 whitespace-nowrap border-b border-r border-slate-100 dark:border-zinc-900">
                                        {formatDateString(row.date)}
                                      </td>
                                      <td className="px-2 py-2.5 text-center text-xs font-mono text-slate-600 dark:text-zinc-400 whitespace-nowrap border-b border-slate-100 dark:border-zinc-900">
                                        {row.time}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Desktop View (>= 768px): Exact Mirror of Score Entry History Columns */}
                            <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
                              <table className="min-w-[760px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-left text-xs font-normal">
                                <thead>
                                  <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                                    <th className="px-4 py-2.5 text-left whitespace-nowrap">
                                      <SortableHeader label="STUDENT" field="studentName" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                    </th>
                                    <th className="px-4 py-2.5 text-left whitespace-nowrap">
                                      <SortableHeader label="DESCRIPTION" field="activityTitle" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                    </th>
                                    <th className="px-3 py-2.5 text-center whitespace-nowrap">
                                      <SortableHeader label="SCORE" field="score" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                    </th>
                                    <th className="px-3 py-2.5 text-center whitespace-nowrap">
                                      <SortableHeader label="REMARK" field="remarks" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                    </th>
                                    <th className="px-3 py-2.5 text-center whitespace-nowrap">
                                      <SortableHeader label="STATUS" field="status" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                    </th>
                                    <th className="px-4 py-2.5 text-left whitespace-nowrap">
                                      <SortableHeader label="DATE" field="date" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                                    </th>
                                    <th className="px-3 py-2.5 text-center whitespace-nowrap">
                                      <SortableHeader label="TIME" field="time" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                                  {session.rows.map((row) => (
                                    <tr key={`score-${row.id}`} className="divide-x divide-gray-100 dark:divide-[#1A1A1A] hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors">
                                      <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                        {row.studentName}
                                      </td>
                                      <td className="px-4 py-2.5 text-slate-700 dark:text-zinc-300 whitespace-nowrap font-medium">
                                        <span>{row.activityTitle}</span>
                                        {row.isAssessment && (
                                          <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[var(--brand)] border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900">
                                            Assessment
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-center font-mono font-semibold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                                        {row.scoreDisplay}
                                      </td>
                                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                        <span
                                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border uppercase tracking-wide ${
                                            row.remarks === 'Passed'
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
                                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border uppercase tracking-wide ${
                                            row.status === 'Taken'
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                          }`}
                                        >
                                          {row.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-left text-slate-700 dark:text-zinc-300 whitespace-nowrap font-medium">
                                        {formatDateString(row.date)}
                                      </td>
                                      <td className="px-3 py-2.5 text-center font-mono text-slate-600 dark:text-zinc-400 whitespace-nowrap">
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

              return (
                <div key={group.key} className="space-y-3">
                  {/* Group Section Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1 pb-2.5 border-b border-gray-100 dark:border-[#1A1A1A]">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto">
                      <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 py-0.5 shrink-0">
                        <span className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-slate-100 select-none whitespace-nowrap shrink-0">
                          {group.title}
                        </span>
                        {isOpen && displayRecords.length > 0 && (
                          <span className="sm:hidden text-[11px] font-semibold text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                            {displayRecords.length} Record{displayRecords.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Weekday Date Buttons */}
                      <div className={`flex items-center gap-1 sm:gap-1.5 py-0.5 w-full sm:w-auto max-w-full ${group.isMonthGroup ? 'overflow-x-auto no-scrollbar' : ''}`}>
                        {groupDates.map((dateStr) => {
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
                              className={`${
                                group.isMonthGroup
                                  ? 'shrink-0 px-2.5 sm:px-3 text-[11px]'
                                  : 'flex-1 min-w-0 sm:flex-initial sm:w-auto px-0.5 min-[360px]:px-1 sm:px-3 text-[9.5px] min-[360px]:text-[10px] min-[390px]:text-[11px] justify-center'
                              } h-7.5 whitespace-nowrap rounded-md font-bold uppercase transition-all inline-flex items-center gap-0.5 min-[360px]:gap-1 ${
                                hasRecord
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
                        })}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
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
                            <div className="md:hidden overflow-x-auto mobile-scroll-table bg-white dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800">
                              <table className="min-w-[540px] w-full border-separate border-spacing-0 text-xs text-slate-600 dark:text-zinc-300" style={{ fontFamily: 'var(--font-body)' }}>
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-zinc-900/90">
                                    <th className="sticky left-0 z-20 bg-slate-50 dark:bg-zinc-900/90 w-[42%] min-w-[140px] px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-r border-slate-200 dark:border-zinc-800 shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                                      <SortableHeader label="STUDENT" field="studentName" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                                    </th>
                                    <th className="min-w-[160px] px-2.5 py-2 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-r border-slate-100 dark:border-zinc-900">
                                      <SortableHeader label="DATE" field="date" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                                    </th>
                                    <th className="min-w-[80px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-r border-slate-100 dark:border-zinc-900">
                                      <SortableHeader label="TIME" field="time" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} align="center" />
                                    </th>
                                    <th className="min-w-[80px] px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-900">
                                      <SortableHeader label="STATUS" field="status" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} align="center" />
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-zinc-950">
                                  {session.rows.map((row) => (
                                    <tr key={`mobile-att-${row.id}`} className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-900/50">
                                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 dark:bg-zinc-950 dark:group-hover:bg-zinc-900/50 px-3 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap border-b border-r border-slate-200 dark:border-zinc-800 shadow-[3px_0_5px_-1px_rgba(0,0,0,0.06)] dark:shadow-[3px_0_5px_-1px_rgba(0,0,0,0.5)]">
                                        <span className="block truncate max-w-[135px] text-xs font-semibold" title={row.studentName}>
                                          {row.studentName}
                                        </span>
                                      </td>
                                      <td className="px-2.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-zinc-300 whitespace-nowrap border-b border-r border-slate-100 dark:border-zinc-900">
                                        {formatDateString(row.date)}
                                      </td>
                                      <td className="px-2 py-2.5 text-center font-mono text-slate-700 dark:text-zinc-300 whitespace-nowrap text-xs border-b border-r border-slate-100 dark:border-zinc-900">
                                        {row.timeIn}
                                      </td>
                                      <td className="px-2 py-2.5 text-center whitespace-nowrap text-xs border-b border-slate-100 dark:border-zinc-900">
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                                            row.status.toLowerCase() === 'present'
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
                            <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
                              <table className="min-w-[720px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-left text-xs font-normal">
                                <thead>
                                  <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#111111]">
                                    <th className="px-4 py-2.5 text-left whitespace-nowrap">
                                      <SortableHeader label="STUDENT" field="studentName" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                                    </th>
                                    <th className="px-4 py-2.5 text-left whitespace-nowrap">
                                      <SortableHeader label="DATE" field="date" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                                    </th>
                                    <th className="px-3 py-2.5 text-center whitespace-nowrap">
                                      <SortableHeader label="TIME" field="time" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} align="center" />
                                    </th>
                                    <th className="px-3 py-2.5 text-center whitespace-nowrap">
                                      <SortableHeader label="STATUS" field="status" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} align="center" />
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
                                  {session.rows.map((row) => (
                                    <tr key={`att-${row.id}`} className="divide-x divide-gray-100 dark:divide-[#1A1A1A] hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors">
                                      <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                        {row.studentName}
                                      </td>
                                      <td className="px-4 py-2.5 text-slate-700 dark:text-zinc-300 whitespace-nowrap font-medium">
                                        {formatDateString(row.date)}
                                      </td>
                                      <td className="px-3 py-2.5 text-center font-mono text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                                        {row.timeIn}
                                      </td>
                                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                        <span
                                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border uppercase tracking-wide ${
                                            row.status.toLowerCase() === 'present'
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
    </div>
  );
};

export default TutorArchive;
