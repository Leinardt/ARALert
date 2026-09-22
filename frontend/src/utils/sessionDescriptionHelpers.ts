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

/**
 * Determine the milestone assigned to a tutor based on their ARAL level:
 * - Basic  -> MOSY
 * - Plus   -> EOSY
 * - Summer -> ARAL Summer Assessment
 */
export const getTutorAssignedMilestone = (aralLevel?: string | null): MilestoneType => {
  const level = (aralLevel || 'basic').toLowerCase();
  if (level === 'summer') return 'ARAL Summer Assessment';
  if (level === 'plus') return 'EOSY';
  return 'MOSY';
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
