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
    <span className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase">
      {formatted}
    </span>
  );
};

const getRiskBadge = (tier?: string | null) => {
  switch (tier?.toLowerCase()) {
    case 'high': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border risk-badge-high">High Risk</span>;
    case 'medium': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border risk-badge-medium">Medium Risk</span>;
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
    const tier = compScore >= 86 ? 'Low' : compScore >= 70 ? 'Medium' : 'High';
    return {
      attendanceRate: Number(attRate.toFixed(2)),
      scoreAvg: Number(scAvg.toFixed(2)),
      compositeScore: compScore,
      riskTier: tier,
    };
  }, [profile]);

  const [studentGrades, setStudentGrades] = useState<Grade[]>([]);
  const studentFirstName = profile?.student?.first_name || profile?.student?.name?.trim().split(' ')[0] || 'Student';

  const { passedCount, failedCount, calculatedAvgScore } = useMemo(() => {
    if (studentGrades.length === 0) {
      return { passedCount: 0, failedCount: 0, calculatedAvgScore: scoreAvg };
    }
    const takenGrades = studentGrades.filter(
      (g) => g.remarks?.trim().toLowerCase() !== 'not taken'
    );
    const passed = takenGrades.filter((g) => {
      const total = Number(g.total_score) || 100;
      return (Number(g.score) / total) >= 0.7;
    }).length;
    const failed = takenGrades.filter((g) => {
      const total = Number(g.total_score) || 100;
      return (Number(g.score) / total) < 0.7;
    }).length;
    const avg = takenGrades.length > 0
      ? Number((takenGrades.reduce((sum, g) => sum + ((Number(g.score) / (Number(g.total_score) || 100)) * 100), 0) / takenGrades.length).toFixed(2))
      : scoreAvg;
    return {
      passedCount: passed,
      failedCount: failed,
      calculatedAvgScore: avg,
    };
  }, [studentGrades, scoreAvg]);

  const hasScoreData = useMemo(() => {
    const takenGrades = studentGrades.filter(
      (g) => g.remarks?.trim().toLowerCase() !== 'not taken'
    );
    return takenGrades.length > 0 || (profile?.grade_details && profile.grade_details.length > 0);
  }, [studentGrades, profile]);

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
        cardBg: 'risk-card-medium',
        iconBg: 'risk-badge-medium',
        iconColor: 'text-risk-medium',
        textColor: 'text-risk-medium',
        valueColor: 'text-risk-medium',
        descColor: 'text-risk-medium',
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
        cardBg: 'risk-card-medium',
        iconBg: 'risk-badge-medium',
        iconColor: 'text-risk-medium',
        textColor: 'text-risk-medium',
        valueColor: 'text-risk-medium',
        descColor: 'text-risk-medium',
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
    risk_level: 'low' as 'low' | 'medium' | 'high',
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
      const [data, gradesData, editReqData, userData] = await Promise.all([
        academicService.getStudentProfile(id),
        academicService.getGrades({ student_id: id }).catch(() => [] as Grade[]),
        userService.getStudentEditRequests({ student_id: id, status: 'pending' }).catch(() => ({ results: [] })),
        userService.getUser(id).catch(() => null as UserType | null),
      ]);
      setProfile(data);
      setStudentUser(userData);
      setStudentGrades(gradesData);
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

  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <div className="space-y-6 max-w-6xl mx-auto skeleton-container animate-pulse" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* Back button skeleton */}
        <div className="h-5 w-44 rounded-xl bg-gray-200 dark:bg-gray-700" />
        {/* Header card skeleton */}
        <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl border border-gray-200 dark:border-[#1A1A1A] shadow-sm p-6 skeleton-row-1">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-700 shrink-0" />
            <div className="space-y-2.5 flex-1">
              <div className="h-6 w-48 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3.5 w-32 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
        </div>
        {/* Tab nav skeleton */}
        <div className="flex w-full rounded-2xl bg-gray-100 dark:bg-[#141414] p-1 gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-9 rounded-xl bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
        {/* KPI containers skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 skeleton-row-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-3xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-gray-200 dark:bg-gray-700 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-7 w-16 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-2.5 w-36 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
        {/* Table card skeleton */}
        <div className="bg-white dark:bg-[#0A0A0A] rounded-3xl border border-gray-200 dark:border-[#1A1A1A] shadow-sm p-6 space-y-4 skeleton-row-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
            <div className="space-y-1.5">
              <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="h-8 w-28 rounded-xl bg-gray-200 dark:bg-gray-700" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-1 border-b border-gray-50 dark:border-gray-900/50">
              <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
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
    <div className="space-y-6 max-w-6xl mx-auto data-loaded-content" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── Top Navigation & Actions ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          to={backPath}
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
      </div>

      {/* ── Student Header Card ──────────────────────────────────── */}
      <div className="bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-6 space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${avatarColor(profile.student.name)}`}>
              <User className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{profile.student.name}</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
                <span className="font-bold text-gray-500 dark:text-slate-400">{studentCohortInfo.aralLevel}</span>
                <span className="text-gray-300 dark:text-zinc-600">•</span>
                <span>{studentCohortInfo.subject}</span>
                <span className="text-gray-300 dark:text-zinc-600">•</span>
                <span>{studentCohortInfo.gradeLevel} - {studentCohortInfo.section}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-1">
                LRN: <span className="font-mono font-bold text-gray-700 dark:text-slate-300">{profile.student.lrn || 'N/A'}</span>
              </p>
            </div>
          </div>

          {/* Action buttons: Edit Student Details / Pending Status */}
          <div className="flex flex-wrap items-center gap-2.5">
            {pendingEditRequest && (
              <button
                type="button"
                onClick={() => setShowPendingModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Edit Request Pending Approval</span>
              </button>
            )}

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
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold border border-gray-200 dark:border-[#1A1A1A] hover:border-[var(--brand)] hover:bg-[var(--brand-light)] dark:hover:bg-[#161616] text-gray-700 dark:text-slate-300 hover:text-[var(--brand-dark)] transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Student Details</span>
            </button>

            <button
              type="button"
              disabled={!profile}
              onClick={() => setShowExportQrModal(true)}
              className="inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-md bg-[var(--brand)] px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-white transition-all hover:bg-[var(--brand-hover)] cursor-pointer shrink-0 whitespace-nowrap shadow-xs disabled:opacity-60"
              title="Export Student Attendance QR Code"
            >
              <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
              <span>Export QR Code</span>
            </button>
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
              className={`flex-1 rounded-sm py-2 px-3 text-xs font-bold uppercase flex items-center justify-center transition-all cursor-pointer ${isActive
                ? 'bg-[var(--brand)] text-white'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
            >
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content Panels ─────────────────────────────────────── */}
      <div className="space-y-6">

        {/* ── 1. OVERALL TAB ───────────────────────────────────────── */}
        {activeTab === 'overall' && (
          <div className="space-y-6">
            {/* KPI Containers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-5 flex flex-col justify-center md:col-span-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-black dark:text-white">COMPOSITE SCORE</p>
                <p className={`text-2xl font-extrabold mt-0.5 ${riskTier === 'High' ? 'text-risk-high' : riskTier === 'Medium' ? 'text-risk-medium' : 'text-risk-low'}`}>
                  {smartPct(compositeScore)}%
                </p>
              </div>

              <div className={`rounded-md border p-5 flex flex-col justify-center md:col-span-2 ${riskTier === 'High'
                ? 'risk-card-high'
                : riskTier === 'Medium'
                  ? 'risk-card-medium'
                  : 'risk-card-low'
                }`}>
                <p className={`text-[11px] font-bold uppercase tracking-wider ${riskTier === 'High'
                  ? 'text-risk-high'
                  : riskTier === 'Medium'
                    ? 'text-risk-medium'
                    : 'text-risk-low'
                  }`}>RISK LEVEL</p>
                <p className={`text-2xl font-extrabold mt-0.5 ${riskTier === 'High'
                  ? 'text-risk-high'
                  : riskTier === 'Medium'
                    ? 'text-risk-medium'
                    : 'text-risk-low'
                  }`}>
                  {riskTier}
                </p>
              </div>
            </div>

            {/* Performance Summary Table */}
            <div className="overflow-hidden rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111]">
              <div className="border-b border-gray-100 dark:border-[#1A1A1A] px-6 py-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 uppercase">STUDENT PERFORMANCE SUMMARY</h3>
                <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">Overview of the calculation</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 dark:divide-[#1A1A1A] text-sm font-normal" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  <thead className="bg-gray-50 dark:bg-[#151515]">
                    <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-6 py-3 text-center">AVERAGE ATTENDANCE RATE</th>
                      <th className="px-6 py-3 text-center">AVERAGE SCORE</th>
                      <th className="px-6 py-3 text-center">COMPOSITE SCORE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#1A1A1A] bg-white dark:bg-[#111111]">
                    <tr className="divide-x divide-gray-100 dark:divide-[#1A1A1A] transition-colors hover:bg-gray-50/80 dark:hover:bg-[#151515] text-center">
                      <td className={`px-6 py-3.5 font-normal ${attendanceRate >= 81 ? 'text-risk-low' : attendanceRate >= 75 ? 'text-risk-medium' : 'text-risk-high'}`}>
                        {smartPct(attendanceRate)}%
                      </td>
                      <td className={`px-6 py-3.5 font-normal ${calculatedAvgScore >= 81 ? 'text-risk-low' : calculatedAvgScore >= 75 ? 'text-risk-medium' : 'text-risk-high'}`}>
                        {smartPct(calculatedAvgScore)}%
                      </td>
                      <td className="px-6 py-3.5 font-normal text-indigo-600 dark:text-indigo-400">
                        {smartPct(compositeScore)}%
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-md border border-emerald-500 dark:border-emerald-500 bg-white dark:bg-[#111111] p-5 flex items-center gap-4">
                <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={3} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">TOTAL PRESENT</p>
                  <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">{profile.attendance.present}</p>
                  <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s total present records</p>
                </div>
              </div>
              <div className="rounded-md border border-rose-500 dark:border-rose-500 bg-white dark:bg-[#111111] p-5 flex items-center gap-4">
                <X className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">TOTAL ABSENT</p>
                  <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-100 mt-0.5">{profile.attendance.absent}</p>
                  <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s total absent records</p>
                </div>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-5 flex flex-col justify-center">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">AVERAGE ATTENDANCE RATE</p>
                  <p
                    className={`text-2xl font-extrabold mt-0.5 ${
                      !hasAttendanceData
                        ? 'text-gray-900 dark:text-slate-100'
                        : attendanceRate >= 81
                        ? 'text-risk-low text-emerald-600 dark:text-emerald-400'
                        : attendanceRate >= 75
                        ? 'text-risk-medium text-amber-600 dark:text-amber-400'
                        : 'text-risk-high text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {hasAttendanceData ? `${smartPct(attendanceRate)}%` : '—'}
                  </p>
                  <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s average attendance rate</p>
                </div>
              </div>
            </div>

            {/* Student Attendance History */}
            <AttendanceHistoryList studentId={id!} reloadTrigger={profile} aralLevel={profile.student.aral_level} />
          </div>
        )}

        {/* ── 3. SCORE TAB ─────────────────────────────────────────── */}
        {activeTab === 'score' && (
          <div className="space-y-4">
            {/* Stat Containers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-md border border-emerald-500 dark:border-emerald-500 bg-white dark:bg-[#111111] p-5 flex items-center gap-4">
                <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={3} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">TOTAL PASSED</p>
                  <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">{passedCount}</p>
                  <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s total passed score records</p>
                </div>
              </div>
              <div className="rounded-md border border-rose-500 dark:border-rose-500 bg-white dark:bg-[#111111] p-5 flex items-center gap-4">
                <X className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={3} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">TOTAL FAILED</p>
                  <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-100 mt-0.5">{failedCount}</p>
                  <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s total failed score records</p>
                </div>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-5 flex flex-col justify-center">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">AVERAGE SCORE</p>
                  <p
                    className={`text-2xl font-extrabold mt-0.5 ${
                      !hasScoreData
                        ? 'text-gray-900 dark:text-slate-100'
                        : calculatedAvgScore >= 81
                        ? 'text-risk-low text-emerald-600 dark:text-emerald-400'
                        : calculatedAvgScore >= 70
                        ? 'text-risk-medium text-amber-600 dark:text-amber-400'
                        : 'text-risk-high text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {hasScoreData ? `${smartPct(calculatedAvgScore)}%` : '—'}
                  </p>
                  <p className="mt-0.5 text-xs font-normal text-gray-500 dark:text-slate-400">{studentFirstName}'s average score</p>
                </div>
              </div>
            </div>

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
          <form onSubmit={handleAddActivity} className="bg-white dark:bg-[#111111] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4">
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
          <form onSubmit={handleAddRisk} className="bg-white dark:bg-[#111111] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A] pb-3">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Log Academic Risk Warning</h3>
              <button type="button" onClick={() => setShowRiskModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Risk Level</label>
              <select
                value={riskForm.risk_level}
                onChange={(e) => setRiskForm({ ...riskForm, risk_level: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#1A1A1A] rounded-md text-sm bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-white focus:bg-white dark:focus:bg-[#111111] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              >
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
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
          <form onSubmit={handleAddAttendance} className="bg-white dark:bg-[#111111] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4">
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

      {/* ── STUDENT EDIT MODAL ─────────────────────────────── */}
      {isEditingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <form
            onSubmit={handlePromptSaveStudent}
            autoComplete="off"
            data-form-type="other"
            className="bg-white dark:bg-[#111111] rounded-lg p-6 max-w-lg w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4 my-8 animate-fade-in-scale"
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
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#222222] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in-scale">
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
                <span className="font-bold text-[var(--brand)] uppercase">
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
          <div className="bg-white dark:bg-[#111111] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#1A1A1A] shadow-2xl space-y-4">
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
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 capitalize">{pendingEditRequest.proposed_aral_level}</span>
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
          <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 max-w-sm w-full border border-gray-200 dark:border-[#222222] shadow-2xl space-y-4 animate-fade-in-scale">
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
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-gray-700"
        aria-label={`Sort by ${label}`}
      >
        {label}
        {isActive ? (
          sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
        )}
      </button>
    );
  };

  const renderTable = (records: Grade[]) => (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-[#1A1A1A]">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead>
          <tr className="divide-x divide-gray-100 bg-gray-50">
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <SortableHeader label="SCORE" sortKey="score" />
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <SortableHeader label="REMARKS" sortKey="remarks" />
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <SortableHeader label="STATUS" sortKey="status" />
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <SortableHeader label="DATE" sortKey="date" />
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <SortableHeader label="TIME" sortKey="time" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {records.map((grade) => {
            const isNotTaken = grade.remarks?.trim().toLowerCase() === 'not taken';
            const totalScore = Number(grade.total_score) || 100;
            const scorePct = (Number(grade.score) / totalScore) * 100;
            const isPassed = !isNotTaken && scorePct >= 70;

            return (
              <tr key={grade.id} className="group divide-x divide-gray-100 transition-colors hover:bg-gray-50/80">
                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap text-xs">
                  <span className="font-bold text-gray-900">{grade.score}</span>
                  <span className="text-gray-400 font-normal"> / {grade.total_score || 100}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${isNotTaken
                      ? 'bg-gray-50 text-gray-500 border-gray-200'
                      : isPassed
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                  >
                    {isNotTaken ? 'Not Taken' : isPassed ? 'Passed' : 'Failed'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${isNotTaken
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                  >
                    {isNotTaken ? 'Not Taken' : 'Taken'}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap text-xs">
                  {formatDateString(grade.date_logged)}
                </td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">
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
        className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-6 space-y-4"
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
        className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-6 space-y-4"
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
      className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-6 space-y-4 relative"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
        <div className="min-w-0 flex-1 truncate">
          <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm uppercase truncate">SCORES HISTORY</h3>
          <p className="mt-0.5 text-[10px] sm:text-xs font-normal text-gray-500 dark:text-gray-400 truncate">
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
                className={`rounded-md sm:rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${viewMode === mode && !jumpDate
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
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
}

const AttendanceHistoryList: React.FC<AttendanceProps> = ({ studentId, reloadTrigger, aralLevel }) => {
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
        className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-gray-700"
        aria-label={`Sort by ${label}`}
      >
        {label}
        {isActive ? (
          sortConfig.direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
        )}
      </button>
    );
  };

  const renderTable = (records: Attendance[]) => (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-[#1A1A1A]">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead>
          <tr className="divide-x divide-gray-100 bg-gray-50">
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <SortableHeader label="DATE" sortKey="date" />
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <SortableHeader label="TIME" sortKey="time" />
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <SortableHeader label="STATUS" sortKey="status" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {records.map((log) => (
            <tr key={log.id} className="group divide-x divide-gray-100 transition-colors hover:bg-gray-50/80">
              <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap text-xs">
                {formatDateString(log.date)}
              </td>
              <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                {log.time_in ? formatTimeString(log.time_in) : '—'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${log.status === 'present'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
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
        className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-6 space-y-4"
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
        className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-6 space-y-4"
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
      className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-6 space-y-4 relative"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
        <div className="min-w-0 flex-1 truncate">
          <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm uppercase truncate">STUDENT ATTENDANCE HISTORY</h3>
          <p className="mt-0.5 text-[10px] sm:text-xs font-normal text-gray-500 dark:text-gray-400 truncate">
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
                className={`rounded-md sm:rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${viewMode === mode && !jumpDate
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
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
