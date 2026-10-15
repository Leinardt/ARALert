import type { User } from '../types';

/**
 * Normalizes and extracts the ARAL levels handled by a tutor ('basic', 'plus', or both).
 */
export function parseTutorHandledAralLevels(tutor: Partial<User> | null | undefined): ('basic' | 'plus')[] {
  if (!tutor) return ['basic'];
  const rawLevel = (tutor.aral_level || '').toLowerCase();
  const rawType = (tutor.tutor_type || '').toLowerCase();

  const handlesBasic =
    rawLevel.includes('basic') ||
    rawType.includes('basic') ||
    rawType === 'basic_plus' ||
    (!rawLevel && !rawType);

  const handlesPlus =
    rawLevel.includes('plus') ||
    rawType.includes('plus') ||
    rawType === 'basic_plus';

  if (handlesBasic && handlesPlus) {
    return ['basic', 'plus'];
  }
  if (handlesPlus) {
    return ['plus'];
  }
  return ['basic'];
}

export interface TutorSubjectOption {
  id: string; // 'Filipino' | 'English' | 'Science' | 'Math'
  label: string; // 'FILIPINO' | 'ENGLISH' | 'SCIENCE' | 'MATH'
  dbSubject: string; // 'Reading' | 'English' | 'Science' | 'Math'
}

/**
 * Extracts the subject options handled by a tutor given their assigned subjects
 * and the currently active ARAL level (Filipino for Basic, English for Plus).
 */
export function parseTutorHandledSubjects(
  tutor: Partial<User> | null | undefined,
  activeAralLevel: 'basic' | 'plus'
): TutorSubjectOption[] {
  if (!tutor) {
    return [
      activeAralLevel === 'basic'
        ? { id: 'Filipino', label: 'FILIPINO', dbSubject: 'Reading' }
        : { id: 'English', label: 'ENGLISH', dbSubject: 'English' },
    ];
  }

  const rawSubject = (tutor.subject || '').toLowerCase();
  const isAllOrEmpty = !rawSubject || rawSubject === 'general';

  const handlesLanguage =
    isAllOrEmpty ||
    rawSubject.includes('reading') ||
    rawSubject.includes('english') ||
    rawSubject.includes('filipino');

  const handlesScience = isAllOrEmpty || rawSubject.includes('science');
  const handlesMath = isAllOrEmpty || rawSubject.includes('math');

  const options: TutorSubjectOption[] = [];

  if (handlesLanguage) {
    if (activeAralLevel === 'basic') {
      options.push({ id: 'Filipino', label: 'FILIPINO', dbSubject: 'Reading' });
    } else {
      options.push({ id: 'English', label: 'ENGLISH', dbSubject: 'English' });
    }
  }

  if (handlesScience) {
    options.push({ id: 'Science', label: 'SCIENCE', dbSubject: 'Science' });
  }

  if (handlesMath) {
    options.push({ id: 'Math', label: 'MATH', dbSubject: 'Math' });
  }

  if (options.length === 0) {
    options.push(
      activeAralLevel === 'basic'
        ? { id: 'Filipino', label: 'FILIPINO', dbSubject: 'Reading' }
        : { id: 'English', label: 'ENGLISH', dbSubject: 'English' }
    );
  }

  return options;
}

/**
 * Extracts the grade-section cohort combinations handled by a tutor (e.g. ['GRADE 8 - MANGO', 'GRADE 9 - APPLE']).
 */
export function parseTutorHandledCohorts(tutor: Partial<User> | null | undefined): string[] {
  if (!tutor || !tutor.grade_level) {
    return ['GRADE 7'];
  }

  const raw = tutor.grade_level.trim();
  if (!raw) return ['GRADE 7'];

  const parts = raw
    .split(',')
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);

  return parts.length > 0 ? parts : [raw.toUpperCase()];
}

/**
 * Checks whether a student can be assigned to a tutor.
 * A student may now be assigned to any tutor as long as it matches the grade level,
 * section, and ARAL level the tutor handles.
 */
export function isTutorEligibleForStudent(
  tutor: Partial<User> | null | undefined,
  student: {
    grade?: string | null;
    section?: string | null;
    aral_level?: string | null;
  }
): boolean {
  if (!tutor) return false;

  // 1. ARAL Level Match
  if (student.aral_level) {
    const studentLevel = student.aral_level.toLowerCase().trim();
    const handledLevels = parseTutorHandledAralLevels(tutor);
    if (!handledLevels.includes(studentLevel as 'basic' | 'plus')) {
      return false;
    }
  }

  // 2. Grade Level Match
  const tutorGradeLevelStr = (tutor.grade_level || '').toUpperCase();
  if (student.grade) {
    const cleanStudentGrade = student.grade.toUpperCase().trim();
    // E.g. "GRADE 7" or "7"
    const gradeNum = cleanStudentGrade.replace(/[^0-9]/g, '');
    const hasGradeMatch =
      tutorGradeLevelStr.includes(cleanStudentGrade) ||
      (gradeNum && (tutorGradeLevelStr.includes(`GRADE ${gradeNum}`) || tutorGradeLevelStr.includes(`GR. ${gradeNum}`)));

    if (!hasGradeMatch && tutorGradeLevelStr.length > 0) {
      return false;
    }
  }

  // 3. Section Match
  if (student.section && student.section.trim()) {
    const cleanStudentSection = student.section.toUpperCase().trim();
    // If the tutor handles specific sections, ensure this section is handled
    if (tutorGradeLevelStr.includes(' - ') || tutorGradeLevelStr.includes(',')) {
      // Check if tutor's handled cohort includes this section
      const handledCohorts = parseTutorHandledCohorts(tutor);
      const sectionFoundInCohorts = handledCohorts.some((c) => {
        if (c.includes(' - ')) {
          const [cGrade, cSec] = c.split(' - ').map((s) => s.trim().toUpperCase());
          // If student grade is specified, ensure it matches this specific cohort's grade
          if (student.grade) {
            const cleanStudentGrade = student.grade.toUpperCase().trim();
            const gradeNum = cleanStudentGrade.replace(/[^0-9]/g, '');
            const cGradeNum = cGrade.replace(/[^0-9]/g, '');
            if (gradeNum && cGradeNum && gradeNum !== cGradeNum) {
              return false;
            }
          }
          return cSec === cleanStudentSection;
        }
        return c.includes(cleanStudentSection);
      });

      if (!sectionFoundInCohorts && !tutorGradeLevelStr.includes(cleanStudentSection)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Checks whether a student belongs to a given cohort filter (ARAL level, subject, grade/section).
 */
export function isStudentInCohort(
  student: Partial<User> | null | undefined,
  filter: {
    aral_level?: 'basic' | 'plus';
    subject?: string; // 'Filipino' | 'English' | 'Science' | 'Math'
    cohort?: string; // e.g. 'GRADE 8 - MANGO'
  }
): boolean {
  if (!student) return false;

  // 1. ARAL Level filter
  if (filter.aral_level) {
    const sLevel = (student.aral_level || 'basic').toLowerCase().trim();
    if (sLevel !== filter.aral_level.toLowerCase()) {
      return false;
    }
  }

  // 2. Cohort (Grade - Section) filter
  if (filter.cohort) {
    const sGrade = (student.grade_level || '').toUpperCase().trim();
    const targetCohort = filter.cohort.toUpperCase().trim();

    if (targetCohort.includes(' - ')) {
      const [targetGrade, targetSection] = targetCohort.split(' - ').map((s) => s.trim());
      const sGradeNum = sGrade.replace(/[^0-9]/g, '');
      const targetGradeNum = targetGrade.replace(/[^0-9]/g, '');

      // Check grade match
      if (sGradeNum && targetGradeNum && sGradeNum !== targetGradeNum) {
        return false;
      }

      // Check section match
      if (targetSection && !sGrade.includes(targetSection)) {
        return false;
      }
    } else {
      // Single grade filter
      const targetGradeNum = targetCohort.replace(/[^0-9]/g, '');
      const sGradeNum = sGrade.replace(/[^0-9]/g, '');
      if (sGradeNum && targetGradeNum && sGradeNum !== targetGradeNum) {
        return false;
      }
    }
  }

  // 3. Subject filter
  if (filter.subject && student.subject) {
    const sSub = student.subject.toLowerCase().trim();
    const targetSub = filter.subject.toLowerCase().trim();

    const isLanguageTarget = targetSub === 'filipino' || targetSub === 'english' || targetSub === 'reading';
    const isLanguageStudent = sSub === 'reading' || sSub === 'filipino' || sSub === 'english';

    if (isLanguageTarget) {
      if (!isLanguageStudent) return false;
    } else {
      if (sSub !== targetSub) return false;
    }
  }

  return true;
}
