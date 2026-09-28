import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Check, AlertCircle, CheckCircle2, UserCheck, Shield,
  Search, Users, Sparkles, AlertTriangle
} from 'lucide-react';
import { academicService } from '../services/academicService';
import type { AvailableTutorItem } from '../types';

interface AssignTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    id: string;
    full_name: string;
    lrn?: string | null;
    program: string;
  } | null;
  period?: 'MOSY' | 'EOSY' | 'FULL_YEAR';
  onAssigned: () => void;
}

export const AssignTutorModal: React.FC<AssignTutorModalProps> = ({
  isOpen,
  onClose,
  student,
  period = 'MOSY',
  onAssigned,
}) => {
  const [tutors, setTutors] = useState<AvailableTutorItem[]>([]);
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && student) {
      setSelectedTutorId(null);
      setNotes(`Assigned during ${period} evaluation for ${student.program.toUpperCase()} program`);
      setError(null);
      setSuccessMsg(null);
      setSearchQuery('');
      fetchTutors();
    }
  }, [isOpen, student, period]);

  const fetchTutors = async () => {
    if (!student) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await academicService.getAvailableTutors(student.program);
      setTutors(data);
    } catch (err: any) {
      console.error('Failed to load available tutors:', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to load compatible tutors.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTutors = useMemo(() => {
    if (!searchQuery.trim()) return tutors;
    const q = searchQuery.toLowerCase();
    return tutors.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.tutor_type_display.toLowerCase().includes(q)
    );
  }, [tutors, searchQuery]);

  const handleAssign = async () => {
    if (!student || !selectedTutorId) {
      setError('Please select a compatible tutor to assign.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await academicService.assignTutor({
        student_id: student.id,
        tutor_id: selectedTutorId,
        period,
        notes,
      });
      setSuccessMsg(res.message || 'Tutor successfully assigned!');
      setTimeout(() => {
        onAssigned();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Error assigning tutor:', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to assign tutor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Assign Tutor
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Match student with a strictly compatible tutor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Context Card */}
        <div className="px-5 py-3 bg-slate-100/60 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Target Student</span>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {student.full_name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                LRN: <span className="font-mono">{student.lrn || 'N/A'}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">Program:</span>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  student.program === 'plus'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                }`}
              >
                {student.program}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold">
                {period}
              </span>
            </div>
          </div>
        </div>

        {/* Informational Guidance (PNAHS Mixed Grades & Sections Cohort Policy) */}
        <div className="px-5 py-2.5 bg-sky-50/50 dark:bg-sky-950/20 border-b border-sky-100 dark:border-sky-900/30 flex items-start gap-2.5 text-xs text-sky-800 dark:text-sky-300 shrink-0">
          <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">PNAHS ARAL Program &amp; Cohort Structure:</span>
            <p className="text-[11px] opacity-90">
              Tutors are not restricted to a single grade level or section — they can teach mixed Grade 7–10 students across sections. Matching is based solely on program level ({student.program === 'plus' ? 'Plus certified' : 'Basic certified'}). Standard cohort size is <strong>15–25 students</strong> (up to 30 max).
            </p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body & Tutors List */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search compatible tutors by name or certification..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>

          {/* List */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
              Finding compatible certified tutors...
            </div>
          ) : filteredTutors.length === 0 ? (
            <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-6">
              <Users className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                No compatible tutors found
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                There are currently no active tutors certified for {student.program.toUpperCase()} program.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredTutors.map((tutor) => {
                const isSelected = selectedTutorId === tutor.id;
                const count = tutor.current_students_count;
                const loadBadgeColor =
                  count === 0
                    ? 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                    : count < 15
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/40'
                    : count <= 25
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40'
                    : count <= 30
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/40';

                return (
                  <div
                    key={tutor.id}
                    onClick={() => setSelectedTutorId(tutor.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-[var(--brand)] bg-[var(--brand)]/5 dark:bg-[var(--brand)]/10 ring-2 ring-[var(--brand)]/30'
                        : 'border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {tutor.full_name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{tutor.email}</p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[var(--brand)] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                          {tutor.tutor_type_display}
                        </span>

                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                            tutor.is_available
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40'
                          }`}
                        >
                          {tutor.availability_status}
                        </span>
                      </div>
                    </div>

                    {/* Informational student count & PNAHS 15-25 Cohort Load */}
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-zinc-400">Assigned Cohort:</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${loadBadgeColor}`}>
                        {tutor.cohort_load_status || `${count}/25 students`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes / Reason input */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
              Assignment Notes / Audit Log Reason
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Assigned to Plus Tutor following successful MOSY progression."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-900/60 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={!selectedTutorId || isSubmitting}
            className="px-5 py-2 rounded-xl bg-[var(--brand)] hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Assigning...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                <span>Confirm Assignment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
