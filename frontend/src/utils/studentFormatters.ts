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
 * Extract 2-letter initials from a student name, supporting both:
 * - 'LASTNAME, FIRSTNAME M.I.' (e.g., 'DELA CRUZ, JUAN P.' -> 'DJ')
 * - 'FIRSTNAME LASTNAME' (e.g., 'JUAN DELA CRUZ' -> 'JC')
 */
export const getStudentInitials = (name: string | null | undefined): string => {
  if (!name) return '??';
  const trimmed = name.trim();
  if (trimmed.includes(',')) {
    const [last, first] = trimmed.split(',').map((s) => s.trim());
    const lnChar = last ? last.replace(/[^a-zA-Z]/g, '')[0] || '' : '';
    const fnChar = first ? first.replace(/[^a-zA-Z]/g, '')[0] || '' : '';
    if (lnChar && fnChar) {
      return (lnChar + fnChar).toUpperCase();
    }
  }

  const p = trimmed.split(/\s+/);
  return p.length >= 2
    ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
    : trimmed.slice(0, 2).toUpperCase();
};
