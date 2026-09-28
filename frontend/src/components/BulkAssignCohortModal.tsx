import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Check, AlertCircle, CheckCircle2, UserCheck, Shield,
  Search, Users, Sparkles, AlertTriangle, ArrowRight
} from 'lucide-react';
import { academicService } from '../services/academicService';
import type { AvailableTutorItem, AssignmentQueueItem, BulkAssignResult } from '../types';

interface BulkAssignCohortModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: AssignmentQueueItem[];
  period?: 'MOSY' | 'EOSY' | 'FULL_YEAR' | 'SUMMER';
  onDispatched: () => void;
}

export const BulkAssignCohortModal: React.FC<BulkAssignCohortModalProps> = ({
  isOpen,
  onClose,
  selectedStudents,
  period = 'MOSY',
  onDispatched,
}) => {
  const [tutors, setTutors] = useState<AvailableTutorItem[]>([]);
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(period);
  const [notes, setNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingTutors, setIsLoadingTutors] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkAssignResult | null>(null);

  // Determine program among selected students — enforce that a tutor can only handle one level
  const { requiredProgram, hasMixedLevels } = useMemo(() => {
    if (selectedStudents.length === 0) return { requiredProgram: 'basic', hasMixedLevels: false };
    const plusCount = selectedStudents.filter((s) => s.required_program === 'plus').length;
    const basicCount = selectedStudents.filter((s) => s.required_program === 'basic').length;
    const summerCount = selectedStudents.filter((s) => s.required_program === 'summer').length;

    if (plusCount > 0 && basicCount > 0) {
      return { requiredProgram: undefined, hasMixedLevels: true };
    }
    if (plusCount === selectedStudents.length) return { requiredProgram: 'plus', hasMixedLevels: false };
    if (summerCount === selectedStudents.length) return { requiredProgram: 'summer', hasMixedLevels: false };
    return { requiredProgram: 'basic', hasMixedLevels: false };
  }, [selectedStudents]);

  useEffect(() => {
    if (isOpen && selectedStudents.length > 0) {
      setSelectedTutorId(null);
      setSelectedPeriod(period);
      setNotes(`Bulk cohort dispatch for ${selectedStudents.length} students (${period})`);
      setError(null);
      setResult(null);
      setSearchQuery('');
      fetchTutors();
    }
  }, [isOpen, selectedStudents, period]);

  const fetchTutors = async () => {
    setIsLoadingTutors(true);
    setError(null);
    try {
      const data = await academicService.getAvailableTutors(requiredProgram);
      setTutors(data);
    } catch (err: any) {
      console.error('Failed to load available tutors:', err);
      setError('Failed to load compatible tutors.');
    } finally {
      setIsLoadingTutors(false);
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

  const selectedTutor = useMemo(() => {
    return tutors.find((t) => t.id === selectedTutorId) || null;
  }, [tutors, selectedTutorId]);

  const handleDispatch = async () => {
    if (hasMixedLevels) {
      setError('Selected students have mixed ARAL levels (Basic & Plus). A tutor can only handle ONE ARAL level. Please select only Basic or only Plus students for this cohort dispatch.');
      return;
    }
    if (!selectedTutorId) {
      setError('Please select a tutor to assign this cohort.');
      return;
    }
    if (selectedStudents.length === 0) {
      setError('No students selected.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await academicService.bulkAssignTutor({
        tutor_id: selectedTutorId,
        student_ids: selectedStudents.map((s) => s.id),
        period: selectedPeriod,
        notes,
      });

      setResult(res);
      setTimeout(() => {
        onDispatched();
      }, 1200);
    } catch (err: any) {
      console.error('Error dispatching cohort:', err);
      setError(err.response?.data?.error || 'Failed to dispatch cohort.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || selectedStudents.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                1-Click Cohort Dispatch
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Bulk assign selected students (15–25 cohort) to an available certified tutor
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

        {/* Cohort Stats Banner */}
        <div className="px-5 py-3 bg-slate-100/70 dark:bg-zinc-900/70 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-xs">
                {selectedStudents.length} Students Selected
              </span>
              <span className="text-xs text-slate-600 dark:text-zinc-300 font-medium">
                {selectedStudents.length >= 15 && selectedStudents.length <= 25 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Optimal Cohort (15–25 students)
                  </span>
                ) : selectedStudents.length < 15 ? (
                  <span className="text-sky-600 dark:text-sky-400">
                    Light Cohort ({selectedStudents.length}/25)
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Above 25 (Capacity check applied)
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Period:</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-slate-800 dark:text-zinc-200"
              >
                <option value="MOSY">MOSY (Q3/Q4)</option>
                <option value="EOSY">EOSY</option>
                <option value="SUMMER">Summer</option>
                <option value="FULL_YEAR">Full School Year</option>
              </select>
            </div>
          </div>
        </div>

        {/* Alerts & Results */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="mx-5 mt-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>Successfully Dispatched {result.total_assigned} Students to {result.tutor_name}!</span>
            </div>
            {result.total_skipped > 0 && (
              <p className="text-amber-700 dark:text-amber-300">
                {result.total_skipped} students were skipped (e.g. capacity limits or incompatibilities).
              </p>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Selected Students Preview Pill Strip */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                Students in this Cohort ({selectedStudents.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {selectedStudents.map((st) => (
                <span
                  key={st.id}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-medium text-slate-800 dark:text-zinc-200 flex items-center gap-1.5"
                >
                  <span>{st.full_name}</span>
                  <span className={`px-1 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                    st.required_program === 'plus'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  }`}>
                    {st.required_program}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {hasMixedLevels && (
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span><strong>Mixed ARAL Levels Selected:</strong> A tutor can only handle ONE ARAL level (Basic OR Plus). Please filter and select students of the same level for cohort dispatch.</span>
            </div>
          )}

          {/* Tutor Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search certified tutors by name or load..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tutors Grid */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Select Target Tutor (All tutors vacant / 25 slots available after milestone reset):
            </label>

            {isLoadingTutors ? (
              <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                Loading available certified tutors...
              </div>
            ) : filteredTutors.length === 0 ? (
              <div className="py-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-4">
                <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">No compatible tutors found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredTutors.map((tutor) => {
                  const isSelected = selectedTutorId === tutor.id;
                  const availableSlots = tutor.available_slots ?? 25;
                  const canFit = availableSlots >= selectedStudents.length;

                  return (
                    <button
                      key={tutor.id}
                      type="button"
                      onClick={() => setSelectedTutorId(tutor.id)}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div>
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {tutor.full_name}
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400">{tutor.email}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          tutor.tutor_type === 'plus'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            : tutor.tutor_type === 'basic'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {tutor.tutor_type_display}
                        </span>
                      </div>

                      <div className="w-full flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11px]">
                        <span className="text-slate-500 dark:text-zinc-400">
                          Current: <strong>{tutor.current_students_count}/25</strong>
                        </span>
                        <span className={`font-bold ${canFit ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                          {availableSlots} Slots Available
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Dispatch Audit Notes:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., MOSY Mid-Year Fresh Cohort Assignment for Q3/Q4"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-zinc-400">
            {selectedTutor ? (
              <span>Target: <strong className="text-slate-800 dark:text-zinc-200">{selectedTutor.full_name}</strong></span>
            ) : (
              <span>Select a tutor above to proceed</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDispatch}
              disabled={!selectedTutorId || isSubmitting || selectedStudents.length === 0}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Dispatching Cohort...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Dispatch {selectedStudents.length} Students</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
