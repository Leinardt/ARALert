import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import type { StudentAcademicProfile, Grade, Attendance, StudentEditRequest, User as UserType } from '../../types';
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  AlertTriangle,
  Plus,
  Trash2,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit3,
  CalendarDays,
  Check,
  User,
  Layers,
  TrendingUp,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  QrCode,
  Download,
  FileText,
  Image,
} from 'lucide-react';
import {
  exportStudentQrToJpeg,
  exportStudentQrToPdf,
  exportStudentQrToDocx,
  generateStudentQrDataUrl,
} from '../../utils/studentQrExportService';
import { ExportStudentQrModal } from '../../components/ExportStudentQrModal';
import { EntrySessionSeparator } from '../../components/EntrySessionSeparator';
import { AnimatedCounter } from '../../components/AnimatedCounter';
import {
  TrendChart,
  RiskTrendChart,
  buildTrendPoints,
  buildRiskTrendPoints,
  getCompositeScoreCls,
  getAttendanceRateCls,
  getScoreAvgCls,
  type TrendPoint,
  type RiskTrendPoint,
  type TrendFilter,
} from './TutorAnalytics';
import {
  formatSessionLabel,
  formatSessionTime,
  getScoreDescription,
  getAttendanceDescription,
  getAttendanceSessionStartTime,
  groupAttendanceBySession,
} from '../../utils/sessionDescriptionHelpers';

/* ─── Helpers ─────────────────────────────────────────────────── */
import { getStudentAvatarColor as avatarColor } from '../../utils/studentFormatters';

/** Trim trailing decimal zeros: 100.00 → 100, 99.57 → 99.57, 99.5 → 99.5 */
const smartPct = (n: number): string => parseFloat(n.toFixed(2)).toString();

const formatDateString = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${weekday} | ${month} ${day}, ${year}`;
};

const formatTimeString = (value: string | null | undefined): string => {
  if (!value) return '—';

  // Handle standard "HH:MM:SS" or "HH:MM" time strings
  const timeParts = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeParts) {
    let hours = parseInt(timeParts[1], 10);
    const minutes = timeParts[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  // Handle full ISO / datetime strings
  const date = new Date(value.includes('T') || value.includes(' ') ? value : `1970-01-01T${value}`);
  if (!Number.isNaN(date.getTime())) {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  return value;
};

const getAralBadge = (level?: string | null) => {
  const formatted = level ? level.toUpperCase() : 'BASIC';
  return (
    <span className="text-[11px] font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wide">
      {formatted}
    </span>
  );
};

const getRiskBadge = (tier?: string | null) => {
  switch (tier?.toLowerCase()) {
    case 'high': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border risk-badge-high">High Risk</span>;
    case 'moderate':
    case 'medium': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border risk-badge-moderate">Moderate Risk</span>;
    default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border risk-badge-low">Low Risk</span>;
  }
};

/* ─── Main Component ───────────────────────────────────────────── */
export const TutorStudentProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isFromDashboard = location.state?.from === 'dashboard';
  const backPath = isFromDashboard ? '/tutor' : '/tutor/students';
  const backLabel = isFromDashboard ? 'Back to Home Dashboard' : 'Back to Assigned Students';
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [studentUser, setStudentUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overall' | 'attendance' | 'score'>('overall');

  const studentCohortInfo = useMemo(() => {
    const rawAral = (studentUser?.aral_level || profile?.student?.aral_level || 'basic').toUpperCase();
    const aralLevel = rawAral.includes('PLUS') ? 'PLUS' : rawAral.includes('SUMMER') ? 'SUMMER' : 'BASIC';

    let subject = (studentUser?.subject || '').toUpperCase().trim();
    if (!subject || subject === 'READING' || (aralLevel === 'PLUS' && subject === 'FILIPINO')) {
      subject = aralLevel === 'BASIC' ? 'FILIPINO' : 'ENGLISH';
    }

    const rawGrade = (studentUser?.grade_level || '').toUpperCase().trim();
    let gradeLevel = 'GRADE 7';
    let section = (studentUser?.section || '').toUpperCase().trim();

    if (rawGrade.includes(' - ')) {
      const parts = rawGrade.split(' - ').map((p) => p.trim());
      gradeLevel = parts[0].startsWith('GRADE') ? parts[0] : `GRADE ${parts[0]}`;
      if (!section) {
        section = parts.slice(1).join(' - ').trim();
      }
    } else if (rawGrade) {
      gradeLevel = rawGrade.startsWith('GRADE') ? rawGrade : `GRADE ${rawGrade}`;
    }

    if (!section || section === '—') {
      section = 'HYACINTH';
    }

    return {
      aralLevel,
      subject,
      gradeLevel,
      section,
    };
  }, [studentUser, profile]);

  const { attendanceRate, scoreAvg, compositeScore, riskTier } = useMemo(() => {
    if (!profile) return { attendanceRate: 100, scoreAvg: 100, compositeScore: 100, riskTier: 'Low' };
    const attRate = profile.attendance ? Number(profile.attendance.attendance_rate ?? 100) : 100;
    let scAvg = 100;
    if (profile.gpa !== null && profile.gpa !== undefined) {
      scAvg = Number(profile.gpa);
    } else if (profile.grade_details && profile.grade_details.length > 0) {
      const sum = profile.grade_details.reduce((acc, g) => acc + (g.final_grade || 0), 0);
      scAvg = sum / profile.grade_details.length;
    }
    const compScore = Number(((attRate * 0.4) + (scAvg * 0.6)).toFixed(2));
    const tier = compScore >= 86 ? 'Low' : compScore >= 70 ? 'Moderate' : 'High';
    return {
      attendanceRate: Number(attRate.toFixed(2)),
      scoreAvg: Number(scAvg.toFixed(2)),
      compositeScore: compScore,
      riskTier: tier,
    };
  }, [profile]);

  const [studentGrades, setStudentGrades] = useState<Grade[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<Attendance[]>([]);
  const [riskTrendFilter, setRiskTrendFilter] = useState<TrendFilter>('week');
  const [attendanceTrendFilter, setAttendanceTrendFilter] = useState<TrendFilter>('week');
  const [scoreTrendFilter, setScoreTrendFilter] = useState<TrendFilter>('week');
  const [riskTrendPage, setRiskTrendPage] = useState<number>(0);
  const [attendanceTrendPage, setAttendanceTrendPage] = useState<number>(0);
  const [scoreTrendPage, setScoreTrendPage] = useState<number>(0);

  const studentForTrend = useMemo<UserType[]>(() => {
    const studentIdStr = id || profile?.student?.id || (studentUser?.id ? String(studentUser.id) : '');
    if (studentUser) {
      return [{
        ...studentUser,
        id: studentIdStr || studentUser.id,
        full_name: studentUser.full_name || (profile?.student?.name ?? ''),
        lrn: studentUser.lrn || profile?.student?.lrn || '',
      } as UserType];
    }
    if (profile?.student) {
      return [{
        id: studentIdStr,
        email: profile.student.email || '',
        username: profile.student.username || '',
        first_name: profile.student.first_name || '',
        middle_name: profile.student.middle_name || '',
        last_name: profile.student.last_name || '',
        full_name: profile.student.name || `${profile.student.first_name || ''} ${profile.student.last_name || ''}`.trim(),
        lrn: profile.student.lrn || '',
        role: 'student',
        aral_level: profile.student.aral_level || 'basic',
        grade_level: '',
        section: '',
        avatar: null,
        is_active: true,
        is_superuser: false,
        date_joined: '',
        last_login: null,
        assigned_tutor: null,
        assigned_tutor_name: null,
        assessment_weight: 40,
        weekly_tasks_weight: 0,
        attendance_weight: 60,
      } as unknown as UserType];
    }
    return [];
  }, [studentUser, profile, id]);

  const riskTrend = useMemo(() => {
    if (studentForTrend.length === 0) return [];
    return buildRiskTrendPoints(studentForTrend as any, studentGrades, studentAttendance, riskTrendFilter, riskTrendPage);
  }, [studentForTrend, studentGrades, studentAttendance, riskTrendFilter, riskTrendPage]);

  const attendanceTrend = useMemo(() => {
    if (studentForTrend.length === 0) return [];
    return buildTrendPoints(studentForTrend as any, studentGrades, studentAttendance, 'attendance', attendanceTrendFilter, attendanceTrendPage);
  }, [studentForTrend, studentGrades, studentAttendance, attendanceTrendFilter, attendanceTrendPage]);

  const scoreTrend = useMemo(() => {
    if (studentForTrend.length === 0) return [];
    return buildTrendPoints(studentForTrend as any, studentGrades, studentAttendance, 'score', scoreTrendFilter, scoreTrendPage);
  }, [studentForTrend, studentGrades, studentAttendance, scoreTrendFilter, scoreTrendPage]);

  const studentFirstName = profile?.student?.first_name || profile?.student?.name?.trim().split(' ')[0] || 'Student';

  const relevantGrades = useMemo(() => {
    return studentGrades.filter((g) => {
      if (g.component_type === 'attendance') return false;
      const remarks = String(g.remarks || '').trim().toLowerCase();
      if (remarks === 'not taken') return false;
      const score = Number(g.score);
      const total = Number(g.total_score);
      return !isNaN(score) && score !== null && !isNaN(total) && total > 0;
    });
  }, [studentGrades]);

  const { passedCount, failedCount, calculatedAvgScore } = useMemo(() => {
    if (relevantGrades.length === 0) {
      const fallbackScore = (scoreAvg !== null && !isNaN(scoreAvg) && scoreAvg > 0) ? scoreAvg : 100;
      return { passedCount: 0, failedCount: 0, calculatedAvgScore: fallbackScore };
    }
    const passed = relevantGrades.filter((g) => {
      const total = Number(g.total_score) > 0 ? Number(g.total_score) : 100;
      return (Number(g.score) / total) >= 0.7;
    }).length;
    const failed = relevantGrades.filter((g) => {
      const total = Number(g.total_score) > 0 ? Number(g.total_score) : 100;
      return (Number(g.score) / total) < 0.7;
    }).length;
    const totalPercent = relevantGrades.reduce((sum, g) => {
      const total = Number(g.total_score) > 0 ? Number(g.total_score) : 100;
      const score = Number(g.score) || 0;
      return sum + ((score / total) * 100);
    }, 0);
    const avg = Number((totalPercent / relevantGrades.length).toFixed(2));
    return {
      passedCount: passed,
      failedCount: failed,
      calculatedAvgScore: !isNaN(avg) ? avg : 100,
    };
  }, [relevantGrades, scoreAvg]);

  const hasScoreData = useMemo(() => {
    return relevantGrades.length > 0;
  }, [relevantGrades]);

  const effectiveScoreAvg = useMemo(() => {
    if (hasScoreData) return calculatedAvgScore;
    if (scoreAvg !== null && !isNaN(scoreAvg) && scoreAvg > 0) return scoreAvg;
    return 100;
  }, [hasScoreData, calculatedAvgScore, scoreAvg]);

  const effectiveAttendanceRate = useMemo(() => {
    if (attendanceRate !== null && !isNaN(attendanceRate) && attendanceRate >= 0) {
      return attendanceRate;
    }
    return 100;
  }, [attendanceRate]);

  const effectiveCompositeScore = useMemo(() => {
    const comp = Number(((effectiveAttendanceRate * 0.4) + (effectiveScoreAvg * 0.6)).toFixed(2));
    return !isNaN(comp) ? comp : 100;
  }, [effectiveAttendanceRate, effectiveScoreAvg]);

  const effectiveRiskTier = useMemo(() => {
    if (effectiveCompositeScore >= 86) return 'Low';
    if (effectiveCompositeScore >= 70) return 'Moderate';
    return 'High';
  }, [effectiveCompositeScore]);

  const scoreMood = useMemo(() => {
    // No-data state: neutral grey — not orange, which would imply a known medium risk
    if (!hasScoreData) {
      return {
        cardBg: 'bg-gray-50 border-gray-200 dark:bg-[#111111] dark:border-[#1A1A1A]',
        iconBg: 'bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700',
        iconColor: 'text-gray-400 dark:text-slate-500',
        textColor: 'text-gray-400 dark:text-slate-500',
        valueColor: 'text-gray-400 dark:text-slate-500',
        descColor: 'text-gray-400 dark:text-slate-500',
      };
    }
    if (calculatedAvgScore >= 81) {
      return {
        cardBg: 'risk-card-low',
        iconBg: 'risk-badge-low',
        iconColor: 'text-risk-low',
        textColor: 'text-risk-low',
        valueColor: 'text-risk-low',
        descColor: 'text-risk-low',
      };
    }
    if (calculatedAvgScore >= 75) {
      return {
        cardBg: 'risk-card-moderate',
        iconBg: 'risk-badge-moderate',
        iconColor: 'text-risk-moderate',
        textColor: 'text-risk-moderate',
        valueColor: 'text-risk-moderate',
        descColor: 'text-risk-moderate',
      };
    }
    return {
      cardBg: 'risk-card-high',
      iconBg: 'risk-badge-high',
      iconColor: 'text-risk-high',
      textColor: 'text-risk-high',
      valueColor: 'text-risk-high',
      descColor: 'text-risk-high',
    };
  }, [calculatedAvgScore, hasScoreData]);

  const hasAttendanceData = useMemo(() => {
    if (!profile) return false;
    return (profile.attendance.present + profile.attendance.late + profile.attendance.absent) > 0;
  }, [profile]);

  const attendanceMood = useMemo(() => {
    // No-data state: neutral grey — not orange, which would imply a known medium risk
    if (!hasAttendanceData) {
      return {
        cardBg: 'bg-gray-50 border-gray-200 dark:bg-[#111111] dark:border-[#1A1A1A]',
        iconBg: 'bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700',
        iconColor: 'text-gray-400 dark:text-slate-500',
        textColor: 'text-gray-400 dark:text-slate-500',
        valueColor: 'text-gray-400 dark:text-slate-500',
        descColor: 'text-gray-400 dark:text-slate-500',
      };
    }
    if (attendanceRate >= 81) {
      return {
        cardBg: 'risk-card-low',
        iconBg: 'risk-badge-low',
        iconColor: 'text-risk-low',
        textColor: 'text-risk-low',
        valueColor: 'text-risk-low',
        descColor: 'text-risk-low',
      };
    }
    if (attendanceRate >= 75) {
      return {
        cardBg: 'risk-card-moderate',
        iconBg: 'risk-badge-moderate',
        iconColor: 'text-risk-moderate',
        textColor: 'text-risk-moderate',
        valueColor: 'text-risk-moderate',
        descColor: 'text-risk-moderate',
      };
    }
    return {
      cardBg: 'risk-card-high',
      iconBg: 'risk-badge-high',
      iconColor: 'text-risk-high',
      textColor: 'text-risk-high',
      valueColor: 'text-risk-high',
      descColor: 'text-risk-high',
    };
  }, [attendanceRate, hasAttendanceData]);

  // Modals state
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showAttendanceConfirmModal, setShowAttendanceConfirmModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showExportQrModal, setShowExportQrModal] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [isExportingQr, setIsExportingQr] = useState(false);

  const [activityForm, setActivityForm] = useState({
    title: '',
    description: '',
    status: 'pending' as 'pending' | 'in_progress' | 'completed',
    remarks: ''
  });

  const [riskForm, setRiskForm] = useState({
    risk_level: 'low' as 'low' | 'moderate' | 'medium' | 'high',
    details: ''
  });

  const [attendanceForm, setAttendanceForm] = useState({
    date: new Date().toLocaleDateString('en-CA'),
    status: 'present' as 'present' | 'absent',
    aral_activity_id: ''
  });

  const [pendingEditRequest, setPendingEditRequest] = useState<StudentEditRequest | null>(null);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    username: '',
    email: '',
    lrn: '',
    aral_level: 'basic',
  });
  const [isEvaluatingLevel, setIsEvaluatingLevel] = useState(false);
  const [levelEvalMessage, setLevelEvalMessage] = useState<string | null>(null);
  const [studentEditError, setStudentEditError] = useState<string | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  const handleEvaluateLevelProgression = async () => {
    if (!id) return;
    setIsEvaluatingLevel(true);
    setLevelEvalMessage(null);
    try {
      const results = await academicService.evaluateAralLevelUp(id);
      if (results && results.length > 0) {
        setLevelEvalMessage(results[0].message);
      }
      await fetchProfile();
    } catch (err: any) {
      console.error(err);
      alert('Failed to evaluate ARAL level progression.');
    } finally {
      setIsEvaluatingLevel(false);
    }
  };

  const fetchProfile = async () => {
    if (!id) return;
    try {
      const [data, gradesData, attData, editReqData, userData] = await Promise.all([
        academicService.getStudentProfile(id),
        academicService.getGrades({ student_id: id }).catch(() => [] as Grade[]),
        academicService.getAttendanceHistory({ user_id: id }).catch(() => [] as Attendance[]),
        userService.getStudentEditRequests({ student_id: id, status: 'pending' }).catch(() => ({ results: [] })),
        userService.getUser(id).catch(() => null as UserType | null),
      ]);
      setProfile(data);
      setStudentUser(userData);
      setStudentGrades(gradesData);
      setStudentAttendance(Array.isArray(attData) && attData.length > 0 ? attData : (data?.attendance?.logs || []));
      setPendingEditRequest(editReqData.results && editReqData.results.length > 0 ? editReqData.results[0] : null);
      setStudentForm({
        first_name: data.student.first_name || '',
        middle_name: data.student.middle_name || userData?.middle_name || '',
        last_name: data.student.last_name || '',
        username: data.student.username || '',
        email: data.student.email || '',
        lrn: data.student.lrn || '',
        aral_level: data.student.aral_level || 'basic',
      });
    } catch (err) {
      console.error(err);
      setError('Failed to fetch student profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);


  const handleDeleteGrade = async (gradeId: number) => {
    if (!window.confirm('Are you sure you want to delete this grade?')) return;
    try {
      await academicService.deleteGrade(gradeId);
      fetchProfile();
    } catch (err) {
      alert('Failed to delete grade.');
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !activityForm.title) return;
    try {
      await academicService.createAralActivity({
        student: id,
        title: activityForm.title,
        description: activityForm.description || null,
        status: activityForm.status,
        remarks: activityForm.remarks || null
      });
      setShowActivityModal(false);
      setActivityForm({ title: '', description: '', status: 'pending', remarks: '' });
      fetchProfile();
    } catch (err) {
      alert('Failed to create ARAL activity.');
    }
  };

  const handleUpdateActivityStatus = async (actId: number, status: 'pending' | 'in_progress' | 'completed') => {
    try {
      await academicService.updateAralActivity(actId, { status });
      fetchProfile();
    } catch (err) {
      alert('Failed to update activity.');
    }
  };

  const handleDeleteActivity = async (actId: number) => {
    if (!window.confirm('Delete this ARAL activity?')) return;
    try {
      await academicService.deleteAralActivity(actId);
      fetchProfile();
    } catch (err) {
      alert('Failed to delete activity.');
    }
  };

  const handleAddRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !riskForm.details) return;
    try {
      await academicService.createAcademicRisk({
        student: id,
        risk_level: riskForm.risk_level,
        details: riskForm.details,
        resolved: false
      });
      setShowRiskModal(false);
      setRiskForm({ risk_level: 'low', details: '' });
      fetchProfile();
      window.dispatchEvent(new CustomEvent('aralert:refresh-risk-alerts'));
    } catch (err) {
      alert('Failed to log risk alert.');
    }
  };

  const handleResolveRisk = async (riskId: number) => {
    try {
      await academicService.updateAcademicRisk(riskId, { resolved: true });
      fetchProfile();
      window.dispatchEvent(new CustomEvent('aralert:refresh-risk-alerts'));
    } catch (err) {
      alert('Failed to resolve risk alert.');
    }
  };

  const handlePromptAddAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setShowAttendanceConfirmModal(true);
  };

  const handleConfirmAddAttendance = async () => {
    setShowAttendanceConfirmModal(false);
    if (!id) return;
    try {
      await academicService.logManualAttendance({
        student_id: id,
        date: attendanceForm.date,
        status: attendanceForm.status,
        aral_activity_id: attendanceForm.aral_activity_id ? Number(attendanceForm.aral_activity_id) : undefined
      });
      setShowAttendanceModal(false);
      setAttendanceForm({ date: new Date().toLocaleDateString('en-CA'), status: 'present', aral_activity_id: '' });
      fetchProfile();
      window.dispatchEvent(new CustomEvent('aralert:refresh-risk-alerts'));
    } catch (err) {
      alert('Failed to log attendance.');
    }
  };

  const handlePromptSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setStudentEditError(null);
    setShowSaveConfirmModal(true);
  };

  const handleConfirmSaveStudent = async () => {
    if (!profile) return;
    setShowSaveConfirmModal(false);
    setIsSavingStudent(true);
    setStudentEditError(null);

    try {
      await userService.updateUser(profile.student.id, {
        first_name: studentForm.first_name.trim().toUpperCase(),
        middle_name: studentForm.middle_name.trim().toUpperCase(),
        last_name: studentForm.last_name.trim().toUpperCase(),
        lrn: studentForm.lrn.trim() || null,
        aral_level: studentForm.aral_level,
      });
      setIsEditingStudent(false);
      await fetchProfile();
      window.dispatchEvent(new CustomEvent('aralert:refresh-risk-alerts'));
    } catch (err: any) {
      const errData = err?.response?.data;
      const msg =
        errData?.detail ||
        errData?.lrn?.[0] ||
        errData?.first_name?.[0] ||
        errData?.last_name?.[0] ||
        errData?.aral_level?.[0] ||
        'Failed to save student details.';
      setStudentEditError(msg);
    } finally {
      setIsSavingStudent(false);
    }
  };

  const [isCancellingStudentEdit, setIsCancellingStudentEdit] = useState(false);

  const handleExecuteCancelStudentEditRequest = async () => {
    if (!pendingEditRequest) return;

    setIsCancellingStudentEdit(true);
    try {
      await userService.cancelStudentEditRequest(pendingEditRequest.id);
      setPendingEditRequest(null);
      setShowPendingModal(false);
      setShowCancelConfirmModal(false);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to cancel the edit request.');
      setShowCancelConfirmModal(false);
    } finally {
      setIsCancellingStudentEdit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto skeleton-container animate-pulse" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* Back button skeleton */}
        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />

        {/* Student Header Card 1:1 Skeleton */}
        <div className="bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-5">
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
              <div className="space-y-2 min-w-0">
                <div className="h-6 w-52 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-3 w-40 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-2.5 w-28 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="h-9 w-36 rounded-md bg-gray-200 dark:bg-gray-800" />
              <div className="h-9 w-32 rounded-md bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
        </div>

        {/* Tab nav skeleton */}
        <div className="flex w-full rounded-md bg-gray-100 dark:bg-[#141414] p-1 gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-9 rounded-sm bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>

        {/* KPI containers skeleton (1:1 with rounded-md) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 rounded-md bg-gray-200 dark:bg-gray-800 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-7 w-16 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-2.5 w-36 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>

        {/* Table card skeleton (1:1 with rounded-md) */}
        <div className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#1A1A1A]">
            <div className="space-y-1.5">
              <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="h-8 w-28 rounded-md bg-gray-200 dark:bg-gray-800" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 dark:border-gray-900/50">
              <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-4 w-16 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-4 flex-1 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-2xl p-5 shadow-sm max-w-6xl mx-auto">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load student profile</p>
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{error || 'Profile not found.'}</p>
          <Link to={backPath} className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-[var(--brand)] hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto data-loaded-content" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── Top Navigation & Actions ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          to={backPath}
          className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-gray-500 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {backLabel}
        </Link>
      </div>

      {/* ── Student Header Card ──────────────────────────────────── */}
      <div className="bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-5">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0 ${avatarColor(profile.student.name)}`}>
              <User className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-slate-100 tracking-tight truncate">{profile.student.name}</h1>
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                <span className="font-extrabold text-gray-700 dark:text-slate-300">{studentCohortInfo.aralLevel}</span>
                <span className="text-gray-300 dark:text-zinc-600">•</span>
                <span>{studentCohortInfo.subject}</span>
                <span className="text-gray-300 dark:text-zinc-600">•</span>
                <span>{studentCohortInfo.gradeLevel} - {studentCohortInfo.section}</span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5 sm:mt-1">
                LRN: <span className="font-mono font-bold text-gray-800 dark:text-slate-200">{profile.student.lrn || 'N/A'}</span>
              </p>
            </div>
          </div>

          {/* Action buttons: Edit Student Details / Pending Status */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            {pendingEditRequest && (
              <button
                type="button"
                onClick={() => setShowPendingModal(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">Edit Request Pending Approval</span>
              </button>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  if (profile?.student) {
                    setStudentForm({
                      first_name: profile.student.first_name || '',
                      middle_name: profile.student.middle_name || studentUser?.middle_name || '',
                      last_name: profile.student.last_name || '',
                      username: profile.student.username || '',
                      email: profile.student.email || '',
                      lrn: profile.student.lrn || '',
                      aral_level: profile.student.aral_level || 'basic',
                    });
                  }
                  setIsEditingStudent(true);
                  setStudentEditError(null);
                }}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs font-bold border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#161616] hover:border-[var(--brand)] hover:bg-[var(--brand-light)] dark:hover:bg-[#1a1a1a] text-gray-700 dark:text-slate-200 hover:text-[var(--brand-dark)] transition cursor-pointer whitespace-nowrap shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                <span>Edit Student Details</span>
              </button>

              <button
                type="button"
                disabled={!profile}
                onClick={() => setShowExportQrModal(true)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-md bg-[var(--brand)] px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white transition-all hover:bg-[var(--brand-hover)] cursor-pointer whitespace-nowrap shadow-xs disabled:opacity-60"
                title="Export Student Attendance QR Code"
              >
                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white shrink-0" />
                <span>Export QR Code</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ─────────────────────────────────────────── */}
      <div
        className="flex w-full rounded-md bg-gray-100 dark:bg-[#1A1A1A] p-0.5 no-arrive-animation gap-0.5"
        role="tablist"
        aria-label="Student profile view"
        style={{ animation: 'none', transform: 'none', opacity: 1 }}
      >
        {([
          ['overall', 'Overall'],
          ['attendance', 'Attendance'],
          ['score', 'Score'],
        ] as const).map(([tabKey, label]) => {
          const isActive = activeTab === tabKey;
          return (
            <button
              key={tabKey}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tabKey)}
              className={`flex-1 rounded-sm py-2 px-2 sm:px-3 text-xs uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer ${isActive
                ? 'bg-[var(--brand)] text-white font-extrabold shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 font-bold'
                }`}
            >
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content Panels ─────────────────────────────────────── */}
      <div className="space-y-4 sm:space-y-6">

        {/* ── 1. OVERALL TAB ───────────────────────────────────────── */}
        {activeTab === 'overall' && (
          <div className="space-y-4 sm:space-y-6">
            {/* KPI Containers */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
              <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 sm:p-5 flex flex-col justify-center col-span-1 shadow-sm">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 truncate">COMPOSITE RATING</p>
                <p className={`text-2xl sm:text-3xl font-black mt-1 tracking-tight ${effectiveRiskTier === 'High' ? 'text-risk-high' : effectiveRiskTier === 'Moderate' ? 'text-risk-moderate' : 'text-risk-low'}`}>
                  <AnimatedCounter value={effectiveCompositeScore} suffix="%" duration={600} decimals={effectiveCompositeScore % 1 !== 0 ? 1 : 0} />
                </p>
              </div>

              <div className={`rounded-md border p-3.5 sm:p-5 flex flex-col justify-center col-span-1 md:col-span-2 shadow-sm ${effectiveRiskTier === 'High'
                ? 'risk-card-high'
                : effectiveRiskTier === 'Moderate'
                  ? 'risk-card-moderate'
                  : 'risk-card-low'
                }`}>
                <p className={`text-[10.5px] font-bold uppercase tracking-wider truncate ${effectiveRiskTier === 'High'
                  ? 'text-risk-high'
                  : effectiveRiskTier === 'Moderate'
                    ? 'text-risk-moderate'
                    : 'text-risk-low'
                  }`}>RISK LEVEL</p>
                <p className={`text-2xl sm:text-3xl font-black mt-1 tracking-tight truncate ${effectiveRiskTier === 'High'
                  ? 'text-risk-high'
                  : effectiveRiskTier === 'Moderate'
                    ? 'text-risk-moderate'
                    : 'text-risk-low'
                  }`}>
                  {effectiveRiskTier}
                </p>
              </div>
            </div>

            {/* ── Risk Level Trend Chart ── */}
            <section className="rounded-md border border-gray-200 bg-white p-3.5 sm:p-5 dark:border-[#1A1A1A] dark:bg-[#111111] shadow-sm" aria-labelledby="student-risk-trend-heading">
              <div className="flex flex-col gap-3 border-b border-gray-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
                <div>
                  <h3 id="student-risk-trend-heading" className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                    RISK LEVEL TREND CHART
                  </h3>
                  <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                    {profile.student.name}&apos;s Risk Progression
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#EF4444' }} />High Risk</span>
                    <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} />Moderate Risk</span>
                    <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#22C55E' }} />Low Risk</span>
                  </div>
                  <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#1A1A1A]" role="group" aria-label="Risk trend period">
                    {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => {
                          setRiskTrendFilter(filter);
                          setRiskTrendPage(0);
                        }}
                        className={`cursor-pointer rounded-sm px-3 py-1.5 text-[10px] sm:text-[10.5px] uppercase tracking-wider transition-all ${
                          riskTrendFilter === filter
                            ? 'bg-[var(--brand)] text-white font-black shadow-sm'
                            : 'text-gray-500 dark:text-slate-400 font-bold hover:text-gray-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  {/* Period navigation arrows */}
                  <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#1A1A1A]" role="group" aria-label="Scroll between previous and present risk records">
                    <button
                      type="button"
                      onClick={() => setRiskTrendPage((p) => p + 1)}
                      disabled={riskTrendPage >= 10}
                      aria-label="Previous records"
                      title={riskTrendPage >= 10 ? 'Earliest historical records reached' : 'Scroll to previous records'}
                      className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#111111] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                    >
                      <ChevronLeft size={14} className="stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRiskTrendPage((p) => Math.max(0, p - 1))}
                      disabled={riskTrendPage === 0}
                      aria-label="Next records"
                      title={riskTrendPage === 0 ? 'Viewing present records' : 'Scroll towards present records'}
                      className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#111111] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                    >
                      <ChevronRight size={14} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="relative rounded-md border border-gray-100 bg-gray-50/60 p-2 sm:p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
                  <RiskTrendChart
                    data={riskTrend}
                    total={1}
                    isSingleStudent={true}
                    studentName={profile.student.name}
                    emptyLabel={riskTrendFilter === 'day' ? 'No recorded performance data today' : riskTrendFilter === 'week' ? 'No recorded performance data this week' : 'No recorded performance data this month'}
                    trendFilter={riskTrendFilter}
                  />
                </div>
              </div>
            </section>

            {/* Performance Summary Table */}
            <div className="overflow-hidden rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm">
              <div className="border-b border-gray-100 dark:border-[#1A1A1A] px-4 sm:px-6 py-3 sm:py-4">
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-gray-900 dark:text-slate-100">STUDENT PERFORMANCE SUMMARY</h3>
                <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Overview of the calculation</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-xs sm:text-sm font-normal" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] shadow-xs">
                    <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300">
                      <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-2 sm:px-6 py-2.5 sm:py-3 text-center leading-tight">AVERAGE ATTENDANCE RATE</th>
                      <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-2 sm:px-6 py-2.5 sm:py-3 text-center leading-tight">AVERAGE SCORE RATE</th>
                      <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-2 sm:px-6 py-2.5 sm:py-3 text-center leading-tight">COMPOSITE RATING</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#111111]">
                    <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#151515] text-center">
                      <td className={`px-2 sm:px-6 py-2.5 sm:py-3.5 text-xs sm:text-sm ${getAttendanceRateCls(attendanceRate)}`}>
                        {smartPct(attendanceRate)}%
                      </td>
                      <td className={`px-2 sm:px-6 py-2.5 sm:py-3.5 text-xs sm:text-sm ${getScoreAvgCls(effectiveScoreAvg)}`}>
                        {smartPct(effectiveScoreAvg)}%
                      </td>
                      <td className={`px-2 sm:px-6 py-2.5 sm:py-3.5 text-xs sm:text-sm ${getCompositeScoreCls(effectiveRiskTier)}`}>
                        {smartPct(effectiveCompositeScore)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. ATTENDANCE TAB ────────────────────────────────────── */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {/* Stat Containers */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
              <div className="rounded-md border border-emerald-500/30 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 sm:p-5 flex items-center gap-2.5 sm:gap-4 col-span-1 shadow-sm">
                <Check className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={3} />
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">TOTAL PRESENT</p>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100 mt-1 tracking-tight">
                    <AnimatedCounter value={profile.attendance.present} duration={600} />
                  </p>
                  <p className="mt-0.5 text-[10.5px] font-medium text-gray-500 dark:text-slate-400 truncate hidden sm:block">{studentFirstName}'s total present records</p>
                </div>
              </div>
              <div className="rounded-md border border-rose-500/30 dark:border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20 p-3.5 sm:p-5 flex items-center gap-2.5 sm:gap-4 col-span-1 shadow-sm">
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 truncate">TOTAL ABSENT</p>
                  <p className="text-2xl sm:text-3xl font-black text-rose-900 dark:text-rose-100 mt-1 tracking-tight">
                    <AnimatedCounter value={profile.attendance.absent} duration={600} />
                  </p>
                  <p className="mt-0.5 text-[10.5px] font-medium text-gray-500 dark:text-slate-400 truncate hidden sm:block">{studentFirstName}'s total absent records</p>
                </div>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 sm:p-5 flex flex-col justify-center col-span-2 sm:col-span-1 shadow-sm">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 truncate">AVG ATTENDANCE RATE</p>
                  <p
                    className={`text-2xl sm:text-3xl font-black mt-1 tracking-tight ${!hasAttendanceData
                      ? 'text-gray-900 dark:text-slate-100'
                      : attendanceRate >= 81
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : attendanceRate >= 75
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                  >
                    {hasAttendanceData ? (
                      <AnimatedCounter value={attendanceRate} suffix="%" duration={600} decimals={attendanceRate % 1 !== 0 ? 1 : 0} />
                    ) : '—'}
                  </p>
                  <p className="mt-0.5 text-[10.5px] font-medium text-gray-500 dark:text-slate-400 truncate hidden sm:block">{studentFirstName}'s average attendance rate</p>
                </div>
              </div>
            </div>

            {/* ── Attendance Rate Trend Chart ── */}
            <section className="w-full rounded-md border border-gray-200 bg-white p-3.5 sm:p-5 dark:border-[#1A1A1A] dark:bg-[#111111] shadow-sm" aria-labelledby="student-attendance-trend-heading">
              <div className="flex flex-col gap-3 border-b border-gray-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
                <div>
                  <h3 id="student-attendance-trend-heading" className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                    ATTENDANCE RATE TREND CHART
                  </h3>
                  <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                    {profile.student.name}&apos;s Attendance Progression
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#0052B7]" />Attendance Rate</span>
                  </div>
                  <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#1A1A1A]" role="group" aria-label="Attendance trend period">
                    {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => {
                          setAttendanceTrendFilter(filter);
                          setAttendanceTrendPage(0);
                        }}
                        className={`cursor-pointer rounded-sm px-3 py-1.5 text-[10px] sm:text-[10.5px] uppercase tracking-wider transition-all ${
                          attendanceTrendFilter === filter
                            ? 'bg-[var(--brand)] text-white font-black shadow-sm'
                            : 'text-gray-500 dark:text-slate-400 font-bold hover:text-gray-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  {/* Period navigation arrows */}
                  <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#1A1A1A]" role="group" aria-label="Scroll between previous and present attendance records">
                    <button
                      type="button"
                      onClick={() => setAttendanceTrendPage((p) => p + 1)}
                      disabled={attendanceTrendPage >= 10}
                      aria-label="Previous records"
                      title={attendanceTrendPage >= 10 ? 'Earliest historical records reached' : 'Scroll to previous records'}
                      className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#111111] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                    >
                      <ChevronLeft size={14} className="stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceTrendPage((p) => Math.max(0, p - 1))}
                      disabled={attendanceTrendPage === 0}
                      aria-label="Next records"
                      title={attendanceTrendPage === 0 ? 'Viewing present records' : 'Scroll towards present records'}
                      className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#111111] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                    >
                      <ChevronRight size={14} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="relative mt-4 h-64 sm:h-72 w-full rounded-md border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
                <TrendChart
                  data={attendanceTrend}
                  color="#0052B7"
                  emptyLabel={attendanceTrendFilter === 'day' ? 'No recorded attendance today' : attendanceTrendFilter === 'week' ? 'No recorded attendance this week' : 'No recorded attendance this month'}
                  valueLabel={`${profile.student.name}'s Attendance Rate`}
                  trendFilter={attendanceTrendFilter}
                />
              </div>
            </section>

            {/* Student Attendance History */}
            <AttendanceHistoryList
              studentId={id!}
              reloadTrigger={profile}
              aralLevel={profile.student.aral_level}
              onAttendanceLoaded={(loadedLogs) => setStudentAttendance(loadedLogs)}
            />
          </div>
        )}

        {/* ── 3. SCORE TAB ─────────────────────────────────────────── */}
        {activeTab === 'score' && (
          <div className="space-y-4">
            {/* Stat Containers */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
              <div className="rounded-md border border-emerald-500/30 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 sm:p-5 flex items-center gap-2.5 sm:gap-4 col-span-1 shadow-sm">
                <Check className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={3} />
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">TOTAL PASSED</p>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100 mt-1 tracking-tight">
                    <AnimatedCounter value={passedCount} duration={600} />
                  </p>
                  <p className="mt-0.5 text-[10.5px] font-medium text-gray-500 dark:text-slate-400 truncate hidden sm:block">{studentFirstName}'s total passed score records</p>
                </div>
              </div>
              <div className="rounded-md border border-rose-500/30 dark:border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20 p-3.5 sm:p-5 flex items-center gap-2.5 sm:gap-4 col-span-1 shadow-sm">
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 truncate">TOTAL FAILED</p>
                  <p className="text-2xl sm:text-3xl font-black text-rose-900 dark:text-rose-100 mt-1 tracking-tight">
                    <AnimatedCounter value={failedCount} duration={600} />
                  </p>
                  <p className="mt-0.5 text-[10.5px] font-medium text-gray-500 dark:text-slate-400 truncate hidden sm:block">{studentFirstName}'s total failed score records</p>
                </div>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 sm:p-5 flex flex-col justify-center col-span-2 sm:col-span-1 shadow-sm">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 truncate">AVERAGE SCORE RATE</p>
                  <p
                    className={`text-2xl sm:text-3xl font-black mt-1 tracking-tight ${!hasScoreData
                      ? 'text-gray-900 dark:text-slate-100'
                      : calculatedAvgScore >= 81
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : calculatedAvgScore >= 70
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                  >
                    {hasScoreData ? (
                      <AnimatedCounter value={calculatedAvgScore} suffix="%" duration={600} decimals={calculatedAvgScore % 1 !== 0 ? 1 : 0} />
                    ) : '—'}
                  </p>
                  <p className="mt-0.5 text-[10.5px] font-medium text-gray-500 dark:text-slate-400 truncate hidden sm:block">{studentFirstName}'s average score rate</p>
                </div>
              </div>
            </div>

            {/* ── Score Trend Chart ── */}
            <section className="w-full rounded-md border border-gray-200 bg-white p-3.5 sm:p-5 dark:border-[#1A1A1A] dark:bg-[#111111] shadow-sm" aria-labelledby="student-score-trend-heading">
              <div className="flex flex-col gap-3 border-b border-gray-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#1A1A1A]">
                <div>
                  <h3 id="student-score-trend-heading" className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-gray-900 dark:text-slate-100">
                    SCORE TREND CHART
                  </h3>
                  <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                    {profile.student.name}&apos;s Score Progression
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 text-xs font-semibold text-gray-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-[#0052B7]" />Average Score Rate</span>
                  </div>
                  <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#1A1A1A]" role="group" aria-label="Score trend period">
                    {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => {
                          setScoreTrendFilter(filter);
                          setScoreTrendPage(0);
                        }}
                        className={`cursor-pointer rounded-sm px-3 py-1.5 text-[10px] sm:text-[10.5px] uppercase tracking-wider transition-all ${
                          scoreTrendFilter === filter
                            ? 'bg-[var(--brand)] text-white font-black shadow-sm'
                            : 'text-gray-500 dark:text-slate-400 font-bold hover:text-gray-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  {/* Period navigation arrows */}
                  <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#1A1A1A]" role="group" aria-label="Scroll between previous and present score records">
                    <button
                      type="button"
                      onClick={() => setScoreTrendPage((p) => p + 1)}
                      disabled={scoreTrendPage >= 10}
                      aria-label="Previous records"
                      title={scoreTrendPage >= 10 ? 'Earliest historical records reached' : 'Scroll to previous records'}
                      className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#111111] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                    >
                      <ChevronLeft size={14} className="stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setScoreTrendPage((p) => Math.max(0, p - 1))}
                      disabled={scoreTrendPage === 0}
                      aria-label="Next records"
                      title={scoreTrendPage === 0 ? 'Viewing present records' : 'Scroll towards present records'}
                      className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#111111] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                    >
                      <ChevronRight size={14} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="relative mt-4 h-64 sm:h-72 w-full rounded-md border border-gray-100 bg-gray-50/60 p-2.5 dark:border-[#1A1A1A] dark:bg-[#111111]">
                <TrendChart
                  data={scoreTrend}
                  color="#0052B7"
                  emptyLabel={scoreTrendFilter === 'day' ? 'No recorded score today' : scoreTrendFilter === 'week' ? 'No recorded score this week' : 'No recorded score this month'}
                  valueLabel={`${profile.student.name}'s Average Score Rate`}
                  trendFilter={scoreTrendFilter}
                />
              </div>
            </section>

            {/* Student Score History */}
            <ScoreHistoryList
              studentId={id!}
              reloadTrigger={profile}
              onGradesLoaded={(loadedGrades) => setStudentGrades(loadedGrades)}
            />
          </div>
        )}
      </div>

      {/* ── ARAL ACTIVITY MODAL ────────────────────────────────────── */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddActivity} className="bg-white dark:bg-[#111111] rounded-lg p-4 sm:p-6 max-w-md w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A] pb-3">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Create ARAL Activity</h3>
              <button type="button" onClick={() => setShowActivityModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Remedial Learning Practice"
                value={activityForm.title}
                onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                placeholder="Describe the activity guidelines or intervention objectives..."
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] h-20 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Initial Status</label>
              <select
                value={activityForm.status}
                onChange={(e) => setActivityForm({ ...activityForm, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Remarks (Optional)</label>
              <input
                type="text"
                value={activityForm.remarks}
                onChange={(e) => setActivityForm({ ...activityForm, remarks: e.target.value })}
                placeholder="Additional notes or observation..."
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
              <button
                type="button"
                onClick={() => setShowActivityModal(false)}
                className="bg-white dark:bg-transparent border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md text-xs font-bold hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-5 py-2 rounded-md text-xs font-bold cursor-pointer transition-colors"
              >
                Create Activity
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── RISK ALERTS MODAL ──────────────────────────────────────── */}
      {showRiskModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddRisk} className="bg-white dark:bg-[#111111] rounded-lg p-4 sm:p-6 max-w-md w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A] pb-3">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Log Academic Risk Warning</h3>
              <button type="button" onClick={() => setShowRiskModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Risk Level</label>
              <select
                value={riskForm.risk_level === 'medium' ? 'moderate' : riskForm.risk_level}
                onChange={(e) => setRiskForm({ ...riskForm, risk_level: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              >
                <option value="low">Low Risk</option>
                <option value="moderate">Moderate Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Details & Reasons</label>
              <textarea
                required
                placeholder="Explain why this student is flagged (e.g. failing exam grades, consistent absenteeism)..."
                value={riskForm.details}
                onChange={(e) => setRiskForm({ ...riskForm, details: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] h-24 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
              <button
                type="button"
                onClick={() => setShowRiskModal(false)}
                className="bg-white dark:bg-transparent border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md text-xs font-bold hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-5 py-2 rounded-md text-xs font-bold cursor-pointer transition-colors"
              >
                Submit Risk Flag
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── ATTENDANCE MODAL ───────────────────────────────────────── */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handlePromptAddAttendance} className="bg-white dark:bg-[#111111] rounded-lg p-4 sm:p-6 max-w-md w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A] pb-3">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Log Manual Attendance</h3>
              <button type="button" onClick={() => setShowAttendanceModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input
                type="date"
                required
                value={attendanceForm.date}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={attendanceForm.status}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Linked Intervention Activity (Optional)</label>
              <select
                value={attendanceForm.aral_activity_id}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, aral_activity_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              >
                <option value="">None</option>
                {profile.aral_progress.activities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="bg-white dark:bg-transparent border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md text-xs font-bold hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-5 py-2 rounded-md text-xs font-bold cursor-pointer transition-colors"
              >
                Log Entry
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Attendance Log Confirmation Modal (Matches Score Entry) ── */}
      {showAttendanceConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
          style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAttendanceConfirmModal(false); }}
        >
          <div className="relative w-full max-w-sm rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-3 animate-fade-in-scale">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 uppercase">
                Log Manual Attendance
              </h3>
              <p className="mt-1 text-xs font-normal text-gray-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to log this manual attendance record for {profile?.student?.name}?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAttendanceConfirmModal(false)}
                className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddAttendance}
                className="rounded-md bg-[var(--brand)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-dark)] cursor-pointer"
              >
                Log Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STUDENT EDIT MODAL ─────────────────────────────── */}
      {isEditingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <form
            onSubmit={handlePromptSaveStudent}
            autoComplete="off"
            data-form-type="other"
            className="bg-white dark:bg-[#111111] rounded-lg p-4 sm:p-6 max-w-lg w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4 my-4 sm:my-8 animate-fade-in-scale"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A] pb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base uppercase">EDIT STUDENT DETAILS</h3>
              </div>
              <button type="button" onClick={() => setIsEditingStudent(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {studentEditError && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 text-xs rounded-md p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{studentEditError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                <input
                  type="text"
                  name="aralert_student_first_name"
                  autoComplete="off"
                  data-lpignore="true"
                  required
                  value={studentForm.first_name}
                  onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })}
                  placeholder="e.g. JUAN"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] uppercase font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Middle Name</label>
                <input
                  type="text"
                  name="aralert_student_middle_name"
                  autoComplete="off"
                  data-lpignore="true"
                  value={studentForm.middle_name}
                  onChange={(e) => setStudentForm({ ...studentForm, middle_name: e.target.value })}
                  placeholder="e.g. PROTACIO"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] uppercase font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  name="aralert_student_last_name"
                  autoComplete="off"
                  data-lpignore="true"
                  required
                  value={studentForm.last_name}
                  onChange={(e) => setStudentForm({ ...studentForm, last_name: e.target.value })}
                  placeholder="e.g. DELA CRUZ"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] uppercase font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">LRN (12 digits)</label>
                <input
                  type="text"
                  name="aralert_student_lrn"
                  autoComplete="off"
                  data-lpignore="true"
                  maxLength={12}
                  value={studentForm.lrn}
                  onChange={(e) => setStudentForm({ ...studentForm, lrn: e.target.value.replace(/\D/g, '') })}
                  placeholder="12-digit number"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">ARAL Program Level *</label>
              <select
                name="aralert_student_level"
                autoComplete="off"
                value={studentForm.aral_level}
                onChange={(e) => setStudentForm({ ...studentForm, aral_level: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] font-semibold"
              >
                <option value="basic">Basic</option>
                <option value="plus">Plus</option>
                <option value="graduated">Graduated</option>
              </select>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
              <button
                type="button"
                onClick={() => setIsEditingStudent(false)}
                className="bg-white dark:bg-transparent border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md text-xs font-bold hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingStudent}
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-5 py-2 rounded-md text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isSavingStudent ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── SAVE STUDENT DETAILS CONFIRMATION MODAL ── */}
      {showSaveConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#222222] rounded-xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 animate-fade-in-scale">
            <div className="flex items-center gap-3 text-[var(--brand)]">
              <div className="p-2.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/40">
                <AlertCircle className="w-6 h-6 text-[var(--brand)]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 uppercase">
                  Confirm Student Details Update
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                  Review before applying changes
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to save the changes for this student? The updated information will be reflected across attendance and score records.
            </p>

            <div className="rounded-lg bg-gray-50 dark:bg-[#1A1A1A] p-3 text-xs space-y-1.5 border border-gray-200 dark:border-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Student Name:</span>
                <span className="font-bold text-gray-900 dark:text-white uppercase">
                  {studentForm.first_name} {studentForm.middle_name ? `${studentForm.middle_name} ` : ''}{studentForm.last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-medium">LRN:</span>
                <span className="font-bold text-gray-900 dark:text-white font-mono">
                  {studentForm.lrn || 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-medium">ARAL Level:</span>
                <span className="font-bold text-gray-900 dark:text-slate-100 uppercase">
                  {studentForm.aral_level}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#1A1A1A]">
              <button
                type="button"
                onClick={() => setShowSaveConfirmModal(false)}
                className="px-4 py-2 rounded-md text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveStudent}
                disabled={isSavingStudent}
                className="px-5 py-2 rounded-md text-xs font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-dark)] transition cursor-pointer shadow-xs"
              >
                {isSavingStudent ? 'Saving...' : 'Yes, Save Details'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── PENDING REQUEST DETAILS MODAL ──────────────────────────── */}
      {showPendingModal && pendingEditRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111111] rounded-lg p-4 sm:p-6 max-w-md w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase">EDIT REQUEST PENDING</h3>
                </div>
              </div>
              <button type="button" onClick={() => setShowPendingModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-[#0A0A0A] p-3.5 rounded-md border border-slate-200 dark:border-[#1A1A1A] space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Requested By:</span>
                  <span className="font-bold text-gray-800 dark:text-white">{pendingEditRequest.requested_by_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Submitted:</span>
                  <span className="font-bold text-gray-800 dark:text-white">{new Date(pendingEditRequest.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-[#1A1A1A] rounded-md p-3.5 space-y-2">
                <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Proposed Changes</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Proposed Name:</span>
                    <span className="font-bold text-gray-800 dark:text-white">
                      {pendingEditRequest.proposed_last_name}, {pendingEditRequest.proposed_first_name} {pendingEditRequest.proposed_middle_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Proposed LRN:</span>
                    <span className="font-mono font-bold text-gray-800 dark:text-white">{pendingEditRequest.proposed_lrn || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Proposed Level:</span>
                    <span className="font-bold text-gray-900 dark:text-slate-100 capitalize">{pendingEditRequest.proposed_aral_level}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-gray-100 dark:border-[#1A1A1A]">
              <button
                type="button"
                onClick={() => setShowCancelConfirmModal(true)}
                disabled={isCancellingStudentEdit}
                className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {isCancellingStudentEdit ? 'Cancelling...' : 'Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION MODAL BEFORE WITHDRAWING EDIT REQUEST ── */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-60 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#111111] rounded-2xl p-4 sm:p-6 max-w-sm w-full border border-gray-200 dark:border-[#222222] shadow-2xl space-y-4 animate-fade-in-scale">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Withdraw Edit Request?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-slate-300">
                  Are you sure you want to withdraw this edit request? The pending request will be cancelled immediately.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-[#1A1A1A]">
              <button
                type="button"
                disabled={isCancellingStudentEdit}
                onClick={() => setShowCancelConfirmModal(false)}
                className="rounded-lg border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer"
              >
                No, Keep Request
              </button>
              <button
                type="button"
                disabled={isCancellingStudentEdit}
                onClick={handleExecuteCancelStudentEditRequest}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isCancellingStudentEdit ? 'Withdrawing...' : 'Yes, Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Student Permanent QR Export Modal ─────────────────── */}
      {/* ── Student Permanent QR Export Modal ─────────────────── */}
      <ExportStudentQrModal
        isOpen={showExportQrModal}
        onClose={() => setShowExportQrModal(false)}
        student={profile ? profile.student : null}
      />
    </div>
  );
};


/* ─── Sub-component: Custom Calendar Dropdown ───────────────── */
const formatDateKey = (year: number, month: number, day: number) => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

const CustomCalendarDropdown: React.FC<{
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onClear: () => void;
  onClose: () => void;
  loggedDates: Set<string>;
  className?: string;
  style?: React.CSSProperties;
}> = ({ selectedDate, onSelectDate, onClear, onClose, loggedDates, className, style }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const d = new Date(selectedDate + 'T00:00:00');
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div
      ref={dropdownRef}
      className={`${className || 'absolute right-0 top-full mt-2'} z-[60] w-72 rounded-lg border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 shadow-xl font-sans select-none text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-150`}
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif", ...style }}
    >
      {/* Month & Navigation in Poppins */}
      <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-[#1A1A1A]">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 transition cursor-pointer"
          aria-label="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-xs text-slate-900 dark:text-white tracking-wide">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-[#1A1A1A] text-slate-600 dark:text-slate-400 transition cursor-pointer"
          aria-label="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekdays in Poppins */}
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400 py-2 text-[10px] uppercase tracking-wider">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      {/* Day Numbers in Poppins */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((dayNum, idx) => {
          if (dayNum === null) {
            return <div key={`empty-${idx}`} className="h-7 w-7" />;
          }

          const cellDateKey = formatDateKey(year, month, dayNum);
          const isSelected = selectedDate === cellDateKey;
          const isToday = todayStr === cellDateKey;
          const hasLogs = loggedDates.has(cellDateKey);

          return (
            <button
              key={cellDateKey}
              type="button"
              onClick={() => {
                onSelectDate(cellDateKey);
                onClose();
              }}
              className={`relative flex flex-col items-center justify-center h-7 w-7 mx-auto rounded-md text-xs font-semibold transition-all cursor-pointer ${isSelected
                ? 'bg-[var(--brand)] text-white font-bold'
                : isToday
                  ? 'border border-[var(--brand)] text-[var(--brand)] font-bold hover:bg-[var(--brand-light)]'
                  : hasLogs
                    ? 'bg-slate-100 dark:bg-[#1A1A1A] text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-200 dark:hover:bg-[#222222]'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A1A1A]'
                }`}
            >
              <span>{dayNum}</span>
              {hasLogs && !isSelected && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--brand)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer shortcut buttons */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-[#1A1A1A] text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => {
            onSelectDate(todayStr);
            onClose();
          }}
          className="text-[var(--brand)] hover:underline cursor-pointer"
        >
          Today
        </button>
        {selectedDate && (
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="text-slate-400 hover:text-red-500 transition cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

/* ─── Sub-component: Score History Table ───────────────────────── */
interface ScoreProps {
  studentId: string;
  reloadTrigger: any;
  onGradesLoaded?: (grades: Grade[]) => void;
}

const ScoreHistoryList: React.FC<ScoreProps> = ({ studentId, reloadTrigger, onGradesLoaded }) => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Sort state ──────────────────────────────────────────────────────
  type SortKey = 'score' | 'remarks' | 'status' | 'date' | 'time';
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  // ── Filter state ────────────────────────────────────────────────────
  type ViewMode = 'day' | 'week' | 'month';
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);


  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const data = await academicService.getGrades({ student_id: studentId });
        setGrades(data);
        if (onGradesLoaded) onGradesLoaded(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGrades();
  }, [studentId, reloadTrigger]);

  // ── Score history helpers ───────────────────────────────────────────
  // Sort all records newest-first
  const sortedHistory = useMemo(
    () => [...grades].sort((a, b) => (b.date_logged > a.date_logged ? 1 : b.date_logged < a.date_logged ? -1 : 0)),
    [grades]
  );

  // When jumpDate is active, we show filtered list for that day
  const jumpFiltered = useMemo(
    () => (jumpDate ? sortedHistory.filter((l) => l.date_logged === jumpDate) : null),
    [sortedHistory, jumpDate]
  );

  const activeRecords = useMemo(
    () => (jumpFiltered !== null ? jumpFiltered : sortedHistory),
    [jumpFiltered, sortedHistory]
  );

  const paginatedRecords = activeRecords;

  // Group by week key "YYYY-Www" (ISO Mon-Sun)
  const getWeekKey = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return mon.toISOString().slice(0, 10);
  };

  const weekLabel = (mondayStr: string) => {
    const mon = new Date(mondayStr + 'T00:00:00');
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(mon)} – ${fmt(fri)}, ${fri.getFullYear()}`;
  };

  // Group by month key "YYYY-MM"
  const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);
  const monthLabel = (key: string) => {
    const d = new Date(key + '-01T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  // Build grouped structure for weekly / monthly views
  type Group = {
    key: string;
    label: string;
    sessionLabel?: string;
    sessionTime?: string;
    records: typeof sortedHistory;
  };
  const groupedHistory = useMemo((): Group[] => {
    if (jumpFiltered !== null) return [];
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of paginatedRecords) {
      const key = viewMode === 'week' ? getWeekKey(log.date_logged) : getMonthKey(log.date_logged);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, records]) => ({
        key,
        label: viewMode === 'week' ? weekLabel(key) : monthLabel(key),
        records,
      }));
  }, [paginatedRecords, viewMode, jumpFiltered]);

  const timeGroupedHistory = useMemo((): Group[] => {
    const source = paginatedRecords;
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of source) {
      const timeStr = log.created_at ? formatTimeString(log.created_at) : '—';
      const key = `${log.date_logged}|${timeStr}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    return Array.from(grouped.entries()).map(([key, records]) => {
      const [date, time] = key.split('|');
      const sessionLabel = formatSessionLabel(getScoreDescription(records[0]));
      const sessionTime = formatSessionTime(records[0].created_at);
      return {
        key,
        label: time !== '—' ? `${formatDateString(date)} | ${time}` : formatDateString(date),
        sessionLabel,
        sessionTime,
        records,
      };
    });
  }, [paginatedRecords]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortRecords = (list: Grade[]) => {
    return [...list].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      const aTotal = Number(a.total_score) || 100;
      const bTotal = Number(b.total_score) || 100;
      const aPct = (Number(a.score) / aTotal) * 100;
      const bPct = (Number(b.score) / bTotal) * 100;
      const aNotTaken = a.remarks?.trim().toLowerCase() === 'not taken';
      const bNotTaken = b.remarks?.trim().toLowerCase() === 'not taken';

      if (sortConfig.key === 'score') {
        aVal = aPct;
        bVal = bPct;
        return sortConfig.direction === 'asc' ? ((aVal as number) - (bVal as number)) : ((bVal as number) - (aVal as number));
      } else if (sortConfig.key === 'remarks') {
        aVal = aNotTaken ? 'Not Taken' : aPct >= 70 ? 'Passed' : 'Failed';
        bVal = bNotTaken ? 'Not Taken' : bPct >= 70 ? 'Passed' : 'Failed';
      } else if (sortConfig.key === 'status') {
        aVal = aNotTaken ? 'Not Taken' : 'Taken';
        bVal = bNotTaken ? 'Not Taken' : 'Taken';
      } else if (sortConfig.key === 'date') {
        aVal = a.date_logged || '';
        bVal = b.date_logged || '';
      } else if (sortConfig.key === 'time') {
        aVal = a.created_at || '';
        bVal = b.created_at || '';
      }
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  };

  const SortableHeader: React.FC<{ label: string; sortKey: SortKey }> = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-gray-900 dark:hover:text-slate-100 cursor-pointer select-none"
        aria-label={`Sort by ${label}`}
      >
        <span className={isActive ? 'text-[var(--brand)] font-extrabold' : ''}>{label}</span>
        {isActive ? (
          sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-75 shrink-0" />
        )}
      </button>
    );
  };

  const renderTable = (records: Grade[]) => (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-[#1A1A1A]">
      <table className="min-w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-xs sm:text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] shadow-xs">
          <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#151515]">
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-2.5 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300">
              <SortableHeader label="SCORE" sortKey="score" />
            </th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-2.5 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300">
              <SortableHeader label="REMARKS" sortKey="remarks" />
            </th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-2.5 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300">
              <SortableHeader label="STATUS" sortKey="status" />
            </th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-2.5 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300">
              <SortableHeader label="DATE" sortKey="date" />
            </th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-2.5 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300">
              <SortableHeader label="TIME" sortKey="time" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#111111]">
          {records.map((grade) => {
            const isNotTaken = grade.remarks?.trim().toLowerCase() === 'not taken';
            const totalScore = Number(grade.total_score) || 100;
            const scorePct = (Number(grade.score) / totalScore) * 100;
            const isPassed = !isNotTaken && scorePct >= 70;

            return (
              <tr key={grade.id} className="group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#151515]">
                <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-xs">
                  <span className="font-mono font-bold text-gray-900 dark:text-slate-100">{grade.score}</span>
                  <span className="font-mono font-bold text-gray-400 dark:text-slate-500"> / {grade.total_score || 100}</span>
                </td>
                <td className="px-2.5 sm:px-4 py-2.5 sm:py-3">
                  <span
                    className={`text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${isNotTaken
                      ? 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800'
                      : isPassed
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60'
                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60'
                      }`}
                  >
                    {isNotTaken ? 'Not Taken' : isPassed ? 'Passed' : 'Failed'}
                  </span>
                </td>
                <td className="px-2.5 sm:px-4 py-2.5 sm:py-3">
                  <span
                    className={`text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${isNotTaken
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60'
                      }`}
                  >
                    {isNotTaken ? 'Not Taken' : 'Taken'}
                  </span>
                </td>
                <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap text-xs">
                  {formatDateString(grade.date_logged)}
                </td>
                <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-gray-700 dark:text-slate-300 font-mono font-bold text-xs whitespace-nowrap">
                  {grade.created_at ? formatTimeString(grade.created_at) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (isLoading) {
    return (
      <div
        className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-sm"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">SCORES HISTORY</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Loading...</p>
          </div>
        </div>
        <div className="text-xs text-gray-400 py-4">Loading score records...</div>
      </div>
    );
  }

  if (grades.length === 0) {
    return (
      <div
        className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-sm"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">SCORES HISTORY</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">0 RECORDS</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <CalendarDays className="w-10 h-10 text-gray-200" />
          <p className="text-sm font-semibold text-gray-500">No score records yet</p>
          <p className="text-xs text-gray-400">Records will appear once scores are logged for this learner</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-sm relative"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
        <div className="min-w-0 flex-1 truncate">
          <h3 className="font-extrabold text-gray-900 dark:text-slate-100 text-xs sm:text-sm uppercase tracking-wider truncate">SCORES HISTORY</h3>
          <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider truncate">
            {jumpFiltered !== null ? jumpFiltered.length : sortedHistory.length} Record
            {(jumpFiltered !== null ? jumpFiltered.length : sortedHistory.length) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
          {/* View mode toggle styled like QR Attendance */}
          <div className="flex bg-gray-100 dark:bg-[#111111] rounded-lg sm:rounded-xl p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                id={`student-score-view-${mode}`}
                type="button"
                onClick={() => {
                  setViewMode(mode);
                  setJumpDate(null);
                }}
                className={`rounded-md sm:rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${viewMode === mode && !jumpDate
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 font-bold'
                  }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Custom Calendar Dropdown Button in Poppins */}
          <div className="relative inline-flex items-center shrink-0">
            <button
              type="button"
              id="student-score-calendar-btn"
              onClick={() => setShowCalendarPopover((prev) => !prev)}
              className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all flex items-center justify-center cursor-pointer ${jumpDate
                ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-sm'
                : 'border-[var(--brand-border)] bg-[var(--brand-light)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)] shadow-xs'
                }`}
              title="Select a specific date from calendar"
              aria-label="Open Calendar"
            >
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {showCalendarPopover && (
              <CustomCalendarDropdown
                selectedDate={jumpDate}
                onSelectDate={(d) => setJumpDate(d)}
                onClear={() => setJumpDate(null)}
                onClose={() => setShowCalendarPopover(false)}
                loggedDates={new Set(grades.map((l) => l.date_logged))}
              />
            )}
          </div>
        </div>
      </div>

      {/* Jump-to-date active chip */}
      {jumpDate && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-100 bg-emerald-50/60">
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">
            {new Date(jumpDate + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <button
            onClick={() => setJumpDate(null)}
            className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}

      {/* Content */}
      {jumpFiltered !== null ? (
        /* ── Jump-to-date: flat/time-grouped list for that specific day ── */
        jumpFiltered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarDays className="w-10 h-10 text-gray-200" />
            <p className="text-sm font-semibold text-gray-500">No records for this date</p>
            <p className="text-xs text-gray-400">Try a different date or clear the filter</p>
          </div>
        ) : (
          <div className="space-y-6">
            {timeGroupedHistory.map((group, idx) => (
              <div key={group.key} className={idx > 0 ? 'mt-6' : ''}>
                <EntrySessionSeparator
                  label={group.sessionLabel || 'RECORD ENTRY'}
                  time={group.sessionTime}
                />
                <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                  <span className="font-semibold text-gray-600 dark:text-slate-300">
                    {group.label}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400">
                    {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {renderTable(sortRecords(group.records))}
              </div>
            ))}
          </div>
        )
      ) : viewMode === 'day' ? (
        /* ── Day: grouped by date and time ── */
        <div className="space-y-6">
          {timeGroupedHistory.map((group, idx) => (
            <div key={group.key} className={idx > 0 ? 'mt-6' : ''}>
              <EntrySessionSeparator
                label={group.sessionLabel || 'RECORD ENTRY'}
                time={group.sessionTime}
              />
              <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                <span className="font-semibold text-gray-600 dark:text-slate-300">
                  {group.label}
                </span>
                <span className="text-[11px] font-semibold text-gray-400">
                  {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                </span>
              </div>
              {renderTable(sortRecords(group.records))}
            </div>
          ))}
        </div>
      ) : (
        /* ── Weekly / Monthly: grouped ── */
        groupedHistory.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarDays className="w-10 h-10 text-gray-200" />
            <p className="text-sm font-semibold text-gray-500">No records to display</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedHistory.map((group) => (
              <div key={group.key}>
                {/* Group divider header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] font-semibold text-gray-400">
                    {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {renderTable(sortRecords(group.records))}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

/* ─── Sub-component: Attendance History Table ──────────────────── */
interface AttendanceProps {
  studentId: string;
  reloadTrigger: any;
  aralLevel?: string | null;
  onAttendanceLoaded?: (logs: Attendance[]) => void;
}

const AttendanceHistoryList: React.FC<AttendanceProps> = ({ studentId, reloadTrigger, aralLevel, onAttendanceLoaded }) => {
  const [logs, setLogs] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Sort state ──────────────────────────────────────────────────────
  type SortKey = 'date' | 'time' | 'status';
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  // ── Filter state ────────────────────────────────────────────────────
  type ViewMode = 'day' | 'week' | 'month';
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);


  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await academicService.getAttendanceHistory({ user_id: studentId });
        setLogs(data);
        if (onAttendanceLoaded) onAttendanceLoaded(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, [studentId, reloadTrigger]);

  // ── Attendance history helpers ───────────────────────────────────────
  // Sort all records newest-first
  const sortedHistory = useMemo(
    () => [...logs].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)),
    [logs]
  );

  // When jumpDate is active, we show filtered list for that day
  const jumpFiltered = useMemo(
    () => (jumpDate ? sortedHistory.filter((l) => l.date === jumpDate) : null),
    [sortedHistory, jumpDate]
  );

  const activeRecords = useMemo(
    () => (jumpFiltered !== null ? jumpFiltered : sortedHistory),
    [jumpFiltered, sortedHistory]
  );

  const paginatedRecords = activeRecords;

  // Group by week key "YYYY-Www" (ISO Mon-Sun)
  const getWeekKey = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return mon.toISOString().slice(0, 10);
  };

  const weekLabel = (mondayStr: string) => {
    const mon = new Date(mondayStr + 'T00:00:00');
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(mon)} – ${fmt(fri)}, ${fri.getFullYear()}`;
  };

  // Group by month key "YYYY-MM"
  const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);
  const monthLabel = (key: string) => {
    const d = new Date(key + '-01T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  // Build grouped structure for weekly / monthly views
  type Group = {
    key: string;
    label: string;
    sessionLabel?: string;
    sessionTime?: string;
    records: typeof sortedHistory;
  };
  const groupedHistory = useMemo((): Group[] => {
    if (jumpFiltered !== null) return [];
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of paginatedRecords) {
      const key = viewMode === 'week' ? getWeekKey(log.date) : getMonthKey(log.date);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => (b > a ? 1 : -1))
      .map(([key, records]) => ({
        key,
        label: viewMode === 'week' ? weekLabel(key) : monthLabel(key),
        records,
      }));
  }, [paginatedRecords, viewMode, jumpFiltered]);

  const timeGroupedHistory = useMemo((): Group[] => {
    const sessionGroups = groupAttendanceBySession(paginatedRecords);
    return sessionGroups.map((g) => {
      const displayDate = formatDateString(g.rows[0].date);
      return {
        key: g.key,
        label: `${displayDate} | ${g.time || formatTimeString(g.rows[0].time_in)}`,
        sessionLabel: g.label,
        sessionTime: g.time,
        records: g.rows,
      };
    });
  }, [paginatedRecords]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortRecords = (list: Attendance[]) => {
    return [...list].sort((a, b) => {
      let aVal = '';
      let bVal = '';
      if (sortConfig.key === 'date') {
        aVal = a.date;
        bVal = b.date;
      } else if (sortConfig.key === 'time') {
        aVal = a.time_in || '';
        bVal = b.time_in || '';
      } else if (sortConfig.key === 'status') {
        aVal = a.status_display || a.status;
        bVal = b.status_display || b.status;
      }
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  };

  const SortableHeader: React.FC<{ label: string; sortKey: SortKey }> = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-gray-900 dark:hover:text-slate-100 cursor-pointer select-none"
        aria-label={`Sort by ${label}`}
      >
        <span className={isActive ? 'text-[var(--brand)] font-extrabold' : ''}>{label}</span>
        {isActive ? (
          sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-75 shrink-0" />
        )}
      </button>
    );
  };

  const renderTable = (records: Attendance[]) => (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-[#1A1A1A]">
      <table className="min-w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-xs sm:text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] shadow-xs">
          <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] bg-gray-50 dark:bg-[#151515]">
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-2.5 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300">
              <SortableHeader label="DATE" sortKey="date" />
            </th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-2.5 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300">
              <SortableHeader label="TIME" sortKey="time" />
            </th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#151515] border-b border-gray-200 dark:border-[#222222] px-2.5 sm:px-4 py-2 sm:py-2.5 text-left text-[10.5px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-slate-300">
              <SortableHeader label="STATUS" sortKey="status" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#111111]">
          {records.map((log) => (
            <tr key={log.id} className="group divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#151515]">
              <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap text-xs">
                {formatDateString(log.date)}
              </td>
              <td className="px-2.5 sm:px-4 py-2.5 sm:py-3 text-gray-700 dark:text-slate-300 font-mono font-bold text-xs whitespace-nowrap">
                {log.time_in ? formatTimeString(log.time_in) : '—'}
              </td>
              <td className="px-2.5 sm:px-4 py-2.5 sm:py-3">
                <span
                  className={`text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${log.status === 'present'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60'
                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60'
                    }`}
                >
                  {log.status_display || log.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (isLoading) {
    return (
      <div
        className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-sm"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">STUDENT ATTENDANCE HISTORY</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Loading...</p>
          </div>
        </div>
        <div className="text-xs text-gray-400 py-4">Loading attendance logs...</div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div
        className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-sm"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Student Attendance History</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">0 RECORDS</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <CalendarDays className="w-10 h-10 text-gray-200" />
          <p className="text-sm font-semibold text-gray-500">No attendance records yet</p>
          <p className="text-xs text-gray-400">Records will appear once attendance is logged for this learner</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-sm relative"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
        <div className="min-w-0 flex-1 truncate">
          <h3 className="font-extrabold text-gray-900 dark:text-slate-100 text-xs sm:text-sm uppercase tracking-wider truncate">STUDENT ATTENDANCE HISTORY</h3>
          <p className="mt-0.5 text-[11px] sm:text-xs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider truncate">
            {jumpFiltered !== null ? jumpFiltered.length : sortedHistory.length} Record
            {(jumpFiltered !== null ? jumpFiltered.length : sortedHistory.length) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
          {/* View mode toggle styled like QR Attendance */}
          <div className="flex bg-gray-100 dark:bg-[#111111] rounded-lg sm:rounded-xl p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                id={`student-att-view-${mode}`}
                type="button"
                onClick={() => {
                  setViewMode(mode);
                  setJumpDate(null);
                }}
                className={`rounded-md sm:rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${viewMode === mode && !jumpDate
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 font-bold'
                  }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Custom Calendar Dropdown Button in Poppins */}
          <div className="relative inline-flex items-center shrink-0">
            <button
              type="button"
              id="student-attendance-calendar-btn"
              onClick={() => setShowCalendarPopover((prev) => !prev)}
              className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all flex items-center justify-center cursor-pointer ${jumpDate
                ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-sm'
                : 'border-[var(--brand-border)] bg-[var(--brand-light)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)] shadow-xs'
                }`}
              title="Select a specific date from calendar"
              aria-label="Open Calendar"
            >
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {showCalendarPopover && (
              <CustomCalendarDropdown
                selectedDate={jumpDate}
                onSelectDate={(d) => setJumpDate(d)}
                onClear={() => setJumpDate(null)}
                onClose={() => setShowCalendarPopover(false)}
                loggedDates={new Set(logs.map((l) => l.date))}
              />
            )}
          </div>
        </div>
      </div>

      {/* Jump-to-date active chip */}
      {jumpDate && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-100 bg-emerald-50/60">
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700">
            {new Date(jumpDate + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <button
            onClick={() => setJumpDate(null)}
            className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}

      {/* Content */}
      {jumpFiltered !== null ? (
        /* ── Jump-to-date: flat/time-grouped list for that specific day ── */
        jumpFiltered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarDays className="w-10 h-10 text-gray-200" />
            <p className="text-sm font-semibold text-gray-500">No records for this date</p>
            <p className="text-xs text-gray-400">Try a different date or clear the filter</p>
          </div>
        ) : (
          <div className="space-y-6">
            {timeGroupedHistory.map((group, idx) => (
              <div key={group.key} className={idx > 0 ? 'mt-6' : ''}>
                <EntrySessionSeparator
                  label={group.sessionLabel || 'ATTENDANCE LOG'}
                  time={group.sessionTime}
                />
                <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                  <span className="font-semibold text-gray-600 dark:text-slate-300">
                    {group.label}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400">
                    {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {renderTable(sortRecords(group.records))}
              </div>
            ))}
          </div>
        )
      ) : viewMode === 'day' ? (
        /* ── Day: grouped by date and time ── */
        <div className="space-y-6">
          {timeGroupedHistory.map((group, idx) => (
            <div key={group.key} className={idx > 0 ? 'mt-6' : ''}>
              <EntrySessionSeparator
                label={group.sessionLabel || 'ATTENDANCE LOG'}
                time={group.sessionTime}
              />
              <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                <span className="font-semibold text-gray-600 dark:text-slate-300">
                  {group.label}
                </span>
                <span className="text-[11px] font-semibold text-gray-400">
                  {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                </span>
              </div>
              {renderTable(sortRecords(group.records))}
            </div>
          ))}
        </div>
      ) : (
        /* ── Weekly / Monthly: grouped ── */
        groupedHistory.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarDays className="w-10 h-10 text-gray-200" />
            <p className="text-sm font-semibold text-gray-500">No records to display</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedHistory.map((group) => (
              <div key={group.key}>
                {/* Group divider header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] font-semibold text-gray-400">
                    {group.records.length} Record{group.records.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {renderTable(sortRecords(group.records))}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};
