import React, { useEffect, useState, useMemo, useRef, Suspense, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  LayoutDashboard, Users, User as UserIcon, UserCheck, LogOut, QrCode, Scan,
  Award, Bell, ChevronDown, ChevronUp, Shield, BookOpen, X, FileText, Moon, Sun,
  PanelLeftClose, PanelLeftOpen, Menu, AlertTriangle, Calendar, Check, HelpCircle,
  Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, Archive, History,
} from 'lucide-react';
import { userService } from '../services/userService';
import { academicService } from '../services/academicService';
import { computeStudentRiskRows, type StudentRiskRow } from '../utils/analyticsHelpers';
import { parseTutorRoleDetailsFromUser, isStudentInCohort, buildTutorClassSections, parseStudentGradeAndSection } from '../utils/tutorCohortHelpers';
import { getReviewerLabel } from '../utils/studentFormatters';

import type { AcademicRisk, StudentEditRequest, User } from '../types';
import { TutorGreetingIntro, checkGreetingEligibility } from '../components/TutorGreetingIntro';
import { ThemeToggle } from '../components/ThemeToggle';
import { StudentEditRequestsModal } from '../components/StudentEditRequestsModal';
import { ReportProblemModal } from '../components/ReportProblemModal';
import { ticketService, SupportTicketItem } from '../services/ticketService';
import { announcementService, SystemAnnouncementItem } from '../services/announcementService';
import { SystemUpdateNotification, SYSTEM_UPDATES } from '../components/SystemUpdateNotification';
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

const TicketsNavIcon: React.FC<{ active?: boolean; theme?: 'light' | 'dark'; size?: number }> = ({
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
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7.5 10l1.5 1.5L11.5 9" />
        <line x1="13.5" y1="10" x2="17.5" y2="10" />
        <path d="M7.5 15l1.5 1.5L11.5 14" />
        <line x1="13.5" y1="15" x2="17.5" y2="15" />
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
      <rect x="3" y="4" width="18" height="16" rx="2" fill={fillColor} stroke={fillColor} strokeWidth="0.8" />
      <path d="M7.5 10l1.5 1.5L11.5 9" fill="none" stroke={detailColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="13.5" y1="10" x2="17.5" y2="10" stroke={detailColor} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 15l1.5 1.5L11.5 14" fill="none" stroke={detailColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="13.5" y1="15" x2="17.5" y2="15" stroke={detailColor} strokeWidth="1.8" strokeLinecap="round" />
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

const SynchronizedPulseBadge: React.FC<{
  count: number;
}> = ({ count }) => {
  const delayRef = useRef<string>(`-${Math.floor(Date.now() % 2000)}ms`);

  return (
    <span
      className={`animate-badge-pulse transition-all duration-200 ${
        count > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
      }`}
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
        animationDelay: delayRef.current,
        transformOrigin: 'center center',
      }}
      aria-hidden={count <= 0}
    >
      {count > 0 ? count : ''}
    </span>
  );
};

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [hasGreetingPending, setHasGreetingPending] = useState<boolean>(() => {
    return checkGreetingEligibility(user).show;
  });

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
      } catch { }
      return next;
    });
    setHasGreetingPending(false);
  };

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [showReportProblemModal, setShowReportProblemModal] = useState<boolean>(false);

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
    if (p.includes('/tickets')) return 'Tickets';
    if (p.includes('/audit-logs')) return 'Audit Log';
    if (p.includes('/archive')) return 'Archive';
    if (p.includes('/evaluations')) return 'Assessment';
    if (
      p.includes('/superadmin/users') ||
      p.includes('/superadmin/students') ||
      p.includes('/superadmin/tutors') ||
      p.includes('/superadmin/principals') ||
      p.includes('/superadmin/admins') ||
      p.includes('/superadmin/superadmins')
    ) return 'User Management';
    if (p.includes('/admin/students') || p.includes('/admin/tutors') || p.includes('/admin/principals') || p.includes('/admin/users')) return 'User Management';
    if (p.includes('/tutor/students')) return 'Assigned Students';
    if (p.includes('/student/attendance')) return 'QR Attendance';
    if (p.includes('/tutor/attendance')) return 'QR Attendance';
    if (p.includes('/profile')) return user?.role === 'tutor' ? 'Tutor Profile' : 'Profile';
    if (p.includes('/settings')) return 'System Settings';
    if (p.includes('/analytics')) return 'Data Analytics';
    if (p.includes('/tutor/scores')) return 'Score';
    if (p.includes('/academic-records') || p.includes('/scores')) return user?.role === 'student' ? 'Academic Records' : 'Score';
    return 'Dashboard';
  };

  const [highRiskStudents, setHighRiskStudents] = useState<StudentRiskRow[]>([]);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, boolean>>(() => {
    try {
      const currentUserId = user?.id ? String(user.id) : (user?.username ? user.username : 'user');
      const raw = localStorage.getItem(`aralert_ack_alerts_${currentUserId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [acknowledgedRiskIds, setAcknowledgedRiskIds] = useState<Record<string, number>>({});
  const highRiskCount = useMemo(() => {
    return highRiskStudents.filter((r) => !acknowledgedAlerts[r.student.id]).length;
  }, [highRiskStudents, acknowledgedAlerts]);
  const [moderateRiskStudents, setModerateRiskStudents] = useState<StudentRiskRow[]>([]);
  const [showRiskList, setShowRiskList] = useState(false);
  const [selectedAlertClass, setSelectedAlertClass] = useState<string>('all');
  const [principalTutors, setPrincipalTutors] = useState<User[]>([]);
  const [expandedPrincipalTutorId, setExpandedPrincipalTutorId] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileMenuEnterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleProfileMouseEnter = () => {
    if (profileMenuHoverTimerRef.current) {
      clearTimeout(profileMenuHoverTimerRef.current);
      profileMenuHoverTimerRef.current = null;
    }
    // Gentle 60ms debounce on enter to avoid accidental flicker when passing over
    if (!profileMenuOpen && !profileMenuEnterTimerRef.current) {
      profileMenuEnterTimerRef.current = setTimeout(() => {
        setProfileMenuOpen(true);
        profileMenuEnterTimerRef.current = null;
      }, 60);
    }
  };

  const handleProfileMouseLeave = () => {
    if (profileMenuEnterTimerRef.current) {
      clearTimeout(profileMenuEnterTimerRef.current);
      profileMenuEnterTimerRef.current = null;
    }
    if (profileMenuHoverTimerRef.current) {
      clearTimeout(profileMenuHoverTimerRef.current);
    }
    profileMenuHoverTimerRef.current = setTimeout(() => {
      setProfileMenuOpen(false);
    }, 240);
  };

  const handleProfileButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (profileMenuHoverTimerRef.current) {
      clearTimeout(profileMenuHoverTimerRef.current);
      profileMenuHoverTimerRef.current = null;
    }
    if (profileMenuEnterTimerRef.current) {
      clearTimeout(profileMenuEnterTimerRef.current);
      profileMenuEnterTimerRef.current = null;
    }
    setProfileMenuOpen(true);
  };

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('#sidebar-profile-button') &&
        !target.closest('#profile-dropdown-menu') &&
        !target.closest('#mobile-drawer-profile-button')
      ) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    return () => {
      if (profileMenuHoverTimerRef.current) {
        clearTimeout(profileMenuHoverTimerRef.current);
      }
      if (profileMenuEnterTimerRef.current) {
        clearTimeout(profileMenuEnterTimerRef.current);
      }
    };
  }, []);
  const [showStudentEditRequests, setShowStudentEditRequests] = useState(false);
  const [pendingEditRequestsCount, setPendingEditRequestsCount] = useState<number>(0);
  const [myTickets, setMyTickets] = useState<SupportTicketItem[]>([]);
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0);
  const [systemAnnouncements, setSystemAnnouncements] = useState<SystemAnnouncementItem[]>([]);
  const [userNotificationFilter, setUserNotificationFilter] = useState<'all' | 'tickets' | 'edits' | 'updates'>('all');
  const [isClearingResolved, setIsClearingResolved] = useState<boolean>(false);
  const activeTicketNotificationCount = user?.is_superuser ? pendingTicketsCount : myTickets.length;
  const totalNotificationsCount = pendingEditRequestsCount + activeTicketNotificationCount + systemAnnouncements.length + SYSTEM_UPDATES.length;
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

  // Scoped to the authenticated user ID so view status and acknowledgments persist across logout, laptop restart, and page refresh
  const userId = user?.id ? String(user.id) : (user?.username ? user.username : 'user');
  const ackStorageKey = `aralert_ack_alerts_${userId}`;
  const notifStorageKey = `aralert_seen_notif_ids_${userId}`;
  const notifTimeStorageKey = `aralert_notif_last_seen_${userId}`;

  // Set of notification item IDs already seen by this user
  const [seenNotifItemIds, setSeenNotifItemIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(notifStorageKey);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set();
    }
  });

  // Last timestamp when notifications drawer was opened
  const [lastSeenNotifTimestamp, setLastSeenNotifTimestamp] = useState<string>(() => {
    try {
      return localStorage.getItem(notifTimeStorageKey) || '';
    } catch {
      return '';
    }
  });

  // Re-sync on user switch
  useEffect(() => {
    try {
      const rawAck = localStorage.getItem(ackStorageKey);
      if (rawAck) {
        setAcknowledgedAlerts(JSON.parse(rawAck));
      }

      const rawNotif = localStorage.getItem(notifStorageKey);
      setSeenNotifItemIds(new Set(rawNotif ? JSON.parse(rawNotif).map(String) : []));

      const rawTime = localStorage.getItem(notifTimeStorageKey);
      setLastSeenNotifTimestamp(rawTime || '');
    } catch {
      // ignore
    }
  }, [ackStorageKey, notifStorageKey, notifTimeStorageKey]);

  // Helper to get a stable unique ID for any notification item
  const getInboxItemId = (item: { itemKind: string; id?: any; ticket_id?: any }) => {
    if (item.itemKind === 'ticket') return `ticket_${item.ticket_id || item.id}`;
    if (item.itemKind === 'edit') return `edit_${item.id}`;
    if (item.itemKind === 'announcement') return `announcement_${item.id}`;
    if (item.itemKind === 'system') return `system_${item.id}`;
    return `item_${item.id}`;
  };

  // Mark all current notifications as seen (persisted in localStorage)
  const markNotificationsAsSeen = useCallback(() => {
    const nowIso = new Date().toISOString();
    const items = [
      ...systemAnnouncements.map((a) => ({ ...a, itemKind: 'announcement' as const })),
      ...SYSTEM_UPDATES.map((u) => ({ ...u, itemKind: 'system' as const })),
      ...myEditRequests.map((req) => ({ ...req, itemKind: 'edit' as const })),
      ...myTickets.map((t) => ({ ...t, itemKind: 'ticket' as const })),
    ];
    const currentIds = items.map(getInboxItemId);
    setSeenNotifItemIds((prev) => {
      const updated = new Set([...prev, ...currentIds]);
      try {
        localStorage.setItem(notifStorageKey, JSON.stringify(Array.from(updated)));
        localStorage.setItem(notifTimeStorageKey, nowIso);
      } catch {}
      return updated;
    });
    setLastSeenNotifTimestamp(nowIso);
  }, [systemAnnouncements, myEditRequests, myTickets, notifStorageKey, notifTimeStorageKey]);

  const isAnyNotificationOpen = showTutorNotifications || showEditRequestsModal || showStudentEditRequests;

  // When any notification window is open, automatically mark currently loaded notifications as seen
  useEffect(() => {
    if (isAnyNotificationOpen) {
      markNotificationsAsSeen();
    }
  }, [isAnyNotificationOpen, systemAnnouncements, myEditRequests, myTickets, markNotificationsAsSeen]);

  // Notifications unread count: items NOT yet seen and created after the last view timestamp
  const unreadNotificationsCount = useMemo(() => {
    const items = [
      ...systemAnnouncements.map((a) => ({ ...a, itemKind: 'announcement' as const })),
      ...SYSTEM_UPDATES.map((u) => ({ ...u, itemKind: 'system' as const })),
      ...myEditRequests.map((req) => ({ ...req, itemKind: 'edit' as const })),
      ...myTickets.map((t) => ({ ...t, itemKind: 'ticket' as const })),
    ];

    if (items.length === 0) return 0;

    const lastSeenTime = lastSeenNotifTimestamp ? new Date(lastSeenNotifTimestamp).getTime() : 0;

    return items.filter((item) => {
      const itemId = getInboxItemId(item);
      if (seenNotifItemIds.has(itemId)) return false;
      if (lastSeenTime > 0 && item.created_at) {
        const itemTime = new Date(item.created_at).getTime();
        if (itemTime <= lastSeenTime) return false;
      }
      return true;
    }).length;
  }, [systemAnnouncements, myEditRequests, myTickets, seenNotifItemIds, lastSeenNotifTimestamp]);

  // Disappear instantly while open; keep count of unacknowledged alerts when closed
  const displayRiskBadgeCount = showRiskList ? 0 : highRiskCount;
  const displayNotifBadgeCount = isAnyNotificationOpen ? 0 : unreadNotificationsCount;

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
  const isProfileActive = location.pathname === getProfilePath() || location.pathname === '/profile' || location.pathname.endsWith('/profile');

  const navLinkClass = (active: boolean, collapsed: boolean = isSidebarCollapsed) =>
    `sidebar-item ${active ? 'active' : ''} ${collapsed ? 'justify-center !p-0 w-10 h-10 mx-auto' : ''}`;

  const fetchRiskStudents = async () => {
    if (!user || (user.role !== 'tutor' && user.role !== 'principal')) return;
    try {
      const isPrincipal = user.role === 'principal';
      const [studentRes, gradesRaw, attRaw, risksRaw, tutorsRes] = await Promise.all([
        isPrincipal
          ? userService.getAllUsers({ role: 'student' }).catch(() => [] as User[])
          : userService.getAllUsers({ role: 'student', assigned_tutor: user.id }).catch(() => [] as User[]),
        academicService.getGrades().catch(() => [] as any),
        academicService.getAttendanceHistory().catch(() => [] as any),
        academicService.getAcademicRisks().catch(() => [] as any),
        isPrincipal
          ? userService.getAllUsers({ role: 'tutor' }).catch(() => [] as User[])
          : Promise.resolve([] as User[]),
      ]);

      const students = Array.isArray(studentRes) ? studentRes : [];
      const grades = Array.isArray(gradesRaw) ? gradesRaw : (gradesRaw as any)?.results ?? [];
      const attendanceLogs = Array.isArray(attRaw) ? attRaw : (attRaw as any)?.results ?? [];
      const riskRecords = Array.isArray(risksRaw) ? risksRaw : (risksRaw as any)?.results ?? [];
      const tutors = Array.isArray(tutorsRes) ? tutorsRes : [];

      if (isPrincipal) {
        setPrincipalTutors(tutors);
      }

      const rows = computeStudentRiskRows(students, grades, attendanceLogs);
      const highRiskRows = rows.filter((r) => r.riskTier === 'High').sort((a, b) => b.compositeScore - a.compositeScore);
      const moderateRiskRows = rows.filter((r) => r.riskTier === 'Moderate' || r.riskTier === 'Medium').sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5);

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
      const backendResolvedMap = Object.fromEntries(
        Object.keys(latestResolvedRiskByStudent).map((id) => [id, true])
      );
      setAcknowledgedAlerts((prev) => {
        const merged = { ...prev, ...backendResolvedMap };
        try {
          localStorage.setItem(ackStorageKey, JSON.stringify(merged));
        } catch {}
        return merged;
      });
      setAcknowledgedRiskIds(Object.fromEntries(Object.entries(latestResolvedRiskByStudent).map(([id, r]: [string, AcademicRisk]) => [id, r.id])));
    } catch (error) {
      console.error('Failed to load risk alerts', error);
    }
  };

  const tutorClassSections = useMemo(() => {
    if (!user || user.role !== 'tutor') return [];
    return buildTutorClassSections(user, highRiskStudents);
  }, [user, highRiskStudents]);

  const principalClassSections = useMemo(() => {
    if (!user || user.role !== 'principal') return [];
    const classesMap = new Map<string, { key: string; label: string; cohort: string; aralLevel: string; students: StudentRiskRow[] }>();

    highRiskStudents.forEach((r) => {
      const st = r.student;
      const rawAral = (st.aral_level || 'basic').toLowerCase().trim();
      const aralLevel = rawAral.includes('summer') ? 'summer' : rawAral.includes('plus') ? 'plus' : 'basic';
      let subj = (st.subject || '').trim();
      if (!subj) {
        subj = aralLevel === 'basic' ? 'Filipino' : 'English';
      } else {
        const norm = subj.toLowerCase();
        if (norm.includes('math')) subj = 'Math';
        else if (norm.includes('sci')) subj = 'Science';
        else if (norm.includes('english')) subj = 'English';
        else if (norm.includes('filipino')) subj = aralLevel === 'plus' ? 'English' : 'Filipino';
        else if (norm.includes('reading')) subj = aralLevel === 'plus' ? 'English' : 'Filipino';
        else subj = subj.charAt(0).toUpperCase() + subj.slice(1);
      }
      const { grade, section } = parseStudentGradeAndSection(st);
      let cleanGrade = (grade || 'GRADE 7').toUpperCase().trim();
      if (!cleanGrade.startsWith('GRADE')) {
        const numMatch = cleanGrade.match(/\d+/);
        cleanGrade = numMatch ? `GRADE ${numMatch[0]}` : `GRADE ${cleanGrade}`;
      }
      const cleanSec = (section || 'HYACINTH').toUpperCase().trim();
      const cohortStr = `${cleanGrade} - ${cleanSec}`;
      const label = `${aralLevel.toUpperCase()} • ${subj.toUpperCase()} • ${cohortStr}`;
      const key = `${aralLevel}-${subj}-${cleanGrade}-${cleanSec}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      if (!classesMap.has(key)) {
        classesMap.set(key, { key, label, cohort: cohortStr, aralLevel, students: [] });
      }
      classesMap.get(key)!.students.push(r);
    });

    return Array.from(classesMap.values()).sort((a, b) => b.students.length - a.students.length);
  }, [user, highRiskStudents]);

  const availableClassSections = useMemo(() => {
    if (user?.role === 'principal') return principalClassSections;
    if (user?.role === 'tutor') return tutorClassSections;
    return [];
  }, [user?.role, principalClassSections, tutorClassSections]);

  const principalTutorGroups = useMemo(() => {
    if (!user || user.role !== 'principal') return [];

    const isStudentAssignedToTutor = (s: any, tutorId: string, tutorFullName?: string): boolean => {
      const assigned = s.assigned_tutor;
      const assignedId =
        typeof assigned === 'object' && assigned !== null
          ? String(assigned.id ?? assigned.pk ?? '')
          : String(assigned ?? s.assigned_tutor_id ?? '');
      if (assignedId && assignedId === tutorId) return true;
      if (
        tutorFullName &&
        s.assigned_tutor_name &&
        s.assigned_tutor_name.trim().toLowerCase() === tutorFullName.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    };

    const targetStudents = selectedAlertClass === 'all'
      ? highRiskStudents
      : (principalClassSections.find((c) => c.key === selectedAlertClass)?.students ?? highRiskStudents);

    const groups = principalTutors.map((tutor) => {
      const tutorIdStr = String(tutor.id);
      const tutorFullName = tutor.full_name || `${tutor.first_name || ''} ${tutor.last_name || ''}`.trim() || 'Tutor';

      const assignedStudents = targetStudents.filter((r) =>
        isStudentAssignedToTutor(r.student, tutorIdStr, tutorFullName)
      );

      const classesSet = new Set<string>();
      assignedStudents.forEach((r) => {
        const { grade, section } = parseStudentGradeAndSection(r.student);
        if (grade && section) {
          classesSet.add(`${grade} - ${section}`);
        } else if (grade) {
          classesSet.add(grade);
        } else if (section) {
          classesSet.add(section);
        }
      });
      if (classesSet.size === 0 && tutor.grade_level) {
        tutor.grade_level.split(',').forEach((c: string) => {
          const trimmed = c.trim();
          if (trimmed) classesSet.add(trimmed);
        });
      }
      const classesHandled = classesSet.size > 0 ? Array.from(classesSet).sort().join(', ') : 'No Section Specified';

      return {
        tutor,
        tutorId: tutorIdStr,
        tutorName: tutorFullName,
        classesHandled,
        students: assignedStudents,
      };
    }).filter((g) => g.students.length > 0);

    // Group any unassigned high-risk students so nothing is omitted
    const assignedStudentIds = new Set(groups.flatMap((g) => g.students.map((s) => s.student.id)));
    const unassignedStudents = targetStudents.filter((r) => !assignedStudentIds.has(r.student.id));
    if (unassignedStudents.length > 0) {
      groups.push({
        tutor: { id: 'unassigned', full_name: 'Unassigned Students' } as any,
        tutorId: 'unassigned',
        tutorName: 'Unassigned Students',
        classesHandled: 'General',
        students: unassignedStudents,
      });
    }

    groups.sort((a, b) => b.students.length - a.students.length);
    return groups;
  }, [user, principalTutors, highRiskStudents, selectedAlertClass, principalClassSections]);

  const [isAlertClassDropdownOpen, setIsAlertClassDropdownOpen] = useState(false);
  const alertClassDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (alertClassDropdownRef.current && !alertClassDropdownRef.current.contains(e.target as Node)) {
        setIsAlertClassDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAlertClassDropdownOpen(false);
    };

    if (isAlertClassDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAlertClassDropdownOpen]);

  const selectedAlertClassLabel = useMemo(() => {
    if (selectedAlertClass === 'all') {
      const totalHigh = availableClassSections.reduce((s, c) => s + c.students.length, 0);
      return `ALL CLASSES (${totalHigh} high-risk)`;
    }
    const match = availableClassSections.find((c) => c.key === selectedAlertClass);
    return match ? `${match.label} (${match.students.length})` : 'ALL CLASSES';
  }, [selectedAlertClass, availableClassSections]);

  const handleAcknowledgeAlert = async (row: StudentRiskRow) => {
    const existingRiskId = acknowledgedRiskIds[row.student.id];
    const studentRiskLevel: AcademicRisk['risk_level'] =
      row.riskTier === 'High' ? 'high'
        : (row.riskTier === 'Moderate' || row.riskTier === 'Medium') ? 'moderate'
          : 'low';
    try {
      const actorLabel = user?.role === 'principal' ? (user?.first_name ? `Principal ${user.first_name}` : 'Principal') : (user?.first_name || 'tutor');
      const detailsMsg = `High risk alert acknowledged by ${actorLabel}.`;
      if (existingRiskId) {
        await academicService.updateAcademicRisk(existingRiskId, { resolved: true, details: detailsMsg });
      } else {
        const newRisk = await academicService.createAcademicRisk({
          student: row.student.id,
          risk_level: studentRiskLevel,
          details: detailsMsg,
          resolved: true,
        });
        setAcknowledgedRiskIds((prev) => ({ ...prev, [row.student.id]: newRisk.id }));
      }
      setAcknowledgedAlerts((prev) => {
        const updated = { ...prev, [row.student.id]: true };
        try {
          localStorage.setItem(ackStorageKey, JSON.stringify(updated));
        } catch {}
        return updated;
      });
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
      } else {
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

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    try {
      const data = await ticketService.getTickets();
      setMyTickets(data.results || []);
      setPendingTicketsCount(data.pending_count || 0);
    } catch (err) {
      console.error('Failed to load tickets', err);
    }
  }, [user]);

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    try {
      const data = await announcementService.getAnnouncements();
      setSystemAnnouncements(data.results || []);
    } catch (err) {
      console.error('Failed to load system announcements', err);
    }
  }, [user]);

  const handleDismissTicket = async (ticketId: string) => {
    try {
      await ticketService.dismissTicketForUser(ticketId);
      await fetchTickets();
    } catch (err) {
      console.error('Failed to dismiss ticket', err);
    }
  };

  const handleClearResolvedTickets = async () => {
    const resolvedOrDismissed = myTickets.filter(
      (t) => t.status === 'RESOLVED' || t.status === 'DISMISSED'
    );
    if (resolvedOrDismissed.length === 0) return;
    setIsClearingResolved(true);
    try {
      await Promise.all(
        resolvedOrDismissed.map((t) => ticketService.dismissTicketForUser(t.ticket_id))
      );
      await fetchTickets();
    } catch (err) {
      console.error('Failed to clear resolved tickets', err);
    } finally {
      setIsClearingResolved(false);
    }
  };

  const renderSystemAnnouncementCard = (a: SystemAnnouncementItem) => {
    const isMaintenance = a.announcement_type === 'MAINTENANCE';
    const isUpdate = a.announcement_type === 'UPDATE';

    const cardBg = isMaintenance
      ? 'rgba(245, 158, 11, 0.05)'
      : isUpdate
        ? 'rgba(34, 197, 94, 0.05)'
        : 'rgba(0, 82, 183, 0.05)';

    const cardBorder = isMaintenance
      ? 'rgba(245, 158, 11, 0.3)'
      : isUpdate
        ? 'rgba(34, 197, 94, 0.3)'
        : 'rgba(0, 82, 183, 0.25)';

    const badgeColor = isMaintenance ? '#D97706' : isUpdate ? '#16A34A' : '#0052B7';
    const badgeBg = isMaintenance ? 'rgba(245, 158, 11, 0.15)' : isUpdate ? 'rgba(34, 197, 94, 0.15)' : 'rgba(0, 82, 183, 0.12)';

    return (
      <div
        key={`ann-${a.id}`}
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: '10px',
          padding: '0.75rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {a.title}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', background: badgeBg, color: badgeColor, fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                {a.announcement_type_display}
              </span>
            </div>
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {new Date(a.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--surface-muted)', borderRadius: '6px', padding: '6px 8px', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
          {a.message}
        </div>
      </div>
    );
  };

  const renderTicketNotificationCard = (t: SupportTicketItem) => {
    const isPending = t.status === 'UNDER_REVIEW';
    const isInProgress = t.status === 'IN_PROGRESS';
    const isResolved = t.status === 'RESOLVED';
    const isDismissed = t.status === 'DISMISSED';

    const cardBg = isPending
      ? 'rgba(100, 116, 139, 0.05)'
      : isInProgress
        ? 'rgba(245, 158, 11, 0.05)'
        : isResolved
          ? 'rgba(34, 197, 94, 0.05)'
          : 'rgba(100, 116, 139, 0.05)';

    const cardBorder = isPending
      ? 'rgba(100, 116, 139, 0.25)'
      : isInProgress
        ? 'rgba(245, 158, 11, 0.3)'
        : isResolved
          ? 'rgba(34, 197, 94, 0.3)'
          : 'rgba(100, 116, 139, 0.3)';

    return (
      <div
        key={`tkt-${t.id}`}
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: '10px',
          padding: '0.75rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Ticket #{t.ticket_id}
            </p>
            <div style={{ flexShrink: 0 }}>
              {isPending && (
                <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(100, 116, 139, 0.12)', color: '#475569', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                  Under Review
                </span>
              )}
              {isInProgress && (
                <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(245, 158, 11, 0.15)', color: '#D97706', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                  In Progress
                </span>
              )}
              {isResolved && (
                <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(34, 197, 94, 0.15)', color: '#16A34A', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                  Resolved
                </span>
              )}
              {isDismissed && (
                <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(100, 116, 139, 0.15)', color: '#64748B', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                  Closed
                </span>
              )}
            </div>
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {new Date(t.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })} • {new Date(t.created_at).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--surface-muted)', borderRadius: '6px', padding: '6px 8px', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
          {t.description}
        </div>

        {isPending && (
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Your problem report has been logged and is pending review by the Super Admin team.
          </p>
        )}

        {isInProgress && (
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#D97706', fontWeight: 600 }}>
            A Super Admin is actively investigating this report.{t.claimed_by_name ? ` (Handled by: ${t.claimed_by_name})` : ''}
          </p>
        )}

        {isResolved && (
          <div style={{ fontSize: '0.72rem', color: '#166534', background: 'rgba(34, 197, 94, 0.1)', padding: '6px 8px', borderRadius: '6px' }}>
            <strong>Super Admin Response:</strong> {t.admin_reply}{t.resolved_by_name ? ` — by ${t.resolved_by_name}` : ''}
          </div>
        )}

        {isDismissed && (
          <div style={{ fontSize: '0.72rem', color: '#475569', background: 'rgba(100, 116, 139, 0.1)', padding: '6px 8px', borderRadius: '6px' }}>
            <strong>Admin Note:</strong> {t.admin_reply}
          </div>
        )}

        {(isResolved || isDismissed) && (
          <button
            type="button"
            onClick={() => handleDismissTicket(t.ticket_id)}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 self-end mt-0.5 cursor-pointer"
          >
            Dismiss
          </button>
        )}
      </div>
    );
  };

  // Auto-refresh high risk student alerts with a gentle 60s interval and event-driven updates
  useEffect(() => {
    fetchRiskStudents();
    if (user?.role === 'tutor' || user?.role === 'principal') {
      const interval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchRiskStudents();
        }
      }, 60000);
      const handleCustomRefresh = () => {
        fetchRiskStudents();
      };
      window.addEventListener('aralert:refresh-risk-alerts', handleCustomRefresh);
      return () => {
        clearInterval(interval);
        window.removeEventListener('aralert:refresh-risk-alerts', handleCustomRefresh);
      };
    }
  }, [user?.id, user?.role]);

  useEffect(() => { if (!showRiskList) return; fetchRiskStudents(); }, [showRiskList]);

  useEffect(() => {
    fetchEditRequests();
    fetchTickets();
    fetchAnnouncements();
  }, [user, location.pathname, fetchTickets, fetchAnnouncements]);

  useEffect(() => {
    const handleRefreshTickets = () => {
      fetchTickets();
    };
    window.addEventListener('aralert:refresh-tickets', handleRefreshTickets);
    return () => window.removeEventListener('aralert:refresh-tickets', handleRefreshTickets);
  }, [fetchTickets]);

  useEffect(() => {
    if (showTutorNotifications || showStudentEditRequests || showEditRequestsModal) {
      fetchEditRequests();
      fetchTickets();
      fetchAnnouncements();
    }
  }, [showTutorNotifications, showStudentEditRequests, showEditRequestsModal, fetchTickets, fetchAnnouncements]);
  useEffect(() => {
    setProfileMenuOpen(false);
    setIsMobileDrawerOpen(false);
    setShowRiskList(false);
    setShowTutorNotifications(false);
    setShowStudentEditRequests(false);
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
            <Link
              to="/superadmin/tickets"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/superadmin/tickets'), collapsed)}
              title="Tickets"
            >
              <TicketsNavIcon active={isActivePrefix('/superadmin/tickets')} theme={theme} />
              {!collapsed && (
                <span className="flex-1 flex items-center justify-between gap-2 min-w-0">
                  <span className="truncate">Tickets</span>
                  {pendingTicketsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none bg-amber-500 text-white shrink-0">
                      {pendingTicketsCount > 99 ? '99+' : pendingTicketsCount}
                    </span>
                  )}
                </span>
              )}
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
              className={navLinkClass(isActivePrefix('/admin/students') || isActivePrefix('/admin/tutors') || isActivePrefix('/admin/principals') || isActivePrefix('/admin/users'), collapsed)}
              title="User Management"
            >
              <AssetSidebarIcon
                darkSrc={studentsDarkDefault}
                darkActiveSrc={studentsDarkActive}
                lightSrc={studentsLightDefault}
                lightActiveSrc={studentsLightActive}
                active={isActivePrefix('/admin/students') || isActivePrefix('/admin/tutors') || isActivePrefix('/admin/principals') || isActivePrefix('/admin/users')}
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
            <Link
              to="/admin/tickets"
              onClick={onItemClick}
              className={navLinkClass(isActivePrefix('/admin/tickets'), collapsed)}
              title="Tickets"
            >
              <TicketsNavIcon active={isActivePrefix('/admin/tickets')} theme={theme} />
              {!collapsed && (
                <span className="flex-1 flex items-center justify-between gap-2 min-w-0">
                  <span className="truncate">Tickets</span>
                  {pendingTicketsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none bg-amber-500 text-white shrink-0">
                      {pendingTicketsCount > 99 ? '99+' : pendingTicketsCount}
                    </span>
                  )}
                </span>
              )}
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

            <Link to="/tutor/scores" onClick={onItemClick} className={navLinkClass(isActivePrefix('/tutor/scores'), collapsed)} title="Score">
              <AssetSidebarIcon
                darkSrc={scoreDarkDefault}
                darkActiveSrc={scoreDarkActive}
                lightSrc={scoreLightDefault}
                lightActiveSrc={scoreLightActive}
                active={isActivePrefix('/tutor/scores')}
                alt="Score"
                size={18}
                theme={theme}
              />
              {!collapsed && <span className="truncate">Score</span>}
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

            <Link to="/tutor/students" onClick={onItemClick} className={navLinkClass(isActivePrefix('/tutor/students'), collapsed)} title="Assigned Students">
              <AssetSidebarIcon
                darkSrc={studentsDarkDefault}
                darkActiveSrc={studentsDarkActive}
                lightSrc={studentsLightDefault}
                lightActiveSrc={studentsLightActive}
                active={isActivePrefix('/tutor/students')}
                alt="Assigned Students"
                size={18}
                theme={theme}
              />
              {!collapsed && <span className="truncate">Assigned Students</span>}
            </Link>

            <Link to="/tutor/archive" onClick={onItemClick} className={navLinkClass(isActive('/tutor/archive'), collapsed)} title="Archive">
              <ArchiveNavIcon active={isActive('/tutor/archive')} theme={theme} />
              {!collapsed && <span className="truncate">Archive</span>}
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
                darkSrc={qrDarkDefault}
                darkActiveSrc={qrDarkActive}
                lightSrc={qrLightDefault}
                lightActiveSrc={qrLightActive}
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
    <div
      className="fixed inset-0 flex h-full w-full overflow-hidden"
      style={{
        display: 'flex',
        height: '100vh',
        maxHeight: '100dvh',
        background: 'var(--surface-bg)',
        overflow: 'hidden',
        fontFamily: 'var(--font-body)',
      }}
    >

      {/* ── System Greeting Intro (Chat Bubble + Flying Mascot) ───── */}
      <TutorGreetingIntro
        user={user}
        sidebarLogoId="sidebar-brand-logo"
        sidebarTextId="sidebar-brand-text"
        onComplete={() => setHasGreetingPending(false)}
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
                id="sidebar-brand-logo-collapsed"
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
        <div
          className="p-2 shrink-0 w-full relative after:content-[''] after:absolute after:-top-4 after:left-0 after:right-0 after:h-4 after:pointer-events-auto"
          onMouseEnter={handleProfileMouseEnter}
          onMouseLeave={handleProfileMouseLeave}
        >
          {isSidebarCollapsed ? (
            <button
              type="button"
              id="sidebar-profile-button"
              onClick={handleProfileButtonClick}
              title={getDisplayName()}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="Profile and account menu"
              className={`sidebar-item ${isProfileActive ? 'active' : ''} w-10 h-10 mx-auto !p-0 justify-center rounded-xl flex items-center border transition-all duration-150 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${profileMenuOpen
                ? 'border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 shadow-xs'
                : isProfileActive
                  ? ''
                  : 'border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-slate-300'
                }`}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={getDisplayName()}
                  className={`w-7 h-7 rounded-full object-cover border transition-colors ${isProfileActive
                      ? 'border-[var(--brand)] ring-1 ring-[var(--brand)]/30'
                      : 'border-slate-200 dark:border-zinc-700'
                    }`}
                />
              ) : (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-medium text-xs border transition-colors ${isProfileActive
                    ? 'bg-[var(--brand)]/10 text-[var(--sidebar-active-text)] border-[var(--sidebar-active-border)]'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700'
                  }`}>
                  <UserIcon size={14} strokeWidth={isProfileActive ? 2.2 : 1.8} />
                </div>
              )}
            </button>
          ) : (
            <button
              type="button"
              id="sidebar-profile-button"
              onClick={handleProfileButtonClick}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label="Profile and account menu"
              className={`sidebar-item ${isProfileActive ? 'active' : ''} w-full flex items-center gap-2.5 p-2 rounded-xl border transition-all duration-150 cursor-pointer select-none text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${profileMenuOpen
                ? 'border-slate-300 dark:border-zinc-700 bg-slate-100/90 dark:bg-zinc-800/80 shadow-xs'
                : isProfileActive
                  ? ''
                  : 'border-transparent hover:border-slate-200 dark:hover:border-zinc-800 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60'
                }`}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={getDisplayName()}
                  className={`w-8 h-8 rounded-full object-cover border shrink-0 transition-colors ${isProfileActive
                      ? 'border-[var(--brand)] ring-1 ring-[var(--brand)]/30'
                      : 'border-slate-200/80 dark:border-zinc-700'
                    }`}
                />
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs border shrink-0 transition-colors ${isProfileActive
                    ? 'bg-[var(--brand)]/10 text-[var(--sidebar-active-text)] border-[var(--sidebar-active-border)]'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200/80 dark:border-zinc-700'
                  }`}>
                  <UserIcon size={15} strokeWidth={isProfileActive ? 2.2 : 1.8} />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span className={`text-xs truncate leading-tight transition-colors ${isProfileActive
                    ? 'font-bold text-[var(--sidebar-active-text)]'
                    : 'font-semibold text-slate-800 dark:text-slate-200'
                  }`}>
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
          className="fixed inset-0 z-40 bg-black/25 lg:hidden animate-fade-in"
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col lg:hidden transition-transform duration-300 ease-in-out shadow-2xl ${isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
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
            onClick={handleProfileButtonClick}
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            aria-label="Profile and account menu"
            className={`sidebar-item ${isProfileActive ? 'active' : ''} w-full flex items-center gap-2.5 p-2 rounded-xl border transition-all duration-150 cursor-pointer select-none text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${profileMenuOpen
              ? 'border-slate-300 dark:border-zinc-700 bg-slate-100/90 dark:bg-zinc-800/80 shadow-xs'
              : isProfileActive
                ? ''
                : 'border-transparent hover:border-slate-200 dark:hover:border-zinc-800 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60'
              }`}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={getDisplayName()}
                className={`w-8 h-8 rounded-full object-cover border shrink-0 transition-colors ${isProfileActive
                    ? 'border-[var(--brand)] ring-1 ring-[var(--brand)]/30'
                    : 'border-slate-200/80 dark:border-zinc-700'
                  }`}
              />
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs border shrink-0 transition-colors ${isProfileActive
                  ? 'bg-[var(--brand)]/10 text-[var(--sidebar-active-text)] border-[var(--sidebar-active-border)]'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200/80 dark:border-zinc-700'
                }`}>
                <UserIcon size={15} strokeWidth={isProfileActive ? 2.2 : 1.8} />
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <span className={`text-xs truncate leading-tight transition-colors ${isProfileActive
                  ? 'font-bold text-[var(--sidebar-active-text)]'
                  : 'font-semibold text-slate-800 dark:text-slate-200'
                }`}>
                {getDisplayName()}
              </span>
            </div>
          </button>
        </div>
      </aside>

      {/* ── Main Panel ─────────────────────────────────────── */}
      <div
        className="flex flex-col flex-1 h-full min-h-0 min-w-0 overflow-hidden relative"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
        }}
      >

        {/* ── Top Bar ── */}
        <header
          className={`h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-2.5 xs:px-3 sm:px-6 lg:px-8 shrink-0 sticky top-0 transition-colors duration-150 ${
            showRiskList || showTutorNotifications || showStudentEditRequests || (profileMenuOpen && !isMobileDrawerOpen)
              ? 'z-[80]'
              : 'z-30'
          }`}
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
              onClick={() => {
                setShowRiskList(false);
                setShowTutorNotifications(false);
                setShowStudentEditRequests(false);
                setShowEditRequestsModal(false);
                setProfileMenuOpen(false);
                setIsMobileDrawerOpen(true);
              }}
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Open Navigation"
              aria-label="Open Navigation"
            >
              <Menu size={20} />
            </button>
            <h1
              className="truncate text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white tracking-tight py-1"
              style={{
                margin: 0,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '-0.02em',
                lineHeight: 1.35,
              }}
            >
              {getPageTitle()}
            </h1>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 relative shrink-0">
            {/* High Risk Alert (Warning Triangle Icon - Tutor & Principal roles) */}
            {(user?.role === 'tutor' || user?.role === 'principal') && (
              <div style={{ position: 'relative', zIndex: showRiskList ? 80 : 1 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowRiskList((prev) => {
                      const next = !prev;
                      if (next) {
                        setExpandedPrincipalTutorId(null);
                      }
                      return next;
                    });
                    setSelectedAlertClass('all');
                    setShowTutorNotifications(false);
                    setShowStudentEditRequests(false);
                    setProfileMenuOpen(false);
                    setIsRiskShaking(true);
                    setRiskShakeKey((prev) => prev + 1);
                  }}
                  aria-label="High Risk Alerts"
                  title={
                    highRiskCount > 0
                      ? `${highRiskCount} High Risk Student(s) Alert`
                      : 'High Risk Students Alert'
                  }
                  style={{
                    position: 'relative',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: showRiskList ? 'var(--brand)' : 'var(--surface-muted)',
                    border: `1px solid ${showRiskList ? 'var(--brand)' : 'var(--slate-200)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: showRiskList ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'var(--transition-fast)',
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.93)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseEnter={(e) => {
                    if (!showRiskList) {
                      e.currentTarget.style.background = 'var(--brand-light)';
                      e.currentTarget.style.color = 'var(--brand-dark)';
                      e.currentTarget.style.borderColor = 'var(--brand-border)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    if (!showRiskList) {
                      e.currentTarget.style.background = 'var(--surface-muted)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.borderColor = 'var(--slate-200)';
                    } else {
                      e.currentTarget.style.background = 'var(--brand)';
                      e.currentTarget.style.color = '#FFFFFF';
                      e.currentTarget.style.borderColor = 'var(--brand)';
                    }
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
                  <SynchronizedPulseBadge count={displayRiskBadgeCount} />
                </button>

                {/* Risk dropdown */}
                {showRiskList && (
                  <>
                    {/* Mobile Backdrop */}
                    <div
                      className="fixed inset-0 z-[75] bg-transparent sm:hidden"
                      onClick={() => setShowRiskList(false)}
                      aria-hidden="true"
                    />

                    {/* Notification Panel */}
                    <div
                      className={`animate-fade-in-scale fixed inset-x-2.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+8px)] ${user?.role === 'principal' ? 'sm:w-[410px]' : 'sm:w-[380px]'} max-w-[calc(100vw-20px)] bg-[var(--surface-card)] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-xl shadow-2xl sm:shadow-xl z-[80] overflow-visible`}
                    >
                      {/* Dropdown header */}
                      <div
                        className="rounded-t-2xl sm:rounded-t-xl"
                        style={{
                          padding: '1rem 1.25rem 0.625rem',
                          background: 'var(--surface-card)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                          High Risk Students Alert
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowRiskList(false)}
                          aria-label="Close alerts"
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
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--slate-100)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Class filter dropdown (Tutor and Principal) */}
                      {((user?.role === 'tutor' && tutorClassSections.length > 1) || (user?.role === 'principal' && availableClassSections.length > 0)) && (
                        <div style={{ position: 'relative', zIndex: 30, padding: '0.25rem 1.25rem 0.625rem', background: 'var(--surface-card)' }}>
                          <div ref={alertClassDropdownRef} className="relative w-full max-w-full">
                            <button
                              type="button"
                              onClick={() => setIsAlertClassDropdownOpen((prev) => !prev)}
                              aria-haspopup="listbox"
                              aria-expanded={isAlertClassDropdownOpen}
                              aria-label="Filter high-risk students by class"
                              className="w-full min-h-[36px] flex items-center justify-between rounded-lg border border-slate-200 dark:border-neutral-800 bg-[var(--surface-card)] px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-2xs focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 focus:outline-none transition-all cursor-pointer text-left"
                            >
                              <span className="truncate pr-2">{selectedAlertClassLabel}</span>
                              <ChevronDown className={`shrink-0 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-150 ${isAlertClassDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isAlertClassDropdownOpen && (
                              <div
                                role="listbox"
                                aria-label="Filter classes"
                                className="absolute left-0 right-0 top-full mt-1.5 z-50 w-full max-w-full rounded-xl border border-slate-200 dark:border-neutral-800 bg-[var(--surface-card)] p-1.5 shadow-2xl max-h-56 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-100"
                              >
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={selectedAlertClass === 'all'}
                                  onClick={() => {
                                    setSelectedAlertClass('all');
                                    setIsAlertClassDropdownOpen(false);
                                  }}
                                  className={`w-full max-w-full flex items-center justify-between text-left rounded-lg px-2.5 py-2 text-xs font-bold transition-colors cursor-pointer ${selectedAlertClass === 'all'
                                      ? 'bg-[var(--brand-light)] text-[var(--brand-dark)] dark:bg-blue-950/60 dark:text-blue-300'
                                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800'
                                    }`}
                                  title={`ALL CLASSES (${availableClassSections.reduce((s, c) => s + c.students.length, 0)} high-risk)`}
                                >
                                  <span className="truncate">ALL CLASSES ({availableClassSections.reduce((s, c) => s + c.students.length, 0)} high-risk)</span>
                                  {selectedAlertClass === 'all' && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--brand)] dark:text-blue-400 ml-2" />}
                                </button>
                                {availableClassSections.map((cls) => {
                                  const isSelected = selectedAlertClass === cls.key;
                                  return (
                                    <button
                                      key={cls.key}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      onClick={() => {
                                        setSelectedAlertClass(cls.key);
                                        setIsAlertClassDropdownOpen(false);
                                      }}
                                      className={`w-full max-w-full flex items-center justify-between text-left rounded-lg px-2.5 py-2 text-xs font-bold transition-colors cursor-pointer ${isSelected
                                          ? 'bg-[var(--brand-light)] text-[var(--brand-dark)] dark:bg-blue-950/60 dark:text-blue-300'
                                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800'
                                        }`}
                                      title={`${cls.label} (${cls.students.length})`}
                                    >
                                      <span className="truncate">{cls.label} ({cls.students.length})</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--brand)] dark:text-blue-400 ml-2" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Risk list body */}
                      <div
                        className="rounded-b-2xl sm:rounded-b-xl"
                        style={{
                          maxHeight: 'min(440px, calc(100vh - 140px))',
                          overflowY: 'auto',
                          background: 'var(--surface-card)',
                          padding: '0.5rem 1.25rem 1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                        }}
                      >
                        {user?.role === 'principal' ? (
                          principalTutorGroups.length === 0 ? (
                            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--risk-high-border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                              <p style={{ fontSize: '0.8rem', color: 'var(--risk-high-text)', margin: 0 }}>
                                {selectedAlertClass === 'all'
                                  ? 'No high-risk students detected across all tutors.'
                                  : 'No high-risk students detected for the selected class.'}
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2.5">
                              {principalTutorGroups.map((group) => {
                                const isExpanded = expandedPrincipalTutorId === group.tutorId;
                                return (
                                  <div
                                    key={`principal-tutor-${group.tutorId}`}
                                    className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0A0A0A] overflow-hidden shadow-2xs transition-all"
                                  >
                                    {/* Tutor Header Row - Clickable Dropdown Trigger */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedPrincipalTutorId((prev) => (prev === group.tutorId ? null : group.tutorId));
                                      }}
                                      className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50/70 dark:hover:bg-neutral-900/60 transition-colors cursor-pointer select-none"
                                      aria-expanded={isExpanded}
                                      aria-label={`Toggle high-risk students handled by ${group.tutorName}`}
                                    >
                                      <div className="min-w-0 flex-1 pr-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                            {group.tutorName}
                                          </span>
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                                            {group.students.length} HIGH RISK
                                          </span>
                                        </div>
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                          {group.classesHandled}
                                        </p>
                                      </div>
                                      <div className="shrink-0 flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider hidden xs:inline">
                                          {isExpanded ? 'Hide' : 'View'}
                                        </span>
                                        <ChevronDown
                                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                                            isExpanded ? 'rotate-180 text-[var(--brand)]' : ''
                                          }`}
                                        />
                                      </div>
                                    </button>

                                    {/* Collapsible Dropdown of Handled High-Risk Students */}
                                    {isExpanded && (
                                      <div className="border-t border-slate-100 dark:border-neutral-800/80 bg-slate-50/50 dark:bg-black/30 p-3 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                        <div className="flex items-center justify-between px-0.5 pb-0.5">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                            Handled Students ({group.students.length})
                                          </span>
                                          {group.tutorId !== 'unassigned' && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setShowRiskList(false);
                                                navigate(`/principal/analytics?tutorId=${group.tutorId}`);
                                              }}
                                              className="text-[10.5px] font-bold text-[var(--brand)] hover:underline flex items-center gap-1 cursor-pointer"
                                            >
                                              View Analytics
                                            </button>
                                          )}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                          {group.students.map((row) => {
                                            const { grade: stGrade, section: stSection } = parseStudentGradeAndSection(row.student);
                                            return (
                                              <div
                                                key={`principal-student-${row.student.id}`}
                                                className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-[#111111] p-3 space-y-2 shadow-2xs"
                                              >
                                                <div className="flex items-start justify-between gap-2">
                                                  <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate m-0">
                                                      {row.student.full_name}
                                                    </p>
                                                    <p className="text-[10.5px] text-slate-400 font-mono m-0 mt-0.5">
                                                      LRN: {row.student.lrn || 'N/A'} {stGrade && stSection ? `• ${stGrade} - ${stSection}` : ''}
                                                    </p>
                                                  </div>
                                                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                                                  HIGH RISK
                                                </span>
                                              </div>

                                              {/* Metrics */}
                                              <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                                                <span className="text-slate-600 dark:text-slate-400 text-[11px] font-medium">Composite Rating:</span>
                                                <span className="font-extrabold text-rose-600 dark:text-rose-400">{parseFloat(row.compositeScore.toFixed(1)).toString()}%</span>
                                              </div>

                                              {/* Safety Gate or Recovery Targets Remark */}
                                              <div className="flex flex-col gap-1 pt-0.5">
                                                {row.compositeScore >= 70 && row.attendanceRate <= 75 && (
                                                  <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-200 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/50 leading-snug">
                                                    Despite current composite rating, student is marked high risk due to the attendace rate being 75% or less.
                                                  </span>
                                                )}
                                                {row.neededPresentAttendance > 0 && (
                                                  <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/50">
                                                    Need +{row.neededPresentAttendance} more Present records to improve risk level
                                                  </span>
                                                )}
                                                {row.neededPassedScores > 0 && (
                                                  <span className="inline-flex items-center rounded bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-rose-800 dark:text-rose-300 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50">
                                                    Need +{row.neededPassedScores} more Passed records to improve risk level
                                                  </span>
                                                )}
                                                {row.neededPresentAttendance === 0 && row.neededPassedScores === 0 && (
                                                  <span className="inline-flex items-center rounded bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-rose-800 dark:text-rose-300 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50">
                                                    Need +1 more Passed record to improve risk level
                                                  </span>
                                                )}
                                              </div>

                                              {/* Direct Acknowledge Alert button for Principal */}
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
                                          );
                                        })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )
                        ) : (
                          /* Existing Tutor View */
                          (() => {
                            const visibleSections = selectedAlertClass === 'all'
                            ? tutorClassSections
                            : tutorClassSections.filter((cls) => cls.key === selectedAlertClass);
                          return visibleSections.map((cls) => {
                            const sortedClassStudents = [...cls.students].sort((a, b) => {
                              const aAck = Boolean(acknowledgedAlerts[a.student.id]);
                              const bAck = Boolean(acknowledgedAlerts[b.student.id]);
                              if (aAck !== bAck) {
                                return aAck ? 1 : -1;
                              }
                              return 0;
                            });

                            return (
                              <div key={cls.key} className="flex flex-col gap-2">
                                {/* Class label shown only in "all" view or when more than one section exists */}
                                {(selectedAlertClass === 'all' && tutorClassSections.length > 1) && (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.125rem' }}>
                                    <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, color: 'var(--risk-high-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      {cls.label}
                                    </p>
                                    <span style={{ background: 'var(--risk-high-badge-bg)', color: 'var(--risk-high-text)', fontSize: '0.72rem', fontWeight: 800, borderRadius: '99px', padding: '2px 8px', border: '1px solid var(--risk-high-border)' }}>
                                      {cls.students.length}
                                    </span>
                                  </div>
                                )}

                                {cls.students.length === 0 ? (
                                  <div style={{ background: 'var(--surface-card)', border: '1px solid var(--risk-high-border)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--risk-high-text)', margin: 0 }}>
                                      No high-risk students detected.
                                    </p>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                    {sortedClassStudents.map((row) => (
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
                                          <span className="text-slate-600 dark:text-slate-400 text-[11px] font-medium">Composite Rating:</span>
                                          <span className="font-extrabold text-rose-600 dark:text-rose-400">{parseFloat(row.compositeScore.toFixed(1)).toString()}%</span>
                                        </div>

                                        {/* Recovery targets */}
                                        <div className="flex flex-col gap-1.5 pt-0.5">
                                          {row.compositeScore >= 70 && row.attendanceRate <= 75 && (
                                            <span className="inline-flex items-center rounded bg-amber-50 px-2.5 py-1 text-[10.5px] font-medium text-amber-900 dark:text-amber-200 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/50 leading-snug">
                                              Despite current composite rating, student is marked high risk due to the attendace rate being 75% or less.
                                            </span>
                                          )}
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
                            );
                          });
                        })()
                      )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Universal Notification Bell (School Admin & Super Admin) */}
            {(user?.role === 'admin' || user?.is_superuser) && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditRequestsModal((prev) => {
                      const next = !prev;
                      if (next) {
                        markNotificationsAsSeen();
                      }
                      return next;
                    });
                    setShowRiskList(false);
                    setProfileMenuOpen(false);
                    setIsEditBellRinging(true);
                    setEditBellRingKey((prev) => prev + 1);
                  }}
                  aria-label="Notifications"
                  title={
                    displayNotifBadgeCount > 0
                      ? `${displayNotifBadgeCount} Notification(s) Pending Review`
                      : 'Notifications'
                  }
                  style={{
                    position: 'relative',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: showEditRequestsModal ? 'var(--brand)' : 'var(--surface-muted)',
                    border: `1px solid ${showEditRequestsModal ? 'var(--brand)' : 'var(--slate-200)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: showEditRequestsModal ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'var(--transition-fast)',
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.93)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseEnter={(e) => {
                    if (!showEditRequestsModal) {
                      e.currentTarget.style.background = 'var(--brand-light)';
                      e.currentTarget.style.color = 'var(--brand-dark)';
                      e.currentTarget.style.borderColor = 'var(--brand-border)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    if (!showEditRequestsModal) {
                      e.currentTarget.style.background = 'var(--surface-muted)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.borderColor = 'var(--slate-200)';
                    } else {
                      e.currentTarget.style.background = 'var(--brand)';
                      e.currentTarget.style.color = '#FFFFFF';
                      e.currentTarget.style.borderColor = 'var(--brand)';
                    }
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
                  <SynchronizedPulseBadge count={displayNotifBadgeCount} />
                </button>

                {/* Edit Request Notifications Dropdown Popup */}
                {showEditRequestsModal && (
                  <StudentEditRequestsModal
                    isOpen={showEditRequestsModal}
                    onClose={() => setShowEditRequestsModal(false)}
                    onRequestReviewed={() => {
                      fetchEditRequests();
                      fetchTickets();
                      fetchAnnouncements();
                    }}
                  />
                )}
              </div>
            )}

            {/* Universal Notification Bell (Tutor, Faculty, Principal) */}
            {(user?.role === 'tutor' || user?.role === 'principal') && (
              <div style={{ position: 'relative', zIndex: showTutorNotifications ? 80 : 1 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowTutorNotifications((prev) => {
                      const next = !prev;
                      if (next) {
                        markNotificationsAsSeen();
                      }
                      return next;
                    });
                    setShowRiskList(false);
                    setShowStudentEditRequests(false);
                    setProfileMenuOpen(false);
                    setIsBellRinging(true);
                    setBellRingKey((prev) => prev + 1);
                  }}
                  aria-label="Notifications"
                  title={
                    displayNotifBadgeCount > 0
                      ? `${displayNotifBadgeCount} Notification(s)`
                      : 'Notifications'
                  }
                  style={{
                    position: 'relative',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: showTutorNotifications ? 'var(--brand)' : 'var(--surface-muted)',
                    border: `1px solid ${showTutorNotifications ? 'var(--brand)' : 'var(--slate-200)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: showTutorNotifications ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'var(--transition-fast)',
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.93)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseEnter={(e) => {
                    if (!showTutorNotifications) {
                      e.currentTarget.style.background = 'var(--brand-light)';
                      e.currentTarget.style.color = 'var(--brand-dark)';
                      e.currentTarget.style.borderColor = 'var(--brand-border)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    if (!showTutorNotifications) {
                      e.currentTarget.style.background = 'var(--surface-muted)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.borderColor = 'var(--slate-200)';
                    } else {
                      e.currentTarget.style.background = 'var(--brand)';
                      e.currentTarget.style.color = '#FFFFFF';
                      e.currentTarget.style.borderColor = 'var(--brand)';
                    }
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
                  <SynchronizedPulseBadge count={displayNotifBadgeCount} />
                </button>

                {/* Notifications Dropdown */}
                {showTutorNotifications && (
                  <>
                    {/* Mobile Backdrop */}
                    <div
                      className="fixed inset-0 z-[75] bg-transparent sm:hidden"
                      onClick={() => setShowTutorNotifications(false)}
                      aria-hidden="true"
                    />

                    {/* Notification Panel */}
                    <div
                      className="animate-fade-in-scale fixed inset-x-2.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[420px] max-w-[calc(100vw-20px)] bg-[var(--surface-card)] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-xl shadow-2xl sm:shadow-xl z-[80] overflow-hidden"
                    >
                      <div
                        style={{
                          padding: '1rem 1.25rem 0.625rem',
                          background: 'var(--surface-card)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                          Notifications
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowTutorNotifications(false)}
                          aria-label="Close notifications"
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
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--slate-100)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Filter Tabs Bar */}
                      <div
                        className="no-scrollbar"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 1.25rem 0.625rem',
                          background: 'var(--surface-card)',
                          overflowX: 'auto',
                          flexWrap: 'nowrap',
                          WebkitOverflowScrolling: 'touch',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setUserNotificationFilter('all')}
                          style={{
                            padding: '3px 7px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            background: userNotificationFilter === 'all' ? '#0052B7' : 'var(--slate-100)',
                            color: userNotificationFilter === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ALL ({myEditRequests.length + myTickets.length + systemAnnouncements.length + SYSTEM_UPDATES.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserNotificationFilter('tickets')}
                          style={{
                            padding: '3px 7px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            background: userNotificationFilter === 'tickets' ? '#0052B7' : 'var(--slate-100)',
                            color: userNotificationFilter === 'tickets' ? '#FFFFFF' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          TICKETS ({myTickets.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserNotificationFilter('edits')}
                          style={{
                            padding: '3px 7px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            background: userNotificationFilter === 'edits' ? '#0052B7' : 'var(--slate-100)',
                            color: userNotificationFilter === 'edits' ? '#FFFFFF' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          EDITS ({myEditRequests.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserNotificationFilter('updates')}
                          style={{
                            padding: '3px 7px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            background: userNotificationFilter === 'updates' ? '#0052B7' : 'var(--slate-100)',
                            color: userNotificationFilter === 'updates' ? '#FFFFFF' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          UPDATES ({systemAnnouncements.length + SYSTEM_UPDATES.length})
                        </button>
                      </div>

                      {/* Notifications List Body - Unified Inbox */}
                      <div
                        style={{
                          height: '420px',
                          maxHeight: 'calc(100vh - 140px)',
                          overflowY: 'auto',
                          background: 'var(--surface-card)',
                          padding: '0.5rem 1.25rem 1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                        }}
                      >
                        {(() => {
                          type InboxItem =
                            | ({ itemKind: 'system' } & (typeof SYSTEM_UPDATES)[number])
                            | ({ itemKind: 'announcement' } & SystemAnnouncementItem)
                            | ({ itemKind: 'edit' } & StudentEditRequest)
                            | ({ itemKind: 'ticket' } & SupportTicketItem);

                          const allInbox: InboxItem[] = [
                            ...systemAnnouncements.map((a) => ({ ...a, itemKind: 'announcement' as const })),
                            ...SYSTEM_UPDATES.map((u) => ({ ...u, itemKind: 'system' as const })),
                            ...myEditRequests.map((req) => ({ ...req, itemKind: 'edit' as const })),
                            ...myTickets.map((t) => ({ ...t, itemKind: 'ticket' as const })),
                          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                          const compiledInbox = allInbox.filter((item) => {
                            if (userNotificationFilter === 'all') return true;
                            if (userNotificationFilter === 'tickets') return item.itemKind === 'ticket';
                            if (userNotificationFilter === 'edits') return item.itemKind === 'edit';
                            if (userNotificationFilter === 'updates') return item.itemKind === 'announcement' || item.itemKind === 'system';
                            return true;
                          });

                          if (compiledInbox.length === 0) {
                            return (
                              <p style={{ margin: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                No notifications yet.
                              </p>
                            );
                          }

                          return compiledInbox.map((item) => {
                            if (item.itemKind === 'announcement') {
                              return renderSystemAnnouncementCard(item);
                            }
                            if (item.itemKind === 'system') {
                              return <SystemUpdateNotification key={item.id} update={item} />;
                            }
                            if (item.itemKind === 'ticket') {
                              return renderTicketNotificationCard(item);
                            }

                            const req = item;
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

                            const displayName = req.request_type === 'staff'
                              ? 'Personal Profile Update'
                              : (req.student_name ? `${req.student_name} (Student)` : 'Profile Details Update');

                            return (
                              <div
                                key={req.id}
                                style={{
                                  background: cardBg,
                                  border: `1px solid ${cardBorder}`,
                                  borderRadius: '10px',
                                  padding: '0.75rem 0.85rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.35rem',
                                }}
                              >
                                {/* Header with Title, Status Badge, and Upper Right Date/Time */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {displayName}
                                    </p>
                                    <div style={{ flexShrink: 0 }}>
                                      {isPending && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(245, 158, 11, 0.15)', color: '#D97706', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          Pending
                                        </span>
                                      )}
                                      {isApproved && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(34, 197, 94, 0.15)', color: '#16A34A', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          Approved
                                        </span>
                                      )}
                                      {isRejected && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(239, 68, 68, 0.15)', color: '#DC2626', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          Rejected
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {new Date(req.created_at).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })} • {new Date(req.created_at).toLocaleTimeString(undefined, {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>

                                {/* Proposed details */}
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                  <div>
                                    <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Proposed Name: </span>
                                    <span>{req.proposed_last_name}, {req.proposed_first_name} {req.proposed_middle_name || ''}</span>
                                  </div>
                                  {req.request_type !== 'staff' && (req.proposed_aral_level || req.proposed_lrn) && (
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
                                </div>

                                {/* Review outcome notes */}
                                {isApproved && (
                                  <div style={{ marginTop: '2px', padding: '4px 6px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: '4px', fontSize: '0.72rem', color: '#15803D', fontWeight: 600 }}>
                                    Profile update approved and applied by {getReviewerLabel(req)}.
                                  </div>
                                )}
                                {isRejected && (
                                  <div className="mt-0.5 px-1.5 py-1 rounded bg-rose-50 dark:bg-rose-950/40 text-[0.72rem] text-rose-700 dark:text-rose-300 font-semibold border border-rose-100 dark:border-rose-900/50">
                                    Rejected by {getReviewerLabel(req)}: {req.rejection_reason || 'No specific reason provided.'}
                                  </div>
                                )}
                                {isPending && (
                                  <div className="mt-0.5 text-[0.7rem] font-medium text-amber-700 dark:text-amber-400">
                                    Waiting for administrator approval.
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Clear Resolved Action Footer */}
                      {myTickets.some((t) => t.status === 'RESOLVED' || t.status === 'DISMISSED') && (
                        <div
                          style={{
                            padding: '0.5rem 1rem',
                            borderTop: '1px solid var(--slate-200)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            background: 'var(--surface-muted)',
                          }}
                        >
                          <button
                            type="button"
                            disabled={isClearingResolved}
                            onClick={handleClearResolvedTickets}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#D97706',
                              cursor: isClearingResolved ? 'default' : 'pointer',
                            }}
                          >
                            {isClearingResolved ? 'Clearing...' : 'Clear Resolved Tickets'}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Student Notifications (Bell Icon) */}
            {user?.role === 'student' && (
              <div style={{ position: 'relative', zIndex: showStudentEditRequests ? 80 : 1 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowStudentEditRequests((prev) => {
                      const next = !prev;
                      if (next) {
                        markNotificationsAsSeen();
                      }
                      return next;
                    });
                    setShowRiskList(false);
                    setProfileMenuOpen(false);
                    setIsBellRinging(true);
                    setBellRingKey((prev) => prev + 1);
                  }}
                  aria-label="Notifications"
                  title={
                    displayNotifBadgeCount > 0
                      ? `${displayNotifBadgeCount} Notification(s) Pending Review`
                      : 'Notifications'
                  }
                  style={{
                    position: 'relative',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: showStudentEditRequests ? 'var(--brand)' : 'var(--surface-muted)',
                    border: `1px solid ${showStudentEditRequests ? 'var(--brand)' : 'var(--slate-200)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: showStudentEditRequests ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'var(--transition-fast)',
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.93)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseEnter={(e) => {
                    if (!showStudentEditRequests) {
                      e.currentTarget.style.background = 'var(--brand-light)';
                      e.currentTarget.style.color = 'var(--brand-dark)';
                      e.currentTarget.style.borderColor = 'var(--brand-border)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    if (!showStudentEditRequests) {
                      e.currentTarget.style.background = 'var(--surface-muted)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.borderColor = 'var(--slate-200)';
                    } else {
                      e.currentTarget.style.background = 'var(--brand)';
                      e.currentTarget.style.color = '#FFFFFF';
                      e.currentTarget.style.borderColor = 'var(--brand)';
                    }
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
                  <SynchronizedPulseBadge count={displayNotifBadgeCount} />
                </button>

                {/* Student Notifications Dropdown */}
                {showStudentEditRequests && (
                  <>
                    {/* Mobile Backdrop */}
                    <div
                      className="fixed inset-0 z-[75] bg-transparent sm:hidden"
                      onClick={() => setShowStudentEditRequests(false)}
                      aria-hidden="true"
                    />

                    {/* Notification Panel */}
                    <div
                      className="animate-fade-in-scale fixed inset-x-2.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[410px] max-w-[calc(100vw-20px)] bg-[var(--surface-card)] border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-xl shadow-2xl sm:shadow-xl z-[80] overflow-hidden"
                    >
                      <div
                        style={{
                          padding: '1rem 1.25rem 0.625rem',
                          background: 'var(--surface-card)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                          Notifications
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowStudentEditRequests(false)}
                          aria-label="Close notifications"
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
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--slate-100)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Filter Tabs Bar */}
                      <div
                        className="no-scrollbar"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 1.25rem 0.625rem',
                          background: 'var(--surface-card)',
                          overflowX: 'auto',
                          flexWrap: 'nowrap',
                          WebkitOverflowScrolling: 'touch',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setUserNotificationFilter('all')}
                          style={{
                            padding: '3px 7px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            background: userNotificationFilter === 'all' ? '#0052B7' : 'var(--slate-100)',
                            color: userNotificationFilter === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ALL ({myEditRequests.length + myTickets.length + systemAnnouncements.length + SYSTEM_UPDATES.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserNotificationFilter('tickets')}
                          style={{
                            padding: '3px 7px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            background: userNotificationFilter === 'tickets' ? '#0052B7' : 'var(--slate-100)',
                            color: userNotificationFilter === 'tickets' ? '#FFFFFF' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          TICKETS ({myTickets.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserNotificationFilter('edits')}
                          style={{
                            padding: '3px 7px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            background: userNotificationFilter === 'edits' ? '#0052B7' : 'var(--slate-100)',
                            color: userNotificationFilter === 'edits' ? '#FFFFFF' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          EDITS ({myEditRequests.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserNotificationFilter('updates')}
                          style={{
                            padding: '3px 7px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            flexShrink: 0,
                            background: userNotificationFilter === 'updates' ? '#0052B7' : 'var(--slate-100)',
                            color: userNotificationFilter === 'updates' ? '#FFFFFF' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          UPDATES ({systemAnnouncements.length + SYSTEM_UPDATES.length})
                        </button>
                      </div>

                      {/* Notifications List Body - Unified Inbox */}
                      <div
                        style={{
                          height: '420px',
                          maxHeight: 'calc(100vh - 140px)',
                          overflowY: 'auto',
                          background: 'var(--surface-card)',
                          padding: '0.5rem 1.25rem 1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                        }}
                      >
                        {(() => {
                          type InboxItem =
                            | ({ itemKind: 'system' } & (typeof SYSTEM_UPDATES)[number])
                            | ({ itemKind: 'announcement' } & SystemAnnouncementItem)
                            | ({ itemKind: 'edit' } & StudentEditRequest)
                            | ({ itemKind: 'ticket' } & SupportTicketItem);

                          const allInbox: InboxItem[] = [
                            ...systemAnnouncements.map((a) => ({ ...a, itemKind: 'announcement' as const })),
                            ...SYSTEM_UPDATES.map((u) => ({ ...u, itemKind: 'system' as const })),
                            ...myEditRequests.map((req) => ({ ...req, itemKind: 'edit' as const })),
                            ...myTickets.map((t) => ({ ...t, itemKind: 'ticket' as const })),
                          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                          const compiledInbox = allInbox.filter((item) => {
                            if (userNotificationFilter === 'all') return true;
                            if (userNotificationFilter === 'tickets') return item.itemKind === 'ticket';
                            if (userNotificationFilter === 'edits') return item.itemKind === 'edit';
                            if (userNotificationFilter === 'updates') return item.itemKind === 'announcement' || item.itemKind === 'system';
                            return true;
                          });

                          if (compiledInbox.length === 0) {
                            return (
                              <p style={{ margin: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                No notifications yet.
                              </p>
                            );
                          }

                          return compiledInbox.map((item) => {
                            if (item.itemKind === 'announcement') {
                              return renderSystemAnnouncementCard(item);
                            }
                            if (item.itemKind === 'system') {
                              return <SystemUpdateNotification key={item.id} update={item} />;
                            }
                            if (item.itemKind === 'ticket') {
                              return renderTicketNotificationCard(item);
                            }

                            const req = item;
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
                                  borderRadius: '10px',
                                  padding: '0.75rem 0.85rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.35rem',
                                }}
                              >
                                {/* Header with Title, Status Badge, and Upper Right Date/Time */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                      Profile Details Update
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      {isPending && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(245, 158, 11, 0.15)', color: '#D97706', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          Pending
                                        </span>
                                      )}
                                      {isApproved && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(34, 197, 94, 0.15)', color: '#16A34A', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          Approved
                                        </span>
                                      )}
                                      {isRejected && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(239, 68, 68, 0.15)', color: '#DC2626', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '99px', textTransform: 'uppercase' }}>
                                          Rejected
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {new Date(req.created_at).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })} • {new Date(req.created_at).toLocaleTimeString(undefined, {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>

                                {/* Proposed details */}
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
                                </div>

                                {/* Review outcome notes */}
                                {isApproved && (
                                  <div style={{ marginTop: '2px', padding: '4px 6px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: '4px', fontSize: '0.72rem', color: '#15803D', fontWeight: 600 }}>
                                    Profile update approved and applied by {getReviewerLabel(req)}.
                                  </div>
                                )}
                                {isRejected && (
                                  <div className="mt-0.5 px-1.5 py-1 rounded bg-rose-50 dark:bg-rose-950/40 text-[0.72rem] text-rose-700 dark:text-rose-300 font-semibold border border-rose-100 dark:border-rose-900/50">
                                    Rejected by {getReviewerLabel(req)}: {req.rejection_reason || 'No specific reason provided.'}
                                  </div>
                                )}
                                {isPending && (
                                  <div className="mt-0.5 text-[0.7rem] font-medium text-amber-700 dark:text-amber-400">
                                    Waiting for administrator approval.
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Clear Resolved Action Footer */}
                      {myTickets.some((t) => t.status === 'RESOLVED' || t.status === 'DISMISSED') && (
                        <div
                          style={{
                            padding: '0.5rem 1rem',
                            borderTop: '1px solid var(--slate-200)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            background: 'var(--surface-muted)',
                          }}
                        >
                          <button
                            type="button"
                            disabled={isClearingResolved}
                            onClick={handleClearResolvedTickets}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#D97706',
                              cursor: isClearingResolved ? 'default' : 'pointer',
                            }}
                          >
                            {isClearingResolved ? 'Clearing...' : 'Clear Resolved Tickets'}
                          </button>
                        </div>
                      )}
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
        <main className="relative z-0 flex-1 w-full min-w-0 max-w-full min-h-0 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 md:p-6 lg:p-8">
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
      {/* Mobile backdrop only; hidden on desktop so it never intercepts hover cursor */}
      <div
        className={`fixed inset-0 z-[75] bg-black/10 dark:bg-black/25 lg:hidden transition-opacity duration-200 ${
          profileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setProfileMenuOpen(false)}
        aria-hidden="true"
      />
      <div
        id="profile-dropdown-menu"
        className={`fixed z-[80] rounded-xl bg-white dark:bg-[#000000] border border-slate-200 dark:border-neutral-800 shadow-xl dark:shadow-2xl text-slate-700 dark:text-slate-200 before:content-[''] before:absolute ${
          isSidebarCollapsed && !isMobileDrawerOpen
            ? 'before:-left-4 before:top-0 before:bottom-0 before:w-4'
            : 'before:-bottom-4 before:left-0 before:right-0 before:h-4'
        } before:pointer-events-auto transition-all duration-200 ease-out origin-center ${
          profileMenuOpen
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto visible'
            : 'opacity-0 translate-y-2 scale-[0.96] pointer-events-none invisible'
        }`}
        style={{
          bottom: isSidebarCollapsed && !isMobileDrawerOpen ? '16px' : '72px',
          left: isMobileDrawerOpen ? '8px' : isSidebarCollapsed ? '76px' : '8px',
          width: isMobileDrawerOpen
            ? 'min(264px, calc(85vw - 24px))'
            : isSidebarCollapsed
              ? '224px'
              : '244px',
        }}
        onMouseEnter={handleProfileMouseEnter}
        onMouseLeave={handleProfileMouseLeave}
        role="menu"
        aria-hidden={!profileMenuOpen}
      >
            {/* User summary header */}
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/40">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {getDisplayName()}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                {user?.role === 'student' || user?.email?.endsWith('@aralert.local') ? (
                  user?.lrn ? (
                    <span>
                      <span className="font-semibold text-slate-400 dark:text-zinc-500 mr-1">LRN:</span>
                      <span className="font-mono">{user.lrn}</span>
                    </span>
                  ) : (
                    getRoleLabel()
                  )
                ) : (
                  user?.email || getRoleLabel()
                )}
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
                className={`group w-full flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-150 text-left cursor-pointer ${isProfileActive
                    ? 'bg-[var(--brand)]/10 text-[var(--sidebar-active-text)] font-bold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-white'
                  }`}
                role="menuitem"
              >
                <UserIcon
                  size={16}
                  strokeWidth={isProfileActive ? 2.2 : 2}
                  className={`transition-colors shrink-0 ${isProfileActive
                      ? 'text-[var(--sidebar-active-text)]'
                      : 'text-slate-400 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-white'
                    }`}
                />
                <span>Profile</span>
              </button>

              {!user?.is_superuser && (
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setIsMobileDrawerOpen(false);
                    setShowReportProblemModal(true);
                  }}
                  className="group w-full flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-900 hover:text-slate-900 dark:hover:text-white transition-all duration-150 text-left cursor-pointer"
                  role="menuitem"
                >
                  <HelpCircle
                    size={16}
                    strokeWidth={2}
                    className="text-slate-400 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors shrink-0"
                  />
                  <span>Report a Problem</span>
                </button>
              )}
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



      {/* Report a Problem Modal */}
      <ReportProblemModal
        isOpen={showReportProblemModal}
        onClose={() => {
          setShowReportProblemModal(false);
          fetchTickets();
        }}
      />

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