import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
    return ['GRADE 7 - HYACINTH'];
  }

  const raw = tutor.grade_level.trim();
  if (!raw) return ['GRADE 7 - HYACINTH'];

  const parts = raw
    .split(',')
    .map((p) => {
      const trimmed = p.trim().toUpperCase();
      if (trimmed === 'GRADE 7' || trimmed === '7') {
        return 'GRADE 7 - HYACINTH';
      }
      if (trimmed === 'GRADE 8' || trimmed === '8') {
        return 'GRADE 8 - MANGO';
      }
      return trimmed;
    })
    .filter(Boolean);

  // Sort alphabetically so default is alphabetical
  parts.sort((a, b) => a.localeCompare(b));

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
      const sSec = ((student as any).section || '').toUpperCase().trim();
      if (
        targetSection &&
        targetSection !== 'ALL' &&
        !sGrade.includes(targetSection) &&
        sSec !== targetSection
      ) {
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
    const studentSubjects = sSub.split(',').map((s) => s.trim());

    if (isLanguageTarget) {
      const hasLanguage = studentSubjects.some(
        (sub) => sub === 'reading' || sub === 'filipino' || sub === 'english'
      );
      if (!hasLanguage) return false;
    } else {
      if (!studentSubjects.includes(targetSub)) return false;
    }
  }

  return true;
}

/**
 * Shared hook that keeps the active tutor cohort filter state (ARAL level, subject, cohort)
 * synchronized across all tutor views (QR attendance, score entry, assigned students).
 * 
 * - Persists active selection to localStorage keyed by user.id
 * - Synchronizes in real-time across mounted components and browser tabs
 * - Validates cached selection against the tutor's currently assigned cohorts/subjects
 */
export function useTutorCohortFilter(user: Partial<User> | null | undefined) {
  const userId = user?.id ? String(user.id) : 'default';
  const storageKey = `aralert_active_tutor_cohort_${userId}`;

  // Helper to compute a validated initial state
  const getInitialState = useCallback(() => {
    const availableLevels = parseTutorHandledAralLevels(user);
    const defaultLevel = availableLevels[0] || 'basic';
    const availableSubjects = parseTutorHandledSubjects(user, defaultLevel);
    const defaultSubject = availableSubjects[0]?.id || 'Filipino';
    const availableCohorts = parseTutorHandledCohorts(user);
    const defaultCohort = availableCohorts[0] || 'GRADE 7 - HYACINTH';

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const level: 'basic' | 'plus' =
          parsed.aral_level && availableLevels.includes(parsed.aral_level)
            ? parsed.aral_level
            : defaultLevel;

        const subjectsForLevel = parseTutorHandledSubjects(user, level);
        const subject =
          parsed.subject && subjectsForLevel.some((s) => s.id.toLowerCase() === parsed.subject.toLowerCase())
            ? (subjectsForLevel.find((s) => s.id.toLowerCase() === parsed.subject.toLowerCase())?.id || parsed.subject)
            : subjectsForLevel[0]?.id || defaultSubject;

        const cohort =
          parsed.cohort && availableCohorts.some((c) => c.toUpperCase().trim() === parsed.cohort.toUpperCase().trim())
            ? parsed.cohort
            : defaultCohort;

        return { level, subject, cohort };
      }
    } catch {
      // Fallback on storage errors
    }

    return { level: defaultLevel, subject: defaultSubject, cohort: defaultCohort };
  }, [user, storageKey]);

  const initial = useMemo(getInitialState, [getInitialState]);

  const [selectedAralLevel, setSelectedAralLevelState] = useState<'basic' | 'plus'>(initial.level);
  const [selectedSubject, setSelectedSubjectState] = useState<string>(initial.subject);
  const [selectedCohort, setSelectedCohortState] = useState<string>(initial.cohort);

  // Keep a ref to the latest state for atomic persistence and avoid stale closures
  const stateRef = useRef({
    aral_level: selectedAralLevel,
    subject: selectedSubject,
    cohort: selectedCohort,
  });

  useEffect(() => {
    stateRef.current = {
      aral_level: selectedAralLevel,
      subject: selectedSubject,
      cohort: selectedCohort,
    };
  }, [selectedAralLevel, selectedSubject, selectedCohort]);

  // Re-synchronize when user finishes loading or switches accounts
  useEffect(() => {
    if (!user?.id) return;
    const validated = getInitialState();
    setSelectedAralLevelState(validated.level);
    setSelectedSubjectState(validated.subject);
    setSelectedCohortState(validated.cohort);
  }, [user?.id, getInitialState]);

  // Persist state to storage and notify all listeners
  const persistAndBroadcast = useCallback(
    (newState: { aral_level: 'basic' | 'plus'; subject: string; cohort: string }) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newState));
      } catch {
        // Ignore quota errors
      }
      window.dispatchEvent(
        new CustomEvent('tutor-cohort-filter-change', {
          detail: { ...newState, userId },
        })
      );
    },
    [storageKey, userId]
  );

  const setSelectedAralLevel = useCallback(
    (level: 'basic' | 'plus') => {
      setSelectedAralLevelState(level);
      const next = { ...stateRef.current, aral_level: level };
      persistAndBroadcast(next);
    },
    [persistAndBroadcast]
  );

  const setSelectedSubject = useCallback(
    (subject: string) => {
      setSelectedSubjectState(subject);
      const next = { ...stateRef.current, subject };
      persistAndBroadcast(next);
    },
    [persistAndBroadcast]
  );

  const setSelectedCohort = useCallback(
    (cohort: string) => {
      setSelectedCohortState(cohort);
      const next = { ...stateRef.current, cohort };
      persistAndBroadcast(next);
    },
    [persistAndBroadcast]
  );

  // Synchronize on window custom event and storage event
  useEffect(() => {
    const handleFilterChange = (e: Event) => {
      const customEvent = e as CustomEvent<{
        aral_level?: 'basic' | 'plus';
        subject?: string;
        cohort?: string;
        userId?: string;
      }>;
      if (!customEvent.detail) return;
      if (customEvent.detail.userId && customEvent.detail.userId !== userId) return;

      const { aral_level, subject, cohort } = customEvent.detail;
      if (aral_level && aral_level !== stateRef.current.aral_level) {
        setSelectedAralLevelState(aral_level);
      }
      if (subject && subject !== stateRef.current.subject) {
        setSelectedSubjectState(subject);
      }
      if (cohort && cohort !== stateRef.current.cohort) {
        setSelectedCohortState(cohort);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.aral_level && parsed.aral_level !== stateRef.current.aral_level) {
            setSelectedAralLevelState(parsed.aral_level);
          }
          if (parsed.subject && parsed.subject !== stateRef.current.subject) {
            setSelectedSubjectState(parsed.subject);
          }
          if (parsed.cohort && parsed.cohort !== stateRef.current.cohort) {
            setSelectedCohortState(parsed.cohort);
          }
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener('tutor-cohort-filter-change', handleFilterChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('tutor-cohort-filter-change', handleFilterChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [storageKey, userId]);

  return {
    selectedAralLevel,
    setSelectedAralLevel,
    selectedSubject,
    setSelectedSubject,
    selectedCohort,
    setSelectedCohort,
  };
}

