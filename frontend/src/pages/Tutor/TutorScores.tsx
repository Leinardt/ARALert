import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { Grade, User } from '../../types';
import { ExportScoreModal } from '../../components/ExportScoreModal';

type ScoreEntryKind = 'daily' | 'mosy' | 'eosy' | 'endline';

const levelScoreEntry = {
  basic: { kind: 'mosy' as const, buttonLabel: 'Add MOSY Score Entry', title: 'MOSY Reading score', subject: 'MOSY Reading' },
  plus: { kind: 'eosy' as const, buttonLabel: 'Add EOSY Score Entry', title: 'EOSY Reading score', subject: 'EOSY Reading' },
  summer: { kind: 'endline' as const, buttonLabel: 'Add EndLine Score Entry', title: 'EndLine Reading score', subject: 'EndLine Reading' },
};

const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const TutorScores: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryKind, setEntryKind] = useState<ScoreEntryKind>('daily');
  const [entryScores, setEntryScores] = useState<Record<string, number | ''>>({});
  const [entryStatus, setEntryStatus] = useState<Record<string, 'Taken' | 'Not'>>({});
  const [totalScore, setTotalScore] = useState<number | ''>(20);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
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
      initialStatus[student.id] = 'Not';
    });

    setEntryScores(initialScores);
    setEntryStatus(initialStatus);
    setTotalScore(20);
    setEntryKind(kind);
    setShowAddEntry(true);
  };

  const handleAddScore = async () => {
    if (Object.values(entryScores).every((score) => score === '')) {
      return alert('Enter at least one student score.');
    }

    const zeroTakenStudents = (students || []).filter(
      (student) =>
        Number(entryScores[student.id] || 0) === 0 && entryStatus[student.id] === 'Taken'
    );

    if (zeroTakenStudents.length > 0) {
      const studentList = zeroTakenStudents.map((student) => student.full_name).join(', ');
      const confirmZero = window.confirm(
        `The following student(s) are marked Taken but will be saved with a score of 0: ${studentList}.\n\nDo you want to continue and leave these scores as zero?`
      );
      if (!confirmZero) return;
    }

    setIsSaving(true);
    try {
      const batchId = generateUuid();
      const entries: Partial<Grade>[] = (students || []).map((student) => ({
        student: student.id,
        component_type: 'assessment' as Grade['component_type'],
        subject: entryKind === 'daily'
          ? 'Reading'
          : Object.values(levelScoreEntry).find((entry) => entry.kind === entryKind)?.subject || 'Reading',
        quarter: Math.ceil((new Date().getMonth() + 1) / 3),
        score: Number(entryScores[student.id] || 0),
        total_score: totalScore === '' ? 0 : Number(totalScore),
        remarks: entryStatus[student.id] === 'Taken' ? 'Taken' : 'Not Taken',
        batch_id: batchId
      }));

      await Promise.all(entries.map((entry) => academicService.createGrade(entry)));
      setEntryScores({});
      setEntryStatus({});
      setShowAddEntry(false);
      await fetchGrades();
      alert(`${entryKind === 'daily' ? 'Daily Reading' : Object.values(levelScoreEntry).find((entry) => entry.kind === entryKind)?.title} scores logged successfully.`);
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

  if (isLoading) return <div className="py-12 text-center">Loading...</div>;
  if (error) return <div className="bg-red-50 border border-gray-200 text-red-800 rounded-xl p-4">{error}</div>;

  const safeGrades = Array.isArray(grades) ? grades : [];
  const levelEntry = levelScoreEntry[user?.aral_level || 'basic'];
  const dailyGrades = safeGrades.filter((grade) => grade.component_type === 'assessment');
  const sortedDailyGrades = [...dailyGrades].sort((a, b) => new Date(b.date_logged).getTime() - new Date(a.date_logged).getTime());

  const dailyGroups = dailyGrades.reduce((acc, grade) => {
    const date = new Date(grade.date_logged);
    const dateKey = date.toISOString().slice(0, 10);
    const group = acc[dateKey] || { date, grades: [] as Grade[] };
    group.grades.push(grade);
    acc[dateKey] = group;
    return acc;
  }, {} as Record<string, { date: Date; grades: Grade[] }>);

  const dailyRows = Object.values(dailyGroups)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((group) => ({
      date: group.date,
      grades: group.grades.sort((a, b) => new Date(b.date_logged).getTime() - new Date(a.date_logged).getTime())
    }));

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const weeklyGroups = dailyGrades.reduce((acc, grade) => {
    const date = new Date(grade.date_logged);
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().slice(0, 10);
    const group = acc[weekKey] || { weekStart, grades: [] as Grade[] };
    group.grades.push(grade);
    acc[weekKey] = group;
    return acc;
  }, {} as Record<string, { weekStart: Date; grades: Grade[] }>);

  const weeklyRows = Object.values(weeklyGroups)
    .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
    .map((group) => ({
      weekStart: group.weekStart,
      weekEnd: new Date(group.weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
      grades: group.grades.sort((a, b) => new Date(b.date_logged).getTime() - new Date(a.date_logged).getTime())
    }));

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold">Tutor Daily Score Entry</h2>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl">
            Log daily Reading scores for students and review recent records by day or week.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={() => setExportModalConfig({ isOpen: true, mode: 'all', targetKey: '' })}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            📊 Export Score Sheet
          </button>
          <button
            type="button"
            onClick={() => handleOpenAddEntry()}
            className="inline-flex items-center justify-center rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-dark)]"
          >
            Add Score Entry
          </button>
          <button
            type="button"
            onClick={() => handleOpenAddEntry(levelEntry.kind)}
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-light)] px-5 py-3 text-sm font-semibold text-[var(--brand-dark)] shadow-sm transition hover:bg-[var(--brand-border)]"
          >
            {levelEntry.buttonLabel}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {showAddEntry && (
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 text-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Add score entry</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">
                  {entryKind === 'daily'
                    ? 'Daily Reading score'
                    : Object.values(levelScoreEntry).find((entry) => entry.kind === entryKind)?.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">Log today&apos;s score for each assigned student.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEntry(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="grid gap-4 lg:grid-cols-1">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Date</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-4 gap-3 rounded-3xl bg-slate-50 p-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <span>Student</span>
                  <span>Score</span>
                  <span>Total Score</span>
                  <span>Status</span>
                </div>

                <div className="mt-3 space-y-3">
                  {students.map((student) => {
                    const status = entryStatus[student.id] || 'Not';
                    const isNotTaken = status === 'Not';

                    return (
                      <div key={student.id} className="grid grid-cols-4 gap-3 rounded-3xl border border-slate-200 bg-white p-3 items-center">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                            {student.first_name?.[0] || student.full_name?.[0]}
                          </div>
                          <div className="text-sm font-medium text-slate-900">{student.full_name}</div>
                        </div>

                        <div>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            max={typeof totalScore === 'number' ? totalScore : undefined}
                            value={isNotTaken ? 0 : entryScores[student.id] ?? ''}
                            onChange={(e) => {
                              const rawValue = e.target.value;
                              let value: number | '' = rawValue === '' ? '' : Number(rawValue);
                              if (typeof value === 'number' && typeof totalScore === 'number' && value > totalScore) {
                                value = totalScore;
                              }
                              setEntryScores((prev) => ({
                                ...prev,
                                [student.id]: value
                              }));
                            }}
                            placeholder="Score"
                            disabled={isNotTaken}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={totalScore === '' ? '' : totalScore}
                            onChange={(e) => {
                              const newTotal = e.target.value === '' ? '' : Number(e.target.value);
                              setTotalScore(newTotal);
                              if (typeof newTotal === 'number') {
                                setEntryScores((prev) => {
                                  const updated: Record<string, number | ''> = {};
                                  Object.entries(prev).forEach(([key, score]) => {
                                    if (typeof score === 'number' && score > newTotal) {
                                      updated[key] = newTotal;
                                    } else {
                                      updated[key] = score;
                                    }
                                  });
                                  return updated;
                                });
                              }
                            }}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--brand)]"
                          />
                        </div>

                        <div>
                          <select
                            value={status}
                            onChange={(e) => {
                              const newStatus = e.target.value as 'Taken' | 'Not';
                              setEntryStatus((prev) => ({
                                ...prev,
                                [student.id]: newStatus
                              }));
                              if (newStatus === 'Not') {
                                setEntryScores((prev) => ({
                                  ...prev,
                                  [student.id]: 0
                                }));
                              }
                            }}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--brand)]"
                          >
                            <option value="Taken">Taken</option>
                            <option value="Not">Not</option>
                          </select>
                          {isNotTaken && (
                            <p className="mt-2 text-xs text-amber-600">Not taken entries are automatically zeroed.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">The total score applies to every student entry.</p>
              <button
                type="button"
                onClick={handleAddScore}
                disabled={isSaving}
                className="inline-flex items-center justify-center rounded-3xl bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save Scores'}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Score records</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">Recent entries</h3>
              <p className="mt-1 text-sm text-slate-500">Switch between daily and weekly record views.</p>
            </div>
            <div className="inline-flex gap-2 rounded-full bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${viewMode === 'daily' ? 'bg-[var(--brand)] text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setViewMode('weekly')}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${viewMode === 'weekly' ? 'bg-[var(--brand)] text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                Weekly
              </button>
            </div>
          </div>

          {gradesLoading ? (
            <div className="mt-8 text-center text-slate-500">Loading records...</div>
          ) : sortedDailyGrades.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No daily score records found. Add an entry to get started.
            </div>
          ) : viewMode === 'daily' ? (
            <div className="mt-8 space-y-4">
              {dailyRows.map((day) => (
                <div key={day.date.toISOString()} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="bg-slate-50 px-5 py-4 flex flex-row items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{day.date.toLocaleDateString()}</h4>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{day.grades.length} score entr{day.grades.length === 1 ? 'y' : 'ies'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExportModalConfig({
                          isOpen: true,
                          mode: 'daily',
                          targetKey: day.date.toISOString().slice(0, 10)
                        })
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                    >
                      📊 Export Day
                    </button>
                  </div>
                  <div className="divide-y divide-slate-200 bg-white px-5 py-4">
                    {day.grades.map((grade) => (
                      <div key={grade.id} className="grid grid-cols-[1.2fr_0.9fr] gap-4 py-3 sm:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr]">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{grade.student_name}</p>
                          <p className="text-xs text-slate-500">{new Date(grade.date_logged).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="text-right sm:text-left">
                          <p className="text-sm text-slate-500">Score</p>
                          <p className="mt-1 text-lg font-semibold text-[var(--brand)]">{grade.score}</p>
                        </div>
                        <div className="text-right sm:text-left">
                          <p className="text-sm text-slate-500">Total</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{grade.total_score}</p>
                        </div>
                        <div className="text-right sm:text-left">
                          <p className="text-sm text-slate-500">Status</p>
                          <p className="mt-1 text-sm text-slate-600">{grade.remarks || 'N/A'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              {weeklyRows.map((row) => (
                <div key={row.weekStart.toISOString()} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{row.weekStart.toLocaleDateString()} - {row.weekEnd.toLocaleDateString()}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500 mt-0.5">{row.grades.length} entries</p>
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
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                    >
                      📊 Export Week
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {row.grades.map((grade) => (
                      <div key={grade.id} className="grid grid-cols-[1.2fr_0.9fr] gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr]">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{grade.student_name}</p>
                          <p className="text-xs text-slate-500">{new Date(grade.date_logged).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right sm:text-left">
                          <p className="text-sm text-slate-500">Score</p>
                          <p className="mt-1 text-lg font-semibold text-[var(--brand)]">{grade.score}</p>
                        </div>
                        <div className="text-right sm:text-left">
                          <p className="text-sm text-slate-500">Total</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{grade.total_score}</p>
                        </div>
                        <div className="text-right sm:text-left">
                          <p className="text-sm text-slate-500">Status</p>
                          <p className="mt-1 text-sm text-slate-600">{grade.remarks || 'N/A'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
