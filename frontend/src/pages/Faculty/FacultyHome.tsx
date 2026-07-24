import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { UserStats, AcademicRisk, Grade, Attendance } from '../../types';
import { Link } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  AlertTriangle,
  Activity,
  Scan,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export const FacultyHome: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [risks, setRisks] = useState<AcademicRisk[]>([]);
  const [recentLogs, setRecentLogs] = useState<Attendance[]>([]);
  const [recentGrades, setRecentGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [statsData, riskData, attendanceData, gradeData] = await Promise.all([
          userService.getStats().catch(() => null),
          academicService.getAcademicRisks().catch(() => []),
          academicService.getAttendanceHistory().catch(() => []),
          academicService.getGrades().catch(() => []),
        ]);

        if (statsData) setStats(statsData);
        setRisks(riskData.slice(0, 5));
        setRecentLogs(attendanceData.slice(0, 5));
        setRecentGrades(gradeData.slice(0, 5));
      } catch (err: unknown) {
        console.error('Failed to load faculty dashboard data', err);
        setError('Unable to load full faculty metrics.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Welcome Banner ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '320px',
            height: '100%',
            background: 'radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.25) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-pill)', padding: '0.35rem 0.85rem', fontSize: '0.75rem', color: '#6EE7B7', fontWeight: 700, letterSpacing: '0.04em' }}>
            <ShieldCheck size={14} /> FACULTY MONITORING PORTAL
          </div>

          <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
            Welcome back, {user?.first_name || user?.full_name || 'Faculty Member'}!
          </h1>

          <p style={{ margin: 0, color: 'var(--slate-400)', fontSize: '0.9rem', maxWidth: '640px', lineHeight: 1.6 }}>
            Track overall ARAL program progress, review student intervention flags, and submit daily attendance verification seamlessly.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <Link
              to="/staff/scan"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', borderRadius: 'var(--radius-md)' }}
            >
              <Scan size={16} /> Clock In / Out (QR Scan)
            </Link>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-xl)', padding: '3rem', border: '1px solid var(--slate-200)', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading dashboard insights…
        </div>
      ) : error ? (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
          {error}
        </div>
      ) : (
        <>
          {/* ── Key Metrics Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div style={{ background: '#fff', borderRadius: 'var(--radius-xl)', padding: '1.25rem 1.5rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Total Students</span>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-dark)' }}>
                  <Users size={20} />
                </div>
              </div>
              <p style={{ margin: '0.75rem 0 0', fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                {stats?.students ?? 0}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Assigned: {stats?.assigned_students ?? 0} · Unassigned: {stats?.unassigned_students ?? 0}
              </p>
            </div>

            <div style={{ background: '#fff', borderRadius: 'var(--radius-xl)', padding: '1.25rem 1.5rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Average Score</span>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <GraduationCap size={20} />
                </div>
              </div>
              <p style={{ margin: '0.75rem 0 0', fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                {stats?.academic_summary?.average_score ?? 0}%
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Across {stats?.academic_summary?.grade_entries ?? 0} recorded evaluations
              </p>
            </div>

            <div style={{ background: '#fff', borderRadius: 'var(--radius-xl)', padding: '1.25rem 1.5rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Attendance Rate</span>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#E6F7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#097337' }}>
                  <Activity size={20} />
                </div>
              </div>
              <p style={{ margin: '0.75rem 0 0', fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                {stats?.academic_summary?.average_attendance_rate ?? 0}%
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {stats?.attendance_summary?.present ?? 0} Present · {stats?.attendance_summary?.late ?? 0} Late · {stats?.attendance_summary?.absent ?? 0} Absent
              </p>
            </div>

            <div style={{ background: '#fff', borderRadius: 'var(--radius-xl)', padding: '1.25rem 1.5rem', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>High-Risk Alerts</span>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                  <AlertTriangle size={20} />
                </div>
              </div>
              <p style={{ margin: '0.75rem 0 0', fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                {stats?.risk_summary?.high ?? 0}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Medium: {stats?.risk_summary?.medium ?? 0} · Resolved: {stats?.risk_summary?.resolved ?? 0}
              </p>
            </div>
          </div>

          {/* ── Two Column Details ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            {/* Active Academic Risks */}
            <div style={{ background: '#fff', borderRadius: 'var(--radius-xl)', border: '1px solid var(--slate-200)', padding: '1.5rem', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={18} color="#EF4444" /> Urgent Intervention Warnings
                </h2>
              </div>

              {risks.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No active risk alerts reported.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {risks.map((risk) => (
                    <div
                      key={risk.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background: risk.risk_level === 'high' ? '#FEF2F2' : risk.risk_level === 'medium' ? '#FFFBEB' : 'var(--surface-muted)',
                        border: `1px solid ${risk.risk_level === 'high' ? '#FECACA' : risk.risk_level === 'medium' ? '#FDE68A' : 'var(--slate-200)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {risk.student_name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '99px',
                            background: risk.risk_level === 'high' ? '#EF4444' : risk.risk_level === 'medium' ? '#F59E0B' : '#64748B',
                            color: '#fff',
                          }}
                        >
                          {risk.risk_level}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {risk.details || 'Intervention required due to score/attendance threshold.'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attendance & Activity Log */}
            <div style={{ background: '#fff', borderRadius: 'var(--radius-xl)', border: '1px solid var(--slate-200)', padding: '1.5rem', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} color="var(--brand-dark)" /> Recent Session Logs
                </h2>
              </div>

              {recentLogs.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No recent attendance logs.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-muted)',
                        border: '1px solid var(--slate-200)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {log.user_name}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {log.date} · In: {log.time_in || 'N/A'} | Out: {log.time_out || 'N/A'}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: log.status === 'present' ? '#ECFDF5' : log.status === 'late' ? '#FFFBEB' : '#FEF2F2',
                          color: log.status === 'present' ? '#065F46' : log.status === 'late' ? '#92400E' : '#991B1B',
                          border: `1px solid ${log.status === 'present' ? '#A7F3D0' : log.status === 'late' ? '#FDE68A' : '#FECACA'}`,
                        }}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
