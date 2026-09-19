import type { Attendance, Grade, User } from '../types';

export interface StudentRiskRow {
  student: User;
  attendanceRate: number;
  scoreAvg: number;
  compositeScore: number;
  riskTier: string;
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

  const studentIds = new Set(safeStudents.map((student) => student.id));

  const scoreTotals = safeGrades
    .filter(
      (grade: Grade) => grade.component_type !== 'attendance' && studentIds.has(grade.student)
    )
    .reduce((acc: Map<string, { totalPercent: number; count: number }>, grade: Grade) => {
      const existing = acc.get(grade.student) ?? { totalPercent: 0, count: 0 };
      const scoreValue = Number(grade.score);
      const totalValue = Number(grade.total_score || 100);
      const percent = totalValue > 0 ? (scoreValue / totalValue) * 100 : 0;
      existing.totalPercent += percent;
      existing.count += 1;
      acc.set(grade.student, existing);
      return acc;
    }, new Map<string, { totalPercent: number; count: number }>());

  const attendanceByStudent = safeAtt.reduce(
    (acc: Map<string, Attendance[]>, attendance: Attendance) => {
      if (!studentIds.has(attendance.user)) return acc;
      const list = acc.get(attendance.user) ?? [];
      list.push(attendance);
      acc.set(attendance.user, list);
      return acc;
    },
    new Map<string, Attendance[]>()
  );

  return safeStudents.map((student: User) => {
    const attendanceRecords = attendanceByStudent.get(student.id) ?? [];
    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter((record: Attendance) => record.status === 'present').length;
    const attendanceRate = totalDays > 0 ? Number(((presentDays / totalDays) * 100).toFixed(2)) : 100;

    const scoreData = scoreTotals.get(student.id);
    const scoreAvg = scoreData?.count ? Number((scoreData.totalPercent / scoreData.count).toFixed(2)) : 100;

    const compositeScore = Number(((attendanceRate * 0.4) + (scoreAvg * 0.6)).toFixed(2));
    const riskTier = getRiskTier(compositeScore);

    return {
      student,
      attendanceRate,
      scoreAvg,
      compositeScore,
      riskTier,
    };
  });
};
