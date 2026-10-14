import React, { useState, useEffect } from 'react';
import { X, Download, QrCode, FileText, Check, Copy } from 'lucide-react';
import {
  StudentQrData,
  getStudentDisplayName,
  getStudentManualCode,
  generateStudentQrDataUrl,
  INSTRUCTION_GUIDES,
  exportStudentQrToDocx,
  exportStudentQrToPdf,
  exportStudentQrToJpeg,
} from '../utils/studentQrExportService';

export interface ExportStudentQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentQrData | null;
}

export type QrPaperSize = 'letter' | 'a4' | 'folio';

export const QR_PAPER_CONFIG: Record<
  QrPaperSize,
  { width: string; minHeight: string; label: string; shortLabel: string; dimensions: string }
> = {
  letter: {
    width: '580px',
    minHeight: '750px',
    label: 'Short / Letter (8.5 × 11 in)',
    shortLabel: 'Short',
    dimensions: '8.5 × 11 in',
  },
  a4: {
    width: '580px',
    minHeight: '820px',
    label: 'A4 (210 × 297 mm)',
    shortLabel: 'A4',
    dimensions: '210 × 297 mm',
  },
  folio: {
    width: '580px',
    minHeight: '886px',
    label: 'Long / Folio (8.5 × 13 in)',
    shortLabel: 'Long',
    dimensions: '8.5 × 13 in',
  },
};

export const ExportStudentQrModal: React.FC<ExportStudentQrModalProps> = ({
  isOpen,
  onClose,
  student,
}) => {
  const [paperSize, setPaperSize] = useState<QrPaperSize>('a4');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isExportingFormat, setIsExportingFormat] = useState<'docx' | 'pdf' | 'jpeg' | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!student?.id) return;
    let isMounted = true;
    generateStudentQrDataUrl(student.id, 400)
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate preview QR code:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [student?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !student) return null;

  const displayName = getStudentDisplayName(student);
  const manualCode = getStudentManualCode(student.id);

  const handleDownload = async (format: 'docx' | 'pdf' | 'jpeg') => {
    try {
      setIsExportingFormat(format);
      if (format === 'docx') {
        await exportStudentQrToDocx(student, paperSize);
      } else if (format === 'pdf') {
        await exportStudentQrToPdf(student, paperSize);
      } else if (format === 'jpeg') {
        await exportStudentQrToJpeg(student, paperSize);
      }
    } catch (err) {
      console.error(`Export to ${format} failed:`, err);
    } finally {
      setIsExportingFormat(null);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(manualCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm animate-fade-in"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="relative w-full max-w-[96vw] 2xl:max-w-[1440px] h-[95vh] max-h-[95vh] rounded-3xl bg-white dark:bg-[#0A0A0A] shadow-2xl border border-slate-200 dark:border-[#1A1A1A] flex flex-col overflow-hidden">
        {/* Fixed Top Header (Solid Opaque, Non-scrollable) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-[#1A1A1A] px-5 py-2.5 sm:py-3 flex-shrink-0 bg-white dark:bg-[#0A0A0A] z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                EXPORT STUDENT ATTENDANCE QR CODE
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Official single-student printable pass with bilingual DepEd ARAL guidelines
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition cursor-pointer self-start sm:self-auto"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 scroll-smooth">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Preview Details & Paper Size Selection */}
            <div className="lg:col-span-4 xl:col-span-4 space-y-3.5 lg:sticky lg:top-0">
              {/* Card 1: Student Information Details */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0E0E0E] p-4 space-y-3 shadow-xs text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    STUDENT DETAILS
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-900/60">
                    Active Learner
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      STUDENT NAME
                    </label>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">
                      {displayName}
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      LEARNER REFERENCE NUMBER (LRN)
                    </label>
                    <p className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs mt-0.5">
                      {student.lrn || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        MANUAL CODE
                      </label>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--brand)] hover:underline cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="mt-1 inline-flex items-center font-mono font-extrabold text-sm tracking-widest text-[var(--brand)] dark:text-blue-400 bg-slate-50 dark:bg-[#161616] px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800">
                      {manualCode}
                    </div>
                  </div>

                  {student.gradeLevel && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        GRADE & SECTION
                      </label>
                      <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs mt-0.5">
                        {student.gradeLevel} {student.section ? `• ${student.section}` : ''}
                      </p>
                    </div>
                  )}

                  {student.assignedTutorName && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        ASSIGNED TUTOR
                      </label>
                      <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs mt-0.5">
                        {student.assignedTutorName}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Paper Size Selection */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50/80 dark:bg-[#0E0E0E] p-3.5 space-y-2 text-xs shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    PAPER SIZE
                  </span>
                  <span className="text-[10.5px] font-bold text-[var(--brand)] dark:text-blue-400">
                    {QR_PAPER_CONFIG[paperSize].label}
                  </span>
                </div>

                <div className="flex bg-white dark:bg-[#141414] border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 gap-1 shadow-2xs">
                  {(['letter', 'a4', 'folio'] as const).map((sizeKey) => (
                    <button
                      key={sizeKey}
                      type="button"
                      onClick={() => setPaperSize(sizeKey)}
                      title={QR_PAPER_CONFIG[sizeKey].label}
                      className={`flex-1 rounded-lg h-7 py-1 px-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer text-center whitespace-nowrap flex items-center justify-center ${
                        paperSize === sizeKey
                          ? 'bg-[var(--brand)] text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {QR_PAPER_CONFIG[sizeKey].shortLabel}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 pt-0.5">
                  Select your school printer paper. Outputs portrait orientation with optimized margin bounds.
                </p>
              </div>

              {/* Card 3: Printing Instructions Notice */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-[#1A1A1A] bg-white dark:bg-[#0E0E0E] p-3.5 space-y-1.5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  INK-SAVING PRINT FORMAT
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Clean black-and-white layout with zero dark fills or background tints. Highly readable for both standard school laserjet printers and phone camera scanners.
                </p>
              </div>
            </div>

            {/* Right Column: Physical Paper Sheet Preview */}
            <div className="lg:col-span-8 xl:col-span-8 flex flex-col min-w-0">
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-100/90 dark:bg-[#111111] p-4 sm:p-8 overflow-x-auto flex flex-col items-center shadow-inner min-h-[640px]">
                {/* Physical Sheet Card with Fixed Proportions */}
                <div
                  style={{
                    width: QR_PAPER_CONFIG[paperSize].width,
                    minHeight: QR_PAPER_CONFIG[paperSize].minHeight,
                    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                  className="bg-white text-black shadow-xl border border-slate-300 rounded-sm p-6 sm:p-10 select-none flex flex-col justify-between transition-all duration-200"
                >
                  <div>
                    {/* Top Header */}
                    <div className="text-center">
                      <h1 className="text-2xl font-bold tracking-tight text-black">
                        ARALert
                      </h1>
                      <p className="text-xs font-semibold text-gray-800 mt-0.5">
                        Palanas National Agricultural High School • ARAL Program
                      </p>
                      <div className="w-full h-[1px] bg-gray-200 mt-3.5 mb-6" />
                    </div>

                    {/* QR Code Presentation */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="p-2 border border-black rounded-sm bg-white shadow-2xs">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="Student QR Code"
                            className="w-44 h-44 object-contain block"
                          />
                        ) : (
                          <div className="w-44 h-44 flex items-center justify-center bg-gray-50 text-gray-400 text-xs">
                            Generating QR...
                          </div>
                        )}
                      </div>

                      {/* Student Name */}
                      <h2 className="text-lg font-bold uppercase tracking-tight text-black mt-4 text-center">
                        {displayName}
                      </h2>

                      {/* Manual Attendance Code */}
                      <div className="mt-3 flex flex-col items-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-black">
                          MANUAL ATTENDANCE CODE:
                        </span>
                        <div className="mt-1 px-4 py-1 border-2 border-black rounded-none">
                          <span className="font-mono text-xl font-bold tracking-widest text-black">
                            {manualCode}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1.5 text-center max-w-[280px]">
                          Use this 6-digit code if there are problems scanning the QR code.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Section: Instructions & Guidelines */}
                  <div className="mt-8 pt-4 border-t border-gray-200">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-black mb-2.5">
                      INSTRUCTIONS & GUIDELINES
                    </h3>
                    <div className="space-y-2 text-[10.5px] leading-relaxed">
                      {INSTRUCTION_GUIDES.map((guide, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <p className="font-bold text-black">{guide.en}</p>
                          <p className="italic text-gray-700 pl-3">{guide.mb}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Footer (Download Buttons matching ExportAttendanceModal placement) */}
        <div className="flex-shrink-0 bg-white dark:bg-[#0A0A0A] border-t border-slate-200 dark:border-[#1A1A1A] px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
          <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-slate-100">{displayName}</span>
            <span>•</span>
            <span className="font-semibold text-[var(--brand)]">LRN: {student.lrn || 'N/A'}</span>
            <span>•</span>
            <span className="uppercase font-semibold text-slate-700 dark:text-slate-300">
              {QR_PAPER_CONFIG[paperSize].label}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={isExportingFormat !== null}
              onClick={onClose}
              className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isExportingFormat !== null}
              onClick={() => handleDownload('docx')}
              className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              {isExportingFormat === 'docx' ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-white" />
              )}
              <span>Download Document (.docx)</span>
            </button>

            <button
              type="button"
              disabled={isExportingFormat !== null}
              onClick={() => handleDownload('pdf')}
              className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              {isExportingFormat === 'pdf' ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-white" />
              )}
              <span>Download PDF (.pdf)</span>
            </button>

            <button
              type="button"
              disabled={isExportingFormat !== null}
              onClick={() => handleDownload('jpeg')}
              className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              {isExportingFormat === 'jpeg' ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-white" />
              )}
              <span>Download JPEG (.jpeg)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportStudentQrModal;
