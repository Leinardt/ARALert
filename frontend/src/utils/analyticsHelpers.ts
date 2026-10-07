import type { Attendance, Grade, User } from '../types';

export interface StudentRiskRow {
  student: User;
  attendanceRate: number;
  scoreAvg: number;
  compositeScore: number;
  riskTier: string;
  presentDays: number;
  totalDays: number;
  scoreCount: number;
  totalScorePercent: number;
  neededPresentAttendance: number;
  neededPassedScores: number;
  pointsToRecover: number;
}

export const getRiskTier = (score: number) => {
  if (score >= 86) return 'Low';
  if (score >= 70) return 'Medium';
  return 'High';
};

export const getRiskAvatarClass = (riskTier?: string | null): string => {
  switch (riskTier?.toLowerCase()) {
    case 'high':
      return 'risk-avatar-high';
    case 'medium':
    case 'moderate':
      return 'risk-avatar-medium';
    case 'low':
    default:
      return 'risk-avatar-low';
  }
};

export const getRiskBadgeClass = (riskTier?: string | null): string => {
  switch (riskTier?.toLowerCase()) {
    case 'high':
      return 'risk-badge-high';
    case 'medium':
    case 'moderate':
      return 'risk-badge-medium';
    case 'low':
    default:
      return 'risk-badge-low';
  }
};

export const getRiskCardClass = (riskTier?: string | null): string => {
  switch (riskTier?.toLowerCase()) {
    case 'high':
      return 'risk-card-high';
    case 'medium':
    case 'moderate':
      return 'risk-card-medium';
    case 'low':
    default:
      return 'risk-card-low';
  }
};

export const getRiskColorHex = (riskTier?: string | null): string => {
  switch (riskTier?.toLowerCase()) {
    case 'high':
      return '#EF4444';
    case 'medium':
    case 'moderate':
      return '#F59E0B';
    case 'low':
    default:
      return '#22C55E';
  }
};

const toArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && Array.isArray((value as any).results)) {
    return (value as any).results as T[];
  }
  return [];
};

export const computeStudentRiskRows = (
  students: User[],
  grades: Grade[],
  attendanceLogs: Attendance[]
): StudentRiskRow[] => {
  // Defensive: always work with arrays regardless of what callers pass in
  const safeStudents: User[] = toArray<User>(students);
  const safeGrades: Grade[] = toArray<Grade>(grades);
  const safeAtt: Attendance[] = toArray<Attendance>(attendanceLogs);

  const studentIds = new Set(safeStudents.map((student) => String(student.id)));

  const getLogUserId = (log: any): string => {
    if (!log) return '';
    if (typeof log.user === 'object' && log.user !== null) return String(log.user.id ?? log.user.pk ?? log.user.user_id ?? '');
    if (typeof log.student === 'object' && log.student !== null) return String(log.student.id ?? log.student.pk ?? log.student.user_id ?? '');
    return String(log.user ?? log.student ?? log.user_id ?? '');
  };

  const getGradeStudentId = (grade: any): string => {
    if (!grade) return '';
    if (typeof grade.student === 'object' && grade.student !== null) return String(grade.student.id ?? grade.student.pk ?? grade.student.user_id ?? '');
    return String(grade.student ?? grade.student_id ?? '');
  };

  const isAttended = (status?: string | null): boolean => {
    if (!status) return false;
    const s = String(status).trim().toLowerCase();
    return s === 'present' || s === 'p' || s === 'late';
  };

  const scoreTotals = safeGrades
    .filter(
      (grade: Grade) => grade.component_type !== 'attendance' && studentIds.has(getGradeStudentId(grade))
    )
    .reduce((acc: Map<string, { totalPercent: number; count: number }>, grade: Grade) => {
      const sid = getGradeStudentId(grade);
      const existing = acc.get(sid) ?? { totalPercent: 0, count: 0 };
      const scoreValue = Number(grade.score);
      const totalValue = Number(grade.total_score || 100);
      const percent = totalValue > 0 ? (scoreValue / totalValue) * 100 : 0;
      existing.totalPercent += percent;
      existing.count += 1;
      acc.set(sid, existing);
      return acc;
    }, new Map<string, { totalPercent: number; count: number }>());

  const attendanceByStudent = safeAtt.reduce(
    (acc: Map<string, Attendance[]>, attendance: Attendance) => {
      const uid = getLogUserId(attendance);
      if (!studentIds.has(uid)) return acc;
      const list = acc.get(uid) ?? [];
      list.push(attendance);
      acc.set(uid, list);
      return acc;
    },
    new Map<string, Attendance[]>()
  );

  return safeStudents.map((student: User) => {
    const studentIdStr = String(student.id);
    const attendanceRecords = attendanceByStudent.get(studentIdStr) ?? [];
    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter((record: Attendance) => isAttended(record.status)).length;
    const attendanceRate = totalDays > 0 ? Number(((presentDays / totalDays) * 100).toFixed(2)) : 100;

    const scoreData = scoreTotals.get(studentIdStr);
    const scoreCount = scoreData?.count || 0;
    const totalScorePercent = scoreData?.totalPercent || 0;
    const scoreAvg = scoreCount > 0 ? Number((totalScorePercent / scoreCount).toFixed(2)) : 100;

    const compositeScore = Number(((attendanceRate * 0.4) + (scoreAvg * 0.6)).toFixed(2));
    const riskTier = getRiskTier(compositeScore);

    // Number of consecutive present sessions needed to reach >= 75% attendance rate
    const neededPresentAttendance = totalDays > 0 && attendanceRate < 75
      ? Math.max(0, Math.ceil((0.75 * totalDays - presentDays) / 0.25))
      : 0;

    // Number of passed scores (assuming 100% or passing score mastery) needed to raise score average to >= 75%
    const neededPassedScores = scoreCount > 0 && scoreAvg < 75
      ? Math.max(0, Math.ceil((75 * scoreCount - totalScorePercent) / 25))
      : 0;

    const pointsToRecover = Math.max(0, Number((70 - compositeScore).toFixed(1)));

    return {
      student,
      attendanceRate,
      scoreAvg,
      compositeScore,
      riskTier,
      presentDays,
      totalDays,
      scoreCount,
      totalScorePercent,
      neededPresentAttendance,
      neededPassedScores,
      pointsToRecover,
    };
  });
};
