import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { User, Grade } from '../types';
import { userService } from '../services/userService';
import { exportScoresToExcel, ScoreExportData } from '../utils/scoreExportService';
import { exportScoresToDocx } from '../utils/scoreDocxExportService';
import { downloadElementAsPdf } from '../utils/pdfExportService';

import { formatStudentName } from '../utils/studentFormatters';
import { DEPED_LOGO_SRC, PNAHS_LOGO_SRC } from '../assets/template_logos/logosBase64';

export interface ExportScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  students: User[];
  grades: Grade[];
  initialMode?: 'all' | 'daily' | 'weekly';
  initialTargetKey?: string;
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

// Interactive Calendar Picker Component
interface CalendarPickerProps {
  exportMode: 'all' | 'daily' | 'weekly';
  selectedDateKey: string;
  selectedWeekKey: string;
  onSelectDate: (dateKey: string) => void;
  onSelectWeek: (weekStartKey: string) => void;
  loggedDatesCount: Record<string, number>;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({
  exportMode,
  selectedDateKey,
  selectedWeekKey,
  onSelectDate,
  onSelectWeek,
  loggedDatesCount
}) => {
  const [viewDate, setViewDate] = useState(() => new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-xs select-none">
      {/* Calendar Month Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg p-1 hover:bg-slate-100 text-slate-600 transition"
        >
          ◀
        </button>
        <span className="font-bold text-slate-800">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg p-1 hover:bg-slate-100 text-slate-600 transition"
        >
          ▶
        </button>
      </div>

      {/* Weekday Titles */}
      <div className="grid grid-cols-7 gap-1 text-center font-semibold text-slate-400 py-2 text-[11px]">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell) => {
          const entriesCount = loggedDatesCount[cell.cellDateKey] || 0;
          const hasLoggedData = entriesCount > 0;

          const isDaySelected = exportMode === 'daily' && selectedDateKey === cell.cellDateKey;
          const isWeekday = cell.isWeekday;
          const isWeekSelected = exportMode === 'weekly' && selectedWeekKey === cell.cellWeekStartKey && isWeekday;

          return (
            <button
              key={cell.cellDateKey}
              type="button"
              onClick={() => {
                if (exportMode === 'daily') {
                  onSelectDate(cell.cellDateKey);
                } else if (exportMode === 'weekly') {
                  onSelectWeek(cell.cellWeekStartKey);
                } else {
                  onSelectDate(cell.cellDateKey);
                }
              }}
              title={cell.isCurrentMonth ? cell.cellDateKey : `${cell.cellDateKey} (Adjacent month)`}
              className={`relative flex flex-col items-center justify-center h-8 rounded-xl transition text-xs ${
                isDaySelected
                  ? 'bg-[var(--brand)] text-white font-bold shadow-sm'
                  : isWeekSelected
                    ? cell.isCurrentMonth
                      ? 'bg-[var(--brand-light)] text-[var(--brand-darker)] font-bold border border-[var(--brand-border)]'
                      : 'bg-[var(--brand-light)]/50 text-[var(--brand-darker)]/85 font-semibold border border-dashed border-[var(--brand-border)]/70'
                    : hasLoggedData
                      ? cell.isCurrentMonth
                        ? 'bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200'
                        : 'bg-slate-50/80 text-slate-400 font-medium hover:bg-slate-100 hover:text-slate-600'
                      : cell.isCurrentMonth
                        ? 'text-slate-600 hover:bg-slate-50'
                        : 'text-slate-300 dark:text-slate-600 font-normal hover:text-slate-500 hover:bg-slate-50/60'
              }`}
            >
              <span className={!cell.isCurrentMonth && !isDaySelected && !isWeekSelected ? 'opacity-80' : ''}>
                {cell.dayNum}
              </span>
              {hasLoggedData && !isDaySelected && !isWeekSelected && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${
                    cell.isCurrentMonth ? 'bg-emerald-500' : 'bg-emerald-500/40'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          <span>Has score entries</span>
        </div>
        <span className="italic text-[10px] text-slate-400">
          {exportMode === 'weekly' ? 'Mon – Fri week filter' : 'Click a date to select'}
        </span>
      </div>
    </div>
  );
};

export const ExportScoreModal: React.FC<ExportScoreModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  students,
  grades,
  initialMode = 'all',
  initialTargetKey = ''
}) => {
  const [division, setDivision] = useState('DIVISION OF MASBATE');
  const [district, setDistrict] = useState('PALANAS NORTH DISTRICT');
  const [schoolName, setSchoolName] = useState('PALANAS NATIONAL AGRICULTURE HIGH SCHOOL');
  const [schoolAddress, setSchoolAddress] = useState('Sta. Cruz, Palanas, Masbate');

  const [subjectTitle, setSubjectTitle] = useState('ARAL READING BASIC CLASS');
  const [gradeSection, setGradeSection] = useState('GRADE 8-MANGO');
  const [taskTitle, setTaskTitle] = useState('WEEKLY TASK');
  const [weekNumber, setWeekNumber] = useState('1');
  const [dateStr, setDateStr] = useState(new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }));

  const [tutorName, setTutorName] = useState('');
  const [tutorTitle, setTutorTitle] = useState('ARAL TUTOR');
  const [checkedName, setCheckedName] = useState('FIRSTNAME M.I. LASTNAME');
  const [checkedTitle, setCheckedTitle] = useState('HT/Asst. to the Principal');
  const [notedName, setNotedName] = useState('FIRSTNAME M.I. LASTNAME');
  const [notedTitle, setNotedTitle] = useState('Principal I');

  // Export scope selection state
  const [exportMode, setExportMode] = useState<'all' | 'daily' | 'weekly'>(initialMode);
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>('');

  const [showCalendar, setShowCalendar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const handleToggleSettings = () => {
    setShowSettings((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          if (modalScrollRef.current) {
            modalScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
          settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
      return next;
    });
  };

  // Set default tutor name from current logged in user
  useEffect(() => {
    if (currentUser?.full_name) {
      setTutorName(currentUser.full_name.toUpperCase());
    }
  }, [currentUser]);

  // Load active principal for the school
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

  // Extract available dates and count of entries per date
  const assessmentGrades = grades.filter((g) => g.component_type === 'assessment');

  const loggedDatesCount = assessmentGrades.reduce((acc, g) => {
    const d = new Date(g.date_logged);
    const dateKey = d.toISOString().slice(0, 10);
    acc[dateKey] = (acc[dateKey] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Initialize selected date / week options when modal opens or initialMode changes
  useEffect(() => {
    if (!isOpen) return;
    setExportMode(initialMode);

    const loggedDateKeys = Object.keys(loggedDatesCount).sort().reverse();

    if (initialMode === 'daily') {
      const targetDate = initialTargetKey || (loggedDateKeys[0] ?? new Date().toISOString().slice(0, 10));
      setSelectedDateKey(targetDate);
    } else if (initialMode === 'weekly') {
      const targetWeek = initialTargetKey || getWeekStartKey(new Date());
      setSelectedWeekKey(targetWeek);
    } else {
      if (loggedDateKeys.length > 0) setSelectedDateKey(loggedDateKeys[0]);
      setSelectedWeekKey(getWeekStartKey(new Date()));
    }
  }, [isOpen, initialMode, initialTargetKey]);

  // Sync dateStr automatically whenever mode or selected date/week changes
  useEffect(() => {
    if (exportMode === 'daily' && selectedDateKey) {
      const [year, month, day] = selectedDateKey.split('-');
      setDateStr(`${month}/${day}/${year}`);
    } else if (exportMode === 'weekly' && selectedWeekKey) {
      const [year, month, day] = selectedWeekKey.split('-').map(Number);
      const ws = new Date(year, month - 1, day);
      const we = new Date(year, month - 1, day + 4);
      const m1 = String(ws.getMonth() + 1).padStart(2, '0');
      const d1 = String(ws.getDate()).padStart(2, '0');
      const m2 = String(we.getMonth() + 1).padStart(2, '0');
      const d2 = String(we.getDate()).padStart(2, '0');
      setDateStr(`${m1}/${d1}/${ws.getFullYear()} - ${m2}/${d2}/${we.getFullYear()}`);
    } else if (exportMode === 'all') {
      setDateStr(new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }));
    }
  }, [exportMode, selectedDateKey, selectedWeekKey]);

  if (!isOpen) return null;

  // Process students and filter grades based on export mode
  const sortedStudents = [...students].sort((a, b) => {
    const nameA = formatStudentNameDepEd(a);
    const nameB = formatStudentNameDepEd(b);
    return nameA.localeCompare(nameB);
  });

  const studentExportRows = sortedStudents.map((student) => {
    let studentGrades: Grade[] = [];

    if (exportMode === 'daily' && selectedDateKey) {
      studentGrades = assessmentGrades
        .filter((g) => g.student === student.id && new Date(g.date_logged).toISOString().slice(0, 10) === selectedDateKey)
        .sort((a, b) => new Date(a.date_logged).getTime() - new Date(b.date_logged).getTime());
    } else if (exportMode === 'weekly' && selectedWeekKey) {
      const weekStartObj = new Date(selectedWeekKey);
      const weekEndObj = new Date(weekStartObj.getTime() + 7 * 24 * 60 * 60 * 1000);
      studentGrades = assessmentGrades
        .filter((g) => {
          if (g.student !== student.id) return false;
          const gTime = new Date(g.date_logged).getTime();
          return gTime >= weekStartObj.getTime() && gTime < weekEndObj.getTime();
        })
        .sort((a, b) => new Date(a.date_logged).getTime() - new Date(b.date_logged).getTime());
    } else {
      // 'all' mode: map recent assessment scores
      studentGrades = assessmentGrades
        .filter((g) => g.student === student.id)
        .sort((a, b) => new Date(a.date_logged).getTime() - new Date(b.date_logged).getTime());
    }

    const score1 = studentGrades[0]?.score !== undefined ? Number(studentGrades[0].score) : '';
    const score2 = studentGrades[1]?.score !== undefined ? Number(studentGrades[1].score) : '';
    const score3 = studentGrades[2]?.score !== undefined ? Number(studentGrades[2].score) : '';
    const score4 = studentGrades[3]?.score !== undefined ? Number(studentGrades[3].score) : '';

    const validScores = [score1, score2, score3, score4].filter((s) => typeof s === 'number') as number[];
    const totalScore = validScores.length > 0 ? validScores.reduce((acc, curr) => acc + curr, 0) : '';

    return {
      id: student.id,
      name: formatStudentNameDepEd(student),
      scores: [score1, score2, score3, score4],
      totalScore
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
    tutorName: tutorName || (currentUser?.full_name || 'TUTOR NAME').toUpperCase(),
    tutorTitle,
    checkedName,
    checkedTitle,
    notedName,
    notedTitle,
    students: studentExportRows
  });

  const handleDocxExport = async () => {
    try {
      setIsExportingDocx(true);
      await exportScoresToDocx(getExportData());
    } catch (err: any) {
      console.error('Failed to export DOCX:', err);
      alert(`Failed to generate DOCX file: ${err?.message || err}.`);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExcelExport = async () => {
    try {
      setIsExporting(true);
      await exportScoresToExcel(getExportData());
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Failed to generate Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    const printContent = printRef.current;
    if (!printContent) return;

    try {
      setIsExportingPdf(true);
      const cleanSection = (gradeSection || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanWeek = `Week_${weekNumber || '1'}`;
      const filename = `ARALert_ScoreSheet_${cleanSection}_${cleanWeek}.pdf`;

      await downloadElementAsPdf(printContent, {
        filename,
        paperSize: 'a4',
      });
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      alert(`Failed to generate PDF file: ${err?.message || err}. Please try again.`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div ref={modalScrollRef} className="relative w-full max-w-4xl rounded-3xl bg-white p-6 shadow-xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto space-y-4 scroll-smooth">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Export Score Sheet</h3>
            <p className="text-xs text-slate-500 mt-1">Official DepEd Weekly Task Score Sheet format</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              {showCalendar ? 'Hide Calendar' : '📅 Show Calendar'}
            </button>
            <button
              type="button"
              onClick={handleToggleSettings}
              className="rounded-xl bg-[var(--brand)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[var(--brand-dark)] transition shadow-xs cursor-pointer"
            >
              {showSettings ? 'Hide Template Details' : 'Edit Template Details'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scope Selector Bar (All / Specific Day / Specific Week) */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Export Scope:</span>
            <div className="inline-flex rounded-xl bg-slate-200/80 p-1">
              <button
                type="button"
                onClick={() => setExportMode('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  exportMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Records
              </button>
              <button
                type="button"
                onClick={() => setExportMode('daily')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  exportMode === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Specific Day
              </button>
              <button
                type="button"
                onClick={() => setExportMode('weekly')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  exportMode === 'weekly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Specific Week
              </button>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-600">
            Selected Range: <span className="text-[var(--brand)] font-bold">{dateStr}</span>
          </div>
        </div>

        {/* Calendar Picker Section */}
        {showCalendar && exportMode !== 'all' && (
          <div className="mt-4">
            <CalendarPicker
              exportMode={exportMode}
              selectedDateKey={selectedDateKey}
              selectedWeekKey={selectedWeekKey}
              onSelectDate={(dKey) => setSelectedDateKey(dKey)}
              onSelectWeek={(wKey) => setSelectedWeekKey(wKey)}
              loggedDatesCount={loggedDatesCount}
            />
          </div>
        )}

        {/* Dynamic Header Settings Form */}
        {showSettings && (
          <div ref={settingsRef} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-6 text-xs animate-in fade-in duration-150 shadow-xs">
            {/* Section 1: HEADER */}
            <div className="pb-1">
              <div className="mb-4">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-sm">
                  HEADER
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">DIVISION</label>
                  <input
                    type="text"
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">DISTRICT</label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">SCHOOL NAME</label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">SCHOOL ADDRESS</label>
                  <input
                    type="text"
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">SUBJECT TITLE</label>
                  <input
                    type="text"
                    value={subjectTitle}
                    onChange={(e) => setSubjectTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">GRADE &amp; SECTION</label>
                  <input
                    type="text"
                    value={gradeSection}
                    onChange={(e) => setGradeSection(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: WEEK & DATE (sectioned line) */}
            <div className="pt-5 border-t border-slate-200 pb-1">
              <div className="mb-4">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-sm">
                  WEEK &amp; DATE
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-full sm:w-36">
                  <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">WEEK NUMBER</label>
                  <input
                    type="text"
                    value={weekNumber}
                    onChange={(e) => setWeekNumber(e.target.value)}
                    placeholder="1, 2, 3..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div className="w-full sm:w-72">
                  <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">DATE</label>
                  <input
                    type="text"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    placeholder="MM/DD/YYYY or Date Range"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: SIGNATURES (sectioned line) */}
            <div className="pt-5 border-t border-slate-200 pb-2">
              <div className="mb-4">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-sm">
                  SIGNATURES
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">PREPARED BY (TUTOR NAME)</label>
                  <input
                    type="text"
                    value={tutorName}
                    onChange={(e) => setTutorName(e.target.value)}
                    placeholder="TUTOR FULL NAME"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">CHECKED BY (HT / ASST. NAME)</label>
                  <input
                    type="text"
                    value={checkedName}
                    onChange={(e) => setCheckedName(e.target.value)}
                    placeholder="FIRSTNAME M.I. LASTNAME"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">NOTED BY (PRINCIPAL NAME)</label>
                  <input
                    type="text"
                    value={notedName}
                    onChange={(e) => setNotedName(e.target.value)}
                    placeholder="FIRSTNAME M.I. LASTNAME"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Preview Container */}
        <div className="mt-4 rounded-2xl border border-slate-300 bg-white p-6 shadow-sm overflow-x-auto">
          <div
            ref={printRef}
            data-print-container="true"
            style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
            className="max-w-2xl mx-auto bg-white pt-20 pb-20 px-12 sm:px-16 text-slate-900 font-serif shadow-xl border border-slate-300"
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

            <div className="text-center pt-2.5 pb-3.5 sm:pb-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">{subjectTitle}</h3>
              <p className="text-xs font-semibold text-slate-700">{gradeSection}</p>
              <p className="text-xs tracking-widest text-slate-600 uppercase mt-0.5">{taskTitle}</p>
            </div>

            {/* Sub-header meta row */}
            <div className="flex justify-between items-center text-xs font-semibold mt-4 sm:mt-5 mb-3 px-1 text-slate-800">
              <div className="inline-flex items-center gap-1.5">
                <span>WEEK #:</span>
                <div className="inline-flex flex-col items-center min-w-[50px]">
                  <span className="font-semibold text-slate-900 px-2 pb-0.5 leading-none">{weekNumber || '___'}</span>
                  <div className="w-full h-[1.5px] bg-slate-900" />
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <span>Date:</span>
                <div className="inline-flex flex-col items-center min-w-[140px]">
                  <span className="font-semibold text-slate-900 px-2 pb-0.5 leading-none">{dateStr || '_______'}</span>
                  <div className="w-full h-[1.5px] bg-slate-900" />
                </div>
              </div>
            </div>

            {/* Scores Table */}
            <table className="w-full border-collapse border border-slate-800 text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-900">
                  <th className="border border-slate-800 px-2 py-1.5 w-10 text-center font-bold">#</th>
                  <th className="border border-slate-800 px-3 py-1.5 text-left font-bold">NAME OF STUDENTS</th>
                  <th className="border border-slate-800 px-2 py-1.5 w-10 text-center font-bold">1</th>
                  <th className="border border-slate-800 px-2 py-1.5 w-10 text-center font-bold">2</th>
                  <th className="border border-slate-800 px-2 py-1.5 w-10 text-center font-bold">3</th>
                  <th className="border border-slate-800 px-2 py-1.5 w-10 text-center font-bold">4</th>
                  <th className="border border-slate-800 px-3 py-1.5 w-24 text-center font-bold">Total Score</th>
                </tr>
              </thead>
              <tbody>
                {studentExportRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-800 py-6 text-center text-slate-500 italic">
                      No assigned students found for the selected scope.
                    </td>
                  </tr>
                ) : (
                  studentExportRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="border border-slate-800 px-2 py-1 text-center font-medium">{idx + 1}</td>
                      <td className="border border-slate-800 px-3 py-1 font-semibold uppercase text-slate-900">{row.name}</td>
                      <td className="border border-slate-800 px-2 py-1 text-center">{row.scores[0] ?? ''}</td>
                      <td className="border border-slate-800 px-2 py-1 text-center">{row.scores[1] ?? ''}</td>
                      <td className="border border-slate-800 px-2 py-1 text-center">{row.scores[2] ?? ''}</td>
                      <td className="border border-slate-800 px-2 py-1 text-center">{row.scores[3] ?? ''}</td>
                      <td className="border border-slate-800 px-3 py-1 text-center font-bold">{row.totalScore}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Footer Signatures matching formal academic spacing */}
            <div className="mt-10 space-y-7 text-xs text-slate-900">
              <div className="flex justify-end">
                <div className="text-center w-64">
                  <p className="italic text-left mb-8">Prepared by:</p>
                  <div className="inline-flex flex-col items-center min-w-[190px] max-w-[240px]">
                    <span className="font-bold uppercase tracking-wide text-slate-900 pb-1 text-center">
                      {tutorName || (currentUser?.full_name || 'TUTOR NAME')}
                    </span>
                    <div className="w-full h-[2px] bg-slate-900" />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">{tutorTitle}</p>
                </div>
              </div>

              <div className="flex justify-between items-start pt-4">
                <div className="text-center w-60">
                  <p className="italic text-left mb-8">Checked:</p>
                  <div className="inline-flex flex-col items-center min-w-[190px] max-w-[240px]">
                    <span className="font-bold uppercase tracking-wide text-slate-900 pb-1 text-center">
                      {checkedName}
                    </span>
                    <div className="w-full h-[2px] bg-slate-900" />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">{checkedTitle}</p>
                </div>

                <div className="text-center w-60">
                  <p className="italic text-left mb-8">Noted:</p>
                  <div className="inline-flex flex-col items-center min-w-[190px] max-w-[240px]">
                    <span className="font-bold uppercase tracking-wide text-slate-900 pb-1 text-center">
                      {notedName}
                    </span>
                    <div className="w-full h-[2px] bg-slate-900" />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">{notedTitle}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 pt-3 pb-1 flex flex-col sm:flex-row items-center justify-end gap-2.5 z-10">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDocxExport}
            disabled={isExportingDocx}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {isExportingDocx ? 'Downloading DOC...' : 'Download DOC (.docx)'}
          </button>
          <button
            type="button"
            onClick={handleExcelExport}
            disabled={isExporting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {isExporting ? 'Exporting...' : 'Download Excel (.xlsx)'}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {isExportingPdf ? 'Downloading PDF...' : 'Download PDF (.pdf)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportScoreModal;
