import React, { useState, useEffect, useRef } from 'react';
import { academicService } from '../../services/academicService';
import { RefreshCw, CheckCircle2, Clock, FileImage, FileText, X, ZoomIn } from 'lucide-react';
import QRCode from 'qrcode';
import { exportStaffQrPrintFile } from '../../utils/staffQrPrintExport';

export const AdminAttendanceQR: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'png' | 'jpeg' | 'pdf' | null>(null);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enlargedCanvasRef = useRef<HTMLCanvasElement>(null);

  const generateQR = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const newSession = await academicService.createAttendanceSession({
        session_type: 'staff',
        expires_in_minutes: 1440,
      });
      setSession(newSession);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to generate QR session.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateQR();
  }, []);

  // Render QR to main canvas
  useEffect(() => {
    if (session && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, session.id, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }, (err) => { if (err) console.error('QR Render Error:', err); });
    }
  }, [session]);

  // Render QR to enlarged canvas when modal opens
  useEffect(() => {
    if (isEnlarged && session && enlargedCanvasRef.current) {
      QRCode.toCanvas(enlargedCanvasRef.current, session.id, {
        width: 480,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }, (err) => { if (err) console.error('QR Enlarged Render Error:', err); });
    }
  }, [isEnlarged, session]);

  const exportPrintFile = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!session) return;
    setExportingFormat(format);
    try {
      await exportStaffQrPrintFile({
        sessionId: session.id,
        action: 'staff_day',
        expiresAt: session.expires_at,
        format,
      });
    } catch (exportError) {
      console.error('Staff QR print export failed:', exportError);
      setError('Unable to create the print-ready QR file. Please try again.');
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">

      {/* ── Main Card (Responsive 2-column layout to fit single viewport) ── */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 items-stretch divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-[#1A1A1A]">

          {/* ── Left Column: QR Code & Controls (5 cols) ── */}
          <div className="md:col-span-5 p-5 sm:p-6 flex flex-col items-center justify-center text-center gap-3 bg-slate-50/40 dark:bg-[#0d0d0d]">

            {error && (
              <div className="w-full rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-2.5 text-center text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="flex h-[190px] w-[190px] flex-col items-center justify-center rounded-md border border-dashed border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#161616]">
                <RefreshCw className="h-7 w-7 animate-spin text-[var(--brand)]" />
                <span className="mt-2 text-xs font-medium text-slate-500">Generating…</span>
              </div>
            ) : (
              <div className="group relative cursor-zoom-in" onClick={() => setIsEnlarged(true)} title="Click to enlarge">
                <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-[var(--brand-light)]/40 p-2.5 transition-transform duration-200 group-hover:scale-[1.01]">
                  <canvas ref={canvasRef} className="block rounded-sm bg-white p-1.5" style={{ width: 190, height: 190 }} />
                </div>
                {/* Zoom hint overlay */}
                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/0 transition-all duration-200 group-hover:bg-black/10">
                  <div className="flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-black/90 px-2.5 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-200 opacity-0 shadow-md backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                    <ZoomIn className="h-3 w-3" />
                    Click to enlarge
                  </div>
                </div>
              </div>
            )}

            {/* Active session badge & Actions */}
            <div className="flex flex-col items-center gap-2">
              {session && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active Session
                </span>
              )}

              {session && (
                <button
                  type="button"
                  onClick={generateQR}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] transition-colors hover:text-[var(--brand-dark)] cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerate QR
                </button>
              )}
            </div>
          </div>

          {/* ── Right Column: Info & Print Export (7 cols) ── */}
          <div className="md:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-3">
            
            {/* Header info */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Attendance Terminal
              </p>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white mt-0.5">
                Staff DTR QR Code
              </h2>
            </div>

            {/* All-day DTR info */}
            <div className="rounded-md border border-[var(--brand-border)] bg-[var(--brand-light)] dark:bg-[#161616] p-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white dark:bg-[#222222] text-[var(--brand-dark)] dark:text-[var(--brand)] shadow-xs">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-dark)] dark:text-[var(--brand)]">All-day Staff DTR</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--brand-text)] dark:text-slate-300 font-normal">
                    One QR code records each tutor or faculty DTR punch automatically based on scan time.
                  </p>
                </div>
              </div>
            </div>

            {/* Recommended schedule */}
            <div className="rounded-md border border-slate-200 dark:border-[#1A1A1A] bg-slate-50/70 dark:bg-[#161616] p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Recommended Schedule</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400 font-normal">
                Faculty: 8:00 AM in, 11:30 AM out, 1:00 PM in, 4:30 PM out.<br />
                Tutors: 4:30 PM in, 5:00 PM out.
              </p>
            </div>

            {/* Print-ready export */}
            <div className="rounded-md border border-slate-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Print-ready Export</p>
                </div>
                <span className="text-[11px] text-slate-400">Staff area poster</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => exportPrintFile('png')}
                  disabled={exportingFormat !== null}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#161616] px-1.5 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-[#222222] disabled:opacity-60 cursor-pointer"
                >
                  <FileImage className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                  <span className="truncate">{exportingFormat === 'png' ? 'Creating…' : 'PNG'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportPrintFile('jpeg')}
                  disabled={exportingFormat !== null}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 dark:border-[#222222] bg-white dark:bg-[#161616] px-1.5 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-[#222222] disabled:opacity-60 cursor-pointer"
                >
                  <FileImage className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                  <span className="truncate">{exportingFormat === 'jpeg' ? 'Creating…' : 'JPEG'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportPrintFile('pdf')}
                  disabled={exportingFormat !== null}
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-[var(--brand)] px-1.5 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-white transition hover:bg-[var(--brand-dark)] disabled:opacity-60 cursor-pointer"
                >
                  <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                  <span className="truncate">{exportingFormat === 'pdf' ? 'Creating…' : 'PDF'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Enlarged QR Lightbox Modal ── */}
      {isEnlarged && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsEnlarged(false)}
        >
          <div
            className="relative flex flex-col items-center gap-3 sm:gap-4 rounded-xl bg-white dark:bg-[#111111] p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-[#1A1A1A] animate-fade-in-scale max-w-[92vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsEnlarged(false)}
              className="absolute right-3 top-3 sm:right-4 sm:top-4 flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 dark:bg-[#222222] text-slate-600 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-[#333333] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Staff DTR QR Code</p>

            <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-[var(--brand-light)]/40 p-2.5 sm:p-4">
              <canvas ref={enlargedCanvasRef} className="block rounded-sm bg-white p-2 sm:p-3 w-[240px] h-[240px] xs:w-[280px] xs:h-[280px] sm:w-[400px] sm:h-[400px] max-w-[78vw] max-h-[78vw]" />
            </div>

            {session && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active Session
              </span>
            )}

            <p className="text-[11px] text-slate-400">Click anywhere outside to close</p>
          </div>
        </div>
      )}
    </div>
  );
};
