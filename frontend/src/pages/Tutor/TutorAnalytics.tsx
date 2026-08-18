import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';
import { Search, ArrowUpDown, BarChart2, ShieldAlert, Award, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Attendance } from '../../types';

interface ExtendedRiskRow extends StudentRiskRow {
  absentCount: number;
}

const getTierClass = (tier: string) => {
  switch (tier) {
    case 'Low':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'Medium':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'High':
    default:
      return 'bg-rose-100 text-rose-700 border-rose-200';
  }
};

const getAralBadge = (level?: string | null) => {
  switch (level) {
    case 'plus':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">Plus</span>;
    case 'summer':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Summer</span>;
    case 'graduated':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Graduated 🎓</span>;
    case 'basic':
    default:
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">Basic</span>;
  }
};

export const TutorAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExtendedRiskRow[]>([]);
  const [riskCounts, setRiskCounts] = useState({ high: 0, moderate: 0, low: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof ExtendedRiskRow>('compositeScore');
  const [sortAsc, setSortAsc] = useState(false);

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

      const students = Array.isArray(studentsResponse.results) ? studentsResponse.results : Array.isArray(studentsResponse) ? (studentsResponse as any) : [];
      const safeAttendance = Array.isArray(attendanceLogs) ? attendanceLogs : [];

      const baseRows = computeStudentRiskRows(students, grades, safeAttendance);

      const extendedRows: ExtendedRiskRow[] = baseRows.map((row) => {
        const studentAtt = safeAttendance.filter((a: Attendance) => String(a.user) === String(row.student.id));
        const absentCount = studentAtt.filter((a: Attendance) => a.status === 'absent').length;
        return { ...row, absentCount };
      });

      const counts = extendedRows.reduce(
        (acc, row) => {
          if (row.riskTier === 'High') acc.high += 1;
          else if (row.riskTier === 'Medium') acc.moderate += 1;
          else acc.low += 1;
          return acc;
        },
        { high: 0, moderate: 0, low: 0 }
      );

      setRiskCounts(counts);
      setRows(extendedRows);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Failed to load analytics data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [user]);

  const handleSort = (field: keyof ExtendedRiskRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredAndSortedRows = useMemo(() => {
    return rows
      .filter((r) => {
        const nameMatch = (r.student.full_name || '').toLowerCase().includes(search.toLowerCase());
        const lrnMatch = (r.student.lrn || '').includes(search);
        return nameMatch || lrnMatch;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'student') {
          valA = a.student.full_name;
          valB = b.student.full_name;
        }

        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [rows, search, sortField, sortAsc]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Class Performance</p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">STUDENT DATA ANALYTICS &amp; RISK REPORT</h1>
          <p className="text-xs text-gray-500 mt-1">Calculates composite scores (60% Assessment + 40% Attendance). ARAL levels automatically update when scores are logged.</p>
        </div>
      </div>

      {/* Risk Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">High Risk</p>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-rose-900">{riskCounts.high}</p>
          <p className="text-xs text-rose-600 mt-1">Requires immediate intervention</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Medium Risk</p>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-amber-900">{riskCounts.moderate}</p>
          <p className="text-xs text-amber-600 mt-1">Needs monitoring &amp; support</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Low Risk</p>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-emerald-900">{riskCounts.low}</p>
          <p className="text-xs text-emerald-600 mt-1">Performing satisfactorily</p>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-5">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by student name or LRN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] bg-gray-50"
            />
          </div>
          <span className="text-xs text-gray-400">{filteredAndSortedRows.length} students listed</span>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-gray-400 space-y-2">
            <BarChart2 className="w-8 h-8 mx-auto animate-bounce opacity-30" />
            <p className="text-sm font-semibold">Loading student analytics...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 text-sm shadow-sm">{error}</div>
        ) : filteredAndSortedRows.length === 0 ? (
          <div className="py-12 text-center text-gray-400 space-y-2">
            <p className="text-sm font-semibold">No students found.</p>
            <p className="text-xs">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th onClick={() => handleSort('student')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">STUDENT <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold">ARAL LEVEL</th>
                  <th onClick={() => handleSort('attendanceRate')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">ATTENDANCE RATE <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th onClick={() => handleSort('absentCount')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">ABSENT DAYS <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th onClick={() => handleSort('scoreAvg')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">SCORE AVG <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th onClick={() => handleSort('compositeScore')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">COMPOSITE <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th onClick={() => handleSort('riskTier')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">RISK LEVEL <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredAndSortedRows.map((row) => (
                  <tr key={row.student.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                          {(row.student.full_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{row.student.full_name}</div>
                          <div className="text-xs text-slate-400">LRN: {row.student.lrn || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {getAralBadge(row.student.aral_level)}
                    </td>
                    <td className="px-4 py-3.5 align-middle font-semibold text-slate-700">{row.attendanceRate}%</td>
                    <td className="px-4 py-3.5 align-middle text-slate-700">{row.absentCount} day{row.absentCount !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3.5 align-middle font-semibold text-slate-700">{row.scoreAvg}%</td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 min-w-[42px]">{row.compositeScore}%</span>
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${row.compositeScore >= 75 ? 'bg-emerald-400' : row.compositeScore >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                            style={{ width: `${Math.min(row.compositeScore, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${getTierClass(row.riskTier)}`}>
                        {row.riskTier}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-right">
                      <Link
                        to={`/tutor/students/${row.student.id}`}
                        className="text-xs font-bold text-[var(--brand)] hover:underline"
                      >
                        Profile &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TutorAnalytics;
