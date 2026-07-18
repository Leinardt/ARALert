import type { Attendance, Grade, User } from '../types';

export interface StudentRiskRow {
  student: User;
  attendanceRate: number;
  scoreAvg: number;
  compositeScore: number;
  riskTier: string;
}

const getRiskTier = (score: number) => {
  if (score >= 85) return 'Low';
  if (score >= 70) return 'Medium';
  return 'High';
};

const applyAttendanceEscalation = (tier: string, attendanceRate: number) => {
  if (attendanceRate >= 90) return tier;
  if (attendanceRate >= 80) {
    return tier === 'Low' ? 'Medium' : tier;
  }
  if (tier === 'Low') return 'Medium';
  return 'High';
};

export const computeStudentRiskRows = (
  students: User[],
  grades: Grade[],
  attendanceLogs: Attendance[]
): StudentRiskRow[] => {
  const studentIds = new Set(students.map((student) => student.id));

  const scoreTotals = grades
    .filter(
      (grade) => grade.component_type !== 'attendance' && studentIds.has(grade.student)
    )
    .reduce((acc, grade) => {
      const existing = acc.get(grade.student) ?? { totalPercent: 0, count: 0 };
      const scoreValue = Number(grade.score);
      const totalValue = Number(grade.total_score || 100);
      const percent = totalValue > 0 ? (scoreValue / totalValue) * 100 : 0;
      existing.totalPercent += percent;
      existing.count += 1;
      acc.set(grade.student, existing);
      return acc;
    }, new Map<string, { totalPercent: number; count: number }>());

  const attendanceByStudent = attendanceLogs.reduce((acc, attendance) => {
    if (!studentIds.has(attendance.user)) return acc;
    const list = acc.get(attendance.user) ?? [];
    list.push(attendance);
    acc.set(attendance.user, list);
    return acc;
  }, new Map<string, Attendance[]>());

  return students.map((student) => {
    const attendanceRecords = attendanceByStudent.get(student.id) ?? [];
    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter((record) => record.status === 'present').length;
    const lateDays = attendanceRecords.filter((record) => record.status === 'late').length;
    const attendanceRate = totalDays > 0 ? Number(((presentDays + lateDays) / totalDays) * 100) : 100;

    const scoreData = scoreTotals.get(student.id);
    const scoreAvg = scoreData?.count ? Number((scoreData.totalPercent / scoreData.count).toFixed(2)) : 100;

    const compositeScore = Number(((attendanceRate * 0.4) + (scoreAvg * 0.6)).toFixed(2));
    const baseTier = getRiskTier(compositeScore);
    const riskTier = applyAttendanceEscalation(baseTier, attendanceRate);

    return {
      student,
      attendanceRate,
      scoreAvg,
      compositeScore,
      riskTier,
    };
  });
};
