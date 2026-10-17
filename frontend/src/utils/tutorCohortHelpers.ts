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
  dbSubject: string; // 'Filipino' | 'English' | 'Science' | 'Math'
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
        ? { id: 'Filipino', label: 'FILIPINO', dbSubject: 'Filipino' }
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
      options.push({ id: 'Filipino', label: 'FILIPINO', dbSubject: 'Filipino' });
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
        ? { id: 'Filipino', label: 'FILIPINO', dbSubject: 'Filipino' }
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
    aral_level?: 'all' | 'basic' | 'plus';
    subject?: string; // 'all' | 'Filipino' | 'English' | 'Science' | 'Math'
    cohort?: string; // e.g. 'all' | 'ALL - ALL' | 'GRADE 8 - MANGO'
  }
): boolean {
  if (!student) return false;

  // 1. ARAL Level filter
  if (filter.aral_level && filter.aral_level.toLowerCase() !== 'all') {
    const sLevel = (student.aral_level || 'basic').toLowerCase().trim();
    if (sLevel !== filter.aral_level.toLowerCase()) {
      return false;
    }
  }

  // 2. Cohort (Grade - Section) filter
  if (filter.cohort) {
    const sGrade = (student.grade_level || '').toUpperCase().trim();
    const targetCohort = filter.cohort.toUpperCase().trim();

    if (targetCohort === 'ALL' || targetCohort === 'ALL - ALL') {
      // Matches all grades and sections
    } else if (targetCohort.includes(' - ')) {
      const [targetGrade, targetSection] = targetCohort.split(' - ').map((s) => s.trim());
      const sGradeNum = sGrade.replace(/[^0-9]/g, '');
      const targetGradeNum = targetGrade.replace(/[^0-9]/g, '');

      // Check grade match if targetGrade is not 'ALL'
      if (targetGrade !== 'ALL' && sGradeNum && targetGradeNum && sGradeNum !== targetGradeNum) {
        return false;
      }

      // Check section match if targetSection is not 'ALL'
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
      // Single grade filter without section
      if (targetCohort !== 'ALL') {
        const targetGradeNum = targetCohort.replace(/[^0-9]/g, '');
        const sGradeNum = sGrade.replace(/[^0-9]/g, '');
        if (sGradeNum && targetGradeNum && sGradeNum !== targetGradeNum) {
          return false;
        }
      }
    }
  }

  // 3. Subject filter
  if (filter.subject && filter.subject.toLowerCase() !== 'all' && student.subject) {
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

export interface UseTutorCohortFilterOptions {
  allowAll?: boolean;
  defaultToAll?: boolean;
}

/**
 * Shared hook that keeps the active tutor cohort filter state (ARAL level, subject, cohort)
 * synchronized across tutor views.
 * 
 * - Persists active selection to localStorage keyed by user.id
 * - Synchronizes in real-time across mounted components and browser tabs
 * - Validates cached selection against the tutor's currently assigned cohorts/subjects
 * - Supports separate overview storage key when allowAll is enabled for Dashboard and Analytics
 */
export function useTutorCohortFilter(
  user: Partial<User> | null | undefined,
  options?: UseTutorCohortFilterOptions
) {
  const allowAll = !!options?.allowAll;
  const defaultToAll = !!options?.defaultToAll;
  const userId = user?.id ? String(user.id) : 'default';
  const storageKey = allowAll
    ? `aralert_active_tutor_overview_cohort_${userId}`
    : `aralert_active_tutor_cohort_${userId}`;

  // Helper to compute a validated initial state
  const getInitialState = useCallback((): {
    level: 'all' | 'basic' | 'plus';
    subject: string;
    cohort: string;
  } => {
    const availableLevels = parseTutorHandledAralLevels(user);
    const defaultLevel: 'all' | 'basic' | 'plus' = defaultToAll ? 'all' : (availableLevels[0] || 'basic');
    const availableSubjects = parseTutorHandledSubjects(user, defaultLevel === 'plus' ? 'plus' : 'basic');
    const defaultSubject = defaultToAll ? 'all' : (availableSubjects[0]?.id || 'Filipino');
    const availableCohorts = parseTutorHandledCohorts(user);
    const defaultCohort = defaultToAll ? 'ALL - ALL' : (availableCohorts[0] || 'GRADE 7 - HYACINTH');

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        let level: 'all' | 'basic' | 'plus' = defaultLevel;
        if (allowAll && parsed.aral_level === 'all') {
          level = 'all';
        } else if (parsed.aral_level && availableLevels.includes(parsed.aral_level)) {
          level = parsed.aral_level;
        }

        const subjectsForLevel = parseTutorHandledSubjects(user, level === 'plus' ? 'plus' : 'basic');
        let subject = defaultSubject;
        if (allowAll && parsed.subject === 'all') {
          subject = 'all';
        } else if (
          parsed.subject &&
          subjectsForLevel.some((s) => s.id.toLowerCase() === parsed.subject.toLowerCase())
        ) {
          subject =
            subjectsForLevel.find((s) => s.id.toLowerCase() === parsed.subject.toLowerCase())?.id ||
            parsed.subject;
        }

        let cohort = defaultCohort;
        if (allowAll && (parsed.cohort === 'ALL' || parsed.cohort === 'ALL - ALL' || parsed.cohort?.includes('ALL'))) {
          cohort = parsed.cohort;
        } else if (
          parsed.cohort &&
          !parsed.cohort.toUpperCase().includes('ALL') &&
          availableCohorts.some((c) => c.toUpperCase().trim() === parsed.cohort.toUpperCase().trim())
        ) {
          cohort = parsed.cohort;
        }

        return { level, subject, cohort };
      }
    } catch {
      // Fallback on storage errors
    }

    return { level: defaultLevel, subject: defaultSubject, cohort: defaultCohort };
  }, [user, storageKey, allowAll, defaultToAll]);

  const initial = useMemo(getInitialState, [getInitialState]);

  const [selectedAralLevel, setSelectedAralLevelState] = useState<'all' | 'basic' | 'plus'>(initial.level);
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
  const eventName = allowAll
    ? 'tutor-cohort-overview-filter-change'
    : 'tutor-cohort-filter-change';

  const persistAndBroadcast = useCallback(
    (newState: { aral_level: 'all' | 'basic' | 'plus'; subject: string; cohort: string }) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newState));
      } catch {
        // Ignore quota errors
      }
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: { ...newState, userId },
        })
      );
    },
    [storageKey, userId, eventName]
  );

  const setSelectedAralLevel = useCallback(
    (level: 'all' | 'basic' | 'plus') => {
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
        aral_level?: 'all' | 'basic' | 'plus';
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

    window.addEventListener(eventName, handleFilterChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(eventName, handleFilterChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [storageKey, userId, eventName]);

  return {
    selectedAralLevel,
    setSelectedAralLevel,
    selectedSubject,
    setSelectedSubject,
    selectedCohort,
    setSelectedCohort,
  };
}

/**
 * Normalizes and extracts student's grade level and section.
 */
export function parseStudentGradeAndSection(
  student: Partial<User> | null | undefined
): { grade: string; section: string } {
  if (!student) return { grade: '', section: '' };
  let grade = '';
  let section = (student.section || '').trim().toUpperCase();
  const rawGrade = (student.grade_level || '').trim().toUpperCase();

  if (rawGrade.includes(' - ')) {
    const parts = rawGrade.split(' - ');
    grade = parts[0]?.trim() || '';
    if (!section && parts[1]) {
      section = parts[1].trim();
    }
  } else if (rawGrade.startsWith('GRADE')) {
    grade = rawGrade;
  } else if (/^\d+$/.test(rawGrade)) {
    grade = `GRADE ${rawGrade}`;
  }

  if (grade && !grade.startsWith('GRADE')) {
    const num = grade.replace(/[^0-9]/g, '');
    if (num) grade = `GRADE ${num}`;
  }

  return { grade, section };
}

/**
 * Returns available ARAL levels for chart filtering.
 */
/**
 * Sorts grade level strings in descending order (e.g. GRADE 12, GRADE 11, ... GRADE 7).
 */
export function sortGradeLevelsDescending(grades: string[]): string[] {
  return [...grades].sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
    if (numB !== numA) return numB - numA;
    return b.localeCompare(a);
  });
}

/**
 * Returns available ARAL levels for chart filtering, sorted alphabetically.
 */
export function getChartAvailableAralLevels(
  tutor: Partial<User> | null | undefined
): { id: string; label: string }[] {
  const allLevels = [
    { id: 'basic', label: 'BASIC' },
    { id: 'plus', label: 'PLUS' },
  ];

  if (!tutor) return allLevels.sort((a, b) => a.label.localeCompare(b.label));

  const handled = parseTutorHandledAralLevels(tutor);
  return allLevels
    .filter((lvl) => handled.includes(lvl.id as 'basic' | 'plus'))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Returns available subjects for chart filtering, adjusted for tutor and ARAL level, sorted alphabetically.
 */
export function getChartAvailableSubjects(
  tutor: Partial<User> | null | undefined,
  activeAralLevel: string
): { id: string; label: string }[] {
  const allChoices = [
    { id: 'English', label: 'ENGLISH' },
    { id: 'Filipino', label: 'FILIPINO' },
    { id: 'Math', label: 'MATH' },
    { id: 'Science', label: 'SCIENCE' },
  ];

  const normLevel = activeAralLevel.toLowerCase().trim();

  let filtered: { id: string; label: string }[] = [];

  if (!tutor) {
    filtered = allChoices.filter((c) => {
      if (normLevel === 'basic' && c.id === 'English') return false;
      if (normLevel === 'plus' && c.id === 'Filipino') return false;
      return true;
    });
  } else {
    const raw = (tutor.subject || '').toLowerCase();
    const isGeneral = !raw || raw === 'general' || raw.includes('all');

    const handlesFilipino = isGeneral || raw.includes('reading') || raw.includes('filipino');
    const handlesEnglish = isGeneral || raw.includes('english');
    const handlesScience = isGeneral || raw.includes('science');
    const handlesMath = isGeneral || raw.includes('math');

    filtered = allChoices.filter((c) => {
      if (c.id === 'English') {
        return handlesEnglish && normLevel !== 'basic';
      }
      if (c.id === 'Filipino') {
        return handlesFilipino && normLevel !== 'plus';
      }
      if (c.id === 'Science') return handlesScience;
      if (c.id === 'Math') return handlesMath;
      return false;
    });
  }

  return filtered.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Returns available grade levels for chart filtering, adjusted for tutor, sorted in descending order.
 */
export function getChartAvailableGrades(
  tutor: Partial<User> | null | undefined,
  allStudents: User[]
): string[] {
  const ALL_GRADES = ['GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'];

  if (!tutor) {
    const present = new Set<string>();
    allStudents.forEach((s) => {
      const { grade } = parseStudentGradeAndSection(s);
      if (grade) present.add(grade);
    });
    const found = ALL_GRADES.filter((g) => present.has(g));
    const list = found.length > 0 ? found : ALL_GRADES;
    return sortGradeLevelsDescending(list);
  }

  const cohorts = parseTutorHandledCohorts(tutor);
  const tutorGrades = new Set<string>();

  cohorts.forEach((c) => {
    if (c.includes(' - ')) {
      const g = c.split(' - ')[0].trim().toUpperCase();
      if (g) tutorGrades.add(g.startsWith('GRADE') ? g : `GRADE ${g}`);
    } else if (c.toUpperCase().startsWith('GRADE')) {
      tutorGrades.add(c.trim().toUpperCase());
    } else if (/^\d+$/.test(c.trim())) {
      tutorGrades.add(`GRADE ${c.trim()}`);
    }
  });

  allStudents.forEach((s) => {
    if (String(s.assigned_tutor) === String(tutor.id)) {
      const { grade } = parseStudentGradeAndSection(s);
      if (grade) tutorGrades.add(grade);
    }
  });

  const matched = ALL_GRADES.filter((g) => tutorGrades.has(g));
  const list = matched.length > 0 ? matched : (tutorGrades.size > 0 ? Array.from(tutorGrades) : ['GRADE 7']);
  return sortGradeLevelsDescending(list);
}

/**
 * Returns available sections for chart filtering, adjusted for tutor and active grade, sorted alphabetically.
 */
export function getChartAvailableSections(
  tutor: Partial<User> | null | undefined,
  activeGrade: string,
  allStudents: User[]
): string[] {
  const sectionsSet = new Set<string>();

  if (!tutor) {
    allStudents.forEach((s) => {
      const { grade, section } = parseStudentGradeAndSection(s);
      if (section && (activeGrade === 'all' || grade === activeGrade)) {
        sectionsSet.add(section);
      }
    });
  } else {
    const cohorts = parseTutorHandledCohorts(tutor);
    cohorts.forEach((c) => {
      if (c.includes(' - ')) {
        const [g, sec] = c.split(' - ').map((p) => p.trim().toUpperCase());
        const normG = g.startsWith('GRADE') ? g : `GRADE ${g}`;
        if (sec && (activeGrade === 'all' || normG === activeGrade)) {
          sectionsSet.add(sec);
        }
      }
    });

    allStudents.forEach((s) => {
      if (String(s.assigned_tutor) === String(tutor.id)) {
        const { grade, section } = parseStudentGradeAndSection(s);
        if (section && (activeGrade === 'all' || grade === activeGrade)) {
          sectionsSet.add(section);
        }
      }
    });
  }

  return Array.from(sectionsSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Checks whether a student matches the selected chart filters.
 */
export function isStudentMatchingChartFilters(
  student: User,
  filters: {
    tutorId: string;
    aralLevel: string;
    subject: string;
    grade: string;
    section: string;
  }
): boolean {
  if (filters.tutorId !== 'all') {
    const assigned = String(student.assigned_tutor ?? '');
    if (assigned !== String(filters.tutorId)) return false;
  }

  if (filters.aralLevel !== 'all') {
    const sLevel = (student.aral_level || '').toLowerCase().trim();
    if (sLevel !== filters.aralLevel.toLowerCase().trim()) return false;
  }

  if (filters.subject !== 'all') {
    const sSub = (student.subject || '').toLowerCase().trim();
    const targetSub = filters.subject.toLowerCase().trim();
    const isLanguageMatch =
      (targetSub === 'reading' && (sSub === 'reading' || sSub === 'filipino')) ||
      (targetSub === 'filipino' && (sSub === 'reading' || sSub === 'filipino'));
    if (!isLanguageMatch && sSub !== targetSub) return false;
  }

  const { grade, section } = parseStudentGradeAndSection(student);
  if (filters.grade !== 'all') {
    if (grade !== filters.grade) return false;
  }

  if (filters.section !== 'all') {
    if (section !== filters.section) return false;
  }

  return true;
}

/**
 * Formats tutor assignment option label compactly:
 * e.g., "JOHN D. DOE [BASIC] [7 - HYACINTH]" or "JOHN D. DOE [BASIC] [PLUS] [7 - HYACINTH, 8 - MANGO]"
 */
export function formatTutorAssignmentOption(tutor: Partial<User>): string {
  const fullName = (tutor.full_name || `${tutor.first_name || ''} ${tutor.last_name || ''}`).trim();

  // 1. ARAL level brackets: e.g. [BASIC], [PLUS], or [BASIC] [PLUS]
  const levels = parseTutorHandledAralLevels(tutor);
  const levelBrackets: string[] = [];
  if (levels.includes('basic')) levelBrackets.push('[BASIC]');
  if (levels.includes('plus')) levelBrackets.push('[PLUS]');
  if (levelBrackets.length === 0) levelBrackets.push('[BASIC]');
  const levelsStr = levelBrackets.join(' ');

  // 2. Handled cohorts (strip "GRADE " so "GRADE 7 - HYACINTH" -> "7 - HYACINTH")
  let cohortText = '';
  if (tutor.grade_level && tutor.grade_level.trim()) {
    cohortText = tutor.grade_level
      .split(',')
      .map((p) => p.trim().replace(/^GRADE\s+/i, ''))
      .filter(Boolean)
      .join(', ');
  } else {
    const parsed = parseTutorHandledCohorts(tutor);
    cohortText = parsed
      .map((p) => p.trim().replace(/^GRADE\s+/i, ''))
      .filter(Boolean)
      .join(', ');
  }

  if (!cohortText) cohortText = 'General';

  return `${fullName} ${levelsStr} [${cohortText}]`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Tutor Role Detail Groups (Connecting ARAL level, Grade, Subject, & Section)
   ────────────────────────────────────────────────────────────────────────── */

export interface TutorRoleDetailGroup {
  id: string;
  aralLevel: 'basic' | 'plus';
  subjects: string[];
  gradeLevel: string;
  sections: string[];
}

export function createDefaultRoleDetail(
  aralLevel: 'basic' | 'plus' = 'basic',
  gradeLevel = 'GRADE 7'
): TutorRoleDetailGroup {
  return {
    id: Math.random().toString(36).substring(2, 9),
    aralLevel,
    subjects: [aralLevel === 'basic' ? 'Filipino' : 'English'],
    gradeLevel,
    sections: [''],
  };
}

export function buildTutorPayloadFromRoleDetails(groups: TutorRoleDetailGroup[]) {
  const hasBasic = groups.some((g) => g.aralLevel === 'basic');
  const hasPlus = groups.some((g) => g.aralLevel === 'plus');
  const aralLevel = hasBasic && hasPlus ? 'basic,plus' : (hasPlus ? 'plus' : 'basic');
  const tutorType = hasBasic && hasPlus ? 'basic_plus' : (hasPlus ? 'plus' : 'basic');

  const subjectSet = new Set<string>();
  groups.forEach((g) => {
    g.subjects.forEach((s) => {
      if (s) subjectSet.add(s);
    });
  });
  if (subjectSet.size === 0) {
    if (hasBasic) subjectSet.add('Filipino');
    if (hasPlus) subjectSet.add('English');
  }
  const subject = Array.from(subjectSet).join(', ');

  const cohortEntries: string[] = [];
  groups.forEach((g) => {
    const validSections = g.sections.map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (validSections.length > 0) {
      validSections.forEach((sec) => {
        const entry = `${g.gradeLevel} - ${sec}`;
        if (!cohortEntries.includes(entry)) {
          cohortEntries.push(entry);
        }
      });
    } else {
      if (!cohortEntries.includes(g.gradeLevel)) {
        cohortEntries.push(g.gradeLevel);
      }
    }
  });

  let combinedGradeLevel = cohortEntries.join(', ');
  if (combinedGradeLevel.length > 98) {
    combinedGradeLevel = combinedGradeLevel.slice(0, 98);
  }

  return {
    aral_level: aralLevel,
    tutor_type: tutorType,
    subject,
    grade_level: combinedGradeLevel,
  };
}

export function parseTutorRoleDetailsFromUser(user: Partial<User> | null | undefined): TutorRoleDetailGroup[] {
  if (!user) return [createDefaultRoleDetail()];

  const rawLevel = (user.aral_level || '').toLowerCase();
  const rawType = (user.tutor_type || '').toLowerCase();
  const handlesBasic = rawLevel.includes('basic') || rawType.includes('basic') || rawType === 'basic_plus' || (!rawLevel && !rawType);
  const handlesPlus = rawLevel.includes('plus') || rawType.includes('plus') || rawType === 'basic_plus';

  const rawSubject = (user.subject || '').toLowerCase();
  const subjectsList: string[] = [];
  if (rawSubject.includes('reading') || rawSubject.includes('filipino')) subjectsList.push('Filipino');
  if (rawSubject.includes('english')) subjectsList.push('English');
  if (rawSubject.includes('science')) subjectsList.push('Science');
  if (rawSubject.includes('math')) subjectsList.push('Math');

  const rawGradeLevel = (user.grade_level || '').trim();
  if (!rawGradeLevel) {
    return [
      createDefaultRoleDetail(
        handlesBasic ? 'basic' : 'plus',
        'GRADE 7'
      ),
    ];
  }

  const parsedCohorts: { grade: string; section: string }[] = [];
  const commaChunks = rawGradeLevel.split(',').map((c) => c.trim()).filter(Boolean);

  commaChunks.forEach((chunk) => {
    if (chunk.includes(' - ')) {
      const parts = chunk.split(' - ').map((p) => p.trim());
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].toUpperCase();
        const gradeMatch = part.match(/GRADE\s*(\d+)/i);
        if (gradeMatch) {
          const gLabel = `GRADE ${gradeMatch[1]}`;
          let sLabel = '';
          if (i + 1 < parts.length && !parts[i + 1].toUpperCase().match(/GRADE\s*(\d+)/i)) {
            sLabel = parts[i + 1].trim().toUpperCase();
            i++;
          }
          parsedCohorts.push({ grade: gLabel, section: sLabel });
        } else if (part) {
          parsedCohorts.push({ grade: 'GRADE 7', section: part });
        }
      }
    } else {
      const part = chunk.toUpperCase();
      const gradeMatch = part.match(/GRADE\s*(\d+)/i);
      if (gradeMatch) {
        parsedCohorts.push({ grade: `GRADE ${gradeMatch[1]}`, section: '' });
      } else if (part) {
        parsedCohorts.push({ grade: 'GRADE 7', section: part });
      }
    }
  });

  if (parsedCohorts.length === 0) {
    return [createDefaultRoleDetail(handlesBasic ? 'basic' : 'plus')];
  }

  return parsedCohorts.map((cohort, index) => {
    let groupLevel: 'basic' | 'plus' = 'basic';
    if (handlesBasic && handlesPlus) {
      groupLevel = index === 0 ? 'basic' : 'plus';
    } else if (handlesPlus) {
      groupLevel = 'plus';
    }

    const groupSubjects = groupLevel === 'basic'
      ? (subjectsList.includes('Filipino') ? ['Filipino'] : ['Filipino'])
      : (subjectsList.includes('English') ? ['English'] : ['English']);

    if (subjectsList.includes('Science') && !groupSubjects.includes('Science')) groupSubjects.push('Science');
    if (subjectsList.includes('Math') && !groupSubjects.includes('Math')) groupSubjects.push('Math');

    return {
      id: Math.random().toString(36).substring(2, 9),
      aralLevel: groupLevel,
      subjects: groupSubjects,
      gradeLevel: cohort.grade || 'GRADE 7',
      sections: cohort.section ? [cohort.section] : [''],
    };
  });
}


