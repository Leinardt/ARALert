export interface PerformanceTrendPoint {
  label: string;
  value: number;
}

const ATTENDANCE_VALUE = {
  present: 100,
  late: 70,
  absent: 0,
} as const;

type AttendanceStatus = keyof typeof ATTENDANCE_VALUE;

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatTrendLabel(dateKey: string): string {
  const date = new Date(dateKey);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const buildPerformanceTrend = (
  studentIds: (string | number)[],
  grades: unknown[],
  attendanceLogs: unknown[]
): PerformanceTrendPoint[] => {
  const studentIdSet = new Set(studentIds.map((id) => String(id)));
  const safeGrades = Array.isArray(grades) ? grades as any[] : [];
  const safeLogs = Array.isArray(attendanceLogs) ? attendanceLogs as any[] : [];

  const dateStats: Record<string, {
    gradeTotal: number;
    gradeCount: number;
    attendanceTotal: number;
    attendanceCount: number;
  }> = {};

  for (const grade of safeGrades) {
    if (!grade || typeof grade !== 'object') continue;
    const studentId = String((grade as any).student ?? '');
    if (!studentIdSet.has(studentId)) continue;
    const componentType = (grade as any).component_type as string | undefined;
    if (componentType === 'attendance') continue;
    const score = Number((grade as any).score);
    if (Number.isNaN(score)) continue;
    const dateKey = toDateKey((grade as any).date_logged);
    if (!dateKey) continue;

    const entry = dateStats[dateKey] ?? {
      gradeTotal: 0,
      gradeCount: 0,
      attendanceTotal: 0,
      attendanceCount: 0,
    };

    entry.gradeTotal += score;
    entry.gradeCount += 1;
    dateStats[dateKey] = entry;
  }

  for (const log of safeLogs) {
    if (!log || typeof log !== 'object') continue;
    const studentId = String((log as any).user ?? '');
    if (!studentIdSet.has(studentId)) continue;
    const status = (log as any).status as AttendanceStatus | undefined;
    if (!status || !(status in ATTENDANCE_VALUE)) continue;
    const dateKey = toDateKey((log as any).date);
    if (!dateKey) continue;

    const entry = dateStats[dateKey] ?? {
      gradeTotal: 0,
      gradeCount: 0,
      attendanceTotal: 0,
      attendanceCount: 0,
    };

    entry.attendanceTotal += ATTENDANCE_VALUE[status];
    entry.attendanceCount += 1;
    dateStats[dateKey] = entry;
  }

  return Object.entries(dateStats)
    .map(([dateKey, stats]) => {
      const scoreValue = stats.gradeCount > 0 ? stats.gradeTotal / stats.gradeCount : null;
      const attendanceValue = stats.attendanceCount > 0 ? stats.attendanceTotal / stats.attendanceCount : null;
      if (scoreValue === null && attendanceValue === null) return null;

      const combinedValue = scoreValue !== null && attendanceValue !== null
        ? scoreValue * 0.65 + attendanceValue * 0.35
        : scoreValue !== null
        ? scoreValue
        : attendanceValue ?? 0;

      return {
        label: formatTrendLabel(dateKey),
        value: Math.round(Math.min(Math.max(combinedValue, 0), 100)),
        dateKey,
      };
    })
    .filter((point): point is { label: string; value: number; dateKey: string } => point !== null)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map(({ label, value }) => ({ label, value }));
};