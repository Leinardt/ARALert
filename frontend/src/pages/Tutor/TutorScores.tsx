import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { Grade, User } from '../../types';
import { downloadPdf } from '../../utils/pdfExport';

const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const parseDateLogged = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const TutorScores: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryScores, setEntryScores] = useState<Record<string, number | ''>>({});
  const [entryStatus, setEntryStatus] = useState<Record<string, 'Taken' | 'Not'>>({});
  const [totalScore, setTotalScore] = useState<number | ''>(20);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [selectedExportKey, setSelectedExportKey] = useState('');

  const fetchGrades = async () => {
    setGradesLoading(true);
    try {
      const gradeData = await academicService.getGrades();
      setGrades(Array.isArray(gradeData) ? gradeData : []);
    } catch (err) {
      console.error(err);
      setGrades([]);
      setError('Failed to load score records.');
    } finally {
      setGradesLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      if (!user) {
        setStudents([]);
        setIsLoading(false);
        return;
      }
      const data = await userService.getUsers({ role: 'student', assigned_tutor: user.id });
      setStudents(Array.isArray(data?.results) ? data.results : []);
    } catch (err) {
      console.error(err);
      setStudents([]);
      setError('Failed to load assigned students.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddEntry = () => {
    const initialScores: Record<string, number | ''> = {};
    const initialStatus: Record<string, 'Taken' | 'Not'> = {};

    students.forEach((student) => {
      initialScores[student.id] = '';
      initialStatus[student.id] = 'Taken';
    });

    setEntryScores(initialScores);
    setEntryStatus(initialStatus);
    setTotalScore(20);
    setShowAddEntry(true);
  };

  const handleAddScore = async () => {
    if (Object.values(entryScores).every((score) => score === '')) {
      return alert('Enter at least one student score.');
    }

    const zeroTakenStudents = students.filter(
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
      const entries: Partial<Grade>[] = students.map((student) => ({
        student: student.id,
        component_type: 'assessment' as Grade['component_type'],
        subject: 'Reading',
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
      alert('Daily Reading scores logged successfully.');
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail || 'Failed to log scores.');
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

  const assignedStudents = Array.isArray(students) ? students : [];
  const gradeList = Array.isArray(grades) ? grades : [];
  const dailyGrades = gradeList.filter(
    (grade) => grade.component_type === 'assessment' && parseDateLogged(grade.date_logged) !== null
  );
  const sortedDailyGrades = [...dailyGrades].sort((a, b) => {
    const dateA = parseDateLogged(a.date_logged)?.getTime() ?? 0;
    const dateB = parseDateLogged(b.date_logged)?.getTime() ?? 0;
    return dateB - dateA;
  });

  const dailyGroups = dailyGrades.reduce((acc, grade) => {
    const date = parseDateLogged(grade.date_logged);
    if (!date) return acc;
    const dateKey = date.toISOString().slice(0, 10);
    const group = acc[dateKey] || { date, grades: [] as Grade[] };
    group.grades.push(grade);
    acc[dateKey] = group;
    return acc;
  }, {} as Record<string, { date: Date; grades: Grade[] }>);

  const dailyRows = Object.values(dailyGroups)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((group) => ({
      key: group.date.toISOString().slice(0, 10),
      date: group.date,
      grades: group.grades.sort((a, b) => {
        const dateA = parseDateLogged(a.date_logged)?.getTime() ?? 0;
        const dateB = parseDateLogged(b.date_logged)?.getTime() ?? 0;
        return dateB - dateA;
      })
    }));

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const weeklyGroups = dailyGrades.reduce((acc, grade) => {
    const date = parseDateLogged(grade.date_logged);
    if (!date) return acc;
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
      key: group.weekStart.toISOString().slice(0, 10),
      weekStart: group.weekStart,
      weekEnd: new Date(group.weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
      grades: group.grades.sort((a, b) => {
        const dateA = parseDateLogged(a.date_logged)?.getTime() ?? 0;
        const dateB = parseDateLogged(b.date_logged)?.getTime() ?? 0;
        return dateB - dateA;
      })
    }));

  useEffect(() => {
    if (viewMode === 'daily') {
      if (dailyRows.length > 0 && !dailyRows.some((row) => row.key === selectedExportKey)) {
        setSelectedExportKey(dailyRows[0].key);
      }
    } else if (weeklyRows.length > 0 && !weeklyRows.some((row) => row.key === selectedExportKey)) {
      setSelectedExportKey(weeklyRows[0].key);
    }
  }, [dailyRows, weeklyRows, selectedExportKey, viewMode]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-600 shadow-sm">
        <p className="text-lg font-semibold text-slate-900">Loading score entry…</p>
        <p className="mt-2 text-sm">Preparing your student list and recent records.</p>
      </div>
    );
  }

  const handleExportScores = async () => {
    const rowsToExport = viewMode === 'daily'
      ? dailyRows.find((row) => row.key === selectedExportKey)
      : weeklyRows.find((row) => row.key === selectedExportKey);

    if (!rowsToExport) {
      alert('Select a day or week to export first.');
      return;
    }

    const exportRows = rowsToExport.grades.map((grade) => {
      const student = assignedStudents.find((entry) => entry.id === grade.student);
      const aralLevel = student?.aral_level && ['basic', 'plus'].includes(student.aral_level)
        ? student.aral_level
        : '';

      return {
        Student: grade.student_name || grade.student,
        Score: grade.score,
        'Total Score': grade.total_score,
        Status: grade.remarks || 'N/A',
        Date: parseDateLogged(grade.date_logged)?.toLocaleString() ?? 'Unknown date',
        Subject: 'Reading',
        'ARAL Level': aralLevel
      };
    });

    try {
      const XLSXModule = await import('xlsx');
      const XLSX = (XLSXModule as any).default ?? XLSXModule;
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, viewMode === 'daily' ? 'Daily Scores' : 'Weekly Scores');

      const workbookOut = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([workbookOut], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${viewMode === 'daily' ? 'daily-scores' : 'weekly-scores'}-${selectedExportKey}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel export failed, falling back to CSV.', error);
      const csvLines = [
        ['Student', 'Score', 'Total Score', 'Status', 'Date', 'Subject', 'ARAL Level'].join(','),
        ...exportRows.map((row) => [
          row.Student,
          row.Score,
          row['Total Score'],
          row.Status,
          row.Date,
          row.Subject,
          row['ARAL Level']
        ].map((value) => String(value).replace(/"/g, '""')).map((value) => (value.includes(',') || value.includes('"') || value.includes('\n') ? `"${value}"` : value)).join(','))
      ];
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${viewMode === 'daily' ? 'daily-scores' : 'weekly-scores'}-${selectedExportKey}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleExportScoresPdf = async () => {
    const rowsToExport = viewMode === 'daily'
      ? dailyRows.find((row) => row.key === selectedExportKey)
      : weeklyRows.find((row) => row.key === selectedExportKey);

    if (!rowsToExport) {
      alert('Select a day or week to export first.');
      return;
    }

    const rows = rowsToExport.grades.map((grade) => {
      const student = assignedStudents.find((entry) => entry.id === grade.student);
      const aralLevel = student?.aral_level && ['basic', 'plus'].includes(student.aral_level)
        ? student.aral_level
        : '';

      return [
        grade.student_name || grade.student,
        grade.score,
        grade.total_score,
        grade.remarks || 'N/A',
        parseDateLogged(grade.date_logged)?.toLocaleString() ?? 'Unknown date',
        'Reading',
        aralLevel
      ];
    });

    try {
      await downloadPdf(
        `${viewMode === 'daily' ? 'daily-scores' : 'weekly-scores'}-${selectedExportKey}.pdf`,
        `Tutor Score Entry ${viewMode === 'daily' ? 'Daily' : 'Weekly'}`,
        ['Student', 'Score', 'Total Score', 'Status', 'Date', 'Subject', 'ARAL Level'],
        rows
      );
    } catch (error) {
      console.error('Score PDF export failed.', error);
      alert('Unable to export PDF file right now.');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tutor score entry</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-900">Score Entry</h3>
        <p className="mt-1 text-sm text-slate-500">Use this page to log and review reading scores for your assigned students.</p>
      </div>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold">Tutor Daily Score Entry</h2>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl">
            Log daily Reading scores for students and review recent records by day or week.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenAddEntry()}
          className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Add Score Entry
        </button>
      </div>

      <div className="space-y-6">
        {showAddEntry && (
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 text-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Add score entry</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Daily Reading score</h3>
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
                  {assignedStudents.map((student) => {
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
                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
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
                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500"
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
                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500"
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
                className="inline-flex items-center justify-center rounded-3xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex gap-2 rounded-full bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('daily')}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${viewMode === 'daily' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('weekly')}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${viewMode === 'weekly' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
                  >
                    Weekly
                  </button>
                </div>

                <select
                  value={selectedExportKey}
                  onChange={(event) => setSelectedExportKey(event.target.value)}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500"
                >
                  {viewMode === 'daily' ? (
                    dailyRows.map((row) => (
                      <option key={row.key} value={row.key}>
                        {row.date.toLocaleDateString()}
                      </option>
                    ))
                  ) : (
                    weeklyRows.map((row) => (
                      <option key={row.key} value={row.key}>
                        {row.weekStart.toLocaleDateString()} - {row.weekEnd.toLocaleDateString()}
                      </option>
                    ))
                  )}
                </select>

                <button
                  type="button"
                  onClick={handleExportScores}
                  className="inline-flex items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportScoresPdf}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Export PDF
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
                    <div className="bg-slate-50 px-5 py-4">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{day.date.toLocaleDateString()}</h4>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{day.grades.length} score entr{day.grades.length === 1 ? 'y' : 'ies'}</p>
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
                            <p className="mt-1 text-lg font-semibold text-indigo-600">{grade.score}</p>
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
                      <p className="text-sm font-semibold text-slate-900">{row.weekStart.toLocaleDateString()} - {row.weekEnd.toLocaleDateString()}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{row.grades.length} entries</p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {row.grades.map((grade) => (
                        <div key={grade.id} className="grid grid-cols-[1.2fr_0.9fr] gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr]">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{grade.student_name}</p>
                            <p className="text-xs text-slate-500">
                              {parseDateLogged(grade.date_logged)
                                ? parseDateLogged(grade.date_logged)!.toLocaleDateString()
                                : 'Unknown date'}
                            </p>
                          </div>
                          <div className="text-right sm:text-left">
                            <p className="text-sm text-slate-500">Score</p>
                            <p className="mt-1 text-lg font-semibold text-indigo-600">{grade.score}</p>
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
      </div>
  );
};

export default TutorScores;
