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
  switch (level?.toLowerCase()) {
    case 'plus': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">Plus</span>;
    case 'summer': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Summer</span>;
    case 'graduated': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Graduated</span>;
    default: return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">Basic</span>;
  }
};

import { buildAvatarColorMap } from '../../utils/studentFormatters';
import { matchesSearch } from '../../utils/searchHelpers';

function getDepEdSchoolYear(date: Date = new Date()) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  let syStart = year;
  let syEnd = year + 1;
  if (month < 7) {
    syStart = year - 1;
    syEnd = year;
  }

  return {
    syStart,
    syEnd,
    currentKey: `${syStart}-${syEnd}`,
    displayLabel: `SY ${syStart}–${syEnd}`,
  };
}

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

  const currentSchoolYear = useMemo(() => getDepEdSchoolYear(), []);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(() => currentSchoolYear.currentKey);

  const schoolYearOptions = useMemo(() => {
    const { syStart, syEnd } = currentSchoolYear;
    return [
      { key: `${syStart}-${syEnd}`, label: `SY ${syStart}–${syEnd} (Active)` },
      { key: `${syStart - 1}-${syStart}`, label: `SY ${syStart - 1}–${syStart} (Previous)` },
      { key: `${syStart - 2}-${syStart - 1}`, label: `SY ${syStart - 2}–${syStart - 1}` },
    ];
  }, [currentSchoolYear]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const [studentData, gradeData, attData] = await Promise.all([
        userService.getAllUsers({ role: 'student', assigned_tutor: user.id }),
        academicService.getGrades(),
        academicService.getAttendanceHistory(),
      ]);
      setStudents(Array.isArray(studentData) ? studentData : []);
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
  const tutorAralLevel = useMemo(() => {
    if (!user?.aral_level) return 'Basic';
    const lvl = user.aral_level.toLowerCase();
    return lvl.charAt(0).toUpperCase() + lvl.slice(1);
  }, [user?.aral_level]);

  const avatarColor = useMemo(
    () => buildAvatarColorMap(students.length > 0 ? students : studentRows.map((r) => r.student)),
    [students, studentRows]
  );

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filteredAndSorted = useMemo(() => {
    return studentRows
      .filter((r) => {
        return matchesSearch(search, r.student.full_name, r.student.first_name, r.student.last_name, r.student.lrn);
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
      <div className="space-y-6 skeleton-container" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* Top KPI cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-3 skeleton-row-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-5 animate-pulse flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-md bg-gray-200 dark:bg-gray-800 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-6 w-16 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>

        {/* Directory Table Card skeleton */}
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] animate-pulse skeleton-row-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1.5">
              <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8.5 w-52 rounded-md bg-gray-100 dark:bg-gray-800" />
              <div className="h-8.5 w-28 rounded-md bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>

          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 dark:border-gray-900/50">
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-36 rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-2.5 w-24 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-800 hidden md:block" />
                <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-800" />
                <div className="h-6 w-6 rounded-md bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-md p-5">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load student directory</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-3 px-3.5 py-1.5 bg-rose-600 text-white rounded-md text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
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
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#222222] flex items-center justify-center shrink-0 text-slate-800 dark:text-slate-100">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">TOTAL STUDENTS</p>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 mt-0.5">{students.length}</p>
          </div>
        </div>
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#222222] flex items-center justify-center shrink-0 text-slate-800 dark:text-slate-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">SUBJECT</p>
            <p className="mt-0.5 truncate text-xl font-extrabold text-gray-900 dark:text-slate-100" title={directorySubjects.join(', ')}>{directorySubjects.join(', ')}</p>
          </div>
        </div>
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#222222] flex items-center justify-center shrink-0 text-slate-800 dark:text-slate-100">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">ARAL LEVEL</p>
            <p className="mt-0.5 truncate text-xl font-extrabold text-gray-900 dark:text-slate-100" title={tutorAralLevel}>{tutorAralLevel}</p>
          </div>
        </div>
      </div>

      {/* ── States ────────────────────────────────────────────────── */}
      {students.length === 0 ? (
        <div className="bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-md bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#1A1A1A] flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-gray-300 dark:text-slate-600" />
          </div>
          <p className="text-base font-bold text-gray-800 dark:text-slate-200">No students assigned yet</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 max-w-sm mx-auto">Ask your administrator to assign student accounts so you can track performance and attendance.</p>
        </div>
      ) : (
        <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] relative">
          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base uppercase">ASSIGNED STUDENTS DETAILS</h3>
              <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-slate-400">
                {filteredAndSorted.length} Student{filteredAndSorted.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Auto-updating School Year Dropdown */}
              <div className="relative inline-flex items-center">
                <select
                  value={selectedSchoolYear}
                  onChange={(e) => setSelectedSchoolYear(e.target.value)}
                  aria-label="Filter by School Year"
                  className="h-8.5 appearance-none rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] pl-3 pr-8 text-xs font-bold text-[var(--brand)] outline-none transition hover:bg-gray-100 dark:hover:bg-[#222222] focus:border-[var(--brand)] cursor-pointer"
                >
                  {schoolYearOptions.map((opt) => (
                    <option key={opt.key} value={opt.key} className="bg-white dark:bg-[#111111] text-gray-800 dark:text-slate-200 font-medium">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[var(--brand)] opacity-75" />
              </div>

              <label className="relative flex min-w-52 items-center">
                <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search Student Name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search assigned students"
                  className="h-8.5 w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#161616] pl-9 pr-3 text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none transition placeholder:text-gray-400 focus:border-[var(--brand)] focus:bg-white dark:focus:bg-[#111111]"
                />
              </label>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6">
            {filteredAndSorted.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Users className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No matching students found</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Try a different student name or LRN</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="min-w-[680px] w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm font-normal" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  <thead>
                    <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#151515]">
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
                  <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#111111]">
                    {filteredAndSorted.map((row, index) => (
                      <tr key={row.student.id} className="group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#151515]">
                        <td className="px-3 py-2.5 text-center text-xs font-normal text-gray-400 whitespace-nowrap">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${avatarColor(row.student.full_name || '')}`}>
                              <UserIcon className="w-3 h-3" />
                            </div>
                            <span className="truncate font-semibold text-gray-800 dark:text-slate-100">{row.student.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-slate-300 whitespace-nowrap text-xs font-normal font-mono">
                          {row.student.lrn || 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-slate-300 whitespace-nowrap text-xs font-normal">
                          {row.student.sex || row.student.gender || '—'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {getAralBadge(row.student.aral_level)}
                        </td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
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
