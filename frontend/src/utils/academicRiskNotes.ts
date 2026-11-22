import type { AcademicRisk, User } from '../types';
import { parseStudentGradeAndSection } from './tutorCohortHelpers';

const PRINCIPAL_TUTOR_NOTE_PREFIX = '[PRINCIPAL_TUTOR_NOTE:';
const PRINCIPAL_STUDENT_NOTE_PREFIX = '[PRINCIPAL_STUDENT_NOTE';
const TUTOR_STUDENT_NOTE_PREFIX = '[TUTOR_STUDENT_NOTE';

export type AcademicRiskNoteKind = 'principal_tutor' | 'principal_student' | 'tutor_student';

export interface ParsedAcademicRiskNote {
  kind: AcademicRiskNoteKind;
  tutorId?: string;
  tutorName?: string;
  principalName?: string;
  classLabel?: string;
  authorLabel: string;
  note: string;
  risk: AcademicRisk;
}

const sanitizeTagSegment = (value?: string | null): string =>
  (value || '').replace(/[|\]]+/g, ' ').replace(/\s+/g, ' ').trim();

const formatAralAndSubjectSuffix = (aralLevel?: string | null, subject?: string | null): string => {
  const parts: string[] = [];
  if (aralLevel) {
    const clean = aralLevel.trim();
    if (clean) {
      parts.push(clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase());
    }
  }
  if (subject) {
    const clean = subject.trim();
    if (clean) parts.push(clean);
  }
  return parts.join(' - ');
};

/**
 * Format a concise human-readable class label for a student (e.g., "Grade 8 - Narra (Basic - Filipino)").
 */
export const formatStudentClassContext = (
  student: Partial<User> | { grade_level?: string | null; section?: string | null; aral_level?: string | null; subject?: string | null } | null | undefined
): string => {
  if (!student) return '';
  const { grade, section } = parseStudentGradeAndSection(student as any);
  const baseClass =
    grade && section
      ? `${grade} - ${section}`
      : grade || section || (student.grade_level || '').trim();
  const suffix = formatAralAndSubjectSuffix(student.aral_level, student.subject);
  if (baseClass && suffix) return `${baseClass} (${suffix})`;
  return baseClass || suffix || '';
};

/**
 * Format a compact class string without subject/level suffix (e.g., "Grade 8 - Narra").
 */
export const formatStudentSectionOnly = (student: Partial<User> | null | undefined): string => {
  if (!student) return '';
  const { grade, section } = parseStudentGradeAndSection(student as any);
  if (grade && section) return `${grade} - ${section}`;
  return grade || section || (student.grade_level || '').trim();
};

/**
 * Extract a Principal-to-Tutor advisory note encoded with
 * `[PRINCIPAL_TUTOR_NOTE:<tutorId>]` or `[PRINCIPAL_TUTOR_NOTE:<tutorId>|<classLabel>]`.
 */
export const parsePrincipalTutorNote = (
  details?: string | null
): { tutorId: string; classLabel?: string; principalName?: string; note: string } | null => {
  if (!details || !details.startsWith(PRINCIPAL_TUTOR_NOTE_PREFIX)) return null;
  const closeIdx = details.indexOf(']');
  if (closeIdx === -1) return null;
  const header = details.slice(PRINCIPAL_TUTOR_NOTE_PREFIX.length, closeIdx);
  const [rawTutorId, rawClass, ...restPrincipal] = header.split('|');
  const tutorId = (rawTutorId || '').trim();
  const classLabel = (rawClass || '').trim() || undefined;
  const principalName = restPrincipal.join('|').trim() || undefined;
  const note = details.slice(closeIdx + 1).trim();
  return tutorId ? { tutorId, classLabel, principalName, note } : null;
};

/**
 * Format a Principal-to-Tutor advisory note for storage in `ApiAcademicRisk.details`.
 */
export const formatPrincipalTutorNote = (
  tutorId: string,
  note: string,
  classLabel?: string | null,
  principalName?: string | null
): string => {
  const safeClass = sanitizeTagSegment(classLabel);
  const safePrincipal = sanitizeTagSegment(principalName);
  let header: string;
  if (safePrincipal) {
    header = `${PRINCIPAL_TUTOR_NOTE_PREFIX}${tutorId}|${safeClass}|${safePrincipal}]`;
  } else if (safeClass) {
    header = `${PRINCIPAL_TUTOR_NOTE_PREFIX}${tutorId}|${safeClass}]`;
  } else {
    header = `${PRINCIPAL_TUTOR_NOTE_PREFIX}${tutorId}]`;
  }
  return `${header} ${note.trim()}`;
};

/**
 * Extract a Principal-to-Student note encoded with
 * `[PRINCIPAL_STUDENT_NOTE]` or `[PRINCIPAL_STUDENT_NOTE|<classLabel>|<tutorName>]`.
 */
export const parsePrincipalStudentNote = (
  details?: string | null
): { classLabel?: string; tutorName?: string; note: string } | null => {
  if (!details || !details.startsWith(PRINCIPAL_STUDENT_NOTE_PREFIX)) return null;
  const closeIdx = details.indexOf(']');
  if (closeIdx === -1) return null;
  const header = details.slice(PRINCIPAL_STUDENT_NOTE_PREFIX.length, closeIdx);
  const parts = header.split('|').map((s) => s.trim());
  const classLabel = parts[1] || undefined;
  const tutorName = parts[2] || undefined;
  const note = details.slice(closeIdx + 1).trim();
  return note ? { classLabel, tutorName, note } : null;
};

/**
 * Format a Principal-to-Student note for storage in `ApiAcademicRisk.details`.
 */
export const formatPrincipalStudentNote = (
  note: string,
  classLabel?: string | null,
  tutorName?: string | null
): string => {
  const safeClass = sanitizeTagSegment(classLabel);
  const safeTutor = sanitizeTagSegment(tutorName);
  if (safeClass || safeTutor) {
    return `[PRINCIPAL_STUDENT_NOTE|${safeClass}|${safeTutor}] ${note.trim()}`;
  }
  return `[PRINCIPAL_STUDENT_NOTE] ${note.trim()}`;
};

/**
 * Extract a Tutor-to-Student note encoded with `[TUTOR_STUDENT_NOTE|<classLabel>|<tutorName>]`.
 */
export const parseTutorStudentNote = (
  details?: string | null
): { classLabel?: string; tutorName?: string; note: string } | null => {
  if (!details || !details.startsWith(TUTOR_STUDENT_NOTE_PREFIX)) return null;
  const closeIdx = details.indexOf(']');
  if (closeIdx === -1) return null;
  const header = details.slice(TUTOR_STUDENT_NOTE_PREFIX.length, closeIdx);
  const parts = header.split('|').map((s) => s.trim());
  const classLabel = parts[1] || undefined;
  const tutorName = parts[2] || undefined;
  const note = details.slice(closeIdx + 1).trim();
  return note ? { classLabel, tutorName, note } : null;
};

/**
 * Format a Tutor-to-Student note with class and tutor attribution for storage in `ApiAcademicRisk.details`.
 */
export const formatTutorStudentNote = (
  note: string,
  classLabel?: string | null,
  tutorName?: string | null
): string => {
  const safeClass = sanitizeTagSegment(classLabel);
  const safeTutor = sanitizeTagSegment(tutorName);
  if (safeClass || safeTutor) {
    return `[TUTOR_STUDENT_NOTE|${safeClass}|${safeTutor}] ${note.trim()}`;
  }
  return note.trim();
};

/**
 * Parse any `AcademicRisk` entry into a normalized note classification, class/tutor metadata, and clean display text.
 */
export const parseAcademicRiskNote = (risk: AcademicRisk): ParsedAcademicRiskNote | null => {
  const rawDetails = (risk.details || '').trim();
  if (!rawDetails) return null;

  const principalTutor = parsePrincipalTutorNote(rawDetails);
  if (principalTutor) {
    return {
      kind: 'principal_tutor',
      tutorId: principalTutor.tutorId,
      classLabel: principalTutor.classLabel,
      principalName: principalTutor.principalName,
      authorLabel: 'Principal Note (Tutor Advisory)',
      note: principalTutor.note,
      risk,
    };
  }

  const principalStudent = parsePrincipalStudentNote(rawDetails);
  if (principalStudent) {
    return {
      kind: 'principal_student',
      classLabel: principalStudent.classLabel,
      tutorName: principalStudent.tutorName,
      authorLabel: 'Principal Note',
      note: principalStudent.note,
      risk,
    };
  }

  const tutorStudent = parseTutorStudentNote(rawDetails);
  if (tutorStudent) {
    return {
      kind: 'tutor_student',
      classLabel: tutorStudent.classLabel,
      tutorName: tutorStudent.tutorName,
      authorLabel: 'Tutor Note',
      note: tutorStudent.note,
      risk,
    };
  }

  return {
    kind: 'tutor_student',
    authorLabel: 'Tutor Note',
    note: rawDetails,
    risk,
  };
};
