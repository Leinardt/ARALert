import React, { useState, useEffect, useRef } from 'react';
import type { User, Grade } from '../types';
import { exportScoresToExcel, ScoreExportData } from '../utils/scoreExportService';

export interface ExportScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  students: User[];
  grades: Grade[];
  initialMode?: 'all' | 'daily' | 'weekly';
  initialTargetKey?: string;
}

const formatStudentNameDepEd = (student: User): string => {
  const ln = (student.last_name || '').toUpperCase().trim();
  const fn = (student.first_name || '').toUpperCase().trim();
  let mi = '';
  if (student.middle_name && student.middle_name.trim()) {
    mi = `${student.middle_name.trim()[0].toUpperCase()}.`;
  }
  if (!ln && !fn) return (student.full_name || '').toUpperCase();
  return `${ln}, ${fn}${mi ? ' ' + mi : ''}`;
};

const getWeekStartKey = (dateObj: Date): string => {
  const d = new Date(dateObj);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().slice(0, 10);
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
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

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
        {calendarCells.map((dayNum, idx) => {
          if (dayNum === null) {
            return <div key={`empty-${idx}`} className="h-8" />;
          }

          const cellDateKey = formatDateKey(year, month, dayNum);
          const cellDateObj = new Date(year, month, dayNum);
          const cellWeekStartKey = getWeekStartKey(cellDateObj);

          const entriesCount = loggedDatesCount[cellDateKey] || 0;
          const hasLoggedData = entriesCount > 0;

          const isDaySelected = exportMode === 'daily' && selectedDateKey === cellDateKey;
          const isWeekSelected = exportMode === 'weekly' && selectedWeekKey === cellWeekStartKey;

          return (
            <button
              key={cellDateKey}
              type="button"
              onClick={() => {
                if (exportMode === 'daily') {
                  onSelectDate(cellDateKey);
                } else if (exportMode === 'weekly') {
                  onSelectWeek(cellWeekStartKey);
                } else {
                  onSelectDate(cellDateKey);
                }
              }}
              className={`relative flex flex-col items-center justify-center h-8 rounded-xl transition text-xs ${
                isDaySelected
                  ? 'bg-[var(--brand)] text-white font-bold shadow-sm'
                  : isWeekSelected
                  ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300'
                  : hasLoggedData
                  ? 'bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{dayNum}</span>
              {hasLoggedData && !isDaySelected && !isWeekSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          <span>Has score entries</span>
        </div>
        <span className="italic">
          {exportMode === 'weekly' ? 'Click any date to select its week' : 'Click a date to select'}
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

  const printRef = useRef<HTMLDivElement>(null);

  // Set default tutor name from current logged in user
  useEffect(() => {
    if (currentUser?.full_name) {
      setTutorName(currentUser.full_name.toUpperCase());
    }
  }, [currentUser]);

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
      const ws = new Date(selectedWeekKey);
      const we = new Date(ws.getTime() + 6 * 24 * 60 * 60 * 1000);
      setDateStr(`${ws.toLocaleDateString()} - ${we.toLocaleDateString()}`);
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

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Please allow popups to print score sheet.');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${subjectTitle} - ${gradeSection}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Calibri', 'Arial', sans-serif; color: #000; margin: 0; padding: 0; }
            .header-text { text-align: center; }
            .header-title { font-size: 14pt; font-weight: bold; margin: 2px 0; }
            .header-sub { font-size: 11pt; margin: 1px 0; }
            .section-title { font-size: 12pt; font-weight: bold; margin-top: 15px; margin-bottom: 2px; }
            .meta-row { display: flex; justify-content: space-between; font-size: 11pt; font-weight: bold; margin: 15px 0 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 4px 6px; font-size: 10.5pt; }
            th { text-align: center; font-weight: bold; height: 26px; }
            td.center { text-align: center; }
            td.name-col { text-align: left; }
            .signatures { margin-top: 40px; font-size: 11pt; }
            .sig-row { display: flex; justify-content: space-between; margin-top: 30px; }
            .sig-box { text-align: center; width: 45%; }
            .sig-name { font-weight: bold; text-decoration: underline; text-transform: uppercase; margin-top: 35px; }
            .sig-title { font-size: 10pt; margin-top: 2px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white p-6 shadow-xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto space-y-4">
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
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              {showSettings ? 'Hide Header Settings' : 'Edit Header & Signatures'}
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
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4 text-xs">
            <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Template Header Settings</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Division</label>
                <input
                  type="text"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">School Name</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">School Address</label>
                <input
                  type="text"
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Subject Title</label>
                <input
                  type="text"
                  value={subjectTitle}
                  onChange={(e) => setSubjectTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Grade & Section</label>
                <input
                  type="text"
                  value={gradeSection}
                  onChange={(e) => setGradeSection(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Week Number</label>
                <input
                  type="text"
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Date Header</label>
                <input
                  type="text"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pt-2 border-t border-slate-200">Signatures</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Prepared by (Tutor)</label>
                <input
                  type="text"
                  value={tutorName}
                  onChange={(e) => setTutorName(e.target.value)}
                  placeholder="TUTOR FULL NAME"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Checked by (HT/Asst.)</label>
                <input
                  type="text"
                  value={checkedName}
                  onChange={(e) => setCheckedName(e.target.value)}
                  placeholder="FIRSTNAME M.I. LASTNAME"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Noted by (Principal)</label>
                <input
                  type="text"
                  value={notedName}
                  onChange={(e) => setNotedName(e.target.value)}
                  placeholder="FIRSTNAME M.I. LASTNAME"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* Live Preview Container */}
        <div className="mt-4 rounded-2xl border border-slate-300 bg-white p-6 shadow-sm overflow-x-auto">
          <div ref={printRef} className="max-w-2xl mx-auto text-slate-900 font-serif">
            {/* Header Section */}
            <div className="text-center space-y-0.5">
              <p className="text-xs uppercase tracking-wider text-slate-600">{division}</p>
              <p className="text-xs uppercase tracking-wider text-slate-600">{district}</p>
              <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900">{schoolName}</h4>
              <p className="text-xs text-slate-500">{schoolAddress}</p>

              <div className="pt-3 pb-1">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">{subjectTitle}</h3>
                <p className="text-xs font-semibold text-slate-700">{gradeSection}</p>
                <p className="text-xs tracking-widest text-slate-600 uppercase mt-0.5">{taskTitle}</p>
              </div>
            </div>

            {/* Sub-header meta row */}
            <div className="flex justify-between items-center text-xs font-semibold my-3 px-1 text-slate-800">
              <div>WEEK # <span className="border-b border-slate-800 px-3">{weekNumber || '___'}</span></div>
              <div>Date: <span className="border-b border-slate-800 px-3">{dateStr || '_______'}</span></div>
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

            {/* Footer Signatures */}
            <div className="mt-8 space-y-6 text-xs text-slate-900">
              <div className="flex justify-end">
                <div className="text-center w-64">
                  <p className="italic text-left mb-6">Prepared by:</p>
                  <p className="font-bold underline uppercase tracking-wide">{tutorName || (currentUser?.full_name || 'TUTOR NAME')}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{tutorTitle}</p>
                </div>
              </div>

              <div className="flex justify-between items-start pt-4">
                <div className="text-center w-56">
                  <p className="italic text-left mb-6">Checked:</p>
                  <p className="font-bold underline uppercase tracking-wide">{checkedName}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{checkedTitle}</p>
                </div>

                <div className="text-center w-56">
                  <p className="italic text-left mb-6">Noted:</p>
                  <p className="font-bold underline uppercase tracking-wide">{notedName}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{notedTitle}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 pt-3 pb-1 flex flex-col sm:flex-row items-center justify-end gap-3 z-10">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition shadow-sm"
          >
            🖨️ Print / Save PDF
          </button>
          <button
            type="button"
            onClick={handleExcelExport}
            disabled={isExporting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-60"
          >
            📊 {isExporting ? 'Exporting...' : 'Download Excel (.xlsx)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportScoreModal;
