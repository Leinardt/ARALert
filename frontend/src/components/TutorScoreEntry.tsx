import React, { useState } from 'react';
import { academicService } from '../services/academicService';
import type { User } from '../types';

interface Props {
  student: User | null;
  onCreated?: () => void;
}

export const TutorScoreEntry: React.FC<Props> = ({ student, onCreated }) => {
  const [score, setScore] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return alert('Select a student first.');
    if (score === '' || Number.isNaN(score)) return alert('Enter a valid score.');

    setLoading(true);
    try {
      await academicService.createGrade({
        student: student.id,
        component_type: 'assessment',
        subject: 'Reading',
        quarter: currentQuarter,
        score: Number(score)
      });
      alert('Daily Reading score logged successfully.');
      setScore('');
      onCreated && onCreated();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail || 'Failed to log score.');
    } finally {
      setLoading(false);
    }
  };

  if (!student) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-light)] text-[var(--brand-dark)]">
          <span className="text-lg font-bold">+</span>
        </div>
        <p className="mt-4 text-base font-semibold text-slate-800">Start by choosing a student</p>
        <p className="mt-2 text-sm text-slate-500">Choose a student to begin logging the daily Reading score.</p>
      </div>
    );
  }

  const statusLabel = score === '' ? 'Awaiting score' : 'Ready to submit';

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Daily score entry</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">{student.full_name}</h3>
          <p className="mt-1 text-sm text-slate-500">Log the student’s Reading score for today.</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-light)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--brand-dark)]">
          {statusLabel}
        </span>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Task score</p>
            <input
              type="number"
              min={0}
              step={1}
              value={score}
              onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Enter score"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-lg font-semibold text-slate-800 outline-none transition focus:border-[var(--brand)] focus:bg-white"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Out of</p>
            <div className="mt-3 flex h-[52px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-lg font-bold text-slate-800">
              20
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Status</p>
            <div className="mt-3 inline-flex items-center rounded-xl bg-[var(--brand)] px-3 py-2.5 text-sm font-semibold text-white shadow-sm">
              {score === '' ? 'Pending' : 'Set'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-light)] p-3 text-sm text-[var(--brand-text)]">
          <div className="mt-0.5 rounded-lg bg-white p-1 text-[var(--brand-dark)]">✓</div>
          <p>Daily scores should be entered as whole numbers. Reading is assigned automatically.</p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-2xl bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
        >
          {loading ? 'Saving...' : 'Save Score'}
        </button>
      </div>
    </div>
  );
};

export default TutorScoreEntry;
