import type React from 'react';
import type { User } from '../types';

/**
 * Format student name to the standard academic / DepEd format:
 * LASTNAME, FIRSTNAME M.I.
 *
 * Examples:
 * - { first_name: 'Juan', last_name: 'Dela Cruz', middle_name: 'Ponce' } -> 'DELA CRUZ, JUAN P.'
 * - { first_name: 'Juan', last_name: 'Dela Cruz' } -> 'DELA CRUZ, JUAN'
 * - 'DELA CRUZ, JUAN P.' -> 'DELA CRUZ, JUAN P.'
 */
export const formatStudentName = (
  student: Partial<User> | { first_name?: string; last_name?: string; middle_name?: string; full_name?: string } | string | null | undefined
): string => {
  if (!student) return '';

  if (typeof student === 'string') {
    const trimmed = student.trim();
    if (trimmed.includes(',')) {
      return trimmed.toUpperCase();
    }
    return trimmed.toUpperCase();
  }

  const ln = (student.last_name || '').toUpperCase().trim();
  const fn = (student.first_name || '').toUpperCase().trim();
  let mi = '';
  if (student.middle_name && student.middle_name.trim()) {
    mi = `${student.middle_name.trim()[0].toUpperCase()}.`;
  }

  if (ln && fn) {
    return `${ln}, ${fn}${mi ? ' ' + mi : ''}`;
  }
  if (ln) {
    return ln;
  }
  if (fn) {
    return `${fn}${mi ? ' ' + mi : ''}`;
  }

  return (student.full_name || '').toUpperCase().trim();
};

/**
 * Extract the default profile initial (first letter of the first name) for a user or student.
 * For example:
 * - 'SANTIAGO, JUAN' -> 'J'
 * - 'JUAN SANTIAGO' -> 'J'
 * - 'CLERIGO, RAYVIN C.' -> 'R'
 * - { first_name: 'Juan', last_name: 'Santiago' } -> 'J'
 */
export const getUserInitial = (
  userOrName:
    | Partial<User>
    | {
        last_name?: string;
        first_name?: string;
        middle_name?: string;
        username?: string;
        full_name?: string;
        name?: string;
        email?: string;
      }
    | string
    | null
    | undefined
): string => {
  if (!userOrName) return 'U';

  if (typeof userOrName === 'string') {
    const trimmed = userOrName.trim();
    if (!trimmed) return 'U';

    // Academic format: 'LASTNAME, FIRSTNAME M.I.' -> take first letter of FIRSTNAME (after comma)
    if (trimmed.includes(',')) {
      const afterComma = trimmed.split(',')[1]?.trim();
      if (afterComma) {
        const firstWord = afterComma.split(/\s+/)[0]?.replace(/[^a-zA-Z0-9]/g, '');
        if (firstWord && firstWord.length > 0) {
          return firstWord[0].toUpperCase();
        }
      }
      // Fallback to before comma if after comma is empty
      const beforeComma = trimmed.split(',')[0].trim().replace(/[^a-zA-Z0-9]/g, '');
      if (beforeComma.length > 0) {
        return beforeComma[0].toUpperCase();
      }
    }

    // Natural order or single name: 'JUAN SANTIAGO' or 'JUAN' -> first word is the first name
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const firstWord = words[0].replace(/[^a-zA-Z0-9]/g, '');
      if (firstWord.length > 0) {
        return firstWord[0].toUpperCase();
      }
    }

    const clean = trimmed.replace(/[^a-zA-Z0-9]/g, '');
    return clean ? clean[0].toUpperCase() : 'U';
  }

  // Object case: prioritize user's first name
  const fn = (userOrName.first_name || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  if (fn.length > 0) {
    return fn[0].toUpperCase();
  }

  // If full_name or name is available, parse first name from it
  const candidate = userOrName.full_name || (userOrName as any).name;
  if (candidate && typeof candidate === 'string') {
    const initial = getUserInitial(candidate);
    if (initial && initial !== 'U') return initial;
  }

  const un = (userOrName.username || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  if (un.length > 0) {
    return un[0].toUpperCase();
  }

  const em = (userOrName.email || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  if (em.length > 0) {
    return em[0].toUpperCase();
  }

  // Fallback to last name if no first name or username is available
  const ln = (userOrName.last_name || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  if (ln.length > 0) {
    return ln[0].toUpperCase();
  }

  return 'U';
};

/**
 * Default avatar initial for students and users.
 * Uses the first letter of their first name (e.g. 'CLERIGO, RAYVIN C.' -> 'R').
 * Maintained for backward compatibility across all student and user roster tables.
 */
export const getStudentInitials = (
  nameOrUser:
    | Partial<User>
    | {
        last_name?: string;
        first_name?: string;
        middle_name?: string;
        username?: string;
        full_name?: string;
        name?: string;
        email?: string;
      }
    | string
    | null
    | undefined
): string => {
  return getUserInitial(nameOrUser);
};

/**
 * Simple, neutral color for all student avatars.
 * Clean light gray background with dark charcoal text matching the reference design.
 */
export const DEFAULT_STUDENT_AVATAR_COLOR =
  'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200 border border-gray-200/60 dark:border-slate-700/60';

export const AVATAR_COLORS = [
  DEFAULT_STUDENT_AVATAR_COLOR,
];

export const buildAvatarColorMap = (
  _allStudents?: (Partial<User> | { id?: string | number; full_name?: string; name?: string; last_name?: string; first_name?: string } | string)[]
): ((studentOrName: Partial<User> | { id?: string | number; full_name?: string; name?: string; last_name?: string; first_name?: string } | string | null | undefined) => string) => {
  return () => DEFAULT_STUDENT_AVATAR_COLOR;
};

/**
 * Get the simple, neutral avatar color for a student or student name.
 */
export const getStudentAvatarColor = (
  _studentOrName?: Partial<User> | { id?: string | number; full_name?: string; name?: string; last_name?: string; first_name?: string } | string | null | undefined,
  _allStudents?: (Partial<User> | { id?: string | number; full_name?: string; name?: string; last_name?: string; first_name?: string } | string)[]
): string => {
  return DEFAULT_STUDENT_AVATAR_COLOR;
};

export const getTutorAvatarColor = getStudentAvatarColor;
/** @deprecated Use role-aware helpers below for non-student roles */
export const getUserAvatarColor = getStudentAvatarColor;

// ─── Role-Aware Avatar Color Helpers ─────────────────────────────────────────

/**
 * Returns true only when the role is 'student'.
 * Everything else — including null/undefined (SuperAdmin) and any unknown
 * future role — is treated as staff and gets the brand-color avatar.
 * Fail-safe: unknown roles → brand color, never a random palette hue.
 */
export const isStudentRole = (role: string | null | undefined): boolean =>
  role === 'student';

/**
 * Returns a React CSSProperties object that paints a staff avatar
 * with the live `--brand` CSS variable.
 *
 * ⚠️ CONTRAST NOTE: white text (#fff) passes WCAG AA against the default
 * ARALert brand (#0052B7, contrast ≈ 7.4:1). If the brand is ever changed
 * to a much lighter hue (yellows, light cyans, pastels), white text may
 * fail contrast. At that point, switch `color` below to a dark text token.
 *
 * Do NOT copy the hex out of this function — always reference `var(--brand)`
 * so a theme change in theme.css updates all staff avatars automatically.
 */
export const getStaffAvatarStyle = (): React.CSSProperties => ({
  background: 'var(--brand)',
  color: '#fff',
});

/**
 * Role-aware avatar color resolver for any user record.
 *
 * Returns one of two shapes depending on role:
 *  - student  → `{ kind: 'class', value: string }` — a Tailwind class string
 *                to spread as `className` on the avatar div.
 *  - staff/unknown → `{ kind: 'style', value: React.CSSProperties }` — inline
 *                style referencing `var(--brand)` live.
 *
 * Usage in JSX:
 * ```tsx
 * const av = getUserAvatarColorResolved(user);
 * <div
 *   className={av.kind === 'class' ? `... ${av.value}` : '...'}
 *   style={av.kind === 'style' ? av.value : undefined}
 * >
 *   {initial}
 * </div>
 * ```
 */
export const getUserAvatarColorResolved = (
  user: Partial<User> | { role?: string | null; id?: string | number; first_name?: string; last_name?: string; full_name?: string } | null | undefined
): { kind: 'class'; value: string } | { kind: 'style'; value: React.CSSProperties } => {
  if (user && isStudentRole((user as any).role)) {
    return { kind: 'class', value: getStudentAvatarColor(user) };
  }
  return { kind: 'style', value: getStaffAvatarStyle() };
};

/**
 * Returns an array of the latest N school weekdays (Monday–Friday) ending on or before refDate.
 * Skips weekends (Saturday and Sunday) so that educational charts track active school days.
 * The returned array is sorted in chronological order (oldest to newest).
 */
export const getRecentSchoolWeekdays = (count: number, refDate: Date = new Date()): Date[] => {
  const days: Date[] = [];
  const curr = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  while (days.length < count) {
    const dayOfWeek = curr.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.unshift(new Date(curr));
    }
    curr.setDate(curr.getDate() - 1);
  }
  return days;
};

