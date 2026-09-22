import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, X } from 'lucide-react';
import type { Attendance, User } from '../types';
import { exportDtrToExcel } from '../utils/dtrExportService';

interface ExportDtrModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  attendanceLogs: Attendance[];
}

const displayDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
});

export const ExportDtrModal: React.FC<ExportDtrModalProps> = ({ isOpen, onClose, currentUser, attendanceLogs }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableDates = useMemo(() => [...new Set(
    attendanceLogs
      .filter((log) => ['tutor', 'faculty'].includes(log.role))
      .map((log) => log.date)
  )].sort().reverse(), [attendanceLogs]);

  useEffect(() => {
    if (isOpen) {
      setSelectedDate(availableDates[0] ?? '');
      setError(null);
    }
  }, [isOpen, availableDates]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!selectedDate) return;
    try {
      setIsExporting(true);
      setError(null);
      await exportDtrToExcel({
        records: attendanceLogs.filter((log) => log.date === selectedDate),
        preparedBy: currentUser?.full_name || 'School Principal',
        selectedDate,
      });
      onClose();
    } catch (err) {
      console.error('Failed to export DTR', err);
      setError(err instanceof Error ? err.message : 'Unable to generate the DTR file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="dtr-export-title">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex rounded-xl bg-[var(--brand-light)] p-2 text-[var(--brand)]"><CalendarDays size={20} /></div>
            <h2 id="dtr-export-title" className="text-xl font-bold text-slate-900">Export Staff DTR</h2>
            <p className="mt-1 text-sm text-slate-500">Choose the attendance day to include in the DTR export.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close export dialog"><X size={18} /></button>
        </div>

        {availableDates.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No tutor or faculty attendance dates are available.</p>
        ) : (
          <div className="mt-6 max-h-64 space-y-2 overflow-y-auto pr-1">
            {availableDates.map((date) => (
              <label key={date} className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${selectedDate === date ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand-dark)]' : 'border-slate-200 hover:bg-slate-50'}`}>
                <span className="font-semibold">{displayDate(date)}</span>
                <input type="radio" name="dtr-export-date" value={date} checked={selectedDate === date} onChange={() => setSelectedDate(date)} className="accent-[var(--brand)]" />
              </label>
            ))}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handleExport} disabled={!selectedDate || isExporting} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60">
            <Download size={16} /> {isExporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>
    </div>
  );
};
