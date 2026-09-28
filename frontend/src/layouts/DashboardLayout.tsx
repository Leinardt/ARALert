import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  LayoutDashboard, Users, User as UserIcon, UserCheck, LogOut, QrCode, Scan,
  Award, Bell, ChevronDown, ChevronUp, Shield, BookOpen, X, FileText, Moon, Sun,
  PanelLeftClose, PanelLeftOpen, Menu, AlertTriangle,
  Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw,
} from 'lucide-react';
import { userService } from '../services/userService';
import { academicService } from '../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../utils/analyticsHelpers';

import type { AcademicRisk, StudentEditRequest } from '../types';
import { TutorGreetingIntro } from '../components/TutorGreetingIntro';
import { ThemeToggle } from '../components/ThemeToggle';
import { StudentEditRequestsModal } from '../components/StudentEditRequestsModal';
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
import aralertLogo from '../assets/ARALert_Logo_LIGHT.png';

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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aralert_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('aralert_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

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
    if (p.includes('/audit-logs')) return 'Audit Log';
    if (p.includes('/evaluations')) return 'Evaluation & Transition Hub';
    if (p.includes('/superadmin/users')) return 'User Management';
    if (p.includes('/admin/students') || p.includes('/admin/tutors') || p.includes('/admin/faculty') || p.includes('/admin/principals') || p.includes('/admin/users')) return 'User Management';
    if (p.includes('/tutor/students')) return 'Assigned Students';
    if (p.includes('/student/attendance')) return 'QR Attendance';
    if (p.includes('/staff/scan')) return user?.role === 'student' ? 'Scan Attendance QR' : 'DTR Log';
    if (p.includes('/admin/attendance')) return 'QR Attendance';
    if (p.includes('/tutor/attendance')) return 'QR Attendance';
    if (p.includes('/profile')) return user?.role === 'tutor' ? 'Tutor Profile' : 'Profile';
    if (p.includes('/settings')) return 'System Settings';
    if (p.includes('/analytics')) return 'Data Analytics';
    if (p.includes('/academic-records') || p.includes('/scores')) return user?.role === 'student' ? 'Academic Records' : 'Score Entry';
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
  const [pendingEditRequestsCount, setPendingEditRequestsCount] = useState<number>(0);
  const [myEditRequests, setMyEditRequests] = useState<StudentEditRequest[]>([]);
  const [isLoadingEditRequests, setIsLoadingEditRequests] = useState<boolean>(false);
  const [showEditRequestsModal, setShowEditRequestsModal] = useState<boolean>(false);
  const [isBellRinging, setIsBellRinging] = useState<boolean>(false);
  const [bellRingKey, setBellRingKey] = useState<number>(0);
  const [isEditBellRinging, setIsEditBellRinging] = useState<boolean>(false);
  const [editBellRingKey, setEditBellRingKey] = useState<number>(0);
  const [showTutorNotifications, setShowTutorNotifications] = useState<boolean>(false);
  const [isRiskShaking, setIsRiskShaking] = useState<boolean>(false);
  const [riskShakeKey, setRiskShakeKey] = useState<number>(0);

  const formatAralLevel = (level?: string) => {
    if (!level) return 'Unspecified';
    if (level === 'basic') return 'ARAL Basic';
    if (level === 'plus') return 'ARAL Plus';
    if (level === 'summer') return 'ARAL Summer';
    if (level === 'graduated') return 'Graduated';
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  const isActive = (path: string) => location.pathname === path;
  const isActivePrefix = (prefix: string) => location.pathname.startsWith(prefix);

  const navLinkClass = (active: boolean, collapsed: boolean = isSidebarCollapsed) =>
    `sidebar-item ${active ? 'active' : ''} ${collapsed ? 'justify-center !p-0 w-10 h-10 mx-auto' : ''}`;

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

  const fetchEditRequests = async () => {
    if (!user) return;
    try {
      setIsLoadingEditRequests(true);
      if (user.role === 'admin' || user.is_superuser) {
        const data = await userService.getStudentEditRequests({ status: 'pending' });
        setPendingEditRequestsCount(data.pending_count ?? data.results.length);
        setMyEditRequests(data.results || []);
      } else if (user.role === 'tutor' || user.role === 'student') {
        const data = await userService.getStudentEditRequests();
        const results = data.results || [];
        setMyEditRequests(results);
        setPendingEditRequestsCount(results.filter((r) => r.status === 'pending').length);
      }
    } catch (err) {
      console.error('Failed to load student edit requests', err);
    } finally {
      setIsLoadingEditRequests(false);
    }
  };

  useEffect(() => { fetchRiskStudents(); }, [user]);
  useEffect(() => { if (!showRiskList) return; fetchRiskStudents(); }, [showRiskList]);
  useEffect(() => { fetchStudentNotes(); }, [user]);
  useEffect(() => { fetchEditRequests(); }, [user, location.pathname]);
  useEffect(() => {
    if (showTutorNotifications || showStudentNotes) {
      fetchEditRequests();
    }
  }, [showTutorNotifications, showStudentNotes]);
  useEffect(() => {
    setProfileMenuOpen(false);
    setIsMobileDrawerOpen(false);
    setShowRiskList(false);
    setShowTutorNotifications(false);
    setShowStudentNotes(false);
  }, [location.pathname]);

  const renderNavItems = (collapsed: boolean = false, onItemClick?: () => void) => {
    return (
      <>
        {/* SuperAdmin nav */}
        {user?.is_superuser && (
          <>
            {!collapsed ? (
              <span className="sidebar-section-label">Management</span>
            ) : (
              <div style={{ height: '1px', background: 'var(--slate-100)', margin: '0.4rem 0.5rem' }} />
            )}
            <Link to="/superadmin" onClick={onItemClick} className={navLinkClass(isActive('/superadmin'), collapsed)} title="Dashboard">
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
              {!collapsed && <span className="truncate">Dashboard</span>}
            </Link>
            <Link
              to="/superadmin/users"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/superadmin/users'), collapsed)}
              title="User Management"
            >
              <SidebarIcon Icon={Users} active={isActivePrefix('/superadmin/users')} />
              {!collapsed && <span className="truncate">User Management</span>}
            </Link>
            <Link
              to="/superadmin/evaluations"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/superadmin/evaluations'), collapsed)}
              title="Evaluation & Transition"
            >
              <SidebarIcon Icon={Award} active={isActivePrefix('/superadmin/evaluations')} />
              {!collapsed && <span className="truncate">Evaluation & Transition</span>}
            </Link>
            <Link
              to="/superadmin/audit-logs"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/superadmin/audit-logs'), collapsed)}
              title="Audit Log"
            >
              <SidebarIcon Icon={FileText} active={isActivePrefix('/superadmin/audit-logs')} />
              {!collapsed && <span className="truncate">Audit Log</span>}
            </Link>
          </>
        )}

        {/* Admin nav */}
        {user?.role === 'admin' && (
          <>
            <Link to="/admin" onClick={onItemClick} className={navLinkClass(isActive('/admin'), collapsed)} title="Dashboard">
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
              {!collapsed && <span className="truncate">Dashboard</span>}
            </Link>
            <Link
              to="/admin/students"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/admin/students') || isActivePrefix('/admin/tutors') || isActivePrefix('/admin/faculty') || isActivePrefix('/admin/principals') || isActivePrefix('/admin/users'), collapsed)}
              title="User Management"
            >
              <AssetSidebarIcon
                darkSrc={studentsDarkDefault}
                darkActiveSrc={studentsDarkActive}
                lightSrc={studentsLightDefault}
                lightActiveSrc={studentsLightActive}
                active={isActivePrefix('/admin/students') || isActivePrefix('/admin/tutors') || isActivePrefix('/admin/faculty') || isActivePrefix('/admin/principals') || isActivePrefix('/admin/users')}
                alt="User Management"
                size={18}
                theme={theme}
              />
              {!collapsed && <span className="truncate">User Management</span>}
            </Link>
            <Link
              to="/admin/evaluations"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/admin/evaluations'), collapsed)}
              title="Evaluation & Transition"
            >
              <SidebarIcon Icon={Award} active={isActivePrefix('/admin/evaluations')} />
              {!collapsed && <span className="truncate">Evaluation & Transition</span>}
            </Link>
            <Link
              to="/admin/audit-logs"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/admin/audit-logs'), collapsed)}
              title="Audit Log"
            >
              <SidebarIcon Icon={FileText} active={isActivePrefix('/admin/audit-logs')} />
              {!collapsed && <span className="truncate">Audit Log</span>}
            </Link>

            <div style={{ height: '1px', background: 'var(--slate-100)', margin: '0.5rem 0' }} />

            <Link to="/admin/attendance" onClick={onItemClick} className={navLinkClass(isActive('/admin/attendance'), collapsed)} title="QR Attendance">
              <AssetSidebarIcon
                darkSrc={qrDarkDefault}
                darkActiveSrc={qrDarkActive}
                lightSrc={qrLightDefault}
                lightActiveSrc={qrLightActive}
                active={isActive('/admin/attendance')}
                alt="QR Attendance"
                size={18}
                theme={theme}
              />
              {!collapsed && <span className="truncate">QR Attendance</span>}
            </Link>
          </>
        )}

        {/* Tutor nav */}
        {user?.role === 'tutor' && (
          <>
            <Link to="/tutor" onClick={onItemClick} className={navLinkClass(isActive('/tutor'), collapsed)} title="Dashboard">
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
              {!collapsed && <span className="truncate">Dashboard</span>}
            </Link>

            <Link
              to="/tutor/attendance/generate"
              onClick={onItemClick}
              className={navLinkClass(isActive('/tutor/attendance/generate'), collapsed)}
              title="QR Attendance"
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
              {!collapsed && <span className="truncate">QR Attendance</span>}
            </Link>

            <Link to="/tutor/scores" onClick={onItemClick} className={navLinkClass(isActive('/tutor/scores'), collapsed)} title="Score Entry">
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
              {!collapsed && <span className="truncate">Score Entry</span>}
            </Link>

            <Link to="/tutor/analytics" onClick={onItemClick} className={navLinkClass(isActive('/tutor/analytics'), collapsed)} title="Data Analytics">
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
              {!collapsed && <span className="truncate">Data Analytics</span>}
            </Link>

            <Link to="/tutor/students" onClick={onItemClick} className={navLinkClass(isActive('/tutor/students'), collapsed)} title="Assigned Students">
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
              {!collapsed && <span className="truncate">Assigned Students</span>}
            </Link>

            <div style={{ height: '1px', background: 'var(--slate-100)', margin: '0.5rem 0' }} />

            <Link to="/staff/scan" onClick={onItemClick} className={navLinkClass(isActive('/staff/scan'), collapsed)} title="DTR Log">
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
              {!collapsed && <span className="truncate">DTR Log</span>}
            </Link>
          </>
        )}

        {/* Principal nav */}
        {user?.role === 'principal' && (
          <>
            {!collapsed ? (
              <span className="sidebar-section-label">Monitoring</span>
            ) : (
              <div style={{ height: '1px', background: 'var(--slate-100)', margin: '0.4rem 0.5rem' }} />
            )}
            <Link to="/principal" onClick={onItemClick} className={navLinkClass(isActive('/principal'), collapsed)} title="Monitoring Dashboard">
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
              {!collapsed && <span className="truncate">Monitoring Dashboard</span>}
            </Link>
            <Link to="/staff/scan" onClick={onItemClick} className={navLinkClass(isActive('/staff/scan'), collapsed)} title="DTR Log">
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
              {!collapsed && <span className="truncate">DTR Log</span>}
            </Link>
          </>
        )}

        {/* Faculty nav */}
        {user?.role === 'faculty' && (
          <>
            {!collapsed ? (
              <span className="sidebar-section-label">Faculty</span>
            ) : (
              <div style={{ height: '1px', background: 'var(--slate-100)', margin: '0.4rem 0.5rem' }} />
            )}
            <Link to="/faculty" onClick={onItemClick} className={navLinkClass(isActive('/faculty'), collapsed)} title="Faculty Home">
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
              {!collapsed && <span className="truncate">Faculty Home</span>}
            </Link>
            <Link to="/staff/scan" onClick={onItemClick} className={navLinkClass(isActive('/staff/scan'), collapsed)} title="DTR Log">
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
              {!collapsed && <span className="truncate">DTR Log</span>}
            </Link>
          </>
        )}

        {/* Student nav */}
        {user?.role === 'student' && (
          <>
            <Link to="/student" onClick={onItemClick} className={navLinkClass(isActive('/student'), collapsed)} title="Dashboard">
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
              {!collapsed && <span className="truncate">Dashboard</span>}
            </Link>
            <Link to="/student/analytics" onClick={onItemClick} className={navLinkClass(isActive('/student/analytics'), collapsed)} title="Data Analytics">
              <AssetSidebarIcon
                darkSrc={analyticsDarkDefault}
                darkActiveSrc={analyticsDarkActive}
                lightSrc={analyticsLightDefault}
                lightActiveSrc={analyticsLightActive}
                active={isActive('/student/analytics')}
                alt="Data Analytics"
                size={18}
                theme={theme}
              />
              {!collapsed && <span className="truncate">Data Analytics</span>}
            </Link>

            <Link to="/student/scores" onClick={onItemClick} className={navLinkClass(isActive('/student/scores') || isActive('/student/academic-records'), collapsed)} title="Academic Records">
              <AssetSidebarIcon
                darkSrc={scoreDarkDefault}
                darkActiveSrc={scoreDarkActive}
                lightSrc={scoreLightDefault}
                lightActiveSrc={scoreLightActive}
                active={isActive('/student/scores') || isActive('/student/academic-records')}
                alt="Academic Records"
                size={18}
                theme={theme}
              />
              {!collapsed && <span className="truncate">Academic Records</span>}
            </Link>

            <div style={{ height: '1px', background: 'var(--slate-100)', margin: '0.5rem 0' }} />

            <Link to="/student/attendance" onClick={onItemClick} className={navLinkClass(isActive('/student/attendance'), collapsed)} title="QR Attendance">
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
              {!collapsed && <span className="truncate">QR Attendance</span>}
            </Link>
          </>
        )}
      </>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--surface-bg)', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>

      {/* ── Tutor / Student Greeting Intro (Chat Bubble + Flying Mascot) ───── */}
      <TutorGreetingIntro
        user={user}
        isTutor={user?.role === 'tutor' || user?.role === 'student'}
        sidebarLogoId="sidebar-brand-logo"
        sidebarTextId="sidebar-brand-text"
      />

      {/* ── Desktop Sidebar (Collapsible & Minimizable, hidden on <1024px) ───────────────────────── */}
      <aside
        className="hidden lg:flex"
        style={{
          width: isSidebarCollapsed ? '68px' : '260px',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'var(--sidebar-bg)',
          flexDirection: 'column',
          flexShrink: 0,
          borderRight: '1px solid var(--slate-200)',
          zIndex: 20,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Brand Header */}
        <div
          className="group/header"
          style={{
            padding: isSidebarCollapsed ? '0 0.5rem' : '0 1rem 0 1.25rem',
            minHeight: '64px',
            borderBottom: '1px solid var(--slate-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
            flexShrink: 0,
            position: 'relative',
            transition: 'padding 0.25s ease',
          }}
        >
          {isSidebarCollapsed ? (
            /* Collapsed State: Show the ARALert logo. On hover, expand button smoothly overlays/replaces it in that same position */
            <div className="relative w-10 h-10 flex items-center justify-center">
              {/* ARALert logo image (shown when collapsed) */}
              <div
                id="sidebar-brand-logo"
                className="w-8 h-8 flex items-center justify-center select-none transition-all duration-200 ease-in-out opacity-100 scale-100 group-hover/header:opacity-0 group-hover/header:scale-75 pointer-events-none"
              >
                <img
                  src={aralertLogo}
                  alt="ARALert"
                  className="w-full h-full object-contain block"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </div>

              {/* Expand sidebar button (smoothly replaces logo on hover in original position) */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="absolute inset-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-600 hover:text-[var(--brand)] dark:text-slate-300 dark:hover:text-blue-400 shadow-xs transition-all duration-200 ease-in-out opacity-0 scale-75 group-hover/header:opacity-100 group-hover/header:scale-100 cursor-pointer focus:outline-none focus:opacity-100 focus:scale-100"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen size={18} strokeWidth={2.1} />
              </button>
            </div>
          ) : (
            /* Expanded State: Show only the word ARALert (no logo); collapse button on the right in its original position, smoothly revealed on hover */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Link
                to={user?.is_superuser ? '/superadmin' : user?.role ? `/${user.role}` : '/'}
                className="group/brand flex items-center no-underline min-w-0"
                title="ARALert"
              >
                <div
                  id="sidebar-brand-text"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 700,
                    fontSize: '1.15rem',
                    color: 'var(--brand)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                  }}
                  className="select-none truncate"
                >
                  ARALert
                </div>
              </Link>

              {/* Collapse button in original right-side position; smoothly appears on hover without layout shift */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity duration-200 opacity-0 group-hover/header:opacity-100 focus:opacity-100 cursor-pointer shrink-0"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isSidebarCollapsed ? '0.875rem 0.35rem' : '0.875rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {renderNavItems(isSidebarCollapsed)}
        </nav>

        {/* Sidebar Footer Profile */}
        <div
          style={{
            padding: 0,
            borderTop: '1px solid var(--brand-border)',
            background: 'var(--brand-light)',
            position: 'relative',
            flexShrink: 0,
            width: '100%',
          }}
        >
          {isSidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              title={user?.first_name || user?.username || 'Profile'}
              aria-label="Profile and account menu"
              style={{
                width: '100%',
                height: '60px',
                borderRadius: '0px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--brand) 18%, var(--surface-card))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="avatar"
                  style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="flex items-center justify-center shrink-0 rounded-lg bg-white text-[var(--brand)] dark:bg-slate-800 dark:text-[var(--brand)] border border-[var(--brand-border)]"
                  style={{ width: '34px', height: '34px' }}
                >
                  <UserIcon size={16} />
                </div>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-label="Profile and account menu"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                height: '60px',
                padding: '0 1.25rem',
                borderRadius: '0px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--brand) 18%, var(--surface-card))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="avatar"
                  style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div
                  className="flex items-center justify-center shrink-0 rounded-lg bg-white text-[var(--brand)] dark:bg-slate-800 dark:text-[var(--brand)] border border-[var(--brand-border)]"
                  style={{ width: '34px', height: '34px' }}
                >
                  <UserIcon size={16} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user?.first_name || user?.username}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: 'var(--brand)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {getRoleLabel()}
                </span>
              </div>
              <ChevronUp size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} />
            </button>
          )}
        </div>
      </aside>

      {/* ── Mobile Sidebar Drawer (< 1024px) ───────────────────────── */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden animate-fade-in"
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col lg:hidden transition-transform duration-300 ease-in-out shadow-2xl ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
        style={{
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--slate-200)',
        }}
      >
        {/* Mobile Drawer Header */}
        <div
          style={{
            minHeight: '64px',
            borderBottom: '1px solid var(--slate-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1rem 0 1.25rem',
            flexShrink: 0,
          }}
        >
          <Link
            to={user?.is_superuser ? '/superadmin' : user?.role ? `/${user.role}` : '/'}
            onClick={() => setIsMobileDrawerOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              textDecoration: 'none',
            }}
          >
            <img
              src={aralertLogo}
              alt="ARALert"
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain',
              }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <span
              style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                color: 'var(--brand)',
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-heading)',
              }}
            >
              ARALert
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(false)}
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile Navigation */}
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
          {renderNavItems(false, () => setIsMobileDrawerOpen(false))}
        </nav>

        {/* Mobile Sidebar Footer Profile */}
        <div
          style={{
            padding: 0,
            borderTop: '1px solid var(--brand-border)',
            background: 'var(--brand-light)',
            position: 'relative',
            flexShrink: 0,
            width: '100%',
          }}
        >
          <button
            type="button"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            aria-label="Profile and account menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              height: '60px',
              padding: '0 1.25rem',
              borderRadius: '0px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--brand) 18%, var(--surface-card))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt="avatar"
                style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div
                className="flex items-center justify-center shrink-0 rounded-lg bg-white text-[var(--brand)] dark:bg-slate-800 dark:text-[var(--brand)] border border-[var(--brand-border)]"
                style={{ width: '34px', height: '34px' }}
              >
                <UserIcon size={16} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.first_name || user?.username}
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: 'var(--brand)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {getRoleLabel()}
              </span>
            </div>
            <ChevronUp size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} />
          </button>
        </div>
      </aside>

      {/* ── Main Panel ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        {/* ── Top Bar ── */}
        <header
          className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-2.5 xs:px-3 sm:px-6 lg:px-8 shrink-0 z-10"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* Page title & Mobile Menu Toggle */}
          <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Open Navigation"
              aria-label="Open Navigation"
            >
              <Menu size={20} />
            </button>
            <h1
              className="truncate text-xs sm:text-sm md:text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight"
              style={{
                margin: 0,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '-0.02em',
              }}
            >
              {getPageTitle()}
            </h1>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 relative shrink-0">
            {/* High Risk Alert (Warning Triangle Icon - Tutor role) */}
            {user?.role === 'tutor' && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowRiskList((prev) => !prev);
                    setShowTutorNotifications(false);
                    setShowStudentNotes(false);
                    setProfileMenuOpen(false);
                    setIsRiskShaking(true);
                    setRiskShakeKey((prev) => prev + 1);
                  }}
                  aria-label="High Risk Alerts"
                  title={
                    highRiskCount > 0
                      ? `${highRiskCount} HIGH RISK Student(s) Alert`
                      : 'High Risk Students Alert'
                  }
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
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.93)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--brand-light)';
                    e.currentTarget.style.color = 'var(--brand-dark)';
                    e.currentTarget.style.borderColor = 'var(--brand-border)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.background = 'var(--surface-muted)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--slate-200)';
                  }}
                >
                  <span
                    key={riskShakeKey}
                    className={isRiskShaking ? 'animate-bell-shake' : ''}
                    onAnimationEnd={() => setIsRiskShaking(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transformOrigin: 'center center',
                    }}
                  >
                    <AlertTriangle size={17} />
                  </span>
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
                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                      }}
                    >
                      {highRiskCount}
                    </span>
                  )}
                </button>

                {/* Risk dropdown */}
                {showRiskList && (
                  <>
                    {/* Mobile Backdrop */}
                    <div
                      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs sm:hidden"
                      onClick={() => setShowRiskList(false)}
                      aria-hidden="true"
                    />

                    {/* Notification Panel */}
                    <div
                      className="animate-fade-in-scale fixed inset-x-2.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[380px] max-w-[calc(100vw-20px)] bg-[var(--surface-card)] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-xl shadow-2xl sm:shadow-xl z-50 overflow-hidden"
                    >
                      {/* Dropdown header */}
                      <div
                        style={{
                          padding: '0.875rem 1.25rem',
                          background: 'var(--surface-muted)',
                          borderBottom: '1px solid var(--slate-200)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <AlertTriangle size={15} color="#EF4444" />
                          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            HIGH RISK STUDENTS ALERT
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowRiskList(false)}
                          aria-label="Close alerts"
                          style={{
                            width: '32px',
                            height: '32px',
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
                          <X size={16} />
                        </button>
                      </div>

                      {/* Risk list body */}
                      <div style={{ maxHeight: 'min(420px, calc(100vh - 140px))', overflowY: 'auto', padding: '0.75rem sm:1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {/* High risk */}
                        <div style={{ background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', borderRadius: '10px', padding: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--risk-high-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>High Risk</p>
                            </div>
                            <span style={{ background: 'var(--risk-high-badge-bg)', color: 'var(--risk-high-text)', fontSize: '0.72rem', fontWeight: 800, borderRadius: '99px', padding: '2px 8px', border: '1px solid var(--risk-high-border)' }}>
                              {highRiskStudents.length}
                            </span>
                          </div>
                          {highRiskStudents.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--risk-high-text)', margin: 0, padding: '0.5rem 0' }}>No high-risk students detected.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {highRiskStudents.map((row) => (
                                <div key={`high-${row.student.id}`} style={{ background: 'var(--surface-card)', border: '1px solid var(--risk-high-border)', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                                  <Link
                                    to={`/tutor/students/${row.student.id}`}
                                    state={{ from: 'dashboard' }}
                                    onClick={() => setShowRiskList(false)}
                                    style={{ textDecoration: 'none', display: 'block' }}
                                    className="group"
                                  >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                                      <div className="min-w-0 flex-1">
                                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }} className="group-hover:text-[var(--brand)] transition-colors break-words">
                                          {row.student.full_name}
                                        </p>
                                        <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                          Composite: <span style={{ fontWeight: 700, color: 'var(--risk-high-text)' }}>{parseFloat(row.compositeScore.toFixed(1)).toString()}%</span>
                                        </p>
                                        {acknowledgedNotes[row.student.id] && (
                                          <div style={{ marginTop: '5px' }}>
                                            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                              {acknowledgedNotes[row.student.id]}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                      <span style={{ background: 'var(--risk-high-badge-bg)', color: 'var(--risk-high-text)', fontSize: '0.65rem', fontWeight: 800, borderRadius: '4px', padding: '2px 6px', textTransform: 'uppercase', flexShrink: 0, border: '1px solid var(--risk-high-border)' }}>HIGH</span>
                                    </div>
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => handleAcknowledgeInitiate(row)}
                                    style={{
                                      marginTop: '0.5rem',
                                      width: '100%',
                                      minHeight: '38px',
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--slate-200)',
                                      background: 'var(--surface-muted)',
                                      color: 'var(--text-secondary)',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      transition: 'var(--transition-fast)',
                                      fontFamily: 'var(--font-body)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
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
                  </>
                )}
              </div>
            )}

            {/* Notification Bell (School Admin & Super Admin) */}
            {(user?.role === 'admin' || user?.is_superuser) && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditRequestsModal(true);
                    setIsEditBellRinging(true);
                    setEditBellRingKey((prev) => prev + 1);
                  }}
                  aria-label="EDIT REQUESTS"
                  title={
                    pendingEditRequestsCount > 0
                      ? `${pendingEditRequestsCount} EDIT REQUEST(S) Pending Review`
                      : 'EDIT REQUESTS'
                  }
                  style={{
                    position: 'relative',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: pendingEditRequestsCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-muted)',
                    border: pendingEditRequestsCount > 0 ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid var(--slate-200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: pendingEditRequestsCount > 0 ? '#D97706' : 'var(--text-secondary)',
                    transition: 'var(--transition-fast)',
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.93)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = pendingEditRequestsCount > 0 ? 'rgba(245, 158, 11, 0.2)' : 'var(--brand-light)';
                    e.currentTarget.style.color = pendingEditRequestsCount > 0 ? '#B45309' : 'var(--brand-dark)';
                    e.currentTarget.style.borderColor = pendingEditRequestsCount > 0 ? '#F59E0B' : 'var(--brand-border)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.background = pendingEditRequestsCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-muted)';
                    e.currentTarget.style.color = pendingEditRequestsCount > 0 ? '#D97706' : 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = pendingEditRequestsCount > 0 ? 'rgba(245, 158, 11, 0.45)' : 'var(--slate-200)';
                  }}
                >
                  <span
                    key={editBellRingKey}
                    className={isEditBellRinging ? 'animate-bell-shake' : ''}
                    onAnimationEnd={() => setIsEditBellRinging(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transformOrigin: 'top center',
                    }}
                  >
                    <Bell size={17} />
                  </span>
                  {pendingEditRequestsCount > 0 && (
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
                        background: '#F59E0B',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #fff',
                        boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)',
                      }}
                    >
                      {pendingEditRequestsCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Notification Bell (Tutor role) */}
            {user?.role === 'tutor' && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowTutorNotifications((prev) => !prev);
                    setShowRiskList(false);
                    setProfileMenuOpen(false);
                    setIsBellRinging(true);
                    setBellRingKey((prev) => prev + 1);
                  }}
                  aria-label="Notifications"
                  title="Notifications"
                  style={{
                    position: 'relative',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: pendingEditRequestsCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-muted)',
                    border: pendingEditRequestsCount > 0 ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid var(--slate-200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: pendingEditRequestsCount > 0 ? '#D97706' : 'var(--text-secondary)',
                    transition: 'var(--transition-fast)',
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.93)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = pendingEditRequestsCount > 0 ? 'rgba(245, 158, 11, 0.2)' : 'var(--brand-light)';
                    e.currentTarget.style.color = pendingEditRequestsCount > 0 ? '#B45309' : 'var(--brand-dark)';
                    e.currentTarget.style.borderColor = pendingEditRequestsCount > 0 ? '#F59E0B' : 'var(--brand-border)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.background = pendingEditRequestsCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-muted)';
                    e.currentTarget.style.color = pendingEditRequestsCount > 0 ? '#D97706' : 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = pendingEditRequestsCount > 0 ? 'rgba(245, 158, 11, 0.45)' : 'var(--slate-200)';
                  }}
                >
                  <span
                    key={bellRingKey}
                    className={isBellRinging ? 'animate-bell-shake' : ''}
                    onAnimationEnd={() => setIsBellRinging(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transformOrigin: 'top center',
                    }}
                  >
                    <Bell size={17} />
                  </span>
                  {pendingEditRequestsCount > 0 && (
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
                        background: '#F59E0B',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #fff',
                        boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
                      }}
                    >
                      {pendingEditRequestsCount}
                    </span>
                  )}
                </button>

                {/* Tutor Notifications Dropdown */}
                {showTutorNotifications && (
                  <>
                    {/* Mobile Backdrop */}
                    <div
                      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs sm:hidden"
                      onClick={() => setShowTutorNotifications(false)}
                      aria-hidden="true"
                    />

                    {/* Notification Panel */}
                    <div
                      className="animate-fade-in-scale fixed inset-x-2.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[410px] max-w-[calc(100vw-20px)] bg-[var(--surface-card)] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-xl shadow-2xl sm:shadow-xl z-50 overflow-hidden"
                    >
                      <div
                        style={{
                          padding: '0.875rem 1.25rem',
                          background: 'var(--surface-muted)',
                          borderBottom: '1px solid var(--slate-200)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Bell size={15} className="text-slate-600 dark:text-slate-300" />
                          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            NOTIFICATIONS & REQUESTS
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={fetchEditRequests}
                            title="Refresh status"
                            aria-label="Refresh status"
                            style={{
                              width: '30px',
                              height: '30px',
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
                            <RefreshCw size={14} className={isLoadingEditRequests ? 'animate-spin' : ''} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowTutorNotifications(false)}
                            aria-label="Close notifications"
                            style={{
                              width: '30px',
                              height: '30px',
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
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Notifications List Body */}
                      <div style={{ maxHeight: 'min(460px, calc(100vh - 140px))', overflowY: 'auto', padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        
                        {/* Section: Student Edit Requests Status */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Student Edit Requests
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--slate-200)', color: 'var(--text-secondary)', borderRadius: '99px', padding: '1px 7px' }}>
                              {myEditRequests.length}
                            </span>
                          </div>

                          {myEditRequests.length === 0 ? (
                            <div style={{ background: 'var(--surface-muted)', border: '1px dashed var(--slate-200)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                No student edit requests submitted.
                              </p>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {myEditRequests.map((req) => {
                                const isPending = req.status === 'pending';
                                const isApproved = req.status === 'approved';
                                const isRejected = req.status === 'rejected';

                                const cardBg = isPending
                                  ? 'rgba(245, 158, 11, 0.05)'
                                  : isApproved
                                  ? 'rgba(34, 197, 94, 0.05)'
                                  : 'rgba(239, 68, 68, 0.05)';

                                const cardBorder = isPending
                                  ? 'rgba(245, 158, 11, 0.3)'
                                  : isApproved
                                  ? 'rgba(34, 197, 94, 0.3)'
                                  : 'rgba(239, 68, 68, 0.3)';

                                return (
                                  <div
                                    key={req.id}
                                    style={{
                                      background: cardBg,
                                      border: `1px solid ${cardBorder}`,
                                      borderRadius: '8px',
                                      padding: '0.65rem 0.75rem',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.35rem',
                                    }}
                                  >
                                    {/* Header with Student Name and Status Badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {req.student_name}
                                      </p>
                                      {isPending && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(245, 158, 11, 0.15)', color: '#D97706', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          <Clock size={10} /> Pending
                                        </span>
                                      )}
                                      {isApproved && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(34, 197, 94, 0.15)', color: '#16A34A', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          <CheckCircle2 size={10} /> Approved
                                        </span>
                                      )}
                                      {isRejected && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(239, 68, 68, 0.15)', color: '#DC2626', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          <XCircle size={10} /> Rejected
                                        </span>
                                      )}
                                    </div>

                                    {/* Proposed details */}
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                      <div>
                                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Proposed Name: </span>
                                        <span>{req.proposed_last_name}, {req.proposed_first_name} {req.proposed_middle_name || ''}</span>
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2px' }}>
                                        <span>
                                          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Level: </span>
                                          <span style={{ fontWeight: 700 }}>{formatAralLevel(req.proposed_aral_level)}</span>
                                        </span>
                                        {req.proposed_lrn && (
                                          <span>
                                            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>LRN: </span>
                                            <span>{req.proposed_lrn}</span>
                                          </span>
                                        )}
                                      </div>
                                      {req.reason && (
                                        <p style={{ margin: '3px 0 0', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                          "{req.reason}"
                                        </p>
                                      )}
                                    </div>

                                    {/* Review outcome notes */}
                                    {isApproved && (
                                      <div style={{ marginTop: '2px', padding: '4px 6px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: '4px', fontSize: '0.72rem', color: '#15803D', fontWeight: 600 }}>
                                        ✓ Changes approved and applied to official record{req.reviewed_by_name ? ` by ${req.reviewed_by_name}` : ''}.
                                      </div>
                                    )}
                                    {isRejected && (
                                      <div style={{ marginTop: '2px', padding: '4px 6px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '4px', fontSize: '0.72rem', color: '#B91C1C', fontWeight: 600 }}>
                                        ✕ Rejected{req.reviewed_by_name ? ` by ${req.reviewed_by_name}` : ''}: {req.rejection_reason || 'No specific reason provided.'}
                                      </div>
                                    )}
                                    {isPending && (
                                      <div style={{ marginTop: '2px', fontSize: '0.7rem', color: '#D97706' }}>
                                        Submitted on {new Date(req.created_at).toLocaleDateString()}. Waiting for administrator approval.
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Notification Bell (Student role) */}
            {user?.role === 'student' && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowStudentNotes((visible) => !visible);
                    setIsBellRinging(true);
                    setBellRingKey((prev) => prev + 1);
                  }}
                  aria-label="Tutor notes & notifications"
                  title="Tutor Notes & Notifications"
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
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.93)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--brand-light)';
                    e.currentTarget.style.color = 'var(--brand-dark)';
                    e.currentTarget.style.borderColor = 'var(--brand-border)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.background = 'var(--surface-muted)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--slate-200)';
                  }}
                >
                  <span
                    key={bellRingKey}
                    className={isBellRinging ? 'animate-bell-shake' : ''}
                    onAnimationEnd={() => setIsBellRinging(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transformOrigin: 'top center',
                    }}
                  >
                    <Bell size={17} />
                  </span>
                  {(studentNotes.filter((note) => !note.student_acknowledged).length + pendingEditRequestsCount) > 0 && (
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
                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                      }}
                    >
                      {studentNotes.filter((note) => !note.student_acknowledged).length + pendingEditRequestsCount}
                    </span>
                  )}
                </button>

                {showStudentNotes && (
                  <>
                    {/* Mobile Backdrop */}
                    <div
                      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs sm:hidden"
                      onClick={() => setShowStudentNotes(false)}
                      aria-hidden="true"
                    />

                    {/* Student Notes Panel */}
                    <div
                      className="animate-fade-in-scale fixed inset-x-2.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[410px] max-w-[calc(100vw-20px)] bg-[var(--surface-card)] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-xl shadow-2xl sm:shadow-xl z-50 overflow-hidden"
                    >
                      <div style={{ padding: '0.875rem 1.25rem', background: 'var(--surface-muted)', borderBottom: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Bell size={15} className="text-slate-600 dark:text-slate-300" />
                          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            NOTIFICATIONS & REQUESTS
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowStudentNotes(false)}
                          aria-label="Close notifications"
                          style={{
                            width: '32px',
                            height: '32px',
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
                          <X size={16} />
                        </button>
                      </div>
                      <div style={{ maxHeight: 'min(460px, calc(100vh - 140px))', overflowY: 'auto', padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        
                        {/* Profile Edit Requests Section (if any) */}
                        {myEditRequests.length > 0 && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Profile Edit Requests
                              </span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--slate-200)', color: 'var(--text-secondary)', borderRadius: '99px', padding: '1px 7px' }}>
                                {myEditRequests.length}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {myEditRequests.map((req) => {
                                const isPending = req.status === 'pending';
                                const isApproved = req.status === 'approved';
                                const isRejected = req.status === 'rejected';

                                const cardBg = isPending
                                  ? 'rgba(245, 158, 11, 0.05)'
                                  : isApproved
                                  ? 'rgba(34, 197, 94, 0.05)'
                                  : 'rgba(239, 68, 68, 0.05)';

                                const cardBorder = isPending
                                  ? 'rgba(245, 158, 11, 0.3)'
                                  : isApproved
                                  ? 'rgba(34, 197, 94, 0.3)'
                                  : 'rgba(239, 68, 68, 0.3)';

                                return (
                                  <div
                                    key={req.id}
                                    style={{
                                      background: cardBg,
                                      border: `1px solid ${cardBorder}`,
                                      borderRadius: '8px',
                                      padding: '0.65rem 0.75rem',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.35rem',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Profile Details Update
                                      </p>
                                      {isPending && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(245, 158, 11, 0.15)', color: '#D97706', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          <Clock size={10} /> Pending
                                        </span>
                                      )}
                                      {isApproved && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(34, 197, 94, 0.15)', color: '#16A34A', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          <CheckCircle2 size={10} /> Approved
                                        </span>
                                      )}
                                      {isRejected && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(239, 68, 68, 0.15)', color: '#DC2626', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          <XCircle size={10} /> Rejected
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                      <div>
                                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Proposed Name: </span>
                                        <span>{req.proposed_last_name}, {req.proposed_first_name} {req.proposed_middle_name || ''}</span>
                                      </div>
                                    </div>
                                    {isApproved && (
                                      <div style={{ marginTop: '2px', padding: '4px 6px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: '4px', fontSize: '0.72rem', color: '#15803D', fontWeight: 600 }}>
                                        ✓ Profile update approved and applied.
                                      </div>
                                    )}
                                    {isRejected && (
                                      <div style={{ marginTop: '2px', padding: '4px 6px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '4px', fontSize: '0.72rem', color: '#B91C1C', fontWeight: 600 }}>
                                        ✕ Rejected{req.reviewed_by_name ? ` by ${req.reviewed_by_name}` : ''}: {req.rejection_reason || 'No specific reason provided.'}
                                      </div>
                                    )}
                                    {isPending && (
                                      <div style={{ marginTop: '2px', fontSize: '0.7rem', color: '#D97706' }}>
                                        Submitted on {new Date(req.created_at).toLocaleDateString()}. Waiting for administrator approval.
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Tutor Notes Section */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Tutor Intervention Notes
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--slate-200)', color: 'var(--text-secondary)', borderRadius: '99px', padding: '1px 7px' }}>
                              {studentNotes.length}
                            </span>
                          </div>
                          {studentNotes.length === 0 ? (
                            <p style={{ margin: 0, padding: '1rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>No current tutor notes.</p>
                          ) : studentNotes.map((note) => {
                            const colors = studentNoteStyle(note.risk_level);
                            return (
                              <div key={note.id} style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '0.75rem 0.85rem', marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: colors.label, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{note.risk_level_display} risk</span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(note.date_created).toLocaleDateString()}</span>
                                </div>
                                <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: colors.text, lineHeight: 1.45, wordBreak: 'break-word' }}>{note.details}</p>
                                {note.student_acknowledged ? (
                                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', fontWeight: 700, color: colors.acknowledged }}>✓ Acknowledged</p>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => acknowledgeStudentNote(note.id)}
                                    style={{
                                      marginTop: '0.55rem',
                                      border: 'none',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      background: colors.button,
                                      color: '#fff',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      fontFamily: 'var(--font-body)',
                                      minHeight: '36px',
                                    }}
                                  >
                                    Acknowledge Note
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Change Theme Toggle */}
            <ThemeToggle />
          </div>
        </header>

        {/* ── Content body ── */}
        <main className="flex-1 w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 md:p-6 lg:p-8">
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

      {/* Profile Popover Menu (triggered from bottom of sidebar) */}
      {profileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs lg:bg-transparent"
            onClick={() => setProfileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            className="animate-fade-in-scale fixed z-50 bg-[var(--surface-card)] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            style={{
              bottom: isSidebarCollapsed ? '0px' : '60px',
              left: isMobileDrawerOpen ? '0px' : isSidebarCollapsed ? '68px' : '0px',
              width: isMobileDrawerOpen ? '288px' : isSidebarCollapsed ? '260px' : '260px',
              maxWidth: isMobileDrawerOpen ? '85vw' : '260px',
              borderRadius: '0px',
            }}
          >
            {/* User info */}
            <div
              style={{
                padding: '0.875rem 1rem',
                background: 'var(--surface-muted)',
                borderBottom: '1px solid var(--slate-200)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.01em',
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {(() => {
                  const first = (user?.first_name || '').trim().toUpperCase();
                  const last = (user?.last_name || '').trim().toUpperCase();
                  const mi = user?.middle_name && user.middle_name.trim() ? `${user.middle_name.trim()[0].toUpperCase()}.` : '';
                  const given = [first, mi].filter(Boolean).join(' ');
                  if (last && given) return `${last}, ${given}`;
                  return last || given || user?.full_name || user?.username;
                })()}
              </p>
              <p
                style={{
                  margin: '3px 0 0',
                  fontSize: '0.73rem',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {user?.email}
              </p>
            </div>

            {/* Menu items */}
            <div style={{ padding: 0 }}>
              {[
                { label: 'View Profile', icon: <UserIcon size={15} />, action: () => { setProfileMenuOpen(false); setIsMobileDrawerOpen(false); navigate('/profile'); } },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-body)',
                    transition: 'var(--transition-fast)',
                    textAlign: 'center',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-light)'; e.currentTarget.style.color = 'var(--brand-dark)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}

              <div style={{ borderTop: '1px solid var(--slate-200)' }} />

              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(true);
                  setProfileMenuOpen(false);
                  setIsMobileDrawerOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#DC2626',
                  fontFamily: 'var(--font-body)',
                  transition: 'var(--transition-fast)',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <LogOut size={15} style={{ color: '#EF4444' }} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Student Edit Requests Review Modal (Admin & SuperAdmin) */}
      {(user?.role === 'admin' || user?.is_superuser) && (
        <StudentEditRequestsModal
          isOpen={showEditRequestsModal}
          onClose={() => setShowEditRequestsModal(false)}
          onRequestReviewed={fetchEditRequests}
        />
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowLogoutConfirm(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
          >
            <div
              className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-5 sm:p-6 shadow-xl animate-fade-in-scale"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 id="logout-confirm-title" className="text-base font-semibold text-slate-900 dark:text-white">
                  Confirm Logout
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Are you sure you want to log out? You will need to sign in again to access your account.
                </p>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-xs font-medium text-white shadow-xs transition-colors cursor-pointer"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
};
