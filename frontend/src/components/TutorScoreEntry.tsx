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
      <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 text-center text-sm text-slate-300">
        Choose a student to begin logging daily Reading scores.
      </div>
    );
  }

  const statusLabel = score === '' ? 'Awaiting score' : 'Ready to submit';

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 shadow-sm p-6 text-slate-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Daily score entry</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{student.full_name}</h3>
          <p className="mt-1 text-sm text-slate-400">Log the student’s daily Reading score here.</p>
        </div>
        <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
          {statusLabel}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Task score</p>
          <input
            type="number"
            min={0}
            step={1}
            value={score}
            onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Enter score"
            className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-3 text-lg font-semibold text-white outline-none transition focus:border-[var(--brand)]"
          />
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Out of</p>
          <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-3 text-lg font-semibold text-white">
            20
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Status</p>
          <div className="mt-3 inline-flex items-center rounded-2xl bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white shadow-sm">
            {score === '' ? 'Pending' : 'Set'}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">Daily scores should be entered as whole numbers. Reading is assigned automatically.</p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-3xl bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Saving...' : 'Save Score'}
        </button>
      </div>
    </div>
  );
};

export default TutorScoreEntry;
