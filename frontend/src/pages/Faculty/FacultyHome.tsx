import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, UsersRound } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance } from '../../types';

const formatDate = (date: string) => {
  const parsedDate = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsedDate.getTime())
    ? date
    : parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const FacultyHome: React.FC = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const loadAttendance = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const history = await academicService.getAttendanceHistory({ user_id: user.id });
        setAttendance(history);
      } catch (err) {
        console.error('Failed to load faculty attendance history', err);
        setError('Unable to load attendance data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadAttendance();
  }, [user?.id]);

  const attendanceRate = useMemo(() => {
    if (!attendance.length) return 0;
    const presentCount = attendance.filter((entry) => entry.status.toLowerCase() === 'present').length;
    return Math.round((presentCount / attendance.length) * 100);
  }, [attendance]);

  const chartPoints = useMemo(() => {
    const chronologicalRecords = [...attendance]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-8);

    let presentCount = 0;
    return chronologicalRecords.map((entry, index) => {
      if (entry.status.toLowerCase() === 'present') presentCount += 1;
      return {
        label: formatDate(entry.date),
        rate: Math.round((presentCount / (index + 1)) * 100),
      };
    });
  }, [attendance]);

  const facultyType = user?.faculty_type?.trim() || 'Not assigned';
  const chartWidth = 420;
  const chartHeight = 210;
  const chartPadding = { top: 18, right: 18, bottom: 38, left: 36 };
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const pointCoordinates = chartPoints.map((point, index) => ({
    ...point,
    x: chartPadding.left + (chartPoints.length === 1 ? plotWidth / 2 : (index * plotWidth) / (chartPoints.length - 1)),
    y: chartPadding.top + plotHeight - (point.rate / 100) * plotHeight,
  }));
  const linePath = pointCoordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
      <section style={{ background: '#fff', border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--brand-light)', color: 'var(--brand-dark)' }}>
          <UsersRound size={21} />
        </div>
        <p style={{ margin: '1.25rem 0 0.3rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Faculty Type</p>
        <h1 style={{ margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 800 }}>{facultyType}</h1>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: '#E6F7ED', color: '#097337' }}>
          <Activity size={21} />
        </div>
        <p style={{ margin: '1.25rem 0 0.3rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Average Attendance Rate</p>
        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: '2.15rem', fontWeight: 800 }}>{attendanceRate}%</h2>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{attendance.length} recorded {attendance.length === 1 ? 'day' : 'days'}</p>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-xs)', gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={20} color="var(--brand-dark)" />
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 700 }}>Your Attendance Rate</h2>
        </div>

        {isLoading ? (
          <p style={{ color: 'var(--text-muted)', margin: '2.5rem 0', textAlign: 'center' }}>Loading attendance rate…</p>
        ) : error ? (
          <p style={{ color: '#B91C1C', margin: '2.5rem 0', textAlign: 'center' }}>{error}</p>
        ) : chartPoints.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: '2.5rem 0', textAlign: 'center' }}>No attendance records yet.</p>
        ) : (
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Faculty attendance rate chart" style={{ width: '100%', height: 230, marginTop: '1rem', overflow: 'visible' }}>
            {[0, 50, 100].map((rate) => {
              const y = chartPadding.top + plotHeight - (rate / 100) * plotHeight;
              return <g key={rate}><line x1={chartPadding.left} y1={y} x2={chartWidth - chartPadding.right} y2={y} stroke="#E2E8F0" /><text x={chartPadding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748B">{rate}%</text></g>;
            })}
            <path d={linePath} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {pointCoordinates.map((point) => <g key={`${point.label}-${point.x}`}><circle cx={point.x} cy={point.y} r="4" fill="var(--brand)" /><text x={point.x} y={chartHeight - 12} textAnchor="middle" fontSize="10" fill="#64748B">{point.label}</text></g>)}
          </svg>
        )}
      </section>
    </div>
  );
};
