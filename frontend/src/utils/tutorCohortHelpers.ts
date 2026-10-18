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
      const sLevel = (student.aral_level || 'basic').toLowerCase().trim();
      const hasLanguage = studentSubjects.some((sub) => {
        if (targetSub === 'filipino') {
          return sub === 'filipino' || sub === 'tagalog' || (sub === 'reading' && sLevel === 'basic');
        }
        if (targetSub === 'english') {
          return sub === 'english' || (sub === 'reading' && sLevel === 'plus');
        }
        return sub === targetSub;
      });
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
      stateRef.current = { ...stateRef.current, aral_level: level };
      persistAndBroadcast(stateRef.current);
    },
    [persistAndBroadcast]
  );

  const setSelectedSubject = useCallback(
    (subject: string) => {
      setSelectedSubjectState(subject);
      stateRef.current = { ...stateRef.current, subject };
      persistAndBroadcast(stateRef.current);
    },
    [persistAndBroadcast]
  );

  const setSelectedCohort = useCallback(
    (cohort: string) => {
      setSelectedCohortState(cohort);
      stateRef.current = { ...stateRef.current, cohort };
      persistAndBroadcast(stateRef.current);
    },
    [persistAndBroadcast]
  );

  const setSelectedCohortFilter = useCallback(
    (nextState: { aral_level: 'all' | 'basic' | 'plus'; subject: string; cohort: string }) => {
      setSelectedAralLevelState(nextState.aral_level);
      setSelectedSubjectState(nextState.subject);
      setSelectedCohortState(nextState.cohort);
      stateRef.current = { ...nextState };
      persistAndBroadcast(nextState);
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
    setSelectedCohortFilter,
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
 * Returns available classes (e.g. ['GRADE 7 - HYACINTH', 'GRADE 8 - MANGO']) for chart filtering,
 * adjusted for tutor, sorted logically by numeric grade first then section.
 */
export function getChartAvailableClasses(
  tutor: Partial<User> | null | undefined,
  allStudents: User[]
): string[] {
  const classesSet = new Set<string>();

  const addClass = (grade: string, section: string) => {
    let cleanG = grade ? grade.trim().toUpperCase() : '';
    let cleanS = section ? section.trim().toUpperCase() : '';
    if (cleanG && !cleanG.startsWith('GRADE')) {
      const num = cleanG.replace(/[^0-9]/g, '');
      if (num) cleanG = `GRADE ${num}`;
    }
    if (cleanG && cleanS) {
      classesSet.add(`${cleanG} - ${cleanS}`);
    } else if (cleanG) {
      classesSet.add(cleanG);
    } else if (cleanS) {
      classesSet.add(cleanS);
    }
  };

  if (!tutor) {
    allStudents.forEach((s) => {
      const { grade, section } = parseStudentGradeAndSection(s);
      addClass(grade, section);
    });
  } else {
    const cohorts = parseTutorHandledCohorts(tutor);
    cohorts.forEach((c) => {
      if (c.includes(' - ')) {
        const [g, sec] = c.split(' - ').map((p) => p.trim().toUpperCase());
        addClass(g, sec);
      } else {
        const trimmed = c.trim().toUpperCase();
        if (trimmed) classesSet.add(trimmed);
      }
    });

    allStudents.forEach((s) => {
      if (String(s.assigned_tutor) === String(tutor.id)) {
        const { grade, section } = parseStudentGradeAndSection(s);
        addClass(grade, section);
      }
    });
  }

  return Array.from(classesSet).sort((a, b) => {
    const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
    if (numA !== numB) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });
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
    grade?: string;
    section?: string;
    classCohort?: string;
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
  if (filters.grade && filters.grade !== 'all') {
    if (grade !== filters.grade) return false;
  }

  if (filters.section && filters.section !== 'all') {
    if (section !== filters.section) return false;
  }

  if (filters.classCohort && filters.classCohort !== 'all') {
    const targetCohort = filters.classCohort.toUpperCase().trim();
    if (targetCohort.includes(' - ')) {
      const [tGrade, tSec] = targetCohort.split(' - ').map((p) => p.trim());
      const sGradeNum = grade.replace(/[^0-9]/g, '');
      const tGradeNum = tGrade.replace(/[^0-9]/g, '');
      if (tGradeNum && sGradeNum && tGradeNum !== sGradeNum) {
        return false;
      }
      if (tSec && section !== tSec) {
        return false;
      }
    } else {
      const targetGradeNum = targetCohort.replace(/[^0-9]/g, '');
      const sGradeNum = grade.replace(/[^0-9]/g, '');
      if (targetCohort.startsWith('GRADE') || /^\d+$/.test(targetCohort)) {
        if (targetGradeNum && sGradeNum && targetGradeNum !== sGradeNum) {
          return false;
        }
      } else {
        if (section !== targetCohort) {
          return false;
        }
      }
    }
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
    const sec = validSections[0] || 'HYACINTH';
    const entry = `${g.gradeLevel} - ${sec}`;
    cohortEntries.push(entry);
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
  if (subjectsList.length === 0) subjectsList.push('Filipino');

  const rawGradeLevel = (user.grade_level || '').trim();
  const rawSection = (user.section || '').trim().toUpperCase();

  const groupSubjects = handlesBasic
    ? (subjectsList.includes('Filipino') ? ['Filipino'] : [subjectsList[0] || 'Filipino'])
    : (subjectsList.includes('English') ? ['English'] : [subjectsList[0] || 'English']);
  if (subjectsList.includes('Science') && !groupSubjects.includes('Science')) groupSubjects.push('Science');
  if (subjectsList.includes('Math') && !groupSubjects.includes('Math')) groupSubjects.push('Math');

  if (!rawGradeLevel) {
    if (handlesBasic && handlesPlus) {
      return [
        {
          id: 'rd-basic-1',
          aralLevel: 'basic',
          subjects: ['Filipino'],
          gradeLevel: 'GRADE 7',
          sections: [rawSection || 'HYACINTH'],
        },
        {
          id: 'rd-plus-2',
          aralLevel: 'plus',
          subjects: subjectsList.includes('English') ? ['English'] : ['Filipino'],
          gradeLevel: 'GRADE 7',
          sections: [rawSection || 'HYACINTH'],
        },
      ];
    }
    return [
      {
        id: Math.random().toString(36).substring(2, 9),
        aralLevel: handlesBasic ? 'basic' : 'plus',
        subjects: groupSubjects,
        gradeLevel: 'GRADE 7',
        sections: [rawSection || 'HYACINTH'],
      },
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
    parsedCohorts.push({ grade: 'GRADE 7', section: rawSection || 'HYACINTH' });
  }

  const rawSectionChunks = rawSection ? rawSection.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
  parsedCohorts.forEach((c, idx) => {
    if (!c.section) {
      if (rawSectionChunks.length > idx) {
        c.section = rawSectionChunks[idx];
      } else if (rawSectionChunks.length > 0) {
        c.section = rawSectionChunks[0];
      } else {
        c.section = 'HYACINTH';
      }
    }
  });

  // If tutor handles both Basic & Plus and only 1 cohort is listed, they handle 2 distinct role details
  if (handlesBasic && handlesPlus && parsedCohorts.length === 1) {
    const cohort = parsedCohorts[0];
    const sec = cohort.section || rawSection || 'HYACINTH';
    const subjBasic = subjectsList.includes('Filipino') ? 'Filipino' : (subjectsList[0] || 'Filipino');
    const subjPlus = subjectsList.includes('English') ? 'English' : (subjectsList[0] || 'Filipino');

    return [
      {
        id: 'rd-basic-1',
        aralLevel: 'basic',
        subjects: [subjBasic],
        gradeLevel: cohort.grade || 'GRADE 7',
        sections: [sec],
      },
      {
        id: 'rd-plus-2',
        aralLevel: 'plus',
        subjects: [subjPlus],
        gradeLevel: cohort.grade || 'GRADE 7',
        sections: [sec],
      },
    ];
  }

  return parsedCohorts.map((cohort, index) => {
    let groupLevel: 'basic' | 'plus' = 'basic';
    if (handlesBasic && handlesPlus) {
      groupLevel = index % 2 === 0 ? 'basic' : 'plus';
    } else if (handlesPlus) {
      groupLevel = 'plus';
    }

    const itemSubjects = groupLevel === 'basic'
      ? (subjectsList.includes('Filipino') ? ['Filipino'] : [subjectsList[0] || 'Filipino'])
      : (subjectsList.includes('English') ? ['English'] : [subjectsList[0] || 'English']);

    if (subjectsList.includes('Science') && !itemSubjects.includes('Science')) itemSubjects.push('Science');
    if (subjectsList.includes('Math') && !itemSubjects.includes('Math')) itemSubjects.push('Math');

    return {
      id: Math.random().toString(36).substring(2, 9),
      aralLevel: groupLevel,
      subjects: itemSubjects,
      gradeLevel: cohort.grade || 'GRADE 7',
      sections: cohort.section ? [cohort.section] : (rawSection ? [rawSection] : ['HYACINTH']),
    };
  });
}

export interface TutorHandledClassSection<T> {
  key: string;
  label: string;
  aralLevel: 'basic' | 'plus';
  subject: string;
  gradeLevel: string;
  section: string;
  cohort: string;
  students: T[];
}

export function buildTutorClassSections<T = any>(
  tutor: Partial<User> | null | undefined,
  allTutorStudents: T[]
): TutorHandledClassSection<T>[] {
  if (!tutor) return [];
  const groups = parseTutorRoleDetailsFromUser(tutor);

  const classes: TutorHandledClassSection<T>[] = [];

  groups.forEach((g, gIdx) => {
    const subj = g.subjects[0] || (g.aralLevel === 'basic' ? 'Filipino' : 'English');
    const sec = (g.sections[0] || tutor.section || 'HYACINTH').toUpperCase().trim();
    let cleanGrade = (g.gradeLevel || 'GRADE 7').toUpperCase().trim();
    let cleanSec = sec;

    if (!cleanSec && cleanGrade.includes(' - ')) {
      const parts = cleanGrade.split(' - ');
      cleanGrade = parts[0].trim();
      cleanSec = parts[1].trim();
    }
    if (!cleanSec) cleanSec = 'HYACINTH';

    const cohortStr = `${cleanGrade} - ${cleanSec}`;
    const aralLabel = g.aralLevel.toUpperCase();
    const subjectLabel = subj.toUpperCase();
    const label = `${aralLabel} • ${subjectLabel} • ${cohortStr}`;
    const key = `${g.aralLevel}-${subj}-${cohortStr}-${gIdx}`.toLowerCase();

    classes.push({
      key,
      label,
      aralLevel: g.aralLevel,
      subject: subj,
      gradeLevel: cleanGrade,
      section: cleanSec,
      cohort: cohortStr,
      students: [],
    });
  });

  if (classes.length === 0) {
    const fallbackGrade = (tutor.grade_level || 'GRADE 7').toUpperCase();
    const fallbackSec = (tutor.section || 'HYACINTH').toUpperCase();
    const fallbackAral = (tutor.tutor_type || tutor.aral_level || 'BASIC').toUpperCase();
    const fallbackSubj = (tutor.subject || 'FILIPINO').toUpperCase();
    const cohortStr = `${fallbackGrade} - ${fallbackSec}`;
    classes.push({
      key: 'default',
      label: `${fallbackAral} • ${fallbackSubj} • ${cohortStr}`,
      aralLevel: fallbackAral.toLowerCase().includes('plus') ? 'plus' : 'basic',
      subject: tutor.subject || 'Filipino',
      gradeLevel: fallbackGrade,
      section: fallbackSec,
      cohort: cohortStr,
      students: [],
    });
  }

  // Populate students into their matching role detail / class
  classes.forEach((cls) => {
    cls.students = allTutorStudents.filter((st: any) => {
      const studentObj: Partial<User> | undefined = st?.rawStudent || st?.student || (st?.id ? st : undefined);
      if (!studentObj) return false;
      return isStudentInCohort(studentObj, {
        aral_level: cls.aralLevel,
        subject: cls.subject,
        cohort: cls.cohort,
      });
    });
  });

  // Assign any unmatched students to closest class (strictly NO "OTHER ASSIGNED STUDENTS" option in dropdown)
  const assignedStudentIds = new Set<string>();
  classes.forEach((cls) => {
    cls.students.forEach((s: any) => {
      const id = s?.rawStudent?.id || s?.student?.id || s?.id;
      if (id) assignedStudentIds.add(String(id));
    });
  });

  const unmatched = allTutorStudents.filter((st: any) => {
    const id = st?.rawStudent?.id || st?.student?.id || st?.id;
    return !assignedStudentIds.has(String(id));
  });

  unmatched.forEach((st: any) => {
    const studentObj: Partial<User> | undefined = st?.rawStudent || st?.student || (st?.id ? st : undefined);
    const sLevel = (studentObj?.aral_level || 'basic').toLowerCase().trim();
    const match = classes.find((c) => c.aralLevel === sLevel) || classes[0];
    if (match) {
      match.students.push(st);
    }
  });

  return classes;
}

export interface TutorClassViewTitleOptions {
  user: Partial<User> | null | undefined;
  selectedAralLevel?: string;
  selectedSubject?: string;
  selectedCohort?: string;
}

/**
 * Returns the class label in format: [ARAL LEVEL] • [SUBJECT] • [GRADE LEVEL] - [SECTION]
 * when the filter selection resolves to a specific handled class (auto-adjust to nearest match)
 * or when all filters are explicitly done.
 * Returns null if multiple classes match and filters are not done yet, or if all are set to ALL.
 */
export function getTutorClassViewLabel(options: TutorClassViewTitleOptions): string | null {
  const { user, selectedAralLevel, selectedSubject, selectedCohort } = options;
  if (!user) return null;

  const isAllAral = !selectedAralLevel || selectedAralLevel.toLowerCase() === 'all';
  const isAllSubject = !selectedSubject || selectedSubject.toLowerCase() === 'all';
  const isAllCohort = !selectedCohort || selectedCohort.toLowerCase() === 'all' || selectedCohort.toUpperCase() === 'ALL - ALL';

  // If all filters are set to "ALL", return null so the clean default titles are shown
  if (isAllAral && isAllSubject && isAllCohort) {
    return null;
  }

  // Get all concrete classes handled by the tutor
  const classSections = buildTutorClassSections(user, []);
  if (classSections.length === 0) {
    return null;
  }

  // Extract grade and section from selectedCohort if provided
  let filterGrade = 'ALL';
  let filterSection = 'ALL';
  if (selectedCohort && selectedCohort.includes(' - ')) {
    const [g, s] = selectedCohort.split(' - ').map((p) => p.trim().toUpperCase());
    filterGrade = g;
    filterSection = s;
  } else if (selectedCohort && selectedCohort.toUpperCase() !== 'ALL') {
    filterGrade = selectedCohort.toUpperCase().trim();
  }

  // Filter handled classes by the active filters
  const matchingClasses = classSections.filter((cls) => {
    if (!isAllAral && cls.aralLevel.toLowerCase() !== selectedAralLevel.toLowerCase()) {
      return false;
    }
    if (!isAllSubject) {
      const clsSubj = cls.subject.toLowerCase();
      const selSubj = selectedSubject.toLowerCase();
      if (!clsSubj.includes(selSubj) && !selSubj.includes(clsSubj)) {
        return false;
      }
    }
    if (filterGrade !== 'ALL' && cls.gradeLevel.toUpperCase() !== filterGrade) {
      return false;
    }
    if (filterSection !== 'ALL' && cls.section.toUpperCase() !== filterSection) {
      return false;
    }
    return true;
  });

  // 1. If only 1 class handled by tutor matches (nearest match, e.g. John Doe with 1 class, or filters narrowed down):
  if (matchingClasses.length === 1) {
    return matchingClasses[0].label;
  }

  // 2. If all 4 filters are explicitly completed (none is ALL):
  const isAllFiltersDone = !isAllAral && !isAllSubject && filterGrade !== 'ALL' && filterSection !== 'ALL';
  if (isAllFiltersDone) {
    const aralLabel = selectedAralLevel.toUpperCase();
    const subjectLabel = selectedSubject.toUpperCase();
    const cohortLabel = `${filterGrade} - ${filterSection}`;
    return `${aralLabel} • ${subjectLabel} • ${cohortLabel}`;
  }

  // 3. Otherwise, multiple classes match and filters are not all done yet:
  // Return null so it waits for all filters to be done, avoiding messy titles like "BASIC • ALL SUBJECTS • ALL COHORTS"
  return null;
}


