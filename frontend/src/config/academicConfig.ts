import type { SchoolYear } from '../types';

export const PASSING_SCORE_PERCENTAGE = 70;
export const PASSING_SCORE_RATIO = 0.7;
export const DEFAULT_MILESTONE_TOTAL_SCORE = 40;
export const DEFAULT_MILESTONE_PASSING_SCORE = 28;

export const COMPOSITE_WEIGHTS = {
  attendance: 0.4,
  score: 0.6,
} as const;

export const RISK_THRESHOLDS = {
  lowMinComposite: 86,
  moderateMinComposite: 70,
  highAttendanceGate: 75,
} as const;

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
  defaultSchoolYear: '2026-2027',
} as const;

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
  weekKey: string; // YYYY-MM-DD (Monday)
  label: string; // "Week 1", "Week 2", ...
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

  // Determine end boundary dynamically from SchoolYear.end_date, today, and recorded scores
  let endCandidates: Date[] = [];
  if (schoolYear?.end_date) {
    endCandidates.push(parseDateKeyLocal(schoolYear.end_date));
  } else if (yearMatch) {
    endCandidates.push(new Date(parseInt(yearMatch[2], 10), 5, 30)); // June 30 of SY end year
  }

  // Always include today if within a reasonable range of the school year
  const syEndCap = endCandidates[0];
  if (!syEndCap || today <= syEndCap) {
    endCandidates.push(today);
  }

  if (recordedDateKeys && recordedDateKeys.length > 0) {
    const validRecorded = recordedDateKeys.filter(Boolean).sort();
    const earliestRecorded = parseDateKeyLocal(validRecorded[0]);
    const latestRecorded = parseDateKeyLocal(validRecorded[validRecorded.length - 1]);

    // If a recorded score within this SY falls slightly before start_date, adjust startMonday back safely only if start_date wasn't explicitly configured
    if (!schoolYear?.start_date && earliestRecorded < startMonday) {
      startMonday = getMondayOfDate(earliestRecorded);
    }
    if (latestRecorded >= startMonday) {
      endCandidates.push(latestRecorded);
    }
  }

  let endDateObj = endCandidates.reduce(
    (maxD, curD) => (curD > maxD ? curD : maxD),
    startMonday
  );
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
    weeks.push({
      weekNumber,
      weekKey: monKey,
      label: `Week ${weekNumber}`,
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
