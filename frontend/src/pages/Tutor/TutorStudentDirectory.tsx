import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { User, Grade, Attendance } from '../../types';
import { computeStudentRiskRows, type StudentRiskRow } from '../../utils/analyticsHelpers';
import { ChevronRight, Search, ArrowUpDown, Users } from 'lucide-react';

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

const getRiskTierBadge = (tier: string) => {
  switch (tier) {
    case 'High':
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">High</span>;
    case 'Medium':
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Medium</span>;
    case 'Low':
    default:
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Low</span>;
  }
};

export const TutorStudentDirectory: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const [studentData, gradeData, attData] = await Promise.all([
        userService.getUsers({ role: 'student', assigned_tutor: user.id }),
        academicService.getGrades(),
        academicService.getAttendanceHistory(),
      ]);

      const loadedStudents = Array.isArray(studentData.results) ? studentData.results : Array.isArray(studentData) ? (studentData as any) : [];
      setStudents(loadedStudents);
      setGrades(Array.isArray(gradeData) ? gradeData : []);
      setAttendance(Array.isArray(attData) ? attData : []);
    } catch (err) {
      console.error(err);
      setError('Failed to load assigned students and performance data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const studentRows = useMemo(() => {
    const riskRows = computeStudentRiskRows(students, grades, attendance);
    return riskRows.map((r) => ({
      ...r,
      email: r.student.email,
    }));
  }, [students, grades, attendance]);

  const atRiskCount = useMemo(() => {
    return studentRows.filter((r) => r.riskTier === 'High' || r.riskTier === 'Medium').length;
  }, [studentRows]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredAndSorted = useMemo(() => {
    return studentRows
      .filter((r) => {
        const query = search.toLowerCase();
        const nameMatch = (r.student.full_name || '').toLowerCase().includes(query);
        const lrnMatch = (r.student.lrn || '').includes(query);
        const emailMatch = (r.student.email || '').toLowerCase().includes(query);
        return nameMatch || lrnMatch || emailMatch;
      })
      .sort((a, b) => {
        let valA: any = a.student.full_name;
        let valB: any = b.student.full_name;

        if (sortField === 'lrn') {
          valA = a.student.lrn || '';
          valB = b.student.lrn || '';
        } else if (sortField === 'level') {
          valA = a.student.aral_level || '';
          valB = b.student.aral_level || '';
        } else if (sortField === 'attendance') {
          valA = a.attendanceRate;
          valB = b.attendanceRate;
        } else if (sortField === 'score') {
          valA = a.scoreAvg;
          valB = b.scoreAvg;
        } else if (sortField === 'risk') {
          valA = a.riskTier;
          valB = b.riskTier;
        }

        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [studentRows, search, sortField, sortAsc]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Class Roster</p>
          <h1 className="mt-0.5 text-2xl font-bold text-gray-900">ASSIGNED STUDENTS DIRECTORY</h1>
          <p className="text-xs text-gray-500 mt-1">Manage assigned learners and monitor performance. ARAL levels update automatically upon score entry.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-50 px-4 py-2.5 text-indigo-900 border border-indigo-100 text-center shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-indigo-500 font-bold">Assigned</p>
            <p className="text-2xl font-extrabold">{students.length}</p>
          </div>
          {atRiskCount > 0 && (
            <div className="rounded-2xl bg-rose-50 px-4 py-2.5 text-rose-900 border border-rose-100 text-center shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-rose-500 font-bold">At Risk</p>
              <p className="text-2xl font-extrabold">{atRiskCount}</p>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-60">
          <div className="w-10 h-10 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
          {error}
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center text-gray-500 space-y-2">
          <Users className="w-12 h-12 mx-auto text-gray-300 stroke-[1.5]" />
          <p className="text-base font-bold text-gray-800">No students currently assigned to you.</p>
          <p className="text-xs text-gray-400 max-w-md mx-auto">Ask your administrator to assign student accounts so you can track performance and attendance.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search student name, LRN, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] bg-gray-50"
              />
            </div>
            <span className="text-xs text-gray-400">Showing {filteredAndSorted.length} of {students.length} students</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th onClick={() => handleSort('name')} className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">STUDENT <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th onClick={() => handleSort('lrn')} className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">LRN <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th onClick={() => handleSort('level')} className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">ARAL LEVEL <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th onClick={() => handleSort('attendance')} className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">ATTENDANCE <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th onClick={() => handleSort('score')} className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">AVG SCORE <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th onClick={() => handleSort('risk')} className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 transition">
                    <div className="flex items-center gap-1">RISK TIER <ArrowUpDown className="w-3 h-3 text-gray-400" /></div>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredAndSorted.map((row) => (
                  <tr key={row.student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                          {(row.student.full_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-gray-900 font-semibold">{row.student.full_name}</p>
                          <p className="text-xs text-gray-400">{row.student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 font-mono text-xs">{row.student.lrn || 'N/A'}</td>
                    <td className="px-4 py-3.5">{getAralBadge(row.student.aral_level)}</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-700">{row.attendanceRate}%</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-700">{row.scoreAvg}%</td>
                    <td className="px-4 py-3.5">{getRiskTierBadge(row.riskTier)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        to={`/tutor/students/${row.student.id}`}
                        className="inline-flex items-center text-xs font-bold text-[var(--brand)] hover:text-[var(--brand-dark)]"
                      >
                        View Profile
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </Link>
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
