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
    <div className="mx-auto max-w-3xl space-y-6">

      {/* ── Main Card ── */}
      <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">

        {/* QR Section — centered */}
        <div className="flex flex-col items-center justify-center gap-4 p-8 pb-6">

          {error && (
            <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-3 text-center text-xs text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex h-[220px] w-[220px] flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50">
              <RefreshCw className="h-8 w-8 animate-spin text-[var(--brand)]" />
              <span className="mt-3 text-xs font-medium text-slate-500">Generating…</span>
            </div>
          ) : (
            <div className="group relative cursor-zoom-in" onClick={() => setIsEnlarged(true)} title="Click to enlarge">
              <div className="rounded-[20px] border-2 border-[var(--brand-border)] bg-[var(--brand-light)]/60 p-3 shadow-md transition-transform duration-200 group-hover:scale-[1.02] group-hover:shadow-lg">
                <canvas ref={canvasRef} className="block rounded-xl bg-white p-2" style={{ width: 220, height: 220 }} />
              </div>
              {/* Zoom hint overlay */}
              <div className="absolute inset-0 flex items-center justify-center rounded-[20px] bg-black/0 transition-all duration-200 group-hover:bg-black/10">
                <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold text-slate-700 opacity-0 shadow-md backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                  <ZoomIn className="h-3 w-3" />
                  Tap to enlarge
                </div>
              </div>
            </div>
          )}

          {/* Active session badge */}
          {session && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active Session
            </span>
          )}

          {session && (
            <button
              onClick={generateQR}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand)] transition-colors hover:text-[var(--brand-dark)]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate QR
            </button>
          )}
        </div>

        <div className="border-t border-gray-100" />

        {/* Info + Export Section */}
        <div className="grid gap-3 p-6 sm:grid-cols-2">
          {/* All-day DTR info */}
          <div className="rounded-[18px] border border-[var(--brand-border)] bg-[var(--brand-light)] p-3.5">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--brand-dark)] shadow-sm">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand-dark)]">All-day Staff DTR</p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--brand-text)]">
                  One QR code records each tutor or faculty DTR punch automatically based on scan time.
                </p>
              </div>
            </div>
          </div>

          {/* Recommended schedule */}
          <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <p className="text-xs font-semibold text-slate-800">Recommended schedule</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Faculty: 8:00 AM in, 11:30 AM out, 1:00 PM in, 4:30 PM out.<br />
              Tutors: 4:30 PM in, 5:00 PM out.
            </p>
          </div>

          {/* Print-ready export — full width */}
          <div className="rounded-[18px] border border-slate-200 bg-white p-3.5 shadow-sm sm:col-span-2">
            <div className="mb-2.5 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-slate-700" />
              <p className="text-xs font-semibold text-slate-800">Print-ready export</p>
            </div>
            <p className="text-xs text-slate-500">Download a long bond paper poster for the staff area.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => exportPrintFile('png')}
                disabled={exportingFormat !== null}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <FileImage className="h-4 w-4" />
                {exportingFormat === 'png' ? 'Creating…' : 'PNG'}
              </button>
              <button
                type="button"
                onClick={() => exportPrintFile('jpeg')}
                disabled={exportingFormat !== null}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <FileImage className="h-4 w-4" />
                {exportingFormat === 'jpeg' ? 'Creating…' : 'JPEG'}
              </button>
              <button
                type="button"
                onClick={() => exportPrintFile('pdf')}
                disabled={exportingFormat !== null}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[var(--brand-dark)] disabled:opacity-60"
              >
                <FileText className="h-4 w-4" />
                {exportingFormat === 'pdf' ? 'Creating…' : 'PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Enlarged QR Lightbox Modal ── */}
      {isEnlarged && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setIsEnlarged(false)}
        >
          <div
            className="relative flex flex-col items-center gap-4 rounded-[28px] bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsEnlarged(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Staff DTR QR Code</p>

            <div className="rounded-[20px] border-2 border-[var(--brand-border)] bg-[var(--brand-light)]/60 p-4 shadow-inner">
              <canvas ref={enlargedCanvasRef} className="block rounded-xl bg-white p-3" style={{ width: 480, height: 480 }} />
            </div>

            {session && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
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
