import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  LayoutDashboard, Users, User as UserIcon, UserCheck, LogOut, QrCode, Scan,
  Award, Bell, ChevronDown, Shield, BookOpen, X, Activity, Moon, Sun,
} from 'lucide-react';
import { userService } from '../services/userService';
import { academicService } from '../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../utils/analyticsHelpers';
import { getUserInitial, getUserAvatarColorResolved } from '../utils/studentFormatters';

import type { AcademicRisk } from '../types';
import { TutorGreetingIntro } from '../components/TutorGreetingIntro';
import dashboardDarkDefault from '../assets/icons/dashboard_dark.png';
import dashboardDarkActive from '../assets/icons/dashboard_dark_active.png';
import dashboardLightDefault from '../assets/icons/dashboard_light.png';
import dashboardLightActive from '../assets/icons/dashboard_light_active.png';
import studentsDarkDefault from '../assets/icons/students_dark.png';
import studentsDarkActive from '../assets/icons/students_dark_active.png';
import studentsLightDefault from '../assets/icons/students_light.png';
import studentsLightActive from '../assets/icons/students_light_active.png';
import analyticsDarkDefault from '../assets/icons/data_analytics_dark.png';
import analyticsDarkActive from '../assets/icons/data_analytics_dark_active.png';
import analyticsLightDefault from '../assets/icons/data_analytics_light.png';
import analyticsLightActive from '../assets/icons/data_analytics_light_active.png';
import qrDarkDefault from '../assets/icons/qr_attendance_dark.png';
import qrDarkActive from '../assets/icons/qr_attendance_dark_active.png';
import qrLightDefault from '../assets/icons/qr_attendance_light.png';
import qrLightActive from '../assets/icons/qr_attendance_light_active.png';
import clockDarkDefault from '../assets/icons/dtrlog_dark.png';
import clockDarkActive from '../assets/icons/dtrlog_dark_active.png';
import clockLightDefault from '../assets/icons/dtrlog_light.png';
import clockLightActive from '../assets/icons/dtrlog_light_active.png';
import scoreDarkDefault from '../assets/icons/score_entry_dark.png';
import scoreDarkActive from '../assets/icons/score_entry_dark_active.png';
import scoreLightDefault from '../assets/icons/score_entry_light.png';
import scoreLightActive from '../assets/icons/score_entry_light_active.png';

const SidebarIcon: React.FC<{
  Icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number; fill?: string; style?: React.CSSProperties }>;
  active?: boolean;
}> = ({ Icon, active = false }) => (
  <Icon
    className="sidebar-icon"
    size={18}
    strokeWidth={2.1}
    fill={active ? 'currentColor' : 'none'}
    style={{ background: 'transparent' }}
  />
);

const AssetSidebarIcon: React.FC<{
  darkSrc: string;
  darkActiveSrc?: string;
  lightSrc: string;
  lightActiveSrc?: string;
  active?: boolean;
  alt?: string;
  size?: number;
  theme?: 'light' | 'dark';
}> = ({
  darkSrc,
  darkActiveSrc,
  lightSrc,
  lightActiveSrc,
  active = false,
  alt = 'sidebar icon',
  size = 18,
  theme = 'light',
}) => {
    const source = active
      ? (theme === 'dark' ? (darkActiveSrc ?? darkSrc) : (lightActiveSrc ?? lightSrc))
      : (theme === 'dark' ? darkSrc : lightSrc);

    return (
      <img
        src={source}
        alt={alt}
        className={`sidebar-asset-icon ${active ? 'active' : ''}`}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          background: 'transparent',
          opacity: active ? 1 : 0.9,
        }}
      />
    );
  };

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const navAvatar = getUserAvatarColorResolved(user);


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
    if (p.includes('/superadmin/users')) return 'User Management';
    if (p.includes('/admin/students')) return 'Student Directory';
    if (p.includes('/tutor/students')) return 'Assigned Students';
    if (p.includes('/student/attendance')) return 'QR Attendance';
    if (p.includes('/staff/scan')) return user?.role === 'student' ? 'Scan Attendance QR' : 'DTR Log';
    if (p.includes('/admin/attendance')) return 'Staff QR Generator';
    if (p.includes('/tutor/attendance')) return 'QR Attendance';
    if (p.includes('/profile')) return user?.role === 'tutor' ? 'Tutor Profile' : 'Profile';
    if (p.includes('/settings')) return 'System Settings';
    if (p.includes('/analytics')) return 'Data Analytics';
    if (p.includes('/scores')) return user?.role === 'student' ? 'Scores' : 'Score Entry';
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
  const [studentNotes, setStudentNotes] = useState<AcademicRisk[]>([]);
  const [showStudentNotes, setShowStudentNotes] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isActivePrefix = (prefix: string) => location.pathname.startsWith(prefix);

  const navLinkClass = (active: boolean) =>
    `sidebar-item ${active ? 'active' : ''}`;

  const studentNoteStyle = (riskLevel: AcademicRisk['risk_level']) => {
    if (riskLevel === 'high') {
      return {
        background: 'var(--risk-high-bg)',
        border: 'var(--risk-high-border)',
        label: 'var(--risk-high-text)',
        text: 'var(--risk-high-text)',
        button: '#EF4444',
        acknowledged: '#EF4444',
      };
    }
    if (riskLevel === 'medium') {
      return {
        background: 'var(--risk-medium-bg)',
        border: 'var(--risk-medium-border)',
        label: 'var(--risk-medium-text)',
        text: 'var(--risk-medium-text)',
        button: '#F59E0B',
        acknowledged: '#F59E0B',
      };
    }
    return {
      background: 'var(--risk-low-bg)',
      border: 'var(--risk-low-border)',
      label: 'var(--risk-low-text)',
      text: 'var(--risk-low-text)',
      button: '#22C55E',
      acknowledged: '#22C55E',
    };
  };

  const fetchRiskStudents = async () => {
    if (!user || user.role !== 'tutor') return;
    try {
      const [studentRes, gradesRaw, attRaw, risksRaw] = await Promise.all([
        userService.getUsers({ role: 'student', assigned_tutor: user.id }),
        academicService.getGrades(),
        academicService.getAttendanceHistory(),
        academicService.getAcademicRisks(),
      ]);

      const students = Array.isArray(studentRes.results) ? studentRes.results : [];
      const grades = Array.isArray(gradesRaw) ? gradesRaw : (gradesRaw as any)?.results ?? [];
      const attendanceLogs = Array.isArray(attRaw) ? attRaw : (attRaw as any)?.results ?? [];
      const riskRecords = Array.isArray(risksRaw) ? risksRaw : (risksRaw as any)?.results ?? [];

      const rows = computeStudentRiskRows(students, grades, attendanceLogs);
      const highRiskRows = rows.filter((r) => r.riskTier === 'High').sort((a, b) => b.compositeScore - a.compositeScore);
      const moderateRiskRows = rows.filter((r) => r.riskTier === 'Medium').sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5);

      const latestResolvedRiskByStudent = (riskRecords as AcademicRisk[])
        .filter((risk: AcademicRisk) => risk.resolved)
        .sort((a: AcademicRisk, b: AcademicRisk) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime())
        .reduce((acc: Record<string, AcademicRisk>, risk: AcademicRisk) => {
          if (!acc[risk.student]) acc[risk.student] = risk;
          return acc;
        }, {} as Record<string, AcademicRisk>);

      setHighRiskStudents(highRiskRows);
      setModerateRiskStudents([]);
      // The alert badge and High Risk section both represent every student
      // currently classified as High risk, regardless of acknowledgement notes.
      setHighRiskCount(highRiskRows.length);
      setAcknowledgedNotes(Object.fromEntries(Object.entries(latestResolvedRiskByStudent).map(([id, r]: [string, AcademicRisk]) => [id, r.details])));
      setAcknowledgedRiskIds(Object.fromEntries(Object.entries(latestResolvedRiskByStudent).map(([id, r]: [string, AcademicRisk]) => [id, r.id])));
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
    // Derive the correct risk level from the student's computed tier
    const studentRiskLevel: AcademicRisk['risk_level'] =
      acknowledgingStudent.riskTier === 'High' ? 'high'
        : acknowledgingStudent.riskTier === 'Medium' ? 'medium'
          : 'low';
    try {
      if (existingRiskId) {
        await academicService.updateAcademicRisk(existingRiskId, { details: noteText, resolved: true });
      } else {
        const newRisk = await academicService.createAcademicRisk({
          student: acknowledgingStudent.student.id,
          risk_level: studentRiskLevel,
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
    }
  };

  const handleAcknowledgeCancel = () => {
    setAcknowledgingStudent(null);
    setAcknowledgeNote('');
  };

  const fetchStudentNotes = async () => {
    if (user?.role !== 'student') return;
    try {
      const risks = await academicService.getAcademicRisks();
      // Only show resolved intervention notes that have a details message from the tutor
      setStudentNotes(risks.filter((risk) => risk.resolved && Boolean(risk.details)).sort(
        (a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
      ));
    } catch (error) {
      console.error('Failed to load student tutor notes', error);
    }
  };

  const acknowledgeStudentNote = async (riskId: number) => {
    try {
      await academicService.updateAcademicRisk(riskId, { student_acknowledged: true });
      await fetchStudentNotes();
    } catch (error) {
      console.error('Failed to acknowledge tutor note', error);
    }
  };

  useEffect(() => { fetchRiskStudents(); }, [user]);
  useEffect(() => { if (!showRiskList) return; fetchRiskStudents(); }, [showRiskList]);
  useEffect(() => { fetchStudentNotes(); }, [user]);
  useEffect(() => { setProfileMenuOpen(false); }, [location.pathname]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--surface-bg)', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>

      {/* ── Tutor / Student Greeting Intro (Chat Bubble + Flying Mascot) ───── */}
      <TutorGreetingIntro
        user={user}
        isTutor={user?.role === 'tutor' || user?.role === 'student'}
        sidebarLogoId="sidebar-brand-logo"
        sidebarTextId="sidebar-brand-text"
      />

      {/* ── Sidebar ───────────────────────────────────── */}
      <aside
        style={{
          width: '260px',
          background: 'var(--sidebar-bg)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          borderRight: '1px solid var(--slate-200)',
          zIndex: 20,
          position: 'relative',
        }}
      >
        {/* Brand Header */}
        <Link
          to={user?.is_superuser ? '/superadmin' : user?.role ? `/${user.role}` : '/'}
          className="group"
          style={{
            padding: '0 1.25rem',
            minHeight: '64px',
            borderBottom: '1px solid var(--slate-100)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexShrink: 0,
            position: 'relative',
            textDecoration: 'none',
          }}
        >
          <div
            id="sidebar-brand-logo"
            className="transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-110 will-change-transform select-none"
            style={{
              width: '32px',
              height: '32px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transformOrigin: 'center center',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
            }}
          >
            <img
              src="/src/assets/ARALert_Logo_LIGHT.png"
              alt="ARALert"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'translateZ(0)',
              }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div
            id="sidebar-brand-text"
            className="will-change-transform select-none"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                fontSize: '1.1rem',
                color: 'var(--brand)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              ARALert
            </div>
          </div>
        </Link>

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
                <AssetSidebarIcon
                  darkSrc={dashboardDarkDefault}
                  darkActiveSrc={dashboardDarkActive}
                  lightSrc={dashboardLightDefault}
                  lightActiveSrc={dashboardLightActive}
                  active={isActive('/superadmin')}
                  alt="Dashboard"
                  size={18}
                  theme={theme}
                />
                Dashboard
              </Link>
              <Link
                to="/superadmin/users"
                className={navLinkClass(isActivePrefix('/superadmin/users'))}
              >
                <SidebarIcon Icon={Users} active={isActivePrefix('/superadmin/users')} />
                User Management
              </Link>
              <Link
                to="/superadmin/audit-logs"
                className={navLinkClass(isActivePrefix('/superadmin/audit-logs'))}
              >
                <SidebarIcon Icon={Activity} active={isActivePrefix('/superadmin/audit-logs')} />
                Audit Trail
              </Link>
            </>
          )}

          {/* Admin nav */}
          {user?.role === 'admin' && (
            <>
              <span className="sidebar-section-label">Admin Panel</span>
              <Link to="/admin" className={navLinkClass(isActive('/admin'))}>
                <AssetSidebarIcon
                  darkSrc={dashboardDarkDefault}
                  darkActiveSrc={dashboardDarkActive}
                  lightSrc={dashboardLightDefault}
                  lightActiveSrc={dashboardLightActive}
                  active={isActive('/admin')}
                  alt="Dashboard"
                  size={18}
                  theme={theme}
                />
                Dashboard
              </Link>
              <Link
                to="/admin/students"
                className={navLinkClass(isActivePrefix('/admin/students'))}
              >
                <SidebarIcon Icon={Users} active={isActivePrefix('/admin/students')} />
                Student Directory
              </Link>
              <Link
                to="/admin/tutors"
                className={navLinkClass(isActivePrefix('/admin/tutors'))}
              >
                <SidebarIcon Icon={UserCheck} active={isActivePrefix('/admin/tutors')} />
                Tutors Directory
              </Link>
              <Link to="/admin/attendance" className={navLinkClass(isActive('/admin/attendance'))}>
                <AssetSidebarIcon
                  darkSrc={qrDarkDefault}
                  darkActiveSrc={qrDarkActive}
                  lightSrc={qrLightDefault}
                  lightActiveSrc={qrLightActive}
                  active={isActive('/admin/attendance')}
                  alt="Staff QR Generator"
                  size={18}
                  theme={theme}
                />
                Staff QR Generator
              </Link>
            </>
          )}

          {/* Tutor nav */}
          {user?.role === 'tutor' && (
            <>
              <Link to="/tutor" className={navLinkClass(isActive('/tutor'))}>
                <AssetSidebarIcon
                  darkSrc={dashboardDarkDefault}
                  darkActiveSrc={dashboardDarkActive}
                  lightSrc={dashboardLightDefault}
                  lightActiveSrc={dashboardLightActive}
                  active={isActive('/tutor')}
                  alt="Dashboard"
                  size={18}
                  theme={theme}
                />
                Dashboard
              </Link>

              <Link
                to="/tutor/attendance/generate"
                className={navLinkClass(isActive('/tutor/attendance/generate'))}
              >
                <AssetSidebarIcon
                  darkSrc={qrDarkDefault}
                  darkActiveSrc={qrDarkActive}
                  lightSrc={qrLightDefault}
                  lightActiveSrc={qrLightActive}
                  active={isActive('/tutor/attendance/generate')}
                  alt="QR Attendance"
                  size={18}
                  theme={theme}
                />
                QR Attendance
              </Link>

              <Link to="/tutor/scores" className={navLinkClass(isActive('/tutor/scores'))}>
                <AssetSidebarIcon
                  darkSrc={scoreDarkDefault}
                  darkActiveSrc={scoreDarkActive}
                  lightSrc={scoreLightDefault}
                  lightActiveSrc={scoreLightActive}
                  active={isActive('/tutor/scores')}
                  alt="Score Entry"
                  size={18}
                  theme={theme}
                />
                Score Entry
              </Link>

              <Link to="/tutor/analytics" className={navLinkClass(isActive('/tutor/analytics'))}>
                <AssetSidebarIcon
                  darkSrc={analyticsDarkDefault}
                  darkActiveSrc={analyticsDarkActive}
                  lightSrc={analyticsLightDefault}
                  lightActiveSrc={analyticsLightActive}
                  active={isActive('/tutor/analytics')}
                  alt="Data Analytics"
                  size={18}
                  theme={theme}
                />
                Data Analytics
              </Link>

              <Link to="/tutor/students" className={navLinkClass(isActive('/tutor/students'))}>
                <AssetSidebarIcon
                  darkSrc={studentsDarkDefault}
                  darkActiveSrc={studentsDarkActive}
                  lightSrc={studentsLightDefault}
                  lightActiveSrc={studentsLightActive}
                  active={isActive('/tutor/students')}
                  alt="Assigned Students"
                  size={18}
                  theme={theme}
                />
                Assigned Students
              </Link>

              <div style={{ height: '1px', background: 'var(--slate-100)', margin: '0.5rem 0', boxShadow: 'inset 0 1px 0 var(--slate-200)' }} />

              <Link to="/staff/scan" className={navLinkClass(isActive('/staff/scan'))}>
                <AssetSidebarIcon
                  darkSrc={clockDarkDefault}
                  darkActiveSrc={clockDarkActive}
                  lightSrc={clockLightDefault}
                  lightActiveSrc={clockLightActive}
                  active={isActive('/staff/scan')}
                  alt="DTR Log"
                  size={18}
                  theme={theme}
                />
                DTR Log
              </Link>
            </>
          )}

          {/* Principal nav */}
          {user?.role === 'principal' && (
            <>
              <span className="sidebar-section-label">Monitoring</span>
              <Link to="/principal" className={navLinkClass(isActive('/principal'))}>
                <AssetSidebarIcon
                  darkSrc={dashboardDarkDefault}
                  darkActiveSrc={dashboardDarkActive}
                  lightSrc={dashboardLightDefault}
                  lightActiveSrc={dashboardLightActive}
                  active={isActive('/principal')}
                  alt="Monitoring Dashboard"
                  size={18}
                  theme={theme}
                />
                Monitoring Dashboard
              </Link>
              <Link to="/staff/scan" className={navLinkClass(isActive('/staff/scan'))}>
                <AssetSidebarIcon
                  darkSrc={clockDarkDefault}
                  darkActiveSrc={clockDarkActive}
                  lightSrc={clockLightDefault}
                  lightActiveSrc={clockLightActive}
                  active={isActive('/staff/scan')}
                  alt="DTR Log"
                  size={18}
                  theme={theme}
                />
                DTR Log
              </Link>
            </>
          )}

          {/* Faculty nav */}
          {user?.role === 'faculty' && (
            <>
              <span className="sidebar-section-label">Faculty</span>
              <Link to="/faculty" className={navLinkClass(isActive('/faculty'))}>
                <AssetSidebarIcon
                  darkSrc={dashboardDarkDefault}
                  darkActiveSrc={dashboardDarkActive}
                  lightSrc={dashboardLightDefault}
                  lightActiveSrc={dashboardLightActive}
                  active={isActive('/faculty')}
                  alt="Faculty Home"
                  size={18}
                  theme={theme}
                />
                Faculty Home
              </Link>
              <Link to="/staff/scan" className={navLinkClass(isActive('/staff/scan'))}>
                <AssetSidebarIcon
                  darkSrc={clockDarkDefault}
                  darkActiveSrc={clockDarkActive}
                  lightSrc={clockLightDefault}
                  lightActiveSrc={clockLightActive}
                  active={isActive('/staff/scan')}
                  alt="DTR Log"
                  size={18}
                  theme={theme}
                />
                DTR Log
              </Link>
            </>
          )}

          {/* Student nav */}
          {user?.role === 'student' && (
            <>
              <Link to="/student" className={navLinkClass(isActive('/student'))}>
                <AssetSidebarIcon
                  darkSrc={dashboardDarkDefault}
                  darkActiveSrc={dashboardDarkActive}
                  lightSrc={dashboardLightDefault}
                  lightActiveSrc={dashboardLightActive}
                  active={isActive('/student')}
                  alt="Dashboard"
                  size={18}
                  theme={theme}
                />
                Dashboard
              </Link>
              <Link to="/student/scores" className={navLinkClass(isActive('/student/scores'))}>
                <AssetSidebarIcon
                  darkSrc={scoreDarkDefault}
                  darkActiveSrc={scoreDarkActive}
                  lightSrc={scoreLightDefault}
                  lightActiveSrc={scoreLightActive}
                  active={isActive('/student/scores')}
                  alt="Scores"
                  size={18}
                  theme={theme}
                />
                Scores
              </Link>

              <div style={{ height: '1px', background: 'var(--slate-100)', margin: '0.5rem 0', boxShadow: 'inset 0 1px 0 var(--slate-200)' }} />

              <Link to="/student/attendance" className={navLinkClass(isActive('/student/attendance'))}>
                <AssetSidebarIcon
                  darkSrc={clockDarkDefault}
                  darkActiveSrc={clockDarkActive}
                  lightSrc={clockLightDefault}
                  lightActiveSrc={clockLightActive}
                  active={isActive('/student/attendance')}
                  alt="QR Attendance"
                  size={18}
                  theme={theme}
                />
                QR Attendance
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
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--slate-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem',
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
                textTransform: 'uppercase',
              }}
            >
              {getPageTitle()}
            </h1>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                border: '1px solid var(--slate-200)',
                background: 'var(--surface-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-light)'; e.currentTarget.style.color = 'var(--brand-dark)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-muted)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

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
                      background: 'var(--surface-card)',
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
                          ACADEMIC RISK ALERTS
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
                      <div style={{ background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', borderRadius: '12px', padding: '0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, color: 'var(--risk-high-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>High Risk</p>
                          </div>
                          <span style={{ background: 'var(--risk-high-badge-bg)', color: 'var(--risk-high-text)', fontSize: '0.7rem', fontWeight: 800, borderRadius: '99px', padding: '2px 8px', border: '1px solid var(--risk-high-border)' }}>
                            {highRiskStudents.length}
                          </span>
                        </div>
                        {highRiskStudents.length === 0 ? (
                          <p style={{ fontSize: '0.8rem', color: 'var(--risk-high-text)', margin: 0 }}>No high-risk students detected.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {highRiskStudents.map((row) => (
                              <div key={`high-${row.student.id}`} style={{ background: 'var(--surface-card)', border: '1px solid var(--risk-high-border)', borderRadius: '10px', padding: '0.65rem 0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  <div>
                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{row.student.full_name}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      Score: {parseFloat(row.compositeScore.toFixed(2)).toString()}% · Attendance: {parseFloat(row.attendanceRate.toFixed(2)).toString()}%
                                    </p>
                                    {acknowledgedNotes[row.student.id] && (
                                      <div style={{ marginTop: '6px' }}>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{acknowledgedNotes[row.student.id]}</p>
                                      </div>
                                    )}
                                  </div>
                                  <span style={{ background: 'var(--risk-high-badge-bg)', color: 'var(--risk-high-text)', fontSize: '0.62rem', fontWeight: 800, borderRadius: '6px', padding: '2px 6px', textTransform: 'uppercase', flexShrink: 0, border: '1px solid var(--risk-high-border)' }}>HIGH</span>
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
                    </div>
                  </div>
                )}
              </div>
            )}

            {user?.role === 'student' && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowStudentNotes((visible) => !visible)}
                  aria-label="Tutor notes"
                  style={{
                    position: 'relative', width: '38px', height: '38px', borderRadius: '10px',
                    background: 'var(--surface-muted)', border: '1px solid var(--slate-200)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    color: 'var(--text-secondary)', transition: 'var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-light)'; e.currentTarget.style.color = 'var(--brand-dark)'; e.currentTarget.style.borderColor = 'var(--brand-border)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-muted)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--slate-200)'; }}
                >
                  <Bell size={17} />
                  {studentNotes.filter((note) => !note.student_acknowledged).length > 0 && (
                    <span className="animate-badge-pulse" style={{ position: 'absolute', top: '-4px', right: '-4px', minWidth: '18px', height: '18px', padding: '0 4px', borderRadius: '99px', background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                      {studentNotes.filter((note) => !note.student_acknowledged).length}
                    </span>
                  )}
                </button>

                {showStudentNotes && (
                  <div className="animate-fade-in-scale" style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: '360px', background: 'var(--surface-card)', border: '1px solid var(--slate-200)', borderRadius: '18px', boxShadow: 'var(--shadow-xl)', zIndex: 50, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.25rem', background: 'var(--surface-muted)', borderBottom: '1px solid var(--slate-200)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tutor Notes</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Messages and support reminders from your tutor.</p>
                      </div>
                      <button type="button" onClick={() => setShowStudentNotes(false)} aria-label="Close tutor notes" style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={15} /></button>
                    </div>
                    <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {studentNotes.length === 0 ? (
                        <p style={{ margin: 0, padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No tutor notes right now.</p>
                      ) : studentNotes.map((note) => {
                        const colors = studentNoteStyle(note.risk_level);
                        return (
                          <div key={note.id} style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '0.875rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: colors.label, textTransform: 'uppercase' }}>{note.risk_level_display} risk</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(note.date_created).toLocaleDateString()}</span>
                            </div>
                            <p style={{ margin: '0.55rem 0 0', fontSize: '0.82rem', color: colors.text, lineHeight: 1.45 }}>{note.details}</p>
                            {note.student_acknowledged ? (
                              <p style={{ margin: '0.65rem 0 0', fontSize: '0.75rem', fontWeight: 700, color: colors.acknowledged }}>Acknowledged</p>
                            ) : (
                              <button type="button" onClick={() => acknowledgeStudentNote(note.id)} style={{ marginTop: '0.65rem', border: 'none', borderRadius: '7px', padding: '6px 10px', background: colors.button, color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Acknowledge</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
                  background: 'var(--surface-card)',
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
                    className={`flex items-center justify-center shrink-0 rounded-[9px] font-extrabold text-[0.9rem]${navAvatar.kind === 'class' ? ` ${navAvatar.value}` : ''}`}
                    style={{
                      width: '32px',
                      height: '32px',
                      fontFamily: 'var(--font-heading)',
                      ...(navAvatar.kind === 'style' ? navAvatar.value : {}),
                    }}
                  >
                    {getUserInitial(user)}
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
                    background: 'var(--surface-card)',
                    border: '1px solid var(--slate-200)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-xl)',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  {/* User info */}
                  <div style={{ padding: '0.875rem 1rem', background: 'var(--surface-muted)', borderBottom: '1px solid var(--slate-100)' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                      {(() => {
                        const first = (user?.first_name || '').trim().toUpperCase();
                        const last = (user?.last_name || '').trim().toUpperCase();
                        const mi = user?.middle_name && user.middle_name.trim() ? `${user.middle_name.trim()[0].toUpperCase()}.` : '';
                        const given = [first, mi].filter(Boolean).join(' ');
                        if (last && given) return `${last}, ${given}`;
                        return last || given || user?.full_name || user?.username;
                      })()}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
                  </div>

                  {/* Menu items */}
                  <div style={{ padding: '0.5rem' }}>
                    {[
                      { label: 'View Profile', icon: <UserIcon size={15} />, action: () => { setProfileMenuOpen(false); navigate('/profile'); } },
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

      {/* Acknowledge modal — rendered via portal so backdrop-filter on the header doesn't clip it */}
      {acknowledgingStudent && createPortal(
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            padding: '1rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleAcknowledgeCancel(); }}
        >
          <form
            onSubmit={handleAcknowledgeSubmit}
            className="animate-fade-in-scale"
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--surface-card)',
              borderRadius: '20px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--slate-200)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  {acknowledgedNotes[acknowledgingStudent.student.id] ? 'Edit Note' : 'Acknowledge Risk'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {acknowledgingStudent.student.full_name} — {acknowledgedNotes[acknowledgingStudent.student.id] ? 'update the intervention note.' : 'log an intervention note.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAcknowledgeCancel}
                style={{
                  width: '30px', height: '30px', borderRadius: '8px',
                  border: 'none', background: 'var(--surface-muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--text-muted)',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea
                value={acknowledgeNote}
                onChange={(e) => setAcknowledgeNote(e.target.value)}
                className="form-textarea"
                placeholder="Describe the intervention or action taken..."
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={handleAcknowledgeCancel} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                {acknowledgedNotes[acknowledgingStudent.student.id] ? 'Update Note' : 'Save Note'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

    </div>
  );
};
