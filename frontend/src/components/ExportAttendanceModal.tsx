import React, { useState, useEffect, useRef } from 'react';
import type { User, Attendance } from '../types';
import { exportAttendanceToExcel, AttendanceExportData } from '../utils/attendanceExportService';

export interface ExportAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  students: User[];
  attendanceLogs: Attendance[];
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
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().slice(0, 10);
};

const formatDateKey = (year: number, month: number, day: number): string => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
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

// ─── Interactive Calendar Picker Component ──────────────────────────────────
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
  loggedDatesCount,
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
    <div
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-xs select-none"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
          aria-label="Previous Month"
        >
          &lt;
        </button>
        <span className="font-bold text-slate-900 text-xs tracking-wide">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
          aria-label="Next Month"
        >
          &gt;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400 py-2 text-[10px] uppercase tracking-wider">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

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
              className={`relative flex flex-col items-center justify-center h-8 rounded-xl transition text-xs cursor-pointer ${
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
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--brand)]" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="h-2 w-2 rounded-full bg-[var(--brand)] inline-block" />
          <span>Has attendance logs</span>
        </div>
        <span className="text-[10px] uppercase font-bold text-slate-400">
          {exportMode === 'weekly' ? 'Click date to select week' : 'Click date to select'}
        </span>
      </div>
    </div>
  );
};

// ─── Main Modal Component ───────────────────────────────────────────────────
export const ExportAttendanceModal: React.FC<ExportAttendanceModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  students,
  attendanceLogs,
  initialMode = 'all',
  initialTargetKey = '',
}) => {
  const [division, setDivision] = useState('DIVISION OF MASBATE');
  const [district, setDistrict] = useState('PALANAS NORTH DISTRICT');
  const [schoolName, setSchoolName] = useState('PALANAS NATIONAL AGRICULTURE HIGH SCHOOL');
  const [schoolAddress, setSchoolAddress] = useState('Sta. Cruz, Palanas, Masbate');

  const [subjectTitle, setSubjectTitle] = useState('ARAL PROGRAM STUDENT ATTENDANCE RECORD');
  const [gradeSection, setGradeSection] = useState('GRADE 8-MANGO');
  const [dateStr, setDateStr] = useState(
    new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  );

  const [tutorName, setTutorName] = useState('');
  const [tutorTitle, setTutorTitle] = useState('ARAL TUTOR');
  const [checkedName, setCheckedName] = useState('FIRSTNAME M.I. LASTNAME');
  const [checkedTitle, setCheckedTitle] = useState('HT/Asst. to the Principal');
  const [notedName, setNotedName] = useState('FIRSTNAME M.I. LASTNAME');
  const [notedTitle, setNotedTitle] = useState('Principal I');

  const [exportMode, setExportMode] = useState<'all' | 'daily' | 'weekly'>(initialMode);
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>('');

  const [showCalendar, setShowCalendar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser?.full_name) {
      setTutorName(currentUser.full_name.toUpperCase());
    }
  }, [currentUser]);

  // Extract logged dates count
  const loggedDatesCount = attendanceLogs.reduce((acc, log) => {
    const d = log.date;
    if (d) {
      acc[d] = (acc[d] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

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

  const sortedStudents = [...students].sort((a, b) => {
    const nameA = formatStudentNameDepEd(a);
    const nameB = formatStudentNameDepEd(b);
    return nameA.localeCompare(nameB);
  });

  const studentExportRows = sortedStudents.map((student) => {
    let logsForStudent: Attendance[] = [];

    if (exportMode === 'daily' && selectedDateKey) {
      logsForStudent = attendanceLogs.filter(
        (log) => String(log.user) === String(student.id) && log.date === selectedDateKey
      );
    } else if (exportMode === 'weekly' && selectedWeekKey) {
      const weekStartObj = new Date(selectedWeekKey);
      const weekEndObj = new Date(weekStartObj.getTime() + 7 * 24 * 60 * 60 * 1000);
      logsForStudent = attendanceLogs.filter((log) => {
        if (String(log.user) !== String(student.id)) return false;
        const lTime = new Date(log.date).getTime();
        return lTime >= weekStartObj.getTime() && lTime < weekEndObj.getTime();
      });
    } else {
      logsForStudent = attendanceLogs.filter((log) => String(log.user) === String(student.id));
    }

    const latestLog = logsForStudent.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    const statusDisplay = latestLog
      ? latestLog.status === 'present'
        ? 'Present'
        : latestLog.status === 'late'
        ? 'Late'
        : 'Absent'
      : 'Absent';

    return {
      id: student.id,
      name: formatStudentNameDepEd(student),
      lrn: student.lrn,
      status: statusDisplay,
      timeIn: latestLog?.time_in ? formatTimeString(latestLog.time_in) : '—',
      activityTitle: latestLog?.aral_activity_title || 'General',
    };
  });

  const getExportData = (): AttendanceExportData => ({
    division,
    district,
    schoolName,
    schoolAddress,
    subjectTitle,
    gradeSection,
    dateStr,
    tutorName: tutorName || (currentUser?.full_name || 'TUTOR NAME').toUpperCase(),
    tutorTitle,
    checkedName,
    checkedTitle,
    notedName,
    notedTitle,
    students: studentExportRows,
  });

  const handleExcelExport = async () => {
    try {
      setIsExporting(true);
      await exportAttendanceToExcel(getExportData());
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
    if (!printWindow) return alert('Please allow popups to print attendance sheet.');

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="relative w-full max-w-4xl rounded-3xl bg-white p-6 shadow-xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Attendance Export</p>
            <h3 className="text-lg font-bold text-slate-900">Export Student Attendance Sheet</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              {showSettings ? 'Hide Header Settings' : 'Edit Header & Signatures'}
            </button>
          </div>
        </div>

        {/* Scope Selector Bar styled to match discussion pattern */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Scope:</span>
            <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-0.5 gap-0.5">
              {(['all', 'daily', 'weekly'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setExportMode(mode)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    exportMode === mode
                      ? 'bg-[var(--brand)] text-white shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                  }`}
                >
                  {mode === 'all' ? 'All' : mode === 'daily' ? 'Day' : 'Week'}
                </button>
              ))}
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

        {/* Header Settings Form */}
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">School Name</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">School Address</label>
                <input
                  type="text"
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Document Title</label>
                <input
                  type="text"
                  value={subjectTitle}
                  onChange={(e) => setSubjectTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Grade &amp; Section</label>
                <input
                  type="text"
                  value={gradeSection}
                  onChange={(e) => setGradeSection(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:border-[var(--brand)]"
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Checked by (HT/Asst.)</label>
                <input
                  type="text"
                  value={checkedName}
                  onChange={(e) => setCheckedName(e.target.value)}
                  placeholder="FIRSTNAME M.I. LASTNAME"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Noted by (Principal)</label>
                <input
                  type="text"
                  value={notedName}
                  onChange={(e) => setNotedName(e.target.value)}
                  placeholder="FIRSTNAME M.I. LASTNAME"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:border-[var(--brand)]"
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
              </div>
            </div>

            {/* Date meta row */}
            <div className="flex justify-between items-center text-xs font-semibold my-3 px-1 text-slate-800">
              <div>Date / Period: <span className="border-b border-slate-800 px-3">{dateStr || '_______'}</span></div>
            </div>

            {/* Attendance Table */}
            <table className="w-full border-collapse border border-slate-800 text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-900">
                  <th className="border border-slate-800 px-2 py-1.5 w-10 text-center font-bold">#</th>
                  <th className="border border-slate-800 px-3 py-1.5 text-left font-bold">NAME OF STUDENTS</th>
                  <th className="border border-slate-800 px-3 py-1.5 text-center font-bold w-28">LRN</th>
                  <th className="border border-slate-800 px-3 py-1.5 text-center font-bold w-24">STATUS</th>
                  <th className="border border-slate-800 px-3 py-1.5 text-center font-bold w-24">TIME IN</th>
                  <th className="border border-slate-800 px-3 py-1.5 text-left font-bold">ACTIVITY / REMARKS</th>
                  <th className="border border-slate-800 px-3 py-1.5 text-center font-bold w-24">SIGNATURE</th>
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
                      <td className="border border-slate-800 px-3 py-1 text-center font-mono text-slate-700">{row.lrn || 'N/A'}</td>
                      <td className="border border-slate-800 px-3 py-1 text-center font-bold">
                        <span className={
                          row.status === 'Present' ? 'text-emerald-700' :
                          row.status === 'Late' ? 'text-amber-700' : 'text-rose-700'
                        }>
                          {row.status}
                        </span>
                      </td>
                      <td className="border border-slate-800 px-3 py-1 text-center font-mono">{row.timeIn}</td>
                      <td className="border border-slate-800 px-3 py-1 text-left text-slate-700">{row.activityTitle}</td>
                      <td className="border border-slate-800 px-3 py-1 text-center font-mono"></td>
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
        <div className="sticky bottom-0 bg-white border-t border-slate-200 pt-3 pb-1 flex flex-col sm:flex-row items-center justify-end gap-2.5 z-10">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            Print / Save PDF
          </button>
          <button
            type="button"
            onClick={handleExcelExport}
            disabled={isExporting}
            className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {isExporting ? 'Exporting...' : 'Download Excel (.xlsx)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportAttendanceModal;
