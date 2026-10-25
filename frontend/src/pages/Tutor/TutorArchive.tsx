import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import type { SchoolYear, Grade, Attendance, User, TutorCohortHistoryData } from '../../types';
import { buildTutorClassSections, parseTutorRoleDetailsFromUser } from '../../utils/tutorCohortHelpers';

export const TutorArchive: React.FC = () => {
  const { user } = useAuth();

  // Selectors State
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'mosy' | 'eosy' | 'summer'>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'roster' | 'scores' | 'attendance'>('roster');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cohortHistory, setCohortHistory] = useState<TutorCohortHistoryData | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);

  // Fetch initial school years
  useEffect(() => {
    let mounted = true;
    const fetchSY = async () => {
      try {
        const [sys, cur] = await Promise.all([
          academicService.getSchoolYears(),
          academicService.getCurrentSchoolYear().catch(() => null),
        ]);
        if (mounted) {
          setSchoolYears(sys);
          if (cur?.school_year) {
            setSelectedSchoolYear(cur.school_year);
          } else if (sys.length > 0) {
            setSelectedSchoolYear(sys[0].school_year);
          } else {
            setSelectedSchoolYear('2026-2027');
          }
        }
      } catch (err) {
        console.error('Failed to fetch school years:', err);
        if (mounted) setSelectedSchoolYear('2026-2027');
      }
    };
    fetchSY();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch tutor history, grades, attendance, and student directory
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const [historyData, gradesData, attendanceData, studentsData] = await Promise.all([
          academicService.getTutorCohortHistory(String(user.id), selectedSchoolYear).catch(() => null),
          academicService.getGrades().catch(() => []),
          academicService.getAttendanceHistory().catch(() => []),
          userService.getAllUsers({ role: 'student' }).catch(() => []),
        ]);

        if (mounted) {
          setCohortHistory(historyData);
          setGrades(gradesData);
          setAttendance(attendanceData);
          setAllStudents(studentsData);
        }
      } catch (err) {
        console.error('Failed to load archive data:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [user?.id, selectedSchoolYear]);

  // Map students by ID for quick profile lookup
  const studentMap = useMemo(() => {
    const map = new Map<string, User>();
    for (const s of allStudents) {
      map.set(String(s.id), s);
    }
    return map;
  }, [allStudents]);

  // Extract handled class sections (both active from tutor user profile and from history)
  const availableClassSections = useMemo(() => {
    const sections = new Set<string>();

    if (user) {
      const activeClasses = buildTutorClassSections(user, allStudents);
      for (const cls of activeClasses) {
        sections.add(`${cls.gradeLevel} - ${cls.section}`);
      }
    }

    if (cohortHistory?.past_records) {
      for (const rec of cohortHistory.past_records) {
        const st = studentMap.get(rec.student_id);
        if (st?.section) {
          const g = st.grade_level ? (st.grade_level.includes('Grade') ? st.grade_level : `Grade ${st.grade_level}`) : 'Grade 7';
          sections.add(`${g} - ${st.section}`);
        }
      }
    }

    return Array.from(sections).sort();
  }, [user, cohortHistory, studentMap]);

  // Combined Roster Items (Past Records + Active Cohort)
  const rosterRecords = useMemo(() => {
    const items: Array<{
      id: string;
      studentId: string;
      studentName: string;
      lrn: string;
      program: string;
      classSection: string;
      schoolYear: string;
      period: string;
      latestScore: string;
      outcome: string;
      dates: string;
      isActive: boolean;
    }> = [];

    // Historical records from tutor assignment history
    if (cohortHistory?.past_records) {
      for (const rec of cohortHistory.past_records) {
        const st = studentMap.get(rec.student_id);
        const g = st?.grade_level ? (st.grade_level.includes('Grade') ? st.grade_level : `Grade ${st.grade_level}`) : 'Grade 7';
        const sec = st?.section || 'HYACINTH';
        const classSec = `${g} - ${sec}`;

        let outcome = 'Retained Level';
        if (rec.latest_grade_remarks?.toLowerCase().includes('pass') || (rec.latest_score && rec.latest_score.includes('100%'))) {
          outcome = rec.program.toLowerCase() === 'plus' ? 'Graduated' : 'Moved Up to Plus';
        }

        items.push({
          id: `past-${rec.history_id}`,
          studentId: rec.student_id,
          studentName: rec.student_name,
          lrn: rec.lrn || '—',
          program: rec.program,
          classSection: classSec,
          schoolYear: rec.school_year,
          period: rec.period || '1st Semester',
          latestScore: rec.latest_score || '—',
          outcome,
          dates: `${rec.start_date || '—'} to ${rec.end_date || 'Present'}`,
          isActive: rec.is_active,
        });
      }
    }

    // Active cohort students if viewing current school year
    if (cohortHistory?.active_cohort) {
      for (const st of cohortHistory.active_cohort) {
        const fullSt = studentMap.get(st.student_id);
        const g = fullSt?.grade_level ? (fullSt.grade_level.includes('Grade') ? fullSt.grade_level : `Grade ${fullSt.grade_level}`) : 'Grade 7';
        const sec = fullSt?.section || 'HYACINTH';
        const classSec = `${g} - ${sec}`;

        // Avoid duplicate if history already captured it
        if (!items.some((i) => i.studentId === st.student_id)) {
          items.push({
            id: `active-${st.student_id}`,
            studentId: st.student_id,
            studentName: st.student_name,
            lrn: st.lrn || '—',
            program: st.program,
            classSection: classSec,
            schoolYear: selectedSchoolYear,
            period: 'Active Semester',
            latestScore: '—',
            outcome: 'In Progress',
            dates: 'Active Assignment',
            isActive: true,
          });
        }
      }
    }

    return items;
  }, [cohortHistory, studentMap, selectedSchoolYear]);

  // Filtered Roster Records
  const filteredRoster = useMemo(() => {
    return rosterRecords.filter((rec) => {
      // Period filter
      if (selectedPeriod !== 'all') {
        const p = (rec.period || '').toLowerCase();
        if (selectedPeriod === 'mosy' && !p.includes('1st') && !p.includes('mosy')) return false;
        if (selectedPeriod === 'eosy' && !p.includes('2nd') && !p.includes('eosy')) return false;
        if (selectedPeriod === 'summer' && !p.includes('summer')) return false;
      }

      // Class section filter
      if (selectedClass !== 'all' && rec.classSection !== selectedClass) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          rec.studentName.toLowerCase().includes(q) ||
          rec.lrn.toLowerCase().includes(q) ||
          rec.program.toLowerCase().includes(q) ||
          rec.classSection.toLowerCase().includes(q) ||
          rec.outcome.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [rosterRecords, selectedPeriod, selectedClass, searchQuery]);

  // Filtered Score Records
  const filteredGrades = useMemo(() => {
    return grades.filter((g) => {
      // Period filter based on subject / remarks
      const subj = (g.subject || '').toLowerCase();
      const rem = (g.remarks || '').toLowerCase();

      if (selectedPeriod === 'mosy' && !subj.includes('mosy') && !rem.includes('mosy')) return false;
      if (selectedPeriod === 'eosy' && !subj.includes('eosy') && !rem.includes('eosy')) return false;
      if (selectedPeriod === 'summer' && !subj.includes('summer') && !rem.includes('summer')) return false;

      // Class section filter
      const st = studentMap.get(String(g.student));
      if (selectedClass !== 'all') {
        if (!st?.section) return false;
        const gLev = st.grade_level ? (st.grade_level.includes('Grade') ? st.grade_level : `Grade ${st.grade_level}`) : 'Grade 7';
        const stSec = `${gLev} - ${st.section}`;
        if (stSec !== selectedClass) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const stName = g.student_name || st?.full_name || '';
        const stLrn = st?.lrn || '';
        return (
          stName.toLowerCase().includes(q) ||
          stLrn.toLowerCase().includes(q) ||
          subj.includes(q) ||
          rem.includes(q)
        );
      }

      return true;
    });
  }, [grades, selectedPeriod, selectedClass, searchQuery, studentMap]);

  // Filtered Attendance Records
  const filteredAttendance = useMemo(() => {
    return attendance.filter((att) => {
      const st = studentMap.get(String(att.user));

      // Class section filter
      if (selectedClass !== 'all') {
        if (!st?.section) return false;
        const gLev = st.grade_level ? (st.grade_level.includes('Grade') ? st.grade_level : `Grade ${st.grade_level}`) : 'Grade 7';
        const stSec = `${gLev} - ${st.section}`;
        if (stSec !== selectedClass) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const stName = att.user_name || st?.full_name || '';
        const stLrn = st?.lrn || '';
        const statusStr = (att.status || '').toLowerCase();
        return (
          stName.toLowerCase().includes(q) ||
          stLrn.toLowerCase().includes(q) ||
          statusStr.includes(q)
        );
      }

      return true;
    });
  }, [attendance, selectedClass, searchQuery, studentMap]);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Tutor Archives & Historical Records
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Access past handled cohorts, permanent score logs, and historical QR attendance punches
          </p>
        </div>

        {/* School Year Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="school-year-select" className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
            School Year:
          </label>
          <select
            id="school-year-select"
            value={selectedSchoolYear}
            onChange={(e) => setSelectedSchoolYear(e.target.value)}
            className="font-bold text-xs sm:text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white shadow-2xs focus:outline-none cursor-pointer"
          >
            {schoolYears.length === 0 ? (
              <option value="2026-2027">SY 2026–2027</option>
            ) : (
              schoolYears.map((sy) => (
                <option key={sy.id || sy.school_year} value={sy.school_year}>
                  SY {sy.school_year}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* ── Filter Bar: Period, Handled Class, and Search ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-zinc-950 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
        {/* Period Selector */}
        <div className="flex flex-col gap-1">
          <label htmlFor="period-filter" className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Evaluation Period
          </label>
          <select
            id="period-filter"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="text-xs font-medium bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
          >
            <option value="all">All Periods (Entire Year)</option>
            <option value="mosy">MOSY (1st Semester)</option>
            <option value="eosy">EOSY (2nd Semester)</option>
            <option value="summer">Summer Remediation</option>
          </select>
        </div>

        {/* Handled Class / Section Selector */}
        <div className="flex flex-col gap-1">
          <label htmlFor="class-filter" className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Handled Class Section
          </label>
          <select
            id="class-filter"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="text-xs font-medium bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
          >
            <option value="all">All Handled Classes</option>
            {availableClassSections.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="flex flex-col gap-1">
          <label htmlFor="search-input" className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Search Keyword
          </label>
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student, LRN, subject..."
            className="text-xs font-medium bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none"
          />
        </div>
      </div>

      {/* ── View Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'roster'
              ? 'bg-[#0052B7] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
          }`}
        >
          Class Roster & Outcomes ({filteredRoster.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scores')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'scores'
              ? 'bg-[#0052B7] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
          }`}
        >
          Score Records ({filteredGrades.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-[#0052B7] text-white shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'
          }`}
        >
          QR Attendance Records ({filteredAttendance.length})
        </button>
      </div>

      {/* ── Tab Content ── */}
      {isLoading ? (
        <div className="p-8 text-center bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs text-slate-500">
          Loading archive records...
        </div>
      ) : activeTab === 'roster' ? (
        /* ── Roster & Outcomes Table ── */
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-300">
              <thead className="bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">LRN</th>
                  <th className="px-4 py-3">Class & Section</th>
                  <th className="px-4 py-3">Program Level</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 text-center">Assessment Score</th>
                  <th className="px-4 py-3 text-center">Outcome Status</th>
                  <th className="px-4 py-3">Handled Dates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">
                {filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 dark:text-zinc-500">
                      No historical class roster records found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRoster.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {item.studentName}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 dark:text-zinc-400">
                        {item.lrn}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-zinc-300">
                        {item.classSection}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                          {item.program}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-zinc-400">
                        {item.period}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-800 dark:text-zinc-200">
                        {item.latestScore}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            item.outcome.includes('Graduated') || item.outcome.includes('Moved Up')
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
                              : item.outcome.includes('In Progress')
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900'
                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900'
                          }`}
                        >
                          {item.outcome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500 dark:text-zinc-400">
                        {item.dates}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'scores' ? (
        /* ── Score Records Table ── */
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-300">
              <thead className="bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date Logged</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Subject / Activity</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 text-center">Score / Total</th>
                  <th className="px-4 py-3 text-center">Percentage</th>
                  <th className="px-4 py-3 text-center">Status / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">
                {filteredGrades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-zinc-500">
                      No score records found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredGrades.map((g) => {
                    const sc = Number(g.score) || 0;
                    const ts = Number(g.total_score) || 40;
                    const pct = ts > 0 ? Math.round((sc / ts) * 1000) / 10 : 0;
                    const isPassed = (g.remarks || '').toLowerCase() === 'passed' || pct >= 70;

                    return (
                      <tr key={g.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/40 transition-colors">
                        <td className="px-4 py-3 text-[11px] font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                          {g.date_logged ? new Date(g.date_logged).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          {g.student_name || 'Student'}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-zinc-300">
                          {g.subject || 'Intervention Activity'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">
                          {g.quarter ? `Q${g.quarter}` : 'Milestone'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-800 dark:text-zinc-200">
                          {sc} / {ts}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold">
                          <span className={isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              isPassed
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
                                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900'
                            }`}
                          >
                            {g.remarks || (isPassed ? 'Passed' : 'Needs Intervention')}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── QR Attendance Records Table ── */
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-300">
              <thead className="bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Time In</th>
                  <th className="px-4 py-3">Time Out</th>
                  <th className="px-4 py-3">Session Mode</th>
                  <th className="px-4 py-3 text-center">Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-zinc-500">
                      No QR attendance records found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredAttendance.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="px-4 py-3 text-[11px] font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {att.date}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {att.user_name || 'Student'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-zinc-300">
                        {att.time_in || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-zinc-300">
                        {att.time_out || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">
                        {att.session ? 'QR Scan Session' : 'Manual Entry'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${
                            att.status === 'present'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900'
                          }`}
                        >
                          {att.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
