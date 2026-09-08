import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { User, Grade, Attendance } from '../../types';
import { computeStudentRiskRows } from '../../utils/analyticsHelpers';
import { User as UserIcon, Search, ArrowUpDown, Users, ChevronUp, ChevronDown, BookOpen, AlertCircle, Layers } from 'lucide-react';

/* ─── Badge helpers ────────────────────────────────────────────── */
const getAralBadge = (level?: string | null) => {
  switch (level) {
    case 'plus': return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">Plus</span>;
    case 'summer': return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">Summer</span>;
    case 'graduated': return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Graduated</span>;
    default: return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Basic</span>;
  }
};

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700',
];
const avatarColor = (name: string) => AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length];
import { getStudentInitials as getInitials } from '../../utils/studentFormatters';

/* ─── Component ────────────────────────────────────────────────── */
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
      setStudents(Array.isArray(studentData.results) ? studentData.results : Array.isArray(studentData) ? (studentData as any) : []);
      setGrades(Array.isArray(gradeData) ? gradeData : []);
      setAttendance(Array.isArray(attData) ? attData : []);
    } catch (err) {
      console.error(err);
      setError('Failed to load assigned students and performance data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const studentRows = useMemo(() => {
    return computeStudentRiskRows(students, grades, attendance).map((r) => ({ ...r, email: r.student.email }));
  }, [students, grades, attendance]);

  const directorySubjects = useMemo(() => {
    const studentIds = new Set(students.map((student) => String(student.id)));
    const subjects = [...new Set(grades
      .filter((grade) => studentIds.has(String(grade.student)))
      .map((grade) => grade.subject?.trim())
      .filter(Boolean)
      .filter((subject) => !['intervention activity', 'attendance'].includes(subject!.toLowerCase()))
      .map((subject) => {
        const normalizedSubject = subject!.toLowerCase();
        if (normalizedSubject.includes('reading')) return 'Reading';
        if (normalizedSubject.includes('math')) return 'Math';
        if (normalizedSubject.includes('science')) return 'Science';
        return subject!.replace(/\b\w/g, (letter) => letter.toUpperCase());
      }))];
    return subjects.length ? subjects : ['Reading'];
  }, [students, grades]);
  const directoryAralLevels = useMemo(() => {
    const levels = [...new Set(students.map((student) => student.aral_level).filter(Boolean))];
    return levels.length ? levels.map((level) => level!.charAt(0).toUpperCase() + level!.slice(1)) : ['Basic'];
  }, [students]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filteredAndSorted = useMemo(() => {
    return studentRows
      .filter((r) => {
        const q = search.toLowerCase();
        return (r.student.full_name || '').toLowerCase().includes(q) || (r.student.lrn || '').includes(q);
      })
      .sort((a, b) => {
        let valA: any = a.student.full_name;
        let valB: any = b.student.full_name;
        if (sortField === 'lrn') { valA = a.student.lrn || ''; valB = b.student.lrn || ''; }
        else if (sortField === 'sex') { valA = a.student.sex || a.student.gender || ''; valB = b.student.sex || b.student.gender || ''; }
        else if (sortField === 'level') { valA = a.student.aral_level || ''; valB = b.student.aral_level || ''; }
        if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [studentRows, search, sortField, sortAsc]);

  const SortableHeader: React.FC<{ label: string; field: string }> = ({ label, field }) => {
    const isActive = sortField === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-gray-700 select-none"
        aria-label={`Sort by ${label}`}
      >
        {label}
        {isActive ? (
          sortAsc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
        )}
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* Top KPI cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 shadow-sm animate-pulse flex items-center gap-4"
            >
              <div className="w-11 h-11 rounded-2xl bg-gray-200 dark:bg-gray-700 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-7 w-16 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>

        {/* Directory Table Card skeleton */}
        <div className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] shadow-sm animate-pulse p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="space-y-1.5">
              <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-56 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="h-9 w-64 rounded-xl bg-gray-200 dark:bg-gray-700" />
          </div>

          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2.5 border-b border-gray-50 dark:border-gray-900/50">
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 w-36 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-2.5 w-24 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-800 hidden md:block" />
              <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-8 w-8 rounded-xl bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-2xl p-5 shadow-sm">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load student directory</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 data-loaded-content" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 flex items-center justify-center shrink-0 text-slate-800 dark:text-slate-100">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">TOTAL STUDENTS</p>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">{students.length}</p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 flex items-center justify-center shrink-0 text-slate-800 dark:text-slate-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">SUBJECT</p>
            <p className="mt-0.5 truncate text-xl font-extrabold text-gray-900 dark:text-slate-100" title={directorySubjects.join(', ')}>{directorySubjects.join(', ')}</p>
          </div>
        </div>
        <div className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 flex items-center justify-center shrink-0 text-slate-800 dark:text-slate-100">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">ARAL LEVEL</p>
            <p className="mt-0.5 truncate text-xl font-extrabold text-gray-900 dark:text-slate-100" title={directoryAralLevels.join(', ')}>{directoryAralLevels.join(', ')}</p>
          </div>
        </div>
      </div>

      {/* ── States ────────────────────────────────────────────────── */}
      {students.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-10 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-base font-bold text-gray-800">No students assigned yet</p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">Ask your administrator to assign student accounts so you can track performance and attendance.</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-200 bg-white shadow-sm relative">
          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-base uppercase">ASSIGNED STUDENTS DETAILS</h3>
              <p className="mt-0.5 text-xs font-medium text-gray-500">
                {filteredAndSorted.length} Student{filteredAndSorted.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative flex min-w-52 items-center">
                <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search Student Name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search assigned students"
                  className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs font-semibold text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white focus:ring-2 focus:ring-[var(--brand)]/10"
                />
              </label>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6">
            {filteredAndSorted.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Users className="w-10 h-10 text-gray-200" />
                <p className="text-sm font-semibold text-gray-500">No matching students found</p>
                <p className="text-xs text-gray-400">Try a different student name or LRN</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="min-w-[680px] w-full divide-y divide-gray-100 text-sm font-normal" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  <thead>
                    <tr className="divide-x divide-gray-100 bg-gray-50">
                      <th className="w-12 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        #
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <SortableHeader label="STUDENT" field="name" />
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <SortableHeader label="LRN" field="lrn" />
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <SortableHeader label="SEX" field="sex" />
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <SortableHeader label="ARAL LEVEL" field="level" />
                      </th>
                      <th className="w-16 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        ACTION
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredAndSorted.map((row, index) => (
                      <tr key={row.student.id} className="group divide-x divide-gray-100 transition-colors hover:bg-gray-50/80">
                        <td className="px-3 py-3 text-center text-xs font-normal text-gray-400 whitespace-nowrap">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarColor(row.student.full_name || '')}`}>
                              {getInitials(row.student.full_name || '?')}
                            </div>
                            <span className="truncate font-semibold text-gray-800">{row.student.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs font-normal font-mono">
                          {row.student.lrn || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-xs font-normal">
                          {row.student.sex || row.student.gender || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getAralBadge(row.student.aral_level)}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <Link
                            to={`/tutor/students/${row.student.id}`}
                            className="inline-flex items-center justify-center text-gray-400 hover:text-[var(--brand)] transition-colors cursor-pointer p-1"
                            title="View Profile"
                            aria-label={`View profile for ${row.student.full_name}`}
                          >
                            <UserIcon className="w-4 h-4" />
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
      )}
    </div>
  );
};
