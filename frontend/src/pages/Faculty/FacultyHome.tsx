import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';

const statusStyles: Record<string, string> = {
  present: 'bg-emerald-500 text-emerald-700',
  late: 'bg-amber-500 text-amber-700',
  absent: 'bg-rose-500 text-rose-700'
};

const statusLabels: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent'
};

const formatDateLabel = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const FacultyHome: React.FC = () => {
  const { user } = useAuth();
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const logs = await academicService.getAttendanceHistory({ user_id: user.id });
        const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAttendanceLogs(sortedLogs);
      } catch (error) {
        console.error('Failed to load faculty attendance data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [user?.id]);

  const summary = useMemo(() => {
    if (!attendanceLogs.length) {
      return {
        rate: 0,
        present: 0,
        late: 0,
        absent: 0
      };
    }

    const present = attendanceLogs.filter((entry) => entry.status === 'present').length;
    const late = attendanceLogs.filter((entry) => entry.status === 'late').length;
    const absent = attendanceLogs.filter((entry) => entry.status === 'absent').length;
    const rate = Number((((present + late) / attendanceLogs.length) * 100).toFixed(1));

    return { rate, present, late, absent };
  }, [attendanceLogs]);

  const chartData = useMemo(() => {
    const grouped = attendanceLogs.reduce((acc, entry) => {
      const bucket = acc.get(entry.date) ?? { date: entry.date, present: 0, late: 0, absent: 0, early_out: 0, total: 0 };
      bucket[entry.status as 'present' | 'late' | 'absent' | 'early_out'] += 1;
      bucket.total += 1;
      acc.set(entry.date, bucket);
      return acc;
    }, new Map<string, { date: string; present: number; late: number; absent: number; early_out: number; total: number }>());

    return Array.from(grouped.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
      .map((day) => ({
        ...day,
        rate: day.total ? Number((((day.present + day.late) / day.total) * 100).toFixed(1)) : 0
      }));
  }, [attendanceLogs]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Faculty dashboard</p>
            <h2 className="text-2xl font-bold text-gray-900">Attendance overview</h2>
            <p className="mt-2 text-gray-600">
              Hello {user?.full_name || user?.username}, here is your latest attendance performance and recent history.
            </p>
          </div>
          <div className="rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700">
            {summary.rate}% attendance rate
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Attendance rate</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{summary.rate}%</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Present</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-600">{summary.present}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Late</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">{summary.late}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Absent</p>
          <p className="mt-2 text-3xl font-semibold text-rose-600">{summary.absent}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Attendance rate chart</h3>
            <p className="text-sm text-gray-500">Recent attendance trend over the last recorded days.</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 h-48 flex items-center justify-center text-sm text-gray-500">Loading attendance chart…</div>
        ) : chartData.length ? (
          <div className="mt-6 flex h-48 items-end gap-3">
            {chartData.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-36 w-full items-end rounded-lg bg-gray-100 p-1">
                  <div
                    className="w-full rounded-md bg-gradient-to-t from-teal-600 to-emerald-500"
                    style={{ height: `${Math.max(day.rate, 8)}%` }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-600">{formatDateLabel(day.date)}</p>
                  <p className="text-xs text-gray-500">{day.rate}%</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 h-48 flex items-center justify-center text-sm text-gray-500">
            No attendance records yet for this faculty account.
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Attendance history</h3>
            <p className="text-sm text-gray-500">Most recent attendance entries for your account.</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-gray-500">Loading attendance history…</div>
        ) : attendanceLogs.length ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Time in</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Time out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {attendanceLogs.slice(0, 10).map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{formatDateLabel(entry.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[entry.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabels[entry.status] || entry.status_display}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.time_in || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.time_out || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
            No attendance history is available yet.
          </div>
        )}
      </div>
    </div>
  );
};
