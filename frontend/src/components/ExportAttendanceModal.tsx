import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { User, Attendance } from '../types';
import { userService } from '../services/userService';
import {
  exportAttendanceToExcel,
  AttendanceExportData,
  AttendanceExportWeek,
} from '../utils/attendanceExportService';
import { exportAttendanceToDocx } from '../utils/attendanceDocxExportService';
import { exportAttendanceToPdf } from '../utils/attendancePdfExportService';
import { DEPED_LOGO_SRC, PNAHS_LOGO_SRC } from '../assets/template_logos/logosBase64';
import { formatStudentName } from '../utils/studentFormatters';

export interface ExportAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  students: User[];
  attendanceLogs: Attendance[];
  initialMode?: 'all' | 'daily' | 'weekly' | 'monthly';
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

export const getAttendanceWeeksForMonth = (
  year: number,
  month: number // 0-indexed: 0 = Jan, 11 = Dec
): AttendanceExportWeek[] => {
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
      <div className="flex items-center justify-between pb-2.5 pt-0.5 border-b border-slate-100">
        <span className="font-bold text-slate-900 text-xs tracking-wide">{monthName}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="flex items-center justify-center w-6 h-6 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold transition cursor-pointer"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="flex items-center justify-center w-6 h-6 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold transition cursor-pointer"
            aria-label="Next Month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center font-bold text-slate-400 py-2 text-[10px] uppercase tracking-wider">
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
                ? 'bg-[var(--brand-light)] text-[var(--brand-darker)] font-bold border border-[var(--brand-border)] shadow-xs'
                : isWeekSelected
                  ? cell.isCurrentMonth
                    ? 'bg-[var(--brand-light)] text-[var(--brand-darker)] font-bold border border-[var(--brand-border)]'
                    : 'bg-[var(--brand-light)]/50 text-[var(--brand-darker)]/85 font-semibold border border-dashed border-[var(--brand-border)]/70'
                  : isMonthSelected
                    ? 'bg-[var(--brand-light)]/70 text-[var(--brand-darker)] font-semibold border border-[var(--brand-border)]/50 hover:bg-[var(--brand-light)]'
                    : hasLoggedData
                      ? cell.isCurrentMonth
                        ? 'bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200'
                        : 'bg-slate-50/80 text-slate-400 font-medium hover:bg-slate-100 hover:text-slate-600'
                      : cell.isCurrentMonth
                        ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 hover:text-slate-900'
                        : 'text-slate-300 dark:text-slate-600 font-normal hover:text-slate-500 hover:bg-slate-50/60'
                }`}
            >
              <span className={`text-[11px] ${!cell.isCurrentMonth && !isDaySelected && !isWeekSelected ? 'opacity-80' : ''}`}>
                {cell.dayNum}
              </span>
              {hasLoggedData && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${cell.isCurrentMonth ? 'bg-[var(--brand)]' : 'bg-[var(--brand)]/40'
                    }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[9.5px] text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)] inline-block" />
          <span>Has attendance record</span>
        </div>
        <span className="text-[9px] text-slate-400 italic">
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
  const [dateStr, setDateStr] = useState(() => formatNumericDate(new Date()));

  const [tutorName, setTutorName] = useState('');
  const [tutorTitle, setTutorTitle] = useState('ARAL Tutor');
  const [checkedName, setCheckedName] = useState('FIRSTNAME M.I. LASTNAME');
  const [checkedTitle, setCheckedTitle] = useState('HT/Asst. to the Principal');
  const [notedName, setNotedName] = useState('FIRSTNAME M.I. LASTNAME');
  const [notedTitle, setNotedTitle] = useState('Principal I');

  const [paperSize, setPaperSize] = useState<'a4' | 'folio' | 'letter'>('letter');
  const [numWeeks, setNumWeeks] = useState<3 | 4>(3);
  const [customWeekLabels, setCustomWeekLabels] = useState<Record<number, string>>({});

  const [exportMode, setExportMode] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>('');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [weekNumber, setWeekNumber] = useState<string>('1');

  const [showSettings, setShowSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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
        console.error('Failed to load active principal for attendance sheet:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Extract logged dates count
  const loggedDatesCount = attendanceLogs.reduce((acc, log) => {
    const d = log.date;
    if (d) {
      acc[d] = (acc[d] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const computeWeekOfMonth = (dateObj: Date): number => {
    // School weeks run Mon-Fri. Use Wednesday (school midweek) to determine which month this school week primarily belongs to
    const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const day = d.getDay();
    const wedDiff = day === 0 ? 3 : (3 - day);
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

  // Compute weeks dynamically based on exportMode
  const weeks: AttendanceExportWeek[] = useMemo(() => {
    if (exportMode === 'daily') {
      const targetDate = selectedDateKey || new Date().toISOString().slice(0, 10);
      const [y, m, d] = targetDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return [
        {
          label: formatNumericDate(dateObj),
          days: [{ dateKey: targetDate, dayNum: String(d) }],
        },
      ];
    }

    if (exportMode === 'weekly') {
      const targetWeek = selectedWeekKey || getWeekStartKey(new Date());
      const [y, m, d] = targetWeek.split('-').map(Number);
      const mon = new Date(y, m - 1, d);
      const days = [];
      for (let i = 0; i < 5; i++) {
        const cur = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
        days.push({
          dateKey: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
          dayNum: String(cur.getDate()),
        });
      }
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
    const computed = getAttendanceWeeksForMonth(yr, mo - 1);
    return computed.map((w, idx) => ({
      ...w,
      label: customWeekLabels[idx] || w.label,
    }));
  }, [exportMode, selectedDateKey, selectedWeekKey, selectedMonthKey, customWeekLabels]);

  const allDays = useMemo(() => weeks.flatMap((w) => w.days), [weeks]);

  const colWidths = useMemo(() => {
    if (allDays.length === 1) {
      return { index: '32px', name: '280px', day: '140px', sig: '180px' };
    }
    if (allDays.length <= 5) {
      return { index: '28px', name: '260px', day: '45px', sig: '160px' };
    }
    const dayWidth = allDays.length > 20 ? '19.5px' : '22px';
    const nameWidth = allDays.length > 20 ? '205px' : '220px';
    const sigWidth = allDays.length > 20 ? '85px' : '95px';
    return { index: '22px', name: nameWidth, day: dayWidth, sig: sigWidth };
  }, [allDays.length]);

  if (!isOpen) return null;

  const sortedStudents = [...students].sort((a, b) => {
    const nameA = formatStudentNameDepEd(a);
    const nameB = formatStudentNameDepEd(b);
    return nameA.localeCompare(nameB);
  });

  const getExportData = (): AttendanceExportData => ({
    division,
    district,
    schoolName,
    schoolAddress,
    subjectTitle,
    gradeSection,
    weekNumber,
    dateStr,
    paperSize,
    tutorName: tutorName || (currentUser?.full_name || 'TUTOR NAME').toUpperCase(),
    tutorTitle,
    checkedName,
    checkedTitle,
    notedName,
    notedTitle,
    weeks,
    students: sortedStudents.map((student) => {
      const statusByDate: Record<string, string> = {};
      allDays.forEach((day) => {
        const dayLog = attendanceLogs.find(
          (l) => String(l.user) === String(student.id) && l.date === day.dateKey
        );
        if (dayLog) {
          if (dayLog.status === 'present') statusByDate[day.dateKey] = 'P';
          else if (dayLog.status === 'late') statusByDate[day.dateKey] = 'L';
          else if (dayLog.status === 'absent') statusByDate[day.dateKey] = 'A';
        }
      });
      return {
        id: String(student.id),
        name: formatStudentNameDepEd(student),
        lrn: student.lrn,
        statusByDate,
      };
    }),
  });

  const handleDocxExport = async () => {
    try {
      setIsExportingDocx(true);
      await exportAttendanceToDocx(getExportData());
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
      await exportAttendanceToExcel(getExportData());
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Failed to generate Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportAttendanceToPdf(getExportData());
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      alert(`Failed to generate PDF file: ${err?.message || err}. Please check the browser console for details.`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="relative w-full max-w-[96vw] 2xl:max-w-[1640px] h-[95vh] max-h-[95vh] rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Fixed Top Header (Solid Opaque, Non-scrollable) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 px-5 py-2.5 sm:py-3 flex-shrink-0 bg-white z-20">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">EXPORT STUDENT ATTENDANCE SHEET</h3>
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
              className="rounded-xl border border-slate-200 bg-slate-50 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-2.5 space-y-2.5 scroll-smooth">
          {/* Header Settings Form - Displayed at the Top */}
          {showSettings && (
            <div ref={settingsRef} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-6 text-xs animate-in fade-in duration-150 shadow-xs">
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
                    <label className="block text-slate-700 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">DOCUMENT TITLE</label>
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

          {/* Two-Column Body: Left (Controls + Calendar), Right (Fixed-Size Paper Sheet Preview) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Paper Size, Week Count & Calendar Picker */}
            <div className="lg:col-span-4 xl:col-span-3 2xl:col-span-3 space-y-2 lg:sticky lg:top-0">
              {/* Paper Size Selector */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Paper Size</span>
                  <span className="text-[10px] font-bold text-[var(--brand)]">
                    {PAPER_CONFIG[paperSize].label}
                  </span>
                </div>
                <div className="flex bg-white dark:bg-[#111111] border border-slate-200 rounded-xl p-0.5 gap-1 shadow-2xs">
                  {(['letter', 'a4', 'folio'] as const).map((sizeKey) => (
                    <button
                      key={sizeKey}
                      type="button"
                      onClick={() => setPaperSize(sizeKey)}
                      title={PAPER_CONFIG[sizeKey].label}
                      className={`flex-1 rounded-lg h-7 py-1 px-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer text-center whitespace-nowrap flex items-center justify-center ${paperSize === sizeKey
                        ? 'bg-[var(--brand)] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                    >
                      {sizeKey === 'letter' ? 'Short' : sizeKey === 'a4' ? 'A4' : 'Long'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Filter Bar */}
              {/* Connected Date Filter & Calendar Container */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden text-xs">
                {/* Connected Filter Bar Header */}
                <div className="bg-slate-50/80 border-b border-slate-200 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SELECT DATE</span>
                  </div>
                  <div className="flex bg-white dark:bg-[#111111] border border-slate-200 rounded-xl p-0.5 gap-1 shadow-2xs">
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
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                      >
                        {mode === 'daily' ? 'Day' : mode === 'weekly' ? 'Week' : 'Month'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs font-medium text-slate-600 px-1 pt-3">
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400">WEEK:</span>
                      <input
                        type="text"
                        value={weekNumber}
                        onChange={(e) => setWeekNumber(e.target.value)}
                        className="w-5 py-0.5 text-left font-bold text-slate-800 bg-transparent border-0 p-0 text-xs focus:outline-none cursor-text"
                        title="Edit Week Number"
                        placeholder="1"
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0" title={dateStr}>
                      <span className="text-[10px] uppercase font-bold text-slate-400">DATE:</span>
                      <span className="text-[10.5px] font-bold text-slate-900 whitespace-nowrap">
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
            </div>

            {/* Right Column: Physical Paper Sheet Preview */}
            <div className="lg:col-span-8 xl:col-span-9 2xl:col-span-9 flex flex-col min-w-0">
              {/* Paper Workspace Canvas */}
              <div className="rounded-2xl border border-slate-200 bg-slate-100/90 dark:bg-slate-900/40 p-4 sm:p-6 overflow-x-auto flex flex-col items-center shadow-inner">
                {/* Physical Sheet Card with Fixed Proportions */}
                <div
                  ref={printRef}
                  data-print-container="true"
                  style={{
                    width: PAPER_CONFIG[paperSize].width,
                    minHeight: PAPER_CONFIG[paperSize].minHeight,
                    fontFamily: "'Times New Roman', Times, Georgia, serif",
                  }}
                  className={`bg-white shadow-xl border border-slate-300 ${exportMode === 'monthly'
                    ? 'pt-20 pb-20 px-8 sm:px-10'
                    : 'pt-20 pb-20 px-12 sm:px-16'
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

                  <div className="text-center pt-2.5 pb-3.5 sm:pb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">{subjectTitle}</h3>
                    <p className="text-xs font-semibold text-slate-700">{gradeSection}</p>
                  </div>

                  {/* Period Meta Row with WEEK: on the left and DATE: on the right */}
                  <div className="flex justify-between items-center text-xs font-bold mt-4 sm:mt-5 mb-3 px-1 text-slate-900">
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

                  {/* DepEd Multi-Week Attendance Register Table */}
                  <table className="w-full border-collapse border border-slate-800 text-xs table-fixed">
                    <thead>
                      {/* Row 1: Top Header (Week Date Ranges with border below and single line) */}
                      <tr className="bg-slate-50 text-slate-900">
                        <th
                          rowSpan={2}
                          className="border border-slate-800 px-0.5 py-2.5 text-center font-bold text-[10px] bg-slate-50 uppercase whitespace-nowrap align-middle"
                          style={{ width: colWidths.index }}
                        >
                          #
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-slate-800 px-2 py-2.5 text-center font-bold text-[10.5px] bg-slate-50 uppercase tracking-wide whitespace-nowrap align-middle"
                          style={{ width: colWidths.name }}
                        >
                          NAME OF THE STUDENTS
                        </th>
                        {exportMode === 'daily' ? (
                          <th
                            rowSpan={2}
                            className="border border-slate-800 px-2 py-2.5 text-center font-bold text-[10px] bg-slate-50 whitespace-nowrap uppercase align-middle"
                            style={{ width: colWidths.day }}
                          >
                            {weeks[0]?.label || 'DATE'}
                          </th>
                        ) : (
                          weeks.map((week, wIdx) => (
                            <th
                              key={`week-head-${wIdx}`}
                              colSpan={week.days.length}
                              className={`border border-slate-800 px-0.5 py-2 text-center font-bold bg-slate-50 whitespace-nowrap align-middle ${allDays.length > 5 ? 'text-[9px]' : 'text-[10px]'
                                }`}
                            >
                              {week.label}
                            </th>
                          ))
                        )}
                        <th
                          rowSpan={2}
                          className="border border-slate-800 px-1 py-2.5 text-center font-bold text-[10px] bg-slate-50 uppercase whitespace-nowrap align-middle"
                          style={{ width: colWidths.sig }}
                        >
                          SIGNATURE
                        </th>
                      </tr>

                      {/* Row 2: Normal Upright Numbers on each cell (not rendered for daily mode) */}
                      {exportMode !== 'daily' && (
                        <tr className="bg-white text-slate-900 border-b border-slate-800 h-7">
                          {allDays.map((day) => (
                            <th
                              key={`day-head-${day.dateKey}`}
                              className={`border border-slate-800 py-1.5 text-center font-bold bg-white text-slate-900 whitespace-nowrap align-middle ${allDays.length > 5 ? 'text-[9.5px]' : 'text-[10.5px]'
                                }`}
                              style={{ width: colWidths.day }}
                              title={day.dateKey}
                            >
                              {day.dayNum}
                            </th>
                          ))}
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {sortedStudents.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2 + allDays.length + 1}
                            className="border border-slate-800 py-6 text-center text-slate-500 italic"
                          >
                            No assigned students found.
                          </td>
                        </tr>
                      ) : (
                        sortedStudents.map((student, idx) => {
                          const studentName = formatStudentNameDepEd(student);
                          return (
                            <tr key={student.id} className="hover:bg-slate-50">
                              <td
                                className="border border-slate-800 px-0.5 py-1 text-center font-medium text-[10.5px] whitespace-nowrap"
                                style={{ width: colWidths.index }}
                              >
                                {idx + 1}
                              </td>
                              <td
                                className={`border border-slate-800 px-1.5 py-1 font-semibold uppercase text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis ${allDays.length > 5 ? 'text-[10px]' : 'text-[10.5px]'
                                  }`}
                                style={{ width: colWidths.name }}
                              >
                                {studentName}
                              </td>
                              {allDays.map((day) => {
                                const dayLog = attendanceLogs.find(
                                  (l) => String(l.user) === String(student.id) && l.date === day.dateKey
                                );
                                let mark = '';
                                let colorClass = '';
                                if (dayLog) {
                                  if (dayLog.status === 'present') {
                                    mark = '/';
                                    colorClass = 'text-emerald-700 font-bold';
                                  } else if (dayLog.status === 'late') {
                                    mark = '/';
                                    colorClass = 'text-amber-700 font-bold';
                                  } else if (dayLog.status === 'absent') {
                                    mark = 'X';
                                    colorClass = 'text-rose-700 font-bold';
                                  }
                                }
                                return (
                                  <td
                                    key={`cell-${student.id}-${day.dateKey}`}
                                    className={`border border-slate-800 p-0 text-center font-bold whitespace-nowrap ${allDays.length > 5 ? 'text-[10px]' : 'text-[11px]'
                                      } ${colorClass}`}
                                    style={{ width: colWidths.day }}
                                  >
                                    {mark}
                                  </td>
                                );
                              })}
                              <td className="border border-slate-800 px-2 py-1 text-center font-mono text-xs" style={{ width: colWidths.sig }}></td>
                            </tr>
                          );
                        })
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
            </div>
          </div>
        </div>

        {/* Fixed, 100% Solid Opaque Footer for Save/Export Buttons */}
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-5 py-2.5 flex flex-col sm:flex-row items-center justify-end gap-2 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDocxExport}
            disabled={isExportingDocx}
            className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            {isExportingDocx ? 'Downloading DOC...' : 'Download Document (.docx)'}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            {isExportingPdf ? 'Downloading PDF...' : 'Download PDF (.pdf)'}
          </button>
          <button
            type="button"
            onClick={handleExcelExport}
            disabled={isExporting}
            className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            {isExporting ? 'Exporting...' : 'Download Excel (.xlsx)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportAttendanceModal;
