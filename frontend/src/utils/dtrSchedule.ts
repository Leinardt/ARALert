/**
 * DTR Schedule Constants & Status Utilities
 *
 * Official Schedules:
 * - Faculty, Principal, Admin:
 *     Morning Shift:   Time In: 8:00 AM (480 min),   Time Out: 11:30 AM (690 min)
 *     Afternoon Shift: Time In: 1:00 PM (780 min),   Time Out: 4:30 PM (990 min)
 * - Tutor:
 *     Afternoon Shift: Time In: 4:30 PM (990 min),   Time Out: 5:00 PM (1020 min)
 */

export const DTR_SCHEDULES = {
  faculty: {
    morning: { in: 8 * 60, out: 11 * 60 + 30 }, // 8:00 AM - 11:30 AM
    afternoon: { in: 13 * 60, out: 16 * 60 + 30 }, // 1:00 PM - 4:30 PM
  },
  principal: {
    morning: { in: 8 * 60, out: 11 * 60 + 30 },
    afternoon: { in: 13 * 60, out: 16 * 60 + 30 },
  },
  admin: {
    morning: { in: 8 * 60, out: 11 * 60 + 30 },
    afternoon: { in: 13 * 60, out: 16 * 60 + 30 },
  },
  tutor: {
    afternoon: { in: 16 * 60 + 30, out: 17 * 60 }, // 4:30 PM - 5:00 PM
  },
} as const;

export type DtrStatus = 'Present' | 'Late' | '—';

export const timeToMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export const formatDtrTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const match = value.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? 'PM' : 'AM'}`;
};

/**
 * Calculates attendance status strictly as 'Present', 'Late', or '—'.
 *
 * Rules:
 * - Tutor (single shift: 4:30 PM - 5:00 PM):
 *     Time In <= 4:30 PM (990 mins) -> Present
 *     Time In >  4:30 PM (990 mins) -> Late
 * - Faculty, Principal, Admin (Morning: 8:00 AM - 11:30 AM, Afternoon: 1:00 PM - 4:30 PM):
 *     If morning punch: Time In <= 8:00 AM -> Present, > 8:00 AM -> Late
 *     If afternoon punch: Time In <= 1:00 PM -> Present, > 1:00 PM -> Late
 *     If both morning and afternoon arrivals are logged: If either arrival was late -> Late, else Present.
 */
export const getStaffDtrStatus = (
  role: string | null | undefined,
  timeIn: string | null | undefined,
  arrivalAm?: string | null | undefined,
  arrivalPm?: string | null | undefined
): DtrStatus => {
  const normRole = (role || '').toLowerCase();
  const inMins = timeToMinutes(timeIn);
  const arrAmMins = timeToMinutes(arrivalAm);
  const arrPmMins = timeToMinutes(arrivalPm);

  if (inMins === null && arrAmMins === null && arrPmMins === null) {
    return '—';
  }

  // Tutor: single 4:30 PM shift
  if (normRole === 'tutor') {
    const effectiveIn = inMins ?? arrPmMins;
    if (effectiveIn === null) return '—';
    return effectiveIn > DTR_SCHEDULES.tutor.afternoon.in ? 'Late' : 'Present';
  }

  // Faculty / Principal / Admin:
  let hasPunch = false;
  let isLate = false;

  if (arrAmMins !== null) {
    hasPunch = true;
    if (arrAmMins > DTR_SCHEDULES.faculty.morning.in) isLate = true;
  }

  if (arrPmMins !== null) {
    hasPunch = true;
    if (arrPmMins > DTR_SCHEDULES.faculty.afternoon.in) isLate = true;
  }

  // Fallback to legacy single time_in field
  if (!hasPunch && inMins !== null) {
    hasPunch = true;
    if (inMins < 12 * 60) {
      if (inMins > DTR_SCHEDULES.faculty.morning.in) isLate = true;
    } else {
      if (inMins > DTR_SCHEDULES.faculty.afternoon.in) isLate = true;
    }
  }

  if (!hasPunch) return '—';
  return isLate ? 'Late' : 'Present';
};

/**
 * Calculates undertime string (e.g. '30m' or '1h 15m') if departure was earlier than scheduled.
 */
export const getStaffUndertimeStr = (
  role: string | null | undefined,
  timeOut: string | null | undefined,
  departureAm?: string | null | undefined,
  departurePm?: string | null | undefined
): string => {
  const normRole = (role || '').toLowerCase();
  const outMins = timeToMinutes(timeOut);
  const depAmMins = timeToMinutes(departureAm);
  const depPmMins = timeToMinutes(departurePm);

  let totalUndertimeMins = 0;

  if (normRole === 'tutor') {
    const effectiveOut = outMins ?? depPmMins;
    if (effectiveOut !== null && effectiveOut < DTR_SCHEDULES.tutor.afternoon.out) {
      totalUndertimeMins += DTR_SCHEDULES.tutor.afternoon.out - effectiveOut;
    }
  } else {
    // Faculty / Principal / Admin
    if (depAmMins !== null && depAmMins < DTR_SCHEDULES.faculty.morning.out) {
      totalUndertimeMins += DTR_SCHEDULES.faculty.morning.out - depAmMins;
    }
    if (depPmMins !== null && depPmMins < DTR_SCHEDULES.faculty.afternoon.out) {
      totalUndertimeMins += DTR_SCHEDULES.faculty.afternoon.out - depPmMins;
    }
    if (depAmMins === null && depPmMins === null && outMins !== null) {
      if (outMins < 12 * 60) {
        if (outMins < DTR_SCHEDULES.faculty.morning.out) {
          totalUndertimeMins += DTR_SCHEDULES.faculty.morning.out - outMins;
        }
      } else {
        if (outMins < DTR_SCHEDULES.faculty.afternoon.out) {
          totalUndertimeMins += DTR_SCHEDULES.faculty.afternoon.out - outMins;
        }
      }
    }
  }

  if (totalUndertimeMins <= 0) return '—';
  const h = Math.floor(totalUndertimeMins / 60);
  const m = totalUndertimeMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
