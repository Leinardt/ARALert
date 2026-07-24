export interface PerformanceTrendPoint {
  label: string;
  value: number;
}

// Stubbed out — performance trend feature disabled for now.
// Returning an empty array makes TutorHome.tsx render its existing
// "No grade history available yet" empty state instead of a chart.
export const buildPerformanceTrend = (
  _studentIds: (string | number)[],
  _grades: unknown[],
  _attendanceLogs: unknown[]
): PerformanceTrendPoint[] => {
  return [];
};