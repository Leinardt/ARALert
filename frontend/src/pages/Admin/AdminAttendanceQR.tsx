import React, { useState, useEffect, useRef } from 'react';
import { academicService } from '../../services/academicService';
import { ArrowLeft, RefreshCw, CheckCircle2, Clock, FileImage, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { exportStaffQrPrintFile } from '../../utils/staffQrPrintExport';

export const AdminAttendanceQR: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'png' | 'jpeg' | 'pdf' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateQR = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Create a 24-hour long session so it does not count down or expire during the workday
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

  // Render QR code to Canvas when session changes
  useEffect(() => {
    if (session && canvasRef.current) {
      const qrValue = session.id;
      QRCode.toCanvas(canvasRef.current, qrValue, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }, (err) => {
        if (err) console.error('QR Render Error:', err);
      });
    }
  }, [session]);

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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        

        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-border)] bg-[var(--brand-light)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--brand-dark)]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Staff Attendance
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
        <div className="border-b border-gray-200 bg-gradient-to-r from-[var(--brand-light)] via-white to-slate-50 px-5 py-5 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Attendance Access</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">Staff DTR QR Code</h1>
            </div>
            {session && (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Active Session
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div className="flex flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
            {error && (
              <div className="mb-2 w-full rounded-2xl border border-red-200 bg-red-50 p-2.5 text-left text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex w-full flex-col items-center justify-center">
              {isLoading ? (
                <div className="flex h-[160px] w-full max-w-[160px] flex-col items-center justify-center rounded-[16px] border border-dashed border-slate-200 bg-white">
                  <RefreshCw className="h-7 w-7 animate-spin text-[var(--brand)]" />
                  <span className="mt-2.5 text-xs font-medium text-slate-500">Generating...</span>
                </div>
              ) : (
                <div className="relative w-full max-w-[180px]">
                  <div className="rounded-[16px] border border-[var(--brand-border)] bg-[var(--brand-light)]/60 p-2.5 shadow-inner">
                    <canvas ref={canvasRef} className="block w-full rounded-lg bg-white p-2" />
                  </div>
                </div>
              )}

              {session && (
                <button
                  onClick={generateQR}
                  className="mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--brand)] transition-colors hover:text-[var(--brand-dark)]"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Regenerate</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[20px] border border-[var(--brand-border)] bg-[var(--brand-light)] p-3.5 text-left">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[var(--brand-dark)] shadow-sm">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand-dark)]">All-day staff DTR</p>
                  <p className="mt-0.5 text-xs text-[var(--brand-text)]">
                    One QR code records each tutor or faculty DTR punch automatically based on scan time.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <p className="text-xs font-semibold text-slate-800">Recommended schedule</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Faculty: 8:00 AM in, 11:30 AM out, 1:00 PM in, 4:30 PM out. Tutors: 4:30 PM in, 5:00 PM out.
              </p>
            </div>

            <div className="rounded-[20px] border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="mb-2.5 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-slate-700" />
                <p className="text-xs font-semibold text-slate-800">Print-ready export</p>
              </div>
              <p className="text-xs text-slate-500">
                Download a long bond paper poster for staff area.
              </p>

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
      </div>
    </div>
  );
};
