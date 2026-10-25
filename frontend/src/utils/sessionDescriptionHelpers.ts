/**
 * Helpers for handling the DESCRIPTION field across Score Entries,
 * QR Attendance, and Data Analytics.
 *
 * Values are strictly either 'Intervention Activity' or 'MOSY/EOSY/ARAL Summer Assessment'.
 */

export type MilestoneType = 'ARAL Summer Assessment' | 'MOSY' | 'EOSY';

export type EntryDescriptionType =
  | 'Intervention Activity'
  | 'MOSY/EOSY/ARAL Summer Assessment'
  | 'ARAL Summer Assessment'
  | 'MOSY'
  | 'EOSY'
  | 'BOSY/MOSY/EOSY'
  | 'BOSY';

export const SESSION_DESCRIPTIONS_STORAGE_KEY = 'aralert_attendance_session_descriptions';
export const MANUAL_ATTENDANCE_DESCRIPTIONS_KEY = 'aralert_manual_attendance_descriptions';

export type SemesterType = '1st' | '2nd' | 'summer';

export const ACTIVE_SYSTEM_SEMESTER_KEY = 'aralert_active_system_semester';
export const ACTIVE_SYSTEM_SCHOOL_YEAR_KEY = 'aralert_active_system_school_year';

/**
 * Get the currently active semester in the system ('1st' | '2nd' | 'summer').
 * Based on system configuration / active academic state, NOT automatically calculated from calendar date.
 */
export const getActiveSystemSemester = (): SemesterType => {
  try {
    const stored = localStorage.getItem(ACTIVE_SYSTEM_SEMESTER_KEY);
    if (stored === '1st' || stored === '2nd' || stored === 'summer') {
      return stored;
    }
  } catch {
    // ignore localStorage errors
  }
  return '1st';
};

/**
 * Set the currently active semester in the system and broadcast the change event.
 */
export const setActiveSystemSemester = (semester: SemesterType): void => {
  try {
    localStorage.setItem(ACTIVE_SYSTEM_SEMESTER_KEY, semester);
    window.dispatchEvent(new CustomEvent('system_semester_changed', { detail: { semester } }));
  } catch {
    // ignore localStorage errors
  }
};

export const getAssessmentWindowKey = (semester?: SemesterType): string => {
  const sem = semester || getActiveSystemSemester();
  return `aralert_assessment_window_open_${sem}`;
};

export const isAssessmentWindowOpen = (semester?: SemesterType): boolean => {
  try {
    const sem = semester || getActiveSystemSemester();
    const key = getAssessmentWindowKey(sem);
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      return stored === 'true';
    }
    const defaultStored = localStorage.getItem('aralert_assessment_window_open_default');
    if (defaultStored !== null) {
      return defaultStored === 'true';
    }
  } catch {
    // ignore localStorage errors
  }
  return true;
};

export const setAssessmentWindowOpen = (isOpen: boolean, semester?: SemesterType): void => {
  try {
    const sem = semester || getActiveSystemSemester();
    const key = getAssessmentWindowKey(sem);
    localStorage.setItem(key, isOpen ? 'true' : 'false');
    localStorage.setItem('aralert_assessment_window_open_default', isOpen ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('assessment_window_changed', { detail: { isOpen, semester: sem } }));
  } catch {
    // ignore localStorage errors
  }
};

/**
 * Get the evaluation milestone corresponding to what is active on the system:
 * - 1st Semester active -> 'MOSY' (Add MOSY Score)
 * - 2nd Semester active -> 'EOSY' (Add EOSY Score)
 * - Summer active       -> 'ARAL Summer Assessment' (Add ARAL Summer Assessment)
 */
export const getActiveSystemMilestone = (): MilestoneType => {
  const sem = getActiveSystemSemester();
  if (sem === 'summer') return 'ARAL Summer Assessment';
  if (sem === '2nd') return 'EOSY';
  return 'MOSY';
};

/**
 * Determine the evaluation milestone based on what the current semester for the school year is active on the system.
 * If an explicit semester or milestone override is passed, maps it; otherwise defaults to the system's active milestone.
 */
export const getCurrentSemesterMilestone = (explicitSemesterOrMilestone?: string | null): MilestoneType => {
  if (explicitSemesterOrMilestone) {
    const val = explicitSemesterOrMilestone.trim();
    const lower = val.toLowerCase();
    if (lower === '1st' || lower === '1st semester' || lower === 'mosy' || lower.includes('mosy')) {
      return 'MOSY';
    }
    if (lower === '2nd' || lower === '2nd semester' || lower === 'eosy' || lower.includes('eosy')) {
      return 'EOSY';
    }
    if (lower === 'summer' || lower.includes('summer')) {
      return 'ARAL Summer Assessment';
    }
  }
  return getActiveSystemMilestone();
};

/**
 * Determine the milestone for tutor score logging and evaluations.
 * Decoupled from tutor level and tied directly to what the current semester for the school year is active on the system.
 */
export const getTutorAssignedMilestone = (explicitSemesterOrMilestone?: string | null): MilestoneType => {
  return getCurrentSemesterMilestone(explicitSemesterOrMilestone);
};

/**
 * Determine description for a score/grade entry.
 * If subject contains milestone keywords, returns the specific milestone ('ARAL Summer Assessment', 'MOSY', 'EOSY').
 * Otherwise returns 'Intervention Activity'.
 */
export const getScoreDescription = (grade: { subject?: string } | null | undefined): EntryDescriptionType => {
  if (!grade || !grade.subject) return 'Intervention Activity';
  const subject = grade.subject.toUpperCase();
  if (subject.includes('ARAL SUMMER') || subject.includes('SUMMER') || subject.includes('BOSY')) return 'ARAL Summer Assessment';
  if (subject.includes('MOSY')) return 'MOSY';
  if (subject.includes('EOSY') || subject.includes('ENDLINE')) return 'EOSY';
  if (subject.includes('BOSY/MOSY/EOSY') || subject.includes('MILESTONE')) return 'ARAL Summer Assessment';
  return 'Intervention Activity';
};

/**
 * Retrieve session description map from localStorage
 */
export const getStoredSessionDescriptions = (): Record<string, EntryDescriptionType> => {
  try {
    const raw = localStorage.getItem(SESSION_DESCRIPTIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/**
 * Persist a session ID to its description
 */
export const storeSessionDescription = (sessionId: string, description: EntryDescriptionType) => {
  try {
    const current = getStoredSessionDescriptions();
    current[sessionId] = description;
    localStorage.setItem(SESSION_DESCRIPTIONS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore localStorage errors
  }
};

/**
 * Retrieve manual / edited attendance description map from localStorage
 */
export const getStoredAttendanceDescriptions = (): Record<string, EntryDescriptionType> => {
  try {
    const raw = localStorage.getItem(MANUAL_ATTENDANCE_DESCRIPTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/**
 * Persist a specific attendance ID to its description
 */
export const storeAttendanceDescription = (attendanceId: number | string, description: EntryDescriptionType) => {
  try {
    const current = getStoredAttendanceDescriptions();
    current[String(attendanceId)] = description;
    localStorage.setItem(MANUAL_ATTENDANCE_DESCRIPTIONS_KEY, JSON.stringify(current));
  } catch {
    // ignore localStorage errors
  }
};

/**
 * Determine the description for an attendance log.
 * Checks:
 * 1. Specific attendance ID override in storage
 * 2. Associated session ID in storage
 * 3. Associated session_action if marked as milestone/summer/mosy/eosy/bosy
 * 4. Defaults to 'Intervention Activity'
 */
export const getAttendanceDescription = (log: {
  id?: number | string;
  session?: string | null;
  session_action?: string | null;
}): EntryDescriptionType => {
  if (!log) return 'Intervention Activity';

  // 1. Direct record override
  if (log.id !== undefined && log.id !== null) {
    const recordMap = getStoredAttendanceDescriptions();
    if (recordMap[String(log.id)]) {
      return recordMap[String(log.id)];
    }
  }

  // 2. Linked session description
  if (log.session) {
    const sessionMap = getStoredSessionDescriptions();
    if (sessionMap[log.session]) {
      return sessionMap[log.session];
    }
  }

  // 3. Fallback to session_action string if contains milestone indicators
  if (log.session_action) {
    const act = log.session_action.toUpperCase();
    if (act.includes('ARAL SUMMER') || act.includes('SUMMER') || act.includes('BOSY')) return 'ARAL Summer Assessment';
    if (act.includes('MOSY')) return 'MOSY';
    if (act.includes('EOSY')) return 'EOSY';
    if (act.includes('MILESTONE')) return 'ARAL Summer Assessment';
  }

  return 'Intervention Activity';
};

/**
 * Standardize session label for multi-entry separator:
 * Strictly outputs:
 * - 'MOSY ASSESSMENT'
 * - 'EOSY ASSESSMENT'
 * - 'SUMMER ASSESSMENT'
 * - 'INTERVENTION ACTIVITY'
 */
export const formatSessionLabel = (rawDesc: string | null | undefined): string => {
  if (!rawDesc) return 'INTERVENTION ACTIVITY';
  const upper = rawDesc.toUpperCase();
  if (upper.includes('MOSY')) return 'MOSY ASSESSMENT';
  if (upper.includes('EOSY')) return 'EOSY ASSESSMENT';
  if (upper.includes('SUMMER')) return 'SUMMER ASSESSMENT';
  return 'INTERVENTION ACTIVITY';
};

/**
 * Standardize time string for multi-entry separator:
 * e.g., '10:40 AM'
 */
export const formatSessionTime = (timeStr: string | null | undefined): string => {
  if (!timeStr || timeStr === '—' || timeStr === '-') return '';
  const trimmed = timeStr.trim();
  if (/^\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)$/i.test(trimmed)) {
    return trimmed.replace(/:00\s*(AM|PM)$/i, ' $1');
  }
  try {
    const d = new Date(trimmed.includes('T') ? trimmed : `1970-01-01T${trimmed}`);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  } catch {
    // fallback
  }
  return trimmed;
};
