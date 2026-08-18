import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { Grade, User } from '../../types';
import { ExportScoreModal } from '../../components/ExportScoreModal';
import { Search, BookOpen, TrendingUp, Users, CheckCircle2, AlertCircle, PlusCircle } from 'lucide-react';

type ScoreEntryKind = 'daily' | 'mosy' | 'eosy' | 'endline';

const levelScoreEntry = {
  basic: { kind: 'mosy' as const, buttonLabel: 'Add MOSY Score Entry', title: 'MOSY Reading Score (Q1/Q2)', subject: 'MOSY Reading' },
  plus: { kind: 'eosy' as const, buttonLabel: 'Add EOSY Score Entry', title: 'EOSY Reading Score (Q3/Q4)', subject: 'EOSY Reading' },
  summer: { kind: 'endline' as const, buttonLabel: 'Add EndLine Score Entry', title: 'EndLine Reading Score (Summer)', subject: 'EndLine Reading' },
};

const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const scoreColor = (pct: number) => {
  if (pct >= 70) return 'text-emerald-600';
  if (pct >= 60) return 'text-amber-500';
  return 'text-rose-500';
};

export const TutorScores: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryKind, setEntryKind] = useState<ScoreEntryKind>('daily');
  const [entryScores, setEntryScores] = useState<Record<string, number | ''>>({});
  const [entryStatus, setEntryStatus] = useState<Record<string, 'Taken' | 'Not'>>({});
  const [totalScore, setTotalScore] = useState<number | ''>(20);
  const [logDate, setLogDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [historySearch, setHistorySearch] = useState('');
  const [exportModalConfig, setExportModalConfig] = useState<{
    isOpen: boolean;
    mode: 'all' | 'daily' | 'weekly';
    targetKey: string;
  }>({
    isOpen: false,
    mode: 'all',
    targetKey: ''
  });

  const fetchGrades = async () => {
    setGradesLoading(true);
    try {
      const gradeData = await academicService.getGrades();
      setGrades(Array.isArray(gradeData) ? gradeData : (gradeData as any)?.results ?? []);
    } catch (err) {
      console.error(err);
      setError('Failed to load score records.');
    } finally {
      setGradesLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      if (!user) return;
      const data = await userService.getUsers({ role: 'student', assigned_tutor: user.id });
      setStudents(Array.isArray(data.results) ? data.results : Array.isArray(data) ? (data as any) : []);
    } catch (err) {
      console.error(err);
      setError('Failed to load assigned students.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddEntry = (kind: ScoreEntryKind = 'daily') => {
    const initialScores: Record<string, number | ''> = {};
    const initialStatus: Record<string, 'Taken' | 'Not'> = {};

    (students || []).forEach((student) => {
      initialScores[student.id] = '';
      initialStatus[student.id] = 'Taken'; // Default to Taken as requested
    });

    setEntryScores(initialScores);
    setEntryStatus(initialStatus);
    setTotalScore(kind !== 'daily' ? 40 : 20); // 40 items for milestone assessments
    setEntryKind(kind);
    setLogDate(new Date().toLocaleDateString('en-CA'));
    setShowAddEntry(true);
    setSaveSuccessMsg(null);
  };

  const handleAddScore = async () => {
    const activeTotal = entryKind !== 'daily' ? 40 : (totalScore === '' ? 0 : Number(totalScore));
    if (activeTotal <= 0) {
      return alert('Please specify a valid total score greater than 0.');
    }

    if (Object.values(entryScores).every((score) => score === '')) {
      return alert('Please enter a score for at least one student.');
    }

    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const batchId = generateUuid();
      const todayDateStr = logDate || new Date().toLocaleDateString('en-CA');

      const entries: Partial<Grade>[] = (students || [])
        .filter((student) => entryScores[student.id] !== '' || entryStatus[student.id] === 'Not')
        .map((student) => ({
          student: student.id,
          component_type: 'assessment' as Grade['component_type'],
          subject: entryKind === 'daily'
            ? 'Reading'
            : Object.values(levelScoreEntry).find((entry) => entry.kind === entryKind)?.subject || 'Reading',
          quarter: Math.ceil((new Date().getMonth() + 1) / 3),
          score: Number(entryScores[student.id] || 0),
          total_score: activeTotal,
          remarks: entryStatus[student.id] === 'Taken' ? 'Taken' : 'Not Taken',
          date_logged: todayDateStr,
          batch_id: batchId
        }));

      if (entries.length === 0) {
        setIsSaving(false);
        return alert('No scores entered.');
      }

      await Promise.all(entries.map((entry) => academicService.createGrade(entry)));
      
      setEntryScores({});
      setEntryStatus({});
      setShowAddEntry(false);
      await fetchGrades();
      
      const titleName = entryKind === 'daily' ? 'Daily Reading' : Object.values(levelScoreEntry).find((entry) => entry.kind === entryKind)?.title;
      setSaveSuccessMsg(`${titleName} scores saved successfully! Progression level evaluated.`);
    } catch (err: any) {
      console.error('Error saving scores:', err);
      const data = err?.response?.data;
      const detailMsg = data
        ? typeof data === 'string'
          ? data
          : JSON.stringify(data)
        : err?.message || 'Failed to log scores.';
      alert(`Failed to log scores: ${detailMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [user]);

  useEffect(() => {
    fetchGrades();
  }, [user]);

  const safeGrades = useMemo(() => (Array.isArray(grades) ? grades : []), [grades]);
  const levelEntry = useMemo(
    () => levelScoreEntry[user?.aral_level && (user.aral_level in levelScoreEntry) ? (user.aral_level as keyof typeof levelScoreEntry) : 'basic'],
    [user?.aral_level]
  );

  const dailyGrades = useMemo(
    () => safeGrades.filter((grade) => grade.component_type === 'assessment'),
    [safeGrades]
  );

  const sortedDailyGrades = useMemo(
    () => [...dailyGrades].sort((a, b) => new Date(b.date_logged).getTime() - new Date(a.date_logged).getTime()),
    [dailyGrades]
  );

  // Summary stats
  const studentsWithEntries = useMemo(
    () => new Set(dailyGrades.map((g) => g.student)).size,
    [dailyGrades]
  );

  const avgScoreAll = useMemo(() => {
    if (dailyGrades.length === 0) return 0;
    const sum = dailyGrades.reduce((acc, g) => {
      const ts = Number(g.total_score) || 100;
      return acc + (Number(g.score) / ts) * 100;
    }, 0);
    return Math.round((sum / dailyGrades.length) * 10) / 10;
  }, [dailyGrades]);

  const dailyGroups = useMemo(() => {
    return dailyGrades.reduce((acc, grade) => {
      const dateKey = grade.date_logged || '2026-01-01';
      const group = acc[dateKey] || { date: new Date(dateKey), dateStr: dateKey, grades: [] as Grade[] };
      group.grades.push(grade);
      acc[dateKey] = group;
      return acc;
    }, {} as Record<string, { date: Date; dateStr: string; grades: Grade[] }>);
  }, [dailyGrades]);

  const dailyRows = useMemo(() => {
    return Object.values(dailyGroups)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((group) => ({
        date: group.date,
        dateStr: group.dateStr,
        grades: group.grades.sort((a, b) => new Date(b.date_logged).getTime() - new Date(a.date_logged).getTime())
      }));
  }, [dailyGroups]);

  const weeklyGroups = useMemo(() => {
    const getWeekStart = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(d.setDate(diff));
    };

    return dailyGrades.reduce((acc, grade) => {
      const date = new Date(grade.date_logged || new Date());
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString().slice(0, 10);
      const group = acc[weekKey] || { weekStart, grades: [] as Grade[] };
      group.grades.push(grade);
      acc[weekKey] = group;
      return acc;
    }, {} as Record<string, { weekStart: Date; grades: Grade[] }>);
  }, [dailyGrades]);

  const weeklyRows = useMemo(() => {
    return Object.values(weeklyGroups)
      .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
      .map((group) => ({
        weekStart: group.weekStart,
        weekEnd: new Date(group.weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
        grades: group.grades.sort((a, b) => new Date(b.date_logged).getTime() - new Date(a.date_logged).getTime())
      }));
  }, [weeklyGroups]);

  // Early returns placed AFTER all hooks
  if (isLoading) return <div className="py-12 text-center text-gray-400 font-semibold">Loading students and scores...</div>;
  if (error) return <div className="bg-red-50 border border-gray-200 text-red-800 rounded-xl p-4">{error}</div>;

  // Filter grades by search
  const filterGrades = (gradeList: Grade[]) => {
    if (!historySearch) return gradeList;
    return gradeList.filter((g) => (g.student_name || '').toLowerCase().includes(historySearch.toLowerCase()));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Score Management</p>
          <h2 className="text-lg font-bold text-gray-900 mt-0.5">TUTOR SCORE ENTRY &amp; ASSESSMENT PORTAL</h2>
          <p className="text-xs text-gray-500 mt-1">Log daily reading scores or milestone assessments (MOSY / EOSY / EndLine).</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={() => setExportModalConfig({ isOpen: true, mode: 'all', targetKey: '' })}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            📊 Export Scores
          </button>
          <button
            type="button"
            onClick={() => handleOpenAddEntry('daily')}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[var(--brand)] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--brand-dark)]"
          >
            <PlusCircle className="w-4 h-4" />
            Add Daily Score Entry
          </button>
          <button
            type="button"
            onClick={() => handleOpenAddEntry(levelEntry.kind)}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-light)] px-4 py-2.5 text-xs font-bold text-[var(--brand-dark)] shadow-sm transition hover:bg-[var(--brand-border)]"
          >
            ⭐ {levelEntry.buttonLabel} (Max: 40)
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-700 hover:underline">✕</button>
        </div>
      )}

      {/* Summary Stats Strip */}
      {dailyGrades.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Total Entries</p>
              <p className="text-xl font-extrabold text-gray-900">{dailyGrades.length}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Students w/ Entries</p>
              <p className="text-xl font-extrabold text-gray-900">{studentsWithEntries}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Overall Avg Score</p>
              <p className={`text-xl font-extrabold ${scoreColor(avgScoreAll)}`}>{avgScoreAll}%</p>
            </div>
          </div>
        </div>
      )}

      {/* ADD SCORE ENTRY FORM / MODAL */}
      {showAddEntry && (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-lg p-6 text-slate-900 space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
            <div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                {entryKind === 'daily' ? 'Daily Assessment' : 'Milestone Assessment (40 Items Max)'}
              </span>
              <h3 className="mt-1.5 text-xl font-bold text-slate-900">
                {entryKind === 'daily'
                  ? 'Log Daily Reading Scores'
                  : levelEntry.title}
              </h3>
              <p className="text-xs text-slate-500">
                {entryKind !== 'daily'
                  ? 'Passing score is 28 out of 40 items (≥ 70%). Passing will automatically level up or graduate the student.'
                  : 'Enter score earned for each assigned student.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddEntry(false)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>

          {/* Form Header Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date Logged</label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Assessment Score (Items)
              </label>
              <input
                type="number"
                disabled={entryKind !== 'daily'}
                value={entryKind !== 'daily' ? 40 : totalScore}
                onChange={(e) => setTotalScore(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
              {entryKind !== 'daily' && (
                <p className="text-[10px] text-indigo-600 font-semibold mt-1">Fixed at 40 items for {entryKind.toUpperCase()}</p>
              )}
            </div>
          </div>

          {/* Student Scores Roster */}
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3 px-3 py-2 rounded-xl bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <span className="col-span-5">Student</span>
              <span className="col-span-3">Score (Out of {entryKind !== 'daily' ? 40 : (totalScore || 'Total')})</span>
              <span className="col-span-2">Preview %</span>
              <span className="col-span-2 text-right">Status</span>
            </div>

            {students.length === 0 ? (
              <p className="text-center py-6 text-xs text-gray-400">No assigned students found.</p>
            ) : (
              students.map((student) => {
                const status = entryStatus[student.id] || 'Taken';
                const isNotTaken = status === 'Not';
                const rawScore = entryScores[student.id];
                const activeTotal = entryKind !== 'daily' ? 40 : (Number(totalScore) || 40);

                const pct = !isNotTaken && rawScore !== '' && activeTotal > 0
                  ? Math.round((Number(rawScore) / activeTotal) * 100 * 10) / 10
                  : null;

                const isPassingMilestone = entryKind !== 'daily' && pct !== null && pct >= 70;

                return (
                  <div key={student.id} className="grid grid-cols-12 gap-3 rounded-2xl border border-slate-200 bg-white p-3 items-center hover:border-indigo-200 transition-colors">
                    <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                        {(student.first_name?.[0] || student.full_name?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{student.full_name}</p>
                        <p className="text-[10px] text-slate-400 truncate">LRN: {student.lrn || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        min={0}
                        max={activeTotal}
                        value={isNotTaken ? 0 : (entryScores[student.id] ?? '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          let numVal: number | '' = val === '' ? '' : Number(val);
                          if (typeof numVal === 'number' && numVal > activeTotal) {
                            numVal = activeTotal;
                          }
                          setEntryScores((prev) => ({ ...prev, [student.id]: numVal }));
                        }}
                        placeholder={`0 - ${activeTotal}`}
                        disabled={isNotTaken}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </div>

                    <div className="col-span-2">
                      {pct !== null ? (
                        <div className="flex flex-col">
                          <span className={`text-xs font-extrabold ${scoreColor(pct)}`}>{pct}%</span>
                          {entryKind !== 'daily' && (
                            <span className={`text-[9px] font-bold ${isPassingMilestone ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {isPassingMilestone ? '✓ Pass (≥28)' : '✕ Fail (<28)'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>

                    <div className="col-span-2 text-right">
                      <select
                        value={status}
                        onChange={(e) => {
                          const newStatus = e.target.value as 'Taken' | 'Not';
                          setEntryStatus((prev) => ({ ...prev, [student.id]: newStatus }));
                          if (newStatus === 'Not') {
                            setEntryScores((prev) => ({ ...prev, [student.id]: 0 }));
                          }
                        }}
                        className="rounded-xl border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none"
                      >
                        <option value="Taken">Taken</option>
                        <option value="Not">Not Taken</option>
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <p className="text-xs text-slate-400">Default status for all entries is set to Taken.</p>
            <button
              type="button"
              onClick={handleAddScore}
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--brand)] px-6 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--brand-dark)] disabled:opacity-60"
            >
              {isSaving ? 'Saving Scores...' : 'Save & Submit Scores'}
            </button>
          </div>
        </div>
      )}

      {/* History Records Table */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Score Records</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">RECENT SCORE HISTORY</h3>
          </div>
          <div className="inline-flex gap-2 rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`rounded-2xl px-4 py-1.5 text-xs font-bold transition ${viewMode === 'daily' ? 'bg-[var(--brand)] text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
            >
              Daily View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`rounded-2xl px-4 py-1.5 text-xs font-bold transition ${viewMode === 'weekly' ? 'bg-[var(--brand)] text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
            >
              Weekly View
            </button>
          </div>
        </div>

        {/* Search filter */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search score records by student name..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] bg-gray-50"
          />
        </div>

        {gradesLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : sortedDailyGrades.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
            No daily score records found. Click &quot;Add Daily Score Entry&quot; to get started.
          </div>
        ) : viewMode === 'daily' ? (
          <div className="space-y-4">
            {dailyRows.map((day) => {
              const filtered = filterGrades(day.grades);
              if (filtered.length === 0 && historySearch) return null;
              return (
                <div key={day.dateStr} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{new Date(day.dateStr + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</h4>
                      <p className="text-[10px] text-slate-400">{filtered.length} score entry{filtered.length !== 1 ? 'ies' : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExportModalConfig({
                          isOpen: true,
                          mode: 'daily',
                          targetKey: day.dateStr
                        })
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                    >
                      📊 Export Day
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead className="bg-white text-slate-500 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2 text-left">Student</th>
                          <th className="px-4 py-2 text-left">Subject</th>
                          <th className="px-4 py-2 text-left">Score</th>
                          <th className="px-4 py-2 text-left">Total</th>
                          <th className="px-4 py-2 text-left">%</th>
                          <th className="px-4 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filtered.map((grade) => {
                          const ts = Number(grade.total_score) || 100;
                          const pct = Math.round((Number(grade.score) / ts) * 100 * 10) / 10;
                          return (
                            <tr key={grade.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-2.5 font-bold text-slate-800">{grade.student_name}</td>
                              <td className="px-4 py-2.5 text-slate-600">{grade.subject}</td>
                              <td className="px-4 py-2.5 font-bold text-[var(--brand)] text-sm">{grade.score}</td>
                              <td className="px-4 py-2.5 font-semibold text-slate-700">{grade.total_score}</td>
                              <td className="px-4 py-2.5">
                                <span className={`font-extrabold ${scoreColor(pct)}`}>{pct}%</span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">{grade.remarks || 'N/A'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {weeklyRows.map((row) => {
              const filtered = filterGrades(row.grades);
              if (filtered.length === 0 && historySearch) return null;
              return (
                <div key={row.weekStart.toISOString()} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{row.weekStart.toLocaleDateString()} — {row.weekEnd.toLocaleDateString()}</p>
                      <p className="text-[10px] text-slate-400">{filtered.length} entries</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExportModalConfig({
                          isOpen: true,
                          mode: 'weekly',
                          targetKey: row.weekStart.toISOString().slice(0, 10)
                        })
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                    >
                      📊 Export Week
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Student</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Subject</th>
                          <th className="px-3 py-2 text-left">Score</th>
                          <th className="px-3 py-2 text-left">Total</th>
                          <th className="px-3 py-2 text-left">%</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filtered.map((grade) => {
                          const ts = Number(grade.total_score) || 100;
                          const pct = Math.round((Number(grade.score) / ts) * 100 * 10) / 10;
                          return (
                            <tr key={grade.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-3 py-2.5 font-bold text-slate-800">{grade.student_name}</td>
                              <td className="px-3 py-2.5 text-slate-500 text-[11px]">{new Date(grade.date_logged).toLocaleDateString()}</td>
                              <td className="px-3 py-2.5 text-slate-600">{grade.subject}</td>
                              <td className="px-3 py-2.5 font-bold text-[var(--brand)] text-sm">{grade.score}</td>
                              <td className="px-3 py-2.5 text-slate-700">{grade.total_score}</td>
                              <td className="px-3 py-2.5 font-extrabold">
                                <span className={scoreColor(pct)}>{pct}%</span>
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">{grade.remarks || 'N/A'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ExportScoreModal
        isOpen={exportModalConfig.isOpen}
        onClose={() => setExportModalConfig((prev) => ({ ...prev, isOpen: false }))}
        currentUser={user}
        students={students}
        grades={grades}
        initialMode={exportModalConfig.mode}
        initialTargetKey={exportModalConfig.targetKey}
      />
    </div>
  );
};

export default TutorScores;
