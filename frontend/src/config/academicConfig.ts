import type { SchoolYear } from '../types';

export const PASSING_SCORE_PERCENTAGE = 70;
export const PASSING_SCORE_RATIO = 0.7;
export const DEFAULT_MILESTONE_TOTAL_SCORE = 40;
export const DEFAULT_MILESTONE_PASSING_SCORE = 28;

export const DEFAULT_COMPOSITE_WEIGHTS = {
  attendance: 0.4,
  score: 0.6,
} as const;

export const DEFAULT_RISK_THRESHOLDS = {
  lowMinComposite: 86,
  moderateMinComposite: 70,
  highAttendanceGate: 75,
} as const;

const WEIGHTS_STORAGE_KEY = 'aralert_composite_weights';
const THRESHOLDS_STORAGE_KEY = 'aralert_risk_thresholds';
const SCHOOL_YEAR_STORAGE_KEY = 'aralert_active_school_year';

export interface CompositeWeightsConfig {
  attendance: number;
  score: number;
}

export interface RiskThresholdsConfig {
  lowMinComposite: number;
  moderateMinComposite: number;
  highAttendanceGate: number;
}

export const getCompositeWeights = (): CompositeWeightsConfig => {
  if (typeof window === 'undefined') return { ...DEFAULT_COMPOSITE_WEIGHTS };
  try {
    const raw = window.localStorage.getItem(WEIGHTS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COMPOSITE_WEIGHTS };
    const parsed = JSON.parse(raw);
    const att = Number(parsed?.attendance);
    const scr = Number(parsed?.score);
    if (
      Number.isFinite(att) &&
      Number.isFinite(scr) &&
      att >= 0 &&
      scr >= 0 &&
      Math.abs(att + scr - 1) < 0.01
    ) {
      return { attendance: Number(att.toFixed(4)), score: Number(scr.toFixed(4)) };
    }
  } catch {
    // ignore storage read errors
  }
  return { ...DEFAULT_COMPOSITE_WEIGHTS };
};

export const setCompositeWeights = (weights: CompositeWeightsConfig): CompositeWeightsConfig => {
  const att = Math.max(0, Math.min(1, Number(weights.attendance)));
  const scr = Math.max(0, Math.min(1, Number((1 - att).toFixed(4))));
  const normalized: CompositeWeightsConfig = { attendance: Number(att.toFixed(4)), score: scr };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent('aralert:weights-changed', { detail: { weights: normalized } }));
    } catch {
      // ignore storage write errors
    }
  }
  return normalized;
};

export const getRiskThresholds = (): RiskThresholdsConfig => {
  if (typeof window === 'undefined') return { ...DEFAULT_RISK_THRESHOLDS };
  try {
    const raw = window.localStorage.getItem(THRESHOLDS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RISK_THRESHOLDS };
    const parsed = JSON.parse(raw);
    const lowMin = Number(parsed?.lowMinComposite);
    const modMin = Number(parsed?.moderateMinComposite);
    const gate = Number(parsed?.highAttendanceGate);
    if (
      Number.isFinite(lowMin) &&
      Number.isFinite(modMin) &&
      Number.isFinite(gate) &&
      lowMin > modMin &&
      modMin >= 0 &&
      lowMin <= 100 &&
      gate >= 0 &&
      gate <= 100
    ) {
      return {
        lowMinComposite: lowMin,
        moderateMinComposite: modMin,
        highAttendanceGate: gate,
      };
    }
  } catch {
    // ignore storage read errors
  }
  return { ...DEFAULT_RISK_THRESHOLDS };
};

export const setRiskThresholds = (thresholds: RiskThresholdsConfig): RiskThresholdsConfig => {
  const normalized: RiskThresholdsConfig = {
    lowMinComposite: Math.max(1, Math.min(100, Number(thresholds.lowMinComposite))),
    moderateMinComposite: Math.max(0, Math.min(99, Number(thresholds.moderateMinComposite))),
    highAttendanceGate: Math.max(0, Math.min(100, Number(thresholds.highAttendanceGate))),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent('aralert:weights-changed', { detail: { thresholds: normalized } }));
    } catch {
      // ignore storage write errors
    }
  }
  return normalized;
};

export const resetWeightsAndThresholds = (): {
  weights: CompositeWeightsConfig;
  thresholds: RiskThresholdsConfig;
} => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(WEIGHTS_STORAGE_KEY);
      window.localStorage.removeItem(THRESHOLDS_STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent('aralert:weights-changed', {
          detail: {
            weights: { ...DEFAULT_COMPOSITE_WEIGHTS },
            thresholds: { ...DEFAULT_RISK_THRESHOLDS },
          },
        })
      );
    } catch {
      // ignore
    }
  }
  return {
    weights: { ...DEFAULT_COMPOSITE_WEIGHTS },
    thresholds: { ...DEFAULT_RISK_THRESHOLDS },
  };
};

export const COMPOSITE_WEIGHTS = {
  get attendance(): number {
    return getCompositeWeights().attendance;
  },
  get score(): number {
    return getCompositeWeights().score;
  },
};

export const RISK_THRESHOLDS = {
  get lowMinComposite(): number {
    return getRiskThresholds().lowMinComposite;
  },
  get moderateMinComposite(): number {
    return getRiskThresholds().moderateMinComposite;
  },
  get highAttendanceGate(): number {
    return getRiskThresholds().highAttendanceGate;
  },
};

export const getActiveSchoolYearLabel = (): string => {
  if (typeof window === 'undefined') return '2026-2027';
  try {
    const raw = (window.localStorage.getItem(SCHOOL_YEAR_STORAGE_KEY) || '').trim();
    if (/^\d{4}\D+\d{4}$/.test(raw)) return raw;
  } catch {
    // ignore
  }
  return '2026-2027';
};

export const setActiveSchoolYearLabel = (schoolYear?: string | null): string => {
  const clean = (schoolYear || '').trim();
  const normalized = /^\d{4}\D+\d{4}$/.test(clean) ? clean : '2026-2027';
  if (typeof window !== 'undefined') {
    try {
      const prev = window.localStorage.getItem(SCHOOL_YEAR_STORAGE_KEY);
      if (prev !== normalized) {
        window.localStorage.setItem(SCHOOL_YEAR_STORAGE_KEY, normalized);
        window.dispatchEvent(
          new CustomEvent('aralert:school-year-changed', {
            detail: { school_year: normalized },
          })
        );
      }
    } catch {
      // ignore
    }
  }
  return normalized;
};

export const syncProgramConfigFromSchoolYear = (sy?: Partial<SchoolYear> | null): void => {
  if (!sy || typeof window === 'undefined') return;

  if (sy.school_year) {
    setActiveSchoolYearLabel(sy.school_year);
  }

  let weightsChanged = false;
  let thresholdsChanged = false;

  if (
    typeof sy.attendance_weight_pct === 'number' &&
    typeof sy.score_weight_pct === 'number' &&
    sy.attendance_weight_pct + sy.score_weight_pct === 100
  ) {
    const currentW = getCompositeWeights();
    const nextAtt = Number((sy.attendance_weight_pct / 100).toFixed(4));
    const nextScr = Number((sy.score_weight_pct / 100).toFixed(4));
    if (
      Math.abs(currentW.attendance - nextAtt) > 0.0001 ||
      Math.abs(currentW.score - nextScr) > 0.0001
    ) {
      try {
        window.localStorage.setItem(
          WEIGHTS_STORAGE_KEY,
          JSON.stringify({ attendance: nextAtt, score: nextScr })
        );
        weightsChanged = true;
      } catch {
        // ignore
      }
    }
  }

  if (
    typeof sy.low_min_composite === 'number' &&
    typeof sy.moderate_min_composite === 'number' &&
    typeof sy.high_attendance_gate === 'number' &&
    sy.low_min_composite > sy.moderate_min_composite
  ) {
    const currentT = getRiskThresholds();
    if (
      currentT.lowMinComposite !== sy.low_min_composite ||
      currentT.moderateMinComposite !== sy.moderate_min_composite ||
      currentT.highAttendanceGate !== sy.high_attendance_gate
    ) {
      try {
        window.localStorage.setItem(
          THRESHOLDS_STORAGE_KEY,
          JSON.stringify({
            lowMinComposite: sy.low_min_composite,
            moderateMinComposite: sy.moderate_min_composite,
            highAttendanceGate: sy.high_attendance_gate,
          })
        );
        thresholdsChanged = true;
      } catch {
        // ignore
      }
    }
  }

  if (weightsChanged || thresholdsChanged) {
    window.dispatchEvent(
      new CustomEvent('aralert:weights-changed', {
        detail: {
          weights: getCompositeWeights(),
          thresholds: getRiskThresholds(),
        },
      })
    );
  }
};

export const getCompositeFormulaDescription = (): string => {
  const weights = getCompositeWeights();
  const attPct = Math.round(weights.attendance * 100);
  const scrPct = Math.round(weights.score * 100);
  return `Risk level is calculated from the composite rating of a student. Composite Rating = ${attPct}% (Attendance Rate) + ${scrPct}% (Average Score Rate)`;
};

export const getRiskRangeDescriptions = (): {
  high: string;
  moderate: string;
  low: string;
} => {
  const t = getRiskThresholds();
  const highMax = Math.max(0, t.moderateMinComposite - 1);
  const modMax = Math.max(t.moderateMinComposite, t.lowMinComposite - 1);
  return {
    high: `Composite rating is ${highMax}% and below`,
    moderate: `Composite rating is between ${t.moderateMinComposite}% to ${modMax}%`,
    low: `Composite rating is between ${t.lowMinComposite}% to 100%`,
  };
};

export const GRADE_LEVEL_OPTIONS = [
  'GRADE 7',
  'GRADE 8',
  'GRADE 9',
  'GRADE 10',
  'GRADE 11',
  'GRADE 12',
] as const;

export type AralLevelValue = 'basic' | 'plus' | 'summer';

export const ARAL_LEVEL_OPTIONS: ReadonlyArray<{
  value: AralLevelValue;
  label: string;
}> = [
  { value: 'basic', label: 'BASIC' },
  { value: 'plus', label: 'PLUS' },
  { value: 'summer', label: 'SUMMER' },
];

export const SUBJECT_OPTIONS: ReadonlyArray<{
  id: string;
  label: string;
  dbSubject: string;
  allowedLevels: ReadonlyArray<AralLevelValue>;
  noteByLevel?: Partial<Record<AralLevelValue, string>>;
}> = [
  {
    id: 'Filipino',
    label: 'FILIPINO',
    dbSubject: 'Filipino',
    allowedLevels: ['basic', 'summer'],
    noteByLevel: { basic: 'for Basic' },
  },
  {
    id: 'English',
    label: 'ENGLISH',
    dbSubject: 'English',
    allowedLevels: ['plus', 'summer'],
    noteByLevel: { plus: 'for Plus' },
  },
  {
    id: 'Math',
    label: 'MATH',
    dbSubject: 'Math',
    allowedLevels: ['basic', 'plus', 'summer'],
  },
  {
    id: 'Science',
    label: 'SCIENCE',
    dbSubject: 'Science',
    allowedLevels: ['basic', 'plus', 'summer'],
  },
];

export const ASSESSMENT_REMARKS = {
  PASSED: 'Passed',
  FAILED: 'Failed',
  NOT_TAKEN: 'Not Taken',
} as const;

export type AssessmentRemark =
  (typeof ASSESSMENT_REMARKS)[keyof typeof ASSESSMENT_REMARKS];

export const SCORE_DESCRIPTION_FILTER_OPTIONS = [
  { value: 'all', label: 'All Descriptions' },
  { value: 'Intervention Activity', label: 'Intervention Activity' },
  { value: 'MOSY', label: 'MOSY Assessment' },
  { value: 'EOSY', label: 'EOSY Assessment' },
  { value: 'ARAL Summer Assessment', label: 'ARAL Summer Assessment' },
] as const;

export const SCHOOL_METADATA_DEFAULTS = {
  division: 'DIVISION OF MASBATE',
  district: 'PALANAS NORTH DISTRICT',
  schoolName: 'PALANAS NATIONAL AGRICULTURE HIGH SCHOOL',
  schoolAddress: 'Sta. Cruz, Palanas, Masbate',
  get defaultSchoolYear(): string {
    return getActiveSchoolYearLabel();
  },
};

export const getSubjectsForAralLevel = (level?: string | null) => {
  const normalized = (level || 'basic').trim().toLowerCase();
  const target: AralLevelValue =
    normalized === 'plus' ? 'plus' : normalized === 'summer' ? 'summer' : 'basic';

  return SUBJECT_OPTIONS.filter((s) => s.allowedLevels.includes(target)).map((s) => ({
    ...s,
    displayLabel:
      target !== 'summer' && s.noteByLevel?.[target]
        ? `${s.label} (${s.noteByLevel[target]})`
        : s.label,
  }));
};

export const extractDynamicGradeLevels = (
  users?: Array<{ grade_level?: string | null }>
): string[] => {
  const set = new Set<string>(GRADE_LEVEL_OPTIONS);
  if (Array.isArray(users)) {
    users.forEach((u) => {
      const raw = (u?.grade_level || '').trim().toUpperCase();
      if (!raw) return;
      raw.split(',').forEach((chunk) => {
        const gradePart = chunk.split(' - ')[0]?.trim();
        if (!gradePart || gradePart === 'ALL') return;
        const normalized = gradePart.startsWith('GRADE')
          ? gradePart
          : /^\d+$/.test(gradePart)
          ? `GRADE ${gradePart}`
          : gradePart;
        set.add(normalized);
      });
    });
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

export const extractDynamicSections = (
  users?: Array<{ grade_level?: string | null; section?: string | null }>,
  forGrade?: string | null
): string[] => {
  const set = new Set<string>();
  const targetGradeNum = (forGrade || '').replace(/[^0-9]/g, '');

  if (Array.isArray(users)) {
    users.forEach((u) => {
      const rawGrade = (u?.grade_level || '').trim().toUpperCase();
      const explicitSec = (u?.section || '').trim().toUpperCase();

      if (rawGrade.includes(' - ')) {
        rawGrade.split(',').forEach((entry) => {
          const parts = entry.split(' - ').map((p) => p.trim().toUpperCase());
          if (parts.length >= 2) {
            const [gPart, sPart] = parts;
            const gNum = gPart.replace(/[^0-9]/g, '');
            if (targetGradeNum && gNum && gNum !== targetGradeNum) return;
            if (sPart && sPart !== 'ALL') set.add(sPart);
          }
        });
      } else if (explicitSec && explicitSec !== 'ALL') {
        const gNum = rawGrade.replace(/[^0-9]/g, '');
        if (!targetGradeNum || !gNum || gNum === targetGradeNum) {
          set.add(explicitSec);
        }
      }
    });
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

export const isNotTakenGrade = (
  grade?: { remarks?: string | null } | null
): boolean => {
  if (!grade) return false;
  return String(grade.remarks || '').trim().toLowerCase() === 'not taken';
};

export const computeAssessmentRemark = (
  score: number | string | null | undefined,
  totalScore: number | string | null | undefined,
  isNotTaken?: boolean
): AssessmentRemark => {
  if (isNotTaken) return ASSESSMENT_REMARKS.NOT_TAKEN;
  if (score === null || score === undefined || String(score).trim() === '') {
    return ASSESSMENT_REMARKS.NOT_TAKEN;
  }
  const numScore = Number(score);
  const numTotal = Number(totalScore) > 0 ? Number(totalScore) : DEFAULT_MILESTONE_TOTAL_SCORE;
  if (Number.isNaN(numScore)) return ASSESSMENT_REMARKS.NOT_TAKEN;

  const passed =
    numTotal === DEFAULT_MILESTONE_TOTAL_SCORE
      ? numScore >= DEFAULT_MILESTONE_PASSING_SCORE
      : (numScore / numTotal) * 100 >= PASSING_SCORE_PERCENTAGE;

  return passed ? ASSESSMENT_REMARKS.PASSED : ASSESSMENT_REMARKS.FAILED;
};

// ---------------------------------------------------------------------------
// School-Year-Based Weekly Calculation Helpers
// ---------------------------------------------------------------------------

export interface SchoolYearWeekOption {
  weekNumber: number;
  monthWeekNumber?: number;
  monthLabel?: string;
  monthShortLabel?: string;
  weekKey: string; // YYYY-MM-DD (Monday)
  label: string; // "Week 1", "Week 2", ... (month-relative)
  fullLabel?: string; // "Aug • Week 1"
  dateRangeLabel: string; // e.g. "Aug 3 - Aug 7, 2026"
  mondayDate: string; // YYYY-MM-DD
  fridayDate: string; // YYYY-MM-DD
  dayKeys: string[]; // Mon - Fri YYYY-MM-DD
}

export const formatDateKeyLocal = (dateObj: Date): string => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseDateKeyLocal = (dateStr: string): Date => {
  const clean = (dateStr || '').slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const fallback = new Date(dateStr);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
};

export const getMondayOfDate = (dateOrKey: Date | string): Date => {
  const d =
    typeof dateOrKey === 'string'
      ? parseDateKeyLocal(dateOrKey)
      : new Date(dateOrKey.getFullYear(), dateOrKey.getMonth(), dateOrKey.getDate());
  const day = d.getDay();
  // Monday-first school week; Sunday maps to upcoming Monday if before school starts,
  // matching existing Mon-Fri week bucketing (day === 0 ? 1 : 1 - day).
  const diff = d.getDate() + (day === 0 ? -6 : 1 - day);
  return new Date(d.getFullYear(), d.getMonth(), diff);
};

export const getMondayKeyOfDate = (dateOrKey: Date | string): string => {
  return formatDateKeyLocal(getMondayOfDate(dateOrKey));
};

export const computeWeekOfMonth = (dateOrKey: Date | string): number => {
  const d =
    typeof dateOrKey === 'string'
      ? parseDateKeyLocal(dateOrKey)
      : new Date(dateOrKey.getFullYear(), dateOrKey.getMonth(), dateOrKey.getDate());
  const day = d.getDay();
  // School weeks run Mon-Fri. Use Wednesday (school midweek) to determine which month this school week primarily belongs to
  const wedDiff = day === 0 ? 3 : 3 - day;
  const wednesday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + wedDiff);

  // Find date of the first Wednesday of wednesday's month
  const firstDayOfMonth = new Date(wednesday.getFullYear(), wednesday.getMonth(), 1).getDay();
  const firstWedDate = 1 + (firstDayOfMonth <= 3 ? 3 - firstDayOfMonth : 10 - firstDayOfMonth);

  return Math.floor((wednesday.getDate() - firstWedDate) / 7) + 1;
};

const formatWeekDateRange = (monday: Date, friday: Date): string => {
  const sameYear = monday.getFullYear() === friday.getFullYear();
  const sameMonth = sameYear && monday.getMonth() === friday.getMonth();
  const monMonth = monday.toLocaleDateString('en-US', { month: 'short' });
  const friMonth = friday.toLocaleDateString('en-US', { month: 'short' });

  if (sameMonth) {
    return `${monMonth} ${monday.getDate()} - ${friday.getDate()}, ${friday.getFullYear()}`;
  }
  if (sameYear) {
    return `${monMonth} ${monday.getDate()} - ${friMonth} ${friday.getDate()}, ${friday.getFullYear()}`;
  }
  return `${monMonth} ${monday.getDate()}, ${monday.getFullYear()} - ${friMonth} ${friday.getDate()}, ${friday.getFullYear()}`;
};

export const resolveSchoolYearDateBounds = (
  schoolYear?: Partial<SchoolYear> | null,
  recordedDateKeys?: string[]
): { startMonday: Date; endMonday: Date; schoolYearLabel: string } => {
  const today = new Date();
  const syString = (schoolYear?.school_year || '').trim();
  const yearMatch = syString.match(/(\d{4})\s*[-–]\s*(\d{4})/);

  let startDateObj: Date;
  if (schoolYear?.start_date) {
    startDateObj = parseDateKeyLocal(schoolYear.start_date);
  } else if (yearMatch) {
    startDateObj = new Date(parseInt(yearMatch[1], 10), 7, 1); // Aug 1 of SY start year
  } else if (recordedDateKeys && recordedDateKeys.length > 0) {
    const sorted = [...recordedDateKeys].filter(Boolean).sort();
    startDateObj = parseDateKeyLocal(sorted[0]);
  } else {
    const inferredStartYear = today.getMonth() >= 5 ? today.getFullYear() : today.getFullYear() - 1;
    startDateObj = new Date(inferredStartYear, 7, 1);
  }

  let startMonday = getMondayOfDate(startDateObj);
  // Wednesday of this week determines which month/period it primarily belongs to
  const startWed = new Date(startMonday.getFullYear(), startMonday.getMonth(), startMonday.getDate() + 2);
  // If the week's Wednesday is before startDateObj (e.g. August 1 on a weekend having Wednesday in July),
  // this week primarily belongs to the prior month. Advance to the first school week of the school year.
  if (startWed < startDateObj) {
    startMonday = new Date(startMonday.getFullYear(), startMonday.getMonth(), startMonday.getDate() + 7);
  }

  // Determine official end date of the school year if configured
  let syOfficialEndDate: Date | null = null;
  if (schoolYear?.end_date) {
    syOfficialEndDate = parseDateKeyLocal(schoolYear.end_date);
  } else if (yearMatch) {
    syOfficialEndDate = new Date(parseInt(yearMatch[2], 10), 5, 30); // June 30 of SY end year
  }

  // Determine latest recorded date
  let latestRecordedDate: Date | null = null;
  if (recordedDateKeys && recordedDateKeys.length > 0) {
    const validRecorded = recordedDateKeys.filter(Boolean).sort();
    const earliestRecorded = parseDateKeyLocal(validRecorded[0]);
    latestRecordedDate = parseDateKeyLocal(validRecorded[validRecorded.length - 1]);

    if (!schoolYear?.start_date && earliestRecorded < startMonday) {
      startMonday = getMondayOfDate(earliestRecorded);
    }
  }

  // Active / Ongoing School Year:
  // Increment weeks dynamically up to the current week (today) or latest recorded entry,
  // without generating 50+ empty weeks in advance.
  // Past / Archived School Year:
  // If the official end date has already passed, show all weeks up to the end date.
  let endDateObj: Date;
  if (syOfficialEndDate && today > syOfficialEndDate) {
    endDateObj = syOfficialEndDate;
  } else {
    let dynamicCap = today;
    if (latestRecordedDate && latestRecordedDate > dynamicCap) {
      dynamicCap = latestRecordedDate;
    }
    if (syOfficialEndDate && dynamicCap > syOfficialEndDate) {
      dynamicCap = syOfficialEndDate;
    }
    endDateObj = dynamicCap;
  }

  if (endDateObj < startMonday) {
    endDateObj = startMonday;
  }

  const endMonday = getMondayOfDate(endDateObj);
  const schoolYearLabel =
    syString || `${startDateObj.getFullYear()}-${startDateObj.getFullYear() + 1}`;

  return { startMonday, endMonday, schoolYearLabel };
};

export const generateSchoolYearWeeks = (
  schoolYear?: Partial<SchoolYear> | null,
  recordedDateKeys?: string[]
): SchoolYearWeekOption[] => {
  const { startMonday, endMonday } = resolveSchoolYearDateBounds(
    schoolYear,
    recordedDateKeys
  );

  const weeks: SchoolYearWeekOption[] = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(
    0,
    Math.round((endMonday.getTime() - startMonday.getTime()) / msPerDay)
  );
  // Cap safety bound at 104 weeks (2 years) to guard against malformed inputs
  const weekCount = Math.min(104, Math.floor(totalDays / 7) + 1);

  for (let i = 0; i < weekCount; i++) {
    const mon = new Date(
      startMonday.getFullYear(),
      startMonday.getMonth(),
      startMonday.getDate() + i * 7
    );
    const fri = new Date(
      mon.getFullYear(),
      mon.getMonth(),
      mon.getDate() + 4
    );
    const monKey = formatDateKeyLocal(mon);
    const friKey = formatDateKeyLocal(fri);
    const dayKeys: string[] = [];
    for (let d = 0; d < 5; d++) {
      const dayObj = new Date(
        mon.getFullYear(),
        mon.getMonth(),
        mon.getDate() + d
      );
      dayKeys.push(formatDateKeyLocal(dayObj));
    }

    const weekNumber = i + 1;
    const monthWeekNumber = computeWeekOfMonth(mon);
    const wed = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 2);
    const monthLabel = wed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthShortLabel = wed.toLocaleDateString('en-US', { month: 'short' });

    weeks.push({
      weekNumber,
      monthWeekNumber,
      monthLabel,
      monthShortLabel,
      weekKey: monKey,
      label: `Week ${monthWeekNumber}`,
      fullLabel: `${monthShortLabel} • Week ${monthWeekNumber}`,
      dateRangeLabel: formatWeekDateRange(mon, fri),
      mondayDate: monKey,
      fridayDate: friKey,
      dayKeys,
    });
  }

  return weeks;
};

export const getSchoolYearWeekNumberForDate = (
  dateOrKey: Date | string,
  schoolYear?: Partial<SchoolYear> | null,
  recordedDateKeys?: string[]
): number => {
  const { startMonday } = resolveSchoolYearDateBounds(schoolYear, recordedDateKeys);
  const targetMonday = getMondayOfDate(dateOrKey);
  const diffDays = Math.round(
    (targetMonday.getTime() - startMonday.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays < 0) return 1;
  return Math.floor(diffDays / 7) + 1;
};
