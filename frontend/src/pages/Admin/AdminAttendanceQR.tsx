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
          dark: '#21793D',
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
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center space-x-2">
        <Link
          to="/admin"
          className="text-gray-500 hover:text-[var(--brand)] inline-flex items-center text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
        <div className="p-8 flex flex-col items-center text-center">
          {error && (
            <div className="w-full mb-6 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-4">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="w-64 h-64 flex flex-col items-center justify-center border border-gray-100 rounded-xl bg-gray-50/50">
              <RefreshCw className="w-8 h-8 text-[var(--brand)] animate-spin" />
              <span className="mt-3 text-sm text-gray-500 font-medium">Generating secure code...</span>
            </div>
          ) : (
            <div className="relative">
              <div className="p-4 bg-[var(--brand-light)]/50 rounded-2xl border border-[var(--brand-border)]">
                <canvas ref={canvasRef} className="rounded-lg shadow-sm" />
              </div>
            </div>
          )}

          {session && (
            <div className="mt-6 space-y-4 w-full">
              <div className="inline-flex items-center space-x-2 bg-[var(--brand-light)] text-[var(--brand-dark)] px-3 py-1 rounded-full text-xs font-bold border border-[var(--brand-border)]">
                <CheckCircle2 className="w-4 h-4 text-[var(--brand)]" />
                <span>Active Staff QR Code</span>
              </div>

              <div className="flex items-center justify-center space-x-2 text-[var(--brand-text)] bg-[var(--brand-light)] border border-[var(--brand-border)] p-4 rounded-xl max-w-sm mx-auto text-left">
                <Clock className="w-5 h-5 text-[var(--brand)] shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider">All-day staff DTR QR</p>
                  <p className="text-xs mt-0.5 font-semibold">
                    One QR code records each tutor or faculty DTR punch automatically based on the scan time.
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Faculty: 8:00 AM in, 11:30 AM out, 1:00 PM in, 4:30 PM out. Tutors: 4:30 PM in, 5:00 PM out.
              </p>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Print-ready long bond paper export</p>
                <p className="mt-1 text-xs text-gray-500">Downloads an 8.5 × 13 inch poster ready to print and post for tutors and faculty.</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button type="button" onClick={() => exportPrintFile('png')} disabled={exportingFormat !== null} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-60">
                    <FileImage className="h-4 w-4" /> {exportingFormat === 'png' ? 'Creating…' : 'PNG'}
                  </button>
                  <button type="button" onClick={() => exportPrintFile('jpeg')} disabled={exportingFormat !== null} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-60">
                    <FileImage className="h-4 w-4" /> {exportingFormat === 'jpeg' ? 'Creating…' : 'JPEG'}
                  </button>
                  <button type="button" onClick={() => exportPrintFile('pdf')} disabled={exportingFormat !== null} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">
                    <FileText className="h-4 w-4" /> {exportingFormat === 'pdf' ? 'Creating…' : 'PDF'}
                  </button>
                </div>
              </div>

              <button
                onClick={generateQR}
                className="text-[var(--brand)] hover:text-[var(--brand-dark)] text-xs font-bold flex items-center justify-center space-x-1 mx-auto transition-colors mt-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate Session ID</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
