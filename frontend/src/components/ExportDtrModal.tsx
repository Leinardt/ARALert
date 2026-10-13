import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  UserCheck,
  Scissors,
  Printer,
  Search,
} from 'lucide-react';
import type { Attendance, User } from '../types';
import { userService } from '../services/userService';
import { exportDtrToExcel } from '../utils/dtrExportService';
import { exportDtrToDocx } from '../utils/dtrDocxExportService';
import { downloadElementAsPdf } from '../utils/pdfExportService';

export interface ExportDtrModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  attendanceLogs: Attendance[];
  staffUsers?: User[];
  defaultStaffId?: string;
  defaultMonthKey?: string;
}

const PAPER_CONFIG: Record<
  'letter' | 'a4' | 'folio',
  { label: string; width: string; minHeight: string; pageCss: string }
> = {
  letter: {
    label: 'Short / Letter (8.5 × 11 in)',
    width: '816px',
    minHeight: '1056px',
    pageCss: '@page { size: letter portrait; margin: 8mm; }',
  },
  a4: {
    label: 'A4 (210 × 297 mm)',
    width: '794px',
    minHeight: '1123px',
    pageCss: '@page { size: A4 portrait; margin: 8mm; }',
  },
  folio: {
    label: 'Long / Folio (8.5 × 13 in)',
    width: '816px',
    minHeight: '1248px',
    pageCss: '@page { size: 8.5in 13in portrait; margin: 8mm; }',
  },
};

const formatTime12h = (val?: string | null): string => {
  if (!val) return '';
  const match = val.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  if (!match) return val;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]}`;
};

const timeStringToMinutes = (val?: string | null): number | null => {
  if (!val) return null;
  const match = val.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const ExportDtrModal: React.FC<ExportDtrModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  attendanceLogs,
  staffUsers,
  defaultStaffId,
  defaultMonthKey,
}) => {
  // Config & Template details
  const [schoolName, setSchoolName] = useState('PALANAS NATIONAL AGRICULTURE HIGH SCHOOL');
  const [inChargeName, setInChargeName] = useState('EULOGIO C. GADIA');
  const [inChargeTitle, setInChargeTitle] = useState('School Principal');
  const [officeHoursRegular, setOfficeHoursRegular] = useState('8:00 AM - 12:00 PM / 1:00 PM - 5:00 PM');
  const [officeHoursArrivalDeparture, setOfficeHoursArrivalDeparture] = useState('8:00 AM & 5:00 PM');
  const [officeHoursSaturdays, setOfficeHoursSaturdays] = useState('As required');

  // Modal UI state
  const [showSettings, setShowSettings] = useState(false);
  const [paperSize, setPaperSize] = useState<'letter' | 'a4' | 'folio'>('letter');
  const [copyMode, setCopyMode] = useState<'duplicate' | 'dual'>('duplicate');
  const [confirmDownloadFormat, setConfirmDownloadFormat] = useState<'docx' | 'pdf' | 'excel' | null>(null);

  // Active Month selection
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    if (defaultMonthKey) return defaultMonthKey;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Staff members list
  const [loadedStaff, setLoadedStaff] = useState<User[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedStaffRightId, setSelectedStaffRightId] = useState<string>('');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Export progress states
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Fetch staff users if not passed in props
  useEffect(() => {
    if (!isOpen) return;
    if (staffUsers && staffUsers.length > 0) {
      setLoadedStaff(staffUsers);
      return;
    }

    Promise.all([
      userService.getAllUsers({ role: 'tutor' }).catch(() => [] as User[]),
      userService.getAllUsers({ role: 'faculty' }).catch(() => [] as User[]),
      userService.getAllUsers({ role: 'principal' }).catch(() => [] as User[]),
    ])
      .then(([tutors, faculty, principals]) => {
        const combined = [...tutors, ...faculty, ...principals];
        setLoadedStaff(combined);
      })
      .catch((err) => {
        console.error('Failed to load staff for DTR export:', err);
      });
  }, [isOpen, staffUsers]);

  // Fetch active principal for default in-charge name
  useEffect(() => {
    if (!isOpen) return;
    userService
      .getUsers({ role: 'principal', status: 'active' })
      .then((res) => {
        if (res.results && res.results.length > 0) {
          const principal = res.results[0];
          const name = principal.full_name || `${principal.first_name} ${principal.last_name}`;
          if (name && name.trim()) {
            setInChargeName(name.toUpperCase().trim());
          }
        }
      })
      .catch(() => {
        if (currentUser?.full_name) {
          setInChargeName(currentUser.full_name.toUpperCase());
        }
      });
  }, [isOpen, currentUser]);

  // Derive consolidated staff list (STRICTLY tutors, faculty, and principal only)
  const availableStaff = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string }>();

    // Add loaded users (tutor, faculty, principal only)
    loadedStaff.forEach((u) => {
      const role = (u.role || '').toLowerCase();
      if (['tutor', 'faculty', 'principal'].includes(role)) {
        const id = String(u.id);
        const name = u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Staff Member';
        map.set(id, { id, name, role: u.role || 'staff' });
      }
    });

    // Add from attendance logs (strictly tutors, faculty, or principal only)
    attendanceLogs.forEach((log) => {
      const role = (log.role || '').toLowerCase();
      if (['tutor', 'faculty', 'principal'].includes(role)) {
        const id = String(log.user || log.tutor || '');
        if (id && !map.has(id)) {
          const name = log.user_name || log.tutor_name || `Staff #${id}`;
          map.set(id, { id, name, role: log.role || 'staff' });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [loadedStaff, attendanceLogs]);

  // Auto-select staff on open
  useEffect(() => {
    if (!isOpen || availableStaff.length === 0) return;
    if (!selectedStaffId) {
      if (defaultStaffId && availableStaff.some((s) => s.id === defaultStaffId)) {
        setSelectedStaffId(defaultStaffId);
      } else {
        setSelectedStaffId(availableStaff[0].id);
      }
    }
  }, [isOpen, availableStaff, defaultStaffId, selectedStaffId]);

  // Compute active staff objects
  const currentStaff = useMemo(() => {
    return availableStaff.find((s) => s.id === selectedStaffId) || availableStaff[0] || { id: '', name: 'STAFF MEMBER', role: 'tutor' };
  }, [availableStaff, selectedStaffId]);

  const currentStaffRight = useMemo(() => {
    if (copyMode === 'duplicate') return currentStaff;
    return availableStaff.find((s) => s.id === selectedStaffRightId) || currentStaff;
  }, [availableStaff, selectedStaffRightId, currentStaff, copyMode]);

  // Filtered staff list for search
  const filteredStaffList = useMemo(() => {
    if (!staffSearchQuery.trim()) return availableStaff;
    const q = staffSearchQuery.toLowerCase();
    return availableStaff.filter((s) => s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q));
  }, [availableStaff, staffSearchQuery]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonthKey.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    setSelectedMonthKey(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonthKey.split('-').map(Number);
    const next = new Date(y, m, 1);
    setSelectedMonthKey(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = useMemo(() => {
    try {
      return new Date(`${selectedMonthKey}-01T00:00:00`).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return selectedMonthKey;
    }
  }, [selectedMonthKey]);

  // Days in month & table row generator
  const daysInSelectedMonth = useMemo(() => {
    const [y, m] = selectedMonthKey.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [selectedMonthKey]);

  // Helper to compile 31 days data for a given staff member
  const buildMonthRows = (staffId: string) => {
    const [year, month] = selectedMonthKey.split('-').map(Number);
    const rows = [];
    let totalWorkMinutes = 0;
    let daysPresentCount = 0;

    for (let day = 1; day <= 31; day++) {
      if (day > daysInSelectedMonth) {
        rows.push({
          dayNum: day,
          arrivalAm: '',
          departureAm: '',
          arrivalPm: '',
          departurePm: '',
          hours: '',
          min: '',
          hasLog: false,
        });
        continue;
      }

      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const log = attendanceLogs.find(
        (l) =>
          l.date === dateKey &&
          ['tutor', 'faculty', 'principal'].includes((l.role || '').toLowerCase()) &&
          (String(l.user) === staffId ||
            String(l.tutor) === staffId ||
            (currentStaff.name && l.user_name?.toLowerCase() === currentStaff.name.toLowerCase()))
      );

      let arrivalAm = '';
      let departureAm = '';
      let arrivalPm = '';
      let departurePm = '';
      let hoursStr = '';
      let minStr = '';
      let hasLog = false;

      if (log) {
        hasLog = true;
        daysPresentCount++;
        const legacyInMin = timeStringToMinutes(log.time_in);
        const legacyOutMin = timeStringToMinutes(log.time_out);

        const rawArrAm = log.arrival_am || (legacyInMin !== null && legacyInMin < 720 ? log.time_in : null);
        const rawDepAm = log.departure_am || (legacyOutMin !== null && legacyOutMin < 720 ? log.time_out : null);
        const rawArrPm = log.arrival_pm || (legacyInMin !== null && legacyInMin >= 720 ? log.time_in : null);
        const rawDepPm = log.departure_pm || (legacyOutMin !== null && legacyOutMin >= 720 ? log.time_out : null);

        arrivalAm = formatTime12h(rawArrAm);
        departureAm = formatTime12h(rawDepAm);
        arrivalPm = formatTime12h(rawArrPm);
        departurePm = formatTime12h(rawDepPm);

        const mArrAm = timeStringToMinutes(rawArrAm);
        const mDepAm = timeStringToMinutes(rawDepAm);
        const mArrPm = timeStringToMinutes(rawArrPm);
        const mDepPm = timeStringToMinutes(rawDepPm);

        let dMinutes = 0;
        if (mArrAm !== null && mDepAm !== null && mDepAm > mArrAm) dMinutes += mDepAm - mArrAm;
        if (mArrPm !== null && mDepPm !== null && mDepPm > mArrPm) dMinutes += mDepPm - mArrPm;

        if (dMinutes > 0) {
          totalWorkMinutes += dMinutes;
          hoursStr = String(Math.floor(dMinutes / 60));
          minStr = String(dMinutes % 60);
        }
      }

      rows.push({
        dayNum: day,
        arrivalAm,
        departureAm,
        arrivalPm,
        departurePm,
        hours: hoursStr,
        min: minStr,
        hasLog,
      });
    }

    return {
      rows,
      totalHours: totalWorkMinutes > 0 ? Math.floor(totalWorkMinutes / 60) : 0,
      totalMinutes: totalWorkMinutes > 0 ? totalWorkMinutes % 60 : 0,
      daysPresentCount,
    };
  };

  const leftFormData = useMemo(() => buildMonthRows(currentStaff.id), [currentStaff.id, selectedMonthKey, attendanceLogs, daysInSelectedMonth]);
  const rightFormData = useMemo(() => buildMonthRows(currentStaffRight.id), [currentStaffRight.id, selectedMonthKey, attendanceLogs, daysInSelectedMonth]);

  if (!isOpen) return null;

  // Toggle template details form
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

  // Direct print action
  const handleDirectPrint = () => {
    window.print();
  };

  // Initiate download action (triggers confirmation view)
  const handleInitiateDownload = (format: 'docx' | 'pdf' | 'excel') => {
    if (showSettings) setShowSettings(false);
    setTimeout(() => {
      if (scrollBodyRef.current) scrollBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      if (printRef.current) printRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    setConfirmDownloadFormat(format);
  };

  // Execute confirmed download
  const handleExecuteConfirmedDownload = async () => {
    if (!confirmDownloadFormat) return;

    if (confirmDownloadFormat === 'pdf') {
      if (!printRef.current) return;
      try {
        setIsExportingPdf(true);
        const fileName = `CS_Form_48_DTR_${currentStaff.name.replace(/\s+/g, '_')}_${selectedMonthKey}`;
        await downloadElementAsPdf(printRef.current, {
          filename: fileName,
          paperSize,
        });
        setConfirmDownloadFormat(null);
      } catch (err: any) {
        console.error('Failed to export DTR PDF:', err);
        alert(`Failed to generate PDF: ${err?.message || err}`);
      } finally {
        setIsExportingPdf(false);
      }
    } else if (confirmDownloadFormat === 'excel') {
      try {
        setIsExportingExcel(true);
        const validStaffLogs = attendanceLogs.filter((l) =>
          ['tutor', 'faculty', 'principal'].includes((l.role || '').toLowerCase())
        );
        await exportDtrToExcel({
          records: validStaffLogs,
          preparedBy: inChargeName,
          inChargeTitle,
          selectedMonth: selectedMonthKey,
          officeHoursRegular,
          officeHoursArrivalDeparture,
          officeHoursSaturdays,
          staffName: currentStaff.name,
          staffNameRight: currentStaffRight.name,
          copyMode,
          paperSize,
        });
        setConfirmDownloadFormat(null);
      } catch (err: any) {
        console.error('Failed to export DTR Excel:', err);
        alert(`Failed to generate Excel file: ${err?.message || err}`);
      } finally {
        setIsExportingExcel(false);
      }
    } else if (confirmDownloadFormat === 'docx') {
      try {
        setIsExportingDocx(true);
        const validStaffLogs = attendanceLogs.filter((l) =>
          ['tutor', 'faculty', 'principal'].includes((l.role || '').toLowerCase())
        );
        await exportDtrToDocx({
          records: validStaffLogs,
          staffName: currentStaff.name,
          staffNameRight: currentStaffRight.name,
          monthKey: selectedMonthKey,
          officeHoursRegular,
          officeHoursArrivalDeparture,
          officeHoursSaturdays,
          inChargeName,
          inChargeTitle,
          paperSize,
        });
        setConfirmDownloadFormat(null);
      } catch (err: any) {
        console.error('Failed to export DTR Word document:', err);
        alert(`Failed to generate DOCX file: ${err?.message || err}`);
      } finally {
        setIsExportingDocx(false);
      }
    }
  };

  // Render a single CS Form 48 slip
  const renderDtrSlip = (staff: { name: string; role: string }, formData: typeof leftFormData, isCopy2 = false) => {
    return (
      <div
        className="flex-1 flex flex-col p-3 bg-white text-slate-900 border border-slate-950"
        style={{
          fontFamily: "'Times New Roman', Times, Georgia, serif",
          fontSize: '11px',
        }}
      >
        {/* Top Header: CS Form 48 & DAILY TIME RECORD */}
        <div className="flex justify-between items-start mb-1">
          <span className="text-[9px] italic font-serif leading-none pt-0.5">CS Form 48</span>
          <div className="text-center flex-1 pr-10">
            <h3 className="font-bold tracking-wider text-[12px] uppercase leading-tight m-0">
              DAILY TIME RECORD
            </h3>
          </div>
        </div>

        {/* Staff Name with Underline & '(Name)' */}
        <div className="text-center mb-2 mt-1">
          <div className="font-bold uppercase text-[12px] tracking-wide text-center leading-tight min-h-[16px]">
            {staff.name || 'STAFF MEMBER'}
          </div>
          <div className="w-4/5 mx-auto border-b border-black mt-1 mb-0.5" />
          <span className="text-[8.5px] italic block leading-none text-center">(Name)</span>
        </div>

        {/* Prescribed Office Hours & Metadata Lines */}
        <table className="w-full text-[9px] mb-2 border-separate border-spacing-0 table-fixed">
          <tbody>
            <tr>
              <td className="whitespace-nowrap pr-1.5 py-0.5 align-bottom font-serif text-slate-800 w-[140px]">
                For the month of
              </td>
              <td className="border-b border-black text-center font-bold text-[9.5px] pb-0.5 align-bottom">
                {monthLabel}
              </td>
            </tr>
            <tr>
              <td className="whitespace-nowrap pr-1.5 py-0.5 align-bottom font-serif text-slate-800">
                Office Hours (regular days)
              </td>
              <td className="border-b border-black text-center font-medium text-[8.5px] pb-0.5 align-bottom">
                {officeHoursRegular}
              </td>
            </tr>
            <tr>
              <td className="whitespace-nowrap pr-1.5 py-0.5 align-bottom font-serif text-slate-800">
                Arrival & Departure
              </td>
              <td className="border-b border-black text-center font-medium text-[8.5px] pb-0.5 align-bottom">
                {officeHoursArrivalDeparture}
              </td>
            </tr>
            <tr>
              <td className="whitespace-nowrap pr-1.5 py-0.5 align-bottom font-serif text-slate-800">
                Saturdays
              </td>
              <td className="border-b border-black text-center font-medium text-[8.5px] pb-0.5 align-bottom">
                {officeHoursSaturdays}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 31-Day Attendance Punch Table */}
        <table className="w-full border-separate border-spacing-0 border-t border-l border-black text-center text-[9px] mb-2 table-fixed">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="border-r border-b border-black w-[28px] p-0 font-bold text-center align-middle h-[34px]"
              >
                Day
              </th>
              <th
                colSpan={2}
                className="border-r border-b border-black font-bold py-0.5 text-center align-middle h-[17px]"
              >
                A M
              </th>
              <th
                colSpan={2}
                className="border-r border-b border-black font-bold py-0.5 text-center align-middle h-[17px]"
              >
                P M
              </th>
              <th
                colSpan={2}
                className="border-r border-b border-black font-bold py-0.5 text-center align-middle h-[17px]"
              >
                Undertime
              </th>
            </tr>
            <tr className="text-[8px]">
              <th className="border-r border-b border-black font-bold py-0.5 w-[42px] text-center align-middle h-[17px]">
                Arrival
              </th>
              <th className="border-r border-b border-black font-bold py-0.5 w-[42px] text-center align-middle h-[17px]">
                Departure
              </th>
              <th className="border-r border-b border-black font-bold py-0.5 w-[42px] text-center align-middle h-[17px]">
                Arrival
              </th>
              <th className="border-r border-b border-black font-bold py-0.5 w-[42px] text-center align-middle h-[17px]">
                Departure
              </th>
              <th className="border-r border-b border-black font-bold py-0.5 w-[30px] text-center align-middle h-[17px]">
                Hours
              </th>
              <th className="border-r border-b border-black font-bold py-0.5 w-[26px] text-center align-middle h-[17px]">
                Min.
              </th>
            </tr>
          </thead>
          <tbody>
            {formData.rows.map((r) => (
              <tr key={r.dayNum} className="h-[15px]">
                <td className="border-r border-b border-black font-bold text-center align-middle py-0.5">
                  {r.dayNum}
                </td>
                <td className="border-r border-b border-black text-center align-middle py-0.5">
                  {r.arrivalAm}
                </td>
                <td className="border-r border-b border-black text-center align-middle py-0.5">
                  {r.departureAm}
                </td>
                <td className="border-r border-b border-black text-center align-middle py-0.5">
                  {r.arrivalPm}
                </td>
                <td className="border-r border-b border-black text-center align-middle py-0.5">
                  {r.departurePm}
                </td>
                <td className="border-r border-b border-black text-center align-middle py-0.5">
                  {r.hours}
                </td>
                <td className="border-r border-b border-black text-center align-middle py-0.5">
                  {r.min}
                </td>
              </tr>
            ))}
            <tr className="font-bold h-[17px]">
              <td colSpan={5} className="border-r border-b border-black text-right pr-3 align-middle py-0.5">
                Total
              </td>
              <td className="border-r border-b border-black text-center align-middle py-0.5">
                {formData.totalHours || ''}
              </td>
              <td className="border-r border-b border-black text-center align-middle py-0.5">
                {formData.totalMinutes || ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bottom Certification Paragraph & Signatures */}
        <div className="mt-auto space-y-2 pt-1">
          <p className="text-[8.5px] leading-relaxed text-justify px-0.5">
            I certify on my honor that the above is true and correct record of the hours of work
            performed, record of which was made daily at the time of arrival and departure from the
            office.
          </p>

          {/* Employee Signature line */}
          <div className="pt-2 text-center">
            <div className="w-52 mx-auto border-b border-black mb-0.5" />
            <span className="text-[8.5px] italic block leading-none">(Signature)</span>
          </div>

          {/* In-Charge Verification */}
          <div className="pt-1 text-left">
            <p className="text-[8.5px] mb-1 font-normal">Verified as to the prescribed office hours:</p>
            <div className="text-center pt-1">
              <div className="font-bold uppercase text-[10.5px] tracking-wide text-center leading-tight min-h-[15px]">
                {inChargeName}
              </div>
              <div className="w-52 mx-auto border-b border-black mt-1 mb-0.5" />
              <span className="text-[8.5px] italic block leading-none">
                ({inChargeTitle || 'School Principal'})
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Global Print Stylesheet for Direct Print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #dtr-print-canvas, #dtr-print-canvas * {
            visibility: visible !important;
          }
          #dtr-print-canvas {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          ${PAPER_CONFIG[paperSize].pageCss}
        }
      `}</style>

      <div className="relative w-full max-w-[96vw] 2xl:max-w-[1640px] h-[95vh] max-h-[95vh] rounded-3xl bg-white dark:bg-[#0A0A0A] shadow-2xl border border-slate-200 dark:border-[#1A1A1A] flex flex-col overflow-hidden">
        {/* Top Header */}
        {confirmDownloadFormat ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-[#1A1A1A] px-5 py-2.5 sm:py-3 flex-shrink-0 bg-white dark:bg-[#0A0A0A] z-20 animate-fade-in">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 uppercase">
                Full Export Preview —{' '}
                {confirmDownloadFormat === 'docx'
                  ? 'Word Document (.docx)'
                  : confirmDownloadFormat === 'pdf'
                  ? 'PDF Document (.pdf)'
                  : 'Excel Spreadsheet (.xlsx)'}
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
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                EXPORT DAILY TIME RECORD (CS FORM 48)
              </h3>
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
        <div
          ref={scrollBodyRef}
          className="flex-1 overflow-y-auto px-4 sm:px-5 py-2.5 space-y-2.5 scroll-smooth"
        >
          {/* Collapsible Template Settings Form */}
          {!confirmDownloadFormat && showSettings && (
            <div
              ref={settingsRef}
              className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50 dark:bg-[#0E0E0E] p-4 sm:p-5 space-y-4 text-xs animate-in fade-in duration-150 shadow-xs"
            >
              <div className="pb-1">
                <span className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">
                  TEMPLATE & SIGNATORY DETAILS
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                    SCHOOL / AGENCY NAME
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                    IN-CHARGE / SUPERVISOR NAME
                  </label>
                  <input
                    type="text"
                    value={inChargeName}
                    onChange={(e) => setInChargeName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                    IN-CHARGE TITLE
                  </label>
                  <input
                    type="text"
                    value={inChargeTitle}
                    onChange={(e) => setInChargeTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                    OFFICE HOURS (REGULAR DAYS)
                  </label>
                  <input
                    type="text"
                    value={officeHoursRegular}
                    onChange={(e) => setOfficeHoursRegular(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                    ARRIVAL & DEPARTURE PRESCRIBED
                  </label>
                  <input
                    type="text"
                    value={officeHoursArrivalDeparture}
                    onChange={(e) => setOfficeHoursArrivalDeparture(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                    SATURDAYS PRESCRIBED
                  </label>
                  <input
                    type="text"
                    value={officeHoursSaturdays}
                    onChange={(e) => setOfficeHoursSaturdays(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-12 gap-3 sm:gap-4">
            {/* Left Controls Column */}
            {!confirmDownloadFormat && (
              <div className="col-span-12 lg:col-span-4 xl:col-span-3 2xl:col-span-3 space-y-3">
                {/* Staff Selection Panel */}
                <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50/80 dark:bg-[#0E0E0E] p-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Staff Member
                    </span>
                    <span className="text-[10px] font-bold text-[var(--brand)]">
                      {availableStaff.length} Available
                    </span>
                  </div>

                  {/* Search filter */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search tutor or faculty..."
                      value={staffSearchQuery}
                      onChange={(e) => setStaffSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141414] text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[var(--brand)]"
                    />
                  </div>

                  {/* Staff Select Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                      Select Staff (Copy 1):
                    </label>
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141414] p-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-[var(--brand)]"
                    >
                      {filteredStaffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Copy Mode Selection */}
                  <div className="pt-1 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Sheet Layout Mode
                    </span>
                    <div className="flex bg-white dark:bg-[#141414] border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 gap-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setCopyMode('duplicate')}
                        className={`flex-1 rounded-lg h-7 py-1 px-1.5 text-[10.5px] font-bold uppercase transition-all cursor-pointer text-center whitespace-nowrap ${
                          copyMode === 'duplicate'
                            ? 'bg-[var(--brand)] text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        Duplicate (2 Copies)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCopyMode('dual');
                          if (!selectedStaffRightId && availableStaff.length > 1) {
                            const second = availableStaff.find((s) => s.id !== selectedStaffId);
                            if (second) setSelectedStaffRightId(second.id);
                          }
                        }}
                        className={`flex-1 rounded-lg h-7 py-1 px-1.5 text-[10.5px] font-bold uppercase transition-all cursor-pointer text-center whitespace-nowrap ${
                          copyMode === 'dual'
                            ? 'bg-[var(--brand)] text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        Two Different Staff
                      </button>
                    </div>
                  </div>

                  {/* Second Staff selector if dual mode */}
                  {copyMode === 'dual' && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        Select Second Staff (Copy 2):
                      </label>
                      <select
                        value={selectedStaffRightId}
                        onChange={(e) => setSelectedStaffRightId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141414] p-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-[var(--brand)]"
                      >
                        {filteredStaffList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.role.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Month & Period Selector */}
                <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50/80 dark:bg-[#0E0E0E] p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Attendance Month
                    </span>
                    <span className="text-[10px] font-bold text-[var(--brand)]">
                      {monthLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-white dark:bg-[#141414] border border-slate-200 dark:border-slate-800 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Previous month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {monthLabel}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Next month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Summary punch status */}
                  <div className="pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span>Days Logged:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {leftFormData.daysPresentCount} days
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span>Total Work Hours:</span>
                    <span className="font-bold text-[var(--brand)]">
                      {leftFormData.totalHours} hrs {leftFormData.totalMinutes} mins
                    </span>
                  </div>
                </div>

                {/* Paper Size Selector */}
                <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50/80 dark:bg-[#0E0E0E] p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Paper Size
                    </span>
                    <span className="text-[10px] font-bold text-[var(--brand)]">
                      {PAPER_CONFIG[paperSize].label}
                    </span>
                  </div>
                  <div className="flex bg-white dark:bg-[#141414] border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 gap-1 shadow-2xs">
                    {(['letter', 'a4', 'folio'] as const).map((sizeKey) => (
                      <button
                        key={sizeKey}
                        type="button"
                        onClick={() => setPaperSize(sizeKey)}
                        className={`flex-1 rounded-lg h-7 py-1 px-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer text-center whitespace-nowrap flex items-center justify-center ${
                          paperSize === sizeKey
                            ? 'bg-[var(--brand)] text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {sizeKey === 'letter' ? 'Short' : sizeKey === 'a4' ? 'A4' : 'Long'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Right Column: Physical Paper Canvas Preview */}
            <div
              className={
                confirmDownloadFormat
                  ? 'col-span-12 flex flex-col items-center justify-center min-w-0 animate-fade-in'
                  : 'col-span-12 lg:col-span-8 xl:col-span-9 2xl:col-span-9 flex flex-col min-w-0'
              }
            >
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-100/90 dark:bg-[#111111] p-3 sm:p-5 overflow-x-auto flex flex-col items-center shadow-inner">
                {/* Physical Sheet Card */}
                <div
                  id="dtr-print-canvas"
                  ref={printRef}
                  data-print-container="true"
                  style={{
                    width: PAPER_CONFIG[paperSize].width,
                    minHeight: PAPER_CONFIG[paperSize].minHeight,
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                  className="bg-white shadow-xl border border-slate-300 p-4 sm:p-5 text-slate-900 transition-all duration-200 flex-shrink-0"
                >
                  {/* Two CS Form 48 Copies Side-by-Side with Cut-line */}
                  <div className="flex flex-row items-stretch gap-4 h-full">
                    {/* Left Copy (CS Form 48) */}
                    {renderDtrSlip(currentStaff, leftFormData, false)}

                    {/* Vertical Cut Separator Line */}
                    <div className="flex flex-col items-center justify-center relative w-2 shrink-0 select-none">
                      <div className="w-[1px] h-full border-r border-dashed border-slate-400" />
                      <div className="absolute bg-white p-0.5 rounded-full border border-slate-300 text-slate-400">
                        <Scissors className="w-3 h-3 rotate-90" />
                      </div>
                    </div>

                    {/* Right Copy (CS Form 48 - Duplicate or Second Staff) */}
                    {renderDtrSlip(currentStaffRight, rightFormData, true)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Footer */}
        {confirmDownloadFormat ? (
          <div className="flex-shrink-0 bg-white dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-[#1A1A1A] px-5 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {currentStaff.name}
              </span>
              <span>•</span>
              <span className="font-semibold text-[var(--brand)]">{monthLabel}</span>
              <span>•</span>
              <span className="uppercase font-semibold text-slate-700 dark:text-slate-300">
                {PAPER_CONFIG[paperSize]?.label || paperSize}
              </span>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={isExportingExcel || isExportingDocx || isExportingPdf}
                onClick={() => setConfirmDownloadFormat(null)}
                className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={isExportingExcel || isExportingDocx || isExportingPdf}
                onClick={handleExecuteConfirmedDownload}
                className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-sm disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {isExportingExcel || isExportingDocx || isExportingPdf ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating{' '}
                    {confirmDownloadFormat === 'docx'
                      ? '.docx'
                      : confirmDownloadFormat === 'pdf'
                      ? '.pdf'
                      : '.xlsx'}
                    ...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Confirm Download{' '}
                    {confirmDownloadFormat === 'docx'
                      ? 'Word (.docx)'
                      : confirmDownloadFormat === 'pdf'
                      ? 'PDF (.pdf)'
                      : 'Excel (.xlsx)'}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-shrink-0 bg-white dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-[#1A1A1A] px-5 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
            <button
              type="button"
              onClick={handleDirectPrint}
              className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Print Sheet
            </button>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
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
                disabled={isExportingDocx || isExportingPdf || isExportingExcel}
                className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                Download Document (.docx)
              </button>
              <button
                type="button"
                onClick={() => handleInitiateDownload('pdf')}
                disabled={isExportingDocx || isExportingPdf || isExportingExcel}
                className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                Download PDF (.pdf)
              </button>
              <button
                type="button"
                onClick={() => handleInitiateDownload('excel')}
                disabled={isExportingDocx || isExportingPdf || isExportingExcel}
                className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                Download Excel (.xlsx)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportDtrModal;
