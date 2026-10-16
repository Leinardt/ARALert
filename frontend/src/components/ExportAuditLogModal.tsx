import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Download, Calendar, Filter, Search } from 'lucide-react';
import type { User } from '../types';
import api from '../api/axios';
import {
  exportAuditLogsToExcel,
  exportAuditLogsToDocx,
  exportAuditLogsToPdf,
  exportAuditLogsToCsv,
  AuditLogExportItem,
  AuditLogExportData,
} from '../utils/auditLogExportService';
import { DEPED_LOGO_SRC, PNAHS_LOGO_SRC } from '../assets/template_logos/logosBase64';

export interface ExportAuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  initialDateFrom?: string | null;
  initialDateTo?: string | null;
  initialAction?: string;
  initialSearch?: string;
}

export const PAPER_CONFIG = {
  a4: {
    width: '794px',
    minHeight: '1123px',
    label: 'A4 (210 × 297 mm)',
  },
  folio: {
    width: '816px',
    minHeight: '1248px',
    label: 'Long / Folio (8.5 × 13 in)',
  },
  letter: {
    width: '816px',
    minHeight: '1056px',
    label: 'Short / Letter (8.5 × 11 in)',
  },
};

type DatePreset = 'all' | 'today' | 'custom';

export const ExportAuditLogModal: React.FC<ExportAuditLogModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialDateFrom = null,
  initialDateTo = null,
  initialAction = '',
  initialSearch = '',
}) => {
  // Letterhead details
  const [division, setDivision] = useState('DIVISION OF MASBATE');
  const [district, setDistrict] = useState('PALANAS NORTH DISTRICT');
  const [schoolName, setSchoolName] = useState('PALANAS NATIONAL AGRICULTURE HIGH SCHOOL');
  const [schoolAddress, setSchoolAddress] = useState('Sta. Cruz, Palanas, Masbate');
  const [documentTitle, setDocumentTitle] = useState('ARAL PROGRAM SYSTEM AUDIT LOG RECORD');

  // Paper & Filters
  const [paperSize, setPaperSize] = useState<'letter' | 'a4' | 'folio'>('letter');
  const [datePreset, setDatePreset] = useState<DatePreset>(() => {
    if (initialDateFrom || initialDateTo) return 'custom';
    return 'all';
  });
  const [dateFrom, setDateFrom] = useState<string>(() => initialDateFrom || '');
  const [dateTo, setDateTo] = useState<string>(() => initialDateTo || '');
  const [actionFilter, setActionFilter] = useState<string>(() => initialAction || '');
  const [searchFilter, setSearchFilter] = useState<string>(() => initialSearch || '');

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [logs, setLogs] = useState<AuditLogExportItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);



  // Date Range string computation
  const dateRangeStr = useMemo(() => {
    if (datePreset === 'today') {
      const today = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
      return `TODAY (${today.toUpperCase()})`;
    }
    if (datePreset === 'custom') {
      if (dateFrom && dateTo) {
        return `${dateFrom} TO ${dateTo}`;
      }
      if (dateFrom) return `FROM ${dateFrom}`;
      if (dateTo) return `UNTIL ${dateTo}`;
      return 'CUSTOM DATE RANGE';
    }
    return 'ALL RECORDED DATES';
  }, [datePreset, dateFrom, dateTo]);

  // Handle Preset changes
  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  // Fetch all logs matching the selected filters
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const fetchLogsForExport = async () => {
      setIsLoadingLogs(true);
      try {
        const params = new URLSearchParams();
        if (actionFilter) params.set('action', actionFilter);
        if (searchFilter) params.set('search', searchFilter);

        if (datePreset === 'today') {
          const todayStr = new Date().toISOString().slice(0, 10);
          params.set('date', todayStr);
        } else if (datePreset !== 'all') {
          if (dateFrom) params.set('date_from', dateFrom);
          if (dateTo) params.set('date_to', dateTo);
        }

        params.set('page', '1');
        const firstRes = await api.get<{ count: number; total_pages: number; results: any[] }>(`/users/audit-logs/?${params.toString()}`);
        if (isCancelled) return;

        let allLogs: AuditLogExportItem[] = (firstRes.data.results || []).map((r) => ({
          id: String(r.id),
          timestamp: r.timestamp,
          action: r.action,
          target: r.target || (r.details?.target_name || r.details?.student_name || r.details?.target_username || '—'),
          name: r.name || 'System',
          role: r.role || '—',
          email: (r.role?.toLowerCase() === 'student' || r.email?.includes('@aralert.local') || r.email?.startsWith('student-')) ? '—' : (r.email || '—'),
          lrn: r.lrn || '—',
        }));

        const totalPages = Math.min(firstRes.data.total_pages || 1, 20); // up to 600 records

        if (totalPages > 1) {
          const promises = [];
          for (let p = 2; p <= totalPages; p++) {
            const nextParams = new URLSearchParams(params);
            nextParams.set('page', String(p));
            promises.push(api.get<{ results: any[] }>(`/users/audit-logs/?${nextParams.toString()}`));
          }
          const results = await Promise.all(promises);
          if (isCancelled) return;
          for (const res of results) {
            if (res.data?.results) {
              const mapped = res.data.results.map((r: any) => ({
                id: String(r.id),
                timestamp: r.timestamp,
                action: r.action,
                target: r.target || (r.details?.target_name || r.details?.student_name || r.details?.target_username || '—'),
                name: r.name || 'System',
                role: r.role || '—',
                email: (r.role?.toLowerCase() === 'student' || r.email?.includes('@aralert.local') || r.email?.startsWith('student-')) ? '—' : (r.email || '—'),
                lrn: r.lrn || '—',
              }));
              allLogs = allLogs.concat(mapped);
            }
          }
        }

        if (!isCancelled) {
          setLogs(allLogs);
        }
      } catch (err) {
        console.error('Failed to load audit logs for export:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingLogs(false);
        }
      }
    };

    fetchLogsForExport();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, datePreset, dateFrom, dateTo, actionFilter, searchFilter]);

  if (!isOpen) return null;

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

  const getExportData = (): AuditLogExportData => ({
    division,
    district,
    schoolName,
    schoolAddress,
    title: documentTitle,
    dateRangeStr,
    paperSize,
    logs,
  });

  const handleDownloadExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportAuditLogsToExcel(getExportData());
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Failed to generate Excel file.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadDocx = async () => {
    try {
      setIsExportingDocx(true);
      await exportAuditLogsToDocx(getExportData());
    } catch (err) {
      console.error('Failed to export DOCX:', err);
      alert('Failed to generate Word document.');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportAuditLogsToPdf(getExportData());
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to generate PDF document.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadCsv = () => {
    try {
      setIsExportingCsv(true);
      exportAuditLogsToCsv(getExportData());
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert('Failed to generate CSV file.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="relative w-full max-w-[96vw] 2xl:max-w-[1640px] h-[95vh] max-h-[95vh] rounded-3xl bg-white dark:bg-[#0A0A0A] shadow-2xl border border-slate-200 dark:border-[#1A1A1A] flex flex-col overflow-hidden">
        {/* Fixed Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-[#1A1A1A] px-5 py-2.5 sm:py-3 flex-shrink-0 bg-white dark:bg-[#0A0A0A] z-20">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
              Export System Audit Logs
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

        {/* Scrollable Content Body */}
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-2.5 space-y-3 scroll-smooth">
          {/* Header Settings Form - Collapsible Top Panel */}
          {showSettings && (
            <div
              ref={settingsRef}
              className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50 dark:bg-[#0E0E0E] p-4 sm:p-5 space-y-5 text-xs animate-in fade-in duration-150 shadow-xs"
            >
              <div>
                <div className="mb-3">
                  <span className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider text-xs">
                    Header Details
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1 text-[10.5px]">
                      Division
                    </label>
                    <input
                      type="text"
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1 text-[10.5px]">
                      District
                    </label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1 text-[10.5px]">
                      School Name
                    </label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1 text-[10.5px]">
                      School Address
                    </label>
                    <input
                      type="text"
                      value={schoolAddress}
                      onChange={(e) => setSchoolAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider mb-1 text-[10.5px]">
                      Document Title
                    </label>
                    <input
                      type="text"
                      value={documentTitle}
                      onChange={(e) => setDocumentTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161616] px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Two-Column Workspace: Left Controls, Right Fixed-Width Sheet Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column Controls */}
            <div className="lg:col-span-4 xl:col-span-3 space-y-3 lg:sticky lg:top-0">
              {/* Date Range Selection Box */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-3 space-y-2.5 shadow-sm text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Date Range Filter
                  </span>
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100/70 dark:bg-[#141414] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  {(['all', 'today', 'custom'] as DatePreset[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`rounded-lg py-1 px-1 text-[10.5px] font-bold uppercase transition-all cursor-pointer text-center ${
                        datePreset === p
                          ? 'bg-[var(--brand)] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p === 'all'
                        ? 'ALL'
                        : p === 'today'
                        ? 'TODAY'
                        : 'CUSTOM'}
                    </button>
                  ))}
                </div>

                {/* Custom Date Pickers */}
                {datePreset === 'custom' && (
                  <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-[#1A1A1A]">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">From Date</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[var(--brand)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">To Date</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[var(--brand)]"
                      />
                    </div>
                  </div>
                )}

                {/* Search Text Filter */}
                <div className="pt-2 border-t border-slate-100 dark:border-[#1A1A1A]">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                    <span>Search Filter</span>
                    <Search className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search name, email, or LRN…"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-[var(--brand)]"
                  />
                </div>

                {/* Event Category Filter */}
                <div className="pt-2 border-t border-slate-100 dark:border-[#1A1A1A]">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                    <span>Filter Event</span>
                    <Filter className="w-3 h-3 text-slate-400" />
                  </label>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-[var(--brand)] cursor-pointer"
                  >
                    <option value="">ALL EVENTS</option>
                    <option value="LOGIN">Logins &amp; Authentication</option>
                    <option value="GRADE">Academic Grades &amp; Scores</option>
                    <option value="ATTENDANCE">Attendance &amp; DTR</option>
                    <option value="USER">User &amp; Account Operations</option>
                    <option value="STUDENT_EDIT">Student Record Corrections</option>
                    <option value="TRANSITION">Evaluations &amp; Transitions</option>
                  </select>
                </div>
              </div>

              {/* Paper Size Selector */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-3 space-y-2 shadow-sm text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Paper Size
                  </span>
                  <span className="text-[10px] font-bold text-[var(--brand)] dark:text-blue-400">
                    {PAPER_CONFIG[paperSize].label}
                  </span>
                </div>
                <div className="flex bg-slate-100/70 dark:bg-[#141414] border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 gap-1">
                  {(['letter', 'a4', 'folio'] as const).map((sizeKey) => (
                    <button
                      key={sizeKey}
                      type="button"
                      onClick={() => setPaperSize(sizeKey)}
                      title={PAPER_CONFIG[sizeKey].label}
                      className={`flex-1 rounded-lg h-7 py-1 px-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer text-center whitespace-nowrap flex items-center justify-center ${
                        paperSize === sizeKey
                          ? 'bg-[var(--brand)] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {sizeKey === 'letter' ? 'Short' : sizeKey === 'a4' ? 'A4' : 'Long'}
                    </button>
                  ))}
                </div>
              </div>


            </div>

            {/* Right Column: Physical Paper Sheet Preview */}
            <div className="lg:col-span-8 xl:col-span-9 flex flex-col items-center min-w-0">
              <div className="w-full rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-100/90 dark:bg-[#111111] p-3 sm:p-6 overflow-x-auto flex flex-col items-center shadow-inner">
                {/* Physical Paper Sheet Canvas */}
                <div
                  ref={printRef}
                  data-print-container="true"
                  style={{
                    width: PAPER_CONFIG[paperSize].width,
                    minHeight: PAPER_CONFIG[paperSize].minHeight,
                    fontFamily: "'Times New Roman', Times, Georgia, serif",
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                  }}
                  className="export-paper-sheet bg-white shadow-xl border border-slate-300 pt-16 pb-16 px-10 sm:px-12 text-slate-900 font-serif transition-all duration-150 flex-shrink-0"
                >
                  {/* DepEd and School Letterhead Header */}
                  <div className="flex flex-nowrap items-center justify-center gap-6 pb-2 mx-auto w-full max-w-3xl">
                    <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center">
                      <img src={DEPED_LOGO_SRC} alt="DepEd Logo" className="w-16 h-16 object-contain select-none" />
                    </div>
                    <div className="text-center px-2 space-y-0.5 min-w-0 flex-shrink-0">
                      <p className="text-xs uppercase tracking-wider text-slate-600">{division}</p>
                      <p className="text-xs uppercase tracking-wider text-slate-600">{district}</p>
                      <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900 leading-tight">
                        {schoolName}
                      </h4>
                      <p className="text-xs text-slate-500 italic">{schoolAddress}</p>
                    </div>
                    <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center">
                      <img src={PNAHS_LOGO_SRC} alt="PNAHS Logo" className="w-16 h-16 object-contain select-none" />
                    </div>
                  </div>

                  {/* Document Title Banner */}
                  <div className="text-center mt-3 pb-3 border-b border-slate-900/30">
                    <h3 className="text-base font-bold text-slate-900 tracking-wide uppercase">{documentTitle}</h3>
                    <p className="text-xs font-bold text-slate-700 mt-1 uppercase">Date Range: {dateRangeStr}</p>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">
                      Total Records: {logs.length} events logged in system
                    </p>
                  </div>

                  {/* Audit Logs Table */}
                  <div className="mt-4">
                    <table className="w-full border-collapse border border-slate-900 text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900">
                          <th className="border border-slate-900 px-1.5 py-1 text-center w-8">#</th>
                          <th className="border border-slate-900 px-2 py-1 text-center w-36">TIMESTAMP (PHT)</th>
                          <th className="border border-slate-900 px-2 py-1 text-left w-44">EVENT / ACTION</th>
                          <th className="border border-slate-900 px-2 py-1 text-left w-40">TARGET</th>
                          <th className="border border-slate-900 px-2 py-1 text-left w-36">ACTOR NAME</th>
                          <th className="border border-slate-900 px-2 py-1 text-center w-24">ROLE</th>
                          <th className="border border-slate-900 px-2 py-1 text-left">EMAIL</th>
                          <th className="border border-slate-900 px-2 py-1 text-center w-28">LRN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingLogs ? (
                          <tr>
                            <td colSpan={8} className="border border-slate-900 py-8 text-center text-slate-500 italic">
                              Loading audit logs for preview…
                            </td>
                          </tr>
                        ) : logs.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="border border-slate-900 py-8 text-center text-slate-500 italic">
                              No audit events found matching the selected range.
                            </td>
                          </tr>
                        ) : (
                          logs.slice(0, 50).map((log, idx) => (
                            <tr key={log.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                              <td className="border border-slate-900 px-1.5 py-1 text-center font-mono text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="border border-slate-900 px-2 py-1 text-center text-[10.5px] font-mono">
                                {log.timestamp}
                              </td>
                              <td className="border border-slate-900 px-2 py-1 text-left text-[11px] font-semibold">
                                {log.action.replace(/_/g, ' ')}
                              </td>
                              <td className="border border-slate-900 px-2 py-1 text-left text-[11px] font-semibold text-slate-900 truncate max-w-[140px]">
                                {log.target || '—'}
                              </td>
                              <td className="border border-slate-900 px-2 py-1 text-left text-[11px]">
                                {log.name || 'System'}
                              </td>
                              <td className="border border-slate-900 px-2 py-1 text-center text-[10.5px]">
                                {log.role || '—'}
                              </td>
                              <td className="border border-slate-900 px-2 py-1 text-left text-[10.5px] font-mono truncate max-w-[150px]">
                                {log.role?.toLowerCase() === 'student' || log.email?.includes('@aralert.local') || log.email?.startsWith('student-') ? '—' : (log.email || '—')}
                              </td>
                              <td className="border border-slate-900 px-2 py-1 text-center text-[10.5px] font-mono">
                                {log.lrn || '—'}
                              </td>
                            </tr>
                          ))
                        )}
                        {logs.length > 50 && (
                          <tr className="bg-slate-100/60 font-italic text-slate-600">
                            <td colSpan={8} className="border border-slate-900 py-1.5 px-3 text-center text-[11px]">
                              Showing first 50 of {logs.length} events in on-screen preview. Complete set ({logs.length} records) will be included in exported file.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>


                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Footer (Cancel and download buttons aligned to bottom right) */}
        <div className="flex-shrink-0 bg-white dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-[#1A1A1A] px-5 py-3 flex flex-wrap items-center justify-end gap-2 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownloadDocx}
            disabled={isExportingDocx || isLoadingLogs || logs.length === 0}
            className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingDocx ? 'Generating Word…' : 'Download Document (.docx)'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf || isLoadingLogs || logs.length === 0}
            className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPdf ? 'Generating PDF…' : 'Download PDF (.pdf)'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isExportingExcel || isLoadingLogs || logs.length === 0}
            className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingExcel ? 'Generating Excel…' : 'Download Excel (.xlsx)'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isExportingCsv || isLoadingLogs || logs.length === 0}
            className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingCsv ? 'Exporting CSV…' : 'Download CSV (.csv)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportAuditLogModal;
