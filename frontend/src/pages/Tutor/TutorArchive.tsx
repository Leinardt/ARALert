import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Calendar, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUpDown, X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import type { SchoolYear, Grade, Attendance, User, TutorCohortHistoryData } from '../../types';
import { buildTutorClassSections } from '../../utils/tutorCohortHelpers';

/* ─── Date & Week Helper Functions (Mirrors TutorScores layout) ─────── */
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

const formatDateButtonLabel = (dateStr: string): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
}

const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  field,
  currentField,
  direction,
  onSort,
  align = 'left',
}) => {
  const isActive = currentField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1.5 text-${align} transition-colors hover:text-slate-700 dark:hover:text-slate-200 select-none text-[11px] font-bold uppercase tracking-wider ${
        isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-500'
      } cursor-pointer`}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      {isActive ? (
        direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
      ) : (
        <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
      )}
    </button>
  );
};

/* ─── Main TutorArchive Component ──────────────────────────────────── */
export const TutorArchive: React.FC = () => {
  const { user } = useAuth();

  // Top Filter Selectors State
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<'all' | '1st' | '2nd' | 'summer'>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<'roster' | 'scores' | 'attendance'>('roster');

  // Table Control State (Search, Date Filter, Calendar Popover, Sorting)
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);

  // Sort States per view
  const [rosterSortField, setRosterSortField] = useState<string>('studentName');
  const [rosterSortDir, setRosterSortDir] = useState<'asc' | 'desc'>('asc');

  const [scoreSortField, setScoreSortField] = useState<string>('date');
  const [scoreSortDir, setScoreSortDir] = useState<'asc' | 'desc'>('desc');

  const [attSortField, setAttSortField] = useState<string>('date');
  const [attSortDir, setAttSortDir] = useState<'asc' | 'desc'>('desc');

  // Data State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cohortHistory, setCohortHistory] = useState<TutorCohortHistoryData | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);

  // Fetch initial school years
  useEffect(() => {
    let mounted = true;
    const fetchSY = async () => {
      try {
        const [sys, cur] = await Promise.all([
          academicService.getSchoolYears(),
          academicService.getCurrentSchoolYear().catch(() => null),
        ]);
        if (mounted) {
          setSchoolYears(sys);
          if (cur?.school_year) {
            setSelectedSchoolYear(cur.school_year);
          } else if (sys.length > 0) {
            setSelectedSchoolYear(sys[0].school_year);
          } else {
            setSelectedSchoolYear('2026-2027');
          }
        }
      } catch (err) {
        console.error('Failed to fetch school years:', err);
        if (mounted) setSelectedSchoolYear('2026-2027');
      }
    };
    fetchSY();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch tutor history, grades, attendance, and student directory
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const [historyData, gradesData, attendanceData, studentsData] = await Promise.all([
          academicService.getTutorCohortHistory(String(user.id), selectedSchoolYear).catch(() => null),
          academicService.getGrades().catch(() => []),
          academicService.getAttendanceHistory().catch(() => []),
          userService.getAllUsers({ role: 'student' }).catch(() => []),
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

  // Map students by ID for quick profile lookup
  const studentMap = useMemo(() => {
    const map = new Map<string, User>();
    for (const s of allStudents) {
      map.set(String(s.id), s);
    }
    return map;
  }, [allStudents]);

  // Helper to determine semester from date or subject/period
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

  // Dynamically compute handled classes for the selected school year and semester
  const filteredHandledClasses = useMemo(() => {
    const classes = new Set<string>();

    // 1. From tutor assignment history
    if (cohortHistory?.past_records) {
      for (const rec of cohortHistory.past_records) {
        if (!selectedSchoolYear || rec.school_year === selectedSchoolYear) {
          const sem = getSemesterFromRecord(rec.period, rec.start_date);
          if (selectedSemester === 'all' || sem === selectedSemester) {
            const st = studentMap.get(rec.student_id);
            if (st?.section) {
              const g = st.grade_level ? (st.grade_level.includes('Grade') ? st.grade_level : `Grade ${st.grade_level}`) : 'Grade 7';
              classes.add(`${g} - ${st.section}`);
            }
          }
        }
      }
    }

    // 2. From grades recorded by this tutor
    for (const g of grades) {
      const gDate = g.date_logged ? g.date_logged.slice(0, 10) : '';
      const sem = getSemesterFromRecord(g.subject, gDate);
      if (selectedSemester === 'all' || sem === selectedSemester) {
        const st = studentMap.get(String(g.student));
        if (st?.section) {
          const gLev = st.grade_level ? (st.grade_level.includes('Grade') ? st.grade_level : `Grade ${st.grade_level}`) : 'Grade 7';
          classes.add(`${gLev} - ${st.section}`);
        }
      }
    }

    // 3. From active tutor profile sections (if viewing active school year)
    if (user && (!selectedSchoolYear || selectedSchoolYear === '2026-2027')) {
      const activeClasses = buildTutorClassSections(user, allStudents);
      for (const cls of activeClasses) {
        classes.add(`${cls.gradeLevel} - ${cls.section}`);
      }
    }

    return Array.from(classes).sort();
  }, [cohortHistory, grades, user, allStudents, studentMap, selectedSchoolYear, selectedSemester]);

  // Reset selected class if it no longer exists in filtered handled classes
  useEffect(() => {
    if (selectedClass !== 'all' && !filteredHandledClasses.includes(selectedClass)) {
      setSelectedClass('all');
    }
  }, [filteredHandledClasses, selectedClass]);

  /* ─── 1. Build Class Assessment and Final Result Records ─────────── */
  const assessmentRecords = useMemo(() => {
    const items: Array<{
      id: string;
      studentId: string;
      studentName: string;
      lrn: string;
      program: string;
      classSection: string;
      schoolYear: string;
      semester: '1st' | '2nd' | 'summer';
      assessmentType: string;
      score: string;
      scorePct: number;
      outcome: string;
      date: string;
    }> = [];

    // Historical records from tutor assignment history
    if (cohortHistory?.past_records) {
      for (const rec of cohortHistory.past_records) {
        const st = studentMap.get(rec.student_id);
        const g = st?.grade_level ? (st.grade_level.includes('Grade') ? st.grade_level : `Grade ${st.grade_level}`) : 'Grade 7';
        const sec = st?.section || 'HYACINTH';
        const classSec = `${g} - ${sec}`;
        const sem = getSemesterFromRecord(rec.period, rec.start_date);
        const dateStr = rec.start_date ? rec.start_date.slice(0, 10) : new Date().toISOString().slice(0, 10);

        let outcome = 'Retained Level';
        let scorePct = 0;
        if (rec.latest_score && rec.latest_score.includes('%')) {
          const match = rec.latest_score.match(/\((\d+(\.\d+)?)%\)/);
          if (match) scorePct = parseFloat(match[1]);
        }

        if (rec.latest_grade_remarks?.toLowerCase().includes('pass') || scorePct >= 70) {
          outcome = rec.program.toLowerCase() === 'plus' ? 'Graduated' : 'Moved Up to Plus';
        }

        const assType = sem === '1st' ? 'MOSY Assessment' : sem === '2nd' ? 'EOSY Assessment' : 'ARAL Summer Assessment';

        items.push({
          id: `hist-${rec.history_id}`,
          studentId: rec.student_id,
          studentName: rec.student_name,
          lrn: rec.lrn || '—',
          program: rec.program,
          classSection: classSec,
          schoolYear: rec.school_year,
          semester: sem,
          assessmentType: assType,
          score: rec.latest_score || '—',
          scorePct,
          outcome,
          date: dateStr,
        });
      }
    }

    // Active cohort students
    if (cohortHistory?.active_cohort) {
      for (const st of cohortHistory.active_cohort) {
        if (!items.some((i) => i.studentId === st.student_id)) {
          const fullSt = studentMap.get(st.student_id);
          const g = fullSt?.grade_level ? (fullSt.grade_level.includes('Grade') ? fullSt.grade_level : `Grade ${fullSt.grade_level}`) : 'Grade 7';
          const sec = fullSt?.section || 'HYACINTH';
          const classSec = `${g} - ${sec}`;
          const today = new Date().toISOString().slice(0, 10);

          // Find if there is an evaluation grade for this active student
          const evalGrade = grades.find((gr) => String(gr.student) === st.student_id && (gr.subject?.toUpperCase().includes('MOSY') || gr.subject?.toUpperCase().includes('EOSY') || gr.subject?.toUpperCase().includes('SUMMER')));

          let scoreStr = '—';
          let scorePct = 0;
          let outcome = 'In Progress';
          let dateStr = today;

          if (evalGrade) {
            dateStr = evalGrade.date_logged ? evalGrade.date_logged.slice(0, 10) : today;
            const sc = Number(evalGrade.score) || 0;
            const ts = Number(evalGrade.total_score) || 40;
            scorePct = ts > 0 ? Math.round((sc / ts) * 1000) / 10 : 0;
            scoreStr = `${sc}/${ts} (${scorePct.toFixed(1)}%)`;
            const isPassed = (evalGrade.remarks || '').toLowerCase() === 'passed' || scorePct >= 70;
            if (isPassed) {
              outcome = st.program.toLowerCase() === 'plus' ? 'Graduated' : 'Moved Up to Plus';
            } else {
              outcome = 'Retained Level';
            }
          }

          items.push({
            id: `active-${st.student_id}`,
            studentId: st.student_id,
            studentName: st.student_name,
            lrn: st.lrn || '—',
            program: st.program,
            classSection: classSec,
            schoolYear: selectedSchoolYear,
            semester: '1st',
            assessmentType: evalGrade?.subject || 'MOSY Assessment',
            score: scoreStr,
            scorePct,
            outcome,
            date: dateStr,
          });
        }
      }
    }

    return items;
  }, [cohortHistory, studentMap, grades, selectedSchoolYear]);

  /* ─── 2. Build Score Records ─────────────────────────────────────── */
  const scoreRecords = useMemo(() => {
    return grades.map((g) => {
      const st = studentMap.get(String(g.student));
      const gDate = g.date_logged ? g.date_logged.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const sem = getSemesterFromRecord(g.subject, gDate);
      const gLev = st?.grade_level ? (st.grade_level.includes('Grade') ? st.grade_level : `Grade ${st.grade_level}`) : 'Grade 7';
      const sec = st?.section || 'HYACINTH';
      const classSec = `${gLev} - ${sec}`;

      const sc = Number(g.score) || 0;
      const ts = Number(g.total_score) || 40;
      const pct = ts > 0 ? Math.round((sc / ts) * 1000) / 10 : 0;
      const isPassed = (g.remarks || '').toLowerCase() === 'passed' || pct >= 70;

      let timeStr = '—';
      if (g.date_logged && g.date_logged.includes('T')) {
        timeStr = new Date(g.date_logged).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      }

      return {
        id: String(g.id),
        studentName: g.student_name || st?.full_name || 'Student',
        lrn: st?.lrn || '—',
        classSection: classSec,
        subject: g.subject || 'Intervention Activity',
        quarter: g.quarter ? `Q${g.quarter}` : sem.toUpperCase(),
        scoreDisplay: `${sc} / ${ts}`,
        score: sc,
        totalScore: ts,
        percentage: pct,
        isPassed,
        remarks: g.remarks || (isPassed ? 'Passed' : 'Needs Intervention'),
        date: gDate,
        time: timeStr,
        semester: sem,
      };
    });
  }, [grades, studentMap]);

  /* ─── 3. Build QR Attendance Records ─────────────────────────────── */
  const attendanceRecords = useMemo(() => {
    return attendance.map((att) => {
      const st = studentMap.get(String(att.user));
      const attDate = att.date ? att.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const sem = getSemesterFromRecord(null, attDate);
      const gLev = st?.grade_level ? (st.grade_level.includes('Grade') ? st.grade_level : `Grade ${st.grade_level}`) : 'Grade 7';
      const sec = st?.section || 'HYACINTH';
      const classSec = `${gLev} - ${sec}`;

      return {
        id: String(att.id),
        studentName: att.user_name || st?.full_name || 'Student',
        lrn: st?.lrn || '—',
        classSection: classSec,
        date: attDate,
        timeIn: att.time_in || '—',
        timeOut: att.time_out || '—',
        session: att.session ? 'QR Scan Session' : 'Manual Entry',
        status: att.status,
        semester: sem,
      };
    });
  }, [attendance, studentMap]);

  /* ─── Filtered Datasets based on School Year, Semester, Class, Search, Date ─── */
  const filteredAssessments = useMemo(() => {
    return assessmentRecords.filter((rec) => {
      if (selectedSemester !== 'all' && rec.semester !== selectedSemester) return false;
      if (selectedClass !== 'all' && rec.classSection !== selectedClass) return false;
      if (selectedDate && rec.date !== selectedDate) return false;
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        return (
          rec.studentName.toLowerCase().includes(q) ||
          rec.lrn.toLowerCase().includes(q) ||
          rec.classSection.toLowerCase().includes(q) ||
          rec.program.toLowerCase().includes(q) ||
          rec.outcome.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [assessmentRecords, selectedSemester, selectedClass, selectedDate, studentSearch]);

  const filteredScores = useMemo(() => {
    return scoreRecords.filter((rec) => {
      if (selectedSemester !== 'all' && rec.semester !== selectedSemester) return false;
      if (selectedClass !== 'all' && rec.classSection !== selectedClass) return false;
      if (selectedDate && rec.date !== selectedDate) return false;
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        return (
          rec.studentName.toLowerCase().includes(q) ||
          rec.lrn.toLowerCase().includes(q) ||
          rec.classSection.toLowerCase().includes(q) ||
          rec.subject.toLowerCase().includes(q) ||
          rec.remarks.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scoreRecords, selectedSemester, selectedClass, selectedDate, studentSearch]);

  const filteredAttendance = useMemo(() => {
    return attendanceRecords.filter((rec) => {
      if (selectedSemester !== 'all' && rec.semester !== selectedSemester) return false;
      if (selectedClass !== 'all' && rec.classSection !== selectedClass) return false;
      if (selectedDate && rec.date !== selectedDate) return false;
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        return (
          rec.studentName.toLowerCase().includes(q) ||
          rec.lrn.toLowerCase().includes(q) ||
          rec.classSection.toLowerCase().includes(q) ||
          rec.status.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [attendanceRecords, selectedSemester, selectedClass, selectedDate, studentSearch]);

  /* ─── Logged Dates Set for Calendar Highlighting ─────────────────── */
  const loggedDates = useMemo(() => {
    const dates = new Set<string>();
    if (activeTab === 'roster') {
      filteredAssessments.forEach((r) => dates.add(r.date));
    } else if (activeTab === 'scores') {
      filteredScores.forEach((r) => dates.add(r.date));
    } else {
      filteredAttendance.forEach((r) => dates.add(r.date));
    }
    return dates;
  }, [activeTab, filteredAssessments, filteredScores, filteredAttendance]);

  /* ─── Group Records by Week (Matching TutorScores layout) ────────── */
  const weekGroups = useMemo(() => {
    let rawList: Array<any> = [];
    if (activeTab === 'roster') rawList = filteredAssessments;
    else if (activeTab === 'scores') rawList = filteredScores;
    else rawList = filteredAttendance;

    const groupsMap = new Map<string, { weekMonday: string; title: string; rows: any[] }>();

    for (const item of rawList) {
      const monday = getWeekKey(item.date);
      if (!groupsMap.has(monday)) {
        groupsMap.set(monday, {
          weekMonday: monday,
          title: getWeekTitle(monday),
          rows: [],
        });
      }
      groupsMap.get(monday)!.rows.push(item);
    }

    // Sort weeks descending (most recent week first)
    const sorted = Array.from(groupsMap.values()).sort((a, b) => b.weekMonday.localeCompare(a.weekMonday));
    return sorted;
  }, [activeTab, filteredAssessments, filteredScores, filteredAttendance]);

  /* ─── Sorting Logic per Table ────────────────────────────────────── */
  const sortRosterRows = (rows: typeof filteredAssessments) => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (rosterSortField === 'studentName') cmp = a.studentName.localeCompare(b.studentName);
      else if (rosterSortField === 'lrn') cmp = a.lrn.localeCompare(b.lrn);
      else if (rosterSortField === 'program') cmp = a.program.localeCompare(b.program);
      else if (rosterSortField === 'classSection') cmp = a.classSection.localeCompare(b.classSection);
      else if (rosterSortField === 'assessmentType') cmp = a.assessmentType.localeCompare(b.assessmentType);
      else if (rosterSortField === 'score') cmp = a.scorePct - b.scorePct;
      else if (rosterSortField === 'outcome') cmp = a.outcome.localeCompare(b.outcome);
      else if (rosterSortField === 'date') cmp = a.date.localeCompare(b.date);
      return rosterSortDir === 'asc' ? cmp : -cmp;
    });
  };

  const sortScoreRows = (rows: typeof filteredScores) => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (scoreSortField === 'studentName') cmp = a.studentName.localeCompare(b.studentName);
      else if (scoreSortField === 'lrn') cmp = a.lrn.localeCompare(b.lrn);
      else if (scoreSortField === 'subject') cmp = a.subject.localeCompare(b.subject);
      else if (scoreSortField === 'quarter') cmp = a.quarter.localeCompare(b.quarter);
      else if (scoreSortField === 'score') cmp = a.percentage - b.percentage;
      else if (scoreSortField === 'remarks') cmp = a.remarks.localeCompare(b.remarks);
      else if (scoreSortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (scoreSortField === 'time') cmp = a.time.localeCompare(b.time);
      return scoreSortDir === 'asc' ? cmp : -cmp;
    });
  };

  const sortAttendanceRows = (rows: typeof filteredAttendance) => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (attSortField === 'studentName') cmp = a.studentName.localeCompare(b.studentName);
      else if (attSortField === 'lrn') cmp = a.lrn.localeCompare(b.lrn);
      else if (attSortField === 'classSection') cmp = a.classSection.localeCompare(b.classSection);
      else if (attSortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (attSortField === 'timeIn') cmp = a.timeIn.localeCompare(b.timeIn);
      else if (attSortField === 'timeOut') cmp = a.timeOut.localeCompare(b.timeOut);
      else if (attSortField === 'session') cmp = a.session.localeCompare(b.session);
      else if (attSortField === 'status') cmp = a.status.localeCompare(b.status);
      return attSortDir === 'asc' ? cmp : -cmp;
    });
  };

  const handleToggleRosterSort = (field: string) => {
    if (rosterSortField === field) setRosterSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setRosterSortField(field); setRosterSortDir('asc'); }
  };

  const handleToggleScoreSort = (field: string) => {
    if (scoreSortField === field) setScoreSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setScoreSortField(field); setScoreSortDir('asc'); }
  };

  const handleToggleAttSort = (field: string) => {
    if (attSortField === field) setAttSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setAttSortField(field); setAttSortDir('asc'); }
  };

  const totalCurrentRecordsCount =
    activeTab === 'roster'
      ? filteredAssessments.length
      : activeTab === 'scores'
      ? filteredScores.length
      : filteredAttendance.length;

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Top Filters Bar: School Year, Semester (to the right of SY), Handled Classes ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-4">
          {/* 1. School Year Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="school-year-select" className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
              School Year:
            </label>
            <select
              id="school-year-select"
              value={selectedSchoolYear}
              onChange={(e) => setSelectedSchoolYear(e.target.value)}
              className="font-bold text-xs sm:text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white shadow-2xs focus:outline-none cursor-pointer"
            >
              {schoolYears.length === 0 ? (
                <option value="2026-2027">SY 2026–2027</option>
              ) : (
                schoolYears.map((sy) => (
                  <option key={sy.id || sy.school_year} value={sy.school_year}>
                    SY {sy.school_year}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Semester Selector (to the right of School Year) */}
          <div className="flex items-center gap-2">
            <label htmlFor="semester-select" className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
              Semester:
            </label>
            <select
              id="semester-select"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value as any)}
              className="font-bold text-xs sm:text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white shadow-2xs focus:outline-none cursor-pointer"
            >
              <option value="all">All Semesters</option>
              <option value="1st">1st Semester (Q1 & Q2 / MOSY)</option>
              <option value="2nd">2nd Semester (Q3 & Q4 / EOSY)</option>
              <option value="summer">Summer Remediation</option>
            </select>
          </div>

          {/* 3. Handled Class Section Selector (Replaces old Evaluation Period) */}
          <div className="flex items-center gap-2">
            <label htmlFor="class-select" className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
              Handled Class:
            </label>
            <select
              id="class-select"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="font-bold text-xs sm:text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white shadow-2xs focus:outline-none cursor-pointer"
            >
              <option value="all">All Handled Classes</option>
              {filteredHandledClasses.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── View Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => { setActiveTab('roster'); setSelectedDate(null); }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'roster'
              ? 'bg-[#0052B7] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
          }`}
        >
          Class Assessment and Final Result
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('scores'); setSelectedDate(null); }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'scores'
              ? 'bg-[#0052B7] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
          }`}
        >
          Score Records
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('attendance'); setSelectedDate(null); }}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-[#0052B7] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
          }`}
        >
          QR Attendance Records
        </button>
      </div>

      {/* ── Table Container Header (Matching TutorScores layout) ── */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <div className="flex flex-col gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {activeTab === 'roster'
                ? 'CLASS ASSESSMENT AND FINAL RESULT'
                : activeTab === 'scores'
                ? 'STUDENTS SCORES HISTORY'
                : 'STUDENT QR ATTENDANCE HISTORY'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              {totalCurrentRecordsCount} Record{totalCurrentRecordsCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Field */}
            <label className="relative flex w-full sm:w-auto sm:min-w-56 items-center">
              <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search Student Name"
                className="h-8 w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 pl-9 pr-3 text-xs font-medium text-slate-800 dark:text-zinc-200 outline-none transition placeholder:text-slate-400 focus:border-[#0052B7] focus:bg-white dark:focus:bg-zinc-950"
              />
            </label>

            {/* Calendar Popover Trigger */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                onClick={() => setShowCalendar((prev) => !prev)}
                className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border p-0 transition-all ${
                  selectedDate
                    ? 'border-[#0052B7] bg-[#0052B7] text-white'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-[#0052B7] hover:text-white hover:border-[#0052B7]'
                }`}
                title="Select a specific date from calendar"
                aria-label="Open calendar"
              >
                <Calendar className="w-4 h-4" />
              </button>

              {showCalendar && (
                <ArchiveCalendarDropdown
                  selectedDate={selectedDate}
                  onSelectDate={(d) => setSelectedDate(d)}
                  onClear={() => setSelectedDate(null)}
                  onClose={() => setShowCalendar(false)}
                  loggedDates={loggedDates}
                />
              )}
            </div>
          </div>
        </div>

        {/* Selected Date Indicator Banner */}
        {selectedDate && (
          <div className="flex items-center gap-2 px-5 py-2 border-b border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/70 dark:bg-emerald-950/30">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="ml-auto flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear Date Filter
            </button>
          </div>
        )}

        {/* ── Table Content Body with Week Number & Weekday Buttons ── */}
        <div className="p-4 sm:p-5 space-y-6">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading historical records...</div>
          ) : weekGroups.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-zinc-500 font-medium">
              No historical records found for the selected filters.
            </div>
          ) : (
            weekGroups.map((group) => {
              const weekRecordDates = new Set(group.rows.map((r: any) => r.date));
              const weekdays = getWeekdaysForMonday(group.weekMonday, Array.from(weekRecordDates));

              // Filter rows by date if user clicked a weekday pill button
              const displayRows = selectedDate
                ? group.rows.filter((r: any) => r.date === selectedDate)
                : group.rows;

              if (selectedDate && displayRows.length === 0) {
                return null;
              }

              return (
                <div key={group.weekMonday} className="space-y-3">
                  {/* Week Header Row with Week Number and Weekday Pill Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-2.5 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 py-0.5">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white select-none">
                          {group.title}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {weekdays.map((dateStr) => {
                          const hasRecords = weekRecordDates.has(dateStr);
                          const isDateActive = selectedDate === dateStr;
                          const label = formatDateButtonLabel(dateStr);

                          return (
                            <button
                              key={dateStr}
                              type="button"
                              disabled={!hasRecords}
                              onClick={() => {
                                setSelectedDate(isDateActive ? null : dateStr);
                              }}
                              className={`h-7.5 whitespace-nowrap rounded-md px-3 text-[11px] font-bold uppercase transition-all inline-flex items-center gap-1.5 ${
                                hasRecords
                                  ? isDateActive
                                    ? 'bg-[#0052B7] text-white shadow-xs border border-[#0052B7] cursor-pointer'
                                    : 'bg-blue-50/80 text-[#0052B7] border border-blue-200/80 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 dark:hover:bg-blue-900/50 cursor-pointer font-semibold'
                                  : 'bg-slate-100 dark:bg-zinc-900 text-slate-400 dark:text-zinc-600 border border-slate-200 dark:border-zinc-800 cursor-not-allowed opacity-50'
                              }`}
                              title={hasRecords ? `Filter to ${label}` : `No records on ${label}`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="text-[11px] font-semibold text-slate-400">
                      {displayRows.length} Record{displayRows.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* ── Table View based on Active Tab ── */}
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
                    {activeTab === 'roster' ? (
                      /* Table 1: Class Assessment and Final Result */
                      <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-300">
                        <thead className="bg-slate-50 dark:bg-zinc-900/70 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="STUDENT" field="studentName" currentField={rosterSortField} direction={rosterSortDir} onSort={handleToggleRosterSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="LRN" field="lrn" currentField={rosterSortField} direction={rosterSortDir} onSort={handleToggleRosterSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="CLASS & SECTION" field="classSection" currentField={rosterSortField} direction={rosterSortDir} onSort={handleToggleRosterSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="PROGRAM LEVEL" field="program" currentField={rosterSortField} direction={rosterSortDir} onSort={handleToggleRosterSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="ASSESSMENT TYPE" field="assessmentType" currentField={rosterSortField} direction={rosterSortDir} onSort={handleToggleRosterSort} />
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap">
                              <SortableHeader label="SCORE / %" field="score" currentField={rosterSortField} direction={rosterSortDir} onSort={handleToggleRosterSort} align="center" />
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap">
                              <SortableHeader label="FINAL OUTCOME" field="outcome" currentField={rosterSortField} direction={rosterSortDir} onSort={handleToggleRosterSort} align="center" />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="DATE" field="date" currentField={rosterSortField} direction={rosterSortDir} onSort={handleToggleRosterSort} />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 bg-white dark:bg-zinc-950">
                          {sortRosterRows(displayRows).map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                {item.studentName}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                {item.lrn}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                                {item.classSection}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                                  {item.program}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                                {item.assessmentType}
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                                {item.score}
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                    item.outcome.includes('Graduated') || item.outcome.includes('Moved Up')
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
                                      : item.outcome.includes('In Progress')
                                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900'
                                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900'
                                  }`}
                                >
                                  {item.outcome}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[11px] font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                {item.date}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : activeTab === 'scores' ? (
                      /* Table 2: Score Records */
                      <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-300">
                        <thead className="bg-slate-50 dark:bg-zinc-900/70 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="STUDENT" field="studentName" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="LRN" field="lrn" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="DESCRIPTION / ACTIVITY" field="subject" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="PERIOD" field="quarter" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap">
                              <SortableHeader label="SCORE" field="score" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap">
                              <SortableHeader label="REMARK" field="remarks" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} align="center" />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="DATE" field="date" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="TIME" field="time" currentField={scoreSortField} direction={scoreSortDir} onSort={handleToggleScoreSort} />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 bg-white dark:bg-zinc-950">
                          {sortScoreRows(displayRows).map((grade) => (
                            <tr key={grade.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                {grade.studentName}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                {grade.lrn}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                                {grade.subject}
                              </td>
                              <td className="px-4 py-3 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                {grade.quarter}
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                                {grade.scoreDisplay}
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                                    grade.isPassed
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                                  }`}
                                >
                                  {grade.remarks}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[11px] font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                {grade.date}
                              </td>
                              <td className="px-4 py-3 text-[11px] font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                {grade.time}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      /* Table 3: QR Attendance Records */
                      <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-300">
                        <thead className="bg-slate-50 dark:bg-zinc-900/70 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="STUDENT" field="studentName" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="LRN" field="lrn" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="CLASS & SECTION" field="classSection" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="DATE" field="date" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="TIME IN" field="timeIn" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="TIME OUT" field="timeOut" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                              <SortableHeader label="SESSION MODE" field="session" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} />
                            </th>
                            <th className="px-4 py-3 text-center whitespace-nowrap">
                              <SortableHeader label="STATUS" field="status" currentField={attSortField} direction={attSortDir} onSort={handleToggleAttSort} align="center" />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 bg-white dark:bg-zinc-950">
                          {sortAttendanceRows(displayRows).map((att) => (
                            <tr key={att.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                {att.studentName}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                {att.lrn}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                                {att.classSection}
                              </td>
                              <td className="px-4 py-3 text-[11px] font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                {att.date}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                                {att.timeIn}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                                {att.timeOut}
                              </td>
                              <td className="px-4 py-3 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                {att.session}
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${
                                    att.status === 'present'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
                                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900'
                                  }`}
                                >
                                  {att.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
