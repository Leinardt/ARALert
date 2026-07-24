import React, { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, Users, User as UserIcon, LogOut, QrCode, Scan,
  Award, Bell, ChevronDown, Shield, BookOpen, BarChart2, X, Activity,
} from 'lucide-react';
import { userService } from '../services/userService';
import { academicService } from '../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../utils/analyticsHelpers';
import type { AcademicRisk } from '../types';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleLabel = () => {
    if (!user) return '';
    if (user.is_superuser) return 'Super Admin';
    return user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
  };

  const getPageTitle = () => {
    const p = location.pathname;
    if (p.includes('/audit-logs')) return 'Audit Trail';
    if (p.includes('/superadmin/users') || p.includes('/admin/students')) return 'User Management';
    if (p.includes('/profile')) return 'Profile & Settings';
    if (p.includes('/settings')) return 'System Settings';
    if (p.includes('/analytics')) return 'Data Analytics';
    if (p.includes('/scores')) return 'Score Entry';
    if (p.includes('/attendance') || p.includes('/scan')) return 'Attendance';
    return 'Dashboard';
  };

  const [highRiskCount, setHighRiskCount] = useState(0);
  const [highRiskStudents, setHighRiskStudents] = useState<StudentRiskRow[]>([]);
  const [moderateRiskStudents, setModerateRiskStudents] = useState<StudentRiskRow[]>([]);
  const [showRiskList, setShowRiskList] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [acknowledgingStudent, setAcknowledgingStudent] = useState<StudentRiskRow | null>(null);
  const [acknowledgeNote, setAcknowledgeNote] = useState('');
  const [acknowledgedNotes, setAcknowledgedNotes] = useState<Record<string, string>>({});
  const [acknowledgedRiskIds, setAcknowledgedRiskIds] = useState<Record<string, number>>({});

  const isActive = (path: string) => location.pathname === path;
  const isActivePrefix = (prefix: string) => location.pathname.startsWith(prefix);

  const navLinkClass = (active: boolean) =>
    `sidebar-item ${active ? 'active' : ''}`;

  const fetchRiskStudents = async () => {
    if (!user || user.role !== 'tutor') return;
    try {
      const [studentRes, grades, attendanceLogs, riskRecords] = await Promise.all([
        userService.getUsers({ role: 'student', assigned_tutor: user.id }),
        academicService.getGrades(),
        academicService.getAttendanceHistory(),
        academicService.getAcademicRisks(),
      ]);

      const rows = computeStudentRiskRows(studentRes.results, grades, attendanceLogs);
      const highRiskRows = rows.filter((r) => r.riskTier === 'High').sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5);
      const moderateRiskRows = rows.filter((r) => r.riskTier === 'Medium').sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5);

      const latestResolvedRiskByStudent = riskRecords
        .filter((risk) => risk.resolved)
        .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime())
        .reduce<Record<string, AcademicRisk>>((acc, risk) => {
          if (!acc[risk.student]) acc[risk.student] = risk;
          return acc;
        }, {});

      setHighRiskStudents(highRiskRows);
      setModerateRiskStudents(moderateRiskRows);
      setHighRiskCount(highRiskRows.length + moderateRiskRows.length);
      setAcknowledgedNotes(Object.fromEntries(Object.entries(latestResolvedRiskByStudent).map(([id, r]) => [id, r.details])));
      setAcknowledgedRiskIds(Object.fromEntries(Object.entries(latestResolvedRiskByStudent).map(([id, r]) => [id, r.id])));
    } catch (error) {
      console.error('Failed to load tutor alerts', error);
    }
  };

  const handleAcknowledgeInitiate = (row: StudentRiskRow) => {
    setAcknowledgingStudent(row);
    setAcknowledgeNote(acknowledgedNotes[row.student.id] ?? '');
  };

  const handleAcknowledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledgingStudent) return;
    const noteText = acknowledgeNote || `Acknowledged ${acknowledgingStudent.student.full_name}`;
    const existingRiskId = acknowledgedRiskIds[acknowledgingStudent.student.id];
    try {
      if (existingRiskId) {
        await academicService.updateAcademicRisk(existingRiskId, { details: noteText, resolved: true });
      } else {
        const newRisk = await academicService.createAcademicRisk({
          student: acknowledgingStudent.student.id,
          risk_level: 'high',
          details: noteText,
          resolved: true,
        });
        setAcknowledgedRiskIds((prev) => ({ ...prev, [acknowledgingStudent.student.id]: newRisk.id }));
      }
      setAcknowledgedNotes((prev) => ({ ...prev, [acknowledgingStudent.student.id]: noteText }));
      setAcknowledgingStudent(null);
      setAcknowledgeNote('');
      await fetchRiskStudents();
      setShowRiskList(true);
    } catch (error) {
      console.error('Failed to acknowledge risk', error);
      alert('Failed to acknowledge the risk. Please try again.');
    }
  };

  const handleAcknowledgeCancel = () => {
    setAcknowledgingStudent(null);
    setAcknowledgeNote('');
  };

  useEffect(() => { fetchRiskStudents(); }, [user]);
  useEffect(() => { if (!showRiskList) return; fetchRiskStudents(); }, [showRiskList]);
  useEffect(() => { setProfileMenuOpen(false); }, [location.pathname]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--surface-bg)', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>

      {/* ── Sidebar ───────────────────────────────────── */}
      <aside
        style={{
          width: '260px',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          borderRight: '1px solid var(--slate-200)',
          zIndex: 20,
          position: 'relative',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '1.25rem 1.25rem 1rem',
            borderBottom: '1px solid var(--slate-100)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <img
            src="/src/assets/ARALert_LOGO.png"
            alt="ARALert"
            style={{ width: '32px', height: '32px', objectFit: 'contain', flexShrink: 0 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                fontSize: '1.1rem',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              ARALert
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.875rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {/* SuperAdmin nav */}
          {user?.is_superuser && (
            <>
              <span className="sidebar-section-label">Management</span>
              <Link to="/superadmin" className={navLinkClass(isActive('/superadmin'))}>
                <LayoutDashboard className="sidebar-icon" size={18} />
                Dashboard
              </Link>
              <Link
                to="/superadmin/users"
                className={navLinkClass(isActivePrefix('/superadmin/users'))}
              >
                <Users className="sidebar-icon" size={18} />
                User Management
              </Link>
              <Link
                to="/superadmin/audit-logs"
                className={navLinkClass(isActivePrefix('/superadmin/audit-logs'))}
              >
                <Activity className="sidebar-icon" size={18} />
                Audit Trail
              </Link>
              <Link
                to="/superadmin/settings"
                className={navLinkClass(isActivePrefix('/superadmin/settings'))}
              >
                <Shield className="sidebar-icon" size={18} />
                System Settings
              </Link>
            </>
          )}

          {/* Admin nav */}
          {user?.role === 'admin' && (
            <>
              <span className="sidebar-section-label">Admin Panel</span>
              <Link to="/admin" className={navLinkClass(isActive('/admin'))}>
                <LayoutDashboard className="sidebar-icon" size={18} />
                Dashboard
              </Link>
              <Link
                to="/admin/students"
                className={navLinkClass(isActivePrefix('/admin/students'))}
              >
                <Users className="sidebar-icon" size={18} />
                Student Directory
              </Link>
              <Link to="/admin/attendance" className={navLinkClass(isActive('/admin/attendance'))}>
                <QrCode className="sidebar-icon" size={18} />
                Staff QR Generator
              </Link>
            </>
          )}

          {/* Tutor nav */}
          {user?.role === 'tutor' && (
            <>
              <span className="sidebar-section-label">Workspace</span>
              <Link to="/tutor" className={navLinkClass(isActive('/tutor'))}>
                <LayoutDashboard className="sidebar-icon" size={18} />
                Workspace Home
              </Link>
              <Link to="/tutor/students" className={navLinkClass(isActive('/tutor/students'))}>
                <Users className="sidebar-icon" size={18} />
                Assigned Students
              </Link>
              <Link to="/tutor/scores" className={navLinkClass(isActive('/tutor/scores'))}>
                <Award className="sidebar-icon" size={18} />
                Score Entry
              </Link>
              <Link to="/tutor/analytics" className={navLinkClass(isActive('/tutor/analytics'))}>
                <BarChart2 className="sidebar-icon" size={18} />
                Data Analytics
              </Link>
              <span className="sidebar-section-label">Attendance</span>
              <Link
                to="/tutor/attendance/generate"
                className={navLinkClass(isActive('/tutor/attendance/generate'))}
              >
                <QrCode className="sidebar-icon" size={18} />
                QR Generator
              </Link>
              <Link to="/staff/scan" className={navLinkClass(isActive('/staff/scan'))}>
                <Scan className="sidebar-icon" size={18} />
                Clock In / Out
              </Link>
            </>
          )}

          {/* Principal nav */}
          {user?.role === 'principal' && (
            <>
              <span className="sidebar-section-label">Monitoring</span>
              <Link to="/principal" className={navLinkClass(isActive('/principal'))}>
                <LayoutDashboard className="sidebar-icon" size={18} />
                Monitoring Dashboard
              </Link>
              <Link to="/staff/scan" className={navLinkClass(isActive('/staff/scan'))}>
                <Scan className="sidebar-icon" size={18} />
                Clock In / Out
              </Link>
            </>
          )}

          {/* Faculty nav */}
          {user?.role === 'faculty' && (
            <>
              <span className="sidebar-section-label">Faculty</span>
              <Link to="/faculty" className={navLinkClass(isActive('/faculty'))}>
                <LayoutDashboard className="sidebar-icon" size={18} />
                Faculty Home
              </Link>
              <Link to="/staff/scan" className={navLinkClass(isActive('/staff/scan'))}>
                <Scan className="sidebar-icon" size={18} />
                Clock In / Out
              </Link>
            </>
          )}

          {/* Student nav */}
          {user?.role === 'student' && (
            <>
              <span className="sidebar-section-label">Student</span>
              <Link to="/student" className={navLinkClass(isActive('/student'))}>
                <BookOpen className="sidebar-icon" size={18} />
                My Dashboard
              </Link>
              <Link to="/staff/scan" className={navLinkClass(isActive('/staff/scan'))}>
                <Scan className="sidebar-icon" size={18} />
                Scan Attendance QR
              </Link>
            </>
          )}
        </nav>
      </aside>

      {/* ── Main Panel ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        {/* ── Top Bar ── */}
        <header
          style={{
            height: '64px',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--slate-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.75rem',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          {/* Page title */}
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                fontSize: '1.15rem',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              {getPageTitle()}
            </h1>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>

            {/* Notification Bell (tutor only) */}
            {user?.role === 'tutor' && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowRiskList((prev) => !prev)}
                  aria-label="Risk alerts"
                  style={{
                    position: 'relative',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--slate-200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    transition: 'var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--brand-light)';
                    e.currentTarget.style.color = 'var(--brand-dark)';
                    e.currentTarget.style.borderColor = 'var(--brand-border)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface-muted)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--slate-200)';
                  }}
                >
                  <Bell size={17} />
                  {highRiskCount > 0 && (
                    <span
                      className="animate-badge-pulse"
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        minWidth: '18px',
                        height: '18px',
                        padding: '0 4px',
                        borderRadius: '99px',
                        background: '#EF4444',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #fff',
                      }}
                    >
                      {highRiskCount}
                    </span>
                  )}
                </button>

                {/* Risk dropdown */}
                {showRiskList && (
                  <div
                    className="animate-fade-in-scale"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 10px)',
                      width: '380px',
                      background: '#fff',
                      border: '1px solid var(--slate-200)',
                      borderRadius: '18px',
                      boxShadow: 'var(--shadow-xl)',
                      zIndex: 50,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Dropdown header */}
                    <div
                      style={{
                        padding: '1rem 1.25rem',
                        background: 'var(--surface-muted)',
                        borderBottom: '1px solid var(--slate-200)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Academic Risk Alerts
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Students requiring intervention
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRiskList(false)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--slate-200)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {/* Risk list body */}
                    <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* High risk */}
                      <div style={{ background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: '12px', padding: '0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>High Risk</p>
                            <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#EF4444' }}>Immediate action required</p>
                          </div>
                          <span style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '0.7rem', fontWeight: 800, borderRadius: '99px', padding: '2px 8px', border: '1px solid #FECACA' }}>
                            {highRiskStudents.length}
                          </span>
                        </div>
                        {highRiskStudents.length === 0 ? (
                          <p style={{ fontSize: '0.8rem', color: '#EF4444', margin: 0 }}>No high-risk students detected.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {highRiskStudents.map((row) => (
                              <div key={`high-${row.student.id}`} style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: '10px', padding: '0.65rem 0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  <div>
                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{row.student.full_name}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      Score: {row.compositeScore}% · Attendance: {row.attendanceRate}%
                                    </p>
                                    {acknowledgedNotes[row.student.id] && (
                                      <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: 'var(--brand-dark)', fontWeight: 600 }}>✓ Note saved</p>
                                    )}
                                  </div>
                                  <span style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '0.62rem', fontWeight: 800, borderRadius: '6px', padding: '2px 6px', textTransform: 'uppercase', flexShrink: 0 }}>HIGH</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAcknowledgeInitiate(row)}
                                  style={{
                                    marginTop: '0.5rem',
                                    width: '100%',
                                    padding: '5px 10px',
                                    borderRadius: '7px',
                                    border: '1px solid var(--slate-200)',
                                    background: 'var(--surface-muted)',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'var(--transition-fast)',
                                    fontFamily: 'var(--font-body)',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-light)'; e.currentTarget.style.color = 'var(--brand-dark)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-muted)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                >
                                  {acknowledgedNotes[row.student.id] ? 'Edit Note' : 'Acknowledge Risk'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Moderate risk */}
                      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medium Risk</p>
                            <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: '#D97706' }}>Under observation</p>
                          </div>
                          <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '0.7rem', fontWeight: 800, borderRadius: '99px', padding: '2px 8px', border: '1px solid #FDE68A' }}>
                            {moderateRiskStudents.length}
                          </span>
                        </div>
                        {moderateRiskStudents.length === 0 ? (
                          <p style={{ fontSize: '0.8rem', color: '#D97706', margin: 0 }}>No medium-risk students detected.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {moderateRiskStudents.map((row) => (
                              <div key={`mod-${row.student.id}`} style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: '10px', padding: '0.65rem 0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  <div>
                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{row.student.full_name}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      Score: {row.compositeScore}% · Attendance: {row.attendanceRate}%
                                    </p>
                                  </div>
                                  <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '0.62rem', fontWeight: 800, borderRadius: '6px', padding: '2px 6px', textTransform: 'uppercase', flexShrink: 0 }}>MED</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAcknowledgeInitiate(row)}
                                  style={{
                                    marginTop: '0.5rem',
                                    width: '100%',
                                    padding: '5px 10px',
                                    borderRadius: '7px',
                                    border: '1px solid var(--slate-200)',
                                    background: 'var(--surface-muted)',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'var(--transition-fast)',
                                    fontFamily: 'var(--font-body)',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#FFFBEB'; e.currentTarget.style.color = '#92400E'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-muted)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                >
                                  {acknowledgedNotes[row.student.id] ? 'Edit Note' : 'Acknowledge Risk'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Acknowledge modal */}
                {acknowledgingStudent && (
                  <div
                    className="animate-fade-in"
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 60,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(15,23,42,0.5)',
                      backdropFilter: 'blur(4px)',
                      padding: '1rem',
                    }}
                  >
                    <form
                      onSubmit={handleAcknowledgeSubmit}
                      className="animate-fade-in-scale"
                      style={{
                        width: '100%',
                        maxWidth: '440px',
                        background: '#fff',
                        borderRadius: '20px',
                        padding: '1.75rem',
                        boxShadow: 'var(--shadow-xl)',
                        border: '1px solid var(--slate-200)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                        <div>
                          <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            Acknowledge Risk
                          </h3>
                          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {acknowledgingStudent.student.full_name} — log an intervention note.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAcknowledgeCancel}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--surface-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Intervention Note</label>
                        <textarea
                          value={acknowledgeNote}
                          onChange={(e) => setAcknowledgeNote(e.target.value)}
                          className="form-textarea"
                          placeholder="Describe the intervention or action taken..."
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={handleAcknowledgeCancel} className="btn btn-secondary btn-sm">
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm">
                          Save Note
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* Profile dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.35rem 0.75rem 0.35rem 0.35rem',
                  borderRadius: '12px',
                  border: '1.5px solid var(--slate-200)',
                  background: '#fff',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  boxShadow: 'var(--shadow-xs)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--brand-border)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--slate-200)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; }}
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt="avatar"
                    style={{ width: '32px', height: '32px', borderRadius: '9px', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '9px',
                      background: 'var(--brand)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                    }}
                  >
                    {user?.first_name ? user.first_name[0].toUpperCase() : 'U'}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {user?.first_name || user?.username}
                  </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {getRoleLabel()}
                  </span>
                </div>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)', marginLeft: '2px' }} />
              </button>

              {profileMenuOpen && (
                <div
                  className="animate-fade-in-scale"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: '220px',
                    background: '#fff',
                    border: '1px solid var(--slate-200)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-xl)',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  {/* User info */}
                  <div style={{ padding: '0.875rem 1rem', background: 'var(--surface-muted)', borderBottom: '1px solid var(--slate-100)' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.full_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
                  </div>

                  {/* Menu items */}
                  <div style={{ padding: '0.5rem' }}>
                    {[
                      { label: 'Edit Profile', icon: <UserIcon size={15} />, action: () => { setProfileMenuOpen(false); navigate('/profile'); } },
                      { label: 'MFA Security', icon: <Shield size={15} />, action: () => { setProfileMenuOpen(false); navigate('/mfa'); } },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.action}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          width: '100%',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-body)',
                          transition: 'var(--transition-fast)',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-light)'; e.currentTarget.style.color = 'var(--brand-dark)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}

                    <div style={{ margin: '0.35rem 0', borderTop: '1px solid var(--slate-100)' }} />

                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.825rem',
                        fontWeight: 700,
                        color: '#DC2626',
                        fontFamily: 'var(--font-body)',
                        transition: 'var(--transition-fast)',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <LogOut size={15} style={{ color: '#EF4444' }} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Content body ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
