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
    <div className="space-y-6 p-4 sm:p-6">
      

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">High Risk</p>
          </div>
          <p className="mt-4 text-3xl font-bold text-rose-900">{riskCounts.high}</p>
        </div>

        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Medium Risk</p>
          </div>
          <p className="mt-4 text-3xl font-bold text-amber-900">{riskCounts.moderate}</p>
        </div>

        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Low Risk</p>
          </div>
          <p className="mt-4 text-3xl font-bold text-emerald-900">{riskCounts.low}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
          Loading analytics...
        </div>
      ) : error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 shadow-sm">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.04)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">STUDENT</th>
                  <th className="px-4 py-3 font-semibold">ATTENDANCE RATE</th>
                  <th className="px-4 py-3 font-semibold">SCORE AVERAGE</th>
                  <th className="px-4 py-3 font-semibold">COMPOSITE SCORE</th>
                  <th className="px-4 py-3 font-semibold">RISK LEVEL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row) => (
                  <tr key={row.student.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-slate-900">{row.student.full_name}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.student.username}</div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-700">{row.attendanceRate}%</td>
                    <td className="px-4 py-4 align-top text-slate-700">{row.scoreAvg}%</td>
                    <td className="px-4 py-4 align-top text-slate-700">{row.compositeScore}%</td>
                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTierClass(row.riskTier)}`}>
                        {row.riskTier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorAnalytics;
