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

export const SESSION_LAUNCH_TIMES_STORAGE_KEY = 'aralert_session_launch_times';

/**
 * Retrieve stored session launch times (keyed by session UUID).
 */
export const getStoredSessionLaunchTimes = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(SESSION_LAUNCH_TIMES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/**
 * Persist a session ID to its launch time (the time the session was started by the tutor).
 */
export const storeSessionLaunchTime = (sessionId: string, timeStr: string): void => {
  try {
    const current = getStoredSessionLaunchTimes();
    current[sessionId] = timeStr;
    localStorage.setItem(SESSION_LAUNCH_TIMES_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore localStorage errors
  }
};

/**
 * Resolves the time an attendance session was started by the tutor.
 * Priority:
 * 1. Stored session launch time for the linked session ID (record.session)
 * 2. Earliest scan time_in / created_at among group records in that session
 * 3. The record's own time_in or created_at
 */
export const getAttendanceSessionStartTime = (
  record?: { session?: string | null; time_in?: string | null; created_at?: string | null } | null,
  groupRecords?: { session?: string | null; time_in?: string | null; created_at?: string | null }[]
): string => {
  if (!record && (!groupRecords || groupRecords.length === 0)) return '';

  const launchTimes = getStoredSessionLaunchTimes();
  if (record?.session && launchTimes[String(record.session)]) {
    return formatSessionTime(launchTimes[String(record.session)]);
  }
  if (groupRecords) {
    for (const item of groupRecords) {
      if (item.session && launchTimes[String(item.session)]) {
        return formatSessionTime(launchTimes[String(item.session)]);
      }
    }
  }

  const candidateTimes: string[] = [];
  const recordsToScan = groupRecords && groupRecords.length > 0 ? groupRecords : (record ? [record] : []);

  for (const item of recordsToScan) {
    if (item.session && record?.session && String(item.session) !== String(record.session)) continue;
    const t = item.time_in || item.created_at;
    if (t && t !== '—' && t !== '-') candidateTimes.push(t);
  }

  if (candidateTimes.length > 0) {
    candidateTimes.sort((a, b) => a.localeCompare(b));
    return formatSessionTime(candidateTimes[0]);
  }

  return formatSessionTime(record?.time_in || record?.created_at || '');
};

export interface AttendanceSessionGroup<T> {
  key: string;
  sessionId?: string | null;
  label: string;
  time: string;
  rows: T[];
}

export const timeStringToMinutes = (timeStr?: string | null): number => {
  if (!timeStr) return 0;
  try {
    const trimmed = timeStr.trim();
    if (trimmed.includes('AM') || trimmed.includes('PM')) {
      const [timePart, modifier] = trimmed.split(' ');
      let [hours, minutes] = timePart.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      return hours * 60 + (minutes || 0);
    }
    const [h, m] = trimmed.split(':').map(Number);
    if (!isNaN(h)) return h * 60 + (m || 0);
  } catch {
    // fallback
  }
  return 0;
};

/**
 * Robustly groups attendance records into cohesive session entries.
 * Prevents editing a record or having absent students (time_in=null) from
 * splintering students of the same session into separate isolated divisions.
 */
export const groupAttendanceBySession = <T extends Record<string, any>>(
  records: T[],
  options?: {
    getDate?: (r: T) => string;
    getSessionId?: (r: T) => string | null | undefined;
    getTimeIn?: (r: T) => string | null | undefined;
    getCreatedAt?: (r: T) => string | null | undefined;
    getLabel?: (r: T) => string;
  }
): AttendanceSessionGroup<T>[] => {
  if (!records || records.length === 0) return [];

  const getDate = options?.getDate || ((r: any) => r.date?.slice(0, 10) || '');
  const getSessionId = options?.getSessionId || ((r: any) => r.session || r.sessionId || null);
  const getTimeIn = options?.getTimeIn || ((r: any) => r.time_in || r.timeIn || null);
  const getCreatedAt = options?.getCreatedAt || ((r: any) => r.created_at || r.createdAt || null);
  const getLabel = options?.getLabel || ((r: any) => formatSessionLabel(getAttendanceDescription(r)));

  // 1. Group records by date and activity label
  const dateAndLabelMap = new Map<string, T[]>();
  records.forEach((r) => {
    const d = getDate(r) || 'unknown';
    const l = getLabel(r) || 'INTERVENTION ACTIVITY';
    const key = `${d}|${l}`;
    if (!dateAndLabelMap.has(key)) {
      dateAndLabelMap.set(key, []);
    }
    dateAndLabelMap.get(key)!.push(r);
  });

  const finalGroups: AttendanceSessionGroup<T>[] = [];

  dateAndLabelMap.forEach((dateLabelRecords, dlKey) => {
    const [dateKey, label] = dlKey.split('|');

    // Collect all unique non-empty session IDs in this date + label bucket
    const explicitSessionIds = Array.from(
      new Set(
        dateLabelRecords
          .map((r) => getSessionId(r))
          .filter((sid): sid is string => Boolean(sid && String(sid).trim()))
      )
    );

    if (explicitSessionIds.length <= 1) {
      // 0 or 1 session ID: ALL records on this date for this activity belong to this unified session.
      // (Even if records were edited or are absent, they remain part of this single session)
      const primarySessionId = explicitSessionIds[0] || null;

      // Group records by time clusters ONLY IF scan times span multiple distinct sessions (> 2.5 hours apart)
      const validTimes = dateLabelRecords
        .map((r) => getTimeIn(r) || getCreatedAt(r))
        .filter((t): t is string => Boolean(t && t !== '—' && t !== '-'));

      const minuteValues = Array.from(new Set(validTimes.map(timeStringToMinutes))).sort((a, b) => a - b);

      let hasMultipleTimeWindows = false;
      const splitThresholdMinutes = 150; // 2.5 hours
      if (minuteValues.length > 1) {
        for (let i = 1; i < minuteValues.length; i++) {
          if (minuteValues[i] - minuteValues[i - 1] > splitThresholdMinutes) {
            hasMultipleTimeWindows = true;
            break;
          }
        }
      }

      if (hasMultipleTimeWindows && !primarySessionId) {
        // Multi-session day without explicit session IDs: cluster by distinct time windows
        const clusters: { clusterMinutes: number; rows: T[] }[] = [];
        dateLabelRecords.forEach((r) => {
          const t = getTimeIn(r) || getCreatedAt(r);
          const m = timeStringToMinutes(t);
          if (clusters.length === 0) {
            clusters.push({ clusterMinutes: m, rows: [r] });
          } else {
            let matched = false;
            for (const c of clusters) {
              if (Math.abs(c.clusterMinutes - m) <= splitThresholdMinutes) {
                c.rows.push(r);
                matched = true;
                break;
              }
            }
            if (!matched) {
              clusters.push({ clusterMinutes: m, rows: [r] });
            }
          }
        });

        clusters.forEach((cluster, idx) => {
          const time = getAttendanceSessionStartTime(
            { time_in: getTimeIn(cluster.rows[0]), created_at: getCreatedAt(cluster.rows[0]) },
            cluster.rows.map((r) => ({
              session: getSessionId(r),
              time_in: getTimeIn(r),
              created_at: getCreatedAt(r),
            }))
          );
          finalGroups.push({
            key: `${dateKey}_${label}_cluster_${idx}`,
            label,
            time,
            rows: cluster.rows,
          });
        });
      } else {
        // Single session for the day / activity: all records belong together
        const groupKey = primarySessionId ? `${dateKey}_session_${primarySessionId}` : `${dateKey}_${label}`;
        const time = getAttendanceSessionStartTime(
          { session: primarySessionId, time_in: getTimeIn(dateLabelRecords[0]), created_at: getCreatedAt(dateLabelRecords[0]) },
          dateLabelRecords.map((r) => ({
            session: getSessionId(r),
            time_in: getTimeIn(r),
            created_at: getCreatedAt(r),
          }))
        );

        finalGroups.push({
          key: groupKey,
          sessionId: primarySessionId,
          label,
          time,
          rows: dateLabelRecords,
        });
      }
    } else {
      // Multiple explicit session IDs exist on this date for this activity
      const sessionBuckets = new Map<string, T[]>();
      explicitSessionIds.forEach((sid) => sessionBuckets.set(sid, []));

      const recordsWithoutSession: T[] = [];
      dateLabelRecords.forEach((r) => {
        const sid = getSessionId(r);
        if (sid && sessionBuckets.has(sid)) {
          sessionBuckets.get(sid)!.push(r);
        } else {
          recordsWithoutSession.push(r);
        }
      });

      // Associate records without session IDs to the nearest session rather than creating an orphan division
      recordsWithoutSession.forEach((r) => {
        const rTime = getTimeIn(r) || getCreatedAt(r);
        if (rTime && explicitSessionIds.length > 0) {
          let closestSid = explicitSessionIds[0];
          let minDiff = Infinity;
          const rMinutes = timeStringToMinutes(rTime);
          for (const sid of explicitSessionIds) {
            const sRows = sessionBuckets.get(sid) || [];
            const sTime = getAttendanceSessionStartTime({ session: sid }, sRows);
            const sMinutes = timeStringToMinutes(sTime);
            const diff = Math.abs(rMinutes - sMinutes);
            if (diff < minDiff) {
              minDiff = diff;
              closestSid = sid;
            }
          }
          sessionBuckets.get(closestSid)!.push(r);
        } else {
          sessionBuckets.get(explicitSessionIds[0])!.push(r);
        }
      });

      explicitSessionIds.forEach((sid) => {
        const rows = sessionBuckets.get(sid) || [];
        if (rows.length === 0) return;
        const groupKey = `${dateKey}_session_${sid}`;
        const time = getAttendanceSessionStartTime(
          { session: sid },
          rows.map((r) => ({
            session: getSessionId(r),
            time_in: getTimeIn(r),
            created_at: getCreatedAt(r),
          }))
        );

        finalGroups.push({
          key: groupKey,
          sessionId: sid,
          label,
          time,
          rows,
        });
      });
    }
  });

  finalGroups.sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    return a.label.localeCompare(b.label);
  });

  return finalGroups;
};

