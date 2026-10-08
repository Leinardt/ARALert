import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, AlertCircle, AlertTriangle, Search } from 'lucide-react';
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
      setError('Selected students have mixed ARAL levels (Basic & Plus). A tutor can only handle one ARAL level. Please select only Basic or only Plus students.');
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
      }, 900);
    } catch (err: any) {
      console.error('Error dispatching cohort:', err);
      setError(err.response?.data?.error || 'Failed to dispatch cohort.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || selectedStudents.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-950">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Dispatch Student Cohort
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Assign {selectedStudents.length} selected students to an available certified tutor.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Cohort Strip */}
        <div className="px-5 py-3 bg-slate-100/70 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white">
              {selectedStudents.length} Students Selected
            </span>
            <span className="text-slate-500 dark:text-zinc-400">
              ({selectedStudents.length >= 15 && selectedStudents.length <= 25 ? 'Standard cohort 15–25' : `${selectedStudents.length}/25 slots`})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-500 dark:text-zinc-400">Period:</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-2 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-zinc-200"
            >
              <option value="MOSY">MOSY (Q3/Q4)</option>
              <option value="EOSY">EOSY</option>
              <option value="SUMMER">Summer</option>
              <option value="FULL_YEAR">Full School Year</option>
            </select>
          </div>
        </div>

        {/* Alerts & Results */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
            <p className="font-bold">
              Successfully assigned {result.total_assigned} students to {result.tutor_name}.
            </p>
            {result.total_skipped > 0 && (
              <p className="text-amber-700 dark:text-amber-300">
                {result.total_skipped} students were skipped (capacity limits or incompatibilities).
              </p>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {hasMixedLevels && (
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Mixed levels selected. A tutor can only teach Basic OR Plus. Please select only one program.</span>
            </div>
          )}

          {/* Search Tutor */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tutors by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          {/* Tutors Grid */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Select Available Tutor
            </label>

            {isLoadingTutors ? (
              <div className="py-6 text-center text-slate-400">
                Loading available tutors...
              </div>
            ) : filteredTutors.length === 0 ? (
              <div className="py-6 text-center rounded-lg border border-dashed border-slate-200 dark:border-zinc-800 p-4 text-slate-500">
                No compatible tutors found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {filteredTutors.map((tutor) => {
                  const isSelected = selectedTutorId === tutor.id;
                  const availableSlots = tutor.available_slots ?? 25;
                  const canFit = availableSlots >= selectedStudents.length;

                  return (
                    <button
                      key={tutor.id}
                      type="button"
                      onClick={() => setSelectedTutorId(tutor.id)}
                      className={`p-3 rounded-lg border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-zinc-900 ring-1 ring-slate-900 dark:ring-white'
                          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-slate-50/50 dark:hover:bg-zinc-900/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {tutor.full_name}
                            {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" />}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400">{tutor.email}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {tutor.tutor_type_display}
                        </span>
                      </div>

                      <div className="w-full flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-zinc-800/80 text-[11px]">
                        <span className="text-slate-500 dark:text-zinc-400">
                          Load: {tutor.current_students_count}/25
                        </span>
                        <span className={`font-semibold ${canFit ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                          {availableSlots} Available
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
              Assignment Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Q3/Q4 Cohort Dispatch"
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-500 dark:text-zinc-400">
            {selectedTutor ? (
              <span>Assigning to <strong className="text-slate-900 dark:text-white">{selectedTutor.full_name}</strong></span>
            ) : (
              <span>Select a tutor above</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDispatch}
              disabled={!selectedTutorId || isSubmitting || selectedStudents.length === 0 || hasMixedLevels}
              className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {isSubmitting ? 'Dispatching...' : `Dispatch ${selectedStudents.length} Students`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
