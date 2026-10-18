import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Download,
} from 'lucide-react';
import type { User } from '../types';
import {
  exportBosyListToExcel,
  exportBosyListToDocx,
  exportBosyListToPdf,
  type BosyExportData,
} from '../utils/bosyListExportService';
import { DEPED_LOGO_SRC, PNAHS_LOGO_SRC } from '../assets/template_logos/logosBase64';
import { formatStudentName, compareNamesByLastName } from '../utils/studentFormatters';

export interface ExportBosyListModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: User[];
  tutors: User[];
  currentUser?: User | null;
  defaultTutorId?: string;
}

const PAPER_CONFIG: Record<
  'letter' | 'a4' | 'folio',
  { label: string; width: string; minHeight: string }
> = {
  letter: { label: 'Short (8.5 × 11 in)', width: '1056px', minHeight: '816px' },
  a4: { label: 'A4 (8.27 × 11.69 in)', width: '1123px', minHeight: '794px' },
  folio: { label: 'Long / Folio (8.5 × 13 in)', width: '1248px', minHeight: '816px' },
};

/**
 * Utility to parse grade and section from student grade_level string.
 * Supports "GRADE 7 - HYACINTH", "7 - HYACINTH", "GRADE 7", "7", etc.
 */
const parseStudentGradeSection = (raw?: string | null): { grade: string; section: string } => {
  if (!raw || !raw.trim()) return { grade: '', section: '' };
  const clean = raw.trim();
  if (clean.includes(' - ')) {
    const parts = clean.split(' - ');
    let g = parts[0].trim().toUpperCase();
    if (!g.startsWith('GRADE ') && !isNaN(Number(g))) {
      g = `GRADE ${g}`;
    }
    const s = parts.slice(1).join(' - ').trim().toUpperCase();
    return { grade: g, section: s };
  }
  let g = clean.toUpperCase();
  if (!g.startsWith('GRADE ') && !isNaN(Number(g))) {
    g = `GRADE ${g}`;
  }
  return { grade: g, section: '' };
};

export const ExportBosyListModal: React.FC<ExportBosyListModalProps> = ({
  isOpen,
  onClose,
  students,
  tutors,
  currentUser,
  defaultTutorId,
}) => {
  // Config & Header details
  const [division, setDivision] = useState('REGION V - BICOL / SCHOOLS DIVISION OF MASBATE');
  const [district, setDistrict] = useState('DISTRICT OF PALANAS');
  const [schoolName, setSchoolName] = useState('PALANAS NATIONAL AGRICULTURE HIGH SCHOOL');
  const [schoolAddress, setSchoolAddress] = useState('Palanas, Masbate');
  const [documentTitle, setDocumentTitle] = useState('BOSY LIST OF ARAL TUTEES');
  const [schoolYear, setSchoolYear] = useState('2026-2027');

  // Signatories
  const [tutorName, setTutorName] = useState(
    currentUser?.role === 'tutor'
      ? currentUser.full_name || `${currentUser.first_name} ${currentUser.last_name}`
      : 'JUAN D. CRUZ'
  );
  const [adviserName, setAdviserName] = useState('HAROLD M. BALBUENA');
  const [asstPrincipalName, setAsstPrincipalName] = useState('GEORGE B. BASAS');
  const [principalName, setPrincipalName] = useState('EULOGIO C. GADIA');

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDownloadFormat, setConfirmDownloadFormat] = useState<'docx' | 'pdf' | 'excel' | null>(null);
  const [paperSize, setPaperSize] = useState<'letter' | 'a4' | 'folio'>('letter');

  // Cascading Filters
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedTutorId, setSelectedTutorId] = useState<string>(
    defaultTutorId || (currentUser?.role === 'tutor' ? currentUser.id : 'all')
  );
  // Default assessment milestone: 'bosy' (Undergone BOSY Assessment)
  const [baselineFilter, setBaselineFilter] = useState<'bosy' | 'mosy' | 'eosy' | 'summer' | 'all'>('bosy');

  // Exporting spinners
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  // Sync document title automatically when baseline filter changes (unless customized)
  useEffect(() => {
    switch (baselineFilter) {
      case 'bosy':
        setDocumentTitle('BOSY LIST OF ARAL TUTEES');
        break;
      case 'mosy':
        setDocumentTitle('MOSY LIST OF ARAL TUTEES');
        break;
      case 'eosy':
        setDocumentTitle('EOSY LIST OF ARAL TUTEES');
        break;
      case 'summer':
        setDocumentTitle('ARAL SUMMER LIST OF ARAL TUTEES');
        break;
      default:
        setDocumentTitle('LIST OF ARAL TUTEES');
        break;
    }
  }, [baselineFilter]);

  // 1. Available distinct Grade Levels
  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const { grade } = parseStudentGradeSection(s.grade_level);
      if (grade) set.add(grade);
    });
    const list = Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB || a.localeCompare(b);
    });
    return list.length > 0 ? list : ['GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'];
  }, [students]);

  // 2. Available Sections (cascading from selectedGrade)
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const { grade, section } = parseStudentGradeSection(s.grade_level);
      if (!section) return;
      if (selectedGrade === 'all' || grade === selectedGrade) {
        set.add(section);
      }
    });
    return Array.from(set).sort();
  }, [students, selectedGrade]);

  // Auto-reset Section if not in available sections for current grade
  useEffect(() => {
    if (selectedSection !== 'all' && !availableSections.includes(selectedSection)) {
      setSelectedSection('all');
    }
  }, [availableSections, selectedSection]);

  // 3. Available Tutors (cascading from selectedGrade and selectedSection)
  const availableTutors = useMemo(() => {
    const assignedTutorIds = new Set<string>();
    students.forEach((s) => {
      if (s.role && s.role !== 'student') return;
      const { grade, section } = parseStudentGradeSection(s.grade_level);
      if (selectedGrade !== 'all' && grade !== selectedGrade) return;
      if (selectedSection !== 'all' && section !== selectedSection) return;

      const tId =
        typeof s.assigned_tutor === 'object' && s.assigned_tutor !== null
          ? String((s.assigned_tutor as any).id)
          : s.assigned_tutor
          ? String(s.assigned_tutor)
          : null;
      if (tId) assignedTutorIds.add(tId);
    });

    if (assignedTutorIds.size > 0) {
      const matched = tutors.filter((t) => assignedTutorIds.has(String(t.id)));
      if (matched.length > 0) return matched;
    }
    return tutors;
  }, [students, tutors, selectedGrade, selectedSection]);

  // Auto-reset Tutor if selected tutor is no longer in available tutors
  useEffect(() => {
    if (selectedTutorId && selectedTutorId !== 'all') {
      const exists = availableTutors.some((t) => String(t.id) === String(selectedTutorId));
      if (!exists) {
        setSelectedTutorId('all');
      }
    }
  }, [availableTutors, selectedTutorId]);

  // 4. Filtered and Sorted Students (strictly sorted by Last Name)
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (s.role && s.role !== 'student') return false;

        const { grade, section } = parseStudentGradeSection(s.grade_level);

        // Grade level filter
        if (selectedGrade !== 'all' && grade !== selectedGrade) {
          return false;
        }

        // Section filter
        if (selectedSection !== 'all' && section !== selectedSection) {
          return false;
        }

        // Tutor filter
        if (selectedTutorId && selectedTutorId !== 'all') {
          const studentTutorId =
            typeof s.assigned_tutor === 'object' && s.assigned_tutor !== null
              ? String((s.assigned_tutor as any).id)
              : s.assigned_tutor
              ? String(s.assigned_tutor)
              : '';
          if (studentTutorId !== String(selectedTutorId)) {
            return false;
          }
        }

        // Baseline Assessment filter
        if (baselineFilter === 'bosy' && !s.has_bosy) return false;
        if (baselineFilter === 'mosy' && !s.has_mosy) return false;
        if (baselineFilter === 'eosy' && !s.has_eosy) return false;
        if (baselineFilter === 'summer' && !s.has_summer) return false;

        return true;
      })
      .sort(compareNamesByLastName);
  }, [students, selectedGrade, selectedSection, selectedTutorId, baselineFilter]);

  // Computed display string for Grade & Section
  const computedGradeLevelDisplay = useMemo(() => {
    if (selectedGrade === 'all' && selectedSection === 'all') {
      return 'ALL GRADE LEVELS';
    }
    if (selectedGrade !== 'all' && selectedSection !== 'all') {
      const num = selectedGrade.replace(/GRADE\s*/i, '');
      return `${num}- ${selectedSection}`;
    }
    if (selectedGrade !== 'all' && selectedSection === 'all') {
      return `${selectedGrade} (ALL SECTIONS)`;
    }
    return `ALL GRADES - ${selectedSection}`;
  }, [selectedGrade, selectedSection]);

  // Computed display string for Tutor
  const computedTutorDisplay = useMemo(() => {
    if (selectedTutorId && selectedTutorId !== 'all') {
      const match = tutors.find((t) => String(t.id) === String(selectedTutorId));
      if (match) {
        return (match.full_name || `${match.first_name} ${match.last_name}`).toUpperCase();
      }
    }
    if (availableTutors.length === 1) {
      const single = availableTutors[0];
      return (single.full_name || `${single.first_name} ${single.last_name}`).toUpperCase();
    }
    return (tutorName || 'JUAN D. CRUZ').toUpperCase();
  }, [selectedTutorId, tutors, availableTutors, tutorName]);

  if (!isOpen) return null;

  const getExportData = (): BosyExportData => ({
    division,
    district,
    schoolName,
    schoolAddress,
    title: documentTitle,
    schoolYear,
    gradeLevel: computedGradeLevelDisplay,
    tutorName: computedTutorDisplay,
    adviserName,
    asstPrincipalName,
    principalName,
    paperSize,
    students: filteredStudents.map((s) => ({
      id: s.id,
      full_name: s.full_name || `${s.first_name} ${s.last_name}`,
      first_name: s.first_name,
      middle_name: s.middle_name,
      last_name: s.last_name,
      lrn: s.lrn,
      grade_level: s.grade_level,
      subject: s.subject || 'ENGLISH',
      parent_guardian_name: s.parent_guardian_name,
      contact_number: s.contact_number,
      has_bosy: s.has_bosy ?? true,
      has_mosy: s.has_mosy ?? false,
      has_eosy: s.has_eosy ?? false,
      has_summer: s.has_summer ?? false,
      assigned_tutor_name: s.assigned_tutor_name,
    })),
  });

  const handleToggleSettings = () => {
    setShowSettings((prev) => !prev);
    if (!showSettings) {
      setTimeout(() => {
        settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  const handleInitiateDownload = (format: 'docx' | 'pdf' | 'excel') => {
    setConfirmDownloadFormat(format);
  };

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      await exportBosyListToDocx(getExportData());
      setConfirmDownloadFormat(null);
    } catch (err: any) {
      console.error('Failed to export DOCX:', err);
      alert(`Failed to generate DOCX file: ${err?.message || err}.`);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportBosyListToPdf(getExportData());
      setConfirmDownloadFormat(null);
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      alert(`Failed to generate PDF file: ${err?.message || err}.`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      await exportBosyListToExcel(getExportData());
      setConfirmDownloadFormat(null);
    } catch (err: any) {
      console.error('Failed to export Excel:', err);
      alert(`Failed to generate Excel file: ${err?.message || err}.`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExecuteConfirmedDownload = async () => {
    if (confirmDownloadFormat === 'docx') {
      await handleExportDocx();
    } else if (confirmDownloadFormat === 'pdf') {
      await handleExportPdf();
    } else if (confirmDownloadFormat === 'excel') {
      await handleExportExcel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="relative w-full max-w-[96vw] 2xl:max-w-[1640px] h-[95vh] max-h-[95vh] rounded-3xl bg-white dark:bg-[#0A0A0A] shadow-2xl border border-slate-200 dark:border-[#1A1A1A] flex flex-col overflow-hidden">
        {/* Fixed Top Header */}
        {confirmDownloadFormat ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-[#1A1A1A] px-5 py-2.5 sm:py-3 flex-shrink-0 bg-white dark:bg-[#0A0A0A] z-20 animate-fade-in">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
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
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                EXPORT LIST OF ARAL TUTEES
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
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-2.5 space-y-2.5 scroll-smooth">
          {/* Header Settings Form */}
          {!confirmDownloadFormat && showSettings && (
            <div
              ref={settingsRef}
              className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50 dark:bg-[#0E0E0E] p-4 sm:p-5 space-y-6 text-xs animate-in fade-in duration-150 shadow-xs"
            >
              {/* Section 1: HEADER */}
              <div className="pb-1">
                <div className="mb-4">
                  <span className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">
                    HEADER CONFIGURATION
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                      DIVISION
                    </label>
                    <input
                      type="text"
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                      DISTRICT
                    </label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                      SCHOOL NAME
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
                      SCHOOL ADDRESS
                    </label>
                    <input
                      type="text"
                      value={schoolAddress}
                      onChange={(e) => setSchoolAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                      DOCUMENT TITLE
                    </label>
                    <input
                      type="text"
                      value={documentTitle}
                      onChange={(e) => setDocumentTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                      SCHOOL YEAR
                    </label>
                    <input
                      type="text"
                      value={schoolYear}
                      onChange={(e) => setSchoolYear(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: SIGNATORIES */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
                <div className="mb-4">
                  <span className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-sm">
                    SIGNATORIES
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                      PREPARED BY (TUTOR / STAFF)
                    </label>
                    <input
                      type="text"
                      value={tutorName}
                      onChange={(e) => setTutorName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                      NOTED BY (CLASS ADVISER)
                    </label>
                    <input
                      type="text"
                      value={adviserName}
                      onChange={(e) => setAdviserName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                      ASST. PRINCIPAL / HT-I
                    </label>
                    <input
                      type="text"
                      value={asstPrincipalName}
                      onChange={(e) => setAsstPrincipalName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1.5 text-[11px]">
                      APPROVED BY (PRINCIPAL)
                    </label>
                    <input
                      type="text"
                      value={principalName}
                      onChange={(e) => setPrincipalName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Grid: Toolbar & Paper Preview */}
          <div className="grid grid-cols-12 gap-3 sm:gap-4 items-start">
            {/* Left Column: Filter Controls */}
            {!confirmDownloadFormat && (
              <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-3">
                {/* Filters & Selector Card */}
                <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50/80 dark:bg-[#0E0E0E] p-3.5 space-y-3.5 text-xs shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-200/80 dark:border-slate-800">
                    <span>EXPORT TUTEES LIST DETAILS</span>
                  </div>

                  {/* 1. Grade Level Dropdown */}
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      GRADE LEVEL
                    </label>
                    <select
                      value={selectedGrade}
                      onChange={(e) => setSelectedGrade(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] uppercase transition cursor-pointer"
                    >
                      <option value="all">ALL GRADE LEVELS</option>
                      {availableGrades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Section Dropdown (Filtered for selected Grade Level) */}
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      SECTION
                    </label>
                    <select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] uppercase transition cursor-pointer"
                    >
                      <option value="all">ALL SECTIONS</option>
                      {availableSections.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Assigned Tutor Dropdown (Filtered for selected Grade & Section) */}
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      ASSIGNED TUTOR
                    </label>
                    <select
                      value={selectedTutorId}
                      onChange={(e) => setSelectedTutorId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] transition cursor-pointer"
                    >
                      <option value="all">ALL TUTORS</option>
                      {availableTutors.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name || `${t.first_name} ${t.last_name}`}
                          {t.subject ? ` (${t.subject.toUpperCase()})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Assessment Filter (Default: Undergone BOSY Assessment) */}
                  <div>
                    <label className="block text-[10.5px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      ASSESSMENT
                    </label>
                    <select
                      value={baselineFilter}
                      onChange={(e) => setBaselineFilter(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] transition cursor-pointer"
                    >
                      <option value="bosy">Undergone BOSY Assessment</option>
                      <option value="mosy">Undergone MOSY Assessment</option>
                      <option value="eosy">Undergone EOSY Assessment</option>
                      <option value="summer">Undergone ARAL Summer</option>
                      <option value="all">All Enrolled Learners</option>
                    </select>
                  </div>

                  {/* 5. Paper Size Selector */}
                  <div className="pt-3.5 mt-1 border-t border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Paper Size
                      </span>
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
                          className={`flex-1 rounded-lg h-7 py-1 px-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer text-center whitespace-nowrap flex items-center justify-center ${
                            paperSize === sizeKey
                              ? 'bg-[var(--brand)] text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {sizeKey === 'letter' ? 'Short' : sizeKey === 'a4' ? 'A4' : 'Long'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Right Column: Physical Paper Sheet Preview */}
            <div
              className={
                confirmDownloadFormat
                  ? 'col-span-12 flex flex-col items-center justify-center min-w-0 animate-fade-in'
                  : 'col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col min-w-0'
              }
            >
              {/* Paper Workspace Canvas */}
              <div className="w-full rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-100/90 dark:bg-[#111111] p-4 sm:p-6 overflow-x-auto flex flex-col items-center shadow-inner">
                {/* Physical Sheet Card */}
                <div
                  ref={printRef}
                  data-print-container="true"
                  style={{
                    width: PAPER_CONFIG[paperSize].width,
                    minHeight: PAPER_CONFIG[paperSize].minHeight,
                    fontFamily: "'Bookman Old Style', 'Bookman', 'URW Bookman L', 'Times New Roman', serif",
                    colorScheme: 'light',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                  className="export-paper-sheet bg-white shadow-xl border border-slate-300 pt-14 pb-14 px-8 sm:px-12 text-slate-900 font-serif transition-all duration-200 flex-shrink-0"
                >
                  {/* Header Section with Official Logos */}
                  <div className="flex flex-nowrap items-center justify-center gap-5 sm:gap-7 pb-2 mx-auto w-full max-w-4xl">
                    {/* Left: DepEd Seal */}
                    <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                      <img
                        src={DEPED_LOGO_SRC}
                        alt="DepEd Logo"
                        className="w-16 h-16 sm:w-20 sm:h-20 object-contain select-none"
                      />
                    </div>

                    {/* Center: School Letterhead */}
                    <div className="text-center px-2 space-y-0.5 min-w-0 flex-shrink-0">
                      <p className="text-[11pt] uppercase tracking-wider text-slate-600">Republic of the Philippines</p>
                      <p className="text-[11pt] font-bold uppercase tracking-wider text-slate-900">Department of Education</p>
                      <p className="text-[11pt] uppercase tracking-wider text-slate-600">{division}</p>
                      <p className="text-[11pt] uppercase tracking-wider text-slate-600">{district}</p>
                      <p className="text-[11pt] text-slate-500">{schoolAddress}</p>
                    </div>

                    {/* Right: PNAHS Seal */}
                    <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                      <img
                        src={PNAHS_LOGO_SRC}
                        alt="PNAHS Logo"
                        className="w-16 h-16 sm:w-20 sm:h-20 object-contain select-none"
                      />
                    </div>
                  </div>

                  {/* Boxed Header for School Name & Title (Size 16 Bold) */}
                  <div className="border border-slate-900 py-2.5 px-6 mx-auto text-center my-3 max-w-2xl">
                    <h4 className="text-[16pt] font-bold uppercase tracking-wide text-slate-900 leading-tight">
                      {schoolName}
                    </h4>
                    <h3 className="text-[16pt] font-bold uppercase tracking-wide text-slate-900 leading-tight mt-1">
                      {documentTitle}
                    </h3>
                  </div>

                  {/* School Year (Size 11 Bold) */}
                  <div className="text-center pt-1 pb-3">
                    <p className="text-[11pt] font-bold text-slate-900">School Year {schoolYear}</p>
                  </div>

                  {/* Context Metadata Row (Left: GRADE LEVEL, Right: TUTOR - Size 11 Bold) */}
                  <div className="flex justify-between items-center text-[11pt] font-bold mb-3 px-1 text-slate-900">
                    <div className="inline-flex items-center gap-1">
                      <span>GRADE LEVEL:</span>
                      <span className="font-bold uppercase">{computedGradeLevelDisplay}</span>
                    </div>
                    <div className="inline-flex items-center gap-1">
                      <span>TUTOR:</span>
                      <span className="font-bold uppercase">{computedTutorDisplay}</span>
                    </div>
                  </div>

                  {/* Official 8-Column Data Table strictly matching client template */}
                  <table className="w-full border-collapse border border-slate-900 text-[11pt] font-serif table-fixed">
                    <colgroup>
                      <col style={{ width: '5%' }} />
                      <col style={{ width: '31%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '11%' }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50 text-slate-900 font-bold border-b border-slate-900 text-center">
                        <th className="border border-slate-900 py-1.5 px-0.5 text-center font-bold text-[11pt]">No.</th>
                        <th className="border border-slate-900 py-1.5 px-2 text-center font-bold text-[11pt]">
                          Name of Learner
                        </th>
                        <th className="border border-slate-900 py-1.5 px-0.5 text-center font-bold text-[11pt]">BOSY</th>
                        <th className="border border-slate-900 py-1.5 px-0.5 text-center font-bold text-[11pt]">MOSY</th>
                        <th className="border border-slate-900 py-1.5 px-0.5 text-center font-bold text-[11pt]">EOSY</th>
                        <th className="border border-slate-900 py-1.5 px-1 text-center font-bold text-[11pt]">Subject Focus</th>
                        <th className="border border-slate-900 py-1.5 px-1 text-center font-bold text-[11pt]">
                          Parent/Guardian
                        </th>
                        <th className="border border-slate-900 py-1.5 px-1 text-center font-bold text-[11pt]">Contact No.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="border border-slate-900 text-center py-6 text-slate-500 italic font-normal text-[11pt]">
                            No learners found matching the selected export filters.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student, idx) => (
                          <tr key={student.id || idx} className="hover:bg-slate-50">
                            <td className="border border-slate-900 text-center py-1 px-0.5 font-normal text-[11pt] text-slate-900">
                              {idx + 1}
                            </td>
                            <td className="border border-slate-900 py-1 px-2 font-normal uppercase text-[11pt] text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
                              {formatStudentName(student)}
                            </td>
                            <td className="border border-slate-900 text-center py-1 px-0.5 font-normal text-[11pt] text-slate-900">
                              {student.has_bosy ?? true ? 'TRUE' : ''}
                            </td>
                            <td className="border border-slate-900 text-center py-1 px-0.5 font-normal text-[11pt] text-slate-900">
                              {student.has_mosy ? 'TRUE' : ''}
                            </td>
                            <td className="border border-slate-900 text-center py-1 px-0.5 font-normal text-[11pt] text-slate-900">
                              {student.has_eosy ? 'TRUE' : ''}
                            </td>
                            <td className="border border-slate-900 text-center py-1 px-1 font-normal uppercase text-[11pt] text-slate-900">
                              {student.subject || 'ENGLISH'}
                            </td>
                            <td className="border border-slate-900 py-1 px-2 font-normal uppercase text-[11pt] text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
                              {student.parent_guardian_name || ''}
                            </td>
                            <td className="border border-slate-900 text-center py-1 px-1 font-normal text-[11pt] text-slate-900">
                              {student.contact_number || ''}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Official Signatories Block matching screenshot layout & Tutor Export style (Size 11, Times New Roman) */}
                  <div
                    style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}
                    className="pt-10 text-[11pt] text-slate-900 space-y-7"
                  >
                    {/* Prepared by label */}
                    <div className="flex justify-end pr-8 sm:pr-14">
                      <p className="text-[11pt] text-slate-800">Prepared by:</p>
                    </div>

                    {/* Line 1: Adviser (Left) & Tutor (Right) */}
                    <div className="grid grid-cols-2 gap-8 text-center">
                      <div className="flex flex-col items-center">
                        <div className="inline-flex flex-col items-center min-w-[200px] max-w-[260px]">
                          <span className="font-bold uppercase tracking-wide text-slate-900 pb-1 text-center text-[11pt]">
                            {adviserName}
                          </span>
                          <div className="w-full h-[1.5px] bg-slate-900" />
                        </div>
                        <p className="text-[11pt] text-slate-700 mt-1">Adviser</p>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="inline-flex flex-col items-center min-w-[200px] max-w-[260px]">
                          <span className="font-bold uppercase tracking-wide text-slate-900 pb-1 text-center text-[11pt]">
                            {computedTutorDisplay}
                          </span>
                          <div className="w-full h-[1.5px] bg-slate-900" />
                        </div>
                        <p className="text-[11pt] text-slate-700 font-bold uppercase mt-1">TUTOR</p>
                      </div>
                    </div>

                    {/* Line 2: Checked by Asst Principal (Left) */}
                    <div className="pt-2 flex flex-col items-start pl-4 sm:pl-10">
                      <p className="text-[11pt] text-slate-800 mb-3">Checked:</p>
                      <div className="inline-flex flex-col items-center min-w-[200px] max-w-[260px]">
                        <span className="font-bold uppercase tracking-wide text-slate-900 pb-1 text-center text-[11pt]">
                          {asstPrincipalName}
                        </span>
                        <div className="w-full h-[1.5px] bg-slate-900" />
                        <p className="text-[11pt] text-slate-700 mt-1">Asst to the Principal/ HT-I</p>
                      </div>
                    </div>

                    {/* Line 3: Noted by Principal (Center) */}
                    <div className="pt-2 flex flex-col items-center">
                      <p className="text-[11pt] text-slate-800 mb-3">Noted:</p>
                      <div className="inline-flex flex-col items-center min-w-[200px] max-w-[260px]">
                        <span className="font-bold uppercase tracking-wide text-slate-900 pb-1 text-center text-[11pt]">
                          {principalName}
                        </span>
                        <div className="w-full h-[1.5px] bg-slate-900" />
                        <p className="text-[11pt] text-slate-700 mt-1">Principal I</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed, 100% Solid Opaque Bottom Footer matching Tutor Export Modal */}
        {confirmDownloadFormat ? (
          <div className="flex-shrink-0 bg-white dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-[#1A1A1A] px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] animate-fade-in">
            <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100">{computedGradeLevelDisplay}</span>
              <span>•</span>
              <span className="font-semibold text-[var(--brand)]">
                {baselineFilter === 'bosy'
                  ? 'BOSY Assessment'
                  : baselineFilter === 'mosy'
                  ? 'MOSY Assessment'
                  : baselineFilter === 'eosy'
                  ? 'EOSY Assessment'
                  : baselineFilter === 'summer'
                  ? 'ARAL Summer'
                  : 'All Enrolled Learners'}
              </span>
              <span>•</span>
              <span>{filteredStudents.length} Student{filteredStudents.length !== 1 ? 's' : ''}</span>
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
                {isExportingDocx || isExportingPdf || isExportingExcel ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating {confirmDownloadFormat === 'docx' ? '.docx' : confirmDownloadFormat === 'pdf' ? '.pdf' : '.xlsx'}...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Confirm Download{' '}
                    {confirmDownloadFormat === 'docx'
                      ? 'Document(.docx)'
                      : confirmDownloadFormat === 'pdf'
                      ? 'PDF(.pdf)'
                      : 'Excel(.xlsx)'}
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
        )}
      </div>
    </div>
  );
};

export default ExportBosyListModal;
