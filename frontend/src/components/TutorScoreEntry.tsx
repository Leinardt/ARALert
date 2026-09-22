import React, { useState } from 'react';
import { academicService } from '../services/academicService';
import type { User } from '../types';
import { CheckCircle2, User as UserIcon, BookOpen, Sparkles } from 'lucide-react';

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
        score: Number(score),
        total_score: 20
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
      <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 border border-gray-200 text-gray-400">
          <UserIcon className="w-7 h-7" />
        </div>
        <p className="mt-4 text-base font-bold text-gray-800">Select a Learner</p>
        <p className="mt-1 text-xs text-gray-400 max-w-sm mx-auto">Choose a student from the directory to quickly log today's daily Reading score.</p>
      </div>
    );
  }

  const isReady = score !== '' && Number(score) >= 0;

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Daily Assessment Entry</p>
          <h3 className="mt-0.5 text-xl font-bold text-gray-900">{student.full_name}</h3>
          <p className="text-xs text-gray-500">LRN: {student.lrn || 'N/A'} &bull; Q{currentQuarter} Daily Reading</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
          isReady
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-gray-50 text-gray-500 border-gray-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          {isReady ? 'Ready to Submit' : 'Awaiting Score'}
        </span>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Task Score
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={score}
              onKeyDown={(e) => {
                if (['e', 'E', '+', '-', '.', ',', ' '].includes(e.key)) e.preventDefault();
              }}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                if (digits === '') {
                  setScore('');
                  return;
                }
                const num = parseInt(digits, 10);
                if (Number.isNaN(num)) setScore('');
                else if (num > 20) setScore(score); // block — keep current value
                else setScore(num);
              }}
              placeholder="0 - 20"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-lg font-bold text-gray-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Max Score</p>
            <div className="flex h-[46px] items-center rounded-xl border border-gray-100 bg-gray-50 px-3.5 text-lg font-bold text-gray-700">
              20 Items
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Percentage</p>
            <div className="flex h-[46px] items-center rounded-xl border border-gray-100 bg-gray-50 px-3.5 text-lg font-extrabold text-[var(--brand)]">
              {score !== '' ? `${Math.round((Number(score) / 20) * 100)}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
        <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-light)] p-3 text-xs text-[var(--brand-text)]">
          <BookOpen className="w-4 h-4 shrink-0 text-[var(--brand)]" />
          <p>Scores are stored under Reading subject and feed into quarterly GPA automatically.</p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || score === ''}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60 shadow-sm shrink-0"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Save Score
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TutorScoreEntry;
