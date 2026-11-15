import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { academicService } from '../../services/academicService';
import type { SchoolYear } from '../../types';
import { setActiveSystemSemester } from '../../utils/sessionDescriptionHelpers';
import {
  DEFAULT_COMPOSITE_WEIGHTS,
  DEFAULT_RISK_THRESHOLDS,
  getCompositeWeights,
  getRiskThresholds,
  resetWeightsAndThresholds,
  setCompositeWeights,
  setRiskThresholds,
} from '../../config/academicConfig';

const SEMESTER_OPTIONS: { value: '1st' | '2nd' | 'summer'; label: string }[] = [
  { value: '1st', label: '1st Semester — MOSY (Q1 & Q2)' },
  { value: '2nd', label: '2nd Semester — EOSY (Q3 & Q4)' },
  { value: 'summer', label: 'Summer Remediation (Midyear)' },
];

export const Settings: React.FC = () => {
  const [, setCurrentSY] = useState<SchoolYear | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState<boolean>(false);
  const [confirmAcknowledged, setConfirmAcknowledged] = useState<boolean>(false);
  const [confirmPhrase, setConfirmPhrase] = useState<string>('');
  const [semesterDropdownOpen, setSemesterDropdownOpen] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const semesterDropdownRef = useRef<HTMLDivElement>(null);

  // Saved baseline state
  const [savedStartYear, setSavedStartYear] = useState<number>(2026);
  const [savedEndYear, setSavedEndYear] = useState<number>(2027);
  const [savedSemester, setSavedSemester] = useState<'1st' | '2nd' | 'summer'>('1st');
  const [savedWeights, setSavedWeights] = useState(getCompositeWeights());
  const [savedThresholds, setSavedThresholds] = useState(getRiskThresholds());

  // Editable form state
  const [startYear, setStartYear] = useState<number>(2026);
  const [endYear, setEndYear] = useState<number>(2027);
  const [selectedSemester, setSelectedSemester] = useState<'1st' | '2nd' | 'summer'>('1st');
  const [attendanceWeightPct, setAttendanceWeightPct] = useState<number>(
    Math.round(savedWeights.attendance * 100)
  );
  const [scoreWeightPct, setScoreWeightPct] = useState<number>(
    Math.round(savedWeights.score * 100)
  );
  const [lowMinComposite, setLowMinComposite] = useState<number>(
    savedThresholds.lowMinComposite
  );
  const [moderateMinComposite, setModerateMinComposite] = useState<number>(
    savedThresholds.moderateMinComposite
  );
  const [highAttendanceGate, setHighAttendanceGate] = useState<number>(
    savedThresholds.highAttendanceGate
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        semesterDropdownRef.current &&
        !semesterDropdownRef.current.contains(event.target as Node)
      ) {
        setSemesterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const parseSchoolYearDigits = (syStr?: string | null) => {
    const match = String(syStr || '2026-2027').match(/^(\d{4})\D+(\d{4})$/);
    if (match) {
      return { start: Number(match[1]), end: Number(match[2]) };
    }
    return { start: 2026, end: 2027 };
  };

  const fetchAcademicData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const sy = await academicService.getCurrentSchoolYear();
      setCurrentSY(sy);
      const parsed = parseSchoolYearDigits(sy?.school_year);
      const sem = (sy?.current_semester || '1st') as '1st' | '2nd' | 'summer';
      const w = getCompositeWeights();
      const t = getRiskThresholds();

      setSavedStartYear(parsed.start);
      setSavedEndYear(parsed.end);
      setSavedSemester(sem);
      setSavedWeights(w);
      setSavedThresholds(t);

      setStartYear(parsed.start);
      setEndYear(parsed.end);
      setSelectedSemester(sem);
      setAttendanceWeightPct(Math.round(w.attendance * 100));
      setScoreWeightPct(Math.round(w.score * 100));
      setLowMinComposite(t.lowMinComposite);
      setModerateMinComposite(t.moderateMinComposite);
      setHighAttendanceGate(t.highAttendanceGate);
    } catch {
      setErrorMsg('Failed to load ARAL program configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAcademicData();
  }, [fetchAcademicData]);

  const handleStartEdit = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setStartYear(savedStartYear);
    setEndYear(savedEndYear);
    setSelectedSemester(savedSemester);
    setAttendanceWeightPct(Math.round(savedWeights.attendance * 100));
    setScoreWeightPct(Math.round(savedWeights.score * 100));
    setLowMinComposite(savedThresholds.lowMinComposite);
    setModerateMinComposite(savedThresholds.moderateMinComposite);
    setHighAttendanceGate(savedThresholds.highAttendanceGate);
    setSemesterDropdownOpen(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setErrorMsg(null);
    setStartYear(savedStartYear);
    setEndYear(savedEndYear);
    setSelectedSemester(savedSemester);
    setAttendanceWeightPct(Math.round(savedWeights.attendance * 100));
    setScoreWeightPct(Math.round(savedWeights.score * 100));
    setLowMinComposite(savedThresholds.lowMinComposite);
    setModerateMinComposite(savedThresholds.moderateMinComposite);
    setHighAttendanceGate(savedThresholds.highAttendanceGate);
    setSemesterDropdownOpen(false);
    setIsEditing(false);
  };

  const handleSchoolYearStep = (delta: number) => {
    const cleanStart = Math.max(2000, Math.min(2100, startYear + delta));
    setStartYear(cleanStart);
    setEndYear(cleanStart + 1);
  };

  const handleStartYearInputChange = (val: number) => {
    if (Number.isNaN(val)) return startYear;
    const cleanStart = Math.max(2000, Math.min(2100, Math.round(val)));
    setStartYear(cleanStart);
    setEndYear(cleanStart + 1);
    return cleanStart;
  };

  const handleAttendanceWeightChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setAttendanceWeightPct(clamped);
    setScoreWeightPct(100 - clamped);
    return clamped;
  };

  const handleScoreWeightChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setScoreWeightPct(clamped);
    setAttendanceWeightPct(100 - clamped);
    return clamped;
  };

  const handleResetDefaultWeights = () => {
    setAttendanceWeightPct(Math.round(DEFAULT_COMPOSITE_WEIGHTS.attendance * 100));
    setScoreWeightPct(Math.round(DEFAULT_COMPOSITE_WEIGHTS.score * 100));
  };

  const handleResetDefaultThresholds = () => {
    setLowMinComposite(DEFAULT_RISK_THRESHOLDS.lowMinComposite);
    setModerateMinComposite(DEFAULT_RISK_THRESHOLDS.moderateMinComposite);
    setHighAttendanceGate(DEFAULT_RISK_THRESHOLDS.highAttendanceGate);
  };

  const savedAttendanceWeightPct = Math.round(savedWeights.attendance * 100);
  const savedScoreWeightPct = Math.round(savedWeights.score * 100);
  const syChanged = `${startYear}-${endYear}` !== `${savedStartYear}-${savedEndYear}`;
  const semChanged = selectedSemester !== savedSemester;
  const weightsChanged =
    attendanceWeightPct !== savedAttendanceWeightPct ||
    scoreWeightPct !== savedScoreWeightPct;
  const thresholdsChanged =
    lowMinComposite !== savedThresholds.lowMinComposite ||
    moderateMinComposite !== savedThresholds.moderateMinComposite ||
    highAttendanceGate !== savedThresholds.highAttendanceGate;
  const hasAnyChanges = syChanged || semChanged || weightsChanged || thresholdsChanged;

  const formatSemesterShort = (sem: '1st' | '2nd' | 'summer') =>
    sem === '1st'
      ? '1st Semester (MOSY)'
      : sem === '2nd'
        ? '2nd Semester (EOSY)'
        : 'Summer (Midyear)';

  const openConfirmModal = () => {
    setConfirmAcknowledged(false);
    setConfirmPhrase('');
    setConfirmSaveOpen(true);
  };

  const closeConfirmModal = () => {
    if (saving) return;
    setConfirmSaveOpen(false);
    setConfirmAcknowledged(false);
    setConfirmPhrase('');
  };

  const handleValidateBeforeConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (endYear !== startYear + 1) {
      setErrorMsg('Active School Year must span consecutive years (e.g., 2026-2027).');
      return;
    }
    if (attendanceWeightPct + scoreWeightPct !== 100) {
      setErrorMsg('Attendance Weight (%) and Assessment Score Weight (%) must total 100%.');
      return;
    }
    if (lowMinComposite <= moderateMinComposite) {
      setErrorMsg('Low Risk Minimum Composite (%) must be greater than Moderate Risk Minimum Composite (%).');
      return;
    }
    if (!hasAnyChanges) {
      setErrorMsg('No configuration changes detected to save.');
      return;
    }

    openConfirmModal();
  };

  const handleConfirmSaveAll = async () => {
    if (!confirmAcknowledged || confirmPhrase.trim().toUpperCase() !== 'CONFIRM') return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formattedSchoolYear = `${startYear}-${endYear}`;

    try {
      const programConfigPayload = {
        attendance_weight_pct: attendanceWeightPct,
        score_weight_pct: scoreWeightPct,
        low_min_composite: lowMinComposite,
        moderate_min_composite: moderateMinComposite,
        high_attendance_gate: highAttendanceGate,
      };

      if (syChanged) {
        await academicService.saveSchoolYear({
          school_year: formattedSchoolYear,
          is_active: true,
          current_semester: selectedSemester,
          ...programConfigPayload,
        });
      } else {
        await academicService.setActiveSemester(selectedSemester, programConfigPayload);
      }
      if (semChanged || syChanged) {
        setActiveSystemSemester(selectedSemester);
      }

      const isDefaultWeights =
        attendanceWeightPct === Math.round(DEFAULT_COMPOSITE_WEIGHTS.attendance * 100) &&
        scoreWeightPct === Math.round(DEFAULT_COMPOSITE_WEIGHTS.score * 100) &&
        lowMinComposite === DEFAULT_RISK_THRESHOLDS.lowMinComposite &&
        moderateMinComposite === DEFAULT_RISK_THRESHOLDS.moderateMinComposite &&
        highAttendanceGate === DEFAULT_RISK_THRESHOLDS.highAttendanceGate;

      if (isDefaultWeights) {
        const defaults = resetWeightsAndThresholds();
        setSavedWeights(defaults.weights);
        setSavedThresholds(defaults.thresholds);
      } else {
        const nextWeights = setCompositeWeights({
          attendance: attendanceWeightPct / 100,
          score: scoreWeightPct / 100,
        });
        const nextThresholds = setRiskThresholds({
          lowMinComposite,
          moderateMinComposite,
          highAttendanceGate,
        });
        setSavedWeights(nextWeights);
        setSavedThresholds(nextThresholds);
      }

      setConfirmSaveOpen(false);
      setConfirmAcknowledged(false);
      setConfirmPhrase('');
      setIsEditing(false);
      await fetchAcademicData();
      setSuccessMsg('ARAL Program Configuration updated and recorded in the Audit Log.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Failed to save ARAL program configuration.');
    } finally {
      setSaving(false);
    }
  };

  const activeSemesterLabel =
    SEMESTER_OPTIONS.find((opt) => opt.value === savedSemester)?.label ||
    '1st Semester — MOSY (Q1 & Q2)';

  const selectedSemesterLabel =
    SEMESTER_OPTIONS.find((opt) => opt.value === selectedSemester)?.label ||
    '1st Semester — MOSY (Q1 & Q2)';

  const displayLowMin = isEditing ? lowMinComposite : savedThresholds.lowMinComposite;
  const displayModerateMin = isEditing ? moderateMinComposite : savedThresholds.moderateMinComposite;
  const displayAttendanceGate = isEditing ? highAttendanceGate : savedThresholds.highAttendanceGate;
  const displayModerateMax = Math.max(displayModerateMin, displayLowMin - 1);

  const disabledInputClass =
    'mt-1 block w-full px-3 py-2 border border-gray-200 dark:border-[#1E1E1E] rounded-md bg-gray-100 dark:bg-[#141414] text-xs font-semibold text-gray-500 dark:text-zinc-500 opacity-75 cursor-not-allowed select-none focus:outline-none';
  const editableInputClass =
    'mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-[#2A2A2A] rounded-md shadow-xs bg-white dark:bg-[#111111] text-xs font-bold text-gray-900 dark:text-slate-100 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]';

  if (loading) {
    return (
      <div
        className="max-w-4xl mx-auto flex flex-col gap-4 w-full min-w-0 animate-pulse"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <div className="p-8 sm:p-10 rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] shadow-md space-y-6">
          <div className="h-5 w-52 rounded bg-gray-200 dark:bg-zinc-800" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-10 rounded-md bg-gray-100 dark:bg-zinc-900" />
            <div className="h-10 rounded-md bg-gray-100 dark:bg-zinc-900" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-10 rounded-md bg-gray-100 dark:bg-zinc-900" />
            <div className="h-10 rounded-md bg-gray-100 dark:bg-zinc-900" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-4xl mx-auto w-full min-w-0"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="bg-white dark:bg-[#0A0A0A] p-6 sm:p-8 md:p-10 rounded-2xl border border-slate-200 dark:border-[#1A1A1A] shadow-md">
        <form onSubmit={handleValidateBeforeConfirm} className="space-y-6">
          {/* Card Header with Edit / Cancel & Save Actions */}
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">
              ARAL Program Configuration
            </h1>

            {!isEditing ? (
              <button
                type="button"
                onClick={handleStartEdit}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[var(--brand)] hover:bg-[var(--brand-dark)] rounded-md cursor-pointer transition-colors shadow-xs"
              >
                Edit Configuration
              </button>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-[#111111] border border-gray-300 dark:border-[#1A1A1A] hover:bg-gray-50 dark:hover:bg-zinc-900 rounded-md cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[var(--brand)] hover:bg-[var(--brand-dark)] rounded-md cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              {successMsg}
            </div>
          )}

          {/* Section 1: Academic Period (Unified Active School Year & System-Styled Active Semester Dropdown) */}
          <div className="space-y-3">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
              Academic Period
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Unified Active School Year */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Active School Year
                </label>
                {isEditing ? (
                  <div className="mt-1 flex items-center justify-between w-full px-3 py-1.5 border border-gray-300 dark:border-[#2A2A2A] rounded-md shadow-xs bg-white dark:bg-[#111111] focus-within:border-[var(--brand)] focus-within:ring-1 focus-within:ring-[var(--brand)]">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-slate-100">
                      <input
                        type="number"
                        min={2000}
                        max={2100}
                        step={1}
                        value={String(startYear)}
                        onChange={(e) => {
                          const next = handleStartYearInputChange(Number(e.target.value));
                          e.target.value = String(next);
                        }}
                        aria-label="Active School Year Start"
                        className="w-14 bg-transparent text-xs font-bold text-gray-900 dark:text-slate-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-gray-400 dark:text-zinc-500 select-none">-</span>
                      <span className="text-gray-900 dark:text-slate-100 select-none">{endYear}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSchoolYearStep(-1)}
                        className="px-2 py-0.5 text-xs font-bold rounded border border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1E1E1E] cursor-pointer transition-colors"
                        title="Previous school year"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSchoolYearStep(1)}
                        className="px-2 py-0.5 text-xs font-bold rounded border border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1E1E1E] cursor-pointer transition-colors"
                        title="Next school year"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={`${savedStartYear}-${savedEndYear}`}
                    readOnly
                    disabled
                    className={disabledInputClass}
                  />
                )}
              </div>

              {/* System-Styled Active Semester Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Active Semester
                </label>
                {isEditing ? (
                  <div className="relative mt-1" ref={semesterDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setSemesterDropdownOpen((prev) => !prev)}
                      className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 dark:border-[#2A2A2A] rounded-md shadow-xs bg-white dark:bg-[#111111] text-xs font-bold text-gray-900 dark:text-slate-100 hover:border-gray-400 dark:hover:border-zinc-700 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] transition cursor-pointer"
                    >
                      <span className="truncate">{selectedSemesterLabel}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${semesterDropdownOpen ? 'rotate-180' : ''
                          }`}
                      />
                    </button>

                    {semesterDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 z-50 rounded-xl border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="p-1.5 flex flex-col gap-0.5">
                          {SEMESTER_OPTIONS.map((option) => {
                            const isSelected = selectedSemester === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setSelectedSemester(option.value);
                                  setSemesterDropdownOpen(false);
                                }}
                                className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${isSelected
                                  ? 'bg-[var(--brand)] text-white'
                                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                                  }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={activeSemesterLabel}
                    readOnly
                    disabled
                    className={disabledInputClass}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Composite Scoring Weights */}
          <div className="space-y-3 border-t border-gray-100 dark:border-[#1A1A1A] pt-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                Composite Scoring Weights
              </h2>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleResetDefaultWeights}
                  className="text-xs font-bold text-[var(--brand)] hover:underline cursor-pointer"
                >
                  Restore to default composite scoring weights
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Attendance Weight (%)
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={String(attendanceWeightPct)}
                    onChange={(e) => {
                      const clamped = handleAttendanceWeightChange(Number(e.target.value));
                      e.target.value = String(clamped);
                    }}
                    className={editableInputClass}
                  />
                ) : (
                  <input
                    type="text"
                    value={`${Math.round(savedWeights.attendance * 100)}%`}
                    readOnly
                    disabled
                    className={disabledInputClass}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Assessment Score Weight (%)
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={String(scoreWeightPct)}
                    onChange={(e) => {
                      const clamped = handleScoreWeightChange(Number(e.target.value));
                      e.target.value = String(clamped);
                    }}
                    className={editableInputClass}
                  />
                ) : (
                  <input
                    type="text"
                    value={`${Math.round(savedWeights.score * 100)}%`}
                    readOnly
                    disabled
                    className={disabledInputClass}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Risk Classification Thresholds with System Risk Colors */}
          <div className="space-y-4 border-t border-gray-100 dark:border-[#1A1A1A] pt-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                Risk Classification Thresholds
              </h2>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleResetDefaultThresholds}
                  className="text-xs font-bold text-[var(--brand)] hover:underline cursor-pointer"
                >
                  Restore to default threshold
                </button>
              )}
            </div>

            {/* Composite Score Risk Tiers (Low, Medium, High) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Low Risk */}
              <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.04] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider risk-badge-low">
                    Low Risk
                  </span>
                  <span className="text-[11px] font-bold text-risk-low">
                    &gt;= {displayLowMin}%
                  </span>
                </div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Minimum Composite (%)
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    min={50}
                    max={100}
                    step={1}
                    value={String(lowMinComposite)}
                    onChange={(e) => {
                      const next = Math.max(0, Math.min(100, Math.round(Number(e.target.value))));
                      setLowMinComposite(next);
                      e.target.value = String(next);
                    }}
                    className={editableInputClass}
                  />
                ) : (
                  <input
                    type="text"
                    value={`${savedThresholds.lowMinComposite}%`}
                    readOnly
                    disabled
                    className={disabledInputClass}
                  />
                )}
              </div>

              {/* Moderate Risk */}
              <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.03] dark:bg-amber-500/[0.04] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider risk-badge-medium">
                    Moderate Risk
                  </span>
                  <span className="text-[11px] font-bold text-risk-medium">
                    {displayModerateMin}% – {displayModerateMax}%
                  </span>
                </div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Minimum Composite (%)
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    min={30}
                    max={95}
                    step={1}
                    value={String(moderateMinComposite)}
                    onChange={(e) => {
                      const next = Math.max(0, Math.min(100, Math.round(Number(e.target.value))));
                      setModerateMinComposite(next);
                      e.target.value = String(next);
                    }}
                    className={editableInputClass}
                  />
                ) : (
                  <input
                    type="text"
                    value={`${savedThresholds.moderateMinComposite}%`}
                    readOnly
                    disabled
                    className={disabledInputClass}
                  />
                )}
              </div>

              {/* High Risk (Derived from Medium Risk Minimum) */}
              <div className="p-3.5 rounded-xl border border-rose-500/25 bg-rose-500/[0.03] dark:bg-rose-500/[0.04] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider risk-badge-high">
                    High Risk
                  </span>
                  <span className="text-[11px] font-bold text-risk-high">
                    &lt; {displayModerateMin}%
                  </span>
                </div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Composite Score Range
                </label>
                <input
                  type="text"
                  value={`Below ${displayModerateMin}%`}
                  readOnly
                  disabled
                  className={disabledInputClass}
                />
              </div>
            </div>

            {/* Attendance Safety Gate (High Risk Override) */}
            <div className="p-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.03] dark:bg-rose-500/[0.04]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div className="sm:col-span-2 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-bold text-gray-900 dark:text-slate-100">
                      Attendance Safety Gate (%)
                    </label>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider risk-badge-high">
                      High Risk Override (&lt;= {displayAttendanceGate}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
                    Automatically classifies a student as High Risk when their recorded attendance rate is at or below this threshold, even if their composite score qualifies for Low or Moderate Risk.
                  </p>
                </div>

                <div>
                  {isEditing ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={String(highAttendanceGate)}
                      onChange={(e) => {
                        const next = Math.max(0, Math.min(100, Math.round(Number(e.target.value))));
                        setHighAttendanceGate(next);
                        e.target.value = String(next);
                      }}
                      className={editableInputClass}
                    />
                  ) : (
                    <input
                      type="text"
                      value={`${savedThresholds.highAttendanceGate}%`}
                      readOnly
                      disabled
                      className={disabledInputClass}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ── Robust Save Confirmation Modal ── */}
      {confirmSaveOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={closeConfirmModal}
          >
            <div
              className="bg-white dark:bg-[#0A0A0A] rounded-xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-[#1A1A1A] space-y-4"
              style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100 dark:border-[#1A1A1A]">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight">
                    Confirm System Configuration Update
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                    Review all modified values below before applying system-wide changes.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeConfirmModal}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
                >
                  Close
                </button>
              </div>

              {/* System-wide Impact Warning */}
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
                <p className="font-bold uppercase tracking-wider text-[10px] text-amber-800 dark:text-amber-300">
                  System-Wide Impact Notice
                </p>
                <p>
                  Applying these settings immediately updates academic periods, recalculates student composite ratings and risk tiers across all dashboards, and writes a permanent Audit Log record.
                </p>
              </div>

              {/* Current vs New Configuration Comparison */}
              <div className="rounded-lg border border-gray-200 dark:border-[#222222] overflow-hidden text-xs">
                <div className="grid grid-cols-12 bg-gray-100/80 dark:bg-[#141414] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-[#222222]">
                  <span className="col-span-4">Setting</span>
                  <span className="col-span-4">Current</span>
                  <span className="col-span-4 text-right">New Value</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-[#1E1E1E] bg-white dark:bg-[#0E0E0E]">
                  <div className={`grid grid-cols-12 items-center px-3 py-2 gap-2 ${syChanged ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}>
                    <span className="col-span-4 font-semibold text-gray-600 dark:text-slate-400">School Year</span>
                    <span className="col-span-4 text-gray-500 dark:text-slate-400">{savedStartYear}-{savedEndYear}</span>
                    <span className={`col-span-4 text-right font-bold ${syChanged ? 'text-[var(--brand)] dark:text-blue-400' : 'text-gray-700 dark:text-slate-300'}`}>
                      {startYear}-{endYear}
                    </span>
                  </div>
                  <div className={`grid grid-cols-12 items-center px-3 py-2 gap-2 ${semChanged ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}>
                    <span className="col-span-4 font-semibold text-gray-600 dark:text-slate-400">Semester</span>
                    <span className="col-span-4 text-gray-500 dark:text-slate-400">{formatSemesterShort(savedSemester)}</span>
                    <span className={`col-span-4 text-right font-bold ${semChanged ? 'text-[var(--brand)] dark:text-blue-400' : 'text-gray-700 dark:text-slate-300'}`}>
                      {formatSemesterShort(selectedSemester)}
                    </span>
                  </div>
                  <div className={`grid grid-cols-12 items-center px-3 py-2 gap-2 ${weightsChanged ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}>
                    <span className="col-span-4 font-semibold text-gray-600 dark:text-slate-400">Weights</span>
                    <span className="col-span-4 text-gray-500 dark:text-slate-400">{savedAttendanceWeightPct}% Att / {savedScoreWeightPct}% Score</span>
                    <span className={`col-span-4 text-right font-bold ${weightsChanged ? 'text-[var(--brand)] dark:text-blue-400' : 'text-gray-700 dark:text-slate-300'}`}>
                      {attendanceWeightPct}% Att / {scoreWeightPct}% Score
                    </span>
                  </div>
                  <div className={`grid grid-cols-12 items-center px-3 py-2 gap-2 ${thresholdsChanged ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}>
                    <span className="col-span-4 font-semibold text-gray-600 dark:text-slate-400">Thresholds</span>
                    <span className="col-span-4 text-gray-500 dark:text-slate-400">
                      {savedThresholds.lowMinComposite}% / {savedThresholds.moderateMinComposite}% / {savedThresholds.highAttendanceGate}%
                    </span>
                    <span className={`col-span-4 text-right font-bold ${thresholdsChanged ? 'text-[var(--brand)] dark:text-blue-400' : 'text-gray-700 dark:text-slate-300'}`}>
                      {lowMinComposite}% / {moderateMinComposite}% / {highAttendanceGate}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Explicit Verification Safeguards */}
              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-gray-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={confirmAcknowledged}
                    onChange={(e) => setConfirmAcknowledged(e.target.checked)}
                    disabled={saving}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-[var(--brand)] focus:ring-[var(--brand)] cursor-pointer"
                  />
                  <span className="leading-snug">
                    I confirm that I have reviewed the changes above and understand this action is tracked in the system Audit Log.
                  </span>
                </label>

                <div>
                  <label
                    htmlFor="settings-confirm-phrase"
                    className="block text-[11px] font-semibold text-gray-600 dark:text-slate-400 mb-1"
                  >
                    Type <span className="font-mono font-bold text-gray-900 dark:text-white">CONFIRM</span> to apply changes
                  </label>
                  <input
                    id="settings-confirm-phrase"
                    type="text"
                    value={confirmPhrase}
                    onChange={(e) => setConfirmPhrase(e.target.value)}
                    disabled={saving}
                    autoComplete="off"
                    placeholder="Type CONFIRM"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#2A2A2A] rounded-md bg-white dark:bg-[#111111] text-xs font-mono font-bold text-gray-900 dark:text-white placeholder:font-sans placeholder:font-normal placeholder:text-gray-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-[#1A1A1A]">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeConfirmModal}
                  className="px-4 py-2 border border-gray-200 dark:border-[#2A2A2A] rounded-md text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !confirmAcknowledged || confirmPhrase.trim().toUpperCase() !== 'CONFIRM'}
                  onClick={handleConfirmSaveAll}
                  className="px-5 py-2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-colors"
                >
                  {saving ? 'Applying...' : 'Confirm & Apply'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
