import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  LayoutDashboard, Users, User as UserIcon, UserCheck, LogOut, QrCode, Scan,
  Award, Bell, ChevronDown, ChevronUp, Shield, BookOpen, X, FileText, Moon, Sun,
  PanelLeftClose, PanelLeftOpen, Menu, AlertTriangle, Calendar, Check,
  Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, Archive, History,
} from 'lucide-react';
import { userService } from '../services/userService';
import { academicService } from '../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../utils/analyticsHelpers';
import { parseTutorRoleDetailsFromUser, isStudentInCohort, buildTutorClassSections } from '../utils/tutorCohortHelpers';

import type { AcademicRisk, StudentEditRequest } from '../types';
import { TutorGreetingIntro, checkGreetingEligibility } from '../components/TutorGreetingIntro';
import { ThemeToggle } from '../components/ThemeToggle';
import { StudentEditRequestsModal } from '../components/StudentEditRequestsModal';
import { PageFallback } from '../components/PageFallback';
import { ErrorBoundary } from '../components/ErrorBoundary';
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

const AssessmentNavIcon: React.FC<{ active?: boolean; theme?: 'light' | 'dark'; size?: number }> = ({
  active = false,
  theme = 'light',
  size = 18,
}) => {
  if (!active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sidebar-icon"
        style={{ width: size, height: size, flexShrink: 0 }}
      >
        <circle cx="12" cy="8.5" r="5.5" />
        <path d="M8.21 13.89L7 22l5-3 5 3-1.21-8.11" />
      </svg>
    );
  }

  const isDark = theme === 'dark';
  const fillColor = isDark ? '#FFFFFF' : '#0052B7';
  const detailColor = isDark ? '#000000' : '#FFFFFF';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="sidebar-icon active"
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <path
        d="M8.21 13.5L6.5 22l5.5-3 5.5 3-1.71-8.5"
        fill={fillColor}
        stroke={fillColor}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M12 14.5v3.5"
        stroke={detailColor}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8.5" r="5.8" fill={fillColor} stroke={fillColor} strokeWidth="0.8" />
      <path
        d="M12 5.2l.9 1.9 2.1.3-1.5 1.5.35 2.1-1.85-1-1.85 1 .35-2.1-1.5-1.5 2.1-.3z"
        fill={detailColor}
      />
    </svg>
  );
};

const ArchiveNavIcon: React.FC<{ active?: boolean; theme?: 'light' | 'dark'; size?: number }> = ({
  active = false,
  theme = 'light',
  size = 18,
}) => {
  if (!active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sidebar-icon"
        style={{ width: size, height: size, flexShrink: 0 }}
      >
        <rect x="3" y="3.5" width="18" height="4.5" rx="1.5" />
        <path d="M4.5 8v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8" />
        <line x1="10" y1="13" x2="14" y2="13" />
      </svg>
    );
  }

  const isDark = theme === 'dark';
  const fillColor = isDark ? '#FFFFFF' : '#0052B7';
  const detailColor = isDark ? '#000000' : '#FFFFFF';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="sidebar-icon active"
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <path
        d="M4.5 8.5v10.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8.5z"
        fill={fillColor}
        stroke={fillColor}
        strokeWidth="0.8"
      />
      <rect x="3" y="3.5" width="18" height="5" rx="1.5" fill={fillColor} stroke={fillColor} strokeWidth="0.8" />
      <line x1="3" y1="8.5" x2="21" y2="8.5" stroke={detailColor} strokeWidth="1.3" />
      <rect x="9.5" y="12.5" width="5" height="2.2" rx="1" fill={detailColor} />
    </svg>
  );
};

const AuditLogNavIcon: React.FC<{ active?: boolean; theme?: 'light' | 'dark'; size?: number }> = ({
  active = false,
  theme = 'light',
  size = 18,
}) => {
  if (!active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sidebar-icon"
        style={{ width: size, height: size, flexShrink: 0 }}
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    );
  }

  const isDark = theme === 'dark';
  const fillColor = isDark ? '#FFFFFF' : '#0052B7';
  const detailColor = isDark ? '#000000' : '#FFFFFF';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="sidebar-icon active"
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        fill={fillColor}
        stroke={fillColor}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        fill="none"
        stroke={detailColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="16" y1="12.5" x2="8" y2="12.5" stroke={detailColor} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="16.5" x2="8" y2="16.5" stroke={detailColor} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="10.5" y1="8.5" x2="8" y2="8.5" stroke={detailColor} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
};

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

  const hasGreetingPending = useMemo(() => {
    return checkGreetingEligibility(user).show;
  }, [user]);

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

  const getProfilePath = () => {
    if (user?.is_superuser) return '/superadmin/profile';
    if (user?.role === 'admin') return '/admin/profile';
    return '/profile';
  };

  const getSettingsPath = () => {
    if (user?.is_superuser) return '/superadmin/settings';
    if (user?.role === 'admin') return '/admin/settings';
    return '/profile';
  };

  const getDisplayName = () => {
    if (!user) return 'User';
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) return user.first_name;
    if (user.full_name) return user.full_name;
    return user.username || 'User';
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.first_name) return user.first_name[0].toUpperCase();
    if (user.username) return user.username[0].toUpperCase();
    return 'U';
  };

  const getPageTitle = () => {
    const p = location.pathname;
    if (p.includes('/audit-logs')) return 'Audit Log';
    if (p.includes('/archive')) return 'Archive';
    if (p.includes('/evaluations')) return 'Assessment';
    if (
      p.includes('/superadmin/users') ||
      p.includes('/superadmin/students') ||
      p.includes('/superadmin/tutors') ||
      p.includes('/superadmin/faculty') ||
      p.includes('/superadmin/principals') ||
      p.includes('/superadmin/admins') ||
      p.includes('/superadmin/superadmins')
    ) return 'User Management';
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

  const [highRiskStudents, setHighRiskStudents] = useState<StudentRiskRow[]>([]);
  const highRiskCount = highRiskStudents.length;
  const [moderateRiskStudents, setModerateRiskStudents] = useState<StudentRiskRow[]>([]);
  const [showRiskList, setShowRiskList] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, boolean>>({});
  const [acknowledgedRiskIds, setAcknowledgedRiskIds] = useState<Record<string, number>>({});
  const [studentRiskAlerts, setStudentRiskAlerts] = useState<AcademicRisk[]>([]);
  const [showStudentEditRequests, setShowStudentEditRequests] = useState(false);
  const [showStudentHighRisk, setShowStudentHighRisk] = useState(false);
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

  const studentAlertStyle = (riskLevel: AcademicRisk['risk_level']) => {
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
        userService.getAllUsers({ role: 'student', assigned_tutor: user.id }),
        academicService.getGrades(),
        academicService.getAttendanceHistory(),
        academicService.getAcademicRisks(),
      ]);

      const students = Array.isArray(studentRes) ? studentRes : [];
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
      // currently classified as High risk.
      setAcknowledgedAlerts(Object.fromEntries(Object.keys(latestResolvedRiskByStudent).map((id) => [id, true])));
      setAcknowledgedRiskIds(Object.fromEntries(Object.entries(latestResolvedRiskByStudent).map(([id, r]: [string, AcademicRisk]) => [id, r.id])));
    } catch (error) {
      console.error('Failed to load tutor alerts', error);
    }
  };

  const tutorClassSections = useMemo(() => {
    if (!user || user.role !== 'tutor') return [];
    return buildTutorClassSections(user, highRiskStudents);
  }, [user, highRiskStudents]);

  const handleAcknowledgeAlert = async (row: StudentRiskRow) => {
    const existingRiskId = acknowledgedRiskIds[row.student.id];
    const studentRiskLevel: AcademicRisk['risk_level'] =
      row.riskTier === 'High' ? 'high'
        : row.riskTier === 'Medium' ? 'medium'
          : 'low';
    try {
      if (existingRiskId) {
        await academicService.updateAcademicRisk(existingRiskId, { resolved: true });
      } else {
        const newRisk = await academicService.createAcademicRisk({
          student: row.student.id,
          risk_level: studentRiskLevel,
          details: '',
          resolved: true,
        });
        setAcknowledgedRiskIds((prev) => ({ ...prev, [row.student.id]: newRisk.id }));
      }
      setAcknowledgedAlerts((prev) => ({ ...prev, [row.student.id]: true }));
    } catch (error) {
      console.error('Failed to acknowledge risk alert', error);
    }
  };

  const fetchStudentRiskAlerts = async () => {
    if (user?.role !== 'student') return;
    try {
      const risks = await academicService.getAcademicRisks();
      setStudentRiskAlerts(
        risks
          .filter((risk) => risk.resolved || risk.risk_level === 'high')
          .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime())
      );
    } catch (error) {
      console.error('Failed to load student risk alerts', error);
    }
  };

  const acknowledgeStudentAlert = async (riskId: number) => {
    try {
      await academicService.updateAcademicRisk(riskId, { student_acknowledged: true });
      await fetchStudentRiskAlerts();
    } catch (error) {
      console.error('Failed to acknowledge risk alert', error);
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

  useEffect(() => { fetchRiskStudents(); }, [user, location.pathname]);
  useEffect(() => { if (!showRiskList) return; fetchRiskStudents(); }, [showRiskList]);
  useEffect(() => { fetchStudentRiskAlerts(); }, [user]);
  useEffect(() => { fetchEditRequests(); }, [user, location.pathname]);
  useEffect(() => {
    if (showTutorNotifications || showStudentEditRequests || showEditRequestsModal) {
      fetchEditRequests();
    }
    if (showStudentHighRisk) {
      fetchStudentRiskAlerts();
    }
  }, [showTutorNotifications, showStudentEditRequests, showStudentHighRisk, showEditRequestsModal]);
  useEffect(() => {
    setProfileMenuOpen(false);
    setIsMobileDrawerOpen(false);
    setShowRiskList(false);
    setShowTutorNotifications(false);
    setShowStudentEditRequests(false);
    setShowStudentHighRisk(false);
    setShowEditRequestsModal(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const renderNavItems = (collapsed: boolean = false, onItemClick?: () => void) => {
    return (
      <>
        {/* SuperAdmin nav */}
        {user?.is_superuser && (
          <>
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
              className={navLinkClass(
                isActivePrefix('/superadmin/users') ||
                isActivePrefix('/superadmin/students') ||
                isActivePrefix('/superadmin/tutors') ||
                isActivePrefix('/superadmin/faculty') ||
                isActivePrefix('/superadmin/principals') ||
                isActivePrefix('/superadmin/admins') ||
                isActivePrefix('/superadmin/superadmins'),
                collapsed
              )}
              title="User Management"
            >
              <AssetSidebarIcon
                darkSrc={studentsDarkDefault}
                darkActiveSrc={studentsDarkActive}
                lightSrc={studentsLightDefault}
                lightActiveSrc={studentsLightActive}
                active={
                  isActivePrefix('/superadmin/users') ||
                  isActivePrefix('/superadmin/students') ||
                  isActivePrefix('/superadmin/tutors') ||
                  isActivePrefix('/superadmin/faculty') ||
                  isActivePrefix('/superadmin/principals') ||
                  isActivePrefix('/superadmin/admins') ||
                  isActivePrefix('/superadmin/superadmins')
                }
                alt="User Management"
                size={18}
                theme={theme}
              />
              {!collapsed && <span className="truncate">User Management</span>}
            </Link>
            <Link
              to="/superadmin/evaluations"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/superadmin/evaluations') || isActivePrefix('/admin/evaluations'), collapsed)}
              title="Assessment"
            >
              <AssessmentNavIcon active={isActivePrefix('/superadmin/evaluations') || isActivePrefix('/admin/evaluations')} theme={theme} />
              {!collapsed && <span className="truncate">Assessment</span>}
            </Link>
            <Link
              to="/superadmin/archive"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/superadmin/archive'), collapsed)}
              title="Archive"
            >
              <ArchiveNavIcon active={isActivePrefix('/superadmin/archive')} theme={theme} />
              {!collapsed && <span className="truncate">Archive</span>}
            </Link>
            <Link
              to="/superadmin/audit-logs"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/superadmin/audit-logs'), collapsed)}
              title="Audit Log"
            >
              <AuditLogNavIcon active={isActivePrefix('/superadmin/audit-logs')} theme={theme} />
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
              className={navLinkClass(isActivePrefix('/admin/evaluations') || isActivePrefix('/superadmin/evaluations'), collapsed)}
              title="Assessment"
            >
              <AssessmentNavIcon active={isActivePrefix('/admin/evaluations') || isActivePrefix('/superadmin/evaluations')} theme={theme} />
              {!collapsed && <span className="truncate">Assessment</span>}
            </Link>
            <Link
              to="/admin/archive"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/admin/archive'), collapsed)}
              title="Archive"
            >
              <ArchiveNavIcon active={isActivePrefix('/admin/archive')} theme={theme} />
              {!collapsed && <span className="truncate">Archive</span>}
            </Link>
            <Link
              to="/admin/audit-logs"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/admin/audit-logs'), collapsed)}
              title="Audit Log"
            >
              <AuditLogNavIcon active={isActivePrefix('/admin/audit-logs')} theme={theme} />
              {!collapsed && <span className="truncate">Audit Log</span>}
            </Link>

            <div style={{ height: '1px', background: 'var(--slate-100)', margin: '0.5rem 0' }} />

            <Link to="/admin/attendance" onClick={onItemClick} className={navLinkClass(isActive('/admin/attendance'), collapsed)} title="DTR Log">
              <AssetSidebarIcon
                darkSrc={clockDarkDefault}
                darkActiveSrc={clockDarkActive}
                lightSrc={clockLightDefault}
                lightActiveSrc={clockLightActive}
                active={isActive('/admin/attendance')}
                alt="DTR Log"
                size={18}
                theme={theme}
              />
              {!collapsed && <span className="truncate">DTR Log</span>}
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
            <Link to="/principal" onClick={onItemClick} className={navLinkClass(isActive('/principal'), collapsed)} title="Dashboard">
              <AssetSidebarIcon
                darkSrc={dashboardDarkDefault}
                darkActiveSrc={dashboardDarkActive}
                lightSrc={dashboardLightDefault}
                lightActiveSrc={dashboardLightActive}
                active={isActive('/principal')}
                alt="Dashboard"
                size={18}
                theme={theme}
              />
              {!collapsed && <span className="truncate">Dashboard</span>}
            </Link>

            <Link to="/principal/analytics" onClick={onItemClick} className={navLinkClass(isActive('/principal/analytics'), collapsed)} title="Data Analytics">
              <AssetSidebarIcon
                darkSrc={analyticsDarkDefault}
                darkActiveSrc={analyticsDarkActive}
                lightSrc={analyticsLightDefault}
                lightActiveSrc={analyticsLightActive}
                active={isActive('/principal/analytics')}
                alt="Data Analytics"
                size={18}
                theme={theme}
              />
              {!collapsed && <span className="truncate">Data Analytics</span>}
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

        {/* Faculty nav */}
        {user?.role === 'faculty' && (
          <>
            <Link to="/faculty" onClick={onItemClick} className={navLinkClass(isActive('/faculty'), collapsed)} title="Dashboard">
              <AssetSidebarIcon
                darkSrc={dashboardDarkDefault}
                darkActiveSrc={dashboardDarkActive}
                lightSrc={dashboardLightDefault}
                lightActiveSrc={dashboardLightActive}
                active={isActive('/faculty')}
                alt="Dashboard"
                size={18}
                theme={theme}
              />
              {!collapsed && <span className="truncate">Dashboard</span>}
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

      {/* ── System Greeting Intro (Chat Bubble + Flying Mascot) ───── */}
      <TutorGreetingIntro
        user={user}
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
            /* Expanded State: Show ARALert logo + brand text; collapse button on the right in its original position, smoothly revealed on hover */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Link
                to={user?.is_superuser ? '/superadmin' : user?.role ? `/${user.role}` : '/'}
                className="group/brand flex items-center gap-1.5 no-underline min-w-0"
                title={`ARALert / ${getRoleLabel()}`}
              >
                <div
                  id="sidebar-brand-logo"
                  style={{
                    opacity: hasGreetingPending ? 0 : 1,
                    transition: 'opacity 0.25s ease-in-out',
                  }}
                  className="w-7 h-7 flex items-center justify-center shrink-0 select-none group-hover/brand:scale-105 will-change-transform"
                >
                  <img
                    src={aralertLogo}
                    alt="ARALert"
                    className="w-full h-full object-contain block"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div
                  id="sidebar-brand-text"
                  className="flex items-center gap-1 min-w-0 select-none whitespace-nowrap will-change-transform"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 700,
                    fontSize: '0.825rem',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    transform: hasGreetingPending ? 'translateX(-34px)' : 'none',
                    transformOrigin: 'left center',
                  }}
                >
                  <span className="text-black dark:text-white shrink-0">
                    ARALert
                  </span>
                  {getRoleLabel() && (
                    <span className="flex items-center gap-1 min-w-0 select-none whitespace-nowrap">
                      <span className="text-black dark:text-white opacity-40 shrink-0">
                        /
                      </span>
                      <span className="text-black dark:text-white whitespace-nowrap">
                        {getRoleLabel()}
                      </span>
                    </span>
                  )}
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
        <div className="p-2 shrink-0 w-full">
          {isSidebarCollapsed ? (
            <button
              type="button"
              id="sidebar-profile-button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              title={getDisplayName()}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="Profile and account menu"
              className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center border transition-all duration-150 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                profileMenuOpen
                  ? 'border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 shadow-xs'
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={getDisplayName()}
                  className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-zinc-700"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center font-medium text-xs border border-slate-200 dark:border-zinc-700">
                  <UserIcon size={14} strokeWidth={1.8} />
                </div>
              )}
            </button>
          ) : (
            <button
              type="button"
              id="sidebar-profile-button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="Profile and account menu"
              className={`w-full flex items-center gap-2.5 p-2 rounded-xl border transition-all duration-150 cursor-pointer select-none text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                profileMenuOpen
                  ? 'border-slate-300 dark:border-zinc-700 bg-slate-100/90 dark:bg-zinc-800/80 shadow-xs'
                  : 'border-transparent hover:border-slate-200 dark:hover:border-zinc-800 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60'
              }`}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={getDisplayName()}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200/80 dark:border-zinc-700 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center font-medium text-xs border border-slate-200/80 dark:border-zinc-700 shrink-0">
                  <UserIcon size={15} strokeWidth={1.8} />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                  {getDisplayName()}
                </span>
              </div>
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
            <div className="flex items-center gap-1.5 min-w-0 whitespace-nowrap">
              <span
                style={{
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  fontFamily: 'var(--font-heading)',
                  lineHeight: 1.2,
                }}
                className="text-black dark:text-white select-none whitespace-nowrap shrink-0"
              >
                ARALert
              </span>
              {getRoleLabel() && (
                <span className="flex items-center gap-1 min-w-0 select-none whitespace-nowrap">
                  <span
                    style={{
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      fontFamily: 'var(--font-heading)',
                      lineHeight: 1.2,
                    }}
                    className="text-black dark:text-white opacity-40 shrink-0"
                  >
                    /
                  </span>
                  <span
                    style={{
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      fontFamily: 'var(--font-heading)',
                      lineHeight: 1.2,
                    }}
                    className="text-black dark:text-white whitespace-nowrap"
                  >
                    {getRoleLabel()}
                  </span>
                </span>
              )}
            </div>
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
        <div className="p-2.5 shrink-0 w-full">
          <button
            type="button"
            id="mobile-drawer-profile-button"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            aria-label="Profile and account menu"
            className={`w-full flex items-center gap-2.5 p-2 rounded-xl border transition-all duration-150 cursor-pointer select-none text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
              profileMenuOpen
                ? 'border-slate-300 dark:border-zinc-700 bg-slate-100/90 dark:bg-zinc-800/80 shadow-xs'
                : 'border-transparent hover:border-slate-200 dark:hover:border-zinc-800 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60'
            }`}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={getDisplayName()}
                className="w-8 h-8 rounded-full object-cover border border-slate-200/80 dark:border-zinc-700 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center font-medium text-xs border border-slate-200/80 dark:border-zinc-700 shrink-0">
                <UserIcon size={15} strokeWidth={1.8} />
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                {getDisplayName()}
              </span>
            </div>
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
                    setShowStudentEditRequests(false);
                    setShowStudentHighRisk(false);
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
                          <AlertTriangle size={15} className="text-slate-600 dark:text-slate-300" />
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
                      <div
                        style={{
                          maxHeight: 'min(420px, calc(100vh - 140px))',
                          overflowY: 'auto',
                          background: 'var(--risk-high-bg)',
                          padding: '0.875rem 1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                        }}
                      >
                        {tutorClassSections.map((cls) => (
                          <div key={cls.key} className="flex flex-col gap-2">
                            {/* Class division header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.125rem' }}>
                              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, color: 'var(--risk-high-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {cls.label}
                              </p>
                              <span style={{ background: 'var(--risk-high-badge-bg)', color: 'var(--risk-high-text)', fontSize: '0.72rem', fontWeight: 800, borderRadius: '99px', padding: '2px 8px', border: '1px solid var(--risk-high-border)' }}>
                                {cls.students.length}
                              </span>
                            </div>

                            {cls.students.length === 0 ? (
                              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--risk-high-border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                                <p style={{ fontSize: '0.8rem', color: 'var(--risk-high-text)', margin: 0 }}>
                                  No high-risk students detected.
                                </p>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                {cls.students.map((row) => (
                                  <div
                                    key={`high-${cls.key}-${row.student.id}`}
                                    className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-[#0A0A0A] p-3.5 space-y-2.5 shadow-2xs"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <Link
                                        to={`/tutor/students/${row.student.id}`}
                                        state={{ from: 'dashboard' }}
                                        onClick={() => setShowRiskList(false)}
                                        className="group min-w-0 flex-1 no-underline"
                                      >
                                        <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-[var(--brand)] transition-colors truncate m-0">
                                          {row.student.full_name}
                                        </p>
                                        <p className="text-[11px] text-slate-400 font-mono m-0 mt-0.5">
                                          LRN: {row.student.lrn || 'N/A'}
                                        </p>
                                      </Link>
                                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                                        HIGH RISK
                                      </span>
                                    </div>

                                    {/* Composite score */}
                                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                                      <span className="text-slate-600 dark:text-slate-400 text-[11px] font-medium">Composite Score:</span>
                                      <span className="font-extrabold text-rose-600 dark:text-rose-400">{parseFloat(row.compositeScore.toFixed(1)).toString()}%</span>
                                    </div>

                                    {/* Recovery targets: matching text format */}
                                    <div className="flex flex-col gap-1.5 pt-0.5">
                                      {row.neededPresentAttendance > 0 && (
                                        <span className="inline-flex items-center rounded bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/50">
                                          Need +{row.neededPresentAttendance} more Present records to improve risk level
                                        </span>
                                      )}
                                      {row.neededPassedScores > 0 && (
                                        <span className="inline-flex items-center rounded bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 dark:text-rose-300 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50">
                                          Need +{row.neededPassedScores} more Passed records to improve risk level
                                        </span>
                                      )}
                                      {row.neededPresentAttendance === 0 && row.neededPassedScores === 0 && (
                                        <span className="inline-flex items-center rounded bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 dark:text-rose-300 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50">
                                          Need +1 more Passed record to improve risk level
                                        </span>
                                      )}
                                    </div>

                                    {/* Direct Acknowledge Alert button */}
                                    <div className="pt-2 border-t border-slate-100 dark:border-neutral-800">
                                      {acknowledgedAlerts[row.student.id] ? (
                                        <div className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-lg">
                                          <Check size={14} className="stroke-[3]" />
                                          <span>Alert Addressed</span>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleAcknowledgeAlert(row)}
                                          className="w-full py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-dark)] transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                        >
                                          <CheckCircle2 size={14} />
                                          <span>Acknowledge Alert</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
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
                    setShowEditRequestsModal((prev) => !prev);
                    setShowRiskList(false);
                    setProfileMenuOpen(false);
                    setIsEditBellRinging(true);
                    setEditBellRingKey((prev) => prev + 1);
                  }}
                  aria-label="Edit Request Notifications"
                  title={
                    pendingEditRequestsCount > 0
                      ? `${pendingEditRequestsCount} Edit Request Notification(s) Pending Review`
                      : 'Edit Request Notifications'
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

                {/* Edit Request Notifications Dropdown Popup */}
                {showEditRequestsModal && (
                  <StudentEditRequestsModal
                    isOpen={showEditRequestsModal}
                    onClose={() => setShowEditRequestsModal(false)}
                    onRequestReviewed={fetchEditRequests}
                  />
                )}
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
                    setShowStudentEditRequests(false);
                    setShowStudentHighRisk(false);
                    setProfileMenuOpen(false);
                    setIsBellRinging(true);
                    setBellRingKey((prev) => prev + 1);
                  }}
                  aria-label="Edit Request Notifications"
                  title={
                    pendingEditRequestsCount > 0
                      ? `${pendingEditRequestsCount} Edit Request Notification(s)`
                      : 'Edit Request Notifications'
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
                            EDIT REQUEST NOTIFICATION
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

            {/* Student Notifications: Edit Request Notifications & High Risk Alerts */}
            {user?.role === 'student' && (
              <>
                {/* 1. EDIT REQUEST NOTIFICATION (Bell Icon) */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStudentEditRequests((prev) => !prev);
                      setShowStudentHighRisk(false);
                      setProfileMenuOpen(false);
                      setIsBellRinging(true);
                      setBellRingKey((prev) => prev + 1);
                    }}
                    aria-label="Edit Request Notifications"
                    title={
                      pendingEditRequestsCount > 0
                        ? `${pendingEditRequestsCount} Edit Request Notification(s) Pending Review`
                        : 'Edit Request Notifications'
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

                  {/* Student Edit Request Notifications Dropdown */}
                  {showStudentEditRequests && (
                    <>
                      {/* Mobile Backdrop */}
                      <div
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs sm:hidden"
                        onClick={() => setShowStudentEditRequests(false)}
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
                              EDIT REQUEST NOTIFICATION
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
                              onClick={() => setShowStudentEditRequests(false)}
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

                        {/* Edit Requests List Body */}
                        <div style={{ maxHeight: 'min(460px, calc(100vh - 140px))', overflowY: 'auto', padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Profile Edit Requests
                              </span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--slate-200)', color: 'var(--text-secondary)', borderRadius: '99px', padding: '1px 7px' }}>
                                {myEditRequests.length}
                              </span>
                            </div>

                            {myEditRequests.length === 0 ? (
                              <div style={{ background: 'var(--surface-muted)', border: '1px dashed var(--slate-200)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  No edit requests submitted.
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
                                        {(req.proposed_aral_level || req.proposed_lrn) && (
                                          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2px' }}>
                                            {req.proposed_aral_level && (
                                              <span>
                                                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Level: </span>
                                                <span style={{ fontWeight: 700 }}>{formatAralLevel(req.proposed_aral_level)}</span>
                                              </span>
                                            )}
                                            {req.proposed_lrn && (
                                              <span>
                                                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>LRN: </span>
                                                <span>{req.proposed_lrn}</span>
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        {req.reason && (
                                          <p style={{ margin: '3px 0 0', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                            "{req.reason}"
                                          </p>
                                        )}
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
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 2. HIGH RISK ALERT (Triangle Alert Icon to the right of EDIT REQUEST NOTIFICATION) */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStudentHighRisk((prev) => !prev);
                      setShowStudentEditRequests(false);
                      setProfileMenuOpen(false);
                      setIsRiskShaking(true);
                      setRiskShakeKey((prev) => prev + 1);
                    }}
                    aria-label="High Risk Alerts"
                    title={
                      studentRiskAlerts.filter((alert) => !alert.student_acknowledged).length > 0
                        ? `${studentRiskAlerts.filter((alert) => !alert.student_acknowledged).length} High Risk Alert(s)`
                        : 'High Risk Alert'
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
                    {studentRiskAlerts.filter((alert) => !alert.student_acknowledged).length > 0 && (
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
                        {studentRiskAlerts.filter((alert) => !alert.student_acknowledged).length}
                      </span>
                    )}
                  </button>

                  {/* Student High Risk Dropdown */}
                  {showStudentHighRisk && (
                    <>
                      {/* Mobile Backdrop */}
                      <div
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs sm:hidden"
                        onClick={() => setShowStudentHighRisk(false)}
                        aria-hidden="true"
                      />

                      {/* High Risk Panel */}
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
                            <AlertTriangle size={15} className="text-slate-600 dark:text-slate-300" />
                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                              HIGH RISK ALERT
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowStudentHighRisk(false)}
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

                        {/* High Risk Alerts Body */}
                        <div style={{ maxHeight: 'min(460px, calc(100vh - 140px))', overflowY: 'auto', padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Academic Risk Alerts
                              </span>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'var(--slate-200)', color: 'var(--text-secondary)', borderRadius: '99px', padding: '1px 7px' }}>
                                {studentRiskAlerts.length}
                              </span>
                            </div>
                            {studentRiskAlerts.length === 0 ? (
                              <div style={{ background: 'var(--surface-muted)', border: '1px dashed var(--slate-200)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>No high risk alerts.</p>
                              </div>
                            ) : (
                              studentRiskAlerts.map((alert) => {
                                const colors = studentAlertStyle(alert.risk_level);
                                return (
                                  <div key={alert.id} style={{ background: colors.background, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '0.75rem 0.85rem', marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: colors.label, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{alert.risk_level_display || alert.risk_level} risk</span>
                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(alert.date_created).toLocaleDateString()}</span>
                                    </div>
                                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: colors.text, lineHeight: 1.45, wordBreak: 'break-word' }}>
                                      {alert.resolved
                                        ? 'Alert acknowledged by tutor. Continue attending sessions and completing activities to improve your academic performance.'
                                        : 'Academic risk status flagged for tutor intervention. Please coordinate with your assigned tutor.'}
                                    </p>
                                    {alert.student_acknowledged ? (
                                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', fontWeight: 700, color: colors.acknowledged }}>✓ Acknowledged</p>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => acknowledgeStudentAlert(alert.id)}
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
                                        Acknowledge Alert
                                      </button>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Change Theme Toggle */}
            <ThemeToggle />
          </div>
        </header>

        {/* ── Content body ── */}
        <main className="flex-1 w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 md:p-6 lg:p-8">
          <ErrorBoundary
            fallbackTitle="Dashboard View Error"
            fallbackMessage="An issue occurred while rendering this dashboard view. You can reload or navigate to another page using the sidebar."
          >
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>



      {/* Modern Profile Dropdown Menu (Sidebar Triggered) */}
      {profileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/10 dark:bg-black/25 backdrop-blur-[1px] lg:bg-transparent"
            onClick={() => setProfileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed z-50 rounded-xl bg-white dark:bg-[#000000] border border-slate-200 dark:border-neutral-800 shadow-xl dark:shadow-2xl overflow-hidden text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-150"
            style={{
              bottom: isSidebarCollapsed && !isMobileDrawerOpen ? '12px' : '64px',
              left: isMobileDrawerOpen ? '12px' : isSidebarCollapsed ? '76px' : '12px',
              width: isMobileDrawerOpen
                ? 'min(264px, calc(85vw - 24px))'
                : isSidebarCollapsed
                  ? '224px'
                  : '236px',
            }}
            role="menu"
          >
            {/* User summary header */}
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/40">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {getDisplayName()}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                {user?.email || getRoleLabel()}
              </p>
            </div>

            {/* Menu items */}
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setIsMobileDrawerOpen(false);
                  navigate(getProfilePath());
                }}
                className="group w-full flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-white transition-all duration-150 text-left cursor-pointer"
                role="menuitem"
              >
                <UserIcon
                  size={16}
                  strokeWidth={2}
                  className="text-slate-400 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors shrink-0"
                />
                <span>Profile</span>
              </button>
            </div>

            <div className="border-t border-slate-100 dark:border-neutral-800" />

            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setIsMobileDrawerOpen(false);
                  setShowLogoutConfirm(true);
                }}
                className="group w-full flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-700 dark:hover:text-red-300 transition-all duration-150 text-left cursor-pointer"
                role="menuitem"
              >
                <LogOut
                  size={16}
                  strokeWidth={2}
                  className="text-red-600 dark:text-red-400 transition-colors shrink-0"
                />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}



      {/* Logout Confirmation Modal */}
      {showLogoutConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowLogoutConfirm(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-zinc-800 bg-[var(--surface-card)] p-6 shadow-2xl animate-fade-in-scale"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3">
                <h3
                  id="logout-confirm-title"
                  className="text-base font-semibold text-slate-900 dark:text-white leading-tight"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  Confirm Logout
                </h3>
                <p className="text-xs text-slate-400 dark:text-zinc-400 leading-tight mt-1">
                  End your active session
                </p>
              </div>

              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                Are you sure you want to log out? You will need to sign in again to access your account.
              </p>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-xs sm:text-sm font-medium text-white shadow-xs transition-colors cursor-pointer"
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
