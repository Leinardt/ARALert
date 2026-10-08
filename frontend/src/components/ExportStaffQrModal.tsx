import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import type { AttendanceSession } from '../types';
import {
  exportStaffQrPrintFile,
  generateStaffQrCanvas,
  type ExportFormat,
  type PaperSize,
  PAPER_SIZE_CONFIG,
} from '../utils/staffQrPrintExport';

export interface ExportStaffQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AttendanceSession | null;
  qrDataUrl: string | null;
}

export const PAPER_CONFIG: Record<PaperSize, { width: string; minHeight: string; label: string }> = {
  letter: {
    width: '816px',
    minHeight: '1056px',
    label: 'Short / Letter (8.5 × 11 in)',
  },
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
};

export const ExportStaffQrModal: React.FC<ExportStaffQrModalProps> = ({
  isOpen,
  onClose,
  session,
}) => {
  const [paperSize, setPaperSize] = useState<PaperSize>('letter');
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    if (!session) return;
    setIsLoadingPreview(true);
    generateStaffQrCanvas({
      sessionId: session.id,
      paperSize,
    })
      .then((canvas) => {
        if (!isCancelled) {
          setPreviewDataUrl(canvas.toDataURL('image/png'));
          setIsLoadingPreview(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate staff QR preview canvas:', err);
        if (!isCancelled) setIsLoadingPreview(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [session, paperSize]);

  if (!isOpen) return null;

  const handleExport = async (format: ExportFormat) => {
    if (!session) return;
    setIsExporting(format);
    setError(null);
    try {
      await exportStaffQrPrintFile({
        sessionId: session.id,
        action: 'staff_day',
        expiresAt: session.expires_at,
        format,
        paperSize,
      });
    } catch (err: any) {
      console.error('Failed to export staff QR terminal poster:', err);
      setError(err?.message || 'Unable to generate the print file.');
    } finally {
      setIsExporting(null);
    }
  };

  const shortCode = session?.id
    ? String(session.id).replace(/-/g, '').slice(0, 6).toUpperCase()
    : '------';

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm animate-fade-in"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-qr-modal-title"
    >
      <div className="relative w-full max-w-[96vw] 2xl:max-w-[1640px] h-[95vh] max-h-[95vh] rounded-3xl bg-white dark:bg-[#0A0A0A] shadow-2xl border border-slate-200 dark:border-[#1A1A1A] flex flex-col overflow-hidden">
        {/* Fixed Top Header (Solid Opaque, Non-scrollable) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-[#1A1A1A] px-5 py-2.5 sm:py-3 flex-shrink-0 bg-white dark:bg-[#0A0A0A] z-20">
          <div>
            <h3 id="export-qr-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 uppercase">
              EXPORT DTR LOG QR CODE
            </h3>
          </div>
          <div className="flex items-center gap-2">
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
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-2.5 space-y-2.5 scroll-smooth">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Two-Column Body: Left (Controls), Right (Fixed-Size Paper Sheet Preview) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Paper Size & File Details */}
            <div className="lg:col-span-4 xl:col-span-3 2xl:col-span-3 space-y-2 lg:sticky lg:top-0">
              {/* Paper Size Selector */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50/80 dark:bg-[#0E0E0E] p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Paper Size</span>
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
                      className={`flex-1 rounded-lg h-7 py-1 px-1.5 text-[11px] font-bold uppercase transition-all cursor-pointer text-center whitespace-nowrap flex items-center justify-center ${paperSize === sizeKey
                        ? 'bg-[var(--brand)] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                      {sizeKey === 'letter' ? 'Short' : sizeKey === 'a4' ? 'A4' : 'Long'}
                    </button>
                  ))}
                </div>
              </div>

              {/* File Details (Minimal & Formal without pill fills) */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-50/80 dark:bg-[#0E0E0E] p-3 space-y-2.5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  FILE DETAILS
                </span>
                <div className="space-y-2 text-slate-700 dark:text-slate-300">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/80 dark:border-[#1E1E1E]">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Date:</span>
                    <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">{formattedDate}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/80 dark:border-[#1E1E1E]">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Manual Entry Code:</span>
                    <span className="text-[12px] font-mono font-bold tracking-wider text-slate-900 dark:text-slate-100 select-all">{shortCode}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Session Type:</span>
                    <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 capitalize">Staff DTR Terminal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Physical Paper Sheet Preview (True-to-export Canvas Render) */}
            <div className="lg:col-span-8 xl:col-span-9 2xl:col-span-9 flex flex-col min-w-0">
              {/* Paper Workspace Canvas */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-slate-100/90 dark:bg-[#111111] p-4 sm:p-6 overflow-x-auto flex flex-col items-center shadow-inner">
                {/* Physical Sheet Card with Fixed Proportions matching true export */}
                <div
                  style={{
                    width: PAPER_CONFIG[paperSize].width,
                    minHeight: PAPER_CONFIG[paperSize].minHeight,
                    colorScheme: 'light',
                    backgroundColor: '#ffffff',
                  }}
                  className="export-paper-sheet bg-white shadow-xl border border-slate-300 transition-all duration-200 flex-shrink-0 p-4 sm:p-6 flex flex-col items-center justify-center"
                >
                  {isLoadingPreview || !previewDataUrl ? (
                    <div className="flex flex-col items-center justify-center p-12 gap-3 min-h-[420px]">
                      <RefreshCw className="w-8 h-8 animate-spin text-[var(--brand)]" />
                      <span className="text-xs font-semibold text-slate-500">Generating true export preview...</span>
                    </div>
                  ) : (
                    <img
                      src={previewDataUrl}
                      alt="Staff DTR Live Poster Preview"
                      className="w-full h-auto object-contain block select-none rounded-xs"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed, 100% Solid Opaque Footer for Save/Export Actions */}
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
            onClick={() => handleExport('docx')}
            disabled={!session || isExporting !== null}
            className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            {isExporting === 'docx' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating .docx...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Download Document (.docx)
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            disabled={!session || isExporting !== null}
            className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            {isExporting === 'pdf' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating .pdf...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Download PDF (.pdf)
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleExport('jpg')}
            disabled={!session || isExporting !== null}
            className="w-full sm:w-auto rounded-xl bg-[var(--brand)] px-5 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] transition shadow-xs disabled:opacity-60 cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            {isExporting === 'jpg' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating .jpg...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Download Image (.jpg)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportStaffQrModal;
