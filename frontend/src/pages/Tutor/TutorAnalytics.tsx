import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';

const getTierClass = (tier: string) => {
  switch (tier) {
    case 'Low':
      return 'bg-emerald-100 text-emerald-700';
    case 'Medium':
      return 'bg-amber-100 text-amber-700';
    case 'High':
    default:
      return 'bg-rose-100 text-rose-700';
  }
};

export const TutorAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<StudentRiskRow[]>([]);
  const [riskCounts, setRiskCounts] = useState({ high: 0, moderate: 0, low: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      try {
        const [studentsResponse, grades, attendanceLogs] = await Promise.all([
          userService.getUsers({ role: 'student', assigned_tutor: user.id }),
          academicService.getGrades(),
          academicService.getAttendanceHistory(),
        ]);

        const students = studentsResponse.results;
        const analyticsRows = computeStudentRiskRows(students, grades, attendanceLogs);

        const counts = analyticsRows.reduce(
          (acc, row) => {
            if (row.riskTier === 'High') acc.high += 1;
            else if (row.riskTier === 'Medium') acc.moderate += 1;
            else acc.low += 1;
            return acc;
          },
          { high: 0, moderate: 0, low: 0 }
        );

        setRiskCounts(counts);
        setRows(analyticsRows);
      } catch (err: any) {
        console.error(err);
        setError(err?.response?.data?.detail || 'Failed to load analytics data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [user]);

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Student Risk Analytics</h2>
        <p className="mt-2 text-sm text-slate-500">
          Each enrolled student is labeled by composite performance and attendance escalation.
        </p>

      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-700">High Risk</p>
          <p className="mt-3 text-3xl font-semibold text-rose-900">{riskCounts.high}</p>
        </div>
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Medium Risk</p>
          <p className="mt-3 text-3xl font-semibold text-amber-900">{riskCounts.moderate}</p>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Low Risk</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-900">{riskCounts.low}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-500 shadow-sm">Loading analytics...</div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 shadow-sm">{error}</div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Attendance Rate</th>
                <th className="px-4 py-3 font-medium">Score Avg</th>
                <th className="px-4 py-3 font-medium">Composite Score</th>
                <th className="px-4 py-3 font-medium">Risk Tier</th>
                <th className="px-4 py-3 font-medium">Comments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={row.student.id}>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-900">{row.student.full_name}</div>
                    <div className="text-xs text-slate-500">{row.student.username}</div>
                  </td>
                  <td className="px-4 py-4">{row.attendanceRate}%</td>
                  <td className="px-4 py-4">{row.scoreAvg}%</td>
                  <td className="px-4 py-4">{row.compositeScore}%</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTierClass(row.riskTier)}`}>
                      {row.riskTier}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-500">
                    {row.riskTier === 'Low' && row.attendanceRate >= 90 && 'Stable'}
                    {row.riskTier === 'Low' && row.attendanceRate >= 80 && row.attendanceRate < 90 && 'Escalated due to attendance'}
                    {row.riskTier === 'Medium' && row.attendanceRate < 80 && 'High risk forced by attendance'}
                    {row.riskTier === 'Medium' && row.attendanceRate >= 90 && 'Medium risk'}
                    {row.riskTier === 'High' && 'Intervention recommended'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TutorAnalytics;
